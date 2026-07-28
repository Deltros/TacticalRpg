import { GridPosition } from '../utils/types';
import { EVENTS } from '../utils/constants';
import type { Unit } from '../units/Unit';
import type { Action, ActionContext } from './Action';

/**
 * Termina el turno de la unidad sin hacer nada adicional.
 * Siempre disponible mientras la unidad no haya marcado done.
 */
export class WaitAction implements Action {
  readonly key = 'wait';
  readonly label = 'Esperar';

  canExecute(unit: Unit, _ctx: ActionContext): boolean {
    return unit.state.canAct();
  }

  getValidTargets(_unit: Unit, _ctx: ActionContext): GridPosition[] {
    return []; // Sin target espacial
  }

  execute(unit: Unit, _target: GridPosition | null, ctx: ActionContext): void {
    unit.state.transition('done');
    ctx.events.emit(EVENTS.UNIT_TURN_DONE, { unit });
  }
}
