/**
 * Full State Sync Integration Test
 * Tests the complete Extension-WebView state synchronization mechanism
 * that fixes the DISCONNECTED status preservation issue
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { JSDOM } from 'jsdom';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { SecondaryTerminalProvider } from '../../../providers/SecondaryTerminalProvider';

describe('Full State Sync Integration', () => {
  let sandbox: sinon.SinonSandbox;
  let terminalManager: TerminalManager;
  let provider: SecondaryTerminalProvider;
  let mockExtensionContext: vscode.ExtensionContext;
  let dom: JSDOM;
  let _consoleMocks: {
    log: sinon.SinonStub;
    warn: sinon.SinonStub;
    error: sinon.SinonStub;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup complete test environment
    const testEnv = setupCompleteTestEnvironment();
    dom = testEnv.dom;
    _consoleMocks = testEnv.consoleMocks;

    // Create mock extension context
    mockExtensionContext = {
      subscriptions: [],
      globalState: {
        get: sandbox.stub().returns(undefined),
        update: sandbox.stub().resolves(),
        keys: sandbox.stub().returns([]),
        setKeysForSync: sandbox.stub(),
      },
      workspaceState: {
        get: sandbox.stub().returns(undefined),
        update: sandbox.stub().resolves(),
        keys: sandbox.stub().returns([]),
      },
      secrets: {} as vscode.SecretStorage,
      extensionUri: {} as vscode.Uri,
      extensionPath: '/test/path',
      environmentVariableCollection: {} as vscode.EnvironmentVariableCollection,
      asAbsolutePath: sandbox.stub().returnsArg(0),
      storageUri: undefined,
      storagePath: undefined,
      globalStorageUri: {} as vscode.Uri,
      globalStoragePath: '/test/global',
      logUri: {} as vscode.Uri,
      logPath: '/test/log',
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as vscode.Extension<unknown>,
      languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
    } as unknown as vscode.ExtensionContext;

    // Create TerminalManager and SecondaryTerminalProvider
    terminalManager = new TerminalManager();
    provider = new SecondaryTerminalProvider(mockExtensionContext, terminalManager);
  });

  afterEach(() => {
    if (terminalManager) {
      terminalManager.dispose();
    }
    cleanupTestEnvironment(sandbox, dom);
  });

  describe('Extension-WebView State Synchronization', () => {
    it('should send full state sync when CLI Agent status changes', () => {
      // Create three terminals
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      const terminal3 = terminalManager.createTerminal();

      // Set up spies to capture messages sent to WebView
      const sendMessageSpy = sandbox.stub(provider as any, '_sendMessage');

      // Start agents in all three terminals
      (terminalManager as any)._setCurrentAgent(terminal1, 'claude');
      (terminalManager as any)._setCurrentAgent(terminal2, 'gemini');
      (terminalManager as any)._setCurrentAgent(terminal3, 'claude');

      // Verify initial state: terminal3 is CONNECTED, others are DISCONNECTED
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal3);
      expect((terminalManager as any)._disconnectedAgents.has(terminal1)).to.be.true;
      expect((terminalManager as any)._disconnectedAgents.has(terminal2)).to.be.true;

      // Reset the spy to focus on termination events
      sendMessageSpy.resetHistory();

      // Terminate the CONNECTED terminal (terminal3)
      (terminalManager as any)._detectCliAgentTermination(terminal3, 'user@macbook:~/workspace$ ');

      // Verify that sendFullCliAgentStateSync was called
      const fullStateSyncCalls = sendMessageSpy
        .getCalls()
        .filter((call) => call.args[0]?.command === 'cliAgentFullStateSync');

      expect(fullStateSyncCalls.length).to.be.greaterThan(0);

      // Examine the full state sync message
      const stateSyncMessage = fullStateSyncCalls[fullStateSyncCalls.length - 1]?.args[0];
      expect(stateSyncMessage).to.exist;

      console.log('🔍 [TEST] Full state sync message:', stateSyncMessage);

      expect(stateSyncMessage.command).to.equal('cliAgentFullStateSync');
      expect(stateSyncMessage.terminalStates).to.be.an('object');

      // Verify the terminal states are correct
      const states = stateSyncMessage.terminalStates as Record<
        string,
        { status: string; agentType: string | null }
      >;

      // Terminal3 should be 'none' (terminated)
      expect(states[terminal3]).to.deep.include({ status: 'none', agentType: null });

      // One of terminal1/terminal2 should be 'connected' (auto-promoted)
      const connectedTerminals = Object.keys(states).filter(
        (id) => states[id] && states[id].status === 'connected'
      );
      expect(connectedTerminals).to.have.length(1);

      // One of terminal1/terminal2 should be 'disconnected' (remaining agent)
      const disconnectedTerminals = Object.keys(states).filter(
        (id) => states[id] && states[id].status === 'disconnected'
      );
      expect(disconnectedTerminals).to.have.length(1);

      // Critical assertion: No terminal should be left as 'none' if it has an agent
      const noneTerminals = Object.keys(states).filter(
        (id) => states[id] && states[id].status === 'none' && states[id].agentType !== null
      );
      expect(noneTerminals).to.have.length(0);

      console.log('✅ [TEST] Full state sync verification completed successfully');
    });

    it('should preserve DISCONNECTED status across multiple terminations', () => {
      // Create multiple terminals with agents
      const terminals = [
        terminalManager.createTerminal(),
        terminalManager.createTerminal(),
        terminalManager.createTerminal(),
        terminalManager.createTerminal(),
      ];

      // Set up spy for messages
      const sendMessageSpy = sandbox.stub(provider as any, '_sendMessage');

      // Start agents in all terminals
      (terminalManager as any)._setCurrentAgent(terminals[0], 'claude');
      (terminalManager as any)._setCurrentAgent(terminals[1], 'gemini');
      (terminalManager as any)._setCurrentAgent(terminals[2], 'claude');
      (terminalManager as any)._setCurrentAgent(terminals[3], 'gemini');

      // Track state sync messages
      const getLatestStateSyncMessage = (): any => {
        const calls = sendMessageSpy.getCalls();
        const stateSyncCalls = calls.filter(
          (call) => call.args[0]?.command === 'cliAgentFullStateSync'
        );
        const latestCall = stateSyncCalls[stateSyncCalls.length - 1];
        return latestCall ? latestCall.args[0] : null;
      };

      // Simulate multiple terminations and verify state preservation
      sendMessageSpy.resetHistory();

      // First termination: Terminate CONNECTED terminal
      (terminalManager as any)._detectCliAgentTermination(
        terminals[3],
        'user@macbook:~/workspace$ '
      );

      let syncMessage = getLatestStateSyncMessage();
      expect(syncMessage).to.exist;

      // Count statuses after first termination
      let states = syncMessage.terminalStates as Record<
        string,
        { status: string; agentType: string | null }
      >;
      let connectedCount = Object.values(states).filter(
        (s) => s && s.status === 'connected'
      ).length;
      let disconnectedCount = Object.values(states).filter(
        (s) => s && s.status === 'disconnected'
      ).length;
      let noneCount = Object.values(states).filter((s) => s && s.status === 'none').length;

      expect(connectedCount).to.equal(1); // One auto-promoted
      expect(disconnectedCount).to.equal(2); // Two remaining DISCONNECTED
      expect(noneCount).to.equal(1); // One terminated

      // Second termination: Terminate CONNECTED again
      const newConnectedId = (terminalManager as any)._connectedAgentTerminalId;
      (terminalManager as any)._detectCliAgentTermination(
        newConnectedId,
        'user@macbook:~/workspace$ '
      );

      syncMessage = getLatestStateSyncMessage();
      expect(syncMessage).to.exist;

      // Count statuses after second termination
      states = syncMessage.terminalStates as Record<
        string,
        { status: string; agentType: string | null }
      >;
      connectedCount = Object.values(states).filter((s) => s && s.status === 'connected').length;
      disconnectedCount = Object.values(states).filter(
        (s) => s && s.status === 'disconnected'
      ).length;
      noneCount = Object.values(states).filter((s) => s && s.status === 'none').length;

      expect(connectedCount).to.equal(1); // One auto-promoted again
      expect(disconnectedCount).to.equal(1); // One remaining DISCONNECTED
      expect(noneCount).to.equal(2); // Two terminated

      console.log('✅ [TEST] Multiple termination state preservation verified');
    });

    it('should handle edge case: all agents terminated', () => {
      // Create terminals with agents
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();

      const sendMessageSpy = sandbox.stub(provider as any, '_sendMessage');

      // Start agents
      (terminalManager as any)._setCurrentAgent(terminal1, 'claude');
      (terminalManager as any)._setCurrentAgent(terminal2, 'gemini');

      sendMessageSpy.resetHistory();

      // Terminate CONNECTED terminal (terminal2)
      (terminalManager as any)._detectCliAgentTermination(terminal2, 'user@macbook:~/workspace$ ');

      // Now terminal1 should be CONNECTED via auto-promotion
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1);

      // Terminate the last remaining agent
      (terminalManager as any)._detectCliAgentTermination(terminal1, 'user@macbook:~/workspace$ ');

      // Verify final state: all terminals should be 'none'
      const stateSyncCalls = sendMessageSpy
        .getCalls()
        .filter((call) => call.args[0]?.command === 'cliAgentFullStateSync');
      const finalMessage = stateSyncCalls[stateSyncCalls.length - 1]?.args[0];

      expect(finalMessage).to.exist;
      const states = finalMessage.terminalStates as Record<
        string,
        { status: string; agentType: string | null }
      >;

      Object.values(states).forEach((state) => {
        if (state) {
          expect(state.status).to.equal('none');
          expect(state.agentType).to.be.null;
        }
      });

      expect(finalMessage.connectedAgentId).to.be.null;
      expect(finalMessage.connectedAgentType).to.be.null;
      expect(finalMessage.disconnectedCount).to.equal(0);

      console.log('✅ [TEST] All agents terminated edge case handled correctly');
    });
  });
});
