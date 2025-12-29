import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeaderService } from '../../../../../../webview/managers/ui/HeaderService';
import { HeaderFactory } from '../../../../../../webview/factories/HeaderFactory';

// Mock dependencies
vi.mock('../../../../../../webview/factories/HeaderFactory');
vi.mock('../../../../../../webview/utils/ManagerLogger');
vi.mock('../../../../../../utils/logger');

describe('HeaderService', () => {
  let service: HeaderService;
  let mockHeaderElements: any;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new HeaderService();

    // Create mock DOM elements
    const container = document.createElement('div');
    container.classList.add('terminal-header');
    
    mockHeaderElements = {
      container,
      nameSpan: document.createElement('span'),
      titleSection: document.createElement('div'),
      closeButton: document.createElement('button'),
      aiAgentToggleButton: document.createElement('button'),
      splitButton: document.createElement('button'),
    };

    // Mock HeaderFactory
    vi.mocked(HeaderFactory.createTerminalHeader).mockReturnValue(mockHeaderElements);
  });

  describe('createTerminalHeader', () => {
    it('should create and cache header elements', () => {
      const terminalId = 't1';
      const name = 'Terminal 1';
      
      const result = service.createTerminalHeader(terminalId, name);
      
      expect(HeaderFactory.createTerminalHeader).toHaveBeenCalledWith(
        expect.objectContaining({
          terminalId,
          terminalName: name,
        })
      );
      expect(result).toBe(mockHeaderElements.container);
      expect(service.hasHeaderElements(terminalId)).toBe(true);
    });

    it('should set element styles for visibility', () => {
      const result = service.createTerminalHeader('t1', 'Term');
      
      expect(result.style.display).toBe('flex');
      expect(result.style.visibility).toBe('visible');
    });

    it('should calculate theme colors correctly', () => {
      service.createTerminalHeader('t1', 'Term', { currentTheme: '#ffffff' });
      
      expect(HeaderFactory.createTerminalHeader).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundColor: '#ffffff',
          foregroundColor: '#000000', // Light theme foreground
        })
      );
    });
  });

  describe('updateTerminalHeader', () => {
    it('should update name using factory if cached', () => {
      const terminalId = 't1';
      service.createTerminalHeader(terminalId, 'Old Name');
      
      service.updateTerminalHeader(terminalId, 'New Name');
      
      expect(HeaderFactory.updateTerminalName).toHaveBeenCalledWith(
        mockHeaderElements,
        'New Name'
      );
    });

    it('should try fallback DOM update if not cached', () => {
      const terminalId = 't2';
      // Create element in DOM manually
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', terminalId);
      const nameSpan = document.createElement('span');
      nameSpan.className = 'terminal-name';
      container.appendChild(nameSpan);
      document.body.appendChild(container);
      
      service.updateTerminalHeader(terminalId, 'Fallback Name');
      
      expect(nameSpan.textContent).toBe('Fallback Name');
      
      // Cleanup
      document.body.removeChild(container);
    });
  });

  describe('removeTerminalHeader', () => {
    it('should remove from cache', () => {
      const terminalId = 't1';
      service.createTerminalHeader(terminalId, 'Name');
      
      expect(service.hasHeaderElements(terminalId)).toBe(true);
      
      service.removeTerminalHeader(terminalId);
      
      expect(service.hasHeaderElements(terminalId)).toBe(false);
    });
  });

  describe('updateHeaderThemeColors', () => {
    it('should update styles of cached elements', () => {
      const terminalId = 't1';
      service.createTerminalHeader(terminalId, 'Name');
      
      service.updateHeaderThemeColors(terminalId, '#000000', '#ffffff');
      
      expect(mockHeaderElements.container.style.backgroundColor).toBe('#000000');
      expect(mockHeaderElements.container.style.color).toBe('#ffffff');
      expect(mockHeaderElements.nameSpan.style.color).toBe('#ffffff');
    });

    it('should ignore if not cached', () => {
      service.updateHeaderThemeColors('non-existent', '#000', '#fff');
      // Should not throw
    });
  });

  describe('cache management', () => {
    it('should clear all cache', () => {
      service.createTerminalHeader('t1', '1');
      service.createTerminalHeader('t2', '2');
      
      expect(service.getCacheSize()).toBe(2);
      
      service.clearHeaderCache();
      
      expect(service.getCacheSize()).toBe(0);
    });
    
    it('should find headers in DOM', () => {
       // Clear previous DOM state
       document.body.innerHTML = '';
       const header1 = document.createElement('div');
       header1.className = 'terminal-header';
       document.body.appendChild(header1);
       
       const headers = service.findTerminalHeaders();
       expect(headers.length).toBe(1);
    });
  });
});
