import { TILE_SIZE } from '../utils/constants';
import { GridPosition, PixelPosition, posKey } from '../utils/types';
import { Tile } from './Tile';
import { TerrainType, TERRAIN_DEFS } from './TerrainType';
import type { MapData } from '../maps/MapData';

/**
 * Gestiona el estado lógico de la grilla: terreno, ocupación de casillas,
 * y conversión entre coordenadas de grilla y píxeles.
 *
 * No tiene dependencia de Phaser — es puro TypeScript testeable.
 */
export class GridManager {
  readonly cols: number;
  readonly rows: number;

  private tiles: Tile[][];
  /** Mapa de posición → ID de la entidad que la ocupa (null = libre) */
  private occupancy: Map<string, string | null>;

  constructor(mapData: MapData) {
    this.cols = mapData.cols;
    this.rows = mapData.rows;
    this.tiles = this.buildTiles(mapData);
    this.occupancy = new Map();

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.occupancy.set(posKey({ col, row }), null);
      }
    }
  }

  private buildTiles(mapData: MapData): Tile[][] {
    const tiles: Tile[][] = [];
    for (let row = 0; row < mapData.rows; row++) {
      tiles[row] = [];
      for (let col = 0; col < mapData.cols; col++) {
        const terrainRaw = mapData.grid[row][col];
        const terrain = terrainRaw as TerrainType;
        tiles[row][col] = new Tile(col, row, terrain);
      }
    }
    return tiles;
  }

  /** Devuelve la casilla en (col, row) o null si está fuera de límites */
  getTile(col: number, row: number): Tile | null {
    if (!this.isInBounds(col, row)) return null;
    return this.tiles[row][col];
  }

  /** Costo de movimiento para entrar en la casilla (Infinity = infranqueable) */
  getMovementCost(col: number, row: number): number {
    const tile = this.getTile(col, row);
    if (!tile) return Infinity;
    return TERRAIN_DEFS[tile.terrain].movementCost;
  }

  /** Verifica si la casilla está dentro de los límites del mapa */
  isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  /** Verifica si una casilla está libre (sin unidad) */
  isOccupied(pos: GridPosition): boolean {
    return this.occupancy.get(posKey(pos)) !== null;
  }

  /** Devuelve el ID de la unidad que ocupa la casilla, o null si está libre */
  getOccupant(pos: GridPosition): string | null {
    return this.occupancy.get(posKey(pos)) ?? null;
  }

  /** Marca una casilla como ocupada por una unidad con el ID dado */
  setOccupied(pos: GridPosition, unitId: string): void {
    this.occupancy.set(posKey(pos), unitId);
  }

  /** Libera una casilla */
  clearOccupancy(pos: GridPosition): void {
    this.occupancy.set(posKey(pos), null);
  }

  /** Convierte posición de grilla a píxel de la esquina superior-izquierda de la casilla */
  gridToPixel(col: number, row: number): PixelPosition {
    return { x: col * TILE_SIZE, y: row * TILE_SIZE };
  }

  /** Convierte posición de grilla al centro de la casilla en píxeles */
  gridToCenter(col: number, row: number): PixelPosition {
    return {
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  /** Convierte coordenadas de píxel a posición de grilla */
  pixelToGrid(x: number, y: number): GridPosition {
    return {
      col: Math.floor(x / TILE_SIZE),
      row: Math.floor(y / TILE_SIZE),
    };
  }

  /** Devuelve los vecinos ortogonales (N/S/E/O) que están dentro de los límites */
  getNeighbors(pos: GridPosition): GridPosition[] {
    const candidates: GridPosition[] = [
      { col: pos.col, row: pos.row - 1 },
      { col: pos.col, row: pos.row + 1 },
      { col: pos.col - 1, row: pos.row },
      { col: pos.col + 1, row: pos.row },
    ];
    return candidates.filter(p => this.isInBounds(p.col, p.row));
  }

  /**
   * Devuelve las casillas a distancia Manhattan <= `range` de `center`
   * (sin incluir el centro), dentro de los límites del mapa.
   *
   * Es una consulta de geometría pura, no de movimiento: no mira terreno
   * ni ocupación (a diferencia de MovementResolver). Sirve para rangos de
   * ataque, que no dependen de poder "caminar" hasta el objetivo.
   * Con range=1 da exactamente los mismos 4 vecinos que `getNeighbors`.
   */
  getTilesInRange(center: GridPosition, range: number): GridPosition[] {
    const tiles: GridPosition[] = [];
    for (let dRow = -range; dRow <= range; dRow++) {
      const remaining = range - Math.abs(dRow);
      for (let dCol = -remaining; dCol <= remaining; dCol++) {
        if (dRow === 0 && dCol === 0) continue;
        const col = center.col + dCol;
        const row = center.row + dRow;
        if (this.isInBounds(col, row)) tiles.push({ col, row });
      }
    }
    return tiles;
  }
}
