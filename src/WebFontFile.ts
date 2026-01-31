import Phaser from 'phaser';
import WebFont from 'webfontloader';

export class WebFontFile extends Phaser.Loader.File {
  private fontNames: string[];

  constructor(loader: Phaser.Loader.LoaderPlugin, fontNames: string | string[]) {
    super(loader, {
      type: 'webfont',
      key: Array.isArray(fontNames) ? fontNames.join(',') : fontNames,
    });
    this.fontNames = Array.isArray(fontNames) ? fontNames : [fontNames];
  }

  load(): void {
    WebFont.load({
      google: {
        families: this.fontNames,
      },
      active: () => {
        this.loader.nextFile(this, true);
      },
      inactive: () => {
        console.warn('Failed to load fonts:', this.fontNames);
        this.loader.nextFile(this, false);
      },
    });
  }
}
