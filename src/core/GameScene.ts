import Phaser from 'phaser';
import {
  TILE_SIZE, VIEWPORT_ROWS,
  CANVAS_WIDTH,
  EDGE_SCROLL_MARGIN, EDGE_SCROLL_SPEED,
  EVENTS,
} from '../utils/constants';
import { GridPosition, PixelPosition, posEquals, posKey } from '../utils/types';

import { GridManager } from '../grid/GridManager';
import { MovementResolver } from '../grid/MovementResolver';
import { TERRAIN_DEFS } from '../grid/TerrainType';

import { Unit } from '../units/Unit';
import { UnitFactory } from '../units/UnitFactory';
import { UnitView } from '../units/UnitView';

import { MoveAction } from '../actions/MoveAction';
import { AttackAction } from '../actions/AttackAction';
import { WaitAction } from '../actions/WaitAction';
import type { Action, ActionContext } from '../actions/Action';

import { TurnManager } from '../turn/TurnManager';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../input/InputManager';

import { MapLoader } from '../maps/MapLoader';
import { testMap } from '../maps/definitions/testMap';

import { AIController } from '../ai/AIController';
import { ChaseNearestStrategy } from '../ai/ChaseNearestStrategy';

// ---------------------------------------------------------------------------
// Tipos para la máquina de estados de interacción del jugador
// ---------------------------------------------------------------------------

type InteractionState =
  | { type: 'idle' }
  | { type: 'selected'; unit: Unit }
  | { type: 'selectingMove'; unit: Unit; reachable: GridPosition[] }
  | { type: 'selectingAttack'; unit: Unit; targets: GridPosition[] }
  | { type: 'animating' }
  | { type: 'enemyPhase' };

// ---------------------------------------------------------------------------
// Acciones disponibles (instanciadas una vez, sin estado)
// ---------------------------------------------------------------------------

const ACTIONS: Readonly<Record<string, Action>> = {
  move: new MoveAction(),
  attack: new AttackAction(),
  wait: new WaitAction(),
};

/**
 * Escena principal del juego.
 *
 * Actúa como el "conductor" que instancia sistemas, los conecta via eventos,
 * y coordina la capa visual con la lógica.
 */
export class GameScene extends Phaser.Scene {
  // Sistemas de lógica
  private gridManager!: GridManager;
  private resolver!: MovementResolver;
  private turnManager!: TurnManager;
  private inputManager!: InputManager;
  private uiManager!: UIManager;
  private aiController!: AIController;

  // Unidades del juego
  private units: Unit[] = [];
  private unitViews: Map<string, UnitView> = new Map();

  // Gráficos de Phaser
  private terrainGfx!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;
  private pathGfx!: Phaser.GameObjects.Graphics;
  private cursorGfx!: Phaser.GameObjects.Graphics;

  // Estado de interacción del jugador
  private iState: InteractionState = { type: 'idle' };

  constructor() {
    super({ key: 'GameScene' });
  }

  /**
   * Único lugar donde cambia iState — así queda sincronizada la velocidad del
   * cursor de teclado: más lento mientras se elige destino de Mover/Atacar
   * (conviene ir con cuidado casilla por casilla), normal el resto del tiempo.
   */
  private setInteractionState(state: InteractionState): void {
    this.iState = state;
    this.inputManager.setCursorSpeed(
      state.type === 'selectingMove' || state.type === 'selectingAttack' ? 'slow' : 'normal',
    );
  }

  // ---------------------------------------------------------------------------
  // Ciclo de vida de la escena
  // ---------------------------------------------------------------------------

  create(): void {
    // 1. Cargar mapa y construir sistemas
    const mapData = MapLoader.loadFromDefinition(testMap);
    this.gridManager = new GridManager(mapData);
    this.resolver = new MovementResolver(this.gridManager);
    this.turnManager = new TurnManager(this.events);
    this.inputManager = new InputManager(this, this.gridManager);
    this.aiController = new AIController(new ChaseNearestStrategy());

    // El mapa puede ser más grande que la pantalla: la cámara recorre ese
    // espacio extra, pero nunca más allá del borde del mapa.
    const mapWidth = mapData.cols * TILE_SIZE;
    const mapHeight = mapData.rows * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    // Arranca centrada en el mapa (donde están las unidades), no en la esquina (0,0)
    this.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);

