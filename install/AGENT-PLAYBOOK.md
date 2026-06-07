# AGENT-PLAYBOOK.md

You are an AI coding agent (Claude Code, GitHub Copilot, Cursor, anything that speaks MCP and has shell tools). The user asked you to install `mcp-unreal-agent` into their UE5 project. Follow this playbook **step by step**. Don't skip steps. If a step fails, stop and ask the user — don't improvise.

This playbook is the install harness for `mcp-unreal-agent`. The repo is at https://github.com/PoBruno/mcp-unreal-agent.

---

## Step 0 — Confirm scope with the user

Say:

> I'll install `mcp-unreal-agent` into your UE5 project. This will:
> 1. Clone the plugin into `<YourProject>/Plugins/UnrealAgent/`
> 2. Build the TypeScript MCP server
> 3. Enable the plugin and PythonScriptPlugin in your `.uproject`
> 4. Enable Python remote execution in `Config/DefaultEngine.ini`
> 5. Write MCP configuration for your agent
> 6. Ask you to restart your editor
> 7. Verify with a health check
>
> Total time: 2-5 minutes plus editor compile (~30-60 seconds on first open). Proceed?

Wait for confirmation.

---

## Step 1 — Locate the UE5 project

Find the nearest `.uproject` file by walking up from the current directory.

PowerShell:
```powershell
$dir = Get-Location
while ($dir) {
    $uproject = Get-ChildItem -Path $dir -Filter "*.uproject" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($uproject) { break }
    $dir = Split-Path $dir -Parent
}
if (-not $uproject) { Write-Error "No .uproject found"; exit 1 }
Write-Host "Project: $($uproject.FullName)"
```

If none is found, ask the user for the project root path. Don't proceed without one.

If multiple `.uproject` files exist in nested dirs, ask the user which one.

Store the project root for later steps: `<UEProject>` = the directory containing the `.uproject`.

---

## Step 2 — Validate engine version

Read `EngineAssociation` from the `.uproject`:

```powershell
$config = Get-Content $uproject.FullName -Raw | ConvertFrom-Json
$engineVersion = $config.EngineAssociation
Write-Host "Engine version: $engineVersion"
```

Validate it's `5.4` or later (treat as `Major.Minor`, compare numerically). If `5.3` or older:

> Your project uses UE $engineVersion. `mcp-unreal-agent` requires 5.4+. Options:
> 1. Upgrade your project's engine version (right-click `.uproject` → Switch Unreal Engine Version → 5.4+)
> 2. Use a different project that's on 5.4+
> 3. Cancel install

Wait for the user's call.

---

## Step 3 — Clone the plugin

Create the `Plugins` directory if missing, then clone:

```powershell
$pluginsDir = Join-Path (Split-Path $uproject.FullName -Parent) "Plugins"
if (-not (Test-Path $pluginsDir)) {
    New-Item -ItemType Directory -Path $pluginsDir | Out-Null
}

$pluginPath = Join-Path $pluginsDir "UnrealAgent"
if (Test-Path $pluginPath) {
    Write-Host "Plugin already exists at $pluginPath. Skipping clone."
} else {
    git clone https://github.com/PoBruno/mcp-unreal-agent.git $pluginPath
    if ($LASTEXITCODE -ne 0) { Write-Error "Clone failed"; exit 1 }
}
```

If the plugin folder already exists, ask the user whether to update (`git pull`) or skip.

---

## Step 4 — Build the TypeScript MCP server

```powershell
$toolsDir = Join-Path $pluginPath "Tools"
Push-Location $toolsDir
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; Pop-Location; exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "npm run build failed"; Pop-Location; exit 1 }
Pop-Location

# Verify
if (-not (Test-Path (Join-Path $toolsDir "dist/index.js"))) {
    Write-Error "Build output missing: dist/index.js"
    exit 1
}
```

If `npm install` fails: confirm Node 18+ is installed (`node --version`). If older, ask the user to upgrade.

If `npm run build` fails: read the error, surface the line in the user's chat. Don't try to fix TS errors automatically — the source is the repo's responsibility, not the install playbook's.

---

## Step 5 — Enable plugin in .uproject

Add `UnrealAgent` and `PythonScriptPlugin` to the `Plugins` array of the `.uproject`. If either is already there, ensure `Enabled = true`.

```powershell
$config = Get-Content $uproject.FullName -Raw | ConvertFrom-Json

# Ensure Plugins array exists
if (-not $config.PSObject.Properties['Plugins']) {
    $config | Add-Member -Type NoteProperty -Name 'Plugins' -Value @()
}

$pluginsToEnsure = @(
    @{ Name = "UnrealAgent";        Enabled = $true },
    @{ Name = "PythonScriptPlugin"; Enabled = $true }
)

foreach ($p in $pluginsToEnsure) {
    $existing = $config.Plugins | Where-Object { $_.Name -eq $p.Name }
    if ($existing) {
        $existing.Enabled = $true
    } else {
        $config.Plugins += [PSCustomObject]@{ Name = $p.Name; Enabled = $true }
    }
}

# Write back, preserving JSON shape
$config | ConvertTo-Json -Depth 10 | Set-Content $uproject.FullName -Encoding UTF8
```

⚠️ Preserve the `.uproject`'s existing fields. Don't drop `Modules`, `EngineAssociation`, etc.

---

## Step 6 — Configure Python remote execution

Edit (or create) `<UEProject>/Config/DefaultEngine.ini`. Append the Python settings section if missing. Don't overwrite the file — append idempotently.

