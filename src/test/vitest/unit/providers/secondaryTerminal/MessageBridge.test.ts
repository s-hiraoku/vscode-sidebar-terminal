/**
 * MessageBridge Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as vscode from 'vscode';

import '../../../../shared/TestSetup';
import { MessageBridge } from '../../../../../providers/secondaryTerminal/MessageBridge';
import { WebviewMessage } from '../../../../../types/common';

describe('MessageBridge', () => {
  let extensionContext: vscode.ExtensionContext;
  let bridge: MessageBridge;

  beforeEach(() => {
    extensionContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    bridge = new MessageBridge(extensionContext, vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards validated messages to the handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const validatorSpy = vi.fn();
    const validator = (message: unknown): message is WebviewMessage => {
      validatorSpy(message);
      return true;
    };

    let capturedListener: ((message: WebviewMessage) => void) | undefined;
    const disposable = { dispose: vi.fn() };
    const mockWebviewView = {
      webview: {
        onDidReceiveMessage: (listener: (message: WebviewMessage) => void) => {
          capturedListener = listener;
          return disposable;
        },
      },
    } as unknown as vscode.WebviewView;

    bridge.register(mockWebviewView, validator, handler as any);

    expect(extensionContext.subscriptions).toHaveLength(1);
    expect(extensionContext.subscriptions[0]).toBe(disposable);

    await capturedListener?.({ command: 'input' } as WebviewMessage);

    expect(handler).toHaveBeenCalledOnce();
    expect(validatorSpy).toHaveBeenCalledOnce();
  });

  it('ignores messages that fail validation', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const validatorSpy = vi.fn();
    const validator = (message: unknown): message is WebviewMessage => {
      validatorSpy(message);
      return false;
    };

    let capturedListener: ((message: WebviewMessage) => void) | undefined;
    const mockWebviewView = {
      webview: {
        onDidReceiveMessage: (listener: (message: WebviewMessage) => void) => {
          capturedListener = listener;
          return { dispose: vi.fn() };
        },
      },
    } as unknown as vscode.WebviewView;

    bridge.register(mockWebviewView, validator, handler as any);

    await capturedListener?.({ command: 'input' } as WebviewMessage);

    expect(handler).not.toHaveBeenCalled();
  });
});
