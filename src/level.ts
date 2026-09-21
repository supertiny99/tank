// 关卡与世界数据（数据驱动，后续关卡扩展改这里）
export const WORLD_W = 5200;
export const VIEW_H = 720;
export const GRAVITY = 1400;

export interface SegDef {
  x: number; // 左边缘
  w: number; // 宽度
  top: number; // 顶面 y（坦克踩在上面）
  tint?: number;
}

// 地形段：普通地面 / 尖刺坑底(深色) / 高台(灰色 tint)
export const SEGS: SegDef[] = [
  { x: 0, w: 800, top: 560 },
  { x: 800, w: 120, top: 660 },
  { x: 920, w: 680, top: 560 },
  { x: 1160, w: 140, top: 464, tint: 0xb8b0a4 },
  { x: 1600, w: 800, top: 560 },
  { x: 2400, w: 120, top: 660 },
  { x: 2520, w: 880, top: 560 },
  { x: 2980, w: 160, top: 464, tint: 0xb8b0a4 },
  { x: 3400, w: 800, top: 560 },
  { x: 4200, w: 140, top: 660 },
  { x: 4340, w: 860, top: 560 },
];

export interface SpikeDef {
  x: number;
  w: number;
}
export const SPIKES: SpikeDef[] = [
  { x: 806, w: 108 },
  { x: 2406, w: 108 },
  { x: 4206, w: 128 },
];

export interface TankDef {
  x: number;
  min: number;
  max: number;
}
export const TANKS: TankDef[] = [
  { x: 1300, min: 950, max: 1140 },
  { x: 2200, min: 1650, max: 2370 },
  { x: 3640, min: 3430, max: 4170 },
  { x: 4720, min: 4370, max: 5130 },
];

export const SOLDIERS: number[] = [620, 760, 1750, 1860, 1960, 2680, 3760, 3910, 4070, 4540];

export interface BunkerDef {
  x: number;
}
export const BUNKERS: BunkerDef[] = [{ x: 1230 }, { x: 3060 }];

export const CRATES: number[] = [1660, 4380];
export const FLAG_X = 5040;
export const PLAYER_START = { x: 120, y: 500 };
