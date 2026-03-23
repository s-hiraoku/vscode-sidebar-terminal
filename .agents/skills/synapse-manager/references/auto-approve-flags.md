# Tool-Specific Automation Args

Each CLI agent uses different forwarded automation args. Pass them after `--`
when spawning. For most CLIs these args skip approval prompts; for OpenCode,
`--agent build` selects the build agent profile and does not bypass OpenCode
permission checks.

Before forwarding automation args to `synapse spawn`, run the normal
collaboration preflight: `synapse list` to confirm agent availability,
`synapse memory search <query>` to surface shared knowledge, and
`synapse tasks` to verify task tracking. Apply the tool-specific args only
after those checks, and remember that OpenCode `--agent build` changes the
agent profile rather than bypassing permission prompts.

| Agent | Args | Example |
|-------|------|---------|
| **Claude Code** | `--dangerously-skip-permissions` | `synapse spawn claude -- --dangerously-skip-permissions` |
| **Gemini CLI** | `-y` (or `--yolo`) | `synapse spawn gemini -- -y` |
| **Codex CLI** | `--full-auto` | `synapse spawn codex -- --full-auto` |
| **GitHub Copilot CLI** | `--allow-all-tools` | `synapse spawn copilot -- --allow-all-tools` |
| **OpenCode** | `--agent build` | `synapse spawn opencode -- --agent build` selects the build agent profile; approval still depends on OpenCode permissions |

**Codex details:** `--full-auto` = `-a on-request --sandbox workspace-write` (sandboxed auto-approve).
For fully unrestricted: `--dangerously-bypass-approvals-and-sandbox`.

**Mixed teams:** Not all CLIs ignore unknown args — some exit with errors.
When combining args fails, start agents individually:
```bash
synapse spawn claude -- --dangerously-skip-permissions
synapse spawn gemini -- -y
synapse spawn opencode -- --agent build   # Build agent profile only; does not bypass OpenCode permission checks
```

**Via API:**
```bash
curl -X POST http://localhost:8100/spawn \
  -H "Content-Type: application/json" \
  -d '{"profile": "gemini", "tool_args": ["-y"]}'
```
