import { GridPosition, posEquals } from '../utils/types';
import { EVENTS } from '../utils/constants';
import type { Unit } from '../units/Unit';
import type { Action, ActionContext } from './Action';

/**
 * Mueve la unidad a una casilla dentro de su rango de movimiento.
 *
 * Esta acción solo actualiza el estado lógico y emite eventos.
 * La animación visual la gestiona GameScene al escuchar UNIT_MOVED.
 */
export class MoveAction implements Action {
  readonly key = 'move';
  readonly label = 'Mover';

  canExecute(unit: Unit, _ctx: ActionContext): boolean {
    return unit.state.canMove();
  }

  getValidTargets(unit: Unit, ctx: ActionContext): GridPosition[] {
    // Otras unidades bloquean el paso
    const blocked = ctx.allUnits
      .filter(u => u.id !== unit.id)
      .map(u => u.gridPos);

    return ctx.resolver.getReachable(
      unit.gridPos,
      unit.stats.moveRange,
      blocked,
    );
  }

  execute(unit: Unit, target: GridPosition | null, ctx: ActionContext): void {
    if (!target) return;

    const from = { ...unit.gridPos };

    // Actualizar ocupación de grilla
    ctx.grid.clearOccupancy(from);
    ctx.grid.setOccupied(target, unit.id);

    // Actualizar posición lógica
    unit.moveTo(target);

    // Transición de estado: si ya actuó, pasa a done; si no, a moved
    unit.state.transition('moved');

    // Emitir evento para que la escena anime el movimiento
    ctx.events.emit(EVENTS.UNIT_MOVED, { unit, from, to: target });
  }
}
