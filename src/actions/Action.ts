import type Phaser from 'phaser';
import type { GridPosition } from '../utils/types';
import type { Unit } from '../units/Unit';
import type { GridManager } from '../grid/GridManager';
import type { MovementResolver } from '../grid/MovementResolver';

/**
 * Contexto que se pasa a todas las acciones al ejecutarlas.
 * Contiene referencias a los sistemas necesarios sin acoplar
 * las acciones a la escena directamente.
 */
export interface ActionContext {
  grid: GridManager;
  resolver: MovementResolver;
  allUnits: Unit[];
  /** Bus de eventos de la escena (scene.events) */
  events: Phaser.Events.EventEmitter;
}

/**
 * Interfaz base para todas las acciones que puede ejecutar una unidad.
 * Patrón Command: encapsula la lógica de "qué hace" separada de "quién lo pide".
 *
 * La IA y el jugador usan la misma interfaz;
 * solo difieren en cómo eligen el target.
 */
export interface Action {
  /** Clave única de la acción (usada para registro y comparación) */
  readonly key: string;

  /** Etiqueta legible para el menú de acciones */
  readonly label: string;

  /** Indica si la acción es actualmente válida para la unidad */
  canExecute(unit: Unit, ctx: ActionContext): boolean;

  /**
   * Devuelve las casillas/objetivos válidos para esta acción.
   * Retorna array vacío si la acción no tiene targets espaciales (ej: Wait).
   */
  getValidTargets(unit: Unit, ctx: ActionContext): GridPosition[];

  /**
   * Ejecuta la acción. El target puede ser null para acciones sin objetivo espacial.
   * Actualiza el estado lógico del juego y emite los eventos correspondientes.
   */
  execute(unit: Unit, target: GridPosition | null, ctx: ActionContext): void;
}
