import type { Unit } from '../units/Unit';
import type { ActionContext } from '../actions/Action';

/**
 * Interfaz que deben implementar todas las estrategias de IA.
 * Patrón Strategy: permite intercambiar comportamientos (agresivo, defensivo, etc.)
 * sin cambiar el controlador.
 */
export interface IAIStrategy {
  /** Decide y ejecuta las acciones de la unidad. Devuelve Promise para soportar lógica async. */
  takeTurn(unit: Unit, ctx: ActionContext): Promise<void>;
}

/**
 * Controlador de IA placeholder.
 * Por ahora no hace nada — el turno enemigo simplemente pasa.
 *
 * Para implementar IA real: crear clases que implementen IAIStrategy
 * (ej: AggressiveStrategy, DefensiveStrategy) e inyectarlas aquí.
 */
export class AIController {
  private strategy: IAIStrategy;

  constructor(strategy: IAIStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: IAIStrategy): void {
    this.strategy = strategy;
  }

  async takeTurn(unit: Unit, ctx: ActionContext): Promise<void> {
    await this.strategy.takeTurn(unit, ctx);
  }
}

/** Estrategia nula: no hace nada. Usada mientras no hay IA implementada. */
export class PassiveStrategy implements IAIStrategy {
  async takeTurn(_unit: Unit, _ctx: ActionContext): Promise<void> {
    // TODO: implementar lógica de IA
    return Promise.resolve();
  }
}
