import Phaser from 'phaser';
import { ActionMenu, MenuItem } from './ActionMenu';
import { HUD } from './HUD';
import type { TurnManager } from '../turn/TurnManager';

/**
 * Coordina todos los elementos de la interfaz de usuario.
 * La escena habla con UIManager; UIManager habla con ActionMenu, HUD, etc.
 */
export class UIManager {
  readonly actionMenu: ActionMenu;
  readonly hud: HUD;

  constructor(
    scene: Phaser.Scene,
    turnManager: TurnManager,
    onEndTurn: () => void,
  ) {
    this.actionMenu = new ActionMenu(scene);
    this.hud = new HUD(scene, turnManager, onEndTurn);
  }

  showActionMenu(x: number, y: number, items: MenuItem[]): void {
    this.actionMenu.show(x, y, items);
  }

  hideActionMenu(): void {
    this.actionMenu.hide();
  }

  refreshHUD(turnManager: TurnManager): void {
    this.hud.refresh(turnManager);
  }
}
