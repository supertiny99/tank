import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

const MOVE_ZONE_W = 560; // 屏幕左侧为移动摇杆区
const STICK_R = 58; // 摇杆最大偏移半径
const AIM_DEAD = 0.12; // 开始报告瞄准角度的最小推杆力度（轻微滑动即可响应）
const JUMP_HIT_R = 52;
const FIRE_HIT_R = 62;
const PAUSE_HIT_R = 36;

// 布局坐标（1280 x 720）：
// 右侧按键：开火在最右下角（右手拇指自然落点），跳跃在开火左侧（拇指轻松内探）
const FIRE_BTN_X = 1150;
const FIRE_BTN_Y = 585;
const JUMP_BTN_X = 1015;
const JUMP_BTN_Y = 590;
const PAUSE_BTN_X = 1218;
const PAUSE_BTN_Y = 92;

interface StickState {
  pointerId: number;
  baseX: number;
  baseY: number;
  dx: number; // -1..1
  dy: number;
}

/**
 * 触屏双摇杆 + 独立跳跃/开火按键：
 * - 左半屏：生成浮动移动摇杆（仅在明确垂直上推时才触发跳跃，杜绝横移误触）
 * - 右侧独立按键：右下角常驻大开火键（按下即打，支持滑动瞄准）+ 内侧跳跃键
 * - 右半屏全域手势：在右侧任意空白处按下立即开火，拖动即调整炮塔瞄准方向
 * - 右上角暂停按钮
 */
export class TouchController {
  readonly enabled: boolean;
  readonly state = { moveX: 0, jump: false, aimAngle: null as number | null, firing: false };

  private moveStick: StickState | null = null;
  private aimStick: StickState | null = null;
  private jumpPointerId: number | null = null;
  private firePointerId: number | null = null;
  private stickJump = false; // 左摇杆上推触发的跳跃
  private tapFireHold = 0; // 短触开火保底缓冲时间（ms）
  private tapJumpHold = 0; // 短触跳跃保底缓冲时间（ms）

  private moveBase!: Phaser.GameObjects.Image;
  private moveKnob!: Phaser.GameObjects.Image;
  private aimBase!: Phaser.GameObjects.Image;
  private aimKnob!: Phaser.GameObjects.Image;
  private jumpBtn!: Phaser.GameObjects.Image;
  private fireBtn!: Phaser.GameObjects.Image;
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

    this.jumpBtn = scene.add
      .image(JUMP_BTN_X, JUMP_BTN_Y, 'btnJump')
      .setScrollFactor(0)
      .setDepth(89)
      .setAlpha(0.85);

    this.fireBtn = scene.add
      .image(FIRE_BTN_X, FIRE_BTN_Y, 'btnFire')
      .setScrollFactor(0)
      .setDepth(89)
      .setAlpha(0.88);

    this.pauseBtn = scene.add
      .image(PAUSE_BTN_X, PAUSE_BTN_Y, 'btnPause')
      .setScrollFactor(0)
      .setDepth(89)
      .setAlpha(0.85);

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
    // 1. 暂停按钮
    if (Phaser.Math.Distance.Between(x, y, PAUSE_BTN_X, PAUSE_BTN_Y) < PAUSE_HIT_R) {
      this.scene.togglePause();
      return;
    }

    // 2. 跳跃按钮
    if (Phaser.Math.Distance.Between(x, y, JUMP_BTN_X, JUMP_BTN_Y) < JUMP_HIT_R) {
      if (this.jumpPointerId === null) {
        this.jumpPointerId = id;
        this.tapJumpHold = 120;
        this.jumpBtn.setAlpha(1).setScale(0.92);
      }
      this.refresh();
      return;
    }

    // 3. 开火按钮（兼具即时开火与滑动瞄准）
    if (Phaser.Math.Distance.Between(x, y, FIRE_BTN_X, FIRE_BTN_Y) < FIRE_HIT_R) {
      if (this.firePointerId === null) {
        this.firePointerId = id;
        this.tapFireHold = 120;
        this.fireBtn.setAlpha(1).setScale(0.92);
        if (!this.aimStick) {
          this.aimStick = { pointerId: id, baseX: FIRE_BTN_X, baseY: FIRE_BTN_Y, dx: 0, dy: 0 };
        }
      }
      this.refresh();
      return;
    }

