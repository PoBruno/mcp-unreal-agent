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
