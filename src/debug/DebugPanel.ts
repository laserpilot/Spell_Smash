import { runtimeConfig, resetRuntimeConfig } from '../RuntimeConfig';

interface SliderDef {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  decimals: number;
}

export class DebugPanel {
  private container: HTMLDivElement;
  private visible = false;
  private valueDisplays: Map<string, HTMLSpanElement> = new Map();
  private sliderInputs: Map<string, HTMLInputElement> = new Map();
  private onRebuild: (() => void) | null;

  constructor(onRebuild?: () => void) {
    this.onRebuild = onRebuild ?? null;
    this.container = this.buildDOM();
    document.body.appendChild(this.container);
    this.hide();

    window.addEventListener('keydown', (e) => {
      if (e.key === '`') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  private defineSliders(): SliderDef[] {
    return [
      {
        label: 'Launch Angle (deg)',
        min: 5, max: 70, step: 1, decimals: 0,
        get: () => runtimeConfig.launchAngle,
        set: (v) => { runtimeConfig.launchAngle = v; },
      },
      {
        label: 'Launch Force',
        min: 5, max: 30, step: 0.5, decimals: 1,
        get: () => runtimeConfig.launchForce,
        set: (v) => { runtimeConfig.launchForce = v; },
      },
      {
        label: 'Block Density',
        min: 0.001, max: 0.02, step: 0.001, decimals: 3,
        get: () => runtimeConfig.blockDensity,
        set: (v) => { runtimeConfig.blockDensity = v; },
      },
      {
        label: 'Block Friction',
        min: 0, max: 1, step: 0.05, decimals: 2,
        get: () => runtimeConfig.blockFriction,
        set: (v) => { runtimeConfig.blockFriction = v; },
      },
      {
        label: 'Block Restitution',
        min: 0, max: 1, step: 0.05, decimals: 2,
        get: () => runtimeConfig.restitution,
        set: (v) => { runtimeConfig.restitution = v; },
      },
      {
        label: 'Block Width',
        min: 20, max: 100, step: 5, decimals: 0,
        get: () => runtimeConfig.blockWidth,
        set: (v) => { runtimeConfig.blockWidth = v; },
      },
      {
        label: 'Block Height',
        min: 10, max: 60, step: 5, decimals: 0,
        get: () => runtimeConfig.blockHeight,
        set: (v) => { runtimeConfig.blockHeight = v; },
      },
      {
        label: 'Building Blocks',
        min: 4, max: 80, step: 1, decimals: 0,
        get: () => runtimeConfig.buildingBlockCount,
        set: (v) => { runtimeConfig.buildingBlockCount = v; },
      },
    ];
  }

  private buildDOM(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    Object.assign(panel.style, {
      position: 'absolute',
      top: '10px',
      right: '10px',
      width: '280px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '11px',
      padding: '12px',
      borderRadius: '8px',
      zIndex: '1000',
      maxHeight: '90vh',
      overflowY: 'auto',
      userSelect: 'none',
    });

    const title = document.createElement('div');
    title.textContent = 'Debug (` to toggle)';
    Object.assign(title.style, {
      fontSize: '13px',
      fontWeight: 'bold',
      marginBottom: '10px',
      color: '#ffd700',
    });
    panel.appendChild(title);

    const sliders = this.defineSliders();
    for (const def of sliders) {
      const row = this.createSliderRow(def);
      panel.appendChild(row);
    }

    // Buttons
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex',
      gap: '8px',
      marginTop: '12px',
    });

    const rebuildBtn = this.createButton('Rebuild Building', () => {
      this.onRebuild?.();
    });
    btnRow.appendChild(rebuildBtn);

    const resetBtn = this.createButton('Reset Defaults', () => {
      resetRuntimeConfig();
      this.refreshAllSliders();
      this.onRebuild?.();
    });
    btnRow.appendChild(resetBtn);

    panel.appendChild(btnRow);

    return panel;
  }

  private createSliderRow(def: SliderDef): HTMLDivElement {
    const row = document.createElement('div');
    Object.assign(row.style, { marginBottom: '8px' });

    const labelRow = document.createElement('div');
    Object.assign(labelRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '2px',
    });

    const label = document.createElement('span');
    label.textContent = def.label;
    label.style.color = '#ccc';

    const valueSpan = document.createElement('span');
    valueSpan.textContent = def.get().toFixed(def.decimals);
    valueSpan.style.color = '#64c4b8';
    this.valueDisplays.set(def.label, valueSpan);

    labelRow.appendChild(label);
    labelRow.appendChild(valueSpan);
    row.appendChild(labelRow);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(def.get());
    Object.assign(input.style, {
      width: '100%',
      height: '16px',
      cursor: 'pointer',
      accentColor: '#64c4b8',
    });

    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      def.set(val);
      valueSpan.textContent = val.toFixed(def.decimals);
    });

    // Prevent keyboard events from leaking to Phaser
    input.addEventListener('keydown', (e) => e.stopPropagation());
    input.addEventListener('keyup', (e) => e.stopPropagation());

    this.sliderInputs.set(def.label, input);
    row.appendChild(input);

    return row;
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      flex: '1',
      padding: '6px 8px',
      background: '#333',
      color: '#fff',
      border: '1px solid #555',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'monospace',
      fontSize: '11px',
    });
    btn.addEventListener('click', onClick);
    btn.addEventListener('keydown', (e) => e.stopPropagation());
    return btn;
  }

  private refreshAllSliders(): void {
    const sliders = this.defineSliders();
    for (const def of sliders) {
      const input = this.sliderInputs.get(def.label);
      const display = this.valueDisplays.get(def.label);
      if (input) input.value = String(def.get());
      if (display) display.textContent = def.get().toFixed(def.decimals);
    }
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'block';
    this.refreshAllSliders();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  destroy(): void {
    this.container.remove();
  }
}
