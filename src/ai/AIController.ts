import type { GridPosition } from '../utils/types';
import type { Unit } from '../units/Unit';
import type { ActionContext } from '../actions/Action';

/**
 * Lo que una unidad enemiga decide hacer en su turno. Es solo una decisión
 * (datos), no ejecuta nada — GameScene es quien la lleva a cabo (animar el
 * movimiento, atacar, esperar), igual que ya hace con las acciones del
 * jugador. Así la estrategia no necesita saber nada de Phaser ni de vistas.
 */
export interface AIDecision {
  /** Casilla a la que moverse, o null si no le conviene o no puede moverse */
  readonly moveTo: GridPosition | null;
  /** Casilla enemiga a atacar (evaluada después del movimiento), o null si no queda nadie en rango */
  readonly attackTarget: GridPosition | null;
}

/**
 * Interfaz que deben implementar todas las estrategias de IA.
 * Patrón Strategy: permite intercambiar comportamientos (agresivo, defensivo,
 * etc.) sin cambiar el controlador ni GameScene.
 *
 * `decide` es puro: solo lee `unit` y `ctx` y devuelve una decisión, sin
 * mutar nada. Eso la hace fácil de testear y de reemplazar a futuro por una
 * regla más específica (la ejecución con animaciones queda fuera de acá).
 */
export interface IAIStrategy {
  decide(unit: Unit, ctx: ActionContext): AIDecision;
}

/**
 * Punto único de acceso a la IA activa. GameScene le pide una decisión por
 * unidad; nunca conoce la estrategia concreta (se puede cambiar con
 * `setStrategy` sin tocar nada más).
 */
export class AIController {
  private strategy: IAIStrategy;

  constructor(strategy: IAIStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: IAIStrategy): void {
    this.strategy = strategy;
  }

  decide(unit: Unit, ctx: ActionContext): AIDecision {
    return this.strategy.decide(unit, ctx);
  }
}

/** Estrategia nula: nunca se mueve ni ataca. Sirve de default/placeholder. */
export class PassiveStrategy implements IAIStrategy {
  decide(_unit: Unit, _ctx: ActionContext): AIDecision {
    return { moveTo: null, attackTarget: null };
  }
}
