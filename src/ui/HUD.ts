import Phaser from 'phaser';
import { CANVAS_WIDTH, GRID_ROWS, TILE_SIZE, HUD_HEIGHT } from '../utils/constants';
import type { TurnManager } from '../turn/TurnManager';

const HUD_Y = GRID_ROWS * TILE_SIZE;

/**
 * Franja inferior que muestra el turno actual y el botón de "Terminar Turno".
 */
export class HUD extends Phaser.GameObjects.Container {
  private turnLabel: Phaser.GameObjects.Text;
  private phaseLabel: Phaser.GameObjects.Text;
  private endTurnBtn: Phaser.GameObjects.Graphics;
  private endTurnText: Phaser.GameObjects.Text;
  private onEndTurn: () => void;

  constructor(scene: Phaser.Scene, turnManager: TurnManager, onEndTurn: () => void) {
    super(scene, 0, HUD_Y);
    this.onEndTurn = onEndTurn;

    // Fondo del HUD
    const bg = scene.add.graphics();
    bg.fillStyle(0x0d0d1a, 0.95);
    bg.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
    bg.lineStyle(1, 0x334466, 1);
    bg.lineBetween(0, 0, CANVAS_WIDTH, 0);

    this.turnLabel = scene.add.text(16, HUD_HEIGHT / 2, '', {
      fontSize: '14px',
      color: '#8899cc',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    this.phaseLabel = scene.add.text(200, HUD_HEIGHT / 2, '', {
      fontSize: '16px',
      color: '#eeeeff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // Botón Terminar Turno
    this.endTurnBtn = scene.add.graphics();
    this.endTurnText = scene.add.text(
      CANVAS_WIDTH - 90,
      HUD_HEIGHT / 2,
      'Terminar Turno',
      {
        fontSize: '12px',
        color: '#ccffcc',
        fontFamily: 'monospace',
      },
    ).setOrigin(0.5, 0.5);

    this.add([bg, this.turnLabel, this.phaseLabel, this.endTurnBtn, this.endTurnText]);
    scene.add.existing(this);
    this.setDepth(50);

    this.buildEndTurnButton();
    this.refresh(turnManager);
  }

  private buildEndTurnButton(): void {
    const bx = CANVAS_WIDTH - 90;
    const by = HUD_HEIGHT / 2;
    const bw = 140;
    const bh = 36;

    this.endTurnBtn.clear();
    this.endTurnBtn.fillStyle(0x1a3322, 1);
    this.endTurnBtn.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 6);
    this.endTurnBtn.lineStyle(1.5, 0x44aa66, 1);
    this.endTurnBtn.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 6);

    this.endTurnBtn.setInteractive(
      new Phaser.Geom.Rectangle(bx - bw / 2, by - bh / 2, bw, bh),
      Phaser.Geom.Rectangle.Contains,
    );

    this.endTurnBtn.on('pointerover', () => {
      this.endTurnBtn.clear();
      this.endTurnBtn.fillStyle(0x2a5533, 1);
      this.endTurnBtn.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 6);
      this.endTurnBtn.lineStyle(1.5, 0x66cc88, 1);
      this.endTurnBtn.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 6);
    });

    this.endTurnBtn.on('pointerout', () => {
      this.buildEndTurnButton();
    });

    this.endTurnBtn.on('pointerup', () => {
      this.onEndTurn();
    });
  }

  /** Actualiza los textos del HUD según el estado actual del TurnManager */
  refresh(turnManager: TurnManager): void {
    this.turnLabel.setText(`Turno ${turnManager.currentTurn}`);
    const isPlayer = turnManager.isPlayerPhase();
    this.phaseLabel.setText(isPlayer ? '▶  Fase del Jugador' : '⚡  Fase Enemiga');
    this.phaseLabel.setColor(isPlayer ? '#66aaff' : '#ff6666');
    this.endTurnBtn.setVisible(isPlayer);
    this.endTurnText.setVisible(isPlayer);
  }
}
