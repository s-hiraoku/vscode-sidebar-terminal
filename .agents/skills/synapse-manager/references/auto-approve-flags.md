# Auto-Approve Flags

Each CLI agent uses a different flag to skip permission prompts. Pass after `--` when spawning.

| Agent | Flag | Example |
|-------|------|---------|
| **Claude Code** | `--dangerously-skip-permissions` | `synapse spawn claude -- --dangerously-skip-permissions` |
| **Gemini CLI** | `-y` (or `--yolo`) | `synapse spawn gemini -- -y` |
| **Codex CLI** | `--full-auto` | `synapse spawn codex -- --full-auto` |
| **GitHub Copilot CLI** | `--allow-all-tools` | `synapse spawn copilot -- --allow-all-tools` |
| **OpenCode** | *(no flag available)* | N/A |

**Codex details:** `--full-auto` = `-a on-request --sandbox workspace-write` (sandboxed auto-approve).
For fully unrestricted: `--dangerously-bypass-approvals-and-sandbox`.

**Mixed teams:** Not all CLIs ignore unknown flags — some exit with errors.
When combining flags fails, start agents individually:
```bash
synapse spawn claude -- --dangerously-skip-permissions
synapse spawn gemini -- -y
```

**Via API:**
```bash
curl -X POST http://localhost:8100/spawn \
  -H "Content-Type: application/json" \
  -d '{"profile": "gemini", "tool_args": ["-y"]}'
```
