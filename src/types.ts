import type { PlayerTank } from './entities/PlayerTank';

// 所有敌人（坦克/碉堡/士兵）满足的通用接口，方便 GameScene 统一驱动
export interface IEnemy {
  active: boolean;
  x: number;
  y: number;
  control(player: PlayerTank, dt: number): void;
  takeDamage(n: number): void;
}
