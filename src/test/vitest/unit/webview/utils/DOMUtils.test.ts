
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { DOMUtils } from '../../../../../webview/utils/DOMUtils';

describe('DOMUtils', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"><span id="child"></span></div></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('getComputedStyle', dom.window.getComputedStyle);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('createElement', () => {
    it('should create an element with styles and attributes', () => {
      const el = DOMUtils.createElement('div', 
        { color: 'red', display: 'flex' },
        { id: 'my-div', className: 'box', 'data-test': 'val' }
      );

      expect(el.tagName).toBe('DIV');
      expect(el.style.color).toBe('red');
      expect(el.style.display).toBe('flex');
      expect(el.id).toBe('my-div');
      expect(el.className).toBe('box');
      expect(el.getAttribute('data-test')).toBe('val');
    });

    it('should set textContent and block innerHTML', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const el = DOMUtils.createElement('span', {}, { textContent: 'text', innerHTML: '<p>unsafe</p>' } as Record<string, string>);
      
      expect(el.textContent).toBe('<p>unsafe</p>'); // innerHTML should be handled as textContent
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('getOrCreateElement', () => {
    it('should find existing element', () => {
      const existing = DOMUtils.getOrCreateElement('#child', 'span');
      expect(existing.id).toBe('child');
      expect(document.querySelectorAll('#child').length).toBe(1);
    });

    it('should create element if not exists', () => {
      const created = DOMUtils.getOrCreateElement('#new-el', 'div');
      expect(created.id).toBe('new-el');
      expect(created.tagName).toBe('DIV');
    });
  });

  describe('Hierarchy Operations', () => {
    it('should prepend a child', () => {
      const parent = document.getElementById('container')!;
      const newChild = document.createElement('p');
      DOMUtils.prependChild(parent, newChild);
      
      expect(parent.firstChild).toBe(newChild);
    });

    it('should safely remove an element', () => {
      const child = document.getElementById('child')!;
      DOMUtils.safeRemove(child);
      expect(document.getElementById('child')).toBeNull();
    });
  });

  describe('CSS Variables', () => {
    it('should set and get CSS variables', () => {
      DOMUtils.setCSSVariable('test-color', '#fff');
      // jsdom might need explicit style check on root
      expect(document.documentElement.style.getPropertyValue('--test-color')).toBe('#fff');
    });
  });

  describe('resetXtermInlineStyles', () => {
    it('should clear inline styles on container and children', () => {
      const container = document.createElement('div');
      container.style.width = '100px';
      
      const content = document.createElement('div');
      content.className = 'terminal-content';
      content.style.maxWidth = '50px';
      container.appendChild(content);

      const result = DOMUtils.resetXtermInlineStyles(container, false);
      
      expect(result).toBe(true);
      expect(container.style.width).toBe('');
      expect(content.style.maxWidth).toBe('');
    });

    it('should return false for null container', () => {
      expect(DOMUtils.resetXtermInlineStyles(null)).toBe(false);
    });
  });
});
