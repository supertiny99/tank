import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5174/');
await page.waitForTimeout(1800);
await page.mouse.click(640, 360);
await page.waitForTimeout(1400);
await page.evaluate(() => {
  const s = window.__game.scene.getScene('game');
  s.player.setPosition(2080, 540);
  s.cameras.main.centerOn(2140, 420);
});
// 向右瞄 2 号敌坦克并开炮，抓飞行瞬间
await page.mouse.move(1150, 430);
await page.mouse.down();
await page.waitForTimeout(280);
await page.screenshot({ path: 'scripts/shot-new-traj.png' });
await page.mouse.up();
await browser.close();
console.log('saved');
