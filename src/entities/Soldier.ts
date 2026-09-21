import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { PlayerTank } from './PlayerTank';
import { sfx } from '../sfx';

/** 步兵：向玩家逼近，近距离步枪点射，一发炮弹就能带走 */
export class Soldier extends Phaser.Physics.Arcade.Sprite {
  hp = 10;
  private dead = false;
  private readonly minX: number;
  private readonly maxX: number;
  private fireT: number;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, 'soldier');
    this.minX = x - 140;
    this.maxX = x + 140;
    this.fireT = Phaser.Math.FloatBetween(0.8, 2);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(4);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 24).setOffset(3, 4);
    body.setMaxVelocity(60, 900);
  }

  control(player: PlayerTank, dt: number): void {
    if (this.dead || !this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!player.active) {
      body.setVelocityX(0);
      return;
    }
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    if (dist < 560) {
      const dir = Math.sign(dx) || 1;
      if (dist > 160) body.setVelocityX(dir * 42);
      else body.setVelocityX(0);
      this.setFlipX(dir < 0);
      this.fireT -= dt / 1000;
      if (this.fireT <= 0 && dist < 460) {
        this.fireT = Phaser.Math.FloatBetween(1.5, 2.3);
        const a = Phaser.Math.Angle.Between(this.x, this.y - 6, player.x, player.y - 12);
        (this.scene as GameScene).spawnSoldierBullet(
          this.x + Math.cos(a) * 12,
          this.y - 6 + Math.sin(a) * 12,
          a,
        );
        sfx.rifle();
      }
    } else {
      body.setVelocityX(0);
    }
    // 别走出自己的警戒区
    if (this.x < this.minX) body.setVelocityX(30);
    else if (this.x > this.maxX) body.setVelocityX(-30);
  }

  takeDamage(n: number): void {
    if (this.dead || !this.active) return;
    this.hp -= n;
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    const sc = this.scene as GameScene;
    const i = sc.enemyList.indexOf(this);
    if (i >= 0) sc.enemyList.splice(i, 1);
    sc.onEnemyKilled();
    sc.dustAt(this.x, this.y, 6);
    sfx.ping();
    this.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    sc.time.delayedCall(0, () => this.destroy());
  }
}