    // 2. Crear capas de gráficos (orden = profundidad)
    this.terrainGfx = this.add.graphics().setDepth(0);
    this.overlayGfx = this.add.graphics().setDepth(1);
    this.pathGfx    = this.add.graphics().setDepth(2);
    this.cursorGfx  = this.add.graphics().setDepth(3);

    // 3. Renderizar terreno (estático, solo una vez)
    this.renderTerrain();

    // 4. Instanciar unidades a partir de las colocaciones del mapa
    const factory = new UnitFactory();
    for (const placement of mapData.unitPlacements ?? []) {
      const unit = factory.create(
        placement.type,
        { col: placement.col, row: placement.row },
        placement.faction,
      );
      this.units.push(unit);
      this.gridManager.setOccupied(unit.gridPos, unit.id);

      const view = new UnitView(this, unit, this.gridManager);
      view.setDepth(10);
      this.unitViews.set(unit.id, view);
    }

    // 5. Crear UI (necesita los sistemas ya inicializados)
    this.uiManager = new UIManager(this, this.turnManager, () => this.onEndTurn());

    // 6. Escuchar eventos del bus
    this.setupEventListeners();

    // 7. Iniciar la primera fase del jugador
    this.startPlayerPhase();
  }

  update(_time: number, delta: number): void {
    this.inputManager.update(delta);
    this.updateCameraScroll(delta);

    // Actualizar overlay de ruta al casilla bajo el cursor (mouse o teclado)
    if (this.iState.type === 'selectingMove') {
      const cursor = this.inputManager.getCursorPos();
      this.updatePathOverlay(this.iState.unit, this.iState.reachable, cursor);
    }
  }

  /**
   * Desplaza la cámara cuando el foco (mouse o teclado) se acerca a un borde
   * del viewport, a velocidad constante. Los límites del mapa (`setBounds`)
   * ya frenan solos el scroll cuando no queda nada más para mostrar en esa
   * dirección.
   *
   * Con mouse se usa su posición de pantalla en vivo (para que "quedarse
   * quieto pegado al borde" siga scrolleando cuadro a cuadro). El teclado no
   * tiene posición continua entre casillas, así que ahí se usa la celda del
   * cursor de grilla proyectada a pantalla — que se auto-corrige sola apenas
   * vuelve a quedar dentro del margen.
   */
  private updateCameraScroll(delta: number): void {
    if (this.iState.type === 'enemyPhase' || this.iState.type === 'animating') return;

    const camera = this.cameras.main;
    const screenPos = this.inputManager.getLiveMouseScreenPos() ?? this.gridCursorScreenPos(camera);
    if (!screenPos) return;

    const playHeight = VIEWPORT_ROWS * TILE_SIZE;

    let dirX = 0;
    if (screenPos.x < EDGE_SCROLL_MARGIN) dirX = -1;
    else if (screenPos.x > CANVAS_WIDTH - EDGE_SCROLL_MARGIN) dirX = 1;

    let dirY = 0;
    if (screenPos.y < EDGE_SCROLL_MARGIN) dirY = -1;
    else if (screenPos.y > playHeight - EDGE_SCROLL_MARGIN) dirY = 1;

    if (dirX === 0 && dirY === 0) return;

    const distance = (EDGE_SCROLL_SPEED * delta) / 1000;
    camera.scrollX += dirX * distance;
    camera.scrollY += dirY * distance;
  }

  /** Proyecta el centro de la celda del cursor de teclado a coordenadas de pantalla */
  private gridCursorScreenPos(camera: Phaser.Cameras.Scene2D.Camera): PixelPosition | null {
    const cursor = this.inputManager.getCursorPos();
    if (!cursor) return null;
    const { x: worldX, y: worldY } = this.gridManager.gridToCenter(cursor.col, cursor.row);
    return { x: worldX - camera.scrollX, y: worldY - camera.scrollY };
  }

  // ---------------------------------------------------------------------------
  // Eventos del bus
  // ---------------------------------------------------------------------------

  private setupEventListeners(): void {
    this.events.on(EVENTS.GRID_CLICK, this.onGridClick, this);
    this.events.on(EVENTS.GRID_HOVER, this.onGridHover, this);
    this.events.on(EVENTS.PHASE_CHANGED, this.onPhaseChanged, this);
    this.events.on(EVENTS.CANCEL, this.onCancel, this);
    this.events.on(EVENTS.UNIT_ATTACKED, this.onUnitAttacked, this);
  }

  /** Muestra el popup de daño/fallo sobre el defensor cuando se resuelve un ataque */
  private onUnitAttacked(payload: { defender: Unit; damage: number }): void {
    this.unitViews.get(payload.defender.id)?.showDamagePopup(payload.damage);
  }

  /** Resalta en amarillo la casilla enfocada por mouse o teclado (mismo evento para ambos) */
  private onGridHover(pos: GridPosition): void {
    if (this.iState.type === 'enemyPhase' || this.iState.type === 'animating') {
      this.cursorGfx.clear();
      return;
    }

    const { x, y } = this.gridManager.gridToPixel(pos.col, pos.row);
    this.cursorGfx.clear();
    this.cursorGfx.lineStyle(2.5, 0xffee55, 0.9);
    this.cursorGfx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }

  private onGridClick(pos: GridPosition): void {
    const state = this.iState;

    if (state.type === 'idle' || state.type === 'selected') {
      // Clic en una unidad del jugador
      const unit = this.getPlayerUnitAt(pos);
      if (unit && unit.state.canAct()) {
        this.selectUnit(unit);
        return;
      }
      // Clic en vacío: deseleccionar
      if (state.type === 'selected') {
        this.deselectUnit();
      }
    }

    if (state.type === 'selectingMove') {
      const isReachable = state.reachable.some(p => posEquals(p, pos));
      if (isReachable) {
        this.executeMove(state.unit, pos);
      } else {
        // Clic fuera del rango: volver al menú
        this.selectUnit(state.unit);
      }
    }

    if (state.type === 'selectingAttack') {
      const isTarget = state.targets.some(p => posEquals(p, pos));
      if (isTarget) {
        this.executeAttack(state.unit, pos);
      } else {
        // Clic fuera de los objetivos válidos: volver al menú
        this.selectUnit(state.unit);
      }
    }
  }

  private onPhaseChanged(payload: { phase: string; turn: number }): void {
    this.uiManager.refreshHUD(this.turnManager);

    if (payload.phase === 'enemy') {
      this.startEnemyPhase();
    } else if (payload.phase === 'player') {
      this.startPlayerPhase();
    }
  }

  private onCancel(): void {
    if (this.iState.type === 'selectingMove' || this.iState.type === 'selectingAttack') {
      this.selectUnit(this.iState.unit);
    } else if (this.iState.type === 'selected') {
      this.deselectUnit();
    }
  }

  // ---------------------------------------------------------------------------
  // Fases de turno
  // ---------------------------------------------------------------------------

  private startPlayerPhase(): void {
    this.setInteractionState({ type: 'idle' });
    this.clearOverlays();

    // Resetear unidades del jugador
    this.units
      .filter(u => u.faction === 'player')
      .forEach(u => {
        u.resetForNewTurn();
        this.unitViews.get(u.id)?.setUsed(false);
      });
  }

  private async startEnemyPhase(): Promise<void> {
    this.setInteractionState({ type: 'enemyPhase' });
    this.clearOverlays();
    this.cursorGfx.clear();
    this.closeActionMenu();

    // Resetear unidades enemigas (mismo ritual que las del jugador en su fase)
    const enemyUnits = this.units.filter(u => u.faction === 'enemy');
    enemyUnits.forEach(u => {
      u.resetForNewTurn();
      this.unitViews.get(u.id)?.setUsed(false);
    });

    // Una unidad a la vez, en orden al azar (a futuro puede reemplazarse por
    // una regla de orden más específica sin tocar el resto de este método)
    for (const unit of this.shuffle(enemyUnits)) {
      await this.takeEnemyTurn(unit);
    }

    this.turnManager.nextPhase();
  }

  /** Decide (vía AIController) y ejecuta el turno de una sola unidad enemiga */
  private async takeEnemyTurn(unit: Unit): Promise<void> {
    if (!unit.state.canAct()) return;
    if (unit.state.name === 'idle') {
      unit.state.transition('selected');
    }

    const decision = this.aiController.decide(unit, this.buildContext());

    if (decision.moveTo) {
      await this.animateMove(unit, decision.moveTo);
      this.setInteractionState({ type: 'enemyPhase' });
    }

    // Si decidió atacar pero el objetivo ya no está (p.ej. otro enemigo lo mató antes
    // en esta misma fase), cae a Esperar — así la unidad siempre llega a 'done'.
    const attacked = decision.attackTarget && this.performAttack(unit, decision.attackTarget);
    if (!attacked) {
      ACTIONS.wait.execute(unit, null, this.buildContext());
    }

    this.unitViews.get(unit.id)?.setUsed(true);
    await this.pause(400);
  }

  /** Espera `ms` sin bloquear el resto de la escena */
  private pause(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  /** Copia mezclada de `items` (Fisher-Yates), sin mutar el array original */
  private shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private onEndTurn(): void {
    this.endPlayerTurn();
  }

  private endPlayerTurn(): void {
    if (!this.turnManager.isPlayerPhase()) return;
    this.deselectUnit();
    this.turnManager.nextPhase();
  }

  /** Si ninguna unidad del jugador puede ya actuar, pasa de turno solo (sin esperar el clic) */
  private maybeAutoEndTurn(): void {
    const anyoneCanAct = this.units.some(u => u.faction === 'player' && u.state.canAct());
    if (!anyoneCanAct) this.endPlayerTurn();
  }

  // ---------------------------------------------------------------------------
  // Selección y acciones de unidad
  // ---------------------------------------------------------------------------

  private selectUnit(unit: Unit): void {
    // Quitar selección visual anterior sin tocar el FSM de esa unidad
    if (this.iState.type === 'selected') {
      this.unitViews.get(this.iState.unit.id)?.setSelected(false);
    }

    // Transición FSM: solo si la unidad no está ya en 'selected'
    if (unit.state.name === 'idle') {
      unit.state.transition('selected');
    }

    this.setInteractionState({ type: 'selected', unit });
    this.clearOverlays();
    this.uiManager.hideActionMenu();

    this.unitViews.get(unit.id)?.setSelected(true);
    this.events.emit(EVENTS.UNIT_SELECTED, { unit });

    // Construir menú dinámicamente según las acciones disponibles
    const ctx = this.buildContext();
    const menuItems = unit.getAvailableActionKeys()
      .filter(key => ACTIONS[key]?.canExecute(unit, ctx))
      .map(key => {
        const action = ACTIONS[key];
        return {
          label: action.label,
          callback: () => this.onActionSelected(unit, action),
        };
      });

    // Siempre disponible, en cualquier unidad: terminar turno sin ir hasta el botón del HUD
    // (evita cruzar la franja de scroll de cámara solo para llegar a él)
    menuItems.push({ label: 'Terminar Turno', callback: () => this.onEndTurn() });

    // Posicionar el menú cerca de la unidad (desplazado a la derecha)
    const center = this.gridManager.gridToCenter(unit.gridPos.col, unit.gridPos.row);
    const menuX = Math.min(center.x + TILE_SIZE / 2 + 4, CANVAS_WIDTH - 145);
    const menuY = Math.max(center.y - TILE_SIZE / 2, 4);

    this.openActionMenu(menuX, menuY, menuItems);
  }

  private deselectUnit(): void {
    if (
      this.iState.type === 'selected' ||
      this.iState.type === 'selectingMove' ||
      this.iState.type === 'selectingAttack'
    ) {
      const unit = (this.iState as { unit: Unit }).unit;
      this.unitViews.get(unit.id)?.setSelected(false);
      // Si la unidad no actuó aún, regresa al estado idle para poder re-seleccionarla
      if (unit.state.name === 'selected') {
        unit.state.transition('idle');
      }
    }
    this.setInteractionState({ type: 'idle' });
    this.clearOverlays();
    this.closeActionMenu();
    this.events.emit(EVENTS.UNIT_DESELECTED);
  }

  /** Muestra el menú de acciones y hace que el teclado navegue el menú en vez de la grilla */
  private openActionMenu(x: number, y: number, items: { label: string; callback: () => void }[]): void {
    this.uiManager.showActionMenu(x, y, items);
    this.inputManager.setMode('menu');
  }

  /** Oculta el menú de acciones y devuelve el teclado a mover el cursor de grilla */
  private closeActionMenu(): void {
    this.uiManager.hideActionMenu();
    this.inputManager.setMode('grid');
  }

  private onActionSelected(unit: Unit, action: Action): void {
    this.closeActionMenu();

    if (action.key === 'move') {
      const ctx = this.buildContext();
      const reachable = action.getValidTargets(unit, ctx);
      this.setInteractionState({ type: 'selectingMove', unit, reachable });
      this.renderMovementOverlay(reachable);
    } else if (action.key === 'attack') {
      const ctx = this.buildContext();
      const targets = action.getValidTargets(unit, ctx);
      this.setInteractionState({ type: 'selectingAttack', unit, targets });
      this.renderAttackOverlay(targets);
    } else if (action.key === 'wait') {
      const ctx = this.buildContext();
      action.execute(unit, null, ctx);
      this.unitViews.get(unit.id)?.setSelected(false);
      this.unitViews.get(unit.id)?.setUsed(true);
      this.setInteractionState({ type: 'idle' });
      this.maybeAutoEndTurn();
    }
  }

  private executeMove(unit: Unit, target: GridPosition): void {
    this.animateMove(unit, target).then(() => {
      // Moverse no gasta el turno de la unidad: reabre su menú (ya sin "Mover",
      // el estado pasó a 'moved') para que pueda Atacar o Esperar.
      this.selectUnit(unit);
    });
  }

  /**
   * Mueve la unidad (estado lógico + animación) por la ruta calculada;
   * resuelve cuando termina. Lo comparten el jugador (que al terminar reabre
   * su menú, ver `executeMove`) y la IA (que sigue con su propia decisión) —
   * cada llamador decide qué pasa después, esto solo mueve.
   */
  private animateMove(unit: Unit, target: GridPosition): Promise<void> {
    return new Promise(resolve => {
      this.setInteractionState({ type: 'animating' });
      this.clearOverlays();

      // Calcular la ruta ANTES de ejecutar la acción (que ya muta unit.gridPos)
      const path = this.resolver.getPath(unit.gridPos, target) ?? [target];

      const ctx = this.buildContext();
      // La acción actualiza el estado lógico y emite UNIT_MOVED
      ACTIONS.move.execute(unit, target, ctx);

      // Animar la vista siguiendo la misma ruta ortogonal de la previsualización
      const view = this.unitViews.get(unit.id);
      view?.tweenAlongPath(path, this.gridManager, () => {
        this.events.emit(EVENTS.UNIT_MOVE_ANIMATION_DONE, { unit });
        resolve();
      });
    });
  }

  private executeAttack(unit: Unit, target: GridPosition): void {
    if (!this.performAttack(unit, target)) return; // no había enemigo ahí: no pasa nada

    this.setInteractionState({ type: 'idle' });
    this.clearOverlays();
    this.unitViews.get(unit.id)?.setSelected(false);
    this.unitViews.get(unit.id)?.setUsed(true);
    this.maybeAutoEndTurn();
  }

  /**
   * Aplica el ataque (daño, HP, posible derrota) y refresca las vistas
   * involucradas. No toca iState ni la selección — eso lo maneja el jugador
   * (`executeAttack`) o la IA (`takeEnemyTurn`), cada uno a su manera.
   * Devuelve false si no había ningún enemigo en esa casilla.
   */
  private performAttack(unit: Unit, target: GridPosition): boolean {
    const defender = this.units.find(u => u.faction !== unit.faction && posEquals(u.gridPos, target));
    if (!defender) return false;

    const ctx = this.buildContext();
    // La acción actualiza HP/estado y emite UNIT_ATTACKED (y UNIT_DEFEATED si corresponde)
    ACTIONS.attack.execute(unit, target, ctx);

    if (defender.stats.currentHp <= 0) {
      this.removeUnit(defender);
    } else {
      this.unitViews.get(defender.id)?.refreshHp();
    }
    return true;
  }

  /** Saca una unidad derrotada del tablero: libera la casilla y destruye su vista */
  private removeUnit(unit: Unit): void {
    this.gridManager.clearOccupancy(unit.gridPos);
    this.unitViews.get(unit.id)?.destroy();
    this.unitViews.delete(unit.id);
    this.units = this.units.filter(u => u.id !== unit.id);
  }

  // ---------------------------------------------------------------------------
  // Renderizado de la grilla y overlays
  // ---------------------------------------------------------------------------

  private renderTerrain(): void {
    const g = this.terrainGfx;
    g.clear();

    for (let row = 0; row < this.gridManager.rows; row++) {
      for (let col = 0; col < this.gridManager.cols; col++) {
        const tile = this.gridManager.getTile(col, row)!;
        const def = TERRAIN_DEFS[tile.terrain];
        const { x, y } = this.gridManager.gridToPixel(col, row);

        // Relleno del terreno
        g.fillStyle(def.fillColor, 1);
        g.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Detalle visual según tipo de terreno
        this.renderTerrainDetail(g, def.fillColor, x, y);

        // Borde de casilla
        g.lineStyle(1, def.borderColor, 0.5);
        g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /** Agrega pequeños detalles visuales según el tipo de terreno */
  private renderTerrainDetail(
    g: Phaser.GameObjects.Graphics,
    baseColor: number,
    x: number,
    y: number,
  ): void {
    const half = TILE_SIZE / 2;

    // Símbolo de árbol para bosque
    if (baseColor === TERRAIN_DEFS.FOREST.fillColor) {
      g.fillStyle(0x1a3a08, 0.6);
      g.fillTriangle(x + half, y + 10, x + 14, y + 46, x + half * 2 - 14, y + 46);
      g.fillStyle(0x224410, 0.4);
      g.fillTriangle(x + half, y + 18, x + 18, y + 52, x + half * 2 - 18, y + 52);
    }

    // Símbolo de pico para montaña
    if (baseColor === TERRAIN_DEFS.MOUNTAIN.fillColor) {
      g.fillStyle(0x555550, 0.5);
      g.fillTriangle(x + half, y + 8, x + 8, y + 56, x + half * 2 - 8, y + 56);
      g.fillStyle(0xffffff, 0.25);
      g.fillTriangle(x + half, y + 8, x + half - 8, y + 28, x + half + 8, y + 28);
    }

    // Ondas para agua
    if (baseColor === TERRAIN_DEFS.WATER.fillColor) {
      g.lineStyle(2, 0x66aacc, 0.4);
      for (let i = 0; i < 3; i++) {
        const wy = y + 16 + i * 14;
        g.beginPath();
        g.moveTo(x + 8, wy);
        g.lineTo(x + 24, wy - 4);
        g.lineTo(x + 40, wy);
        g.lineTo(x + 56, wy - 4);
        g.strokePath();
      }
    }
  }

  private renderMovementOverlay(reachable: GridPosition[]): void {
    this.overlayGfx.clear();
    for (const pos of reachable) {
      const { x, y } = this.gridManager.gridToPixel(pos.col, pos.row);
      this.overlayGfx.fillStyle(0x4488ff, 0.35);
      this.overlayGfx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      this.overlayGfx.lineStyle(1.5, 0x66aaff, 0.7);
      this.overlayGfx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }
  }

  /** Igual que renderMovementOverlay pero en rojo, para objetivos de ataque. Misma capa: nunca se muestran juntas. */
  private renderAttackOverlay(targets: GridPosition[]): void {
    this.overlayGfx.clear();
    for (const pos of targets) {
      const { x, y } = this.gridManager.gridToPixel(pos.col, pos.row);
      this.overlayGfx.fillStyle(0xdd3333, 0.35);
      this.overlayGfx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      this.overlayGfx.lineStyle(1.5, 0xff6666, 0.7);
      this.overlayGfx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }
  }

  private updatePathOverlay(
    unit: Unit,
    reachable: GridPosition[],
    hovered: GridPosition | null,
  ): void {
    this.pathGfx.clear();
    if (!hovered) return;

    const isReachable = reachable.some(p => posEquals(p, hovered));
    if (!isReachable) return;

    const path = this.resolver.getPath(unit.gridPos, hovered);
    if (!path) return;

    // Ruta con color más intenso
    for (const pos of path) {
      const { x, y } = this.gridManager.gridToPixel(pos.col, pos.row);
      this.pathGfx.fillStyle(0x2266cc, 0.55);
      this.pathGfx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }

    // Destino con destaque
    const dest = hovered;
    const { x: dx, y: dy } = this.gridManager.gridToPixel(dest.col, dest.row);
    this.pathGfx.lineStyle(2.5, 0xffffff, 0.8);
    this.pathGfx.strokeRect(dx + 3, dy + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  }

  private clearOverlays(): void {
    this.overlayGfx.clear();
    this.pathGfx.clear();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getPlayerUnitAt(pos: GridPosition): Unit | undefined {
    return this.units.find(
      u => u.faction === 'player' && posEquals(u.gridPos, pos),
    );
  }

  private buildContext(): ActionContext {
    return {
      grid: this.gridManager,
      resolver: this.resolver,
      allUnits: this.units,
      events: this.events,
    };
  }
}
