# Codebase Audit — iz-tolk-mcp

> Date: 2026-04-13
> Approach: Layered audit (categorized findings, then batch fixes by priority)

---

## Context

iz-tolk-mcp is an MCP server for the Tolk smart contract compiler (TON blockchain). ~500 lines of core TypeScript across 4 modules (`index.ts`, `tools.ts`, `resources.ts`, `prompts.ts`), 41 passing tests, CI/CD with semantic-release.

The codebase is healthy — lint, build, and tests all pass cleanly. This audit identifies targeted improvements across bugs, security, code quality, and documentation.

---

## Findings and Fixes

### Fix 1: Extract shared `loadContent` into `src/content.ts` (Medium)

**Problem:** `resources.ts` and `prompts.ts` both define identical `loadContent` functions with independent `contentDir` computation. `resources.ts` adds a lazy cache; `prompts.ts` reads from disk on every prompt call.

**Fix:**
- Create `src/content.ts` exporting `loadContent(filename)` with a single lazy cache
- Update `resources.ts` and `prompts.ts` to import from `src/content.ts`
- Remove duplicated `currentDir`, `contentDir`, and `loadContent` from both files

**Result:** Single source of truth for content loading, consistent caching, ~20 lines removed.

### Fix 2: Extract `src/cli.ts` — clean library/CLI separation (Medium)

**Problem:** `src/index.ts:38` uses a brittle `isDirectRun` check (`process.argv[1].endsWith("/index.js")`) to conditionally start the stdio transport. This breaks on Windows paths, renamed files, or symlinks. It also means importing `index.ts` as a library executes side-effect code (the `if` block runs at import time).

**Fix:**
- Create `src/cli.ts` with the shebang, stdio transport setup, and server start
- Update `package.json` `bin` to point to `dist/cli.js`
- Remove `isDirectRun` logic and stdio transport from `index.ts`
- `index.ts` becomes a pure library export (`createServer`, `createSandboxServer`)

**Result:** Clean separation — `index.ts` is importable without side effects, `cli.ts` is the entrypoint.

### Fix 3: Safe error handling — replace `err: any` (Low)

**Problem:** All catch blocks in `tools.ts` use `err: any` and access `err.message` directly. If a non-Error value is thrown, `.message` is `undefined`, producing messages like `"Failed to get compiler version: undefined"`.

**Fix:**
- Add a utility function `getErrorMessage(err: unknown): string` in `src/tools.ts` (private, not exported — used only in this file)
- Replace all `catch (err: any) { ... err.message }` with `catch (err) { ... getErrorMessage(err) }`

**Result:** Robust error messages regardless of what's thrown.

### Fix 4: Try `strict: true` in tsconfig (Medium)

**Problem:** ADR-5 justified `strict: false` due to Zod v3 + MCP SDK type incompatibilities. The project has since moved to Zod v4 (`^4.3.6`). The restriction may no longer apply.

**Fix:**
- Set `strict: true` in `tsconfig.json`
- Run `npm run build` and see what breaks
- If it compiles — keep it and update ADR-5
- If it doesn't — revert and update ADR-5 with the date of last check

**Result:** Either better type safety, or documented confirmation that the workaround is still needed.

### Fix 5: Update DECISIONS.md — sync ADRs with reality (Medium)

**Problem:** Three ADRs describe decisions that no longer match the code:
- **ADR-2**: Says content is "embedded as string constants" — actually loaded from files via `readFileSync` with lazy cache
- **ADR-4**: Says `z.any()` for sources — code uses `z.record(z.string(), z.string())`
- **ADR-5**: May be outdated if Fix 4 succeeds

**Fix:**
- Revise ADR-2: document the shift to file-based content with lazy caching, and the shared `src/content.ts` module
- Revise ADR-4: document that Zod v4 resolved the type depth issue, `z.record()` now works
- Revise ADR-5: update based on Fix 4 outcome

**Result:** DECISIONS.md accurately describes the current architecture.

---

## Out of Scope (Acknowledged, Not Fixed)

| Finding | Severity | Reason |
|---------|----------|--------|
| Duplicated compile logic in `compile_tolk` / `check_tolk_syntax` | Low | Two instances is readable, extraction adds indirection without clear benefit |
| `scripts/*.js` ESM format | Low | Works correctly with `"type": "module"` in package.json |
| `server.json` hardcoded version | Info | Correctly managed by semantic-release CI pipeline |
| `setMaxListeners(20)` in test setup | Info | Documented workaround for MCP SDK behavior |
| No runtime validation of sources values | Low | Covered by Zod schema at MCP SDK boundary |

---

## Implementation Order

1. **Fix 1** — Extract `src/content.ts` (foundational, other fixes may touch same files)
2. **Fix 2** — Extract `src/cli.ts` (independent, clean separation)
3. **Fix 3** — Safe error handling (small, isolated change)
4. **Fix 4** — Try `strict: true` (may cause cascading type fixes)
5. **Fix 5** — Update DECISIONS.md (last — captures final state of all changes)

Each fix gets its own commit. All tests must pass after each fix.

---

## Success Criteria

- `npm run build` passes
- `npm run lint` passes
- `npm test` — all 41 tests pass
- No new files beyond `src/content.ts` and `src/cli.ts`
- DECISIONS.md accurately reflects the codebase
