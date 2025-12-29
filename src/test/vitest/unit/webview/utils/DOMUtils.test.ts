/**
 * DOMUtils Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  });
});