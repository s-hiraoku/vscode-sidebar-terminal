/**
 * Sample test to verify Vitest setup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

describe('Vitest Setup Verification', () => {
  describe('Basic Assertions', () => {
    it('should pass basic equality checks', () => {
      expect(1 + 1).toBe(2);
      expect('hello').toBe('hello');
      expect({ a: 1 }).toEqual({ a: 1 });
    });

    it('should support async/await', async () => {
      const result = await Promise.resolve(42);
      expect(result).toBe(42);
    });

    it('should support array matchers', () => {
      const arr = [1, 2, 3];
      expect(arr).toContain(2);
      expect(arr).toHaveLength(3);
    });
  });

  describe('Mock Functions', () => {
    it('should create mock functions', () => {
      const mockFn = vi.fn();
      mockFn('arg1', 'arg2');

      expect(mockFn).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should support mock return values', async () => {
      const mockFn = vi.fn().mockReturnValue(42);
      expect(mockFn()).toBe(42);

      const asyncMock = vi.fn().mockResolvedValue('async result');
      await expect(asyncMock()).resolves.toBe('async result');
    });

    it('should support mock implementations', () => {
      const mockFn = vi.fn((a: number, b: number) => a + b);
      expect(mockFn(2, 3)).toBe(5);
    });
  });

  describe('VS Code Mock', () => {
    it('should have workspace mock', () => {
      expect(vscode.workspace).toBeDefined();
      expect(vscode.workspace.getConfiguration).toBeDefined();
    });

    it('should have window mock', () => {
      expect(vscode.window).toBeDefined();
      expect(vscode.window.showInformationMessage).toBeDefined();
    });

    it('should have commands mock', () => {
      expect(vscode.commands).toBeDefined();
      expect(vscode.commands.registerCommand).toBeDefined();
    });

    it('should have Uri class', () => {
      const uri = vscode.Uri.file('/test/path');
      expect(uri.scheme).toBe('file');
      expect(uri.path).toBe('/test/path');
    });

    it('should have EventEmitter class', () => {
      const emitter = new vscode.EventEmitter<string>();
      const listener = vi.fn();

      emitter.event(listener);
      emitter.fire('test');

      expect(listener).toHaveBeenCalledWith('test');
    });

    it('should have Disposable class', () => {
      const disposeFn = vi.fn();
      const disposable = new vscode.Disposable(disposeFn);

      disposable.dispose();
      expect(disposeFn).toHaveBeenCalled();
    });
  });

  describe('Browser API Mocks', () => {
    it('should have performance API', () => {
      expect(performance).toBeDefined();
      expect(performance.now).toBeDefined();
      expect(typeof performance.now()).toBe('number');
    });

    it('should have ResizeObserver', () => {
      expect(ResizeObserver).toBeDefined();

      const callback = vi.fn();
      const observer = new ResizeObserver(callback);
      const element = document.createElement('div');

      observer.observe(element);
      observer.disconnect();
    });

    it('should have MessageEvent', () => {
      expect(MessageEvent).toBeDefined();

      const event = new MessageEvent('message', {
        data: { test: 'data' },
        origin: 'http://localhost',
      });

      expect(event.data).toEqual({ test: 'data' });
      expect(event.origin).toBe('http://localhost');
    });

    it('should have CustomEvent', () => {
      expect(CustomEvent).toBeDefined();

      const event = new CustomEvent('custom', {
        detail: { custom: 'detail' },
      });

      expect(event.detail).toEqual({ custom: 'detail' });
    });

    it('should have requestAnimationFrame', () => {
      expect(requestAnimationFrame).toBeDefined();
      expect(cancelAnimationFrame).toBeDefined();

      const callback = vi.fn();
      const id = requestAnimationFrame(callback);
      cancelAnimationFrame(id);
    });
  });

  describe('DOM Operations', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = 'test-container';
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('should create and manipulate DOM elements', () => {
      const element = document.createElement('span');
      element.textContent = 'Hello';
      element.className = 'test-class';
      container.appendChild(element);

      expect(container.querySelector('.test-class')).toBe(element);
      expect(element.textContent).toBe('Hello');
    });

    it('should handle events', () => {
      const button = document.createElement('button');
      const clickHandler = vi.fn();

      button.addEventListener('click', clickHandler);
      container.appendChild(button);

      button.click();
      expect(clickHandler).toHaveBeenCalled();
    });

    it('should handle classList operations', () => {
      const element = document.createElement('div');

      element.classList.add('class1', 'class2');
      expect(element.classList.contains('class1')).toBe(true);
      expect(element.classList.contains('class2')).toBe(true);

      element.classList.remove('class1');
      expect(element.classList.contains('class1')).toBe(false);

      element.classList.toggle('class3');
      expect(element.classList.contains('class3')).toBe(true);
    });
  });

  describe('Lifecycle Hooks', () => {
    let setupValue: string;

    beforeEach(() => {
      setupValue = 'initialized';
    });

    afterEach(() => {
      setupValue = '';
    });

    it('should run beforeEach hook', () => {
      expect(setupValue).toBe('initialized');
    });

    it('should isolate test state', () => {
      setupValue = 'modified';
      expect(setupValue).toBe('modified');
    });

    it('should reset state between tests', () => {
      expect(setupValue).toBe('initialized');
    });
  });
});
