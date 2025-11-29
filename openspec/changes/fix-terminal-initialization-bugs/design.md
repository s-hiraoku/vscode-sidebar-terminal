# Design: Fix Terminal Initialization Bugs

## Architecture Overview

### Current System Design
```
┌─────────────────────────────────────────────────────────────┐
│ WebView (main.ts / TerminalCreationService)                 │
│  - Creates terminal with xterm.js                           │
│  - Sends terminalInitializationComplete message             │
└────────────────────┬────────────────────────────────────────┘
                     │ postMessage
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Extension (SecondaryTerminalProvider)                        │
│  - MessageRoutingFacade routes messages                     │
│  - Handler: _handleTerminalInitializationComplete           │
│    ├─> initializeShellForTerminal()                         │
│    └─> startPtyOutput()                                     │
└─────────────────────────────────────────────────────────────┘
```

### Problem Analysis

#### Issue 1: Message Routing Failure
**Symptoms**:
- Message sent from WebView ✅
- Handler registered in provider ✅
- Handler never called ❌

**Potential Causes**:
1. **MessageRoutingFacade** not properly routing terminal category messages
2. **Command string mismatch**: 'terminalInitializationComplete' vs expected format
3. **Handler category** mismatch: 'terminal' category not registered correctly
4. **Timing issue**: Handler registered after message sent
5. **WebView/Extension communication** broken

**Most Likely**: MessageRoutingFacade routing logic doesn't handle 'terminal' category correctly

#### Issue 2: AI Agent Header Display
**Symptoms**:
- Header HTML appears broken
- AI Agent status not properly displayed

**Potential Causes**:
1. **HeaderFactory** not creating proper DOM structure
2. **CSS styling** missing or overridden
3. **Initialization timing**: Header created before DOM ready
4. **StatusSection** not properly initialized

## Design Decisions

### Decision 1: Message Routing Fix (Preferred Solution)

**Option A: Fix MessageRoutingFacade Routing**
- **Pros**:
  - Maintains separation of concerns
  - Preserves message-based architecture
  - Extensible for future handlers
- **Cons**:
  - Requires understanding complex routing logic
  - May have cascading effects on other handlers
- **Decision**: Implement this first

**Option B: Direct Initialization**
- **Pros**:
  - Simpler, more direct
  - Eliminates message routing dependency
  - Faster execution
- **Cons**:
  - Couples WebView creation to shell initialization
  - Less flexible architecture
  - Breaks separation of concerns
- **Decision**: Use as fallback if Option A fails

### Decision 2: Initialization Sequence

**Chosen Approach**: Maintain message-based flow with fallback
```typescript
// TerminalCreationService.ts (WebView)
async createTerminal() {
  // 1. Create terminal
  const terminal = new Terminal(config);

  // 2. Open in DOM
  terminal.open(container);

  // 3. Attach all addons
  await loadAllAddons(terminal);

  // 4. Append to DOM
  document.getElementById('terminal-body').appendChild(container);

  // 5. Initial resize
  fitAddon.fit();

  // 6. Notify Extension (with retry)
  this.notifyTerminalReady(terminalId, { retry: 3, delay: 50 });
}

// SecondaryTerminalProvider.ts (Extension)
private async _handleTerminalInitializationComplete(message) {
  // Defensive: Verify terminal exists
  const terminal = this._terminalManager.getTerminal(terminalId);
  if (!terminal || !terminal.ptyProcess) {
    log('Terminal not ready, retrying...');
    setTimeout(() => this._handleTerminalInitializationComplete(message), 100);
    return;
  }

  // Initialize shell
  this._terminalManager.initializeShellForTerminal(
    terminalId,
    terminal.ptyProcess,
    false
  );

  // Start output flow
  this._terminalManager.startPtyOutput(terminalId);
}
```

### Decision 3: Header Display Fix

**Approach**: Ensure proper initialization sequence
```typescript
// HeaderFactory.ts
public static createTerminalHeader(config: HeaderConfig) {
  // 1. Create container with proper structure
  const container = createHeaderContainer();

  // 2. Create title section
  const titleSection = createTitleSection();

  // 3. Create status section (initially empty)
  const statusSection = createStatusSection();

  // 4. Create controls section
  const controlsSection = createControlsSection();

  // 5. Assemble in correct order
  container.append(titleSection, statusSection, controlsSection);

  // 6. Return all elements for later updates
  return {
    container,
    titleSection,
    nameSpan,
    statusSection,
    controlsSection,
    // ... other elements
  };
}

// When AI Agent detected:
HeaderFactory.insertCliAgentStatus(elements, 'connected', 'claude');
```

## Trade-offs

