/**
 * Container Visibility Service
 *
 * Extracted from TerminalContainerManager for better maintainability.
 * Handles container visibility control and display state enforcement.
 */

import { containerLogger } from '../../utils/ManagerLogger';

/**
 * Service for managing terminal container visibility
 */
export class ContainerVisibilityService {
  /** Hidden container storage element */
  private hiddenContainerStorage: HTMLElement | null = null;

  /**
   * Check if an element is visible
   */
  public isElementVisible(element: HTMLElement): boolean {
    if (!element) {
      return false;
    }
    return element.style.display !== 'none' && !element.classList.contains('hidden-mode');
  }

  /**
   * Enforce fullscreen state for containers
   */
  public enforceFullscreenState(
    activeTerminalId: string | null,
    terminalBody: HTMLElement,
    _containerCache: Map<string, HTMLElement>
  ): void {
    const containers = terminalBody.querySelectorAll<HTMLElement>('.terminal-container');
    const hiddenStorage = this.getHiddenStorage(terminalBody, true);

    containers.forEach((container) => {
      const containerId = container.getAttribute('data-terminal-id');
      const isActive = containerId !== null && containerId === activeTerminalId;

      if (isActive) {
        container.style.display = 'flex';
        container.style.width = '100%';
        container.style.height = '100%';
        container.classList.remove('hidden-mode');
        container.classList.add('terminal-container--fullscreen');
        // 🔧 FIX: Append to terminals-wrapper instead of terminal-body
        const terminalsWrapper = document.getElementById('terminals-wrapper') || terminalBody;
        terminalsWrapper.appendChild(container);
      } else {
        container.style.display = 'none';
        container.classList.add('hidden-mode');
        container.classList.remove('terminal-container--fullscreen', 'terminal-container--split');
        if (hiddenStorage && container.parentElement !== hiddenStorage) {
          hiddenStorage.appendChild(container);
        }
      }
    });

    // Remove split artifacts
    terminalBody.querySelectorAll<HTMLElement>('[data-terminal-wrapper-id]').forEach((wrapper) => {
      wrapper.remove();
    });

    terminalBody.querySelectorAll<HTMLElement>('.split-resizer').forEach((resizer) => {
      resizer.remove();
    });
  }

  /**
   * Normalize terminal body by moving all containers back
   */
  public normalizeTerminalBody(
    terminalBody: HTMLElement,
    containerCache: Map<string, HTMLElement>
  ): void {
    const storage = this.getHiddenStorage(terminalBody, false);
    if (storage) {
      containerCache.forEach((container) => {
        if (container.parentElement === storage) {
          // 🔧 FIX: Append to terminals-wrapper instead of terminal-body
          const terminalsWrapper = document.getElementById('terminals-wrapper') || terminalBody;
          terminalsWrapper.appendChild(container);
        }
      });
      storage.textContent = ''; // Safe: clearing content
    }

    containerCache.forEach((container) => {
      container.classList.remove('terminal-container--fullscreen');
      container.style.removeProperty('height');
      container.style.removeProperty('width');
      if (container.classList.contains('hidden-mode')) {
        container.style.display = 'none';
      } else {
        container.style.removeProperty('display');
      }
    });
  }

  /**
   * Get or create hidden storage element
   */
  public getHiddenStorage(terminalBody: HTMLElement, createIfMissing: boolean): HTMLElement | null {
    if (this.hiddenContainerStorage && document.contains(this.hiddenContainerStorage)) {
      return this.hiddenContainerStorage;
    }

    if (!createIfMissing) {
      return null;
    }

    const storage = document.createElement('div');
    storage.id = 'terminal-hidden-storage';
    storage.style.display = 'none';
    terminalBody.appendChild(storage);
    this.hiddenContainerStorage = storage;
    return storage;
  }

  /**
   * Get the terminals-wrapper element or fallback to terminal-body
   */
  public getTerminalsWrapper(terminalBody: HTMLElement): HTMLElement {
    return document.getElementById('terminals-wrapper') || terminalBody;
  }

  /**
   * Ensure container is in the terminal body
   */
  public ensureContainerInBody(container: HTMLElement, terminalBody: HTMLElement): void {
    const terminalsWrapper = this.getTerminalsWrapper(terminalBody);
    if (container.parentElement !== terminalsWrapper) {
      terminalsWrapper.appendChild(container);
    }
  }

  /**
   * Show a container
   */
  public showContainer(container: HTMLElement): void {
    container.style.display = 'flex';
    container.classList.remove('hidden-mode');
    containerLogger.debug(`Container shown: ${container.dataset.terminalId}`);
  }

  /**
   * Hide a container
   */
  public hideContainer(container: HTMLElement, terminalBody: HTMLElement): void {
    container.style.display = 'none';
    container.classList.add('hidden-mode');

    const hiddenStorage = this.getHiddenStorage(terminalBody, true);
    if (hiddenStorage && container.parentElement !== hiddenStorage) {
      hiddenStorage.appendChild(container);
    }
    containerLogger.debug(`Container hidden: ${container.dataset.terminalId}`);
  }

  /**
   * Clear hidden storage reference
   */
  public clearHiddenStorage(): void {
    this.hiddenContainerStorage = null;
  }
}
