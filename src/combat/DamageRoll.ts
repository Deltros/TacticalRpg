import {
  ATTACK_MISS_CHANCE,
  ATTACK_MIN_DAMAGE_MULTIPLIER,
  ATTACK_MAX_DAMAGE_MULTIPLIER,
} from '../utils/constants';

/**
 * Introduce el factor de azar al golpear: a partir de un daño base (ya
 * resuelto por ataque vs. defensa) decide cuánto de ese daño realmente
 * conecta. Separado de `Action` a propósito — cada tipo de ataque (básico,
 * crítico, curación, etc.) puede reusar la misma tirada estándar o inyectar
 * la suya propia sin duplicar la lógica de a quién/dónde golpea.
 */
export interface DamageRoll {
  /** Devuelve el daño final a aplicar dado el daño base calculado. */
  roll(baseDamage: number): number;
}

/**
 * Tirada estándar: puede fallar por completo, o conectar por una fracción
 * al azar entre `minMultiplier` y `maxMultiplier` del daño base (p.ej. entre
 * la mitad y el total). `rng` es inyectable para poder testear con valores
 * determinísticos en vez de `Math.random`.
 */
export class StandardDamageRoll implements DamageRoll {
  constructor(
    private readonly missChance: number = ATTACK_MISS_CHANCE,
    private readonly minMultiplier: number = ATTACK_MIN_DAMAGE_MULTIPLIER,
    private readonly maxMultiplier: number = ATTACK_MAX_DAMAGE_MULTIPLIER,
    private readonly rng: () => number = Math.random,
  ) {}

  roll(baseDamage: number): number {
    if (this.rng() < this.missChance) return 0;

    const spread = this.maxMultiplier - this.minMultiplier;
    const multiplier = this.minMultiplier + this.rng() * spread;
    return Math.max(1, Math.round(baseDamage * multiplier));
  }
}
