import { GridPosition, posEquals } from '../utils/types';
import { EVENTS } from '../utils/constants';
import type { Unit } from '../units/Unit';
import type { Action, ActionContext } from './Action';

/**
 * Ataque cuerpo a cuerpo/a distancia básico: golpea a un enemigo dentro del
 * rango de ataque de la unidad (`unit.stats.attackRange`, distinto por
 * unidad) y le resta vida según su ataque vs. la defensa del objetivo.
 *
 * Esta es la única variante de "atacar" por ahora. A futuro, una unidad con
 * un ataque distinto (crítico, curación, etc.) no requiere tocar esta
 * clase: se implementa como otra clase que cumple `Action` (con su propia
 * key, aunque el mismo label "Atacar"), se registra en el ACTIONS de
 * GameScene, y esa unidad la referencia en su `actionKeys` en vez de
 * 'attack' — el mismo mecanismo que ya usan move/wait/backstab.
 *
 * Siempre aparece disponible mientras la unidad pueda actuar (igual que
 * Esperar): los objetivos son todo el rango de ataque, tenga o no un
 * enemigo adentro, para que el jugador vea de entrada su alcance. Clickear
 * una casilla del rango sin enemigo no hace nada (lo resuelve `execute`).
 */
export class AttackAction implements Action {
  readonly key = 'attack';
  readonly label = 'Atacar';

  canExecute(unit: Unit, _ctx: ActionContext): boolean {
    return unit.state.canAct();
  }

  getValidTargets(unit: Unit, ctx: ActionContext): GridPosition[] {
    return ctx.grid.getTilesInRange(unit.gridPos, unit.stats.attackRange);
  }

  execute(unit: Unit, target: GridPosition | null, ctx: ActionContext): void {
    if (!target) return;

    const defender = this.findEnemyAt(unit, target, ctx);
    if (!defender) return;

    const damage = Math.max(1, unit.stats.attack - defender.stats.defense);
    defender.stats.currentHp = Math.max(0, defender.stats.currentHp - damage);

    unit.state.transition('done');
    ctx.events.emit(EVENTS.UNIT_ATTACKED, { attacker: unit, defender, damage });

    if (defender.stats.currentHp === 0) {
      ctx.events.emit(EVENTS.UNIT_DEFEATED, { unit: defender });
    }
  }

  private findEnemyAt(unit: Unit, pos: GridPosition, ctx: ActionContext): Unit | undefined {
    return ctx.allUnits.find(u => u.faction !== unit.faction && posEquals(u.gridPos, pos));
  }
}
