import Phaser from 'phaser';
import { sfx } from '../sfx';
import { P_TURRET_ORIGIN } from '../textureFactory';

const FONT = 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    // 背景 + 缓慢镜头横移制造纵深
    this.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(1280, 720);
    this.add.tileSprite(0, 620, 2048, 360, 'ruins-far').setOrigin(0, 1).setScrollFactor(0.3);
    this.add.tileSprite(0, 636, 2048, 260, 'ruins-near').setOrigin(0, 1).setScrollFactor(0.6);
    this.add.tileSprite(0, 720, 2048, 90, 'dirt').setOrigin(0, 1);
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: 320,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 主角坦克展示（KV44 大眼睛特写）
    const hull = this.add.image(380, 578, 'pHull').setScale(2.4);
    const turret = this.add
      .sprite(380, 578 - 17, 'pTurret')
      .setOrigin(P_TURRET_ORIGIN.x, P_TURRET_ORIGIN.y)
      .setScale(2.4)
      .setRotation(-0.06);
    this.tweens.add({
      targets: [hull, turret],
      y: '-=8',
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // 远处一辆敌方灰坦克剪影
    this.add.image(1120, 606, 'eHull').setScale(1.6).setAlpha(0.55);
    this.add
      .sprite(1120, 606 - 12, 'eTurret')
      .setOrigin(16 / 56, 0.5)
      .setScale(1.6)
      .setAlpha(0.55)
      .setRotation(Math.PI);

    const title = this.add
      .text(840, 210, '钢铁咆哮', {
        fontFamily: FONT,
        fontSize: '92px',
        color: '#f2e9d8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setShadow(0, 6, '#000000', 18, false, true);
    this.tweens.add({ targets: title, scale: 1.03, duration: 2200, yoyo: true, repeat: -1 });

    this.add
      .text(840, 302, 'KV-44 · 横版坦克闯关 · MVP', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#c9c2b4',
      })
      .setOrigin(0.5);

    const isTouch = this.sys.game.device.input.touch;
    const ctrlLines = isTouch
      ? ['左摇杆  移动        右侧 ⬆  跳跃', '右侧 🎯  开火        滑动  瞄准', '右上角 ⏸  暂停']
      : ['A / D  移动        W / 空格  跳跃', '鼠标  瞄准        左键  开炮', 'P  暂停        R  重开'];
    this.add
      .text(840, 420, ctrlLines, {
        fontFamily: FONT,
        fontSize: '21px',
        color: '#a8a294',
        lineSpacing: 14,
      })
      .setOrigin(0.5);

    const start = this.add
      .text(840, 566, '点击任意处 出击 →', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffd43b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => {
      sfx.init();
      this.cameras.main.fadeOut(240, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('game'));
    });
  }
}
