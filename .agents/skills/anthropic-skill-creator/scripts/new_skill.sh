#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 <skill-name> [--path <skills-root>]

Examples:
  $0 api-review
  $0 docx-editor --path .agents/skills
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

skill_name="$1"
shift
skills_root=".agents/skills"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      skills_root="${2:-}"
      if [[ -z "$skills_root" ]]; then
        echo "--path requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! [[ "$skill_name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "skill-name must be kebab-case: e.g. my-new-skill (no leading/trailing/consecutive hyphens)" >&2
  exit 1
fi

skill_dir="$skills_root/$skill_name"
if [[ -e "$skill_dir" ]]; then
  echo "Skill directory already exists: $skill_dir" >&2
  exit 1
fi

mkdir -p "$skill_dir" "$skill_dir/scripts" "$skill_dir/references" "$skill_dir/assets"

cat > "$skill_dir/SKILL.md" <<EOF2
---
name: $skill_name
description: [TODO: Explain what this skill does and when to use it. Include trigger contexts explicitly.]
---

# ${skill_name//-/ }

## Overview

[TODO: 1-2 sentences]

## Workflow

1. [TODO]
2. [TODO]
3. [TODO]

## References

- [TODO: references/file.md]
EOF2

echo "Created: $skill_dir"
