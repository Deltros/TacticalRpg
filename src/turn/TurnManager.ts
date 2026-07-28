import Phaser from 'phaser';
import { EVENTS } from '../utils/constants';
import { TurnPhase, PHASE_ORDER } from './TurnPhase';

/**
 * Gestiona las fases del turno como una máquina de estados finita.
 *
 * Emite PHASE_CHANGED cuando la fase cambia para que el resto del sistema
 * pueda reaccionar sin estar acoplado directamente a TurnManager.
 */
export class TurnManager {
  private phaseIndex: number = 0;
  private turnNumber: number = 1;
  private readonly events: Phaser.Events.EventEmitter;

  constructor(events: Phaser.Events.EventEmitter) {
    this.events = events;
  }

  get currentPhase(): TurnPhase {
    return PHASE_ORDER[this.phaseIndex];
  }

  get currentTurn(): number {
    return this.turnNumber;
  }

  isPlayerPhase(): boolean {
    return this.currentPhase === 'player';
  }

  /**
   * Avanza a la siguiente fase.
   * Si se completa un ciclo completo de facciones, incrementa el contador de turnos.
   */
  nextPhase(): void {
    this.phaseIndex = (this.phaseIndex + 1) % PHASE_ORDER.length;

    if (this.phaseIndex === 0) {
      this.turnNumber++;
    }

    this.events.emit(EVENTS.PHASE_CHANGED, {
      phase: this.currentPhase,
      turn: this.turnNumber,
    });
  }
}