    // 4. 左半屏：浮动移动摇杆
    if (x < MOVE_ZONE_W) {
      if (!this.moveStick) {
        const bx = Phaser.Math.Clamp(x, 80, MOVE_ZONE_W - 50);
        const by = Phaser.Math.Clamp(y, 300, 650);
        this.moveStick = { pointerId: id, baseX: bx, baseY: by, dx: 0, dy: 0 };
        this.moveBase.setPosition(bx, by).setVisible(true);
        this.moveKnob.setPosition(bx, by).setVisible(true);
      }
    } else if (!this.aimStick) {
      // 5. 右半屏空白区域：按下立即开火，同时生成瞄准摇杆支持拖动调整角度
      this.tapFireHold = 120;
      const bx = Phaser.Math.Clamp(x, MOVE_ZONE_W + 50, 1200);
      const by = Phaser.Math.Clamp(y, 250, 650);
      this.aimStick = { pointerId: id, baseX: bx, baseY: by, dx: 0, dy: 0 };
      this.aimBase.setPosition(bx, by).setVisible(true);
      this.aimKnob.setPosition(bx, by).setVisible(true).setTint(0xffb020);
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

    if (st === this.moveStick) {
      this.moveKnob.setPosition(st.baseX + dx * STICK_R, st.baseY + dy * STICK_R);
    } else if (this.aimBase.visible) {
      this.aimKnob.setPosition(st.baseX + dx * STICK_R, st.baseY + dy * STICK_R);
    }
    this.refresh();
  }

  handleUp(id: number): void {
    if (this.jumpPointerId === id) {
      this.jumpPointerId = null;
      this.jumpBtn.setAlpha(0.85).setScale(1.0);
    }
    if (this.firePointerId === id) {
      this.firePointerId = null;
      this.fireBtn.setAlpha(0.88).setScale(1.0);
    }
    if (this.moveStick?.pointerId === id) {
      this.moveStick = null;
      this.moveBase.setVisible(false);
      this.moveKnob.setVisible(false);
      this.stickJump = false;
    }
    if (this.aimStick?.pointerId === id) {
      this.aimStick = null;
      this.aimBase.setVisible(false);
      this.aimKnob.setVisible(false);
      this.state.aimAngle = null;
    }
    this.refresh();
  }

  update(dt: number): void {
    let dirty = false;
    if (this.tapFireHold > 0) {
      this.tapFireHold = Math.max(0, this.tapFireHold - dt);
      dirty = true;
    }
    if (this.tapJumpHold > 0) {
      this.tapJumpHold = Math.max(0, this.tapJumpHold - dt);
      dirty = true;
    }
    if (dirty) this.refresh();
  }

  private refresh(): void {
    const m = this.moveStick;
    this.state.moveX = m ? Phaser.Math.Clamp(m.dx * 1.4, -1, 1) : 0;

    // 左摇杆上推 = 跳跃（严格限制为垂直主导方向，防止横向移动时误触）
    // 必须 dy <= -0.75 且水平偏移 |dx| <= 0.45
    if (m && m.dy <= -0.75 && Math.abs(m.dx) <= 0.45) {
      this.stickJump = true;
    } else if (!m || m.dy > -0.45) {
      this.stickJump = false;
    }
    this.state.jump = this.jumpPointerId !== null || this.stickJump || this.tapJumpHold > 0;

    const a = this.aimStick;
    if (a) {
      const mag = Math.hypot(a.dx, a.dy);
      if (mag >= AIM_DEAD) {
        this.state.aimAngle = Math.atan2(a.dy, a.dx);
      }
    }
    // 开火：只要按住开火键、或按在右侧瞄准区域、或轻点开火缓冲期内，均立即开火
    this.state.firing = this.firePointerId !== null || this.aimStick !== null || this.tapFireHold > 0;
  }
}
