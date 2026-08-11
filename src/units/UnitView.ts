import Phaser from 'phaser';
import { TILE_SIZE } from '../utils/constants';
import type { Unit } from './Unit';
import type { GridManager } from '../grid/GridManager';
import type { GridPosition } from '../utils/types';
import { frameTextureKey, idleAnimKey } from './SpriteAnimKeys';

const FACTION_COLORS: Record<string, number> = {
  player: 0x3a7dd4,
  enemy:  0xcc3333,
  ally:   0x33aa66,
  neutral: 0xaaaaaa,
};

/** Alto objetivo del sprite real relativo al tile, para que se vea "parado" en la casilla */
const SPRITE_HEIGHT_RATIO = 1.35;

/**
 * Representación visual de una unidad en la escena de Phaser.
 *
 * Extiende Container para que las coordenadas x,y sean el CENTRO
 * de la casilla. Los objetos internos se posicionan relativos al centro.
 *
 * Si la unidad tiene `spriteKey` y la textura fue precargada, se dibuja
 * un Sprite animado. Si no, se usa el rectángulo de color placeholder
 * (con el nombre del tipo debajo) — así unidades sin arte todavía
 * no rompen nada.
 */
export class UnitView extends Phaser.GameObjects.Container {
  private unit: Unit;
  private visual: Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics;
  private typeLabel?: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, unit: Unit, grid: GridManager) {
    const center = grid.gridToCenter(unit.gridPos.col, unit.gridPos.row);
    super(scene, center.x, center.y);

    this.unit = unit;
    this.hpBar = scene.add.graphics();

    const hasSprite = !!unit.spriteKey && scene.textures.exists(frameTextureKey(unit.spriteKey, 0));
    if (hasSprite) {
      this.visual = this.createSpriteBody(scene, unit.spriteKey!);
      this.add([this.visual, this.hpBar]);
    } else {
      this.visual = scene.add.graphics();
      this.typeLabel = scene.add.text(0, TILE_SIZE / 2 + 8, unit.label, {
        fontSize: '9px',
        color: '#dddddd',
        fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      this.add([this.visual, this.typeLabel, this.hpBar]);
      this.drawPlaceholderBody();
    }

    this.drawHpBar();
    scene.add.existing(this);
  }

  private createSpriteBody(scene: Phaser.Scene, spriteKey: string): Phaser.GameObjects.Sprite {
    const sprite = scene.add.sprite(0, TILE_SIZE / 2 - 6, frameTextureKey(spriteKey, 0));
    sprite.setOrigin(0.5, 1);
    sprite.setScale((TILE_SIZE * SPRITE_HEIGHT_RATIO) / sprite.height);

    const animKey = idleAnimKey(spriteKey);
    if (scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }
    return sprite;
  }

  private drawPlaceholderBody(): void {
    const gfx = this.visual as Phaser.GameObjects.Graphics;
    const color = FACTION_COLORS[this.unit.faction] ?? 0x888888;
    const half = TILE_SIZE / 2 - 8;

    gfx.clear();
    // Sombra sutil
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillRoundedRect(-half + 2, -half + 2, half * 2, half * 2, 6);
    // Relleno principal
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(-half, -half, half * 2, half * 2, 6);
    // Borde brillante
    gfx.lineStyle(2, 0xffffff, 0.6);
    gfx.strokeRoundedRect(-half, -half, half * 2, half * 2, 6);
    // Símbolo de facción
    if (this.unit.faction === 'player') {
      gfx.fillStyle(0xffffff, 0.4);
      gfx.fillTriangle(0, -10, -8, 6, 8, 6);
    } else if (this.unit.faction === 'enemy') {
      gfx.fillStyle(0xffffff, 0.4);
      gfx.fillRect(-7, -7, 14, 14);
    }
  }

  private drawHpBar(): void {
    const { currentHp, maxHp } = this.unit.stats;
    const ratio = currentHp / maxHp;
    const barW = TILE_SIZE - 20;
    const barH = 4;
    const y = TILE_SIZE / 2 - 10;

    this.hpBar.clear();
    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(-barW / 2, y, barW, barH);
    this.hpBar.fillStyle(ratio > 0.5 ? 0x44dd44 : ratio > 0.25 ? 0xddaa00 : 0xdd2222);
    this.hpBar.fillRect(-barW / 2, y, Math.round(barW * ratio), barH);
  }

  /** Aplica o quita el tinte gris de "unidad ya usada" */
  setUsed(used: boolean): void {
    this.visual.setAlpha(used ? 0.45 : 1);
    this.typeLabel?.setAlpha(used ? 0.5 : 1);
  }

  /** Aplica el efecto visual de "seleccionada" */
  setSelected(selected: boolean): void {
    const baseScale = this.visual instanceof Phaser.GameObjects.Sprite
      ? (TILE_SIZE * SPRITE_HEIGHT_RATIO) / this.visual.height
      : 1;
    this.visual.setScale(baseScale * (selected ? 1.08 : 1));
  }

  /**
   * Mueve la vista a través de una ruta de casillas ortogonales (N/S/E/O),
   * un tween por tramo, para que siga el mismo camino que la previsualización.
   * Llama `onComplete` cuando termina de recorrer toda la ruta.
   */
  tweenAlongPath(path: GridPosition[], grid: GridManager, onComplete: () => void): void {
    if (path.length === 0) {
      onComplete();
      return;
    }

    const [next, ...rest] = path;
    const target = grid.gridToCenter(next.col, next.row);
    this.scene.tweens.add({
      targets: this,
      x: target.x,
      y: target.y,
      duration: 150,
      ease: 'Linear',
      onComplete: () => this.tweenAlongPath(rest, grid, onComplete),
    });
  }

  /** Refresca la barra de HP (útil después de recibir daño) */
  refreshHp(): void {
    this.drawHpBar();
  }

  /**
   * Texto flotante que sube y se desvanece sobre la unidad al recibir un
   * ataque: "-N" en rojo si conectó, "¡Falló!" en gris si el `DamageRoll`
   * dio un fallo total (damage 0).
   */
  showDamagePopup(damage: number): void {
    const isMiss = damage === 0;
    const text = this.scene.add.text(0, -TILE_SIZE / 2, isMiss ? '¡Falló!' : `-${damage}`, {
      fontSize: isMiss ? '11px' : '14px',
      color: isMiss ? '#aaaaaa' : '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 1);
    this.add(text);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 24,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    });
  }
}
