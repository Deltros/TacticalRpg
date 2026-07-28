import type { Faction } from '../utils/types';

/**
 * Una fase de turno es básicamente "el turno de una facción".
 * Extensible: agrega facciones en PHASE_ORDER para soportar más equipos.
 */
export type TurnPhase = Faction;

/**
 * Orden de fases por turno.
 * Modifica este array para agregar facciones adicionales (ej: 'ally').
 */
export const PHASE_ORDER: readonly TurnPhase[] = ['player', 'enemy'];
