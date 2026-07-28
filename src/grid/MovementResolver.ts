import { GridPosition, posKey, posEquals } from '../utils/types';
import type { GridManager } from './GridManager';

interface FloodNode {
  pos: GridPosition;
  remaining: number;
}

interface DijkstraNode {
  pos: GridPosition;
  cost: number;
}

/**
 * Calcula casillas alcanzables y rutas óptimas sobre la grilla.
 *
 * Completamente desacoplado de las unidades y de Phaser.
 * Las unidades le preguntan; él responde.
 */
export class MovementResolver {
  private grid: GridManager;

  constructor(grid: GridManager) {
    this.grid = grid;
  }

  /**
   * Devuelve todas las casillas alcanzables desde `start`
   * con `movePoints` puntos de movimiento disponibles,
   * usando flood fill con costos de terreno.
   *
   * Las casillas ocupadas por otras unidades bloquean el paso
   * (los IDs a ignorar se pasan en `passableUnitIds`).
   */
  getReachable(
    start: GridPosition,
    movePoints: number,
    blockedPositions: GridPosition[] = [],
  ): GridPosition[] {
    const blockedKeys = new Set(blockedPositions.map(posKey));
    const bestRemaining = new Map<string, number>();
    const reachable: GridPosition[] = [];

    const queue: FloodNode[] = [{ pos: start, remaining: movePoints }];
    bestRemaining.set(posKey(start), movePoints);

    while (queue.length > 0) {
      // Extraer nodo con más puntos restantes (greedy, válido para flood fill)
      queue.sort((a, b) => b.remaining - a.remaining);
      const { pos, remaining } = queue.shift()!;
      const key = posKey(pos);

      // Si ya encontramos este nodo con más puntos, saltamos
      if ((bestRemaining.get(key) ?? -1) > remaining) continue;

      // Agregar a alcanzables (excepto la casilla de origen)
      if (!posEquals(pos, start)) {
        reachable.push(pos);
      }

      for (const neighbor of this.grid.getNeighbors(pos)) {
        const nKey = posKey(neighbor);
        if (blockedKeys.has(nKey)) continue;

        const cost = this.grid.getMovementCost(neighbor.col, neighbor.row);
        const newRemaining = remaining - cost;
        if (newRemaining < 0) continue;

        const best = bestRemaining.get(nKey) ?? -1;
        if (newRemaining > best) {
          bestRemaining.set(nKey, newRemaining);
          queue.push({ pos: neighbor, remaining: newRemaining });
        }
      }
    }

    return reachable;
  }

  /**
   * Calcula la ruta óptima (menor costo) de `from` a `to` usando Dijkstra.
   * Devuelve null si no existe ruta.
   * La ruta devuelta excluye `from` e incluye `to`.
   */
  getPath(from: GridPosition, to: GridPosition): GridPosition[] | null {
    const dist = new Map<string, number>();
    const prev = new Map<string, GridPosition | null>();
    const queue: DijkstraNode[] = [];

    const startKey = posKey(from);
    dist.set(startKey, 0);
    prev.set(startKey, null);
    queue.push({ pos: from, cost: 0 });

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const { pos, cost } = queue.shift()!;

      if (posEquals(pos, to)) break;

      for (const neighbor of this.grid.getNeighbors(pos)) {
        const moveCost = this.grid.getMovementCost(neighbor.col, neighbor.row);
        if (!isFinite(moveCost)) continue;

        const newCost = cost + moveCost;
        const nKey = posKey(neighbor);

        if (!dist.has(nKey) || newCost < dist.get(nKey)!) {
          dist.set(nKey, newCost);
          prev.set(nKey, pos);
          queue.push({ pos: neighbor, cost: newCost });
        }
      }
    }

    const toKey = posKey(to);
    if (!dist.has(toKey)) return null;

    // Reconstruir ruta
    const path: GridPosition[] = [];
    let current: GridPosition | null | undefined = to;
    while (current && !posEquals(current, from)) {
      path.unshift(current);
      current = prev.get(posKey(current));
    }

    return path;
  }
}
