/**
 * Terminal State Service Implementation
 *
 * Manages terminal lifecycle states and metadata with event-driven updates.
 */

import type { EventBus } from '../../core/EventBus';
import { createEventType } from '../../core/EventBus';
import { ProcessState, InteractionState } from '../../types/shared';
import type {
  ITerminalStateService,
  TerminalMetadata,
  TerminalLifecycleState,
  TerminalState,
  TerminalStateChangeData,
} from './ITerminalStateService';

/**
 * Internal terminal state storage
 */
interface InternalTerminalState {
  metadata: TerminalMetadata;
  lifecycle: TerminalLifecycleState;
}

/**
 * Terminal state change event
 */
export const TerminalStateChangedEvent =
  createEventType<TerminalStateChangeData>('terminal.state.changed');

/**
 * Terminal State Service Implementation
 */
export class TerminalStateService implements ITerminalStateService {
  private readonly _terminals = new Map<string, InternalTerminalState>();
  private _activeTerminalId: string | undefined;
  private _isDisposed = false;

  constructor(private readonly _eventBus: EventBus) {}

  registerTerminal(id: string, metadata: Partial<TerminalMetadata>): void {
    this._ensureNotDisposed();

    if (this._terminals.has(id)) {
      throw new Error(`Terminal ${id} is already registered`);
    }

    const now = new Date();
    const fullMetadata: TerminalMetadata = {
      id,
      name: metadata.name || `Terminal ${id}`,
      number: metadata.number,
      cwd: metadata.cwd,
      shell: metadata.shell,
      shellArgs: metadata.shellArgs,
      pid: metadata.pid,
      isActive: metadata.isActive ?? false,
      createdAt: metadata.createdAt || now,
      lastActiveAt: metadata.lastActiveAt || now,
    };

    const lifecycle: TerminalLifecycleState = {
      processState: ProcessState.Uninitialized,
      interactionState: InteractionState.None,
      shouldPersist: false,
    };

    this._terminals.set(id, {
      metadata: fullMetadata,
      lifecycle,
    });

    // Publish state change event
    this._publishStateChange(
      id,
      undefined,
      {
        ...fullMetadata,
        lifecycle,
      },
      'registered'
    );
  }

  unregisterTerminal(id: string): boolean {
    this._ensureNotDisposed();

    const state = this._terminals.get(id);
    if (!state) {
      return false;
    }

    const previousState: TerminalState = {
      ...state.metadata,
      lifecycle: state.lifecycle,
    };

    this._terminals.delete(id);

    // Clear active terminal if it was the unregistered one
    if (this._activeTerminalId === id) {
      this._activeTerminalId = undefined;
    }

    // Publish state change event
    this._publishStateChange(id, previousState, previousState, 'unregistered');

    return true;
  }

  hasTerminal(id: string): boolean {
    return this._terminals.has(id);
  }

  getMetadata(id: string): TerminalMetadata | undefined {
    return this._terminals.get(id)?.metadata;
  }

  updateMetadata(id: string, updates: Partial<TerminalMetadata>): boolean {
    this._ensureNotDisposed();

    const state = this._terminals.get(id);
    if (!state) {
      return false;
    }

    const previousState = this._getCompleteState(state);

    // Update metadata
    Object.assign(state.metadata, updates);

    const currentState = this._getCompleteState(state);

    // Publish state change event
    this._publishStateChange(id, previousState, currentState, 'updated');

    return true;
  }

  getLifecycleState(id: string): TerminalLifecycleState | undefined {
    return this._terminals.get(id)?.lifecycle;
  }

  updateLifecycleState(id: string, updates: Partial<TerminalLifecycleState>): boolean {
    this._ensureNotDisposed();

    const state = this._terminals.get(id);
    if (!state) {
      return false;
    }

    const previousState = this._getCompleteState(state);

    // Update lifecycle state
    Object.assign(state.lifecycle, updates);

    const currentState = this._getCompleteState(state);

    // Publish state change event
    this._publishStateChange(id, previousState, currentState, 'updated');

    return true;
  }

  getState(id: string): TerminalState | undefined {
    const state = this._terminals.get(id);
    if (!state) {
      return undefined;
    }

    return this._getCompleteState(state);
  }

  setProcessState(id: string, processState: ProcessState): boolean {
    return this.updateLifecycleState(id, { processState });
  }

  getProcessState(id: string): ProcessState | undefined {
    return this._terminals.get(id)?.lifecycle.processState;
  }

