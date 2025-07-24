# CLI Agent Status Management Specification

## Overview
This document describes the status management behavior for CLI Agents (Claude Code and Gemini) in the Secondary Terminal extension.

## Core Purpose: Message Routing Management
The CLI Agent status system serves a critical function: **ensuring accurate message routing to active CLI Agents**. The status must reflect the **actual runtime state** of CLI Agents to enable proper message delivery to the correct terminal.

### Key Requirements
1. **Accurate State Tracking**: Status must reflect the **actual process state**, not user input
2. **Message Routing**: Only terminals with active CLI Agents should receive messages
3. **Real-time Updates**: Status changes only when CLI Agents actually start/stop

## Status Types

### 1. CONNECTED
- **Definition**: The CLI Agent is actively running in the terminal and is the globally active agent
- **Condition**: Only ONE terminal can have CONNECTED status at any time
- **Visual Indicator**: Shows as "🟢 Connected" in the terminal status

### 2. DISCONNECTED  
- **Definition**: The CLI Agent is running in the terminal but another terminal has the global active status
- **Condition**: Multiple terminals can have DISCONNECTED status
- **Visual Indicator**: Shows as "🟡 Disconnected" in the terminal status

### 3. NONE
- **Definition**: No CLI Agent is running in the terminal
- **Condition**: Default state for all terminals without CLI Agents
- **Visual Indicator**: No status indicator shown

## Status Transition Rules

### Starting a CLI Agent
1. When a CLI Agent (Claude Code or Gemini) is started in a terminal:
   - That terminal's status becomes **CONNECTED**
   - If another terminal was previously CONNECTED, it transitions to **DISCONNECTED**
   - Only the most recently started CLI Agent has CONNECTED status

### Stopping a CLI Agent

⚠️ **CRITICAL**: Status changes must occur **only when CLI Agents actually terminate**, not when exit commands are entered.

#### Incorrect Behavior (MUST AVOID):
```
User types "/exit" → Status immediately changes to NONE (❌ WRONG)
CLI Agent still processing exit → Agent still running
CLI Agent actually terminates → No status change (already changed)
```

#### Correct Behavior:
```
User types "/exit" → Status remains unchanged (CLI Agent still running)
CLI Agent processes exit command → Status remains unchanged  
CLI Agent actually terminates → Status changes to NONE (✅ CORRECT)
```

#### Status Change Triggers:
1. **Process Termination Detection**: PTY process exit events
2. **Output Pattern Detection**: CLI Agent goodbye messages, shell prompt return
3. **Never on Input Commands**: Exit commands (`/exit`, `quit`) do not trigger status changes

#### Termination Rules:
1. When a CONNECTED CLI Agent is **actually terminated**:
   - That terminal's status becomes **NONE**
   - If any DISCONNECTED terminals exist, one of them automatically becomes **CONNECTED**
   - Priority: The most recently started DISCONNECTED agent becomes CONNECTED

2. When a DISCONNECTED CLI Agent is **actually terminated**:
   - That terminal's status becomes **NONE**
   - No other status changes occur

## Key Invariants

1. **Single CONNECTED Rule**: At most ONE terminal can have CONNECTED status
   - 0 CONNECTED terminals: When no CLI Agents are running
   - 1 CONNECTED terminal: When at least one CLI Agent is running

2. **No All-DISCONNECTED State**: If any CLI Agents are running, at least one must be CONNECTED
   - It's impossible to have all terminals in DISCONNECTED state
   - When the last CONNECTED agent terminates, a DISCONNECTED agent (if any) automatically becomes CONNECTED

3. **Latest Takes Priority**: When multiple CLI Agents are running, the most recently started one gets CONNECTED status

## Example Scenarios

### Scenario 1: Single Terminal
1. Start Terminal 1 → Status: NONE
2. Start CLI Agent in Terminal 1 → Status: CONNECTED
3. Stop CLI Agent in Terminal 1 → Status: NONE

### Scenario 2: Multiple Terminals
1. Start Terminal 1 with CLI Agent → T1: CONNECTED
2. Start Terminal 2 with CLI Agent → T1: DISCONNECTED, T2: CONNECTED
3. Start Terminal 3 with CLI Agent → T1: DISCONNECTED, T2: DISCONNECTED, T3: CONNECTED
4. Stop CLI Agent in Terminal 3 → T1: DISCONNECTED, T2: CONNECTED, T3: NONE
5. Stop CLI Agent in Terminal 2 → T1: CONNECTED, T2: NONE, T3: NONE

### Scenario 3: Automatic Promotion
1. Terminal 1 with CLI Agent: CONNECTED
2. Terminal 2 with CLI Agent: DISCONNECTED  
3. Terminal 3 with CLI Agent: DISCONNECTED
4. Stop Terminal 1's CLI Agent → Terminal 3 (most recent) automatic∏ally becomes CONNECTED

## Message Routing and Sending Management

### Purpose
The primary purpose of CLI Agent status management is to enable **accurate message routing** to active CLI Agents. The system must know which terminals have running CLI Agents to route messages correctly.

### Routing Rules
1. **CONNECTED Terminal**: Primary message destination
   - File references are sent to the CONNECTED terminal
   - Commands are routed to the active CLI Agent
   
2. **DISCONNECTED Terminals**: Secondary destinations
   - May receive messages in specific scenarios
   - Maintained as fallback options
   
3. **NONE Terminals**: No message routing
   - Do not receive CLI Agent messages
   - Status indicators are hidden

### Status Display Requirements
1. **Show Status**: When CLI Agent is **actually running** (CONNECTED or DISCONNECTED)
   - Display appropriate status indicator in terminal
   - Enable message routing to that terminal
   
2. **Hide Status**: When CLI Agent is **not running** (NONE)
   - Remove status indicators
   - Disable message routing

### Critical Timing
```
❌ WRONG: Status changes on command input
User: "/exit" → Status: NONE (CLI Agent still running!)
Message routing: DISABLED (messages lost!)

✅ CORRECT: Status changes on actual termination  
User: "/exit" → Status: CONNECTED (CLI Agent processing)
CLI Agent: Terminating... → Status: CONNECTED (still running)
Process: Terminated → Status: NONE (actually terminated)
Message routing: Properly managed throughout process
```

## Implementation Notes

- The extension maintains a global state tracker for all CLI Agent instances
- Status changes are propagated to both the Extension host and WebView for UI updates
- The automatic promotion logic ensures consistent behavior when CONNECTED agents terminate
- **Status must reflect actual process state**, not user commands or intentions