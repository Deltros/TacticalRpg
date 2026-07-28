/** Tipos de terreno disponibles en el motor */
export enum TerrainType {
  GRASS = 'GRASS',
  FOREST = 'FOREST',
  MOUNTAIN = 'MOUNTAIN',
  WATER = 'WATER',
}

/** Definición de las propiedades de cada tipo de terreno */
export interface TerrainDef {
  readonly type: TerrainType;
  /** Puntos de movimiento que cuesta entrar en esta casilla */
  readonly movementCost: number;
  /** Bonus de defensa que otorga este terreno */
  readonly defenseBonus: number;
  /** Color de relleno en hex para el placeholder visual */
  readonly fillColor: number;
  /** Color del borde en hex */
  readonly borderColor: number;
  /** Nombre legible para tooltips */
  readonly label: string;
}

/** Registro central de todos los terrenos — agrega nuevos tipos aquí */
export const TERRAIN_DEFS: Readonly<Record<TerrainType, TerrainDef>> = {
  [TerrainType.GRASS]: {
    type: TerrainType.GRASS,
    movementCost: 1,
    defenseBonus: 0,
    fillColor: 0x4a8f3f,
    borderColor: 0x3a7030,
    label: 'Pradera',
  },
  [TerrainType.FOREST]: {
    type: TerrainType.FOREST,
    movementCost: Infinity,
    defenseBonus: 1,
    fillColor: 0x2d5a1b,
    borderColor: 0x1e3d10,
    label: 'Bosque',
  },
  [TerrainType.MOUNTAIN]: {
    type: TerrainType.MOUNTAIN,
    movementCost: Infinity,
    defenseBonus: 2,
    fillColor: 0x7a7a6a,
    borderColor: 0x555550,
    label: 'Montaña',
  },
  [TerrainType.WATER]: {
    type: TerrainType.WATER,
    movementCost: Infinity,
    defenseBonus: 0,
    fillColor: 0x1a6ba0,
    borderColor: 0x124d78,
    label: 'Agua',
  },
};
