import Phaser from 'phaser';
import { EVENTS, TILE_SIZE, VIEWPORT_ROWS } from '../utils/constants';
import { GridPosition, PixelPosition } from '../utils/types';
import type { GridManager } from '../grid/GridManager';

/** Alto en píxeles de pantalla del área jugable (grilla), sin contar la franja del HUD */
const PLAY_AREA_HEIGHT = VIEWPORT_ROWS * TILE_SIZE;

const KEYS = Phaser.Input.Keyboard.KeyCodes;

type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Grupos de teclas físicas que disparan la misma acción lógica.
 * Único lugar donde se decide "qué tecla hace qué" — todo lo demás
 * (grilla, menús futuros) se agrega acá, no repitiendo bindings sueltos.
 */
const KEY_GROUPS: Record<Direction, readonly number[]> & { confirm: readonly number[]; cancel: readonly number[] } = {
  up: [KEYS.UP, KEYS.W],
  down: [KEYS.DOWN, KEYS.S],
  left: [KEYS.LEFT, KEYS.A],
  right: [KEYS.RIGHT, KEYS.D],
  confirm: [KEYS.ENTER],
  cancel: [KEYS.ESC, KEYS.E],
};

/** Desplazamiento de grilla por dirección */
const DIRECTION_DELTAS: Record<Direction, GridPosition> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

/** Equivalente de esa dirección dentro de un menú (izq/der no tienen, quedan null) */
const MENU_DELTAS: Record<Direction, -1 | 1 | null> = {
  up: -1,
  down: 1,
  left: null,
  right: null,
};

/** Velocidad de repetición del cursor de teclado (ver MOVE_REPEAT_INTERVAL_MS) */
type CursorSpeed = 'normal' | 'slow';

/**
 * Cada cuántos ms se repite el movimiento mientras se mantiene apretada una
 * tecla de dirección. Más lento ('slow') mientras se está eligiendo destino
 * de Mover/Atacar — ahí conviene ir con más cuidado casilla por casilla.
 */
const MOVE_REPEAT_INTERVAL_MS: Record<CursorSpeed, number> = {
  normal: 90,
  slow: 220,
};

/** Modo de foco del teclado: sobre la grilla, o capturado por un menú activo */
type InputMode = 'grid' | 'menu';

/** Cuál de los dos inputs movió el foco por última vez (relevante para el scroll de cámara) */
type FocusSource = 'mouse' | 'keyboard';

/**
 * Traduce input de Phaser (puntero, teclado) en eventos de dominio del juego.
 *
 * La lógica del juego nunca lee directamente el puntero o el teclado;
 * siempre escucha eventos del bus. Así el input está desacoplado.
 *
 * Mouse y teclado son dos formas de mover el mismo "cursor" de grilla y de
 * disparar la misma acción de activación (click / Enter). Ambos emiten los
 * mismos eventos (GRID_HOVER, GRID_CLICK): el resto del juego no necesita
 * saber cuál de los dos lo generó.
 *
 * Mantener apretada una tecla de dirección repite el movimiento cada
 * `MOVE_REPEAT_INTERVAL_MS` (vía `update()`, llamado desde GameScene) — no
 * hace falta soltar y volver a apretar para seguir avanzando.
 *
 * Cuando un menú captura el foco (`setMode('menu')`), las mismas teclas de
 * dirección/confirmar dejan de mover el cursor de grilla y en cambio navegan
 * el menú (MENU_NAVIGATE/MENU_CONFIRM) — el mouse sobre la grilla sigue
 * funcionando igual, solo cambia el significado del teclado.
 *
 * La IA no usa este sistema — toma decisiones en su propio controlador.
 */
export class InputManager {
  private scene: Phaser.Scene;
  private grid: GridManager;
  private cursorPos: GridPosition | null = null;
  private mode: InputMode = 'grid';
  private focusSource: FocusSource = 'keyboard';
  private cursorSpeed: CursorSpeed = 'normal';

  private directionKeys: Record<Direction, Phaser.Input.Keyboard.Key[]> = {
    up: [], down: [], left: [], right: [],
  };
  /** ms transcurridos desde el último movimiento, mientras la tecla siga apretada */
  private repeatElapsed: Record<Direction, number> = {
    up: 0, down: 0, left: 0, right: 0,
  };

  constructor(scene: Phaser.Scene, grid: GridManager) {
    this.scene = scene;
    this.grid = grid;
    this.setupPointerEvents();
    this.setupKeyboardEvents();
  }

  /** Cambia a qué responde el teclado: la grilla, o un menú que capturó el foco */
  setMode(mode: InputMode): void {
    this.mode = mode;
  }

  /**
   * Cambia qué tan seguido se repite el cursor mientras se mantiene una tecla:
   * 'slow' mientras se elige destino de Mover/Atacar, 'normal' el resto del tiempo.
   */
  setCursorSpeed(speed: CursorSpeed): void {
    this.cursorSpeed = speed;
  }

  /** Repite el movimiento de las teclas de dirección que se mantienen apretadas */
  update(delta: number): void {
    const interval = MOVE_REPEAT_INTERVAL_MS[this.cursorSpeed];

    (Object.keys(this.directionKeys) as Direction[]).forEach(dir => {
      const held = this.directionKeys[dir].some(key => key.isDown);
      if (!held) {
        this.repeatElapsed[dir] = 0;
        return;
      }

      this.repeatElapsed[dir] += delta;
      if (this.repeatElapsed[dir] >= interval) {
        this.repeatElapsed[dir] = 0;
        this.applyDirection(dir);
      }
    });
  }

