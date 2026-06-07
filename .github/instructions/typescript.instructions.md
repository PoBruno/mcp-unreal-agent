---
applyTo: "Tools/**/*.ts"
---

# TypeScript rules

Apply to all TypeScript files under `Tools/`. Mirror of [`.claude/rules/typescript.md`](../../.claude/rules/typescript.md).

## Module system

- ESM, `.js` extensions in imports (TS quirk for Node ESM). Yes, even though the source is `.ts`.
- `"type": "module"` in `Tools/package.json`.
- `"module": "NodeNext"` in `tsconfig.json`.

## Strictness

- `strict: true`.
- No `any`. Use `unknown` and narrow with type guards.
- No `as` casts except at JSON boundaries — and even then, validate with Zod immediately.
- Optional chaining and nullish coalescing over manual null checks.

## Async

- Always `await`. Never `.then(...)` chains in tool code.
- Never `process.exit()` mid-operation — let the MCP server lifecycle handle exit.
- Top-level `async` entry point wrapped in `.catch(err => { console.error(err); process.exit(1); })`.

## Logging

- `console.error` only (stdout is the MCP transport channel, polluting it breaks the protocol).
- Prefix with `[unreal-agent]` so users can grep.
- No structured logging library — keep it simple.

## Tool registration

Each tool group lives in its own file under `Tools/src/tools/<group>.ts` and exports a `register<Group>Tools(server: McpServer)` function. The entry point `src/index.ts` calls every register function. Don't define tools inline in `index.ts`.

## HTTP calls to the plugin

Use the helpers in `src/ue-bridge.ts`:

- `ueGet<T>(path: string): Promise<T>` for read-only endpoints.
- `uePost<T>(path: string, body: object): Promise<T>` for mutations.

Both throw on non-200 responses. Catch in the tool and convert to the structured output contract:

```ts
try {
  const data = await uePost<{ blueprintId: string }>("/bp/create", { name });
  return { ok: true, data, refs: { blueprintId: data.blueprintId }, nextSteps: ["call bp_compile with this blueprintId"] };
} catch (err) {
  return { ok: false, errorCode: "UE_HTTP_FAILED", warnings: [String(err)] };
}
```

## File / path handling

- Use `node:path` not string concat.
- Use `node:fs/promises` not `fs.readFileSync` in hot paths.
- Project root detection: walk up from `cwd()` looking for `.uproject` — helper in `ue-bridge.ts` (`findUProject`).

## What not to do

- Don't import from `dist/`. Always source-relative.
- Don't shell out to `git`, `npm`, `node` from inside a tool — that's the install playbook's job, not a tool's.
- Don't read environment variables in tool code — read them once in `ue-bridge.ts` and export typed constants.
- Don't catch and swallow errors. Convert to `{ ok: false, errorCode: "..." }`.
