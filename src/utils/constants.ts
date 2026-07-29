/**
 * Tamaño de cada casilla en píxeles. Único lugar donde se define — todo lo
 * demás (grilla, overlays, escala de sprites, HUD) se calcula a partir de
 * esto, así que cambiar solo este número reescala todo el juego junto.
 */
export const TILE_SIZE = 44;

/**
 * Columnas/filas visibles en pantalla a la vez (el "viewport").
 * El mapa real (MapData.cols/rows) puede ser mucho más grande —
 * la cámara se encarga de recorrerlo. No confundir con el tamaño del mapa.
 */
export const VIEWPORT_COLS = 20;
export const VIEWPORT_ROWS = 12;

/** Altura del HUD inferior en píxeles */
export const HUD_HEIGHT = 64;

/** Ancho total del canvas */
export const CANVAS_WIDTH = TILE_SIZE * VIEWPORT_COLS;

/** Alto total del canvas (grilla + HUD) */
export const CANVAS_HEIGHT = TILE_SIZE * VIEWPORT_ROWS + HUD_HEIGHT;

/** Franja en píxeles desde el borde del viewport que dispara el scroll de cámara */
export const EDGE_SCROLL_MARGIN = 56;

/** Velocidad del scroll de cámara en píxeles por segundo */
export const EDGE_SCROLL_SPEED = 480;

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
  /** Una unidad atacó a otra. Payload: { attacker: Unit, defender: Unit, damage: number } */
  UNIT_ATTACKED: 'unit:attacked',
  /** Una unidad quedó con 0 HP. Payload: { unit: Unit } */
  UNIT_DEFEATED: 'unit:defeated',
  /** La fase activa cambió. Payload: { phase: TurnPhase } */
  PHASE_CHANGED: 'turn:phaseChanged',
  /** El jugador activó una casilla de la grilla (clic de mouse o Enter con el teclado). Payload: GridPosition */
  GRID_CLICK: 'input:gridClick',
  /** El cursor de grilla se movió a una casilla (mouse o teclado). Payload: GridPosition */
  GRID_HOVER: 'input:gridHover',
  /** El jugador canceló la acción/menú actual (tecla Esc o E). */
  CANCEL: 'input:cancel',
  /** Navegación dentro de un menú activo (tecla arriba/abajo o W/S). Payload: -1 | 1 */
  MENU_NAVIGATE: 'input:menuNavigate',
  /** Confirmar el ítem resaltado de un menú activo (tecla Enter). */
  MENU_CONFIRM: 'input:menuConfirm',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
