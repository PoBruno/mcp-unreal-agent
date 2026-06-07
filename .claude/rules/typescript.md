---
applyTo: "Tools/**/*.ts"
---

# TypeScript rules

Apply to all TS files under `Tools/`. Mirror of [`.github/instructions/typescript.instructions.md`](../../.github/instructions/typescript.instructions.md) — keep in sync.

## Module system

- ESM, `.js` extensions in imports (Node ESM quirk for TS).
- `"type": "module"` in `Tools/package.json`.
- `"module": "NodeNext"` in `tsconfig.json`.

## Strictness

- `strict: true`.
- No `any`. Use `unknown` and narrow with type guards.
- No `as` casts except at JSON boundaries — validate with Zod immediately after.
- Optional chaining / nullish coalescing over manual null checks.

## Async

- Always `await`. No `.then(...)` chains in tool code.
- No `process.exit()` mid-operation.
- Top-level entry wrapped in `.catch(err => { console.error(err); process.exit(1); })`.

## Logging

- `console.error` only — stdout is the MCP transport, polluting it breaks the protocol.
- Prefix `[unreal-agent]` so users can grep.

## Tool registration

Each tool group lives in `Tools/src/tools/<group>.ts` exporting `register<Group>Tools(server: McpServer)`. `src/index.ts` calls every register function. No inline tool definitions in `index.ts`.

## HTTP calls to the plugin

Use helpers in `src/ue-bridge.ts`:

- `ueGet<T>(path: string): Promise<T>` for read-only.
- `uePost<T>(path: string, body: object): Promise<T>` for mutations.

Both throw on non-200. Catch and convert to structured output:

```ts
try {
  const data = await uePost<{ blueprintId: string }>("/bp/create", { name });
  return {
    ok: true,
    data,
    refs: { blueprintId: data.blueprintId },
    nextSteps: ["call bp_compile with this blueprintId"],
  };
} catch (err) {
  return { ok: false, errorCode: "UE_HTTP_FAILED", warnings: [String(err)] };
}
```

## Path / file handling

- `node:path` not string concat.
- `node:fs/promises` not `fs.readFileSync` in hot paths.
- Project root detection via `findUProject` in `ue-bridge.ts`.

## What not to do

- No imports from `dist/`. Source-relative only.
- No shelling out to `git`/`npm`/`node` from a tool — that's the install playbook's job.
- No env reads inside tool code — read once in `ue-bridge.ts` and export typed constants.
- No swallowed errors — convert to `{ ok: false, errorCode: "..." }`.
