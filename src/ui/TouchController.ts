import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

const MOVE_ZONE_W = 540; // 屏幕左半为移动区
const STICK_R = 58; // 摇杆最大偏移半径
const AIM_DEAD = 0.25; // 开始报告瞄准角度的最小推杆力度
const FIRE_DEAD = 0.55; // 触发自动开火的最小推杆力度
const JUMP_HIT_R = 56;
const PAUSE_HIT_R = 36;

interface StickState {
  pointerId: number;
  baseX: number;
  baseY: number;
  dx: number; // -1..1
  dy: number;
}

/**
 * 触屏双摇杆 + 跳跃/暂停按钮：
 * - 左半屏按下生成移动摇杆（浮动，出现在手指落点）
 * - 右半屏按下生成瞄准摇杆，推杆超过阈值自动开火
 * - 跳跃按钮固定在底部中央，暂停按钮在右上角
 * 仅在触摸设备上启用；键鼠操作不受任何影响。
 */
export class TouchController {
  readonly enabled: boolean;
  readonly state = { moveX: 0, jump: false, aimAngle: null as number | null, firing: false };

  private moveStick: StickState | null = null;
  private aimStick: StickState | null = null;
  private jumpPointerId: number | null = null;
  private stickJump = false; // 左摇杆上推触发的跳跃

  private moveBase!: Phaser.GameObjects.Image;
  private moveKnob!: Phaser.GameObjects.Image;
  private aimBase!: Phaser.GameObjects.Image;
  private aimKnob!: Phaser.GameObjects.Image;
  private jumpBtn!: Phaser.GameObjects.Image;
  private pauseBtn!: Phaser.GameObjects.Image;

  constructor(private scene: GameScene) {
    this.enabled = scene.sys.game.device.input.touch;
    if (!this.enabled) return;

    const mk = (key: string) =>
      scene.add.image(0, 0, key).setScrollFactor(0).setDepth(90).setVisible(false);
    this.moveBase = mk('joyBase');
    this.moveKnob = mk('joyKnob');
    this.aimBase = mk('joyBase');
    this.aimKnob = mk('joyKnob');
    this.jumpBtn = scene.add.image(640, 656, 'btnJump').setScrollFactor(0).setDepth(89).setAlpha(0.85);
    this.pauseBtn = scene.add.image(1218, 92, 'btnPause').setScrollFactor(0).setDepth(89).setAlpha(0.85);

    const down = (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) this.handleDown(p.id, p.x, p.y);
    };
    const move = (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) this.handleMove(p.id, p.x, p.y);
    };
    const up = (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) this.handleUp(p.id);
    };
    scene.input.on('pointerdown', down);
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', up);
    scene.input.on('pointerupoutside', up);
  }

  handleDown(id: number, x: number, y: number): void {
    if (Phaser.Math.Distance.Between(x, y, this.jumpBtn.x, this.jumpBtn.y) < JUMP_HIT_R) {
      if (this.jumpPointerId === null) {
        this.jumpPointerId = id;
        this.state.jump = true;
        this.jumpBtn.setAlpha(1);
      }
      return;
    }
    if (Phaser.Math.Distance.Between(x, y, this.pauseBtn.x, this.pauseBtn.y) < PAUSE_HIT_R) {
      this.scene.togglePause();
      return;
    }
    const bx = Phaser.Math.Clamp(x, 90, 1190);
    const by = Phaser.Math.Clamp(y, 320, 640);
    if (x < MOVE_ZONE_W) {
      if (!this.moveStick) {
        this.moveStick = { pointerId: id, baseX: bx, baseY: by, dx: 0, dy: 0 };
        this.moveBase.setPosition(bx, by).setVisible(true);
        this.moveKnob.setPosition(bx, by).setVisible(true);
      }
    } else if (!this.aimStick) {
      this.aimStick = { pointerId: id, baseX: bx, baseY: by, dx: 0, dy: 0 };
      this.aimBase.setPosition(bx, by).setVisible(true);
      this.aimKnob.setPosition(bx, by).setVisible(true).setTint(0xffffff);
    }
    this.refresh();
  }

  handleMove(id: number, x: number, y: number): void {
    const st = [this.moveStick, this.aimStick].find((s) => s && s.pointerId === id);
    if (!st) return;
    let dx = (x - st.baseX) / STICK_R;
    let dy = (y - st.baseY) / STICK_R;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    st.dx = dx;
    st.dy = dy;
    const knob = st === this.moveStick ? this.moveKnob : this.aimKnob;
    knob.setPosition(st.baseX + dx * STICK_R, st.baseY + dy * STICK_R);
    this.refresh();
  }

  handleUp(id: number): void {
    if (this.jumpPointerId === id) {
      this.jumpPointerId = null;
      this.state.jump = false;
      this.jumpBtn.setAlpha(0.85);
    }
    if (this.moveStick?.pointerId === id) {
      this.moveStick = null;
      this.moveBase.setVisible(false);
      this.moveKnob.setVisible(false);
      this.refresh();
    }
    if (this.aimStick?.pointerId === id) {
      this.aimStick = null;
      this.aimBase.setVisible(false);
      this.aimKnob.setVisible(false);
      this.state.aimAngle = null;
      this.state.firing = false;
    }
  }

  private refresh(): void {
    const m = this.moveStick;
    this.state.moveX = m ? Phaser.Math.Clamp(m.dx * 1.4, -1, 1) : 0;
    // 左摇杆上推 = 跳跃（滞回触发，避免抖动；可斜推实现边移动边跳）
    if (m && m.dy <= -0.55) this.stickJump = true;
    else if (!m || m.dy > -0.35) this.stickJump = false;
    this.state.jump = this.jumpPointerId !== null || this.stickJump;

    const a = this.aimStick;
    if (a) {
      const mag = Math.hypot(a.dx, a.dy);
      if (mag >= AIM_DEAD) this.state.aimAngle = Math.atan2(a.dy, a.dx);
      this.state.firing = mag >= FIRE_DEAD;
      this.aimKnob.setTint(this.state.firing ? 0xffb020 : 0xffffff);
    }
  }
}
