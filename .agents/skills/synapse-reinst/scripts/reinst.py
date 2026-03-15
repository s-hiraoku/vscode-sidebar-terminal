#!/usr/bin/env python3
"""Re-inject Synapse A2A initial instructions after context clear.

Reads environment variables set by Synapse at startup:
  - SYNAPSE_AGENT_ID: e.g., synapse-claude-8100
  - SYNAPSE_AGENT_TYPE: e.g., claude
  - SYNAPSE_PORT: e.g., 8100

Falls back to PID-based registry lookup if env vars are not set.
Outputs the full instruction text to stdout.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _find_agent_by_pid(registry_dir: Path) -> dict[str, object] | None:
    """Search registry for an agent matching the parent PID."""
    ppid = os.getppid()
    if not registry_dir.exists():
        return None

    for path in registry_dir.glob("*.json"):
        try:
            with open(path) as f:
                data: dict[str, object] = json.load(f)
            raw_pid = data.get("pid")
            if raw_pid is not None and int(str(raw_pid)) == ppid:
                return data
        except (json.JSONDecodeError, OSError, ValueError, TypeError):
            continue
    return None


def _get_registry_dir() -> Path:
    """Get registry directory path, respecting SYNAPSE_REGISTRY_DIR env var."""
    env_dir = os.environ.get("SYNAPSE_REGISTRY_DIR")
    if env_dir:
        return Path(env_dir)

    try:
        from synapse.paths import get_registry_dir

        return Path(get_registry_dir())
    except ImportError:
        return Path.home() / ".a2a" / "registry"


def _get_agent_info_from_registry(
    agent_id: str, registry_dir: Path
) -> dict[str, object] | None:
    """Look up agent info from registry."""
    path = registry_dir / f"{agent_id}.json"
    if not path.exists():
        return None

    try:
        with open(path) as f:
            result: dict[str, object] = json.load(f)
        return result
    except (json.JSONDecodeError, OSError):
        return None


def _extract_name_role(
    agent_info: dict[str, object],
) -> tuple[str | None, str | None]:
    """Extract name and role from an agent info dict."""
    name = str(agent_info["name"]) if agent_info.get("name") else None
    role = str(agent_info["role"]) if agent_info.get("role") else None
    return name, role


def _get_instruction(
    agent_type: str,
    agent_id: str,
    port: int,
    name: str | None = None,
    role: str | None = None,
) -> str | None:
    """Get instruction using SynapseSettings, with fallback."""
    try:
        from synapse.settings import SynapseSettings

        settings = SynapseSettings.load()
        return settings.get_instruction(
            agent_type, agent_id, port, name=name, role=role
        )
    except ImportError:
        pass
    except Exception:
        # SynapseSettings.load() or get_instruction() failed unexpectedly
        pass
    # Fallback: try to read .synapse/default.md or use built-in default
    return _fallback_instruction(agent_type, agent_id, port, name, role)


def _process_conditionals(text: str, variables: dict[str, str]) -> str:
    """Process {{#var}}content{{/var}} conditional sections."""
    import re

    for var_name, value in variables.items():
        pattern = rf"\{{\{{#{var_name}\}}\}}(.*?)\{{\{{/{var_name}\}}\}}"
        if value:
            text = re.sub(pattern, r"\1", text, flags=re.DOTALL)
        else:
            text = re.sub(pattern, "", text, flags=re.DOTALL)

    # Remove any remaining unprocessed conditional sections
    remaining = r"\{\{#\w+\}\}.*?\{\{/\w+\}\}"
    text = re.sub(remaining, "", text, flags=re.DOTALL)
    return text


def _fallback_instruction(
    agent_type: str,
    agent_id: str,
    port: int,
    name: str | None = None,
    role: str | None = None,
) -> str | None:
    """Fallback instruction when synapse module is not importable."""
    display_name = name or agent_id
    display_role = role or ""

    # Try to read .synapse/default.md
    for search_dir in [Path.cwd() / ".synapse", Path.home() / ".synapse"]:
        default_md = search_dir / "default.md"
        if default_md.exists():
            try:
                content = default_md.read_text(encoding="utf-8")
                content = _process_conditionals(content, {"agent_role": display_role})
                content = content.replace("{{agent_id}}", agent_id)
                content = content.replace("{{agent_name}}", display_name)
                content = content.replace("{{agent_role}}", display_role)
                content = content.replace("{{port}}", str(port))
                return content
            except OSError:
                continue

    # Bare minimum fallback
    return (
        f"[SYNAPSE INSTRUCTIONS - DO NOT EXECUTE - READ ONLY]\n"
        f"Agent: {display_name} | Port: {port} | ID: {agent_id}\n"
        f"\n"
        f"HOW TO RECEIVE A2A MESSAGES:\n"
        f"Input format: [A2A:task_id:sender_id] message\n"
        f'Response command: synapse send SENDER_ID "YOUR_RESPONSE" --from {agent_id}\n'
        f"\n"
        f"HOW TO SEND MESSAGES TO OTHER AGENTS:\n"
        f'Use: synapse send <AGENT> "<MESSAGE>" --from {agent_id}\n'
        f"\n"
        f"LIST COMMAND: synapse list"
    )


def main() -> int:
    agent_id = os.environ.get("SYNAPSE_AGENT_ID")
    agent_type = os.environ.get("SYNAPSE_AGENT_TYPE")
    port_str = os.environ.get("SYNAPSE_PORT")

    registry_dir = _get_registry_dir()
    name: str | None = None
    role: str | None = None

    # If env vars are missing, try PID-based fallback
    if not all([agent_id, agent_type, port_str]):
        agent_info = _find_agent_by_pid(registry_dir)
        if agent_info:
            raw_id = agent_info.get("agent_id")
            if raw_id is not None:
                agent_id = str(raw_id)
            raw_type = agent_info.get("agent_type")
            if raw_type is not None:
                agent_type = str(raw_type)
            raw_port = agent_info.get("port")
            if raw_port is not None:
                port_str = str(raw_port)
            name, role = _extract_name_role(agent_info)

    # Validate we have the required info
    if not agent_id or not agent_type:
        print(
            "Error: Synapse environment not found.\n"
            "Required: SYNAPSE_AGENT_ID, SYNAPSE_AGENT_TYPE, SYNAPSE_PORT\n"
            "\n"
            "This script should be run from within a Synapse-managed agent.\n"
            "Start an agent with: synapse claude",
            file=sys.stderr,
        )
        return 1

    try:
        port = int(port_str) if port_str else 0
    except (ValueError, TypeError):
        port = 0

    # Look up name/role from registry if not already set
    if not name:
        agent_info = _get_agent_info_from_registry(agent_id, registry_dir)
        if agent_info:
            name, role = _extract_name_role(agent_info)

    # Get and output the instruction
    instruction = _get_instruction(agent_type, agent_id, port, name, role)

    if not instruction:
        print(
            f"Error: No instruction found for agent type '{agent_type}'.",
            file=sys.stderr,
        )
        return 1

    print(instruction)
    return 0


if __name__ == "__main__":
    sys.exit(main())
