# Codebase Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 issues identified in the codebase audit — deduplicate content loading, separate CLI from library, harden error handling, try strict TypeScript, and update stale ADRs.

**Architecture:** Each fix is an isolated, independently committable change. Fix 1 creates a shared module that Fix 2–4 build on top of. Fix 5 (docs) goes last to capture the final state. All 41 existing tests must pass after every task.

**Tech Stack:** TypeScript 5.7, Node 18+, Vitest, Biome, MCP SDK, Zod v4, @ton/tolk-js, @ton/core

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/content.ts` | Create | Shared content loader with lazy cache |
| `src/cli.ts` | Create | CLI entrypoint — stdio transport setup |
| `src/index.ts` | Modify | Pure library exports (remove CLI logic) |
| `src/resources.ts` | Modify | Remove local `loadContent`, import from `content.ts` |
| `src/prompts.ts` | Modify | Remove local `loadContent`, import from `content.ts` |
| `src/tools.ts` | Modify | Add `getErrorMessage`, replace `err: any` |
| `tsconfig.json` | Modify | Try `strict: true` |
| `package.json` | Modify | Update `bin` to `dist/cli.js` |
| `DECISIONS.md` | Modify | Revise ADR-2, ADR-4, ADR-5 |

---

### Task 1: Extract shared `loadContent` into `src/content.ts`

**Files:**
- Create: `src/content.ts`
- Modify: `src/resources.ts`
- Modify: `src/prompts.ts`

- [ ] **Step 1: Create `src/content.ts`**

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contentDir = join(dirname(fileURLToPath(import.meta.url)), "content");

const cache = new Map<string, string>();

export function loadContent(filename: string): string {
  let text = cache.get(filename);
  if (text === undefined) {
    text = readFileSync(join(contentDir, filename), "utf-8");
    cache.set(filename, text);
  }
  return text;
}
```

- [ ] **Step 2: Update `src/resources.ts` — remove local loader, import shared one**

Replace the entire top section (lines 1–11) with:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadContent } from "./content.js";
```

Remove the `_cache` / `getContent()` block (lines 13–28). Replace every `getContent()["language-guide"]` call with `loadContent("language-guide.md")`, every `getContent()["stdlib-reference"]` with `loadContent("stdlib-reference.md")`, etc. The mapping:

| Old call | New call |
|----------|----------|
| `getContent()["language-guide"]` | `loadContent("language-guide.md")` |
| `getContent()["stdlib-reference"]` | `loadContent("stdlib-reference.md")` |
| `getContent().changelog` | `loadContent("changelog.md")` |
| `getContent()["tolk-vs-func"]` | `loadContent("tolk-vs-func.md")` |
| `getContent()["example-counter"]` | `loadContent("example-counter.tolk")` |
| `getContent()["example-jetton"]` | `loadContent("example-jetton.tolk")` |

- [ ] **Step 3: Update `src/prompts.ts` — remove local loader, import shared one**

Replace the entire top section (lines 1–11) with:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadContent } from "./content.js";
```

Replace all `loadContent("language-guide.md")` calls — they already match the new API, so just remove the local function definition. The calls inside the prompt handlers (`loadContent("language-guide.md")`, `loadContent("example-counter.tolk")`, etc.) stay as-is since they already use filenames with extensions.

- [ ] **Step 4: Run build and tests**

```bash
npm run build && npm test
```

Expected: Build succeeds, all 41 tests pass.

- [ ] **Step 5: Run linter**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/content.ts src/resources.ts src/prompts.ts
git commit -m "refactor: extract shared loadContent into src/content.ts"
```

---

### Task 2: Extract `src/cli.ts` — clean library/CLI separation

**Files:**
- Create: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `src/cli.ts`**

```ts
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./index.js";

const server = createServer();
const transport = new StdioServerTransport();
server.connect(transport).then(
  () => console.error("iz-tolk-mcp server started on stdio"),
  (err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  },
);
```

- [ ] **Step 2: Update `src/index.ts` — remove CLI logic and stdio import**

Remove the `StdioServerTransport` import (line 6). Remove the entire `isDirectRun` block (lines 38–49). The file should end after the `createSandboxServer` export. Final content:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

let version = "0.0.0";
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
  version = pkg.version;
} catch {
  // package.json not found — use fallback version
}

function createServer(): McpServer {
  const server = new McpServer(
    { name: "iz-tolk-mcp", version },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

export { createServer };
export function createSandboxServer() {
  return createServer();
}
```

- [ ] **Step 3: Update `package.json` — point `bin` to `dist/cli.js`**

Change:
```json
"bin": {
  "iz-tolk-mcp": "dist/index.js"
},
```

