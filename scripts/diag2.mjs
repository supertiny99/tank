// 专项诊断：俯角限制效果 + 敌坦克开火状态追踪
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5174/');
await page.waitForTimeout(1800);
await page.mouse.click(640, 360);
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  window.__count = { playerShells: 0, impacts: [], enemy: [] };
  const op = s.spawnPlayerShell.bind(s);
  s.spawnPlayerShell = (x, y, a) => { window.__count.playerShells++; return op(x, y, a); };
  const ob = s.explode.bind(s);
  s.explode = (x, y, o) => {
    if (o && o.hitsEnemies) window.__count.impacts.push({ x: Math.round(x), y: Math.round(y) });
    return ob(x, y, o);
  };
  const oe = s.spawnEnemyShell.bind(s);
  s.spawnEnemyShell = (x, y, vx, vy, g) => {
    window.__count.enemy.push({ x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy), g });
    return oe(x, y, vx, vy, g);
  };
});

// 场景 1：站在平地朝下猛瞄（应该被动态限角）
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  s.player.setPosition(400, 540);
  s.cameras.main.centerOn(400, 420);
});
await page.waitForTimeout(300);
await page.mouse.move(560, 700);
await page.mouse.down();
await page.waitForTimeout(1500);
await page.mouse.up();
const downAim = await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  const p = s.player;
  return {
    spawned: window.__count.playerShells,
    turretAngle: +p.turret.rotation.toFixed(2),
    turretAngleDeg: Math.round((p.turret.rotation * 180) / Math.PI),
    impacts: window.__count.impacts,
    atMuzzlePops: window.__count.impacts.filter((i) => Math.abs(i.x - p.x) < 40).length,
  };
});

// 场景 2：敌方坦克开火追踪（每 0.5s 采样坦克状态）
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  s.player.setPosition(1060, 520);
  s.cameras.main.centerOn(1060, 400);
});
const tankTrace = [];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => {
    const s = window.__game.scene.getScene('game');
    const t = s.enemyList.find((e) => e.constructor.name === 'EnemyTank');
    return t
      ? {
          x: Math.round(t.x), y: Math.round(t.y), hp: t.hp,
          turret: +t.turret.rotation.toFixed(2),
          enemyShotsSoFar: window.__count.enemy.length,
          playerHp: s.player.hp,
        }
      : null;
  });
  tankTrace.push(st);
}
const finalEnemy = await page.evaluate(() => ({
  shots: window.__count.enemy,
  playerHp: window.__game.scene.getScene('game').player.hp,
}));

console.log(JSON.stringify({ downAim, tankTrace, finalEnemy, errors }, null, 2));
await browser.close();
