/** Posición en la grilla (basada en celdas, no en píxeles) */
export interface GridPosition {
  readonly col: number;
  readonly row: number;
}

/** Posición en el espacio de pantalla en píxeles */
export interface PixelPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Facción a la que pertenece una unidad.
 * La misma clase Unit sirve para todas las facciones;
 * solo cambia quién decide sus acciones (jugador vs IA).
 */
export type Faction = 'player' | 'enemy' | 'ally' | 'neutral';

/** Compara dos posiciones de grilla por valor */
export function posEquals(a: GridPosition, b: GridPosition): boolean {
  return a.col === b.col && a.row === b.row;
}

/** Devuelve una clave string única para una posición (útil para Maps/Sets) */
export function posKey(p: GridPosition): string {
  return `${p.col},${p.row}`;
}
