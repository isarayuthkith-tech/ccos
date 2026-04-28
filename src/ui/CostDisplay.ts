import { useCostTracker, type GenerationCost } from '@core';

export class CostDisplay extends HTMLElement {
  private shadow: ShadowRoot;
  private tracker = useCostTracker();

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  update(): void {
    this.render();
  }

  private formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${cost.toFixed(4)}`;
    }
    return `$${cost.toFixed(2)}`;
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}k`;
    }
    return tokens.toString();
  }

  private render(): void {
    const totalCost = this.tracker.getTotalCost();
    const history = this.tracker.getHistory();
    const lastEntry = history[history.length - 1];

    const styles = `
      :host {
        display: block;
        font-family: 'DM Mono', monospace;
        font-size: 12px;
      }
      .cost-container {
        background: #1a1a2e;
        color: #eaeaea;
        padding: 12px 16px;
        border-radius: 8px;
      }
      .cost-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .cost-total {
        font-size: 18px;
        font-weight: bold;
        color: #4caf50;
      }
      .cost-breakdown {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        font-size: 11px;
        color: #888;
      }
      .cost-item {
        display: flex;
        justify-content: space-between;
      }
      .cost-value {
        color: #eaeaea;
      }
      .last-generation {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #333;
        font-size: 11px;
      }
    `;

    const costByStep = this.tracker.getCostByStep();
    const breakdownHtml = Object.entries(costByStep)
      .map(([step, cost]) => `
        <div class="cost-item">
          <span>${step}:</span>
          <span class="cost-value">${this.formatCost(cost)}</span>
        </div>
      `).join('');

    const lastGenHtml = lastEntry ? `
      <div class="last-generation">
        Last: ${lastEntry.step} - ${this.formatTokens(lastEntry.tokens.totalTokens)} tokens - ${this.formatCost(lastEntry.estimatedCost)}
      </div>
    ` : '';

    this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="cost-container">
        <div class="cost-header">
          <span>Estimated Cost</span>
          <span class="cost-total">${this.formatCost(totalCost)}</span>
        </div>
        <div class="cost-breakdown">
          ${breakdownHtml}
        </div>
        ${lastGenHtml}
      </div>
    `;
  }
}

customElements.define('cost-display', CostDisplay);
