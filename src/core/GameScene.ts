import Phaser from 'phaser';
import {
  TILE_SIZE, GRID_ROWS, GRID_COLS,
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  EVENTS,
} from '../utils/constants';
import { GridPosition, posEquals, posKey } from '../utils/types';

import { GridManager } from '../grid/GridManager';
import { MovementResolver } from '../grid/MovementResolver';
import { TERRAIN_DEFS } from '../grid/TerrainType';

import { Unit } from '../units/Unit';
import { UnitFactory } from '../units/UnitFactory';
import { UnitView } from '../units/UnitView';

import { MoveAction } from '../actions/MoveAction';
import { WaitAction } from '../actions/WaitAction';
import type { Action, ActionContext } from '../actions/Action';

import { TurnManager } from '../turn/TurnManager';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../input/InputManager';

import { MapLoader } from '../maps/MapLoader';
import { testMap } from '../maps/definitions/testMap';

// ---------------------------------------------------------------------------
// Tipos para la máquina de estados de interacción del jugador
// ---------------------------------------------------------------------------

type InteractionState =
  | { type: 'idle' }
  | { type: 'selected'; unit: Unit }
  | { type: 'selectingMove'; unit: Unit; reachable: GridPosition[] }
  | { type: 'animating' }
  | { type: 'enemyPhase' };

// ---------------------------------------------------------------------------
// Acciones disponibles (instanciadas una vez, sin estado)
// ---------------------------------------------------------------------------

const ACTIONS: Readonly<Record<string, Action>> = {
  move: new MoveAction(),
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

  // Unidades del juego
  private units: Unit[] = [];
  private unitViews: Map<string, UnitView> = new Map();

  // Gráficos de Phaser
  private terrainGfx!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;
  private pathGfx!: Phaser.GameObjects.Graphics;

  // Estado de interacción del jugador
  private iState: InteractionState = { type: 'idle' };

  constructor() {
    super({ key: 'GameScene' });
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

    // 2. Crear capas de gráficos (orden = profundidad)
    this.terrainGfx = this.add.graphics().setDepth(0);
    this.overlayGfx = this.add.graphics().setDepth(1);
    this.pathGfx    = this.add.graphics().setDepth(2);

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

  update(_time: number, _delta: number): void {
    // Actualizar overlay de ruta al casilla bajo el cursor
    if (this.iState.type === 'selectingMove') {
      const hovered = this.inputManager.getHoveredGridPos();
      this.updatePathOverlay(this.iState.unit, this.iState.reachable, hovered);
    }
  }

  // ---------------------------------------------------------------------------
  // Eventos del bus
  // ---------------------------------------------------------------------------

  private setupEventListeners(): void {
    this.events.on(EVENTS.GRID_CLICK, this.onGridClick, this);
    this.events.on(EVENTS.PHASE_CHANGED, this.onPhaseChanged, this);
    this.events.on('input:escape', this.onEscape, this);
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
  }

  private onPhaseChanged(payload: { phase: string; turn: number }): void {
    this.uiManager.refreshHUD(this.turnManager);

    if (payload.phase === 'enemy') {
      this.startEnemyPhase();
    } else if (payload.phase === 'player') {
      this.startPlayerPhase();
    }
  }

  private onEscape(): void {
    if (this.iState.type === 'selectingMove') {
      this.selectUnit(this.iState.unit);
    } else if (this.iState.type === 'selected') {
      this.deselectUnit();
    }
  }

  // ---------------------------------------------------------------------------
  // Fases de turno
  // ---------------------------------------------------------------------------

  private startPlayerPhase(): void {
    this.iState = { type: 'idle' };
    this.clearOverlays();

    // Resetear unidades del jugador
    this.units
      .filter(u => u.faction === 'player')
      .forEach(u => {
        u.resetForNewTurn();
        this.unitViews.get(u.id)?.setUsed(false);
      });
  }

  private startEnemyPhase(): void {
    this.iState = { type: 'enemyPhase' };
    this.clearOverlays();
    this.uiManager.hideActionMenu();

    // Turno enemigo placeholder: esperar 1.5s y pasar de vuelta
    this.time.delayedCall(1500, () => {
      this.turnManager.nextPhase();
    });
  }

  private onEndTurn(): void {
    if (!this.turnManager.isPlayerPhase()) return;
    this.deselectUnit();
    this.turnManager.nextPhase();
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

    this.iState = { type: 'selected', unit };
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

    // Posicionar el menú cerca de la unidad (desplazado a la derecha)
    const center = this.gridManager.gridToCenter(unit.gridPos.col, unit.gridPos.row);
    const menuX = Math.min(center.x + TILE_SIZE / 2 + 4, CANVAS_WIDTH - 145);
    const menuY = Math.max(center.y - TILE_SIZE / 2, 4);

    this.uiManager.showActionMenu(menuX, menuY, menuItems);
  }

  private deselectUnit(): void {
    if (this.iState.type === 'selected' || this.iState.type === 'selectingMove') {
      const unit = (this.iState as { unit: Unit }).unit;
      this.unitViews.get(unit.id)?.setSelected(false);
      // Si la unidad no actuó aún, regresa al estado idle para poder re-seleccionarla
      if (unit.state.name === 'selected') {
        unit.state.transition('idle');
      }
    }
    this.iState = { type: 'idle' };
    this.clearOverlays();
    this.uiManager.hideActionMenu();
    this.events.emit(EVENTS.UNIT_DESELECTED);
  }

  private onActionSelected(unit: Unit, action: Action): void {
    this.uiManager.hideActionMenu();

    if (action.key === 'move') {
      const ctx = this.buildContext();
      const reachable = action.getValidTargets(unit, ctx);
      this.iState = { type: 'selectingMove', unit, reachable };
      this.renderMovementOverlay(reachable);
    } else if (action.key === 'wait') {
      const ctx = this.buildContext();
      action.execute(unit, null, ctx);
      this.unitViews.get(unit.id)?.setSelected(false);
      this.unitViews.get(unit.id)?.setUsed(true);
      this.iState = { type: 'idle' };
    }
  }

  private executeMove(unit: Unit, target: GridPosition): void {
    this.iState = { type: 'animating' };
    this.clearOverlays();

    // Calcular la ruta ANTES de ejecutar la acción (que ya muta unit.gridPos)
    const path = this.resolver.getPath(unit.gridPos, target) ?? [target];

    const ctx = this.buildContext();
    // La acción actualiza el estado lógico y emite UNIT_MOVED
    ACTIONS.move.execute(unit, target, ctx);

    // Animar la vista siguiendo la misma ruta ortogonal de la previsualización
    const view = this.unitViews.get(unit.id);
    view?.tweenAlongPath(path, this.gridManager, () => {
      // Después de la animación, marcar la unidad como usada
      unit.state.transition('done');
      view.setSelected(false);
      view.setUsed(true);
      this.iState = { type: 'idle' };
      this.events.emit(EVENTS.UNIT_MOVE_ANIMATION_DONE, { unit });
    });
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
