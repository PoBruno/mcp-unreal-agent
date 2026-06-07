import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureUE, ueGet, uePost, isUEHealthy, gracefulShutdown, state } from "../ue-bridge.js";
import { ok, fail, toMcp, type ToolResult } from "../types.js";

export type ServerStatusData = {
  status: string;
  mode: string;
  blueprintCount: number;
  mapCount: number | null;
};

/** Pure mapper from the raw /api/health payload to the structured contract. */
export function buildServerStatusResult(raw: any, editorMode: boolean): ToolResult<ServerStatusData> {
  if (raw?.error) return fail("UE_HTTP_FAILED", String(raw.error));
  const data: ServerStatusData = {
    status: raw?.status ?? "ok",
    mode: raw?.mode ?? (editorMode ? "editor" : "commandlet"),
    blueprintCount: raw?.blueprintCount ?? 0,
    mapCount: raw?.mapCount ?? null,
  };
  return ok(data, {
    nextSteps: [
      "call list_blueprints to enumerate Blueprints in the project",
      "call rescan_assets if newly created assets are missing",
    ],
  });
}

export function registerUtilityTools(server: McpServer): void {
  server.tool(
    "server_status",
    "Check UE5 server status (the health tool). Starts the server if not running (blocks until ready). Returns the structured contract with mode and indexed asset counts.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return toMcp(fail("UE_NOT_RUNNING", err));

      try {
        const raw = await ueGet("/api/health");
        return toMcp(buildServerStatusResult(raw, state.editorMode));
      } catch (e) {
        return toMcp(fail("UE_HTTP_FAILED", String(e)));
      }
    }
  );

  server.tool(
    "rescan_assets",
    "Re-scan the UE5 asset registry and refresh the server's cached asset lists. Use this if newly created assets are not appearing in list_blueprints/list_materials, or if the server started before the editor finished loading assets.",
    {},
    async () => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/rescan", {});
      if (data.error) {
        return { content: [{ type: "text" as const, text: `Rescan failed: ${data.error}` }] };
      }

      const lines = [
        "Asset registry rescanned.",
        `Blueprints: ${data.blueprintCount}${data.delta?.blueprints ? ` (${data.delta.blueprints >= 0 ? "+" : ""}${data.delta.blueprints})` : ""}`,
        `Maps: ${data.mapCount}${data.delta?.maps ? ` (${data.delta.maps >= 0 ? "+" : ""}${data.delta.maps})` : ""}`,
        `Materials: ${data.materialCount}${data.delta?.materials ? ` (${data.delta.materials >= 0 ? "+" : ""}${data.delta.materials})` : ""}`,
        `Material Instances: ${data.materialInstanceCount}${data.delta?.materialInstances ? ` (${data.delta.materialInstances >= 0 ? "+" : ""}${data.delta.materialInstances})` : ""}`,
        `Material Functions: ${data.materialFunctionCount}${data.delta?.materialFunctions ? ` (${data.delta.materialFunctions >= 0 ? "+" : ""}${data.delta.materialFunctions})` : ""}`,
      ];
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "exec_command",
    "Execute an editor console command and return its output. Requires editor mode (not commandlet). Useful for: saving assets (\"Asset.SaveAll\"), running automation tests (\"Automation RunTests <filter>\"), triggering Live Coding, etc.",
    {
      command: z.string().describe("The console command to execute (e.g. \"Asset.SaveAll\", \"Automation RunTests MyTests\")"),
    },
    async ({ command }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/exec", { command });
      if (data.error) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      const lines = [
        `Command: ${data.command}`,
        `Success: ${data.success}`,
      ];
      if (data.output) {
        lines.push(`Output:\n${data.output}`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "python_exec",
    "Run a Python statement or script inside the UE editor and return its captured output and result. Use this (not exec_command) when you need the print output or an evaluated value back. Single expressions are evaluated (value returned in 'result'); multi-line or assignments are executed. Requires editor mode + the Python Editor Script Plugin.",
    {
      command: z.string().describe("Python code to run (e.g. 'unreal.SystemLibrary.get_engine_version()' or a multi-line script)"),
    },
    async ({ command }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/python-exec", { command });
      if (data.error) {
        return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      }

      const lines = [`success: ${data.success}`];
      if (data.result) lines.push(`result: ${data.result}`);
      if (data.output) lines.push(`output:\n${data.output}`);
      if (!data.result && !data.output) lines.push("(no output)");
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "set_presence",
    "Toggle live-view presence. When enabled (default), editing a Blueprint auto-opens its editor as a docked tab in the main window so the user can watch the agent work. Disable to avoid opening editors during bulk operations.",
    {
      enabled: z.boolean().describe("true to auto-reveal edited Blueprints, false to disable"),
    },
    async ({ enabled }) => {
      const err = await ensureUE();
      if (err) return { content: [{ type: "text" as const, text: err }] };

      const data = await uePost("/api/set-presence", { enabled });
      if (data.error) return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
      return { content: [{ type: "text" as const, text: `Presence auto-reveal: ${data.autoReveal ? "ON" : "OFF"}` }] };
    }
  );

  server.tool(
    "shutdown_server",
    "Shut down the UE5 Blueprint server to free memory (~2-4 GB). The server will auto-restart on the next blueprint tool call. Use this when done with blueprint analysis. Cannot shut down the editor — only the standalone commandlet.",
    {},
    async () => {
      if (state.editorMode) {
        return {
          content: [{
            type: "text" as const,
            text: "Connected to UE5 editor \u2014 cannot shut down the editor's MCP server. Close the editor to stop serving.",
          }],
        };
      }

      if (!state.ueProcess && !state.startupPromise && !(await isUEHealthy())) {
        return { content: [{ type: "text" as const, text: "UE5 server is already stopped." }] };
      }

      await gracefulShutdown();
      state.startupPromise = null;

      return {
        content: [{
          type: "text" as const,
          text: "UE5 Blueprint server shut down. Memory freed. It will auto-restart on the next blueprint tool call.",
        }],
      };
    }
  );
}
