import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { PlayerTank } from './PlayerTank';
import { sfx } from '../sfx';
import { ballistic } from '../ballistic';

/** 固定碉堡：玩家进入射程后 3 连发抛物线炮击 */
export class Bunker extends Phaser.Physics.Arcade.Sprite {
  hp = 100;
  private dead = false;
  private fireT = 2.2;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, 'bunker');
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // 静态刚体
    this.setDepth(4);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(84, 54).setOffset(6, 20);
  }

  control(player: PlayerTank, dt: number): void {
    if (this.dead || !this.active) return;
    const dist = Math.abs(player.x - this.x);
    if (dist > 760) return;
    this.fireT -= dt / 1000;
    if (this.fireT <= 0) {
      this.fireT = Phaser.Math.FloatBetween(3.0, 3.8);
      const scene = this.scene as GameScene;
      if (scene.frozen) return;
      for (let i = 0; i < 3; i++) {
        scene.time.delayedCall(i * 240, () => {
          if (!this.active || !player.active) return;
          if ((this.scene as GameScene).frozen) return;
          const v = ballistic(this.x - 44, this.y - 1, player.x, player.y - 10, 260, 660, 0.05);
          if (v) {
            (this.scene as GameScene).spawnEnemyShell(this.x - 44, this.y - 1, v.vx, v.vy);
            sfx.enemyShoot();
          }
        });
      }
    }
  }

  takeDamage(n: number): void {
    if (this.dead || !this.active) return;
    this.hp -= n;
    this.setTintFill(0xffaaaa);
    this.scene.time.delayedCall(80, () => {
      if (this.active) this.clearTint();
    });
    sfx.ping();
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    const sc = this.scene as GameScene;
    const i = sc.enemyList.indexOf(this);
    if (i >= 0) sc.enemyList.splice(i, 1);
    sc.onEnemyKilled();
    sc.explode(this.x, this.y - 6, { radius: 100, big: true });
    this.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    sc.time.delayedCall(0, () => this.destroy());
  }
}
