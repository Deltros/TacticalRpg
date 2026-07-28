import Phaser from 'phaser';
import { EVENTS, GRID_ROWS, TILE_SIZE } from '../utils/constants';
import { GridPosition } from '../utils/types';
import type { GridManager } from '../grid/GridManager';

/**
 * Traduce input de Phaser (puntero, teclado) en eventos de dominio del juego.
 *
 * La lógica del juego nunca lee directamente el puntero de Phaser;
 * siempre escucha eventos del bus. Así el input está desacoplado.
 *
 * La IA no usa este sistema — toma decisiones en su propio controlador.
 */
export class InputManager {
  private scene: Phaser.Scene;
  private grid: GridManager;
  private lastHovered: GridPosition | null = null;
  private hovered: GridPosition | null = null;

  constructor(scene: Phaser.Scene, grid: GridManager) {
    this.scene = scene;
    this.grid = grid;
    this.setupPointerEvents();
    this.setupKeyboardEvents();
  }

  private setupPointerEvents(): void {
    const { input, events } = this.scene;

    input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const pos = this.pointerToGrid(pointer);
      if (!pos) { this.hovered = null; return; }

      // Solo emitir si cambió la casilla
      if (
        !this.lastHovered ||
        pos.col !== this.lastHovered.col ||
        pos.row !== this.lastHovered.row
      ) {
        this.lastHovered = pos;
        this.hovered = pos;
        events.emit(EVENTS.GRID_HOVER, pos);
      }
    });

    // El segundo argumento es la lista de GameObjects interactivos bajo el puntero.
    // Si hay alguno (ej: botones de la ActionMenu), el clic es para ellos, no para la grilla.
    input.on('pointerup', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.length > 0) return;
      const pos = this.pointerToGrid(pointer);
      if (pos) {
        events.emit(EVENTS.GRID_CLICK, pos);
      }
    });
  }

  private setupKeyboardEvents(): void {
    // Tecla ESCAPE para cancelar selección (el receptor lo maneja)
    this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .on('down', () => {
        this.scene.events.emit('input:escape');
      });
  }

  /** Convierte coordenadas del puntero a posición de grilla, o null si fuera del tablero */
  private pointerToGrid(pointer: Phaser.Input.Pointer): GridPosition | null {
    const pos = this.grid.pixelToGrid(pointer.x, pointer.y);
    if (
      pos.col < 0 || pos.col >= this.grid.cols ||
      pos.row < 0 || pos.row >= this.grid.rows
    ) {
      return null;
    }
    return pos;
  }

  /** Devuelve la casilla actualmente bajo el puntero, o null */
  getHoveredGridPos(): GridPosition | null {
    return this.hovered;
  }
}
