/**
 * Debug Panel Manager
 *
 * Handles debug panel display and system diagnostics.
 * Extracted from LightweightTerminalWebviewManager for better separation of concerns.
 */

import { TerminalState } from '../../types/shared';
import { webview as log } from '../../utils/logger';

interface DebugCounters {
  stateUpdates: number;
  lastSync: string;
  systemStartTime: number;
}

interface SystemStatusSnapshot {
  ready: boolean;
  state: TerminalState | null;
  pendingOperations: {
    deletions: string[];
    creations: number;
  };
}

export interface SystemDiagnostics {
  timestamp: string;
  systemStatus: SystemStatusSnapshot;
  performanceCounters: DebugCounters;
  configuration: {
    debugMode: boolean;
    maxTerminals: number | 'unknown';
  };
  extensionCommunication: {
    lastStateRequest: string;
    messageQueueStatus: string;
  };
  troubleshootingInfo: {
    userAgent: string;
    platform: string;
    language: string;
    cookieEnabled: boolean;
    onLine: boolean;
  };
}

interface DebugInfo {
  totalCount: number;
  maxTerminals: number;
  availableSlots: number[];
  activeTerminalId: string | null;
  terminals: Array<{
    id: string;
    isActive: boolean;
  }>;
  timestamp: number;
  operation?: string;
}

// Callback types for external integration
interface DebugPanelCallbacks {
  getSystemStatus: () => SystemStatusSnapshot;
  forceSynchronization: () => void;
  requestLatestState: () => void;
}

export class DebugPanelManager {
  private debugPanel: HTMLElement | null = null;
  private debugCounters: DebugCounters = {
    stateUpdates: 0,
    lastSync: 'never',
    systemStartTime: Date.now(),
  };
  private isDebugMode = false;
  private callbacks: DebugPanelCallbacks | null = null;

  /**
   * Set callbacks for external integration
   */
  public setCallbacks(callbacks: DebugPanelCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Toggle debug panel visibility
   */
  public toggle(currentState?: TerminalState): void {
    this.isDebugMode = !this.isDebugMode;

    if (this.isDebugMode) {
      log('🔧 Debug panel opened');
      if (currentState) {
        this.updateDisplay(currentState, 'manual-toggle');
      }
    } else {
      log('🔧 Debug panel closed');
      this.removePanel();
    }
  }

  /**
   * Check if debug mode is active
   */
  public isActive(): boolean {
    return this.isDebugMode;
  }

  /**
   * Update debug display with state information
   */
  public updateDisplay(state: TerminalState, operation?: string): void {
    this.debugCounters.stateUpdates++;
    this.debugCounters.lastSync = new Date().toISOString();

    if (!this.isDebugMode) return;

    const debugInfo: DebugInfo = {
      timestamp: Date.now(),
      terminals: state.terminals.map((t) => ({
        id: t.id,
        isActive: t.isActive,
      })),
      availableSlots: state.availableSlots,
      activeTerminalId: state.activeTerminalId,
      totalCount: state.terminals.length,
      maxTerminals: state.maxTerminals,
      operation: operation || 'state-update',
    };

    this.displayDebugInfo(debugInfo);
  }

  /**
   * Increment state update counter
   */
  public incrementStateUpdates(): void {
    this.debugCounters.stateUpdates++;
    this.debugCounters.lastSync = new Date().toISOString();
  }

  /**
   * Get performance counters
   */
  public getCounters(): DebugCounters {
    return { ...this.debugCounters };
  }

  /**
   * Export system diagnostics
   */
  public exportDiagnostics(
    systemStatus: SystemStatusSnapshot,
    maxTerminals: number | 'unknown'
  ): SystemDiagnostics {
    return {
      timestamp: new Date().toISOString(),
      systemStatus,
      performanceCounters: { ...this.debugCounters },
      configuration: {
        debugMode: this.isDebugMode,
        maxTerminals,
      },
      extensionCommunication: {
        lastStateRequest: this.debugCounters.lastSync,
        messageQueueStatus: 'operational',
      },
      troubleshootingInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
      },
    };
  }

