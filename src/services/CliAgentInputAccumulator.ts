export class CliAgentInputAccumulator {
  private readonly buffers = new Map<string, string>();

  public consume(
    terminalId: string,
    chunk: string
  ): {
    submittedCommands: string[];
    sawInterrupt: boolean;
  } {
    const submittedCommands: string[] = [];
    let sawInterrupt = false;
    let buffer = this.buffers.get(terminalId) ?? '';

    for (const char of chunk) {
      if (char === '\x03') {
        sawInterrupt = true;
        buffer = '';
        continue;
      }

      if (char === '\b' || char === '\x7f') {
        buffer = buffer.slice(0, -1);
        continue;
      }

      if (char === '\r' || char === '\n') {
        const submitted = buffer.trim();
        if (submitted) {
          submittedCommands.push(submitted);
        }
        buffer = '';
        continue;
      }

      buffer += char;
    }

    this.buffers.set(terminalId, buffer);

    return {
      submittedCommands,
      sawInterrupt,
    };
  }

  public clear(terminalId: string): void {
    this.buffers.delete(terminalId);
  }
}