```powershell
$configDir = Join-Path (Split-Path $uproject.FullName -Parent) "Config"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
}
$iniPath = Join-Path $configDir "DefaultEngine.ini"
if (-not (Test-Path $iniPath)) {
    New-Item -ItemType File -Path $iniPath | Out-Null
}

$content = Get-Content $iniPath -Raw -ErrorAction SilentlyContinue
if (-not $content) { $content = "" }

$pythonSection = "[/Script/PythonScriptPlugin.PythonScriptPluginSettings]"
if ($content -notmatch [regex]::Escape($pythonSection)) {
    Add-Content $iniPath -Value "`n$pythonSection"
    Add-Content $iniPath -Value "bRemoteExecution=True"
} else {
    Write-Host "Python settings section already present. Verify bRemoteExecution=True manually."
}
```

⚠️ If the section exists but `bRemoteExecution=True` is missing or set to False, tell the user — don't auto-modify mid-section without their confirmation.

---

## Step 7 — Write MCP config

Detect which agent the user is using (or ask). Then write the appropriate config.

### For Claude Code

Merge into `<UEProject>/.mcp.json`:

```powershell
$mcpPath = Join-Path (Split-Path $uproject.FullName -Parent) ".mcp.json"
$mcpConfig = if (Test-Path $mcpPath) { Get-Content $mcpPath -Raw | ConvertFrom-Json } else { [PSCustomObject]@{ mcpServers = [PSCustomObject]@{} } }

if (-not $mcpConfig.PSObject.Properties['mcpServers']) {
    $mcpConfig | Add-Member -Type NoteProperty -Name 'mcpServers' -Value ([PSCustomObject]@{})
}

$mcpConfig.mcpServers | Add-Member -Type NoteProperty -Name 'unreal-agent' -Value ([PSCustomObject]@{
    command = "node"
    args = @("Plugins/UnrealAgent/Tools/dist/index.js")
    env = [PSCustomObject]@{ UE_PROJECT_DIR = "." }
}) -Force

$mcpConfig | ConvertTo-Json -Depth 10 | Set-Content $mcpPath -Encoding UTF8
```

### For GitHub Copilot (VS Code)

Merge into `<UEProject>/.vscode/mcp.json`:

```powershell
$vscodeDir = Join-Path (Split-Path $uproject.FullName -Parent) ".vscode"
if (-not (Test-Path $vscodeDir)) { New-Item -ItemType Directory -Path $vscodeDir | Out-Null }
$mcpPath = Join-Path $vscodeDir "mcp.json"
$mcpConfig = if (Test-Path $mcpPath) { Get-Content $mcpPath -Raw | ConvertFrom-Json } else { [PSCustomObject]@{ servers = [PSCustomObject]@{} } }

if (-not $mcpConfig.PSObject.Properties['servers']) {
    $mcpConfig | Add-Member -Type NoteProperty -Name 'servers' -Value ([PSCustomObject]@{})
}

$mcpConfig.servers | Add-Member -Type NoteProperty -Name 'unreal-agent' -Value ([PSCustomObject]@{
    command = "node"
    args = @("Plugins/UnrealAgent/Tools/dist/index.js")
    env = [PSCustomObject]@{ UE_PROJECT_DIR = "." }
}) -Force

$mcpConfig | ConvertTo-Json -Depth 10 | Set-Content $mcpPath -Encoding UTF8
```

### For Cursor

Cursor reads `.mcp.json` like Claude Code. Use the Claude Code variant.

### For Claude Desktop

Different file: `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Use absolute paths for `args`. Ask the user before editing — this is a global config, not project-scoped.

---

## Step 8 — Ask the user to restart the editor

Say:

> Configuration complete. Now please:
> 1. Close the UE5 editor if it's open
> 2. Re-open `<UEProject>/<Name>.uproject`
> 3. The plugin will compile on first open (30-60 seconds, normal)
> 4. When the editor finishes loading, tell me and I'll verify the install
>
> If a "Missing modules" prompt appears, click "Yes" to compile.

Don't proceed. Wait for the user to confirm the editor is open and loaded.

---

## Step 9 — Verify install with health check

Once the editor is up, call the `health` MCP tool. Expected response:

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

If `mode == "editor"` → install succeeded.

If you get `UE_NOT_RUNNING`:
- Check the editor's Output Log for `LogUnrealAgent` entries.
- If no `LogUnrealAgent` lines → plugin didn't load. Check `Plugins → UnrealAgent` in Edit menu, ensure it's enabled.
- If `LogUnrealAgent: HTTP server failed to bind port 9847` → another process is using the port. Either close it, or change the port in the MCP config and the plugin (currently requires source edit — open an issue).

If the MCP tool isn't available in your agent at all:
- The MCP config file may not be loaded. Restart your agent (Claude Code: close and re-open). For Copilot in VS Code: reload window.

---

## Step 10 — Tell the user what to try first

After successful install, suggest 2-3 concrete prompts:

> Try one of these to verify the agent has full control:
>
> 1. **"List all my Blueprints in `/Game`"** — exercises asset discovery
> 2. **"Create a new Blueprint called `BP_TestActor` in `/Game/Test`, inheriting from `Actor`, with a `Health` float variable defaulting to 100"** — exercises composite atomic flow
> 3. **"Open the Output Log and tell me what you see"** — exercises the screenshot/OCR path
>
> Full tool reference: https://github.com/PoBruno/mcp-unreal-agent#tools

That's the install complete.

---

## Failure recovery

If any step fails fatally and the user wants to undo:

1. Remove the plugin: `Remove-Item -Recurse -Force "<UEProject>/Plugins/UnrealAgent"`.
2. Revert `.uproject`: remove `UnrealAgent` from the `Plugins` array (leave `PythonScriptPlugin` — the user may want it).
3. Remove the MCP config entry: from `.mcp.json` or `.vscode/mcp.json`.
4. Leave `Config/DefaultEngine.ini` alone (the Python setting is harmless even if the plugin's gone).

Tell the user what was undone and what wasn't.