### Reliability vs Complexity
- **More reliable**: Direct initialization (simpler code path)
- **More complex**: Message routing (better separation)
- **Chosen**: Message routing with defensive fallbacks

### Performance vs Safety
- **Faster**: Immediate shell initialization
- **Safer**: Wait for terminal fully initialized before shell init
- **Chosen**: Wait for full initialization with timeout fallback

## Implementation Strategy

### Phase 1: Diagnosis (Add Logging)
```typescript
// Add comprehensive logging at each step
log('📨 [WebView] Sending terminalInitializationComplete');
log('📥 [Extension] Received message:', message.command);
log('🔍 [Router] Routing message to category:', category);
log('✅ [Handler] Executing handler for:', terminalId);
```

### Phase 2: Fix Message Routing
```typescript
// MessageRoutingFacade.ts
private routeMessage(message: WebviewMessage) {
  // Ensure terminal category handlers are properly registered
  const category = this.determineCategory(message.command);

  // Defensive: Log category resolution
  log(`Routing '${message.command}' to category '${category}'`);

  // Get handler
  const handler = this.handlers.get(category)?.get(message.command);
  if (!handler) {
    log(`⚠️ No handler found for command: ${message.command}`);
    return;
  }

  // Execute
  await handler(message);
}
```

### Phase 3: Add Fallback Mechanism
```typescript
// TerminalCreationService.ts
private notifyTerminalReady(terminalId: string, options: { retry: number, delay: number }) {
  let attempt = 0;
  const maxAttempts = options.retry;

  const sendMessage = () => {
    attempt++;
    this.coordinator.postMessageToExtension({
      command: 'terminalInitializationComplete',
      terminalId,
      attempt,
      timestamp: Date.now(),
    });

    // If no response after delay, retry
    if (attempt < maxAttempts) {
      setTimeout(sendMessage, options.delay * attempt);
    }
  };

  sendMessage();
}
```

### Phase 4: Fix Header Display
```typescript
// Ensure proper CSS is applied
const statusSection = DOMUtils.createElement('div', {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  marginLeft: '8px',
  flexShrink: '0',
  minWidth: '0', // Allow text truncation
  maxWidth: '150px', // Prevent overflow
}, {
  className: 'terminal-status',
});

// Ensure text doesn't overflow
const statusSpan = DOMUtils.createElement('span', {
  fontSize: '10px',
  color: 'var(--vscode-descriptionForeground)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}, {
  textContent: statusText,
  className: 'ai-agent-status',
});
```

## Validation Approach

### Unit Tests
```typescript
describe('Terminal Initialization', () => {
  it('should call handler when terminalInitializationComplete received', async () => {
    const handler = sinon.spy();
    messageRouter.registerHandler('terminal', 'terminalInitializationComplete', handler);

    await messageRouter.routeMessage({
      command: 'terminalInitializationComplete',
      terminalId: 'term-1',
    });

    expect(handler).to.have.been.calledOnce;
  });

  it('should initialize shell after terminal ready', async () => {
    const initSpy = sinon.spy(terminalManager, 'initializeShellForTerminal');
    const startSpy = sinon.spy(terminalManager, 'startPtyOutput');

    await provider._handleTerminalInitializationComplete({
      command: 'terminalInitializationComplete',
      terminalId: 'term-1',
    });

    expect(initSpy).to.have.been.calledWith('term-1');
    expect(startSpy).to.have.been.calledWith('term-1');
  });
});
```

### Integration Tests
```typescript
describe('Header Display', () => {
  it('should render AI Agent status correctly', () => {
    const elements = HeaderFactory.createTerminalHeader({
      terminalId: 'term-1',
      terminalName: 'Terminal 1',
    });

    HeaderFactory.insertCliAgentStatus(elements, 'connected', 'claude');

    const statusText = elements.statusSection.querySelector('.ai-agent-status');
    expect(statusText).to.exist;
    expect(statusText.textContent).to.include('AI Agent');
  });
});
```

### E2E Tests
```typescript
describe('Terminal Usage', () => {
  it('should show prompt and accept input', async () => {
    // Create terminal
    await commands.executeCommand('sidebarTerminal.createTerminal');

    // Wait for prompt
    await waitForTerminalPrompt();

    // Type command
    await typeInTerminal('echo "test"\n');

    // Verify output
    const output = await getTerminalOutput();
    expect(output).to.include('test');
  });
});
```

## Rollback Plan
If changes cause issues:
1. Revert message routing changes
2. Use direct initialization approach
3. Add feature flag to switch between approaches
4. Gather more diagnostic data

## Monitoring & Observability
- Add performance metrics for initialization time
- Log all handler executions
- Track initialization failures
- Monitor shell integration success rate