To:
```json
"bin": {
  "iz-tolk-mcp": "dist/cli.js"
},
```

- [ ] **Step 4: Run build and tests**

```bash
npm run build && npm test
```

Expected: Build succeeds (cli.ts compiles to dist/cli.js), all 41 tests pass (tests import `createServer` from index.ts which is now side-effect-free).

- [ ] **Step 5: Run linter**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/index.ts package.json
git commit -m "refactor: extract CLI entrypoint into src/cli.ts"
```

---

### Task 3: Safe error handling — replace `err: any`

**Files:**
- Modify: `src/tools.ts`

- [ ] **Step 1: Add `getErrorMessage` utility at the top of `src/tools.ts`**

Add after the imports (after line 4):

```ts
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```

- [ ] **Step 2: Replace all `catch (err: any)` blocks**

There are 5 catch blocks in `tools.ts`. Replace each one:

**Block 1** (`get_compiler_version`, ~line 62):
```ts
// Before:
} catch (err: any) {
  return {
    content: [{ type: "text", text: `Failed to get compiler version: ${err.message}` }],
    isError: true,
  };
}
// After:
} catch (err) {
  return {
    content: [{ type: "text", text: `Failed to get compiler version: ${getErrorMessage(err)}` }],
    isError: true,
  };
}
```

**Block 2** (`compile_tolk` main catch, ~line 148):
```ts
// Before:
} catch (err: any) {
  return {
    content: [{ type: "text", text: `Unexpected compiler error: ${err.message}` }],
    isError: true,
  };
}
// After:
} catch (err) {
  return {
    content: [{ type: "text", text: `Unexpected compiler error: ${getErrorMessage(err)}` }],
    isError: true,
  };
}
```

**Block 3** (`check_tolk_syntax` catch, ~line 214):
```ts
// Before:
} catch (err: any) {
  return {
    content: [{ type: "text", text: `Unexpected compiler error: ${err.message}` }],
    isError: true,
  };
}
// After:
} catch (err) {
  return {
    content: [{ type: "text", text: `Unexpected compiler error: ${getErrorMessage(err)}` }],
    isError: true,
  };
}
```

**Block 4** (`generate_deploy_link` codeBoc64 parse, ~line 250):
```ts
// Before:
} catch (err: any) {
  return {
    content: [{ type: "text", text: `Error: invalid codeBoc64 — ${err.message}` }],
    isError: true,
  };
}
// After:
} catch (err) {
  return {
    content: [{ type: "text", text: `Error: invalid codeBoc64 — ${getErrorMessage(err)}` }],
    isError: true,
  };
}
```

**Block 5** (`generate_deploy_link` initialDataBoc64 parse, ~line 260):
```ts
// Before:
} catch (err: any) {
  return {
    content: [{ type: "text", text: `Error: invalid initialDataBoc64 — ${err.message}` }],
    isError: true,
  };
}
// After:
} catch (err) {
  return {
    content: [{ type: "text", text: `Error: invalid initialDataBoc64 — ${getErrorMessage(err)}` }],
    isError: true,
  };
}
```

- [ ] **Step 3: Run build and tests**

```bash
npm run build && npm test
```

Expected: Build succeeds, all 41 tests pass.

- [ ] **Step 4: Run linter**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/tools.ts
git commit -m "fix: use safe error extraction instead of err.message"
```

---

### Task 4: Try `strict: true` in tsconfig

**Files:**
- Modify: `tsconfig.json`
- Possibly modify: `src/index.ts`, `src/tools.ts`, `src/resources.ts`, `src/prompts.ts`, `src/content.ts`, `src/cli.ts` (only if strict mode reveals type errors)

- [ ] **Step 1: Set `strict: true`**

In `tsconfig.json`, change:
```json
"strict": false,
```
To:
```json
"strict": true,
```

- [ ] **Step 2: Run build and assess**

```bash
npm run build 2>&1
```

**If it compiles cleanly:** proceed to Step 3.

**If there are type errors:** Evaluate each error. Common fixes:
- `Parameter 'x' implicitly has an 'any' type` → add explicit type annotation
- `Object is possibly 'undefined'` → add nullish check or non-null assertion where safe
- MCP SDK type incompatibilities → if these are pervasive and unfixable, revert `strict: true` back to `strict: false`, skip to Step 5.

Fix only errors that are straightforward. If more than ~10 errors come from MCP SDK type incompatibilities, revert.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All 41 tests pass.

- [ ] **Step 4: Run linter**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

**If strict: true works:**
```bash
git add tsconfig.json src/
git commit -m "build: enable strict TypeScript mode"
```

**If strict: true reverted:**
No commit needed — nothing changed. Note the outcome for Task 5 (DECISIONS.md update).

