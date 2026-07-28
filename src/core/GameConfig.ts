import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/constants';
import { PreloadScene } from './PreloadScene';
import { GameScene } from './GameScene';

/**
 * Configuración de la instancia de Phaser.
 * Separada del main.ts para que sea importable en tests si se necesita.
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundColor: '#1a1a2e',
  scene: [PreloadScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    mouse: { preventDefaultWheel: false },
  },
};
