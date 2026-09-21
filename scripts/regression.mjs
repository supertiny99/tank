// 回归：1) 平射 2) 朝下猛瞄（之前出膛即爆） 3) 敌方新弹道
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5174/');
await page.waitForTimeout(1800);
await page.mouse.click(640, 360); // 进游戏
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  window.__count = { playerShells: 0, impacts: [] };
  const op = s.spawnPlayerShell.bind(s);
  s.spawnPlayerShell = (x, y, a) => {
    window.__count.playerShells++;
    window.__count.lastSpawn = { x: Math.round(x), y: Math.round(y), a: +a.toFixed(2) };
    return op(x, y, a);
  };
  // 记录玩家炮弹的落点（爆炸位置）
  const ob = s.explode.bind(s);
  s.explode = (x, y, o) => {
    if (o && o.hitsEnemies) window.__count.impacts.push({ x: Math.round(x), y: Math.round(y) });
    return ob(x, y, o);
  };
  window.__count.enemy = [];
  const oe = s.spawnEnemyShell.bind(s);
  s.spawnEnemyShell = (x, y, vx, vy, g) => {
    window.__count.enemy.push({ x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy), g });
    return oe(x, y, vx, vy, g);
  };
});

// ---- 场景 1：朝下猛瞄（鼠标放在玩家脚边右下方），按住 1.5s ----
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  s.player.setPosition(400, 540);
  s.cameras.main.centerOn(400, 420);
});
await page.waitForTimeout(300);
await page.mouse.move(560, 700); // 相对玩家在右下方约 40° 俯角
await page.mouse.down();
await page.waitForTimeout(1500);
const downAim = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  const p = s.player;
  const impacts = window.__count.impacts;
  const near = impacts.filter((i) => Math.abs(i.x - p.x) < 90 && i.y > 500);
  return {
    spawned: window.__count.playerShells,
    lastSpawn: window.__count.lastSpawn,
    turretAngle: +p.turret.rotation.toFixed(2),
    impacts,
    footExplosions: near.length, // 出膛即爆的次数（应很少/0，因为俯角被限制 32°）
  };
});
await page.mouse.up();
await page.evaluate(() => { window.__count.playerShells = 0; window.__count.impacts = []; });

// ---- 场景 2：平射正常 ----
await page.mouse.move(860, 380);
await page.mouse.down();
await page.waitForTimeout(800);
const levelAim = await page.evaluate(() => ({ spawned: window.__count.playerShells }));
await page.mouse.up();

// ---- 场景 3：敌方弹道（传送到 1 号坦克面前） ----
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  s.player.setPosition(1060, 520);
  s.cameras.main.centerOn(1060, 400);
});
await page.waitForTimeout(4000);
const enemy = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  const e = window.__count.enemy;
  const tankShots = e.filter((x) => x.y > 480); // 坦克（碉堡在高台上 y~425）
  return {
    allShots: e,
    tankShots,
    playerHp: s.player.hp,
    playerX: Math.round(s.player.x),
  };
});

console.log(JSON.stringify({ downAim, levelAim, enemy, errors }, null, 2));
await browser.close();