---

### Task 5: Update DECISIONS.md — sync ADRs with reality

**Files:**
- Modify: `DECISIONS.md`

- [ ] **Step 1: Revise ADR-2**

Replace the current ADR-2 section (lines 23–38) with:

```markdown
## ADR-2: Resource content loaded from files with lazy cache

**Status:** Revised (was: embedded string constants)
**Context:** Two approaches for serving documentation content:
  1. Runtime file reading (readFileSync from content/)
  2. Embedded string constants (export const CONTENT = `...`)

**Original decision:** Embed content as string constants in `src/resources.ts`.
**Revised decision:** Load content from `src/content/` files via a shared `src/content.ts` module with a lazy `Map`-based cache. Content is read once on first access, then served from memory.
**Rationale:**
- Separates content from code — easier to edit documentation independently
- Shared module (`src/content.ts`) eliminates duplication between `resources.ts` and `prompts.ts`
- Lazy cache gives the same runtime performance as embedded constants
- Build step (`scripts/copy-content.js`) copies `src/content/` to `dist/content/` for distribution

**Trade-off:** Requires content files to exist at runtime (handled by build step). Acceptable for a server that bundles its content in the npm package.
```

- [ ] **Step 2: Revise ADR-4**

Replace the current ADR-4 section (lines 57–65) with:

```markdown
## ADR-4: z.record() for sources parameter

**Status:** Revised (was: z.any() workaround)
**Context:** The `compile_tolk` tool accepts a `sources` parameter of type `Record<string, string>`. In Zod v3, using `z.record(z.string(), z.string())` caused a type depth issue when combined with MCP SDK's internal type processing.
**Original decision:** Use `z.any()` with `.describe()` to document the expected shape.
**Revised decision:** Use `z.record(z.string(), z.string())` directly. The Zod v4 upgrade resolved the type depth incompatibility.
**Rationale:** Proper schema validation at the MCP SDK boundary — invalid inputs are rejected before reaching tool handlers.
```

- [ ] **Step 3: Revise ADR-5**

**If Task 4 enabled strict: true**, replace the current ADR-5 section (lines 67–79) with:

```markdown
## ADR-5: strict: true in tsconfig

**Status:** Revised (was: strict: false)
**Context:** TypeScript strict mode (`strict: true`) previously caused type errors when combining Zod v3 schemas with MCP SDK's type system.
**Original decision:** Set `strict: false` in tsconfig.json.
**Revised decision:** Set `strict: true`. The Zod v4 upgrade and MCP SDK updates resolved the incompatibilities.
**Rationale:** Strict mode enables `strictNullChecks`, `noImplicitAny`, and `strictFunctionTypes` — significantly improving type safety with no workarounds needed.
```

**If Task 4 kept strict: false**, replace with:

```markdown
## ADR-5: strict: false in tsconfig

**Status:** Reconfirmed (2026-04-13)
**Context:** TypeScript strict mode (`strict: true`) causes type errors when combining Zod schemas with MCP SDK's type system. Last verified with Zod v4.3.6 and @modelcontextprotocol/sdk v1.x.
**Decision:** Keep `strict: false` in tsconfig.json.
**Rationale:** MCP SDK's type system is still not compatible with strict TypeScript. We enable `skipLibCheck: true` and `esModuleInterop: true` for other safety. Mitigated by thorough test coverage (41 tests).
**Next review:** Check again when MCP SDK releases a major version update.
```

- [ ] **Step 4: Update ADR summary table**

Update the summary table at the bottom of DECISIONS.md to reflect the revised statuses:

```markdown
| # | Decision | Status |
|---|----------|--------|
| 1 | Modular file structure | Approved |
| 2 | Content loaded from files with lazy cache | Revised |
| 3 | MCP SDK v1 server.tool() API | Approved |
| 4 | z.record() for sources parameter | Revised |
| 5 | strict: true in tsconfig | Revised |
| 6 | generate_deploy_link differentiator | Approved |
| 7 | convert_func_to_tolk excluded | Approved (exclusion) |
| 8 | 6 resources without NFT | Approved |
| 9 | vitest + InMemoryTransport tests | Approved |
| 10 | No console.log, only console.error | Approved |
```

(Adjust row 5 to `Reconfirmed` if strict: false was kept.)

- [ ] **Step 5: Run build and tests (sanity check)**

```bash
npm run build && npm test
```

Expected: Build succeeds, all 41 tests pass. (Docs-only change, but verify nothing broke.)

- [ ] **Step 6: Commit**

```bash
git add DECISIONS.md
git commit -m "docs: update ADR-2, ADR-4, ADR-5 to match current architecture"
```
