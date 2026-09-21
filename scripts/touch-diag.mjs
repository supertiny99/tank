// 触摸事件诊断：看 Phaser 指针与 TouchController 入口参数
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5174/');
await page.waitForTimeout(1800);

await page.evaluate(() => {
  window.__touch = (type, points) => {
    const cv = document.querySelector('canvas');
    const mk = (p) =>
      new Touch({ identifier: p.id, target: cv, clientX: p.x, clientY: p.y, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1 });
    const touches = points.map(mk);
    cv.dispatchEvent(new TouchEvent(type, { cancelable: true, bubbles: true, touches, changedTouches: touches }));
  };
});
await page.evaluate(() => window.__touch('touchstart', [{ id: 1, x: 640, y: 360 }]));
await page.evaluate(() => window.__touch('touchend', [{ id: 1, x: 640, y: 360 }]));
await page.waitForTimeout(1500);

// 装 TouchController 入口日志
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  window.__log = [];
  const tc = s.touch;
  for (const m of ['handleDown', 'handleMove', 'handleUp']) {
    const orig = tc[m].bind(tc);
    tc[m] = (...a) => { window.__log.push(m + '(' + a.map(v => typeof v === 'number' ? Math.round(v * 10) / 10 : v).join(', ') + ')'); return orig(...a); };
  }
});

const D = (t, pts) => page.evaluate(({ t, pts }) => window.__touch(t, pts), { t, pts });

await D('touchstart', [{ id: 11, x: 220, y: 600 }]);
await page.waitForTimeout(200);
const afterDown = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  const pointers = [s.input.pointer1, s.input.pointer2, s.input.pointer3].map((p, i) => p ? { n: i + 1, id: p.id, x: Math.round(p.x), y: Math.round(p.y), isDown: p.isDown, wasTouch: p.wasTouch } : null);
  return { log: [...window.__log], pointers, state: { ...s.touch.state } };
});

await D('touchmove', [{ id: 11, x: 300, y: 600 }]);
await page.waitForTimeout(200);
const afterMove = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  const p1 = s.input.pointer1;
  return {
    log: [...window.__log],
    p1: p1 ? { id: p1.id, x: Math.round(p1.x), y: Math.round(p1.y), isDown: p1.isDown } : null,
    state: { moveX: +s.touch.state.moveX.toFixed(2) },
  };
});

await D('touchend', [{ id: 11, x: 300, y: 600 }]);
await page.waitForTimeout(200);
const afterUp = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return { log: [...window.__log], state: { moveX: +s.touch.state.moveX.toFixed(2) } };
});

console.log(JSON.stringify({ afterDown, afterMove, afterUp }, null, 2));
await browser.close();
