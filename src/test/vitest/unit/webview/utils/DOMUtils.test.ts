/**
 * DOMUtils Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { DOMUtils } from '../../../../../webview/utils/DOMUtils';

describe('DOMUtils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createElement', () => {
    it('should create element with tag name', () => {
      const el = DOMUtils.createElement('div');
      expect(el.tagName).toBe('DIV');
    });

    it('should apply styles', () => {
      const el = DOMUtils.createElement('div', { color: 'red', display: 'flex' });
      expect(el.style.color).toBe('red');
      expect(el.style.display).toBe('flex');
    });

    it('should apply attributes', () => {
      const el = DOMUtils.createElement('div', {}, { id: 'test-id', 'data-value': '123' });
      expect(el.id).toBe('test-id');
      expect(el.getAttribute('data-value')).toBe('123');
    });

    it('should set textContent', () => {
      const el = DOMUtils.createElement('div', {}, { textContent: 'hello world' });
      expect(el.textContent).toBe('hello world');
    });

    it('should block innerHTML for security', () => {
      const el = DOMUtils.createElement('div', {}, { innerHTML: '<span>unsafe</span>' } as any);
      expect(el.innerHTML).not.toContain('<span>');
      expect(el.textContent).toBe('<span>unsafe</span>');
    });
  });

  describe('Style Manipulation', () => {
    it('should apply style string', () => {
      const el = document.createElement('div');
      DOMUtils.applyStyleString(el, 'color: blue; margin: 10px;');
      expect(el.style.color).toBe('blue');
      expect(el.style.margin).toBe('10px');
    });

    it('should set and get CSS variables', () => {
      DOMUtils.setCSSVariable('test-var', '100px');
      // getCSSVariable uses getComputedStyle which might be limited in JSDOM/HappyDOM
      // but we can check the inline style on documentElement
      expect(document.documentElement.style.getPropertyValue('--test-var')).toBe('100px');
    });
  });

  describe('Element Retrieval and Life-cycle', () => {
    it('should safely remove element', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      expect(document.body.contains(el)).toBe(true);
      
      DOMUtils.safeRemove(el);
      expect(document.body.contains(el)).toBe(false);
    });

    it('should check if element exists', () => {
      document.body.innerHTML = '<div class="test"></div>';
      expect(DOMUtils.exists('.test')).toBe(true);
      expect(DOMUtils.exists('.missing')).toBe(false);
    });

    it('should get or create element', () => {
      const el1 = DOMUtils.getOrCreateElement('#new-el', 'div', document.body);
      expect(el1.id).toBe('new-el');
      expect(document.body.contains(el1)).toBe(true);

      const el2 = DOMUtils.getOrCreateElement('#new-el', 'div');
      expect(el1).toBe(el2);
    });
  });

  describe('Child Management', () => {
    it('should append multiple children', () => {
      const parent = document.createElement('div');
      const c1 = document.createElement('span');
      const c2 = document.createElement('span');
      
      DOMUtils.appendChildren(parent, c1, c2);
      expect(parent.children.length).toBe(2);
      expect(parent.firstChild).toBe(c1);
    });

    it('should prepend child', () => {
      const parent = document.createElement('div');
      const c1 = document.createElement('span');
      const c2 = document.createElement('span');
      
      parent.appendChild(c1);
      DOMUtils.prependChild(parent, c2);
      
      expect(parent.firstChild).toBe(c2);
    });
  });

  describe('xterm Style Reset', () => {
    it('should reset inline styles on xterm elements', () => {
      const container = document.createElement('div');
      container.className = 'terminal-container';
      container.style.width = '500px';

      const xterm = document.createElement('div');
      xterm.className = 'xterm';
      xterm.style.height = '300px';
      container.appendChild(xterm);

      const canvas = document.createElement('canvas');
      const screen = document.createElement('div');
      screen.className = 'xterm-screen';
      screen.appendChild(canvas);
      container.appendChild(screen);

      DOMUtils.resetXtermInlineStyles(container, false);

      expect(container.style.width).toBe('');
      expect(xterm.style.height).toBe('');
      expect(canvas.style.width).toBe('100%');
    });

    it('should return false for null container', () => {
      expect(DOMUtils.resetXtermInlineStyles(null, false)).toBe(false);
    });

    it('should clear all dimension styles on xterm internal elements', () => {
      const container = document.createElement('div');

      const viewport = document.createElement('div');
      viewport.className = 'xterm-viewport';
      viewport.style.width = '800px';
      viewport.style.height = '600px';
      viewport.style.maxWidth = '1000px';
      viewport.style.minWidth = '100px';
      container.appendChild(viewport);

      const helpers = document.createElement('div');
      helpers.className = 'xterm-helpers';
      helpers.style.width = '800px';
      container.appendChild(helpers);

      DOMUtils.resetXtermInlineStyles(container, false);

      expect(viewport.style.width).toBe('');
      expect(viewport.style.height).toBe('');
      expect(viewport.style.maxWidth).toBe('');
      expect(viewport.style.minWidth).toBe('');
      expect(helpers.style.width).toBe('');
    });

    it('should use selector cache for repeated calls', () => {
      const container = document.createElement('div');
      const xterm = document.createElement('div');
      xterm.className = 'xterm';
      container.appendChild(xterm);

      // First call populates cache
      DOMUtils.resetXtermInlineStyles(container, false);

      // Set styles again
      xterm.style.width = '500px';

      // Second call should still find element via cache
      DOMUtils.resetXtermInlineStyles(container, false);
      expect(xterm.style.width).toBe('');
    });

    it('should invalidate selector cache', () => {
      const container = document.createElement('div');
      const xterm = document.createElement('div');
      xterm.className = 'xterm';
      container.appendChild(xterm);

      // Populate cache
      DOMUtils.resetXtermInlineStyles(container, false);

      // Remove old element, add new one
      container.removeChild(xterm);
      const newXterm = document.createElement('div');
      newXterm.className = 'xterm';
      newXterm.style.width = '999px';
      container.appendChild(newXterm);

      // Invalidate and re-query
      DOMUtils.invalidateSelectorCache(container);
      DOMUtils.resetXtermInlineStyles(container, false);
      expect(newXterm.style.width).toBe('');
    });

    it('should re-query when an element appears after a cached null result', () => {
      const container = document.createElement('div');

      // First call caches misses for xterm selectors
      DOMUtils.resetXtermInlineStyles(container, false);

      const xterm = document.createElement('div');
      xterm.className = 'xterm';
      xterm.style.width = '500px';
      container.appendChild(xterm);

      // Must re-query instead of returning stale cached null
      DOMUtils.resetXtermInlineStyles(container, false);
      expect(xterm.style.width).toBe('');
    });

    it('should copy background color from viewport to xterm element', () => {
      const container = document.createElement('div');

      const xterm = document.createElement('div');
      xterm.className = 'xterm';
      container.appendChild(xterm);

      const viewport = document.createElement('div');
      viewport.className = 'xterm-viewport';
      viewport.style.backgroundColor = 'rgb(30, 30, 30)';
      container.appendChild(viewport);

      DOMUtils.resetXtermInlineStyles(container, false);
      expect(xterm.style.backgroundColor).toBe('rgb(30, 30, 30)');
    });
  });

  describe('scheduleXtermStyleReset', () => {
    it('should return false for null container', () => {
      expect(DOMUtils.scheduleXtermStyleReset(null)).toBe(false);
    });

    it('should return true for valid container', () => {
      const container = document.createElement('div');
      expect(DOMUtils.scheduleXtermStyleReset(container)).toBe(true);
    });
  });
});
