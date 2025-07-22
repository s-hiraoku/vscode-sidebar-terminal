import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  CliAgentIntegrationManager,
  CliAgentStatusEvent,
} from '../../../integration/CliAgentIntegrationManager';
import { CliAgentStatus, CliAgentType } from '../../../integration/CliAgentStateService';

describe('CliAgentIntegrationManager - 3状態システム', () => {
  let sandbox: sinon.SinonSandbox;
  let manager: CliAgentIntegrationManager;
  let statusChangeEvents: Array<CliAgentStatusEvent> = [];

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // ManagerとEvent監視の設定
    manager = new CliAgentIntegrationManager();
    manager.onCliAgentStatusChange((event) => {
      statusChangeEvents.push(event);
    });

    statusChangeEvents = [];
  });

  afterEach(() => {
    manager.dispose();
    sandbox.restore();
  });

  describe('基本的な状態遷移', () => {
    it('初期状態はNONE', () => {
      const status = manager.getCliAgentStatus('terminal1');
      assert.strictEqual(status, CliAgentStatus.NONE);
    });

    it('CLI Agent起動でCONNECTEDに遷移', () => {
      // Claude CLI起動をシミュレート
      manager.trackInput('terminal1', 'claude\r');

      const status = manager.getCliAgentStatus('terminal1');
      assert.strictEqual(status, CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.isCliAgentConnected('terminal1'), true);

      // イベントが発火されることを確認
      assert.strictEqual(statusChangeEvents.length, 1);
      assert.deepStrictEqual(statusChangeEvents[0], {
        terminalId: 'terminal1',
        type: 'claude',
        status: CliAgentStatus.CONNECTED,
      });
    });

    it('CLI Agent終了でNONEに遷移', () => {
      // CLI Agent起動
      manager.trackInput('terminal1', 'claude\r');

      // 終了パターンを送信
      manager.handleTerminalOutput('terminal1', 'goodbye');

      const status = manager.getCliAgentStatus('terminal1');
      assert.strictEqual(status, CliAgentStatus.NONE);

      // 終了イベントが発火されることを確認
      const lastEvent = statusChangeEvents[statusChangeEvents.length - 1];
      assert.deepStrictEqual(lastEvent, {
        terminalId: 'terminal1',
        type: null,
        status: CliAgentStatus.NONE,
      });
    });
  });

  describe('相互排他制御', () => {
    it('新しいCLI Agent起動時、既存のCONNECTEDはDISCONNECTEDに変更', () => {
      // Terminal1でClaude CLI起動
      manager.trackInput('terminal1', 'claude\r');
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);

      // Terminal2でClaude CLI起動
      manager.trackInput('terminal2', 'claude\r');

      // Terminal1はDISCONNECTEDに、Terminal2はCONNECTEDに
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.DISCONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.CONNECTED);

      // グローバルアクティブの確認
      assert.strictEqual(manager.isGloballyActive('terminal1'), false);
      assert.strictEqual(manager.isGloballyActive('terminal2'), true);
    });

    it('異なるタイプのCLI Agent間でも相互排他が動作', () => {
      // Terminal1でClaude CLI起動
      manager.trackInput('terminal1', 'claude\r');

      // Terminal2でGemini CLI起動
      manager.trackInput('terminal2', 'gemini\r');

      // Terminal1はDISCONNECTED、Terminal2はCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.DISCONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.getAgentType('terminal1'), 'claude');
      assert.strictEqual(manager.getAgentType('terminal2'), 'gemini');
    });

    it('3つ以上のターミナルでの相互排他', () => {
      // Terminal1, 2, 3で順番にCLI Agent起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'claude\r');
      manager.trackInput('terminal3', 'gemini\r');

      // Terminal3のみCONNECTED、他はDISCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.DISCONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.DISCONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal3'), CliAgentStatus.CONNECTED);

      // グローバルアクティブエージェントの確認
      const globalActive = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(globalActive, {
        terminalId: 'terminal3',
        type: 'gemini',
      });
    });
  });

  describe('自動昇格システム', () => {
    it('CONNECTEDが終了するとDISCONNECTEDが自動的にCONNECTEDに昇格', () => {
      // Terminal1, 2でCLI Agent起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');

      // Terminal2がCONNECTED、Terminal1がDISCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.DISCONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.CONNECTED);

      // Terminal2のCLI Agentが終了
      manager.handleTerminalOutput('terminal2', 'goodbye');

      // Terminal1が自動的にCONNECTEDに昇格
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.NONE);

      // 昇格イベントが発火されることを確認
      const promotionEvent = statusChangeEvents.find(
        (e) => e.terminalId === 'terminal1' && e.status === CliAgentStatus.CONNECTED
      );
      assert.ok(promotionEvent, 'Terminal1の昇格イベントが発火されるべき');
    });

    it('複数のDISCONNECTEDがある場合、最初の1つが昇格', () => {
      // 3つのCLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');
      manager.trackInput('terminal3', 'claude\r');

      // Terminal3がCONNECTED、他はDISCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('terminal3'), CliAgentStatus.CONNECTED);

      // Terminal3が終了
      manager.handleTerminalOutput('terminal3', 'exit');

      // Terminal1が昇格（最初にDISCONNECTEDになったもの）
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.DISCONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal3'), CliAgentStatus.NONE);
    });

    it('DISCONNECTEDがない場合は昇格なし', () => {
      // Terminal1のみでCLI Agent起動
      manager.trackInput('terminal1', 'claude\r');
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);

      // Terminal1が終了
      manager.handleTerminalOutput('terminal1', 'goodbye');

      // 昇格するものがない
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.NONE);
      assert.strictEqual(manager.getCurrentGloballyActiveAgent(), null);
    });
  });

  describe('終了パターン検出', () => {
    beforeEach(() => {
      // CLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');
    });

    it('明示的終了パターンで終了検知', () => {
      const exitPatterns = [
        'goodbye',
        'chat ended',
        'session terminated',
        'exiting',
        'bye',
        'quit',
        'exit',
      ];

      exitPatterns.forEach((pattern, index) => {
        const terminalId = `terminal-${index}`;
        manager.trackInput(terminalId, 'claude\r');
        manager.handleTerminalOutput(terminalId, pattern);
        assert.strictEqual(
          manager.getCliAgentStatus(terminalId),
          CliAgentStatus.NONE,
          `Pattern "${pattern}" should trigger termination`
        );
      });
    });

    it('中断パターン（Ctrl+C）で終了検知', () => {
      const interruptPatterns = ['^c', 'keyboardinterrupt', 'sigint', 'interrupted', 'cancelled'];

      interruptPatterns.forEach((pattern, index) => {
        const terminalId = `terminal-int-${index}`;
        manager.trackInput(terminalId, 'claude\r');
        manager.handleTerminalOutput(terminalId, pattern);
        assert.strictEqual(
          manager.getCliAgentStatus(terminalId),
          CliAgentStatus.NONE,
          `Pattern "${pattern}" should trigger termination`
        );
      });
    });

    it('プロンプト復帰パターンで終了検知', () => {
      const promptPatterns = ['$ ', '% ', '> ', 'user@host:~$ ', '➜  ~ '];

      promptPatterns.forEach((pattern, index) => {
        const terminalId = `terminal-prompt-${index}`;
        manager.trackInput(terminalId, 'claude\r');
        manager.handleTerminalOutput(terminalId, `\n${pattern}`);
        assert.strictEqual(
          manager.getCliAgentStatus(terminalId),
          CliAgentStatus.NONE,
          `Prompt pattern "${pattern}" should trigger termination`
        );
      });
    });

    it('複数行にわたるプロンプトパターンの検知', () => {
      // 複数行の出力でプロンプトに戻るケース
      manager.handleTerminalOutput('terminal1', 'Processing...\n');
      manager.handleTerminalOutput('terminal1', 'Done.\n');
      manager.handleTerminalOutput('terminal1', 'user@host:~$ ');

      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.NONE);
    });
  });

  describe('起動パターン検出', () => {
    it('コマンド入力からClaude CLI検出', () => {
      const claudeCommands = ['claude', 'claude --help', 'claude chat'];

      claudeCommands.forEach((cmd, index) => {
        const terminalId = `terminal-cmd-${index}`;
        manager.trackInput(terminalId, `${cmd}\r`);
        assert.strictEqual(manager.getAgentType(terminalId), 'claude');
        assert.strictEqual(manager.getCliAgentStatus(terminalId), CliAgentStatus.CONNECTED);
      });
    });

    it('コマンド入力からGemini CLI検出', () => {
      const geminiCommands = ['gemini', 'gemini --version', 'gemini chat'];

      geminiCommands.forEach((cmd, index) => {
        const terminalId = `terminal-gcmd-${index}`;
        manager.trackInput(terminalId, `${cmd}\r`);
        assert.strictEqual(manager.getAgentType(terminalId), 'gemini');
        assert.strictEqual(manager.getCliAgentStatus(terminalId), CliAgentStatus.CONNECTED);
      });
    });

    it('出力パターンからClaude CLI検出', () => {
      const claudePatterns = [
        'welcome to claude code',
        'Claude.ai assistant',
        'Human: Hello',
        'Assistant: Hi there',
      ];

      claudePatterns.forEach((pattern, index) => {
        const terminalId = `terminal-cout-${index}`;
        manager.handleTerminalOutput(terminalId, pattern);
        assert.strictEqual(manager.getAgentType(terminalId), 'claude');
      });
    });

    it('出力パターンからGemini CLI検出', () => {
      const geminiPatterns = ['Welcome to Gemini', 'Google AI ready', 'User: Hello', 'Model: Hi'];

      geminiPatterns.forEach((pattern, index) => {
        const terminalId = `terminal-gout-${index}`;
        manager.handleTerminalOutput(terminalId, pattern);
        assert.strictEqual(manager.getAgentType(terminalId), 'gemini');
      });
    });
  });

  describe('状態クエリAPI', () => {
    beforeEach(() => {
      // 複数のCLI Agentをセットアップ
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');
      manager.trackInput('terminal3', 'claude\r');
    });

    it('getAllAgents - すべてのCLI Agent情報を取得', () => {
      const allAgents = manager.getAllAgents();
      assert.strictEqual(allAgents.length, 3);

      // 各エージェントの状態を確認
      const agent1 = allAgents.find((a) => a.terminalId === 'terminal1');
      assert.strictEqual(agent1?.agentInfo.status, CliAgentStatus.DISCONNECTED);
      assert.strictEqual(agent1?.agentInfo.type, 'claude');

      const agent3 = allAgents.find((a) => a.terminalId === 'terminal3');
      assert.strictEqual(agent3?.agentInfo.status, CliAgentStatus.CONNECTED);
    });

    it('getConnectedAgents - CONNECTEDのみ取得', () => {
      const connectedAgents = manager.getConnectedAgents();
      assert.strictEqual(connectedAgents.length, 1);
      assert.strictEqual(connectedAgents[0]?.terminalId, 'terminal3');
      assert.strictEqual(connectedAgents[0]?.agentInfo.status, CliAgentStatus.CONNECTED);
    });

    it('getCurrentGloballyActiveAgent - グローバルアクティブ情報', () => {
      const globalActive = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(globalActive, {
        terminalId: 'terminal3',
        type: 'claude',
      });
    });

    it('isGloballyActive - 特定ターミナルのグローバル状態確認', () => {
      assert.strictEqual(manager.isGloballyActive('terminal1'), false);
      assert.strictEqual(manager.isGloballyActive('terminal2'), false);
      assert.strictEqual(manager.isGloballyActive('terminal3'), true);
    });
  });

  describe('クリーンアップとリソース管理', () => {
    it('cleanupTerminal - ターミナル削除時の適切なクリーンアップ', () => {
      // 3つのCLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');
      manager.trackInput('terminal3', 'claude\r');

      // Terminal2（DISCONNECTED）を削除
      manager.cleanupTerminal('terminal2');

      // Terminal2の情報が完全に削除される
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.NONE);
      assert.strictEqual(manager.getAgentType('terminal2'), null);

      // 他のターミナルは影響を受けない
      assert.strictEqual(manager.getCliAgentStatus('terminal3'), CliAgentStatus.CONNECTED);
    });

    it('cleanupTerminal - CONNECTED削除時の自動昇格', () => {
      // 2つのCLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');

      // Terminal2（CONNECTED）を削除
      manager.cleanupTerminal('terminal2');

      // Terminal1が自動的にCONNECTEDに昇格
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.NONE);
    });

    it('deactivateAllAgents - 全CLI Agentの強制終了', () => {
      // 複数のCLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');

      // 全て強制終了
      manager.deactivateAllAgents();

      // 全てNONE状態になる
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.NONE);
      assert.strictEqual(manager.getCliAgentStatus('terminal2'), CliAgentStatus.NONE);
      assert.strictEqual(manager.getCurrentGloballyActiveAgent(), null);
    });

    it('dispose - 完全なリソースクリーンアップ', () => {
      // CLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');

      // dispose実行
      manager.dispose();

      // 新しいインスタンスを作成して確認
      const newManager = new CliAgentIntegrationManager();
      assert.strictEqual(newManager.getCliAgentStatus('terminal1'), CliAgentStatus.NONE);
      assert.strictEqual(newManager.getCurrentGloballyActiveAgent(), null);

      newManager.dispose();
    });
  });

  describe('複数ターミナルの複雑なインタラクション', () => {
    it('5つのターミナルで連続的な切り替え', () => {
      // 5つのターミナルを作成し、順番にCLI Agentを起動
      const terminals = ['term1', 'term2', 'term3', 'term4', 'term5'];

      // 順番に起動
      terminals.forEach((termId, index) => {
        const agentType = index % 2 === 0 ? 'claude' : 'gemini';
        manager.trackInput(termId, `${agentType}\r`);

        // 最新のターミナルがCONNECTED
        assert.strictEqual(manager.getCliAgentStatus(termId), CliAgentStatus.CONNECTED);

        // 他の全てのターミナルはDISCONNECTED（最初の1つを除く）
        terminals.slice(0, index).forEach((prevTermId) => {
          assert.strictEqual(manager.getCliAgentStatus(prevTermId), CliAgentStatus.DISCONNECTED);
        });
      });

      // 最終状態: term5のみCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('term5'), CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.getAgentType('term5'), 'gemini');
    });

    it('ランダムな順序での終了と昇格', () => {
      // 4つのCLI Agentを起動
      manager.trackInput('term1', 'claude\r');
      manager.trackInput('term2', 'gemini\r');
      manager.trackInput('term3', 'claude\r');
      manager.trackInput('term4', 'gemini\r');

      // term4がCONNECTED、他はDISCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('term4'), CliAgentStatus.CONNECTED);

      // 中間のterm2を終了
      manager.handleTerminalOutput('term2', 'goodbye');
      assert.strictEqual(manager.getCliAgentStatus('term2'), CliAgentStatus.NONE);
      // term4はまだCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('term4'), CliAgentStatus.CONNECTED);

      // CONNECTEDなterm4を終了
      manager.handleTerminalOutput('term4', 'exit');
      // term1が昇格される（最初のDISCONNECTED）
      assert.strictEqual(manager.getCliAgentStatus('term1'), CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('term3'), CliAgentStatus.DISCONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('term4'), CliAgentStatus.NONE);
    });

    it('高速な切り替えシナリオ', () => {
      // 短時間で複数のターミナル間を切り替え
      const switchSequence = [
        { terminal: 't1', agent: 'claude' },
        { terminal: 't2', agent: 'gemini' },
        { terminal: 't1', agent: 'claude' }, // 同じターミナルで再実行
        { terminal: 't3', agent: 'claude' },
        { terminal: 't2', agent: 'gemini' }, // 同じターミナルで再実行
        { terminal: 't4', agent: 'gemini' },
      ];

      switchSequence.forEach((action, index) => {
        manager.trackInput(action.terminal, `${action.agent}\r`);

        // 最新のアクションのターミナルがCONNECTED
        assert.strictEqual(
          manager.getCliAgentStatus(action.terminal),
          CliAgentStatus.CONNECTED,
          `Step ${index}: ${action.terminal} should be CONNECTED`
        );

        // グローバルアクティブの確認
        const globalActive = manager.getCurrentGloballyActiveAgent();
        assert.strictEqual(globalActive?.terminalId, action.terminal);
        assert.strictEqual(globalActive?.type, action.agent);
      });
    });

    it('複数ターミナルの同時終了と昇格チェーン', () => {
      // 5つのCLI Agentを起動
      const terminals = ['t1', 't2', 't3', 't4', 't5'];
      terminals.forEach((t) => manager.trackInput(t, 'claude\r'));

      // t5がCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('t5'), CliAgentStatus.CONNECTED);

      // t5を終了 → t1が昇格
      manager.handleTerminalOutput('t5', 'goodbye');
      assert.strictEqual(manager.getCliAgentStatus('t1'), CliAgentStatus.CONNECTED);

      // t1を終了 → t2が昇格
      manager.handleTerminalOutput('t1', 'exit');
      assert.strictEqual(manager.getCliAgentStatus('t2'), CliAgentStatus.CONNECTED);

      // t2を終了 → t3が昇格
      manager.handleTerminalOutput('t2', '^c');
      assert.strictEqual(manager.getCliAgentStatus('t3'), CliAgentStatus.CONNECTED);

      // 残りのDISCONNECTEDを確認
      assert.strictEqual(manager.getCliAgentStatus('t4'), CliAgentStatus.DISCONNECTED);
    });

    it('異なるタイプのCLI Agent混在環境での管理', () => {
      // 異なるタイプを交互に起動
      const config = [
        { id: 'terminal-a', type: 'claude' },
        { id: 'terminal-b', type: 'gemini' },
        { id: 'terminal-c', type: 'claude' },
        { id: 'terminal-d', type: 'gemini' },
        { id: 'terminal-e', type: 'claude' },
      ];

      config.forEach(({ id, type }) => {
        manager.trackInput(id, `${type}\r`);
      });

      // タイプ別にカウント
      const allAgents = manager.getAllAgents();
      const claudeCount = allAgents.filter((a) => a.agentInfo.type === 'claude').length;
      const geminiCount = allAgents.filter((a) => a.agentInfo.type === 'gemini').length;

      assert.strictEqual(claudeCount, 3);
      assert.strictEqual(geminiCount, 2);

      // CONNECTEDは1つのみ
      const connectedAgents = manager.getConnectedAgents();
      assert.strictEqual(connectedAgents.length, 1);
      assert.strictEqual(connectedAgents[0]?.terminalId, 'terminal-e');
    });

    it('ターミナル削除時の昇格動作', () => {
      // 3つのCLI Agentを起動
      manager.trackInput('term-x', 'claude\r');
      manager.trackInput('term-y', 'gemini\r');
      manager.trackInput('term-z', 'claude\r');

      // term-zがCONNECTED
      assert.strictEqual(manager.getCliAgentStatus('term-z'), CliAgentStatus.CONNECTED);

      // CONNECTEDなterm-zを削除（cleanupTerminal経由）
      manager.cleanupTerminal('term-z');

      // term-xが自動昇格（最初のDISCONNECTED）
      assert.strictEqual(manager.getCliAgentStatus('term-x'), CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('term-y'), CliAgentStatus.DISCONNECTED);
      assert.strictEqual(manager.getCliAgentStatus('term-z'), CliAgentStatus.NONE);
    });
  });

  describe('エッジケースと境界条件', () => {
    it('同じターミナルで異なるCLI Agentタイプへの切り替え', () => {
      // ClaudeからGeminiへ切り替え
      manager.trackInput('terminal1', 'claude\r');
      assert.strictEqual(manager.getAgentType('terminal1'), 'claude');

      manager.handleTerminalOutput('terminal1', 'exit');
      manager.trackInput('terminal1', 'gemini\r');

      assert.strictEqual(manager.getAgentType('terminal1'), 'gemini');
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);
    });

    it('存在しないターミナルIDへのクエリ', () => {
      assert.strictEqual(manager.getCliAgentStatus('non-existent'), CliAgentStatus.NONE);
      assert.strictEqual(manager.getAgentType('non-existent'), null);
      assert.strictEqual(manager.isCliAgentConnected('non-existent'), false);
      assert.strictEqual(manager.isGloballyActive('non-existent'), false);
    });

    it('重複した起動コマンドの処理', () => {
      // 同じターミナルで2回起動コマンド
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal1', 'claude\r');

      // 状態は変わらない
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);

      // イベントは1回のみ発火（重複なし）
      const connectedEvents = statusChangeEvents.filter(
        (e) => e.terminalId === 'terminal1' && e.status === CliAgentStatus.CONNECTED
      );
      assert.strictEqual(connectedEvents.length, 1);
    });

    it('部分的なコマンド入力の処理', () => {
      // 改行なしの部分的入力
      manager.trackInput('terminal1', 'clau');
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.NONE);

      // 残りを入力して改行
      manager.trackInput('terminal1', 'de\r');
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);
      assert.strictEqual(manager.getAgentType('terminal1'), 'claude');
    });
  });

  describe('CMD+OPT+L データ送信対象特定テスト', () => {
    it('CONNECTEDなCLI Agentが送信対象として特定される', () => {
      // 複数のCLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');
      manager.trackInput('terminal3', 'claude\r');

      // terminal3がCONNECTED状態
      assert.strictEqual(manager.getCliAgentStatus('terminal3'), CliAgentStatus.CONNECTED);

      // CMD+OPT+L送信対象の特定
      const activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'terminal3',
        type: 'claude',
      });

      // 送信対象の確認
      assert.strictEqual(manager.isGloballyActive('terminal1'), false);
      assert.strictEqual(manager.isGloballyActive('terminal2'), false);
      assert.strictEqual(manager.isGloballyActive('terminal3'), true);
    });

    it('CLI Agent未起動時は送信対象なし', () => {
      // CLI Agent未起動状態
      const activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.strictEqual(activeAgent, null);

      // どのターミナルも送信対象ではない
      assert.strictEqual(manager.isGloballyActive('terminal1'), false);
      assert.strictEqual(manager.isGloballyActive('terminal2'), false);
    });

    it('送信対象の動的切り替え', () => {
      // Terminal1でClaude CLI起動 → 送信対象
      manager.trackInput('terminal1', 'claude\r');
      let activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'terminal1',
        type: 'claude',
      });

      // Terminal2でGemini CLI起動 → 送信対象が切り替わり
      manager.trackInput('terminal2', 'gemini\r');
      activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'terminal2',
        type: 'gemini',
      });

      // Terminal3でClaude CLI起動 → さらに切り替わり
      manager.trackInput('terminal3', 'claude\r');
      activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'terminal3',
        type: 'claude',
      });
    });

    it('送信対象終了時の自動切り替え', () => {
      // 複数のCLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');
      manager.trackInput('terminal3', 'claude\r');

      // terminal3が送信対象
      let activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.strictEqual(activeAgent?.terminalId, 'terminal3');

      // 送信対象のCLI Agentを終了
      manager.handleTerminalOutput('terminal3', 'goodbye');

      // 自動的にterminal1に切り替わり
      activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'terminal1',
        type: 'claude',
      });

      // 送信対象状態の確認
      assert.strictEqual(manager.isGloballyActive('terminal1'), true);
      assert.strictEqual(manager.isGloballyActive('terminal2'), false);
      assert.strictEqual(manager.isGloballyActive('terminal3'), false);
    });

    it('連続終了による送信対象の順次切り替え', () => {
      // 4つのCLI Agentを順次起動
      const terminals = ['term-a', 'term-b', 'term-c', 'term-d'];
      terminals.forEach((termId) => {
        manager.trackInput(termId, 'claude\r');
      });

      // term-dが送信対象
      let activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.strictEqual(activeAgent?.terminalId, 'term-d');

      // 連続で終了させ、送信対象が順次切り替わることを確認
      const expectedSequence = ['term-d', 'term-a', 'term-b', 'term-c'];

      for (let i = 0; i < expectedSequence.length - 1; i++) {
        const currentTarget = expectedSequence[i];
        const nextTarget = expectedSequence[i + 1];

        // 現在の送信対象を終了
        if (currentTarget) {
          manager.handleTerminalOutput(currentTarget, 'exit');
        }

        // 次の送信対象に切り替わる
        activeAgent = manager.getCurrentGloballyActiveAgent();
        assert.strictEqual(
          activeAgent?.terminalId,
          nextTarget,
          `Step ${i}: Expected next target to be ${nextTarget}`
        );
      }
    });

    it('異なるCLI Agentタイプでの送信対象管理', () => {
      // Claude → Gemini → Claude の順で起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');
      manager.trackInput('terminal3', 'claude\r');

      // terminal3 (Claude) が送信対象
      let activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'terminal3',
        type: 'claude',
      });

      // Gemini CLI起動で送信対象が切り替わり
      manager.trackInput('terminal4', 'gemini\r');
      activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'terminal4',
        type: 'gemini',
      });

      // 現在の送信対象を終了 → Claude (terminal1) に切り替わり
      manager.handleTerminalOutput('terminal4', 'bye');
      activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'terminal1',
        type: 'claude',
      });
    });

    it('送信対象のターミナル削除による自動切り替え', () => {
      // 3つのCLI Agentを起動
      manager.trackInput('term-1', 'claude\r');
      manager.trackInput('term-2', 'gemini\r');
      manager.trackInput('term-3', 'claude\r');

      // term-3が送信対象
      assert.strictEqual(manager.isGloballyActive('term-3'), true);

      // 送信対象のターミナルを削除（VS Codeのターミナル削除をシミュレート）
      manager.cleanupTerminal('term-3');

      // 自動的にterm-1に切り替わり
      let activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'term-1',
        type: 'claude',
      });

      // 次の送信対象も削除
      manager.cleanupTerminal('term-1');

      // term-2に切り替わり
      activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.deepStrictEqual(activeAgent, {
        terminalId: 'term-2',
        type: 'gemini',
      });
    });

    it('全CLI Agent終了後の送信対象なし状態', () => {
      // 複数のCLI Agentを起動
      manager.trackInput('terminal1', 'claude\r');
      manager.trackInput('terminal2', 'gemini\r');

      // 初期送信対象の確認
      assert.notStrictEqual(manager.getCurrentGloballyActiveAgent(), null);

      // 全てのCLI Agentを強制終了
      manager.deactivateAllAgents();

      // 送信対象がなくなる
      assert.strictEqual(manager.getCurrentGloballyActiveAgent(), null);
      assert.strictEqual(manager.isGloballyActive('terminal1'), false);
      assert.strictEqual(manager.isGloballyActive('terminal2'), false);
    });

    it('送信対象の一意性保証', () => {
      // 10個のCLI Agentを同時起動
      const terminals = Array.from({ length: 10 }, (_, i) => `terminal-${i}`);
      terminals.forEach((termId) => {
        manager.trackInput(termId, 'claude\r');
      });

      // 送信対象は必ず1つのみ
      const connectedAgents = manager.getConnectedAgents();
      assert.strictEqual(connectedAgents.length, 1, 'Connected agents must be exactly 1');

      const activeAgent = manager.getCurrentGloballyActiveAgent();
      assert.strictEqual(activeAgent?.terminalId, 'terminal-9'); // 最後に起動したもの

      // isGloballyActiveで確認
      let activeCount = 0;
      terminals.forEach((termId) => {
        if (manager.isGloballyActive(termId)) {
          activeCount++;
        }
      });
      assert.strictEqual(activeCount, 1, 'Globally active terminals must be exactly 1');
    });

    it('高頻度切り替え時の送信対象安定性', () => {
      // 高頻度でCLI Agentを切り替え
      const switchCount = 50;
      for (let i = 0; i < switchCount; i++) {
        const terminalId = `rapid-${i % 5}`; // 5つのターミナルでループ
        const agentType = i % 2 === 0 ? 'claude' : 'gemini';

        manager.trackInput(terminalId, `${agentType}\r`);

        // 各段階で送信対象が正確に特定される
        const activeAgent = manager.getCurrentGloballyActiveAgent();
        assert.strictEqual(activeAgent?.terminalId, terminalId);
        assert.strictEqual(activeAgent?.type, agentType);

        // 一意性の保証
        const connectedCount = manager.getConnectedAgents().length;
        assert.strictEqual(
          connectedCount,
          1,
          `Iteration ${i}: Must have exactly 1 connected agent`
        );
      }
    });
  });

  describe('パフォーマンスとメモリ管理', () => {
    it('コマンド履歴のサイズ制限', () => {
      // MAX_HISTORY_SIZE以上のコマンドを送信
      for (let i = 0; i < 150; i++) {
        manager.trackInput('terminal1', `command${i}\r`);
      }

      // 最後のコマンドが取得できる
      const lastCommand = manager.getLastCommand('terminal1');
      assert.strictEqual(lastCommand, 'command149');

      // TODO: 履歴サイズが制限されていることを確認する内部APIが必要
    });

    it('大量の出力データ処理', () => {
      // CLI Agent起動
      manager.trackInput('terminal1', 'claude\r');

      // 大量のデータを送信
      const largeOutput = 'x'.repeat(10000);
      manager.handleTerminalOutput('terminal1', largeOutput);

      // 状態が維持される
      assert.strictEqual(manager.getCliAgentStatus('terminal1'), CliAgentStatus.CONNECTED);
    });
  });
});
