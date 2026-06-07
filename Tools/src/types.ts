// Structured output contract shared by every MCP tool.
// Source of truth for the shape: .claude/rules/mcp-tools.md.

/**
 * A ref value the agent passes to the next tool. Usually a single id, but list
 * tools return an array of ids (e.g. `blueprintIds`) — both are valid.
 */
export type RefValue = string | string[];

export type ToolResult<T = unknown> = {
  ok: boolean;
  data?: T;
  refs?: Record<string, RefValue>;
  nextSteps?: string[];
  warnings?: string[];
  errorCode?: ErrorCode;
};

/**
 * Error code registry. Keep in sync with the table in
 * .claude/rules/mcp-tools.md and .github/instructions/mcp-tools.instructions.md.
 * Values are the human-readable meaning, used for docs and tooltips only.
 */
export const ERROR_CODES = {
  UE_NOT_RUNNING: "Plugin HTTP server unreachable. Caller should try ensureUE().",
  UE_HTTP_FAILED: "HTTP call to plugin returned non-2xx or threw.",
  BP_NOT_FOUND: "Blueprint asset missing.",
  BP_COMPILE_FAILED: "Compile produced errors. Errors in data.errors.",
  BP_SAVE_FAILED: "Save returned false (read-only, source control lock).",
  ASSET_NOT_FOUND: "Non-BP asset missing.",
  MAT_PARAM_NOT_FOUND: "Named material parameter doesn't exist.",
  SEQ_TRACK_NOT_FOUND: "Named sequencer track doesn't exist.",
  MRQ_JOB_FAILED: "MovieRenderQueue job exited with error.",
  INVALID_PARAMS: "Input failed Zod validation.",
  EDITOR_REQUIRED: "Operation needs live editor (PIE start, etc.). Commandlet can't do it.",
  TRANSACTION_FAILED: "C++ couldn't begin or commit transaction.",
  SEH_EXCEPTION: "Native code raised structured exception. Asset state may be inconsistent.",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// --- Result constructors ---

/** Build a success result. */
export function ok<T>(
  data: T,
  extra?: { refs?: Record<string, RefValue>; nextSteps?: string[]; warnings?: string[] },
): ToolResult<T> {
  return { ok: true, data, ...extra };
}

/** Build a failure result. Extra strings become warnings carrying detail. */
export function fail(errorCode: ErrorCode, ...warnings: string[]): ToolResult<never> {
  return { ok: false, errorCode, warnings: warnings.filter(Boolean) };
}

// --- MCP transport mapping ---

/**
 * The shape the MCP SDK expects back from a tool handler. We serialize the full
 * ToolResult as JSON text so the agent receives the structured contract intact,
 * and flag failures via isError.
 */
export type McpToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** Map a ToolResult to the MCP tool-handler return value. */
export function toMcp(result: ToolResult): McpToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: !result.ok,
  };
}

// --- Generic raw-response → contract mapping (used to migrate all tools) ---

/** Derive an ErrorCode from a raw plugin response's error/message text. */
export function mapErrorCode(raw: any): ErrorCode {
  const e = String(raw?.error ?? raw?.message ?? raw?.errorCode ?? "").toLowerCase();
  if (!e) return "UE_HTTP_FAILED";
  if (e.includes("not an animation") || e.includes("requires editor") || e.includes("editor mode")) return "EDITOR_REQUIRED";
  if (e.includes("compile")) return "BP_COMPILE_FAILED";
  if (e.includes("save")) return "BP_SAVE_FAILED";
  if (e.includes("parameter") && e.includes("not found")) return "MAT_PARAM_NOT_FOUND";
  if (e.includes("track") && e.includes("not found")) return "SEQ_TRACK_NOT_FOUND";
  if (e.includes("transaction")) return "TRANSACTION_FAILED";
  if (e.includes("seh") || e.includes("structured exception")) return "SEH_EXCEPTION";
  if ((e.includes("blueprint") || e.includes(" bp ")) && e.includes("not found")) return "BP_NOT_FOUND";
  if (e.includes("not found") || e.includes("missing") || e.includes("does not exist")) return "ASSET_NOT_FOUND";
  return "UE_HTTP_FAILED";
}