  /**
   * Get system uptime string
   */
  public getUptime(): string {
    const uptimeMs = Date.now() - this.debugCounters.systemStartTime;
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Update performance counters in the panel
   */
  public updatePerformanceCounters(): void {
    const stateUpdatesElement = document.getElementById('debug-state-updates');
    if (stateUpdatesElement) {
      stateUpdatesElement.textContent = this.debugCounters.stateUpdates.toString();
    }

    const lastSyncElement = document.getElementById('debug-last-sync');
    if (lastSyncElement) {
      lastSyncElement.textContent = this.debugCounters.lastSync;
    }

    const uptimeElement = document.getElementById('debug-uptime');
    if (uptimeElement) {
      uptimeElement.textContent = this.getUptime();
    }
  }

  private removePanel(): void {
    const debugElement = document.getElementById('terminal-debug-info');
    if (debugElement) {
      debugElement.remove();
    }
    this.debugPanel = null;
  }

  private displayDebugInfo(info: DebugInfo): void {
    let debugElement = document.getElementById('terminal-debug-info');
    if (!debugElement) {
      debugElement = document.createElement('div');
      debugElement.id = 'terminal-debug-info';
      debugElement.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.92);
        color: #fff;
        padding: 16px;
        border-radius: 8px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 11px;
        z-index: 10000;
        max-width: 400px;
        min-width: 320px;
        border: 1px solid #444;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        line-height: 1.4;
      `;
      document.body.appendChild(debugElement);

      // Add close button
      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: #fff;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      closeButton.onclick = () => {
        this.isDebugMode = false;
        debugElement?.remove();
      };
      debugElement.appendChild(closeButton);
    }

    // Get current system status
    const systemStatus = this.callbacks?.getSystemStatus() || {
      ready: true,
      state: null,
      pendingOperations: { deletions: [], creations: 0 },
    };
    const ready = systemStatus.ready;

    // Color coding based on system state
    const statusColor = ready ? '#10b981' : '#ef4444';
    const warningColor = '#f59e0b';
    const infoColor = '#3b82f6';

    debugElement.innerHTML = this.formatFullDebugPanel(
      info,
      systemStatus,
      statusColor,
      warningColor,
      infoColor
    );

    // Update performance counters
    this.updatePerformanceCounters();
  }

  private formatFullDebugPanel(
    info: DebugInfo,
    systemStatus: SystemStatusSnapshot,
    statusColor: string,
    warningColor: string,
    infoColor: string
  ): string {
    return `
      <button style="position: absolute; top: 8px; right: 8px; background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; padding: 0; width: 20px; height: 20px;" onclick="this.parentElement.remove(); window.terminalManager && (window.terminalManager.debugMode = false);">×</button>

      <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #444;">
        <div style="color: #fbbf24; font-weight: bold; font-size: 12px;">🔍 Terminal State Debug Panel</div>
        <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Last Update: ${new Date().toLocaleTimeString()}</div>
      </div>

      <!-- System Status -->
      <div style="margin-bottom: 12px;">
        <div style="color: ${statusColor}; font-weight: bold; margin-bottom: 4px;">
          ${systemStatus.ready ? '✅' : '⚠️'} System Status: ${systemStatus.ready ? 'READY' : 'BUSY'}
        </div>
        ${
          !systemStatus.ready
            ? `
          <div style="color: ${warningColor}; font-size: 10px; margin-left: 16px;">
            ${systemStatus.pendingOperations.deletions.length > 0 ? `🗑️ Deletions: ${systemStatus.pendingOperations.deletions.length}` : ''}
            ${systemStatus.pendingOperations.creations > 0 ? `📥 Queued: ${systemStatus.pendingOperations.creations}` : ''}
          </div>
        `
            : ''
        }
      </div>

      <!-- Terminal Count & Slots -->
      <div style="margin-bottom: 12px;">
        <div style="color: ${infoColor}; font-weight: bold; margin-bottom: 4px;">
          📊 Terminal Management
        </div>
        <div style="margin-left: 16px; color: #e5e7eb;">
          <div>Active: <span style="color: #10b981; font-weight: bold;">${info.totalCount}</span>/<span style="color: #fbbf24;">${info.maxTerminals}</span></div>
          <div>Available Slots: <span style="color: ${info.availableSlots.length > 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">[${info.availableSlots.join(', ') || 'none'}]</span></div>
          <div>Active Terminal: <span style="color: #60a5fa;">${info.activeTerminalId || 'none'}</span></div>
        </div>
      </div>

      <!-- Terminal List -->
      <div style="margin-bottom: 12px;">
        <div style="color: ${infoColor}; font-weight: bold; margin-bottom: 4px;">
          🖥️ Terminal Instances
        </div>
        <div style="margin-left: 16px; color: #e5e7eb; max-height: 120px; overflow-y: auto;">
          ${
            info.terminals.length > 0
              ? info.terminals
                  .map(
                    (t) => `
              <div style="margin: 2px 0; padding: 2px 4px; background: ${t.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(75, 85, 99, 0.3)'}; border-radius: 3px; border-left: 2px solid ${t.isActive ? '#10b981' : '#6b7280'};">
                <span style="color: ${t.isActive ? '#10b981' : '#9ca3af'};">${t.id}</span>
                ${t.isActive ? '<span style="color: #fbbf24;">●</span>' : ''}
              </div>
            `
                  )
                  .join('')
              : '<div style="color: #6b7280; font-style: italic;">No terminals</div>'
          }
        </div>
      </div>

      <!-- Pending Operations -->
      ${
        systemStatus.pendingOperations.deletions.length > 0 ||
        systemStatus.pendingOperations.creations > 0
          ? `
        <div style="margin-bottom: 12px;">
          <div style="color: ${warningColor}; font-weight: bold; margin-bottom: 4px;">
            ⏳ Pending Operations
          </div>
          <div style="margin-left: 16px; color: #e5e7eb;">
            ${
              systemStatus.pendingOperations.deletions.length > 0
                ? `
              <div style="margin: 2px 0;">
                <span style="color: #ef4444;">🗑️ Deletions (${systemStatus.pendingOperations.deletions.length}):</span>
                <div style="margin-left: 16px; font-size: 10px; color: #fca5a5;">
                  ${systemStatus.pendingOperations.deletions.map((id) => `• ${id}`).join('<br>')}
                </div>
              </div>
            `
                : ''
            }
            ${
              systemStatus.pendingOperations.creations > 0
                ? `
              <div style="margin: 2px 0;">
                <span style="color: #f59e0b;">📥 Creations:</span>
                <span style="color: #fbbf24; font-weight: bold;">${systemStatus.pendingOperations.creations} queued</span>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `
          : ''
      }

      <!-- Number Recycling Status -->
      <div style="margin-bottom: 12px;">
        <div style="color: ${infoColor}; font-weight: bold; margin-bottom: 4px;">
          🔄 Number Recycling
        </div>
        <div style="margin-left: 16px; color: #e5e7eb;">
          <div style="display: flex; gap: 8px; margin-bottom: 4px;">
            ${[1, 2, 3, 4, 5]
              .map((num) => {
                const isUsed = info.terminals.some((t) => t.id === `terminal-${num}`);
                const isAvailable = info.availableSlots.includes(num);
                const color = isUsed ? '#ef4444' : isAvailable ? '#10b981' : '#6b7280';
                const symbol = isUsed ? '●' : isAvailable ? '○' : '◌';
                return `<span style="color: ${color}; font-weight: bold; width: 20px; text-align: center;">${num}${symbol}</span>`;
              })
              .join('')}
          </div>
          <div style="font-size: 10px; color: #9ca3af;">
            <span style="color: #ef4444;">● Used</span> |
            <span style="color: #10b981;">○ Available</span> |
            <span style="color: #6b7280;">◌ Unavailable</span>
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div style="margin-bottom: 8px;">
        <div style="color: ${infoColor}; font-weight: bold; margin-bottom: 4px;">
          ⚡ Performance
        </div>
        <div style="margin-left: 16px; color: #e5e7eb; font-size: 10px;">
          <div>State Updates: <span id="debug-state-updates">${this.debugCounters.stateUpdates}</span></div>
          <div>Last Sync: <span id="debug-last-sync">${info.timestamp}</span></div>
          <div>System Uptime: <span id="debug-uptime">${this.getUptime()}</span></div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #444;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button onclick="window.terminalManager?.forceSynchronization()" style="
            background: #ef4444; color: white; border: none; padding: 4px 8px;
            border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold;
          ">🔄 Force Sync</button>
          <button onclick="window.terminalManager?.requestLatestState()" style="
            background: #3b82f6; color: white; border: none; padding: 4px 8px;
            border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold;
          ">📡 Refresh State</button>
          <button onclick="console.log('Terminal System Status:', window.terminalManager?.getSystemStatus())" style="
            background: #6b7280; color: white; border: none; padding: 4px 8px;
            border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold;
          ">📋 Log Status</button>
        </div>
      </div>
    `;
  }

  public dispose(): void {
    this.removePanel();
    this.isDebugMode = false;
  }
}