  setInteractionState(id: string, interactionState: InteractionState): boolean {
    return this.updateLifecycleState(id, { interactionState });
  }

  getInteractionState(id: string): InteractionState | undefined {
    return this._terminals.get(id)?.lifecycle.interactionState;
  }

  setActiveTerminal(id: string): boolean {
    this._ensureNotDisposed();

    const state = this._terminals.get(id);
    if (!state) {
      return false;
    }

    // Deactivate previous active terminal
    if (this._activeTerminalId && this._activeTerminalId !== id) {
      const prevState = this._terminals.get(this._activeTerminalId);
      if (prevState) {
        const previousCompleteState = this._getCompleteState(prevState);
        prevState.metadata.isActive = false;
        prevState.metadata.lastActiveAt = new Date();
        const currentCompleteState = this._getCompleteState(prevState);
        this._publishStateChange(
          this._activeTerminalId,
          previousCompleteState,
          currentCompleteState,
          'deactivated'
        );
      }
    }

    // Activate new terminal
    const previousState = this._getCompleteState(state);
    state.metadata.isActive = true;
    state.metadata.lastActiveAt = new Date();
    const currentState = this._getCompleteState(state);

    this._activeTerminalId = id;

    // Publish state change event
    this._publishStateChange(id, previousState, currentState, 'activated');

    return true;
  }

  getActiveTerminalId(): string | undefined {
    return this._activeTerminalId;
  }

  getActiveTerminal(): TerminalMetadata | undefined {
    if (!this._activeTerminalId) {
      return undefined;
    }

    return this.getMetadata(this._activeTerminalId);
  }

  clearActiveTerminal(): void {
    this._ensureNotDisposed();

    if (this._activeTerminalId) {
      const state = this._terminals.get(this._activeTerminalId);
      if (state) {
        const previousState = this._getCompleteState(state);
        state.metadata.isActive = false;
        const currentState = this._getCompleteState(state);
        this._publishStateChange(
          this._activeTerminalId,
          previousState,
          currentState,
          'deactivated'
        );
      }
      this._activeTerminalId = undefined;
    }
  }

  getAllTerminalIds(): string[] {
    return Array.from(this._terminals.keys());
  }

  getAllTerminals(): TerminalMetadata[] {
    return Array.from(this._terminals.values()).map((state) => state.metadata);
  }

  getAllStates(): TerminalState[] {
    return Array.from(this._terminals.values()).map((state) => this._getCompleteState(state));
  }

  getTerminalCount(): number {
    return this._terminals.size;
  }

  isTerminalReady(id: string): boolean {
    const processState = this.getProcessState(id);
    return processState === ProcessState.Running;
  }

  isTerminalActive(id: string): boolean {
    return this._activeTerminalId === id;
  }

  findTerminals(predicate: (metadata: TerminalMetadata) => boolean): TerminalMetadata[] {
    const results: TerminalMetadata[] = [];

    for (const state of this._terminals.values()) {
      if (predicate(state.metadata)) {
        results.push(state.metadata);
      }
    }

    return results;
  }

  updateLastActiveTime(id: string): boolean {
    return this.updateMetadata(id, {
      lastActiveAt: new Date(),
    });
  }

  getTerminalsByActivity(): string[] {
    const terminals = Array.from(this._terminals.entries());

    // Sort by lastActiveAt descending (most recent first)
    terminals.sort((a, b) => {
      const timeA = a[1].metadata.lastActiveAt.getTime();
      const timeB = b[1].metadata.lastActiveAt.getTime();
      return timeB - timeA;
    });

    return terminals.map(([id]) => id);
  }

  clear(): void {
    this._ensureNotDisposed();

    this._terminals.clear();
    this._activeTerminalId = undefined;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this.clear();
    this._isDisposed = true;
  }

  /**
   * Helper to get complete terminal state
   */
  private _getCompleteState(state: InternalTerminalState): TerminalState {
    return {
      ...state.metadata,
      lifecycle: { ...state.lifecycle },
    };
  }

  /**
   * Helper to publish state change events
   */
  private _publishStateChange(
    terminalId: string,
    previousState: TerminalState | undefined,
    currentState: TerminalState,
    changeType: TerminalStateChangeData['changeType']
  ): void {
    this._eventBus.publish(TerminalStateChangedEvent, {
      terminalId,
      previousState,
      currentState,
      changeType,
    });
  }

  /**
   * Ensure service is not disposed
   */
  private _ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('Cannot use disposed TerminalStateService');
    }
  }
}
