import type { Faction, GridPosition } from '../utils/types';

/**
 * Definición de una unidad en el mapa (posición inicial y tipo).
 * Usada por MapLoader para instanciar unidades al cargar el mapa.
 */
export interface UnitPlacement {
  type: string;
  col: number;
  row: number;
  faction: Faction;
}

/**
 * Datos en crudo de un mapa.
 *
 * `grid` es un array de filas (row-major), donde cada celda
 * es un string con el tipo de terreno (clave de TerrainType).
 *
 * Esta estructura está diseñada para poder cargarse desde JSON de Tiled:
 * MapLoader.fromTiledJSON() puede rellenar este mismo interfaz.
 */
export interface MapData {
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  /** grid[row][col] = TerrainType string */
  readonly grid: readonly (readonly string[])[];
  readonly unitPlacements?: readonly UnitPlacement[];
}