/**
 * Pull commonly-chained ids out of a raw response into the refs map.
 *
 * Refs are emitted under the EXACT key the consuming tool accepts as input
 * (so `refs.blueprint` feeds the next tool's `blueprint` param verbatim), with
 * the `<entity>Id` convention name as an alias for the same value. This is what
 * makes ID-chaining actually work end-to-end.
 */
export function autoRefs(raw: any): Record<string, RefValue> {
  const refs: Record<string, RefValue> = {};
  if (!raw || typeof raw !== "object") return refs;
  const first = (...candidates: string[]): string | undefined => {
    for (const c of candidates) {
      const v = raw[c];
      if (typeof v === "string" && v) return v;
    }
    return undefined;
  };
  const put = (value: string | undefined, ...keys: string[]) => {
    if (value) for (const k of keys) refs[k] = value;
  };

  // Blueprint: consumed as `blueprint`; alias `blueprintId`.
  put(first("blueprintPath", "blueprint", "path", "blueprintName"), "blueprint", "blueprintId");
  // Material: consumed as `material`; alias `materialId`.
  put(first("materialPath", "material"), "material", "materialId");
  // Generic asset: consumed as `assetPath` (delete_asset, open_asset_editor).
  put(first("assetPath", "packagePath"), "assetPath", "assetId");
  // Actor: consumed as `actorLabel` (actor tools) or `label` (level tools).
  put(first("actorLabel", "label", "newLabel"), "actorLabel", "label", "actorId");
  // Graph node: consumed as `nodeId`.
  put(first("nodeId", "newNodeId"), "nodeId");
  // Graph: consumed as `graph`.
  put(first("graph", "graphName"), "graph", "graphId");

  if (Array.isArray(raw.blueprints)) {
    const ids = raw.blueprints.map((b: any) => b?.path).filter((p: any): p is string => typeof p === "string");
    if (ids.length) refs.blueprintIds = ids;
  }
  if (Array.isArray(raw.materials)) {
    const ids = raw.materials.map((m: any) => m?.path).filter((p: any): p is string => typeof p === "string");
    if (ids.length) refs.materialIds = ids;
  }
  return refs;
}

/**
 * Wrap any raw plugin JSON response into the structured ToolResult contract.
 * ok=false when the response carries `error` or `success===false`. The full raw
 * payload is preserved in `data` so agents can chain off any field.
 */
export function wrapRaw<T = unknown>(
  raw: any,
  extra?: { refs?: Record<string, RefValue>; nextSteps?: string[]; warnings?: string[] },
): ToolResult<T> {
  if (raw === null || raw === undefined) return fail("UE_HTTP_FAILED", "Empty response from plugin");
  if (raw.error || raw.success === false) {
    return {
      ok: false,
      errorCode: mapErrorCode(raw),
      warnings: [String(raw.error ?? raw.message ?? "operation failed")],
      data: raw as T,
    };
  }
  return { ok: true, data: raw as T, refs: extra?.refs, nextSteps: extra?.nextSteps, warnings: extra?.warnings };
}

/** Convenience: run an async raw call and map exceptions to UE_HTTP_FAILED. */
export async function toContract<T = unknown>(
  fn: () => Promise<any>,
  refsFrom: (raw: any) => Record<string, RefValue> = autoRefs,
  nextSteps?: string[],
): Promise<McpToolResponse> {
  try {
    const raw = await fn();
    return toMcp(wrapRaw<T>(raw, { refs: refsFrom(raw), nextSteps }));
  } catch (e) {
    return toMcp(fail("UE_HTTP_FAILED", String(e)));
  }
}
