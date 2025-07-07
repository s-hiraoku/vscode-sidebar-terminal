---
name: Question
about: Ask a question about usage or configuration
title: '[QUESTION] '
labels: question
assignees: s-hiraoku
---

## ❓ Question

### 📝 Description

A clear and concise description of your question.

### 🎯 What are you trying to achieve?

Describe what you want to accomplish.

### 🔄 What have you tried?

Describe what you've already attempted.

### 🖥️ Environment

**VS Code Version:** (e.g., 1.74.0)
**Extension Version:** (e.g., 0.0.1)
**OS:** (e.g., Windows 10, macOS 13.0, Ubuntu 20.04)

### 📋 Current Configuration

```json
// Include relevant settings from settings.json
{
  "sidebarTerminal.shell": "",
  "sidebarTerminal.fontSize": 14
  // ... other relevant settings
}
```

### 🔗 Related Documentation

Have you checked these resources?

- [ ] README.md
- [ ] VS Code Extension Marketplace page
- [ ] Existing GitHub Issues
- [ ] VS Code Documentation

### 📊 Additional Context

Add any other context about the question here.

---

## Common Questions

Before posting, please check if your question is answered below:

**Q: Where is the terminal displayed?**
A: The terminal is displayed in the left sidebar (Explorer panel) alongside other views like Explorer, Search, etc.

**Q: Can I move the terminal to other locations?**
A: The terminal is designed to work in the sidebar. You can drag the view tab to other areas if needed, but it's optimized for sidebar use.

**Q: How do I configure a custom shell?**
A: Set `sidebarTerminal.shell` in your VS Code settings to the path of your preferred shell.

**Q: The buttons (Clear/New/Split) don't work, what should I do?**
A: Try restarting VS Code and re-enabling the extension. This issue has been fixed in recent versions.

**Q: Can I use this extension with multiple workspaces?**
A: Yes, the extension works with VS Code workspaces and will use workspace-specific settings when available.
