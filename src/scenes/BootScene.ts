import Phaser from 'phaser';
import { createTextures } from '../textureFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    createTextures(this);
    this.scene.start('menu');
  }
}
