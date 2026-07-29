import Phaser from 'phaser';
import { EVENTS } from '../utils/constants';

export interface MenuItem {
  label: string;
  callback: () => void;
  enabled?: boolean;
}

const ITEM_H = 36;
const ITEM_W = 120;
const PADDING = 6;
const BG_COLOR = 0x1a1a2e;
const BORDER_COLOR = 0x5566aa;
const TEXT_COLOR = '#e8e8ff';
const DISABLED_COLOR = '#666688';
/** Mismo amarillo que el cursor de grilla, para que la ayuda visual sea consistente */
const SELECT_COLOR = 0xffee55;

/**
 * Menú contextual de acciones que aparece al seleccionar una unidad.
 *
 * Los ítems son completamente dinámicos — no hay nada hardcodeado aquí.
 * La escena construye el array de MenuItem según las acciones disponibles.
 *
 * Hay un único "ítem resaltado" (`selectedIndex`), que tanto el mouse
 * (hover) como el teclado (MENU_NAVIGATE) actualizan de la misma forma —
 * por eso ambos inputs se ven y se comportan igual. Enter/click confirman
 * ese mismo ítem.
 */
export class ActionMenu extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private items: Phaser.GameObjects.Container[] = [];
  private itemBgs: Phaser.GameObjects.Graphics[] = [];
  private menuItems: MenuItem[] = [];
  private selectedIndex = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.setVisible(false);
    scene.add.existing(this);
    // Profundidad alta para quedar encima de todo
    this.setDepth(100);

    scene.events.on(EVENTS.MENU_NAVIGATE, this.onMenuNavigate, this);
    scene.events.on(EVENTS.MENU_CONFIRM, this.onMenuConfirm, this);
  }

  /**
   * Muestra el menú en la posición dada con los ítems indicados.
   * Limpia y reconstruye los botones en cada llamada.
   */
  show(x: number, y: number, menuItems: MenuItem[]): void {
    this.clearItems();
    this.setPosition(x, y);
    this.menuItems = menuItems;

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
    this.selectedIndex = this.firstEnabledIndex();
    this.renderSelection();
  }

  hide(): void {
    this.setVisible(false);
    this.clearItems();
  }

  /** Navega al ítem anterior/siguiente (envuelve en los extremos), saltando deshabilitados */
  private onMenuNavigate(delta: -1 | 1): void {
    if (!this.visible || this.menuItems.length === 0) return;

    let next = this.selectedIndex;
    for (let i = 0; i < this.menuItems.length; i++) {
      next = (next + delta + this.menuItems.length) % this.menuItems.length;
      if (this.menuItems[next].enabled !== false) break;
    }
    this.setSelectedIndex(next);
  }

  /** Ejecuta el ítem actualmente resaltado (equivalente a hacerle click) */
  private onMenuConfirm(): void {
    if (!this.visible) return;
    const item = this.menuItems[this.selectedIndex];
    if (item && item.enabled !== false) item.callback();
  }

  private firstEnabledIndex(): number {
    const index = this.menuItems.findIndex(item => item.enabled !== false);
    return index >= 0 ? index : 0;
  }

  private setSelectedIndex(index: number): void {
    this.selectedIndex = index;
    this.renderSelection();
  }

  /** Repinta el fondo de cada ítem: amarillo el resaltado, transparente el resto */
  private renderSelection(): void {
    this.itemBgs.forEach((bg, i) => {
      bg.clear();
      if (i === this.selectedIndex) {
        bg.fillStyle(SELECT_COLOR, 0.28);
        bg.fillRoundedRect(0, 0, ITEM_W, ITEM_H - 2, 4);
        bg.lineStyle(2, SELECT_COLOR, 1);
        bg.strokeRoundedRect(0, 0, ITEM_W, ITEM_H - 2, 4);
      } else {
        bg.fillStyle(BG_COLOR, 0);
        bg.fillRect(0, 0, ITEM_W, ITEM_H - 2);
      }
    });
  }

  private buildItem(item: MenuItem, index: number): Phaser.GameObjects.Container {
    const enabled = item.enabled !== false;
    const itemY = PADDING + index * ITEM_H;

    const container = this.scene.add.container(PADDING, itemY);

    const bg = this.scene.add.graphics();
    bg.fillStyle(BG_COLOR, 0);
    bg.fillRect(0, 0, ITEM_W, ITEM_H - 2);
    this.itemBgs.push(bg);

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

      // El mouse resalta igual que el teclado: mismo índice, misma pintura
      bg.on('pointerover', () => this.setSelectedIndex(index));
      bg.on('pointerup', () => item.callback());
    }

    return container;
  }

  private clearItems(): void {
    this.items.forEach(c => c.destroy());
    this.items = [];
    this.itemBgs = [];
    this.menuItems = [];
    this.selectedIndex = 0;
  }
}
