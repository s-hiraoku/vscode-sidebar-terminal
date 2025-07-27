import { TerminalInstance } from '../types/common';

/**
 * ターミナル番号管理を担当するヘルパークラス
 * ターミナル名から番号を抽出し、利用可能な番号を管理する
 */
export class TerminalNumberManager {
  private readonly maxTerminals: number;

  constructor(maxTerminals: number) {
    this.maxTerminals = maxTerminals;
  }

  /**
   * 使用中のターミナル番号を取得
   */
  private getUsedNumbers(terminals: Map<string, TerminalInstance>): Set<number> {
    const usedNumbers = new Set<number>();
    for (const terminal of terminals.values()) {
      const match = terminal.name.match(/Terminal (\d+)/);
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }
    return usedNumbers;
  }

  /**
   * 利用可能な最小番号を検索
   */
  findAvailableNumber(terminals: Map<string, TerminalInstance>): number {
    const usedNumbers = this.getUsedNumbers(terminals);
    for (let i = 1; i <= this.maxTerminals; i++) {
      if (!usedNumbers.has(i)) {
        return i;
      }
    }
    // 見つからない場合は最大値を返す（エラーケース）
    return this.maxTerminals;
  }

  /**
   * 新しいターミナルを作成できるかチェック
   */
  canCreate(terminals: Map<string, TerminalInstance>): boolean {
    const usedNumbers = this.getUsedNumbers(terminals);
    // 空きスロットがあるかチェック
    for (let i = 1; i <= this.maxTerminals; i++) {
      if (!usedNumbers.has(i)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 利用可能なスロット番号の配列を取得
   */
  getAvailableSlots(terminals: Map<string, TerminalInstance>): number[] {
    const usedNumbers = this.getUsedNumbers(terminals);
    const availableSlots: number[] = [];
    for (let i = 1; i <= this.maxTerminals; i++) {
      if (!usedNumbers.has(i)) {
        availableSlots.push(i);
      }
    }
    return availableSlots;
  }

  /**
   * 特定の番号を確保（セッション復元用）
   * 既に使用されている場合は利用可能な番号を返す
   */
  allocateNumber(preferredNumber: number, terminals: Map<string, TerminalInstance>): number {
    const usedNumbers = this.getUsedNumbers(terminals);

    // 希望番号が利用可能なら使用
    if (
      preferredNumber >= 1 &&
      preferredNumber <= this.maxTerminals &&
      !usedNumbers.has(preferredNumber)
    ) {
      return preferredNumber;
    }

    // 希望番号が使用できない場合は利用可能な最小番号を返す
    return this.findAvailableNumber(terminals);
  }
}
