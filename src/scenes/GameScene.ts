import Phaser from 'phaser';
import {
  WORLD_W,
  VIEW_H,
  SEGS,
  SPIKES,
  TANKS,
  SOLDIERS,
  BUNKERS,
  CRATES,
  FLAG_X,
  PLAYER_START,
  groundTopAt,
} from '../level';
import { PlayerTank } from '../entities/PlayerTank';
import { EnemyTank } from '../entities/EnemyTank';
import { Bunker } from '../entities/Bunker';
import { Soldier } from '../entities/Soldier';
import type { IEnemy } from '../types';
import { sfx } from '../sfx';
import { TouchController } from '../ui/TouchController';

const FONT = 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';

interface ExplodeOpts {
  radius?: number;
  dmg?: number;
  big?: boolean;
  hitsPlayer?: boolean;
  hitsEnemies?: boolean;
  guaranteed?: IEnemy | null;
}

export class GameScene extends Phaser.Scene {
  player!: PlayerTank;
  enemyList: Phaser.Physics.Arcade.Sprite[] = [];
  frozen = false;
  touch!: TouchController;

  private solids: Phaser.GameObjects.Rectangle[] = [];
  private crates: Phaser.Physics.Arcade.Sprite[] = [];
  private spikeZones: Phaser.GameObjects.Zone[] = [];
  private flagZone!: Phaser.GameObjects.Zone;
  private pShells!: Phaser.Physics.Arcade.Group;
  private eShells!: Phaser.Physics.Arcade.Group;
  private sBullets!: Phaser.Physics.Arcade.Group;
  private boomFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trailFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hudG!: Phaser.GameObjects.Graphics;
  private killText!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private kills = 0;
  private totalEnemies = 0;
  private over = false;

  constructor() {
    super('game');
  }

  create(): void {
    // Scene.restart 会复用实例，所有状态在此重置
    this.kills = 0;
    this.frozen = false;
    this.over = false;
    this.enemyList = [];
    this.solids = [];
    this.crates = [];
    this.spikeZones = [];

    this.physics.world.setBounds(0, -200, WORLD_W, 1000);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIEW_H);
    this.cameras.main.setDeadzone(160, 0);

    this.buildBackground();
    this.buildTerrain();
    this.buildEnemies();
    this.buildPickupsAndFlag();

    this.player = new PlayerTank(this, PLAYER_START.x, PLAYER_START.y);

    this.pShells = this.physics.add.group({ allowGravity: false });
    this.eShells = this.physics.add.group({ allowGravity: false });
    this.sBullets = this.physics.add.group({ allowGravity: false });

    this.buildFx();
    this.buildColliders();
    this.setupInput();
    this.touch = new TouchController(this);
    this.buildHud();

    this.cameras.main.startFollow(this.player, false, 0.12, 0.12);
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    if (this.frozen) return;
    const dt = Math.min(delta, 50);
    if (this.touch.enabled) this.touch.update(dt);
    const k = this.keys;
    const st = this.touch.state;
    let left = k.A.isDown || k.LEFT.isDown;
    let right = k.D.isDown || k.RIGHT.isDown;
    let jump = k.W.isDown || k.SPACE.isDown || k.UP.isDown;
    let magX: number | undefined;
    if (this.touch.enabled && st.moveX <= -0.25) {
      left = true;
      magX = Math.abs(st.moveX);
    } else if (this.touch.enabled && st.moveX >= 0.25) {
      right = true;
      magX = st.moveX;
    }
    jump = jump || st.jump;

    // 瞄准优先级：右摇杆 > 鼠标；触屏设备未推瞄准杆时保持炮塔原角度
    let aim: { x: number; y: number } | null = null;
    let fireHeld = false;
    if (this.touch.enabled) {
      if (st.aimAngle !== null) {
        const a = st.aimAngle;
        aim = { x: this.player.x + Math.cos(a) * 300, y: this.player.y - 7 + Math.sin(a) * 300 };
      }
      fireHeld = st.firing;
    } else if (!this.input.activePointer.wasTouch) {
      const p = this.input.activePointer;
      aim = { x: p.worldX, y: p.worldY };
      fireHeld = p.isDown;
    }
    this.player.control({ left, right, jump, magX }, aim, fireHeld, dt);
    for (const e of [...this.enemyList]) {
      if (!e.active) continue;
      (e as unknown as IEnemy).control(this.player, dt);
    }

