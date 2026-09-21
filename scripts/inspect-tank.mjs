// 深挖：敌坦克为何不开火 + 截图观察弹道
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5174/');
await page.waitForTimeout(1800);
await page.mouse.click(640, 360);
await page.waitForTimeout(1500);

// 传送到 1 号敌坦克面前
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  window.__count = { enemyShells: [] };
  const oe = s.spawnEnemyShell.bind(s);
  s.spawnEnemyShell = (x, y, vx, vy) => {
    window.__count.enemyShells.push({ x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy) });
    return oe(x, y, vx, vy);
  };
  s.player.setPosition(1060, 520);
  s.cameras.main.centerOn(1060, 400);
});
await page.waitForTimeout(2600);

// 敌坦克详细状态
const tankState = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  const t = s.enemyList.find((e) => e.constructor.name === 'EnemyTank');
  return {
    found: !!t,
    x: t && Math.round(t.x),
    y: t && Math.round(t.y),
    hp: t && t.hp,
    active: t && t.active,
    hasBody: t && !!t.body,
    bodyEnabled: t && t.body && t.body.enabled,
    bodyVelocity: t && t.body && [Math.round(t.body.velocity.x), Math.round(t.body.velocity.y)],
    turretRot: t && t.turret && Math.round(t.turret.rotation * 100) / 100,
    turretFlipY: t && t.turret && t.turret.flipY,
    playerPos: { x: Math.round(s.player.x), y: Math.round(s.player.y) },
    enemyShells: window.__count.enemyShells,
  };
});
await page.screenshot({ path: 'scripts/shot-battle.png' });

console.log(JSON.stringify({ tankState, errors }, null, 2));
await browser.close();
