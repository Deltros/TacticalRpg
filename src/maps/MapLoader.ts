import type { MapData } from './MapData';

/**
 * Carga y valida definiciones de mapa.
 *
 * Actualmente soporta mapas definidos en código (TypeScript).
 * Punto de extensión: agregar `fromTiledJSON(json: object): MapData`
 * para importar mapas exportados desde el editor Tiled.
 */
export class MapLoader {
  /** Carga un mapa ya definido en código. Valida su estructura básica. */
  static loadFromDefinition(def: MapData): MapData {
    MapLoader.validate(def);
    return def;
  }

  /**
   * Punto de extensión para Tiled JSON.
   * Tiled exporta un formato específico que hay que mapear a MapData.
   * Implementar cuando se integre el editor Tiled.
   */
  // static fromTiledJSON(json: TiledMapJSON): MapData { ... }

  private static validate(def: MapData): void {
    if (def.rows !== def.grid.length) {
      throw new Error(
        `MapData "${def.name}": rows (${def.rows}) no coincide con grid.length (${def.grid.length})`,
      );
    }
    for (let r = 0; r < def.rows; r++) {
      if (def.grid[r].length !== def.cols) {
        throw new Error(
          `MapData "${def.name}": fila ${r} tiene ${def.grid[r].length} columnas, se esperaban ${def.cols}`,
        );
      }
    }
  }
}
