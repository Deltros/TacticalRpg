import Phaser from 'phaser';
import { CHARACTERS } from '../units/UnitDefinitions';
import { frameTextureKey, idleAnimKey } from '../units/SpriteAnimKeys';

/**
 * Carga los sprites declarados en UnitDefinitions antes de que arranque GameScene.
 *
 * Recorre CHARACTERS de forma genérica: agregar una unidad nueva con `spriteKey`
 * y `frameCount` no requiere tocar esta escena.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    for (const def of Object.values(CHARACTERS)) {
      if (!def.spriteKey) continue;
      const frameCount = def.frameCount ?? 1;
      for (let i = 0; i < frameCount; i++) {
        this.load.image(
          frameTextureKey(def.spriteKey, i),
          `assets/units/${def.spriteKey}/idle_${i}.png`,
        );
      }
    }
  }

  create(): void {
    for (const def of Object.values(CHARACTERS)) {
      if (!def.spriteKey) continue;
      const frameCount = def.frameCount ?? 1;
      if (frameCount <= 1) continue;

      this.anims.create({
        key: idleAnimKey(def.spriteKey),
        frames: Array.from({ length: frameCount }, (_, i) => ({
          key: frameTextureKey(def.spriteKey!, i),
        })),
        frameRate: 4,
        repeat: -1,
      });
    }

    this.scene.start('GameScene');
  }
}
