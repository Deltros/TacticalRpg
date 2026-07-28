/**
 * Estadísticas numéricas de una unidad.
 * La identidad (nombre, tipo, sprite) vive en UnitDefinitions/Unit, no acá.
 */
export interface UnitStats {
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  /** Puntos de movimiento por turno */
  moveRange: number;
  /** Rango de ataque en casillas (1 = melé) */
  attackRange: number;
}

/** Crea stats con valores por defecto, sobreescribibles por Partial */
export function createStats(overrides: Partial<UnitStats> = {}): UnitStats {
  return {
    maxHp: 20,
    currentHp: 20,
    attack: 8,
    defense: 4,
    moveRange: 4,
    attackRange: 1,
    ...overrides,
  };
}
