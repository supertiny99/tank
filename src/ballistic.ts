import Phaser from 'phaser';

/**
 * 抛物线解算：以 speed 从 (x0,y0) 打到 (x1,y1)，重力 g（向下为正）。
 * errFrac 为随机误差比例，让敌人打得不那么准。
 * 返回初速度，无法解算返回 null。
 */
export function ballistic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  g: number,
  speed: number,
  errFrac = 0,
): { vx: number; vy: number } | null {
  const e = Phaser.Math.FloatBetween(-errFrac, errFrac);
  const dx = (x1 - x0) * (1 + e);
  const dy = (y1 - y0) * (1 + e);
  const d = Math.hypot(dx, dy);
  if (d < 1) return null;
  const t = d / speed;
  if (t <= 0.02) return null;
  return { vx: dx / t, vy: dy / t - 0.5 * g * t };
}
