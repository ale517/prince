import Phaser from 'phaser';
import { audio } from '../audio';
import { RENDER_SCALE } from '../config';
import { loadSave } from '../save';
import type { GameSceneData } from './GameScene';
import { isLevelId } from './levels';
import { Menu, pixelText } from './menu';

const CONTROLS = [
  'Left / Right   walk        Shift + direction   step',
  'Up             jump        Down                crouch / drink',
  'Run + Up       running jump        Hold Up at an edge   hang',
  'Space          draw sword, then strike',
  'Up (sword out) parry       Left / Right   advance / retreat',
  'Down (sword out)  sheathe  Esc / P         pause',
  'R              restart from the last checkpoint',
];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    // A ?level= link jumps straight into a level, which keeps debugging and tests quick.
    const level = new URLSearchParams(window.location.search).get('level');
    if (isLevelId(level)) {
      this.scene.start('GameScene', { levelId: level } satisfies GameSceneData);
      return;
    }
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    const save = loadSave(storage);

    this.cameras.main.setZoom(RENDER_SCALE).centerOn(160, 100);
    audio().playMusic('dungeon');
    pixelText(this, 160, 34, 18, '#e8c860', true).setText('PERSIAN PRINCE');
    pixelText(this, 160, 58, 7, '#8a8aa0', true).setText('an original tribute');

    const controls = pixelText(this, 160, 100, 6, '#b0b0c8', true).setVisible(false);
    controls.setText(CONTROLS.join('\n'));
    const menu = new Menu(this, 160, 84);
    const main = (): void => {
      controls.setVisible(false);
      menu.set([
        { label: 'New Game', action: () => this.scene.start('GameScene', { levelId: 'hazard' } satisfies GameSceneData) },
        {
          label: 'Continue',
          enabled: save !== undefined,
          action: () => save && this.scene.start('GameScene', { levelId: isLevelId(save.levelId) ? save.levelId : 'hazard', save, keepTime: save.timeRemaining } satisfies GameSceneData),
        },
        {
          label: 'Controls',
          action: () => {
            controls.setVisible(true);
            menu.set([{ label: 'Back', action: main }]);
          },
        },
      ]);
    };
    main();
  }
}