  private setupPointerEvents(): void {
    const { input } = this.scene;

    input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.focusSource = 'mouse';
      const pos = this.pointerToGrid(pointer);
      if (pos) this.setCursor(pos);
    });

    // El segundo argumento es la lista de GameObjects interactivos bajo el puntero.
    // Si hay alguno (ej: botones de la ActionMenu), el clic es para ellos, no para la grilla.
    input.on('pointerup', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.length > 0) return;
      const pos = this.pointerToGrid(pointer);
      if (pos) this.activate(pos);
    });
  }

  private setupKeyboardEvents(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    this.bindKeys(keyboard, KEY_GROUPS.cancel, () => this.scene.events.emit(EVENTS.CANCEL));
    this.bindKeys(keyboard, KEY_GROUPS.confirm, () => this.onConfirm());

    (Object.keys(DIRECTION_DELTAS) as Direction[]).forEach(dir => {
      const keys = KEY_GROUPS[dir].map(code => keyboard.addKey(code));
      this.directionKeys[dir] = keys;
      // Primer paso inmediato al apretar; los siguientes los dispara update() mientras se mantenga.
      keys.forEach(key => key.on('down', () => {
        this.repeatElapsed[dir] = 0;
        this.applyDirection(dir);
      }));
    });
  }

  /** Une varias teclas físicas al mismo handler, para no repetir el `.on('down', ...)` por cada una */
  private bindKeys(keyboard: Phaser.Input.Keyboard.KeyboardPlugin, codes: readonly number[], handler: () => void): void {
    for (const code of codes) {
      keyboard.addKey(code).on('down', handler);
    }
  }

  /**
   * Una dirección significa cosas distintas según el modo:
   * mueve el cursor de grilla, o navega el menú activo (arriba/abajo).
   * Izquierda/derecha no tienen equivalente en el menú y se ignoran ahí.
   */
  private applyDirection(dir: Direction): void {
    if (this.mode === 'menu') {
      const menuDelta = MENU_DELTAS[dir];
      if (menuDelta !== null) this.scene.events.emit(EVENTS.MENU_NAVIGATE, menuDelta);
      return;
    }
    this.moveCursor(DIRECTION_DELTAS[dir]);
  }

  private onConfirm(): void {
    if (this.mode === 'menu') {
      this.scene.events.emit(EVENTS.MENU_CONFIRM);
      return;
    }
    if (this.cursorPos) this.activate(this.cursorPos);
  }

  /** Mueve el cursor una casilla en la dirección dada, si no se sale del tablero */
  private moveCursor(delta: GridPosition): void {
    this.focusSource = 'keyboard';
    const base = this.cursorPos ?? { col: 0, row: 0 };
    const next: GridPosition = { col: base.col + delta.col, row: base.row + delta.row };
    if (!this.grid.isInBounds(next.col, next.row)) return;
    this.setCursor(next);
  }

  /** Actualiza la posición del cursor (si cambió) y emite GRID_HOVER */
  private setCursor(pos: GridPosition): void {
    if (this.cursorPos && this.cursorPos.col === pos.col && this.cursorPos.row === pos.row) return;
    this.cursorPos = pos;
    this.scene.events.emit(EVENTS.GRID_HOVER, pos);
  }

  /** Dispara la acción de "activar" la casilla (equivalente a click, sea mouse o Enter) */
  private activate(pos: GridPosition): void {
    this.scene.events.emit(EVENTS.GRID_CLICK, pos);
  }

  /**
   * Convierte coordenadas del puntero a posición de grilla, o null si fuera del tablero.
   * Usa worldX/worldY (no x/y) porque la cámara puede estar desplazada por el scroll —
   * x/y son relativas a la pantalla, worldX/worldY ya tienen en cuenta ese offset.
   *
   * Primero descarta con `pointer.y` (pantalla, sin scroll) si el puntero está sobre
   * la franja del HUD: esa franja es fija y no todo lo que tiene ahí es interactivo
   * (ej. el fondo), así que sin este chequeo un clic ahí se traduciría igual a una
   * celda de mundo válida pero sin sentido (el HUD no es parte de la grilla).
   */
  private pointerToGrid(pointer: Phaser.Input.Pointer): GridPosition | null {
    if (pointer.y >= PLAY_AREA_HEIGHT) return null;

    const pos = this.grid.pixelToGrid(pointer.worldX, pointer.worldY);
    return this.grid.isInBounds(pos.col, pos.row) ? pos : null;
  }

  /** Devuelve la casilla actualmente enfocada por mouse o teclado, o null */
  getCursorPos(): GridPosition | null {
    return this.cursorPos;
  }

  /**
   * Posición de pantalla en vivo del mouse, para el scroll de cámara por bordes.
   * Devuelve null si el teclado fue el último en mover el foco — en ese caso,
   * el llamador debe usar `getCursorPos()` (la celda), no una posición continua,
   * porque el teclado no tiene una posición "entre casillas".
   */
  getLiveMouseScreenPos(): PixelPosition | null {
    if (this.focusSource !== 'mouse') return null;
    const pointer = this.scene.input.activePointer;
    return { x: pointer.x, y: pointer.y };
  }
}
