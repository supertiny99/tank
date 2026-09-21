import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { PlayerTank } from './PlayerTank';
import { sfx } from '../sfx';
import { ballistic } from '../ballistic';
import { E_TURRET_ORIGIN } from '../textureFactory';

/** 敌方坦克：巡逻 + 发现玩家后停车开炮（抛物线弹道解算） */
export class EnemyTank extends Phaser.Physics.Arcade.Sprite {
  hp = 70;
  private dead = false;
  private readonly minX: number;
  private readonly maxX: number;
  private dir = 1;
  private fireT: number;
  turret: Phaser.GameObjects.Sprite;

  constructor(scene: GameScene, x: number, y: number, min: number, max: number) {
    super(scene, x, y, 'eHull');
    this.minX = min;
    this.maxX = max;
    this.fireT = Phaser.Math.FloatBetween(1.2, 2.4);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(4);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(76, 28).setOffset(6, 8);
    body.setMaxVelocity(80, 900);
    this.turret = scene.add.sprite(x, y - 7, 'eTurret').setDepth(6);
    this.turret.setOrigin(E_TURRET_ORIGIN.x, E_TURRET_ORIGIN.y);
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
    const ty = this.y - 7;
    const engaged = dist < 640 && Math.abs(player.y - this.y) < 190;

    if (engaged) {
      body.setVelocityX(0);
      this.setFlipX(dx < 0);
      const a = Phaser.Math.Angle.Between(this.x, ty, player.x, player.y - 10);
      this.turret.setPosition(this.x, ty);
      this.turret.setRotation(a);
      this.turret.setFlipY(Math.cos(a) < 0);
      this.fireT -= dt / 1000;
      if (this.fireT <= 0) {
        this.fireT = Phaser.Math.FloatBetween(2.2, 3.1);
        const mx = this.x + Math.cos(a) * 42;
        const my = ty + Math.sin(a) * 42;
        const v = ballistic(mx, my, player.x, player.y - 10, 260, 640, 0.06);
        if (v) {
          (this.scene as GameScene).spawnEnemyShell(mx, my, v.vx, v.vy);
          sfx.enemyShoot();
        }
      }
    } else {
      body.setVelocityX(this.dir * 55);
      if (this.x < this.minX) this.dir = 1;
      else if (this.x > this.maxX) this.dir = -1;
      this.setFlipX(this.dir < 0);
      this.turret.setPosition(this.x, ty);
      const fa = this.dir < 0 ? Math.PI : 0;
      this.turret.setRotation(fa);
      this.turret.setFlipY(false);
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

  die(): void {
    if (this.dead) return;
    this.dead = true;
    const sc = this.scene as GameScene;
    const i = sc.enemyList.indexOf(this);
    if (i >= 0) sc.enemyList.splice(i, 1);
    sc.onEnemyKilled();
    sc.explode(this.x, this.y - 8, { radius: 90, big: true });
    // 立即停用，销毁推迟到物理步之外（die 可能发生在碰撞回调内）
    this.setActive(false).setVisible(false);
    this.turret.setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    sc.time.delayedCall(0, () => {
      this.turret.destroy();
      this.destroy();
    });
  }
}
