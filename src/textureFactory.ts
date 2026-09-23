import Phaser from 'phaser';

// 炮塔贴图的旋转轴心（圆顶中心），实体类按此设置 origin
export const P_TURRET_ORIGIN = { x: 17 / 64, y: 0.5 };
export const E_TURRET_ORIGIN = { x: 16 / 56, y: 0.5 };

const R = Phaser.Math.Between;

/**
 * 程序化生成全部贴图 —— 项目零图片素材，开箱即玩。
 * 风格目标：KV44 动画（坦克有眼睛、二战东线、废墟硝烟、橙红地平线）。
 */
export function createTextures(scene: Phaser.Scene): void {
  const canvasTex = (
    key: string,
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    draw(tex.getContext());
    tex.refresh();
  };

  const gfxTex = (
    key: string,
    w: number,
    h: number,
    draw: (g: Phaser.GameObjects.Graphics) => void,
  ) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  // ---------- 天空：阴沉蓝灰 + 地平线橙色余晖 ----------
  canvasTex('sky', 64, 720, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, 720);
    grad.addColorStop(0, '#161c2a');
    grad.addColorStop(0.42, '#2a3147');
    grad.addColorStop(0.66, '#4c4150');
    grad.addColorStop(0.82, '#8a5a3a');
    grad.addColorStop(1, '#c07d43');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 720);
    // 太阳残光
    const g2 = ctx.createRadialGradient(32, 600, 4, 32, 600, 130);
    g2.addColorStop(0, 'rgba(255,214,150,0.85)');
    g2.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 440, 64, 280);
  });

  // ---------- 远景废墟（视差层） ----------
  canvasTex('ruins-far', 1024, 360, (ctx) => {
    let x = 0;
    while (x < 1024) {
      const w = R(70, 150);
      const h = R(110, 300);
      ctx.fillStyle = '#454d66';
      ctx.beginPath();
      ctx.moveTo(x, 360);
      ctx.lineTo(x, 360 - h);
      let tx = x;
      let ty = 360 - h;
      while (tx < x + w - 12) {
        tx = Math.min(tx + R(12, 30), x + w);
        ty = 360 - h + R(0, 34);
        ctx.lineTo(tx, ty);
      }
      ctx.lineTo(x + w, 360);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(224,158,90,0.75)';
      const cols = Math.floor(w / 26);
      const rows = Math.floor(h / 34);
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++)
          if (Math.random() < 0.1) ctx.fillRect(x + 8 + i * 26, 360 - h + 12 + j * 34, 7, 10);
      x += w + R(4, 40);
    }
  });

  // ---------- 近景废墟（更暗更高，视差层） ----------
  canvasTex('ruins-near', 1024, 260, (ctx) => {
    let x = 0;
    while (x < 1024) {
      const w = R(90, 190);
      const h = R(70, 230);
      ctx.fillStyle = '#272c3b';
      ctx.beginPath();
      ctx.moveTo(x, 260);
      ctx.lineTo(x, 260 - h);
      let tx = x;
      let ty = 260 - h;
      while (tx < x + w - 14) {
        tx = Math.min(tx + R(16, 40), x + w);
        ty = 260 - h + R(0, 44);
        ctx.lineTo(tx, ty);
      }
      ctx.lineTo(x + w, 260);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(150,96,52,0.55)';
      const cols = Math.floor(w / 30);
      const rows = Math.floor(h / 40);
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++)
          if (Math.random() < 0.06) ctx.fillRect(x + 10 + i * 30, 260 - h + 14 + j * 40, 8, 11);
      x += w + R(10, 70);
    }
    // 瓦砾堆
    ctx.fillStyle = '#20242f';
    for (let i = 0; i < 14; i++) {
      const rx = R(0, 1024);
      const rr = R(18, 60);
      ctx.beginPath();
      ctx.arc(rx, 262, rr, Math.PI, 0);
      ctx.fill();
    }
  });

  // ---------- 泥土地块 ----------
  canvasTex('dirt', 64, 64, (ctx) => {
    ctx.fillStyle = '#66492e';
    ctx.fillRect(0, 0, 64, 64);
    const cols = ['#5a3e26', '#735536', '#4c3420', '#7d5c3b'];
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 110; i++) {
      ctx.fillStyle = cols[R(0, 3)];
      ctx.fillRect(R(0, 62), R(6, 60), R(2, 5), R(2, 4));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#7f5f3e';
    ctx.fillRect(0, 0, 64, 7);
    ctx.fillStyle = '#93704b';
    ctx.fillRect(0, 0, 64, 2);
    ctx.fillStyle = 'rgba(120,120,125,0.5)';
    for (let i = 0; i < 6; i++) ctx.fillRect(R(0, 60), R(8, 56), 3, 3);
  });

  // ---------- 尖刺 ----------
  canvasTex('spike', 32, 28, (ctx) => {
    ctx.fillStyle = '#33373d';
    ctx.fillRect(0, 22, 32, 6);
    ctx.fillStyle = '#7e858d';
    for (const ox of [0, 16]) {
      ctx.beginPath();
      ctx.moveTo(ox + 1, 22);
      ctx.lineTo(ox + 8, 3);
      ctx.lineTo(ox + 15, 22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#aab1b9';
    ctx.fillRect(7, 6, 2, 10);
    ctx.fillRect(23, 6, 2, 10);
  });

  // ---------- 柔和圆形粒子（烟/尘/云） ----------
  canvasTex('smokeP', 48, 48, (ctx) => {
    const g = ctx.createRadialGradient(24, 24, 2, 24, 24, 22);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(24, 24, 24, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTex('haze', 160, 80, (ctx) => {
    ctx.save();
    ctx.translate(80, 40);
    ctx.scale(1.8, 0.9);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ---------- 玩家车体（苏联绿，朝右） ----------
  gfxTex('pHull', 92, 40, (g) => {
    g.fillStyle(0x2f3338);
    g.fillRect(0, 25, 92, 15); // 履带
    g.fillStyle(0x454b52);
    for (let i = 0; i < 7; i++) g.fillCircle(10 + i * 12, 32.5, 4.2);
    g.fillStyle(0x55703f);
    g.fillPoints([{ x: 4, y: 25 }, { x: 14, y: 8 }, { x: 76, y: 8 }, { x: 90, y: 25 }], true);
    g.fillStyle(0x617e49);
    g.fillRect(16, 11, 58, 6);
    g.fillStyle(0x445e33);
    g.fillCircle(46, 9, 5); // 舱盖
    g.fillStyle(0x3a4f2c);
    g.fillRect(2, 12, 8, 8); // 排气口
  });

  // ---------- 玩家炮塔：粗炮管 + KV44 式大眼睛（朝右） ----------
  gfxTex('pTurret', 64, 44, (g) => {
    g.fillStyle(0x42552d);
    g.fillRect(16, 18, 40, 8); // 炮管
    g.fillStyle(0x33451f);
    g.fillRect(52, 15, 8, 14); // 炮口制退器
    g.lineStyle(2, 0x2f3f1e);
    g.strokeCircle(17, 22, 13.5);
    g.fillStyle(0x5d7c46);
    g.fillCircle(17, 22, 13); // 圆顶
    g.fillStyle(0x6b8b52);
    g.fillCircle(17, 22, 9);
    // 眼睛（正面朝 +x）
    g.fillStyle(0xf3efe2);
    g.fillEllipse(27, 17, 9, 11);
    g.fillEllipse(27, 27, 9, 11);
    g.fillStyle(0x14161a);
    g.fillEllipse(29, 17, 4, 5);
    g.fillEllipse(29, 27, 4, 5);
    // 眉毛（严肃脸）
    g.lineStyle(2, 0x2c3a1f);
    g.beginPath();
    g.moveTo(23, 10);
    g.lineTo(31, 13);
    g.strokePath();
    g.beginPath();
    g.moveTo(23, 34);
    g.lineTo(31, 31);
    g.strokePath();
  });

  // ---------- 敌方车体（德国灰，朝右） ----------
  gfxTex('eHull', 88, 38, (g) => {
    g.fillStyle(0x272b30);
    g.fillRect(0, 24, 88, 14);
    g.fillStyle(0x3d434b);
    for (let i = 0; i < 7; i++) g.fillCircle(10 + i * 11, 31, 4);
    g.fillStyle(0x596069);
    g.fillPoints([{ x: 4, y: 24 }, { x: 14, y: 8 }, { x: 72, y: 8 }, { x: 86, y: 24 }], true);
    g.fillStyle(0x666d76);
    g.fillRect(15, 11, 54, 5);
    g.lineStyle(2, 0xd9d9d9);
    g.strokeRect(38, 11, 12, 9); // 铁十字识别标
  });

  // ---------- 敌方炮塔：红瞳怒眼 ----------
  gfxTex('eTurret', 56, 40, (g) => {
    g.fillStyle(0x3c4148);
    g.fillRect(15, 17, 36, 6);
    g.fillStyle(0x2e3238);
    g.fillRect(48, 14, 7, 12);
    g.lineStyle(2, 0x24272c);
    g.strokeCircle(16, 20, 12.5);
    g.fillStyle(0x666d76);
    g.fillCircle(16, 20, 12);
    g.fillStyle(0x737a84);
    g.fillCircle(16, 20, 8);
    g.fillStyle(0xe8e4da);
    g.fillEllipse(24, 15, 8, 10);
    g.fillEllipse(24, 25, 8, 10);
    g.fillStyle(0x8e1f1f);
    g.fillEllipse(22, 15, 3.5, 4.5);
    g.fillEllipse(22, 25, 3.5, 4.5);
    g.lineStyle(2, 0x1f2226);
    g.beginPath();
    g.moveTo(20, 8);
    g.lineTo(28, 11);
    g.strokePath();
    g.beginPath();
    g.moveTo(20, 32);
    g.lineTo(28, 29);
    g.strokePath();
  });

  // ---------- 士兵 ----------
  canvasTex('soldier', 18, 28, (ctx) => {
    ctx.fillStyle = '#6e6146';
    ctx.fillRect(4, 9, 10, 13); // 大衣
    ctx.fillStyle = '#4c4335';
    ctx.fillRect(5, 22, 3, 6);
    ctx.fillRect(10, 22, 3, 6);
    ctx.fillStyle = '#565b62';
    ctx.beginPath();
    ctx.arc(9, 6, 6.4, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(2, 6, 14, 2); // 钢盔
    ctx.fillStyle = '#c9a077';
    ctx.fillRect(7, 8, 5, 3); // 脸
    ctx.fillStyle = '#2b2e33';
    ctx.fillRect(9, 14, 9, 2); // 步枪
  });

  // ---------- 碉堡（炮口朝左，射击孔里有红眼） ----------
  gfxTex('bunker', 96, 76, (g) => {
    g.fillStyle(0x3c4148);
    g.fillRect(6, 36, 30, 8);
    g.fillStyle(0x2b2f35);
    g.fillRect(0, 33, 8, 14);
    g.fillStyle(0x565c64);
    g.fillRoundedRect(6, 20, 84, 56, 8);
    g.fillStyle(0x494f57);
    g.fillRect(2, 12, 88, 12);
    g.fillStyle(0x101317);
    g.fillRect(34, 30, 22, 12);
    g.fillStyle(0xff5b4d);
    g.fillCircle(41, 36, 2);
    g.fillCircle(49, 36, 2);
    g.fillStyle(0x6d747d);
    for (const [rx, ry] of [
      [14, 26],
      [78, 26],
      [14, 66],
      [78, 66],
    ])
      g.fillCircle(rx, ry, 2.5);
  });

  // ---------- 终点旗 ----------
  gfxTex('flag', 40, 110, (g) => {
    g.fillStyle(0x8a8f96);
    g.fillRect(18, 0, 4, 104);
    g.fillStyle(0x5a4a38);
    g.fillRect(8, 100, 24, 10);
    g.fillStyle(0xbf3b30);
    g.fillPoints([{ x: 22, y: 4 }, { x: 38, y: 12 }, { x: 22, y: 22 }], true);
    g.fillStyle(0x8f2b22);
    g.fillPoints([{ x: 22, y: 12 }, { x: 30, y: 16 }, { x: 22, y: 20 }], true);
  });

  // ---------- 修理箱 ----------
  gfxTex('crate', 34, 30, (g) => {
    g.fillStyle(0x7a4f28);
    g.fillRect(0, 0, 34, 30);
    g.fillStyle(0x5f3c1e);
    g.fillRect(0, 9, 34, 3);
    g.fillRect(0, 19, 34, 3);
    g.lineStyle(3, 0x5f3c1e);
    g.strokeRect(1.5, 1.5, 31, 27);
    g.fillStyle(0xf0ece2);
    g.fillRect(15, 5, 4, 20);
    g.fillRect(7, 13, 20, 4);
  });

  // ---------- 弹药与特效 ----------
  gfxTex('shellP', 18, 8, (g) => {
    g.fillStyle(0xffb020);
    g.fillRect(2, 2, 14, 4);
    g.fillStyle(0xfff3b0);
    g.fillRect(12, 3, 5, 2);
    g.fillStyle(0xff7b1a);
    g.fillRect(0, 3, 3, 2);
  });

  gfxTex('shellE', 14, 6, (g) => {
    g.fillStyle(0xd94f3d);
    g.fillRect(2, 1, 10, 4);
    g.fillStyle(0xffb199);
    g.fillRect(10, 2, 4, 2);
  });

  gfxTex('bulletS', 8, 4, (g) => {
    g.fillStyle(0xffe08a);
    g.fillRect(0, 1, 8, 2);
  });

  gfxTex('spark', 8, 8, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
  });

  gfxTex('ring', 64, 64, (g) => {
    g.lineStyle(5, 0xffffff, 1);
    g.strokeCircle(32, 32, 27);
  });

  gfxTex('flash', 44, 30, (g) => {
    g.fillStyle(0xffd23f, 0.9);
    g.fillEllipse(18, 15, 36, 18);
    g.fillStyle(0xfff8dc, 1);
    g.fillEllipse(16, 15, 20, 10);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(14, 15, 9, 6);
  });

  // ---------- 触屏控件（半透明，不遮挡战场） ----------
  gfxTex('joyBase', 132, 132, (g) => {
    g.fillStyle(0xffffff, 0.06);
    g.fillCircle(66, 66, 64);
    g.lineStyle(3, 0xffffff, 0.22);
    g.strokeCircle(66, 66, 60);
    g.fillStyle(0xffffff, 0.15);
    g.fillCircle(66, 66, 8);
  });

  gfxTex('joyKnob', 72, 72, (g) => {
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(36, 36, 34);
    g.lineStyle(3, 0xffffff, 0.45);
    g.strokeCircle(36, 36, 30);
  });

  gfxTex('btnJump', 104, 104, (g) => {
    g.fillStyle(0x0e1420, 0.45);
    g.fillCircle(52, 52, 50);
    g.lineStyle(3, 0x8ce99a, 0.9);
    g.strokeCircle(52, 52, 47);
    g.fillStyle(0x8ce99a, 0.95);
    g.fillPoints([{ x: 52, y: 22 }, { x: 74, y: 52 }, { x: 30, y: 52 }], true);
    g.fillRect(44, 48, 16, 26);
  });

  gfxTex('btnPause', 64, 64, (g) => {
    g.fillStyle(0x0e1420, 0.45);
    g.fillCircle(32, 32, 30);
    g.fillStyle(0xe8e4d8, 0.9);
    g.fillRoundedRect(22, 18, 8, 28, 3);
    g.fillRoundedRect(34, 18, 8, 28, 3);
  });

  gfxTex('btnFire', 116, 116, (g) => {
    g.fillStyle(0x0e1420, 0.45);
    g.fillCircle(58, 58, 56);
    g.lineStyle(3, 0xff6b4a, 0.9);
    g.strokeCircle(58, 58, 53);
    g.lineStyle(2, 0xffa94d, 0.75);
    g.strokeCircle(58, 58, 26);
    g.fillStyle(0xff6b4a, 0.95);
    g.fillRect(56, 16, 4, 12);
    g.fillRect(56, 88, 4, 12);
    g.fillRect(16, 56, 12, 4);
    g.fillRect(88, 56, 12, 4);
    g.fillStyle(0xff8787, 0.95);
    g.fillCircle(58, 58, 9);
  });
}
