// 触摸模拟测试（合成 TouchEvent）：验证摇杆移动、瞄准开火、双摇杆、跳跃
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5174/');
await page.waitForTimeout(1800);

// 注入触摸事件工具
await page.evaluate(() => {
  window.__touch = (type, points) => {
    const cv = document.querySelector('canvas');
    const mk = (p) =>
      new Touch({
        identifier: p.id, target: cv, clientX: p.x, clientY: p.y,
        pageX: p.x, pageY: p.y, screenX: p.x, screenY: p.y,
        radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1,
      });
    const touches = points.map(mk);
    cv.dispatchEvent(
      new TouchEvent(type, { cancelable: true, bubbles: true, touches, changedTouches: touches }),
    );
  };
});

// 触摸点菜单进入游戏
await page.evaluate(() => window.__touch('touchstart', [{ id: 1, x: 640, y: 360 }]));
await page.evaluate(() => window.__touch('touchend', [{ id: 1, x: 640, y: 360 }]));
await page.waitForTimeout(1500);

const env = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return { sceneReady: !!(s && s.player), touchEnabled: s.touch.enabled };
});
if (!env.sceneReady) {
  console.log(JSON.stringify({ fail: 'scene not ready', errors, env }, null, 2));
  await browser.close();
  process.exit(1);
}

await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  window.__count = { playerShells: 0 };
  const op = s.spawnPlayerShell.bind(s);
  s.spawnPlayerShell = (...a) => { window.__count.playerShells++; return op(...a); };
});

const D = (t, pts) => page.evaluate(({ t, pts }) => window.__touch(t, pts), { t, pts });

// 1) 左摇杆按住向右推
const x0 = await page.evaluate(() => Math.round(window.__game.scene.getScene('game').player.x));
await D('touchstart', [{ id: 11, x: 220, y: 600 }]);
await D('touchmove', [{ id: 11, x: 300, y: 600 }]);
await page.waitForTimeout(900);
const moveResult = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return {
    state: { moveX: +s.touch.state.moveX.toFixed(2), jump: s.touch.state.jump, aimAngle: s.touch.state.aimAngle, firing: s.touch.state.firing },
    playerX: Math.round(s.player.x),
  };
});
await D('touchend', [{ id: 11, x: 300, y: 600 }]);

// 2) 右摇杆推向右上：应瞄准并自动开火
await page.waitForTimeout(250);
await D('touchstart', [{ id: 22, x: 1000, y: 600 }]);
for (let i = 1; i <= 6; i++) {
  await D('touchmove', [{ id: 22, x: 1000 + i * 18, y: 600 - i * 16 }]);
  await page.waitForTimeout(40);
}
await page.waitForTimeout(1400);
const fireResult = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return {
    state: { moveX: +s.touch.state.moveX.toFixed(2), aimAngle: s.touch.state.aimAngle === null ? null : +s.touch.state.aimAngle.toFixed(2), firing: s.touch.state.firing },
    playerShells: window.__count.playerShells,
    turretAngle: +s.player.turret.rotation.toFixed(2),
  };
});
await D('touchend', [{ id: 22, x: 1108, y: 504 }]);

// 3) 双摇杆同持：左移动 + 右开火
await page.waitForTimeout(250);
await page.evaluate(() => { window.__count.playerShells = 0; });
await D('touchstart', [{ id: 31, x: 220, y: 600 }]);
await D('touchmove', [{ id: 31, x: 300, y: 600 }]);
await D('touchstart', [{ id: 32, x: 1000, y: 600 }]);
await D('touchmove', [{ id: 32, x: 1064, y: 542 }]);
await page.waitForTimeout(1200);
const dualResult = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return {
    state: { moveX: +s.touch.state.moveX.toFixed(2), firing: s.touch.state.firing },
    playerShells: window.__count.playerShells,
    playerX: Math.round(s.player.x),
  };
});
await D('touchend', [{ id: 31, x: 300, y: 600 }]);
await D('touchend', [{ id: 32, x: 1064, y: 542 }]);

// 4) 跳跃按钮
await page.waitForTimeout(350);
await D('touchstart', [{ id: 33, x: 640, y: 656 }]);
await page.waitForTimeout(350);
const jumpResult = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return { jumpState: s.touch.state.jump, playerY: Math.round(s.player.y) };
});
await D('touchend', [{ id: 33, x: 640, y: 656 }]);

console.log(JSON.stringify({ env, x0, moveResult, fireResult, dualResult, jumpResult, errors }, null, 2));
await browser.close();
