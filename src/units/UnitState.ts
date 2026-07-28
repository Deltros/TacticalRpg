/**
 * Estados posibles de una unidad durante su turno.
 *
 * idle     → la unidad no ha hecho nada aún
 * selected → la unidad está seleccionada por el jugador / IA
 * moved    → la unidad se movió pero aún puede actuar
 * acted    → la unidad usó una habilidad/ataque (podría moverse si no lo hizo)
 * done     → turno de la unidad terminado, no puede hacer más nada
 */
export type UnitStateName = 'idle' | 'selected' | 'moved' | 'acted' | 'done';

/** Transiciones válidas entre estados */
const TRANSITIONS: Readonly<Record<UnitStateName, readonly UnitStateName[]>> = {
  idle:     ['selected'],
  selected: ['idle', 'moved', 'done'],
  moved:    ['acted', 'done'],
  acted:    ['done'],
  done:     [],
};

/**
 * Máquina de estados finita (FSM) para el turno de una unidad.
 * Invalida transiciones ilegales en tiempo de ejecución.
 */
export class UnitState {
  private current: UnitStateName = 'idle';

  get name(): UnitStateName {
    return this.current;
  }

  /** Intenta transicionar al nuevo estado. Lanza si la transición no es válida. */
  transition(next: UnitStateName): void {
    const allowed = TRANSITIONS[this.current];
    if (!(allowed as readonly string[]).includes(next)) {
      throw new Error(
        `Transición de estado inválida: ${this.current} → ${next}`,
      );
    }
    this.current = next;
  }

  /** Reinicia al estado inicial (llamado al inicio de cada turno) */
  reset(): void {
    this.current = 'idle';
  }

  /** Verifica si la unidad puede hacer algo todavía en este turno */
  canAct(): boolean {
    return this.current !== 'done';
  }

  /** Verifica si la unidad puede moverse */
  canMove(): boolean {
    return this.current === 'idle' || this.current === 'selected';
  }
}
