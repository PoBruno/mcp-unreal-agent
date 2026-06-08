---
name: install
description: Step-by-step playbook for installing mcp-unreal-agent into an end user's UE5 project. Read when the user asks to install the MCP, set up the agent, or follow the install prompt.
---

# Install skill

When a user asks you to install `mcp-unreal-agent`, follow [`install/AGENT-INSTALL.md`](../../../install/AGENT-INSTALL.md) exactly. That file is the adaptive installer brain (Phase 0 Confirm → 1 Detect → 2 Plan → 3 Ask → 4 Execute → 5 Inject the passive context skill → 6 Verify → 7 Uninstall/Repair). This skill is the higher-level "why and when" guide; the installer file is the prescriptive sequence.

## When this skill applies

User says any of:
- "Install mcp-unreal-agent in my project"
- "Set up the UE5 MCP server"
- "Follow https://github.com/PoBruno/mcp-unreal-agent install playbook"
- "Add the unreal-agent MCP to this project"

## What you (the agent) need to do at a high level

1. **Find the UE5 project.** Walk up from cwd looking for `.uproject`. If multiple, ask the user. If none, ask the user to open one or supply a path.
2. **Validate engine version.** Read `EngineAssociation` from the `.uproject`. Confirm 5.4+. If older, tell the user we don't support it and offer to upgrade engine version (with their approval).
3. **Clone the plugin.** Into `<UEProject>/Plugins/UnrealAgent/`.
4. **Build the TS server.** `cd Plugins/UnrealAgent/Tools && npm install && npm run build`.
5. **Edit the `.uproject`.** Add `UnrealAgent` and `PythonScriptPlugin` to the `Plugins` array. Both must have `"Enabled": true`.
6. **Configure Python remote execution.** Edit / create `Config/DefaultEngine.ini` and add:
   ```ini
   [/Script/PythonScriptPlugin.PythonScriptPluginSettings]
   bRemoteExecution=True
   ```
7. **Write the MCP config.** Depends on which agent the user is on:
   - **Claude Code:** merge into `<UEProject>/.mcp.json`.
   - **GitHub Copilot:** merge into `<UEProject>/.vscode/mcp.json`.
   - **Both:** write both.
8. **Ask the user to restart the editor.** The plugin compiles on first open.
9. **Verify with a health call.** Once the editor is restarted, call the `health` tool. If `mode == "editor"`, success.
10. **Tell the user what to try first.** A short paragraph with 2-3 concrete example prompts.

## Detection logic — which agent is the user on

You usually know — you are the agent. But if the install is being run from a meta-agent or you're unsure, check:

| Signal | Likely agent |
|---|---|
| `.mcp.json` exists in project root | Claude Code |
| `.vscode/mcp.json` exists or `.vscode/settings.json` mentions `"mcp"` | GitHub Copilot |
| `claude_desktop_config.json` is writable on the system | Claude Desktop (not Claude Code) |
| `.cursorrules` or `.cursor/` exists | Cursor |

If unsure, ask the user. Don't guess and write to the wrong config file.

## Common failure modes

### "Plugin module 'UnrealAgent' could not be loaded"
Cause: plugin compiled against a different UE5 version than the project's.
Fix: ensure `EngineAssociation` in `.uproject` matches the UE5 install used to compile. Rebuild.

### "Cannot find module '@modelcontextprotocol/sdk'"
Cause: `npm install` didn't run, or `node_modules/` was excluded.
Fix: `cd Plugins/UnrealAgent/Tools && npm install`.

### Health call returns nothing
Cause: editor not open, or plugin failed to load silently.
Fix: open editor, check `Window → Developer Tools → Output Log` for `LogUnrealAgent` lines.

### Port 9847 already in use
Cause: another UE5 editor (or upstream `ue5-mcp`) is running on this port.
Fix: close the conflicting instance, or set `UE_PORT` env var in the MCP config to a different port AND set the C++ side's port (currently requires editing `UnrealAgentServer.cpp` — open issue for runtime port config).

### `bRemoteExecution=True` change didn't take effect
Cause: the user edited the file but the editor was already open and cached settings.
Fix: close UE editor, re-open. Settings only re-read on startup.

## What not to do

- **Don't install globally.** The plugin goes inside the user's project (`Plugins/UnrealAgent/`), not in their engine install. They might have multiple projects.
- **Don't modify the user's Engine install files.** Ever.
- **Don't auto-restart the editor.** Ask the user. Their editor might have unsaved work.
- **Don't write to `.mcp.json` without merging.** If the file exists with other servers, preserve them.
- **Don't delete the user's `Config/DefaultEngine.ini` content.** Append the Python setting, don't overwrite.
- **Don't run `npm install -g`.** Local install only.
