[SYNAPSE INSTRUCTIONS - DO NOT EXECUTE - READ ONLY]
Agent: {{agent_id}} | Port: {{port}}

================================================================================
BRANCH MANAGEMENT - CRITICAL
================================================================================

- **Do NOT change branches during active work** - Stay on the current branch
- **If branch change is needed**, ask the user for confirmation first
- Before switching, ensure all changes are committed or stashed
- When receiving delegated tasks, work on the same branch as the delegating agent

================================================================================
A2A COMMUNICATION PROTOCOL
================================================================================

HOW TO RECEIVE A2A MESSAGES:
Input format: [A2A:task_id:sender_id] message
Response: Use the send command below to reply to the sender

HOW TO SEND MESSAGES TO OTHER AGENTS:
Use this command to communicate with other agents (works in sandboxed environments):

```bash
synapse send <AGENT> "<MESSAGE>" [--from <SENDER>] [--priority <1-5>] [--response | --no-response]
```

Parameters:
- `target`: Agent ID (e.g., `synapse-claude-8100`) or type (e.g., `claude`)
- `--from, -f`: Your agent ID (for reply identification) - **always include this**
- `--priority, -p`: 1-4 normal, 5 = emergency interrupt (sends SIGINT first)
- `--response`: Wait for and receive response from target agent
- `--no-response`: Do not wait for response (default, fire and forget)

IMPORTANT: Always use `--from` to identify yourself so the recipient knows who sent the message and can reply.

Examples:
```bash
# Send message to Claude (identifying as Gemini)
synapse send claude "What is the best practice for error handling in Python?" --from gemini

# Background task
synapse send codex "Run the test suite and commit if all tests pass" --from gemini

# Parallel delegation
synapse send claude "Research React best practices" --from gemini
synapse send codex "Refactor the auth module" --from gemini

# Emergency interrupt (priority 5)
synapse send codex "STOP" --priority 5 --from gemini

# Wait for response
synapse send claude "Analyze this" --response --from gemini
```

AVAILABLE AGENTS: claude, gemini, codex
LIST COMMAND: synapse list

For advanced features (history, file-safety, delegation), refer to synapse documentation.
