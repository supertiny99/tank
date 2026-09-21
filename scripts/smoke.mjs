// 无头浏览器冒烟测试：验证我方开炮与敌方弹道
// 用法: node scripts/smoke.mjs [url]   默认 http://localhost:5174/
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});

await page.goto(url);
await page.waitForTimeout(1800);

// 菜单 -> 战斗场景（真实鼠标点击）
await page.mouse.click(640, 360);
await page.waitForTimeout(1500);

const ready = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return !!(s && s.player);
});
if (!ready) {
  console.log(JSON.stringify({ fail: 'game scene not ready', errors }, null, 2));
  await browser.close();
  process.exit(1);
}

// 给生成函数装计数器
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  window.__count = { playerShells: 0, enemyShells: [], samples: [] };
  const op = s.spawnPlayerShell.bind(s);
  s.spawnPlayerShell = (...a) => { window.__count.playerShells++; return op(...a); };
  const oe = s.spawnEnemyShell.bind(s);
  s.spawnEnemyShell = (x, y, vx, vy) => {
    window.__count.enemyShells.push({ x, y, vx: Math.round(vx), vy: Math.round(vy), t: performance.now() });
    return oe(x, y, vx, vy);
  };
});

// ---- 测试 A：按住鼠标 1.8s，应连发 2~3 发 ----
await page.mouse.move(860, 380);
await page.mouse.down();
await page.waitForTimeout(1800);
const fireA = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return {
    spawned: window.__count.playerShells,
    liveShells: s.pShells.getChildren().length,
    pointerIsDown: s.input.activePointer.isDown,
    pointerWasTouch: s.input.activePointer.wasTouch,
    touchEnabled: s.touch.enabled,
    turretAngle: Math.round(s.player.turret.rotation * 100) / 100,
    playerX: Math.round(s.player.x),
  };
});
await page.mouse.up();

// ---- 测试 B：传送到 1 号敌坦克面前，采样其炮弹轨迹 ----
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  s.player.setPosition(1060, 520);
  s.cameras.main.centerOn(1060, 400);
});
// 等敌方开火（交战冷却 2.2~3.1s，初值随机）
await page.waitForTimeout(4200);
const samples = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  const shells = s.eShells.getChildren().map((sh) => ({
    x: Math.round(sh.x), y: Math.round(sh.y),
    vx: Math.round(sh.body.velocity.x), vy: Math.round(sh.body.velocity.y),
  }));
  return {
    enemyFired: window.__count.enemyShells,
    liveShells: shells,
    playerPos: { x: Math.round(s.player.x), y: Math.round(s.player.y) },
    playerHp: s.player.hp,
  };
});

// 再等 1.2s 看敌弹落点（是否接近玩家）
await page.waitForTimeout(1200);
const landing = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  return { playerHp: s.player.hp, playerX: Math.round(s.player.x) };
});

console.log(
  JSON.stringify({ fireA, samples, landing, errors }, null, 2),
);
await browser.close();
