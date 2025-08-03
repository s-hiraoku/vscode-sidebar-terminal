/**
 * Domain Layer - Terminal Service Interface
 * 
 * ビジネスロジック層のターミナルサービス定義
 */

export interface Terminal {
  id: string;
  name: string;
  number: number;
  isActive: boolean;
  cwd?: string;
  createdAt?: number;
}

export interface TerminalCreationOptions {
  name?: string;
  cwd?: string;
  shellArgs?: string[];
  env?: Record<string, string>;
}

export interface TerminalOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Domain層のターミナルサービス
 */
export interface ITerminalService {
  // ターミナル管理
  createTerminal(options?: TerminalCreationOptions): Promise<TerminalOperationResult<string>>;
  deleteTerminal(terminalId: string): Promise<TerminalOperationResult>;
  getTerminal(terminalId: string): Terminal | null;
  getAllTerminals(): Terminal[];
  
  // ターミナル操作
  writeToTerminal(terminalId: string, data: string): TerminalOperationResult;
  resizeTerminal(terminalId: string, cols: number, rows: number): TerminalOperationResult;
  
  // 状態管理
  setActiveTerminal(terminalId: string): TerminalOperationResult;
  getActiveTerminal(): Terminal | null;
  
  // イベント
  onTerminalCreated: (callback: (terminal: Terminal) => void) => void;
  onTerminalDeleted: (callback: (terminalId: string) => void) => void;
  onTerminalDataReceived: (callback: (terminalId: string, data: string) => void) => void;
}