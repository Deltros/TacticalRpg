import { GridPosition, posEquals } from '../utils/types';
import type { Unit } from '../units/Unit';
import type { ActionContext } from '../actions/Action';
import type { AIDecision, IAIStrategy } from './AIController';

/** Distancia Manhattan entre dos casillas (sin diagonales, igual que el resto del juego) */
function manhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * IA más simple posible: se acerca a la unidad enemiga (la del jugador) más
 * cercana y, si queda a su alcance, la ataca. Empates de distancia se
 * resuelven al azar entre las unidades empatadas.
 *
 * Si puede acercarse lo suficiente como para atacar este mismo turno, lo
 * hace; si no, se mueve lo más cerca posible sin poder atacar; si no hay a
 * dónde moverse ni a quién atacar, se queda quieta (GameScene la hace
 * Esperar con la misma WaitAction del jugador).
 */
export class ChaseNearestStrategy implements IAIStrategy {
  decide(unit: Unit, ctx: ActionContext): AIDecision {
    const enemies = ctx.allUnits.filter(u => u.faction !== unit.faction);
    const target = this.pickNearestTarget(unit, enemies);
    if (!target) return { moveTo: null, attackTarget: null };

    const moveTo = this.pickMoveDestination(unit, target, ctx);
    const positionAfterMove = moveTo ?? unit.gridPos;

    const inRange = ctx.grid.getTilesInRange(positionAfterMove, unit.stats.attackRange);
    const attackable = enemies.find(e => inRange.some(pos => posEquals(pos, e.gridPos)));

    return { moveTo, attackTarget: attackable ? attackable.gridPos : null };
  }

  /** La unidad enemiga (del jugador) más cercana; un empate se resuelve al azar */
  private pickNearestTarget(unit: Unit, enemies: Unit[]): Unit | null {
    if (enemies.length === 0) return null;

    let minDistance = Infinity;
    for (const enemy of enemies) {
      minDistance = Math.min(minDistance, manhattanDistance(unit.gridPos, enemy.gridPos));
    }

    const nearest = enemies.filter(e => manhattanDistance(unit.gridPos, e.gridPos) === minDistance);
    return nearest[Math.floor(Math.random() * nearest.length)];
  }

  /**
   * A qué casilla moverse para acercarse a `target`. Prioriza una casilla
   * alcanzable desde la que ya quede en rango de ataque; si ninguna alcanza
   * el rango, la que más la acerque. Null si ya está en rango (no hace falta
   * moverse) o si no hay ninguna casilla alcanzable.
   */
  private pickMoveDestination(unit: Unit, target: Unit, ctx: ActionContext): GridPosition | null {
    if (manhattanDistance(unit.gridPos, target.gridPos) <= unit.stats.attackRange) {
      return null;
    }

    const blocked = ctx.allUnits.filter(u => u.id !== unit.id).map(u => u.gridPos);
    const reachable = ctx.resolver.getReachable(unit.gridPos, unit.stats.moveRange, blocked);
    if (reachable.length === 0) return null;

    const inRangeSpots = reachable.filter(
      pos => manhattanDistance(pos, target.gridPos) <= unit.stats.attackRange,
    );
    const candidates = inRangeSpots.length > 0 ? inRangeSpots : reachable;

    return candidates.reduce((closest, pos) =>
      manhattanDistance(pos, target.gridPos) < manhattanDistance(closest, target.gridPos) ? pos : closest,
    );
  }
}
