import Phaser from 'phaser';

export interface MenuItem {
  label: string;
  callback: () => void;
  enabled?: boolean;
}

const ITEM_H = 36;
const ITEM_W = 120;
const PADDING = 6;
const BG_COLOR = 0x1a1a2e;
const HOVER_COLOR = 0x3a3a5e;
const BORDER_COLOR = 0x5566aa;
const TEXT_COLOR = '#e8e8ff';
const DISABLED_COLOR = '#666688';

/**
 * Menú contextual de acciones que aparece al seleccionar una unidad.
 *
 * Los ítems son completamente dinámicos — no hay nada hardcodeado aquí.
 * La escena construye el array de MenuItem según las acciones disponibles.
 */
export class ActionMenu extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private items: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.setVisible(false);
    scene.add.existing(this);
    // Profundidad alta para quedar encima de todo
    this.setDepth(100);
  }

  /**
   * Muestra el menú en la posición dada con los ítems indicados.
   * Limpia y reconstruye los botones en cada llamada.
   */
  show(x: number, y: number, menuItems: MenuItem[]): void {
    this.clearItems();
    this.setPosition(x, y);

    const totalH = menuItems.length * ITEM_H + PADDING * 2;
    const totalW = ITEM_W + PADDING * 2;

    // Fondo del menú
    this.bg.clear();
    this.bg.fillStyle(BG_COLOR, 0.92);
    this.bg.fillRoundedRect(0, 0, totalW, totalH, 6);
    this.bg.lineStyle(1.5, BORDER_COLOR, 1);
    this.bg.strokeRoundedRect(0, 0, totalW, totalH, 6);

    menuItems.forEach((item, i) => {
      const itemContainer = this.buildItem(item, i);
      this.items.push(itemContainer);
      this.add(itemContainer);
    });

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.clearItems();
  }

  private buildItem(item: MenuItem, index: number): Phaser.GameObjects.Container {
    const enabled = item.enabled !== false;
    const itemY = PADDING + index * ITEM_H;

    const container = this.scene.add.container(PADDING, itemY);

    const bg = this.scene.add.graphics();
    bg.fillStyle(BG_COLOR, 0);
    bg.fillRect(0, 0, ITEM_W, ITEM_H - 2);

    const label = this.scene.add.text(ITEM_W / 2, (ITEM_H - 2) / 2, item.label, {
      fontSize: '14px',
      color: enabled ? TEXT_COLOR : DISABLED_COLOR,
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    container.add([bg, label]);

    if (enabled) {
      bg.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, ITEM_W, ITEM_H - 2),
        Phaser.Geom.Rectangle.Contains,
      );

      bg.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(HOVER_COLOR, 1);
        bg.fillRoundedRect(0, 0, ITEM_W, ITEM_H - 2, 4);
      });

      bg.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(BG_COLOR, 0);
        bg.fillRect(0, 0, ITEM_W, ITEM_H - 2);
      });

      bg.on('pointerup', () => {
        item.callback();
      });
    }

    return container;
  }

  private clearItems(): void {
    this.items.forEach(c => c.destroy());
    this.items = [];
  }
}
