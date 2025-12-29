import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoadingIndicatorService } from '../../../../../../webview/managers/ui/LoadingIndicatorService';

// Mock dependencies
vi.mock('../../../../../../webview/utils/ManagerLogger');

describe('LoadingIndicatorService', () => {
  let service: LoadingIndicatorService;
  let container: HTMLElement;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new LoadingIndicatorService();

    // Setup DOM
    container = document.createElement('div');
    container.id = 'terminal-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('showTerminalPlaceholder', () => {
    it('should create placeholder if not exists', () => {
      service.showTerminalPlaceholder();
      
      const placeholder = document.getElementById('terminal-placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder?.style.display).toBe('flex');
      expect(container.contains(placeholder)).toBe(true);
    });

    it('should show existing placeholder', () => {
      // Create first
      service.showTerminalPlaceholder();
      const placeholder = document.getElementById('terminal-placeholder')!;
      placeholder.style.display = 'none';

      // Show again
      service.showTerminalPlaceholder();
      
      expect(placeholder.style.display).toBe('flex');
    });

    it('should set correct content', () => {
      service.showTerminalPlaceholder();
      
      const title = document.querySelector('.placeholder-title');
      expect(title?.textContent).toBe('No Terminal Active');
    });
  });

  describe('hideTerminalPlaceholder', () => {
    it('should hide existing placeholder', () => {
      service.showTerminalPlaceholder();
      
      service.hideTerminalPlaceholder();
      
      const placeholder = document.getElementById('terminal-placeholder');
      expect(placeholder?.style.display).toBe('none');
    });

    it('should ignore if not exists', () => {
      service.hideTerminalPlaceholder();
      // No error
    });
  });

  describe('showLoadingIndicator', () => {
    it('should create indicator', () => {
      const indicator = service.showLoadingIndicator('Test Loading');
      
      expect(indicator.classList.contains('loading-indicator')).toBe(true);
      expect(indicator.textContent).toContain('Test Loading');
      expect(container.contains(indicator)).toBe(true);
    });

    it('should use default message', () => {
      const indicator = service.showLoadingIndicator();
      expect(indicator.textContent).toContain('Loading...');
    });
  });

  describe('hideLoadingIndicator', () => {
    it('should remove specific indicator', () => {
      const indicator = service.showLoadingIndicator();
      expect(container.contains(indicator)).toBe(true);
      
      service.hideLoadingIndicator(indicator);
      
      expect(container.contains(indicator)).toBe(false);
    });

    it('should remove all indicators if no argument', () => {
      service.showLoadingIndicator('1');
      service.showLoadingIndicator('2');
      
      expect(document.querySelectorAll('.loading-indicator').length).toBe(2);
      
      service.hideLoadingIndicator();
      
      expect(document.querySelectorAll('.loading-indicator').length).toBe(0);
    });
  });

  describe('state checks', () => {
    it('isPlaceholderVisible should return true only when displayed', () => {
      expect(service.isPlaceholderVisible()).toBe(false);
      
      service.showTerminalPlaceholder();
      expect(service.isPlaceholderVisible()).toBe(true);
      
      service.hideTerminalPlaceholder();
      expect(service.isPlaceholderVisible()).toBe(false);
    });

    it('hasLoadingIndicator should return true if any exist', () => {
      expect(service.hasLoadingIndicator()).toBe(false);
      
      service.showLoadingIndicator();
      expect(service.hasLoadingIndicator()).toBe(true);
      
      service.hideLoadingIndicator();
      expect(service.hasLoadingIndicator()).toBe(false);
    });
  });
});
