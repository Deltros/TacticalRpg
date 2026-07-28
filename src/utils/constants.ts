/** Tamaño de cada casilla en píxeles */
export const TILE_SIZE = 64;

/** Número de columnas del tablero */
export const GRID_COLS = 12;

/** Número de filas del tablero */
export const GRID_ROWS = 9;

/** Altura del HUD inferior en píxeles */
export const HUD_HEIGHT = 64;

/** Ancho total del canvas */
export const CANVAS_WIDTH = TILE_SIZE * GRID_COLS;

/** Alto total del canvas (grilla + HUD) */
export const CANVAS_HEIGHT = TILE_SIZE * GRID_ROWS + HUD_HEIGHT;

/**
 * Catálogo de eventos del bus global.
 * Todos los sistemas emiten y escuchan estos strings, nunca los escriben en crudo.
 */
export const EVENTS = {
  /** Una unidad fue seleccionada. Payload: { unit: Unit } */
  UNIT_SELECTED: 'unit:selected',
  /** La selección de unidad fue cancelada. */
  UNIT_DESELECTED: 'unit:deselected',
  /** Una unidad completó su movimiento lógico. Payload: { unit: Unit, from: GridPosition, to: GridPosition } */
  UNIT_MOVED: 'unit:moved',
  /** La animación de movimiento terminó. Payload: { unit: Unit } */
  UNIT_MOVE_ANIMATION_DONE: 'unit:moveAnimDone',
  /** Una unidad terminó su turno (estado done). Payload: { unit: Unit } */
  UNIT_TURN_DONE: 'unit:turnDone',
  /** La fase activa cambió. Payload: { phase: TurnPhase } */
  PHASE_CHANGED: 'turn:phaseChanged',
  /** El jugador hizo clic en una casilla de la grilla. Payload: GridPosition */
  GRID_CLICK: 'input:gridClick',
  /** El puntero está sobre una casilla. Payload: GridPosition */
  GRID_HOVER: 'input:gridHover',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
