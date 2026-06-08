# INSTALL.md

Human-friendly install reference. For one-prompt install via an AI agent, see [PROMPT-TEMPLATES.md](PROMPT-TEMPLATES.md). For the agent-executable adaptive installer, see [AGENT-INSTALL.md](AGENT-INSTALL.md).

This file is the **manual install** path — for users who want to set up by hand or are debugging an automated install.

---

## Prerequisites

| Requirement | Version | How to check |
|---|---|---|
| Unreal Engine | 5.4+ | `ls "C:/Program Files/Epic Games/UE_5.4"` |
| Node.js | 18+ | `node --version` |
| Visual Studio 2022 | with "Game development with C++" workload | open VS Installer |
| git | any recent | `git --version` |

---

## Step 1 — Clone the plugin into your project

```powershell
cd <YourUEProject>
mkdir -Force Plugins
cd Plugins
git clone https://github.com/PoBruno/mcp-unreal-agent.git UnrealAgent
```

You should now have `<YourUEProject>/Plugins/UnrealAgent/UnrealAgent.uplugin` on disk.

---

## Step 2 — Build the TypeScript MCP server

```powershell
cd <YourUEProject>/Plugins/UnrealAgent/Tools
npm install
npm run build
```

Verify `dist/index.js` was created:

```powershell
ls dist/index.js
```

---

## Step 3 — Enable the plugin in your .uproject

Edit `<YourUEProject>/<YourProject>.uproject`. In the `"Plugins"` array, add:

```json
{
  "Name": "UnrealAgent",
  "Enabled": true
},
{
  "Name": "PythonScriptPlugin",
  "Enabled": true
}
```

If a `"Plugins"` array doesn't exist yet, add the whole block:

```json
"Plugins": [
  { "Name": "UnrealAgent", "Enabled": true },
  { "Name": "PythonScriptPlugin", "Enabled": true }
]
```

---

## Step 4 — Enable Python remote execution

Edit (or create) `<YourUEProject>/Config/DefaultEngine.ini`. Append:

```ini
[/Script/PythonScriptPlugin.PythonScriptPluginSettings]
bRemoteExecution=True
```

⚠️ If the section already exists, just ensure the `bRemoteExecution=True` line is in it.

---

## Step 5 — Configure your MCP client

### Claude Code

Create or edit `<YourUEProject>/.mcp.json`:

```json
{
  "mcpServers": {
    "unreal-agent": {
      "command": "node",
      "args": ["Plugins/UnrealAgent/Tools/dist/index.js"],
      "env": {
        "UE_PROJECT_DIR": "."
      }
    }
  }
}
```

### GitHub Copilot (VS Code)

Create or edit `<YourUEProject>/.vscode/mcp.json`:

```json
{
  "servers": {
    "unreal-agent": {
      "command": "node",
      "args": ["Plugins/UnrealAgent/Tools/dist/index.js"],
      "env": {
        "UE_PROJECT_DIR": "."
      }
    }
  }
}
```

Restart VS Code or reload window after editing.

### Cursor

Same as Claude Code — uses `.mcp.json` at project root.

### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac). Use **absolute paths**:

```json
{
  "mcpServers": {
    "unreal-agent": {
      "command": "node",
      "args": ["C:/absolute/path/to/YourProject/Plugins/UnrealAgent/Tools/dist/index.js"],
      "env": {
        "UE_PROJECT_DIR": "C:/absolute/path/to/YourProject"
      }
    }
  }
}
```

---

## Step 6 — Open the editor and verify

1. Open your `.uproject` in Unreal Editor.
2. First open: a "Missing modules" prompt may appear → click **Yes** to compile.
3. Wait for the editor to load fully (~30-60s on first open).
4. In your AI agent, call the `server_status` tool (or ask the agent: "call server_status on unreal-agent").

Expected response:
```json
{
  "ok": true,
  "data": {
    "mode": "editor",
    "version": "0.1.0",
    "pluginVersion": "1.0"
  }
}
```

If `mode == "editor"`, you're done.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Editor refuses to open, "Missing UnrealAgent module" | Plugin didn't compile | Open via VS / Rider, build the project's `<Name>Editor` target in Development Editor configuration |
| `server_status` returns `UE_NOT_RUNNING` | Plugin didn't load | Check editor Output Log for `LogUnrealAgent` entries. Confirm plugin enabled under Edit → Plugins |
| Port 9847 in use | Another instance running | Close the conflicting editor or upstream `ue5-mcp`. Currently no runtime port override — open an issue if you need one |
| `npm install` fails | Wrong Node version | Need Node 18+. Check with `node --version`, upgrade via [nodejs.org](https://nodejs.org) |
| MCP server not visible to agent | Config not loaded | Restart the agent (Claude Code: close & re-open). VS Code: reload window |
| `bRemoteExecution=True` doesn't take effect | Editor already open when set | Close UE editor, re-open. Settings only re-read on startup |

For other issues, open an issue at https://github.com/PoBruno/mcp-unreal-agent/issues including:
- Your UE version
- Your Node version
- The MCP config file you wrote
- The first ~50 lines of editor Output Log mentioning `LogUnrealAgent`
