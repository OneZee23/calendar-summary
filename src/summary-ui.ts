/**
 * UI component for displaying calendar summary
 */

import { ActivitySummary } from './types';

/**
 * Service for managing the summary UI overlay
 */
export class SummaryUI {
  private overlay: HTMLElement | null = null;
  private readonly OVERLAY_ID = 'calendar-summary-overlay';
  private readonly ERROR_OVERLAY_ID = 'calendar-summary-error-overlay';

  /**
   * Shows error message when not on correct page
   */
  public showErrorPage(): void {
    this.hideSummary();
    this.hideError();

    const overlay = document.createElement('div');
    overlay.id = this.ERROR_OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 24px;
      text-align: center;
      padding: 20px;
      box-sizing: border-box;
    `;

    overlay.innerHTML = `
      <div>
        <h1 style="margin: 0 0 20px 0; font-size: 32px;">Incorrect Page</h1>
        <p style="margin: 0; line-height: 1.6;">
          Please navigate to Google Calendar and select the week view (or any calendar view) 
          starting from the day you need.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  /**
   * Shows summary of activities
   */
  public showSummary(summaries: ActivitySummary[], dateRange: { start: Date; end: Date } | null): void {
    this.hideError();
    this.hideSummary();

    const overlay = document.createElement('div');
    overlay.id = this.OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 20px;
      z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    const dateRangeText = dateRange
      ? this.formatDateRange(dateRange.start, dateRange.end)
      : 'Current view';

    overlay.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #333;">
          Calendar Summary
        </h2>
        <p style="margin: 0; font-size: 12px; color: #666;">
          ${dateRangeText}
        </p>
      </div>
      <div>
        ${this.renderSummaryList(summaries)}
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  /**
   * Renders the list of activity summaries
   */
  private renderSummaryList(summaries: ActivitySummary[]): string {
    if (summaries.length === 0) {
      return '<p style="color: #999; margin: 0;">No activities found</p>';
    }

    const items = summaries.map(summary => `
      <div style="
        padding: 12px;
        margin-bottom: 8px;
        background: #f5f5f5;
        border-radius: 6px;
        border-left: 3px solid #4285f4;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        ">
          <span style="font-weight: 500; color: #333;">${this.escapeHtml(summary.name)}</span>
          <span style="font-weight: 600; color: #4285f4;">${summary.formattedDuration}</span>
        </div>
        <div style="font-size: 12px; color: #666;">
          ${summary.count} occurrence${summary.count !== 1 ? 's' : ''}
        </div>
      </div>
    `).join('');

    const totalMinutes = summaries.reduce((sum, s) => sum + s.totalMinutes, 0);
    const totalFormatted = this.formatDuration(totalMinutes);

    return `
      ${items}
      <div style="
        margin-top: 16px;
        padding-top: 16px;
        border-top: 2px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span style="font-weight: 600; color: #333;">Total</span>
        <span style="font-weight: 700; color: #4285f4; font-size: 18px;">${totalFormatted}</span>
      </div>
    `;
  }

  /**
   * Formats date range for display
   */
  private formatDateRange(start: Date, end: Date): string {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }

  /**
   * Formats duration in minutes to human-readable string
   */
  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins}m`;
    }
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  }

  /**
   * Escapes HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Hides the summary overlay
   */
  public hideSummary(): void {
    const existing = document.getElementById(this.OVERLAY_ID);
    if (existing) {
      existing.remove();
    }
    this.overlay = null;
  }

  /**
   * Hides the error overlay
   */
  public hideError(): void {
    const existing = document.getElementById(this.ERROR_OVERLAY_ID);
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Updates the summary if overlay exists
   */
  public updateSummary(summaries: ActivitySummary[], dateRange: { start: Date; end: Date } | null): void {
    if (this.overlay) {
      this.showSummary(summaries, dateRange);
    }
  }
}

