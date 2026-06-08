#!/usr/bin/env node
// Generate install/context-skill/TOOLS.md from the actual registered tools.
// Source of truth = the `server.tool("name", "description"|`description`, ...)` calls
// in Tools/src/tools/*.ts. Run via `npm run digest` from Tools/.

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const toolsRoot = resolve(here, "..");                       // Tools/
const repoRoot = resolve(toolsRoot, "..");                   // repo root
const toolsDir = join(toolsRoot, "src", "tools");
const helpersPath = join(toolsRoot, "src", "helpers.ts");
const outFile = join(repoRoot, "install", "context-skill", "TOOLS.md");

// Human-readable group labels keyed by file basename (no extension).
const GROUP_LABELS = {
  "actor-query": "Actor query",
  "actor-state": "Actor state (transform / physics / tags)",
  "animation-mutation": "Animation Blueprint authoring",
  "camera": "Viewport camera",
  "capabilities": "Capabilities / asset registry / misc",
  "components": "Blueprint components",
  "content-browser": "Content browser",
  "cvars": "Console variables (CVars)",
  "diff-blueprints": "Blueprint diff",
  "discovery": "Reflection / discovery",
  "dispatchers": "Event dispatchers",
  "editor-utils": "Editor utility",
  "graphs": "Blueprint graph management",
  "groom": "Groom (hair) bindings",
  "inspect": "Inspect (budgeted context)",
  "interfaces": "Blueprint interfaces",
  "level-actors": "Level actor lifecycle (spawn / delete / duplicate)",
  "level": "Level / map",
  "material-mutation": "Material graph authoring",
  "material-read": "Material read / describe",
  "mutation": "Blueprint authoring (variables / nodes / pins)",
  "output-log": "Editor output log",
  "params": "Function parameters",
  "pie-lifecycle": "Play-in-Editor lifecycle",
  "pie-runtime": "Play-in-Editor runtime",
  "read": "Blueprint read",
  "screenshot": "Screenshots / capture",
  "selection": "Editor selection",
  "snapshot": "Graph snapshots / restore",
  "spatial": "Spatial queries (raycast)",
  "sublevels": "Sublevels / streaming",
  "undo-redo": "Undo / redo / transactions",
  "user-types": "User types (structs / enums)",
  "utility": "Utility (save / rescan / open editor)",
  "validation": "Blueprint / material validation",
  "variables": "Blueprint variables",
  "view-mode": "Viewport view mode / show flags",
  "widgets": "UMG widgets",
};

/** Collect simple `export const NAME = "..." | `...` | '...'` string constants from helpers.ts. */
async function loadHelperConstants() {
  const src = await readFile(helpersPath, "utf8").catch(() => "");
  const out = {};
  const re = /export\s+const\s+([A-Z_][A-Z0-9_]*)\s*=\s*(`((?:[^`\\]|\\.)*)`|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*;/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const raw = m[2];
    let value;
    if (raw.startsWith("`")) value = raw.slice(1, -1);
    else if (raw.startsWith('"')) value = JSON.parse(raw);
    else value = raw.slice(1, -1);
    out[name] = value;
  }
  return out;
}

/** Read a string literal (", ', or `) starting at `i`. Returns { value, end } or null. */
function readStringLiteral(src, i, constants) {
  if (i >= src.length) return null;
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  let j = i + 1;
  let value = "";
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      const next = src[j + 1];
      if (next === "n") value += "\n";
      else if (next === "t") value += "\t";
      else if (next === "r") value += "";
      else value += next ?? "";
      j += 2;
      continue;
    }
    if (q === "`" && c === "$" && src[j + 1] === "{") {
      let k = j + 2;
      let depth = 1;
      while (k < src.length && depth > 0) {
        if (src[k] === "{") depth++;
        else if (src[k] === "}") depth--;
        if (depth > 0) k++;
      }
      const expr = src.slice(j + 2, k).trim();
      if (Object.prototype.hasOwnProperty.call(constants, expr)) {
        value += constants[expr];
      } else {
        value += `\${${expr}}`;
      }
      j = k + 1;
      continue;
    }
    if (c === q) return { value, end: j + 1 };
    value += c;
    j++;
  }
  return null;
}

/** Read an array of string literals joined with a separator: ["a","b"].join(" ") */
function readJoinedArray(src, i, constants) {
  if (src[i] !== "[") return null;
  let j = i + 1;
  const parts = [];
  // simple skip helper inlined
  const skip = (pos) => {
    while (pos < src.length) {
      const c = src[pos];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") { pos++; continue; }
      if (c === "/" && src[pos + 1] === "/") {
        while (pos < src.length && src[pos] !== "\n") pos++;
        continue;
      }
      break;
    }
    return pos;
  };
  while (true) {
    j = skip(j);
    if (src[j] === "]") { j++; break; }
    const lit = readStringLiteral(src, j, constants);
    if (!lit) return null;
    parts.push(lit.value);
    j = skip(lit.end);
    if (src[j] === ",") { j++; continue; }
    if (src[j] === "]") { j++; break; }
    return null;
  }
  j = skip(j);
  if (src[j] !== ".") return { value: parts.join(""), end: j };
  // expect .join("sep")
  if (src.slice(j, j + 5) === ".join") {
    j = skip(j + 5);
    if (src[j] !== "(") return { value: parts.join(" "), end: j };
    j = skip(j + 1);
    const sepLit = readStringLiteral(src, j, constants);
    const sep = sepLit ? sepLit.value : " ";
    j = sepLit ? skip(sepLit.end) : j;
    if (src[j] === ")") j++;
    return { value: parts.join(sep), end: j };
  }
  return { value: parts.join(""), end: j };
}

