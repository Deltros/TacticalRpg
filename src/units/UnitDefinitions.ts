import type { UnitStats } from './UnitStats';

/**
 * Un arquetipo define stats base y acciones por defecto para una "clase"
 * de unidad (rogue, knight, etc). Varios personajes pueden compartir arquetipo.
 */
export interface ArchetypeDefinition {
  readonly baseStats: Partial<UnitStats>;
  readonly actionKeys: readonly string[];
}

/**
 * Un personaje es una entrada jugable concreta: referencia un arquetipo
 * y solo declara sus diferencias (stats, acciones extra, sprite propio).
 * Sin `spriteKey`, UnitView usa el rectángulo de color como placeholder.
 */
export interface CharacterDefinition {
  readonly archetype: string;
  readonly label: string;
  readonly statOverrides?: Partial<UnitStats>;
  readonly actionKeys?: readonly string[];
  readonly spriteKey?: string;
  /** Cantidad de frames de animación idle disponibles para spriteKey (default 1 = estático) */
  readonly frameCount?: number;
}

export const ARCHETYPES: Record<string, ArchetypeDefinition> = {
  knight:  { baseStats: { moveRange: 6, attack: 8, defense: 6, attackRange: 1 }, actionKeys: ['move', 'attack', 'wait'] },
  archer:  { baseStats: { moveRange: 4, attack: 7, defense: 3, attackRange: 2 }, actionKeys: ['move', 'attack', 'wait'] },
  soldier: { baseStats: { moveRange: 3, attack: 6, defense: 4, attackRange: 1 }, actionKeys: ['move', 'attack', 'wait'] },
  mage:    { baseStats: { moveRange: 4, attack: 12, defense: 2, attackRange: 2 }, actionKeys: ['move', 'attack', 'wait'] },
  rogue:   { baseStats: { moveRange: 5, attack: 9, defense: 2, attackRange: 1 }, actionKeys: ['move', 'attack', 'wait'] },
};

export const CHARACTERS: Record<string, CharacterDefinition> = {
  // Personaje único: mismo arquetipo "rogue" que un pícaro genérico, pero
  // con stats levemente distintos, sprite propio y el hook de una habilidad
  // extra ('backstab') que todavía no tiene clase Action registrada.
  astarion: {
    archetype: 'rogue',
    label: 'Astarion',
    statOverrides: { attack: 11 },
    actionKeys: ['move', 'attack', 'wait', 'backstab'],
    spriteKey: 'astarion',
    frameCount: 4,
  },
  rogue:   { archetype: 'rogue',   label: 'Rogue' },
  knight:  { archetype: 'knight',  label: 'Knight' },
  archer:  { archetype: 'archer',  label: 'Archer' },
  soldier: { archetype: 'soldier', label: 'Soldier' },
  mage:    { archetype: 'mage',    label: 'Mage' },
};

export interface ResolvedUnitDefinition {
  readonly typeKey: string;
  readonly label: string;
  readonly stats: Partial<UnitStats>;
  readonly actionKeys: readonly string[];
  readonly spriteKey?: string;
  readonly frameCount: number;
}

/** Resuelve un typeKey ('astarion', 'knight', ...) mezclando arquetipo + personaje. */
export function resolveUnitDefinition(typeKey: string): ResolvedUnitDefinition {
  const character = CHARACTERS[typeKey];
  if (!character) {
    throw new Error(`Definición de unidad desconocida: "${typeKey}"`);
  }
  const archetype = ARCHETYPES[character.archetype];
  if (!archetype) {
    throw new Error(`Arquetipo desconocido: "${character.archetype}" (usado por "${typeKey}")`);
  }
  return {
    typeKey,
    label: character.label,
    stats: { ...archetype.baseStats, ...character.statOverrides },
    actionKeys: character.actionKeys ?? archetype.actionKeys,
    spriteKey: character.spriteKey,
    frameCount: character.frameCount ?? 1,
  };
}
