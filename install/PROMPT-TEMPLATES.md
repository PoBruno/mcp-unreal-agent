# PROMPT-TEMPLATES.md

Copy-paste prompts for installing `mcp-unreal-agent`. Pick the one for your coding agent. Paste into the agent's chat from inside your UE5 project directory.

---

## Claude Code

```
Set up https://github.com/PoBruno/mcp-unreal-agent in my project.

Follow the install playbook at install/AGENT-PLAYBOOK.md in that repo,
step by step. Don't skip steps. When you reach the "ask the user to
restart the editor" step, stop and wait for me to confirm before
verifying with the health check.
```

---

## GitHub Copilot (VS Code, Agent Mode)

```
Read https://github.com/PoBruno/mcp-unreal-agent/blob/main/install/AGENT-PLAYBOOK.md
and execute every step in order.

This is a UE5 MCP server. The current workspace is a UE5 project. Install
the plugin into Plugins/UnrealAgent/, build the TS server, configure the
.uproject, write the MCP config to .vscode/mcp.json, then verify with
the health check after I restart the editor.
```

---

## Cursor

```
Install https://github.com/PoBruno/mcp-unreal-agent in this UE5 project.
Follow install/AGENT-PLAYBOOK.md in that repo end-to-end. Cursor uses
the .mcp.json variant of the config (same as Claude Code).
```

---

## Claude Desktop

```
Install the unreal-agent MCP server in my UE5 project, following the
playbook at https://github.com/PoBruno/mcp-unreal-agent/blob/main/install/AGENT-PLAYBOOK.md.

I'm on Claude Desktop, so write the MCP config to
%APPDATA%\Claude\claude_desktop_config.json using absolute paths.
Confirm with me before editing that file since it's a global config.
```

---

## Generic (any MCP-capable agent)

```
Install the MCP server at https://github.com/PoBruno/mcp-unreal-agent
into my UE5 project. Read its install/AGENT-PLAYBOOK.md and execute
every step. Detect from my environment which MCP config file to write
to (.mcp.json for Claude Code/Cursor, .vscode/mcp.json for Copilot,
claude_desktop_config.json for Claude Desktop, or ask me if unsure).
```

---

## What happens after install

The agent will tell you to try a few example prompts to verify everything works. From there, you can ask it anything UE5-related:

- "Show me the parent class of BP_PlayerCharacter and read its C++ source."
- "Create a new material instance of M_Master with the Roughness param set to 0.2."
- "Set up a level sequence that orbits the camera around the selected actor over 5 seconds."
- "Submit an MRQ render of LS_Intro at 4K and tell me where the output goes."
- "Cook this project for Windows and report the package size."

See the [README](../README.md) and the full tool list at [Tools/src/tools/](../Tools/src/tools/).
