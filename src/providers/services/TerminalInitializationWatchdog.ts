import { provider as log } from '../../utils/logger';

export interface WatchdogOptions {
  initialDelayMs: number;
  maxAttempts: number;
  backoffFactor: number;
}

interface WatchdogEntry {
  attempt: number;
  delay: number;
  timer?: NodeJS.Timeout;
  options: WatchdogOptions;
}

export interface WatchdogCallbackInfo {
  attempt: number;
  isFinalAttempt: boolean;
}

type WatchdogCallback = (terminalId: string, info: WatchdogCallbackInfo) => void;

const DEFAULT_OPTIONS: WatchdogOptions = {
  initialDelayMs: 700,
  maxAttempts: 4,
  backoffFactor: 2,
};

const MAX_DELAY_MS = 6000;

/**
 * Reusable watchdog that fires callbacks when initialization ACKs are missing.
 * Each terminal has its own timer with exponential backoff and bounded attempts.
 */
export class TerminalInitializationWatchdog {
  private readonly watchers = new Map<string, WatchdogEntry>();

  constructor(
    private readonly callback: WatchdogCallback,
    private readonly defaultOptions: WatchdogOptions = DEFAULT_OPTIONS
  ) {}

  public start(
    terminalId: string,
    reason: string,
    overrideOptions?: Partial<WatchdogOptions>
  ): void {
    this.stop(terminalId, `restart:${reason}`);
    const mergedOptions: WatchdogOptions = {
      ...this.defaultOptions,
      ...overrideOptions,
    };
    const entry: WatchdogEntry = {
      attempt: 0,
      delay: mergedOptions.initialDelayMs,
      options: mergedOptions,
    };
    this.watchers.set(terminalId, entry);
    log(
      `⏳ [WATCHDOG] Started for ${terminalId} (reason=${reason}, initialDelay=${mergedOptions.initialDelayMs}ms, maxAttempts=${mergedOptions.maxAttempts})`
    );
    this.scheduleNext(terminalId, entry);
  }

  public stop(terminalId: string, reason: string): void {
    const entry = this.watchers.get(terminalId);
    if (!entry) {
      return;
    }

    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    this.watchers.delete(terminalId);
    log(`🛑 [WATCHDOG] Stopped for ${terminalId} (reason=${reason})`);
  }

  public dispose(): void {
    for (const [terminalId, entry] of this.watchers.entries()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      log(`🛑 [WATCHDOG] Disposed pending watchdog for ${terminalId}`);
    }
    this.watchers.clear();
  }

  private scheduleNext(terminalId: string, entry: WatchdogEntry): void {
    const nextAttempt = entry.attempt + 1;
    const delay =
      nextAttempt === 1
        ? entry.delay
        : Math.min(entry.delay * entry.options.backoffFactor, MAX_DELAY_MS);

    entry.timer = setTimeout(() => {
      const isFinalAttempt = nextAttempt >= entry.options.maxAttempts;
      log(
        `⚠️ [WATCHDOG] Attempt #${nextAttempt} for ${terminalId} (delay=${delay}ms, final=${isFinalAttempt})`
      );
      this.callback(terminalId, { attempt: nextAttempt, isFinalAttempt });

      if (isFinalAttempt) {
        this.watchers.delete(terminalId);
        return;
      }

      entry.attempt = nextAttempt;
      entry.delay = delay;
      this.scheduleNext(terminalId, entry);
    }, delay);
  }
}
