import * as vscode from 'vscode';
import { TerminalEvent, TerminalInstance, TerminalState } from '../../types/shared';

export class TerminalEventHub {
  private readonly dataEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly exitEmitter = new vscode.EventEmitter<TerminalEvent>();
  private readonly createdEmitter = new vscode.EventEmitter<TerminalInstance>();
  private readonly removedEmitter = new vscode.EventEmitter<string>();
  private readonly stateUpdateEmitter = new vscode.EventEmitter<TerminalState>();
  private readonly focusEmitter = new vscode.EventEmitter<string>();
  private outputEmitter?: vscode.EventEmitter<{ terminalId: string; data: string }>;

  public readonly onData = this.dataEmitter.event;
  public readonly onExit = this.exitEmitter.event;
  public readonly onTerminalCreated = this.createdEmitter.event;
  public readonly onTerminalRemoved = this.removedEmitter.event;
  public readonly onStateUpdate = this.stateUpdateEmitter.event;
  public readonly onTerminalFocus = this.focusEmitter.event;

  public get onOutput(): vscode.Event<{ terminalId: string; data: string }> {
    return this.ensureOutputEmitter().event;
  }

  public fireData(event: TerminalEvent): void {
    this.dataEmitter.fire(event);
  }

  public fireExit(event: TerminalEvent): void {
    this.exitEmitter.fire(event);
  }

  public fireTerminalCreated(terminal: TerminalInstance): void {
    this.createdEmitter.fire(terminal);
  }

  public fireTerminalRemoved(terminalId: string): void {
    this.removedEmitter.fire(terminalId);
  }

  public fireStateUpdate(state: TerminalState): void {
    this.stateUpdateEmitter.fire(state);
  }

  public fireTerminalFocus(terminalId: string): void {
    this.focusEmitter.fire(terminalId);
  }

  public fireOutput(event: { terminalId: string; data: string }): void {
    this.outputEmitter?.fire(event);
  }

  public dispose(): void {
    this.dataEmitter.dispose();
    this.exitEmitter.dispose();
    this.createdEmitter.dispose();
    this.removedEmitter.dispose();
    this.stateUpdateEmitter.dispose();
    this.focusEmitter.dispose();
    this.outputEmitter?.dispose();
  }

  private ensureOutputEmitter(): vscode.EventEmitter<{ terminalId: string; data: string }> {
    if (!this.outputEmitter) {
      this.outputEmitter = new vscode.EventEmitter<{ terminalId: string; data: string }>();
    }
    return this.outputEmitter;
  }
}
