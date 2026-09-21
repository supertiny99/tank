import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from '../sfx';
import { P_TURRET_ORIGIN } from '../textureFactory';

export interface MoveInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  /** 摇杆模拟量 0..1（键盘时缺省为全速） */
  magX?: number;
}

export class PlayerTank extends Phaser.Physics.Arcade.Sprite {
  hp = 100;
  readonly maxHp = 100;
  fireCd = 0; // 剩余装填 ms（HUD 读它画装填条）
  readonly fireDelay = 700;
  turret: Phaser.GameObjects.Sprite;
  private invuln = 0;
  private smokeAcc = 0;
  private dustAcc = 0;
  private lastAim = 0; // 无瞄准输入时炮塔保持上次角度（触屏用）

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, 'pHull');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(80, 30).setOffset(6, 8);
    this.setCollideWorldBounds(true);
    body.setMaxVelocity(300, 900);
    this.turret = scene.add.sprite(x, y - 7, 'pTurret').setDepth(6);
    this.turret.setOrigin(P_TURRET_ORIGIN.x, P_TURRET_ORIGIN.y);
  }

  /**
   * @param aim   瞄准世界坐标点；null 表示保持当前炮塔角度（触屏摇杆未推出时）
   * @param fireHeld 是否持续开火
   */
  control(input: MoveInput, aim: { x: number; y: number } | null, fireHeld: boolean, dt: number): void {
    if (!this.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;
    const mag = Phaser.Math.Clamp(Math.abs(input.magX ?? 1), 0.2, 1);

    if (input.left) {
      body.setAccelerationX(-1100 * mag);
      this.setFlipX(true);
    } else if (input.right) {
      body.setAccelerationX(1100 * mag);
      this.setFlipX(false);
    } else {
      body.setAccelerationX(0);
    }
    body.setDragX(onGround ? 1400 : 200);

    if (input.jump && onGround) {
      body.setVelocityY(-580);
      (this.scene as GameScene).dustAt(this.x, this.y + 18, 8);
    }

    // 炮塔独立跟踪瞄准点（鼠标或右摇杆）
    const ty = this.y - 7;
    if (aim) {
      this.lastAim = Phaser.Math.Angle.Between(this.x, ty, aim.x, aim.y);
    }
    const a = this.lastAim;
    this.turret.setPosition(this.x, ty);
    this.turret.setRotation(a);
    this.turret.setFlipY(Math.cos(a) < 0);

    this.fireCd = Math.max(0, this.fireCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (fireHeld) this.tryFire(a);

    // 行驶扬尘
    if (onGround && Math.abs(body.velocity.x) > 60) {
      this.dustAcc += dt;
      if (this.dustAcc > 90) {
        this.dustAcc = 0;
        (this.scene as GameScene).dustAt(
          this.x - Math.sign(body.velocity.x) * 30,
          this.y + 16,
          2,
        );
      }
    }

    // 残血冒黑烟
    if (this.hp < 40) {
      this.smokeAcc += dt;
      if (this.smokeAcc > (this.hp < 20 ? 90 : 160)) {
        this.smokeAcc = 0;
        (this.scene as GameScene).smokeAt(this.x, this.y - 14);
      }
    }
  }

  tryFire(a: number): void {
    if (this.fireCd > 0) return;
    this.fireCd = this.fireDelay;
    const ty = this.y - 7;
    const mx = this.x + Math.cos(a) * 46;
    const my = ty + Math.sin(a) * 46;
    (this.scene as GameScene).spawnPlayerShell(mx, my, a);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.velocity.x -= Math.cos(a) * 60; // 后坐力
    (this.scene as GameScene).muzzleFlash(mx, my, a);
    (this.scene as GameScene).cameras.main.shake(70, 0.0035);
    sfx.shoot();
  }

  takeDamage(n: number): void {
    if (!this.active || this.invuln > 0) return;
    this.hp -= n;
    this.invuln = 280;
    this.setTintFill(0xff7070);
    this.scene.time.delayedCall(90, () => {
      if (this.active) this.clearTint();
    });
    (this.scene as GameScene).cameras.main.shake(120, 0.006);
    sfx.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      (this.scene as GameScene).playerDied();
    }
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  /** 被击毁后从场上移除（由 GameScene.playerDied 调用） */
  kill(): void {
    this.setActive(false).setVisible(false);
    this.turret.setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
  }
}