    // 炮弹：手动加重力（每发弹自带 g 值：我方 260 / 敌方 150）+ 朝向速度方向 + 曳光
    const ks = dt / 1000;
    for (const grp of [this.pShells, this.eShells]) {
      for (const o of grp.getChildren()) {
        const s = o as Phaser.Physics.Arcade.Sprite;
        if (!s.active) continue;
        const b = s.body as Phaser.Physics.Arcade.Body;
        b.velocity.y += (s.getData('g') as number ?? 260) * ks;
        s.setRotation(Math.atan2(b.velocity.y, b.velocity.x));
        this.trailFx.emitParticleAt(s.x, s.y);
        if (s.y > 820 || s.x < -80 || s.x > WORLD_W + 80) s.destroy();
      }
    }
    this.drawHud();
  }

  // ---------- 场景搭建 ----------

  private buildBackground(): void {
    this.add.image(0, 0, 'sky').setOrigin(0).setDisplaySize(1280, VIEW_H).setScrollFactor(0).setDepth(-100);
    this.add.tileSprite(0, 600, 2048, 360, 'ruins-far').setOrigin(0, 1).setScrollFactor(0.12).setDepth(-90);
    this.add.tileSprite(0, 636, 3200, 260, 'ruins-near').setOrigin(0, 1).setScrollFactor(0.35).setDepth(-80);
    // 飘动的硝烟
    for (let i = 0; i < 8; i++) {
      const c = this.add
        .image(Phaser.Math.Between(0, 3200), Phaser.Math.Between(60, 320), 'haze')
        .setScrollFactor(0.15)
        .setDepth(-70)
        .setAlpha(0.16)
        .setTint(0x9aa3b5)
        .setScale(Phaser.Math.FloatBetween(1.5, 3.2));
      this.tweens.add({
        targets: c,
        x: c.x + Phaser.Math.Between(40, 90),
        duration: Phaser.Math.Between(16000, 30000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private buildTerrain(): void {
    for (const s of SEGS) {
      const h = VIEW_H - s.top + 40;
      const cx = s.x + s.w / 2;
      const cy = s.top + h / 2;
      const rect = this.add.rectangle(cx, cy, s.w, h, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.solids.push(rect);
      const ts = this.add.tileSprite(cx, cy, s.w, h, 'dirt').setDepth(0);
      if (s.tint) ts.setTint(s.tint);
      else if (s.top > 600) ts.setTint(0x8a8378); // 坑底更暗
    }
    for (const p of SPIKES) {
      this.add.tileSprite(p.x, 660, p.w, 28, 'spike').setOrigin(0, 0).setDepth(1);
      const z = this.add.zone(p.x + p.w / 2, 660 - 14, p.w, 20);
      this.physics.add.existing(z, true);
      this.spikeZones.push(z);
    }
  }

  private buildEnemies(): void {
    for (const t of TANKS) this.enemyList.push(new EnemyTank(this, t.x, 560 - 20, t.min, t.max));
    for (const sx of SOLDIERS) this.enemyList.push(new Soldier(this, sx, 560 - 14));
    for (const b of BUNKERS) this.enemyList.push(new Bunker(this, b.x, 464 - 38));
    this.totalEnemies = this.enemyList.length;
  }

  private buildPickupsAndFlag(): void {
    for (const cx of CRATES) {
      const c = this.add.sprite(cx, 560 - 18, 'crate').setDepth(3) as Phaser.Physics.Arcade.Sprite;
      this.physics.add.existing(c);
      const b = c.body as Phaser.Physics.Arcade.Body;
      b.setDragX(400);
      b.setBounce(0.15, 0.2);
      this.crates.push(c);
    }
    this.add.image(FLAG_X, 560 - 55, 'flag').setDepth(2);
    this.flagZone = this.add.zone(FLAG_X, 560 - 150, 70, 300);
    this.physics.add.existing(this.flagZone, true);
  }

  private buildFx(): void {
    this.boomFx = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 90, max: 330 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 180, max: 480 },
        scale: { start: 1.5, end: 0 },
        tint: [0xfff3b0, 0xffc93c, 0xff8c1a, 0xe0521a],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(9);
    this.smokeFx = this.add
      .particles(0, 0, 'smokeP', {
        speed: { min: 15, max: 65 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 500, max: 1100 },
        scale: { start: 0.5, end: 1.7 },
        alpha: { start: 0.5, end: 0 },
        tint: 0x6b6b6b,
        gravityY: -50,
        emitting: false,
      })
      .setDepth(8);
    this.dustFx = this.add
      .particles(0, 0, 'smokeP', {
        speed: { min: 10, max: 45 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 300, max: 600 },
        scale: { start: 0.4, end: 0.9 },
        alpha: { start: 0.32, end: 0 },
        tint: 0xa4937a,
        gravityY: -20,
        emitting: false,
      })
      .setDepth(7);
    this.trailFx = this.add
      .particles(0, 0, 'spark', {
        lifespan: 130,
        speed: { min: 4, max: 22 },
        scale: { start: 0.55, end: 0 },
        tint: 0xffd166,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(8);
  }

  private buildColliders(): void {
    const solids = this.solids;
    this.physics.add.collider(this.player, solids);
    this.physics.add.collider(this.enemyList, solids);
    this.physics.add.collider(this.crates, solids);

    // 注意：Phaser 的 collider/overlap 回调参数顺序不保证与传入顺序一致
    // （Group vs Array 走 collideSpriteVsGroup 时会反转），必须按贴图 key 辨认对象
    this.physics.add.collider(this.pShells, solids, (a, b) => {
      const shell = this.pickPair(a, b, 'shellP');
      if (shell) this.shellImpact(shell, 'player');
    });
    this.physics.add.collider(this.eShells, solids, (a, b) => {
      const shell = this.pickPair(a, b, 'shellE');
      if (shell) this.shellImpact(shell, 'enemy');
    });
    this.physics.add.collider(this.sBullets, solids, (a, b) => {
      const bullet = this.pickPair(a, b, 'bulletS');
      if (bullet) this.deferDestroy(bullet);
    });

    this.physics.add.overlap(this.pShells, this.enemyList, (a, b) => {
      const shell = this.pickPair(a, b, 'shellP');
      if (!shell) return;
      const other = (a === shell ? b : a) as unknown as IEnemy;
      this.shellImpact(shell, 'player', other);
    });
    this.physics.add.overlap(this.eShells, this.player, (a, b) => {
      const shell = this.pickPair(a, b, 'shellE');
      if (!shell) return;
      const other = a === shell ? b : a;
      if (other !== this.player) return;
      this.player.takeDamage(16);
      this.explode(shell.x, shell.y, { radius: 70, dmg: 8, hitsPlayer: false });
      this.deferDestroy(shell);
    });
    this.physics.add.overlap(this.sBullets, this.player, (a, b) => {
      const bullet = this.pickPair(a, b, 'bulletS');
      if (!bullet) return;
      const other = a === bullet ? b : a;
      if (other !== this.player) return;
      this.player.takeDamage(3);
      this.deferDestroy(bullet);
    });
    this.physics.add.overlap(this.player, this.spikeZones, () => this.spikeHit());
    this.physics.add.overlap(this.player, this.crates, (a, b) => {
      const other = this.pickOther(a, b, 'crate');
      if (other !== this.player) return;
      const crate = (a === other ? b : a) as Phaser.Physics.Arcade.Sprite;
      this.pickCrate(crate);
    });
    this.physics.add.overlap(this.player, this.flagZone, () => this.win());
  }

  /** 从回调参数对里找出贴图 key 匹配的对象（通常是炮弹） */
  private pickPair(
    a: unknown,
    b: unknown,
    key: string,
  ): Phaser.Physics.Arcade.Sprite | null {
    const ta = (a as Phaser.GameObjects.Sprite)?.texture?.key;
    const tb = (b as Phaser.GameObjects.Sprite)?.texture?.key;
    if (ta === key && (a as Phaser.Physics.Arcade.Sprite).active) {
      return a as Phaser.Physics.Arcade.Sprite;
    }
    if (tb === key && (b as Phaser.Physics.Arcade.Sprite).active) {
      return b as Phaser.Physics.Arcade.Sprite;
    }
    return null;
  }

  /** 从回调参数对里找出“不是”贴图 key 匹配的那个对象 */
  private pickOther(a: unknown, b: unknown, key: string): unknown {
    const ta = (a as Phaser.GameObjects.Sprite)?.texture?.key;
    return ta === key ? b : a;
  }

  /**
   * 物理回调里不能直接 destroy（会打断 Arcade World 的步进迭代），
   * 先停用隐藏，下一帧物理步之前再真正销毁。
   */
  private deferDestroy(o: Phaser.Physics.Arcade.Sprite): void {
    if (!o.active) return;
    o.setActive(false).setVisible(false);
    (o.body as Phaser.Physics.Arcade.Body | null)!.enable = false;
    this.time.delayedCall(0, () => o.destroy());
  }

  private buildHud(): void {
    this.hudG = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.killText = this.add
      .text(1262, 20, '', { fontFamily: FONT, fontSize: '22px', color: '#e8e4d8' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
    const hint = this.touch.enabled
      ? '左摇杆移动 · ⬆ 跳跃 · 🎯 开火 / 滑动瞄准'
      : 'A / D 移动 · W 或 空格 跳跃 · 鼠标瞄准 · 按住左键开炮 · P 暂停';
    this.add
      .text(640, 700, hint, {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#c9c2b4',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0.75);
    this.pauseText = this.add
      .text(640, 340, '已暂停 · 按 P 或点击 ⏸ 继续', {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#f2e9d8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);
  }

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys(
      'A,D,W,SPACE,LEFT,RIGHT,UP',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-P', () => this.togglePause());
    this.input.keyboard!.on('keydown-R', () => {
      if (this.over) this.scene.restart();
    });
    this.input.once('pointerdown', () => sfx.init());
    this.input.keyboard!.once('keydown', () => sfx.init());
  }

  togglePause(): void {
    if (this.over) return;
    this.frozen = !this.frozen;
    this.pauseText.setVisible(this.frozen);
    if (this.frozen) this.physics.pause();
    else this.physics.resume();
  }

  // ---------- 对外供实体调用的工具 ----------

  spawnPlayerShell(x: number, y: number, a: number): void {
    // 出膛点不允许在地表以下
    y = Math.min(y, groundTopAt(x) - 8);
    const s = this.pShells.create(x, y, 'shellP') as Phaser.Physics.Arcade.Sprite;
    s.setDepth(8).setRotation(a);
    (s.body as Phaser.Physics.Arcade.Body).setSize(12, 8);
    s.setData('g', 260);
    s.setVelocity(Math.cos(a) * 950, Math.sin(a) * 950);
  }

  spawnEnemyShell(x: number, y: number, vx: number, vy: number, g = 150): void {
    y = Math.min(y, groundTopAt(x) - 8);
    const s = this.eShells.create(x, y, 'shellE') as Phaser.Physics.Arcade.Sprite;
    s.setDepth(8).setRotation(Math.atan2(vy, vx));
    (s.body as Phaser.Physics.Arcade.Body).setSize(12, 8);
    s.setData('g', g);
    s.setVelocity(vx, vy);
  }

  spawnSoldierBullet(x: number, y: number, a: number): void {
    const s = this.sBullets.create(x, y, 'bulletS') as Phaser.Physics.Arcade.Sprite;
    s.setDepth(8).setRotation(a);
    (s.body as Phaser.Physics.Arcade.Body).setSize(8, 4);
    s.setVelocity(Math.cos(a) * 430, Math.sin(a) * 430);
  }

  muzzleFlash(x: number, y: number, a: number): void {
    const f = this.add
      .image(x, y, 'flash')
      .setDepth(10)
      .setRotation(a)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: f,
      alpha: 0,
      scale: 0.6,
      duration: 90,
      onComplete: () => f.destroy(),
    });
  }

  dustAt(x: number, y: number, n: number): void {
    this.dustFx.explode(n, x, y);
  }

  smokeAt(x: number, y: number): void {
    this.smokeFx.explode(1, x, y);
  }

  explode(x: number, y: number, o: ExplodeOpts = {}): void {
    const radius = o.radius ?? 80;
    const dmg = o.dmg ?? 0;
    const big = o.big ?? false;
    this.boomFx.explode(big ? 34 : 20, x, y);
    this.smokeFx.explode(big ? 10 : 5, x, y);
    const ring = this.add.image(x, y, 'ring').setDepth(9).setTint(0xffe1a0).setAlpha(0.85).setScale(0.25);
    this.tweens.add({
      targets: ring,
      scale: (radius * 2.1) / 64,
      alpha: 0,
      duration: big ? 320 : 220,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(big ? 240 : 130, big ? 0.012 : 0.005);
    sfx.boom(big);
    if (dmg > 0 && o.hitsEnemies) {
      for (const e of [...this.enemyList]) {
        if (!e.active) continue;
        const en = e as unknown as IEnemy;
        const d = Phaser.Math.Distance.Between(x, y, e.x, e.y - 6);
        if (o.guaranteed != null && en === o.guaranteed) {
          en.takeDamage(dmg);
        } else if (d < radius + 36) {
          en.takeDamage(Math.round(dmg * (0.45 + 0.55 * (1 - d / (radius + 36)))));
        }
      }
    }
    if (dmg > 0 && o.hitsPlayer && this.player && this.player.active) {
      const d = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (d < radius + 30) this.player.takeDamage(Math.round(dmg * 0.8));
    }
  }

  onEnemyKilled(): void {
    this.kills++;
  }

  playerDied(): void {
    if (this.over) return;
    this.over = true;
    this.explode(this.player.x, this.player.y - 8, { radius: 110, big: true });
    this.player.kill();
    this.time.delayedCall(900, () =>
      this.showEnd('坦克被击毁…', '点击屏幕或按 R 重新出击'),
    );
  }

  // ---------- 内部回调 ----------

  private shellImpact(
    s: Phaser.Physics.Arcade.Sprite,
    owner: 'player' | 'enemy',
    directHit?: IEnemy,
  ): void {
    if (!s.active) return;
    const x = s.x;
    const y = s.y;
    this.deferDestroy(s);
    if (owner === 'player') {
      this.explode(x, y, { radius: 85, dmg: 55, hitsEnemies: true, guaranteed: directHit ?? null });
    } else {
      this.explode(x, y, { radius: 70, dmg: 14, hitsPlayer: true });
    }
  }

  private spikeHit(): void {
    if (!this.player.active) return;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    b.setVelocityY(-480);
    this.player.takeDamage(20);
  }

  private pickCrate(c: Phaser.Physics.Arcade.Sprite): void {
    if (!c.active) return;
    this.deferDestroy(c);
    this.player.heal(35);
    sfx.pickup();
    const t = this.add
      .text(this.player.x, this.player.y - 60, '+35 装甲修复', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#8ce99a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({
      targets: t,
      y: t.y - 40,
      alpha: 0,
      duration: 1100,
      onComplete: () => t.destroy(),
    });
  }

  private win(): void {
    if (this.over) return;
    this.over = true;
    this.showEnd('任务完成！', `击毁 ${this.kills} / ${this.totalEnemies} 个目标 · 点击屏幕或按 R 再次出击`);
  }

  private showEnd(title: string, sub: string): void {
    this.frozen = true;
    this.physics.pause();
    this.add.rectangle(640, 360, 1280, 720, 0x0a0c10, 0.66).setScrollFactor(0).setDepth(200);
    this.add
      .text(640, 320, title, {
        fontFamily: FONT,
        fontSize: '58px',
        color: '#f2e9d8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setShadow(0, 4, '#000000', 10, false, true);
    this.add
      .text(640, 396, sub, { fontFamily: FONT, fontSize: '22px', color: '#c9c2b4' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
    // 触屏没有 R 键，点击/触摸屏幕即可重开
    this.input.once('pointerdown', () => {
      if (this.over) this.scene.restart();
    });
  }

  private drawHud(): void {
    const g = this.hudG;
    g.clear();
    const pct = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(18, 18, 264, 22, 6);
    const col = pct > 0.6 ? 0x51cf66 : pct > 0.3 ? 0xffd43b : 0xff6b6b;
    if (pct > 0.02) {
      g.fillStyle(col, 1);
      g.fillRoundedRect(21, 21, 258 * pct, 16, 5);
    }
    const r = 1 - this.player.fireCd / this.player.fireDelay;
    g.fillStyle(0x74c0fc, 0.9);
    g.fillRect(21, 44, 258 * Phaser.Math.Clamp(r, 0, 1), 5);
    this.killText.setText(`击毁 ${this.kills} / ${this.totalEnemies}`);
  }
}
