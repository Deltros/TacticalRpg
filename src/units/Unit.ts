import { GridPosition } from '../utils/types';
import type { Faction } from '../utils/types';
import { UnitStats } from './UnitStats';
import { UnitState } from './UnitState';

let nextId = 1;

/**
 * Identidad de una unidad, resuelta a partir de UnitDefinitions.
 * Unit no conoce arquetipos ni merges: solo recibe el resultado ya armado.
 */
export interface UnitConfig {
  readonly typeKey: string;
  readonly label: string;
  readonly actionKeys: readonly string[];
  readonly spriteKey?: string;
}

/**
 * Clase base para cualquier unidad del juego (aliada, enemiga, neutral).
 *
 * No tiene dependencia de Phaser — es pura lógica de juego.
 * La representación visual la gestiona UnitView en la capa de presentación.
 */
export class Unit {
  /** Identificador único de la unidad (para ocupación de grilla, etc.) */
  readonly id: string;

  /** A qué bando pertenece */
  readonly faction: Faction;

  /** Clave del tipo de unidad (ej. 'astarion', 'knight') */
  readonly typeKey: string;

  /** Nombre para mostrar en UI (ej. 'Astarion', 'Knight') */
  readonly label: string;

  /** Clave de textura para UnitView. Sin esta clave, se usa el placeholder visual. */
  readonly spriteKey?: string;

  /** Estadísticas actuales (mutables para daño, buffs, etc.) */
  readonly stats: UnitStats;

  /** Máquina de estados del turno */
  readonly state: UnitState;

  /** Posición actual en la grilla */
  gridPos: GridPosition;

  /** Claves de las acciones que esta unidad puede tener disponibles (ej. ['move','wait','backstab']) */
  private readonly actionKeys: readonly string[];

  constructor(faction: Faction, config: UnitConfig, stats: UnitStats, startPos: GridPosition) {
    this.id = `unit_${nextId++}`;
    this.faction = faction;
    this.typeKey = config.typeKey;
    this.label = config.label;
    this.spriteKey = config.spriteKey;
    this.actionKeys = config.actionKeys;
    this.stats = stats;
    this.state = new UnitState();
    this.gridPos = startPos;
  }

  /** Actualiza la posición lógica de la unidad en la grilla */
  moveTo(pos: GridPosition): void {
    this.gridPos = pos;
  }

  /** Resetea el estado al inicio del turno de la facción */
  resetForNewTurn(): void {
    this.state.reset();
  }

  /** Devuelve las acciones disponibles según el estado actual.
   *  'move' requiere poder moverse; el resto de las acciones (wait, backstab, etc.)
   *  requieren solo poder actuar. Nuevas acciones no requieren tocar este método. */
  getAvailableActionKeys(): string[] {
    return this.actionKeys.filter(key =>
      key === 'move' ? this.state.canMove() : this.state.canAct(),
    );
  }
}
