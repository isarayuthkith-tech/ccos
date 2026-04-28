export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
}

export class ProgressTracker extends HTMLElement {
  private steps: ProgressStep[] = [];
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  static get observedAttributes() {
    return ['steps'];
  }

  setSteps(steps: ProgressStep[]): void {
    this.steps = steps;
    this.render();
  }

  updateStep(id: string, updates: Partial<ProgressStep>): void {
    const step = this.steps.find(s => s.id === id);
    if (step) {
      Object.assign(step, updates);
      this.render();
    }
  }

  private render(): void {
    const styles = `
      :host {
        display: block;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .progress-container {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px;
      }
      .step {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .step-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #e0e0e0;
        transition: all 0.3s ease;
      }
      .step-dot.running {
        background: #2196f3;
        animation: pulse 1.5s infinite;
      }
      .step-dot.completed {
        background: #4caf50;
      }
      .step-dot.failed {
        background: #f44336;
      }
      .step-label {
        font-size: 12px;
        color: #666;
        text-align: center;
      }
      .connector {
        flex: 1;
        height: 2px;
        background: #e0e0e0;
        margin: 0 8px;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;

    const stepsHtml = this.steps.map((step, index) => `
      <div class="step">
        <div class="step-dot ${step.status}"></div>
        <span class="step-label">${step.label}</span>
        ${step.detail ? `<span class="step-detail">${step.detail}</span>` : ''}
      </div>
      ${index < this.steps.length - 1 ? '<div class="connector"></div>' : ''}
    `).join('');

    this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="progress-container">
        ${stepsHtml}
      </div>
    `;
  }
}

customElements.define('progress-tracker', ProgressTracker);
