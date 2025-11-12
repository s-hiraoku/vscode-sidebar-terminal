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
    console.log('🔍 [TERMINAL-NUMBER-MANAGER] Analyzing terminals:', terminals.size);

    for (const [id, terminal] of terminals.entries()) {
      console.log(`🔍 [TERMINAL-NUMBER-MANAGER] Terminal ${id}:`, {
        name: terminal.name,
        number: terminal.number,
        hasNumber: typeof terminal.number === 'number',
      });

      // Use terminal.number property directly if available, fallback to name parsing
      if (terminal.number && typeof terminal.number === 'number') {
        usedNumbers.add(terminal.number);
        console.log(`✅ [TERMINAL-NUMBER-MANAGER] Added number from property: ${terminal.number}`);
      } else {
        // Fallback: extract from terminal name for backward compatibility
        const match = terminal.name.match(/Terminal (\d+)/);
        if (match?.[1]) {
          const numberFromName = parseInt(match[1], 10);
          usedNumbers.add(numberFromName);
          console.log(`⚠️ [TERMINAL-NUMBER-MANAGER] Added number from name: ${numberFromName}`);
        } else {
          console.warn(
            `⚠️ [TERMINAL-NUMBER-MANAGER] No number found for terminal: ${terminal.name}`
          );
        }
      }
    }

    console.log('🔍 [TERMINAL-NUMBER-MANAGER] Final used numbers:', Array.from(usedNumbers));
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
    console.log(
      '🔍 [TERMINAL-NUMBER-MANAGER] Used numbers:',
      Array.from(usedNumbers),
      'Max terminals:',
      this.maxTerminals
    );

    // 空きスロットがあるかチェック
    for (let i = 1; i <= this.maxTerminals; i++) {
      if (!usedNumbers.has(i)) {
        console.log(`✅ [TERMINAL-NUMBER-MANAGER] Available slot found: ${i}`);
        return true;
      }
    }
    console.log('❌ [TERMINAL-NUMBER-MANAGER] No available slots found');
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
