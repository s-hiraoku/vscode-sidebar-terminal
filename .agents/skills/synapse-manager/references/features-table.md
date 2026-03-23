# A2A Features Reference

| Feature | Command | Purpose |
|---------|---------|---------|
| **Task Board** | `synapse tasks create/assign/complete/fail/reopen/purge/list` | Structured task tracking with priorities, dependencies, grouping (group, component, milestone), verbose/JSON output, and purge cleanup (--older-than, --dry-run) |
| **Task-Linked Send** | `synapse send --task` / `-T` | Auto-create board task, auto-claim on receive, auto-complete on finalize |
| **Plan Approval** | `synapse approve/reject` | Gate execution with review feedback |
| **Shared Memory** | `synapse memory save/search/list/show` | Cross-agent knowledge sharing and pattern retention |
| **History & Tracing** | `synapse history list/show/stats` + `synapse trace` | Audit trail and token/cost tracking |
| **Delegate Mode** | `--delegate-mode` | Manager agent that coordinates without editing files |
| **Broadcast** | `synapse broadcast` | Send to all agents at once |
| **File Attachments** | `--attach file.py` | Send reference files with messages |
| **Saved Agents** | `synapse agents list` + `synapse spawn <id>` | Reusable agent definitions for consistent teams |
| **Priority Levels** | `--priority 1-5` | Control urgency (5 = emergency, bypasses readiness gate) |
| **Soft Interrupt** | `synapse interrupt` | Urgent status check (shorthand for `-p 4 --silent`) |
| **Response Modes** | `--wait / --notify / --silent` | Blocking, async notification, or fire-and-forget |
| **Reply Routing** | `synapse reply` | Auto-routed responses to original sender |
| **Message Files** | `--message-file / --stdin` | Send large messages without shell limits |
| **Plan Cards** | `synapse canvas plan` / `synapse tasks accept-plan` / `synapse tasks sync-plan` | Mermaid DAG + step tracking with task board integration |
| **Smart Suggest** | MCP tool: `analyze_task` | Analyze prompts and suggest team/task splits for large work |
| **MCP Bootstrap** | `synapse mcp serve` / `python -m synapse.mcp` | Distribute instructions via MCP resources (opt-in, including Copilot via tools) |