function parseToolFile(source, constants) {
  const tools = [];
  const re = /server\.tool\s*\(/g;
  let m;
  const skip = (pos) => {
    while (pos < source.length) {
      const c = source[pos];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") { pos++; continue; }
      if (c === "/" && source[pos + 1] === "/") {
        while (pos < source.length && source[pos] !== "\n") pos++;
        continue;
      }
      if (c === "/" && source[pos + 1] === "*") {
        pos += 2;
        while (pos < source.length && !(source[pos] === "*" && source[pos + 1] === "/")) pos++;
        pos += 2;
        continue;
      }
      break;
    }
    return pos;
  };
  while ((m = re.exec(source)) !== null) {
    let i = skip(m.index + m[0].length);
    const nameLit = readStringLiteral(source, i, constants);
    if (!nameLit) continue;
    i = skip(nameLit.end);
    if (source[i] !== ",") continue;
    i = skip(i + 1);
    const descLit = readStringLiteral(source, i, constants) || readJoinedArray(source, i, constants);
    if (!descLit) continue;
    tools.push({ name: nameLit.value, description: descLit.value });
  }
  return tools;
}

function flatten(desc) {
  return desc.replace(/\s+/g, " ").trim();
}
function escapeMd(s) {
  return s.replace(/\|/g, "\\|");
}

async function main() {
  const constants = await loadHelperConstants();
  const entries = (await readdir(toolsDir)).filter((f) => f.endsWith(".ts")).sort();

  const groups = [];
  let total = 0;
  for (const f of entries) {
    const src = await readFile(join(toolsDir, f), "utf8");
    const tools = parseToolFile(src, constants);
    if (tools.length === 0) continue;
    groups.push({ file: f, tools });
    total += tools.length;
  }

  const lines = [];
  lines.push("# Unreal Agent — Tool Digest");
  lines.push("");
  lines.push(
    "> **Generated** from the registered MCP tool schemas in `Tools/src/tools/*.ts`. " +
      "Do not edit by hand — re-run `npm run digest` from `Tools/`. " +
      "This catalog is the agent-facing source of truth: ~" +
      total +
      " tools across " +
      groups.length +
      " groups.",
  );
  lines.push("");
  lines.push("All tools return the structured contract:");
  lines.push("");
  lines.push("```ts");
  lines.push("type ToolResult<T> = {");
  lines.push("  ok: boolean;");
  lines.push("  data?: T;                         // tool-specific payload");
  lines.push("  refs?: Record<string, string | string[]>; // IDs the next tool consumes");
  lines.push("  nextSteps?: string[];             // hints, not commands");
  lines.push("  warnings?: string[];");
  lines.push("  errorCode?: string;               // set when ok=false");
  lines.push("};");
  lines.push("```");
  lines.push("");
  lines.push(
    "`refs.<key>` feeds directly into the next tool's parameter named `<key>` " +
      "(ADR-009 ID-chain). Treat them as opaque — do not synthesize new IDs.",
  );
  lines.push("");
  lines.push("## Groups");
  lines.push("");
  for (const g of groups) {
    const stem = basename(g.file, ".ts");
    const label = GROUP_LABELS[stem] ?? stem;
    const anchor = stem.replace(/[^a-z0-9]+/g, "-");
    lines.push(`- [${label}](#${anchor}-tools-ts-${g.tools.length}) — ${g.tools.length}`);
  }
  lines.push("");
  for (const g of groups) {
    const stem = basename(g.file, ".ts");
    const label = GROUP_LABELS[stem] ?? stem;
    lines.push(`### ${label} \`(${stem}.ts, ${g.tools.length})\``);
    lines.push("");
    lines.push("| Tool | Purpose |");
    lines.push("| --- | --- |");
    for (const t of g.tools) {
      lines.push(`| \`${t.name}\` | ${escapeMd(flatten(t.description))} |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "If a tool you expected is missing, the source has changed since this digest " +
      "was last generated. Re-run `npm run digest` in `Tools/` to refresh.",
  );
  lines.push("");

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, lines.join("\n"), "utf8");

  console.error(`[digest] wrote ${outFile} — ${total} tools across ${groups.length} groups`);
}

main().catch((err) => {
  console.error("[digest] failed:", err);
  process.exit(1);
});
