# DECISIONS.md

Architecture Decision Records. Append-only — never delete an ADR, supersede it by writing a new one.

Format:
- **ADR-NNN: Title**
- **Status:** Accepted | Superseded by ADR-XXX | Deprecated
- **Date:** YYYY-MM-DD
- **Problem:** What forced the decision
- **Decision:** What we chose
- **Rationale:** Why we chose it
- **Alternatives:** What we rejected and why
- **Consequences:** What this commits us to

---

## ADR-001: Fork ue5-mcp instead of contributing upstream

**Status:** Accepted
**Date:** 2025-11-20

### Problem
Upstream `ue5-mcp` is sharply scoped to Blueprint inspection. Its CONTRIBUTING.md is AI-only. The v3 roadmap I drafted (5 phases, 12 PRs, ~120 tools across asset pipeline, cinematic, MRQ, WP, cook/package) doesn't fit upstream's intentional small surface area. Trying to land that scope through upstream gatekeeping would take months and most of it would be rejected.

### Decision
Create a fresh repo `PoBruno/mcp-unreal-agent`. Lift the C++ plugin and TS infra from upstream as MIT-licensed foundation. Add an `upstream` remote pointing read-only at `mirno-ehf/ue5-mcp` for cherry-picking improvements.

### Rationale
- We get to design tool ergonomics from scratch (structured output contract, ID chaining, composite atomic flows) without upstream review cycles.
- Open contribution policy attracts non-AI contributors that upstream excludes.
- Dual harness (Claude + Copilot) is novel — upstream is Claude-only.
- Attribution preserved via `NOTICE` + README credits.

### Alternatives rejected
- **GitHub fork.** Creates UI noise (ahead/behind counters), marks every commit as derivative, limits branch flexibility. We want a clean repo identity.
- **Contribute upstream first, fork later.** Wastes weeks on PRs that won't land. Better to invest that time building.
- **Start completely from scratch (no upstream code).** The plugin's HTTP scaffold, SEH wrappers, and editor subsystem are non-trivial. Re-inventing them adds weeks for no benefit.

### Consequences
- We carry MIT attribution forever.
- When upstream lands a useful fix (e.g. better SEH handler), we cherry-pick from the `upstream` remote.
- We never push back to `upstream`.

---

## ADR-002: Rename module from BlueprintMCP to UnrealAgent

**Status:** Accepted
**Date:** 2025-11-20

### Problem
The upstream plugin is named `BlueprintMCP`. Our scope is broader than Blueprints (materials, sequencer, MRQ, WP, cook/package). Keeping the old name would be misleading and signal "this is just a fork", not "this is its own product".

### Decision
Full case-sensitive rename across all files and content:
- `BlueprintMCP` → `UnrealAgent`
- `BLUEPRINTMCP` → `UNREALAGENT`
- `blueprintmcp` → `unrealagent`
- `blueprint-mcp` → `unreal-agent`

### Rationale
- Clean identity on day one. Mixed naming is noise that compounds.
- The rename is mechanical and easily verified with a grep for leftovers.
- All upstream code paths that use the old name are touched by the same rename, so import paths, class names, log categories all flip together.

### Alternatives rejected
- **Keep `BlueprintMCP`, brand only at the product level.** Mixed naming inside source files looks unfinished. Confuses contributors.
- **Defer rename to Sprint 1.** Means every Sprint-0 task has to grep both names. Cheaper to do now.

### Consequences
- Anyone reading upstream PRs needs to mentally translate the names when cherry-picking.
- Log category renamed to `LogUnrealAgent`; any external tools that grep logs by `LogBlueprintMCP` break (acceptable — no such tools exist yet).

---

## ADR-003: Structured output contract for every tool

**Status:** Accepted
**Date:** 2025-11-20

### Problem
The agent needs to chain tools fluently. Upstream returns formatted text + raw JSON inconsistently — the agent has to re-parse on every call. That wastes tokens and creates ambiguity about what's an ID vs a display string.

### Decision
Every tool returns `{ ok, data, refs, nextSteps, warnings, errorCode }`. `refs` holds IDs by canonical name (`blueprintId`, `materialId`, etc.). `nextSteps` are non-imperative hints. Defined in [`.claude/rules/mcp-tools.md`](../rules/mcp-tools.md).

### Rationale
- ID chaining lets the agent write workflows like dataflow rather than orchestration.
- `nextSteps` reduces the agent's planning overhead — it's pre-computed guidance.
- `errorCode` is machine-readable; the agent doesn't have to regex error messages.
- One contract means the agent learns it once.

### Alternatives rejected
- **Free-form text responses.** Token-efficient for humans, terrible for agent chaining.
- **Full JSON-RPC error model.** Too rigid — `errorCode` strings are enough and easier to extend.
- **Per-tool ad-hoc shapes.** No consistency. Maintenance nightmare.

### Consequences
- Every tool needs an entry in the error code registry. Adding a new code touches two files (rule doc + bridge doc).
- Composite tools can return rich `refs` with multiple IDs (e.g. created BP + its component IDs). Agents chain off them.

---

## ADR-004: Composite atomic flows over primitive chains

