import { TerrainType } from './TerrainType';

/**
 * Representa una casilla individual en la grilla.
 * Es un Value Object inmutable — su estado de ocupación
 * lo gestiona el GridManager, no el Tile mismo.
 */
export class Tile {
  readonly col: number;
  readonly row: number;
  readonly terrain: TerrainType;

  constructor(col: number, row: number, terrain: TerrainType) {
    this.col = col;
    this.row = row;
    this.terrain = terrain;
  }
}