**Status:** Accepted
**Date:** 2025-11-20

### Problem
Common UE5 workflows are 3-7 primitive operations that all belong in one undoable unit. Forcing the agent to call them one-by-one is slow, wastes tokens, and breaks transaction boundaries if a step fails.

### Decision
For any natural multi-step flow, expose a single composite tool whose C++ handler wraps everything in one `FScopedTransaction`. Primitives stay available for advanced cases.

Example: `bp_create_with_variables({ name, variables: [...] })` instead of `bp_create → bp_add_variable × N → bp_compile → bp_save`.

### Rationale
- Atomic undo: Ctrl+Z reverses the whole logical action.
- Fewer round trips: 1 HTTP call vs N+2.
- The agent learns one tool name, not a sequence.
- Failures roll back cleanly instead of leaving half-mutated assets.

### Alternatives rejected
- **Only primitives, let the agent chain.** Slow, error-prone, breaks undo grouping.
- **TS-side composition.** Each primitive is its own HTTP call — no shared transaction.
- **Macro recording.** UE5's macro system isn't accessible from outside the editor.

### Consequences
- More tools to design. Each composite needs careful API design (which variables go in, which `refs` come out).
- Tests cover the composite as a unit, not its parts.
- We pay this cost up front for each common flow. The agent benefits forever.

---

## ADR-005: Dual harness (Claude + Copilot) from one source of truth

**Status:** Accepted
**Date:** 2025-11-20

### Problem
UE5 devs split between Claude Code and GitHub Copilot (Copilot is dominant in VS Code / Rider). A Claude-only repo blocks adoption from the Copilot half. But maintaining two separate instruction sets means drift.

### Decision
- `CLAUDE.md` + `.claude/` is the single source of truth.
- `.github/copilot-instructions.md` is a thin bridge that delegates to `CLAUDE.md`.
- `.github/instructions/*.instructions.md` files are paste-and-trim copies of `.claude/rules/*.md` files, with `applyTo` frontmatter for Copilot's glob system.
- `AGENTS.md` is a universal entry for Cursor / Aider / Continue.

### Rationale
- One product, multiple agents, one mental model for contributors.
- The Copilot bridge is small and review-able for drift.
- Demonstrates a transferable pattern other projects can copy.

### Alternatives rejected
- **Claude-only.** Cuts off Copilot users — a large fraction of the UE5 dev community.
- **Copilot-only.** Cuts off Claude users — the AI-coding-tooling early-adopter community.
- **Separate independent instruction sets.** Guaranteed drift.

### Consequences
- When a rule changes in `.claude/rules/`, update the matching `.github/instructions/` file. Track via PR review until a CI drift-check is in place.
- The `.github/instructions/*.instructions.md` content is duplicated, intentionally. Don't try to symlink — Copilot won't resolve symlinks for instructions.

---

## ADR-006: HTTP on localhost:9847 as the IPC channel

**Status:** Accepted
**Date:** 2025-11-20

### Problem
Need a transport between the Node MCP server and the C++ plugin running inside UE5. Choices: HTTP, WebSocket, Unix socket (not Windows-native), named pipe, custom binary.

### Decision
HTTP on `localhost:9847` (configurable via `UE_PORT`). One process per port. JSON in, JSON out.

### Rationale
- UE5 has solid HTTP server support out of the box.
- Trivial to debug with curl.
- Survives Node restarts without touching UE.
- Latency cost on localhost is ~1-2 ms — well below the agent's reasoning loop.

### Alternatives rejected
- **WebSocket.** Persistent connection adds complexity (reconnect logic, message framing) for marginal latency gain.
- **Named pipes.** Windows-specific syntax, awkward from Node, debugging tools weaker.
- **Custom binary.** ~5 ms saved per call, weeks of complexity. Bad trade.

### Consequences
- Localhost only. If the developer wants remote, they SSH tunnel.
- No auth, no TLS. Document the threat model in `ARCHITECTURE.md` so this stays explicit.
- Port collision possible if user runs two UE editors. Each project should use its own port via env var. TODO: doc this in install playbook.

---

## ADR-007: Open contribution policy (humans + AI)

**Status:** Accepted
**Date:** 2025-11-20

### Problem
Upstream `ue5-mcp` is AI-only. That intentionally excludes a large portion of the UE5 community that's experienced with C++ plugin development but doesn't use AI agents heavily. We're in the opposite position — we *want* both audiences.

### Decision
`CONTRIBUTING.md` explicitly welcomes humans and AI agents. Disclosure for AI-assisted PRs is requested in the PR body but not gatekept.

### Rationale
- Maximizes contributor pool.
- AI disclosure is honest, not punitive.
- The harness is openly advertised as a Claude + Copilot project — contributors using the same tooling are net positive.

### Alternatives rejected
- **AI-only (upstream's model).** Excludes too many capable contributors.
- **Humans-only.** Hypocritical given the harness.
- **Hidden AI use.** Dishonest.

### Consequences
- Code review must catch both human and AI failure modes. AI: shallow fixes that miss invariants, hallucinated API names. Human: scope creep, style drift.
- PR template will ask for AI disclosure.
