# Architecture Decisions — iz-tolk-mcp

> MCP Server for Tolk smart contract compiler (TON blockchain)
> Created: 2026-02-27

---

## ADR-1: Modular file structure

**Status:** Approved
**Context:** All 3 competitor submissions use a single-file architecture (everything in one index.ts). This makes the codebase hard to navigate and review.
**Decision:** Split into focused modules:
- `src/index.ts` — server factory, registration orchestration, library exports
- `src/cli.ts` — CLI entrypoint, stdio transport setup
- `src/content.ts` — shared content loader with lazy file cache
- `src/tools.ts` — all 4 MCP tools (get_compiler_version, compile_tolk, check_tolk_syntax, generate_deploy_link)
- `src/resources.ts` — all 6 MCP resources with embedded content
- `src/prompts.ts` — all 3 MCP prompts

**Rationale:** Clearer code review, easier testing, demonstrates professional structure to bounty reviewers. Each module exports a single `registerX(server)` function.
**Trade-off:** Slightly more boilerplate vs one-file simplicity, but pays off in maintainability and review clarity.

---

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

---

## ADR-3: MCP SDK v1 server.tool() API

**Status:** Approved
**Context:** MCP TypeScript SDK offers two registration styles:
  1. `server.tool(name, schema, handler)` — v1 style, simpler
  2. `server.registerTool({ name, inputSchema, handler })` — newer, more verbose

**Decision:** Use `server.tool()` API consistently.
**Rationale:**
- Simpler, less boilerplate
- All 3 competitors use this pattern — proven to work
- Fewer type issues with Zod schema integration
- Still fully supported in current SDK version

---

## ADR-4: z.record() for sources parameter

**Status:** Revised (was: z.any() workaround)
**Context:** The `compile_tolk` tool accepts a `sources` parameter of type `Record<string, string>`. In Zod v3, using `z.record(z.string(), z.string())` caused a type depth issue when combined with MCP SDK's internal type processing.
**Original decision:** Use `z.any()` with `.describe()` to document the expected shape.
**Revised decision:** Use `z.record(z.string(), z.string())` directly. The Zod v4 upgrade resolved the type depth incompatibility.
**Rationale:** Proper schema validation at the MCP SDK boundary — invalid inputs are rejected before reaching tool handlers.

---

## ADR-5: strict: true in tsconfig

**Status:** Revised (was: strict: false)
**Context:** TypeScript strict mode (`strict: true`) previously caused type errors when combining Zod v3 schemas with MCP SDK's type system.
**Original decision:** Set `strict: false` in tsconfig.json.
**Revised decision:** Set `strict: true`. The Zod v4 upgrade and MCP SDK updates resolved the incompatibilities.
**Rationale:** Strict mode enables `strictNullChecks`, `noImplicitAny`, and `strictFunctionTypes` — significantly improving type safety with no workarounds needed.

---

## ADR-6: generate_deploy_link as unique differentiator

**Status:** Approved
**Context:** No competitor implements deployment link generation. After successful compilation, users receive codeBoc64 but have no guidance on how to deploy.
**Decision:** Add `generate_deploy_link` tool that takes codeBoc64 and returns:
- TON deployment deeplink (`ton://transfer/...`)
- Contract address computation (if feasible)
- Step-by-step deployment instructions

**Rationale:** Strong differentiator — transforms the server from "compile only" to "compile and deploy". Directly useful for LLM-assisted contract development workflows.
**Implementation:** Risk tester confirmed @ton/core is lightweight (+3MB, 4 transitive deps, zero native deps). Full implementation uses `Cell.fromBase64()`, `contractAddress()`, and `storeStateInit()` — ~15 lines of code. Returns deterministic contract address, ton:// deeplink, and Tonkeeper link.

---

## ADR-7: convert_func_to_tolk excluded from scope

**Status:** Approved (exclusion)
**Context:** The research plan identified `convert_func_to_tolk` as a potential killer feature. However, FunC-to-Tolk conversion is an AST-level transformation that requires deep compiler knowledge.
**Decision:** Do NOT implement convert_func_to_tolk tool.
**Rationale:**
- Real AST transformation is too complex and error-prone
- A naive regex/string-based converter would produce incorrect results
- Bad conversion output is worse than no conversion at all
- The `tolk://docs/tolk-vs-func` resource already provides migration guidance
- `generate_deploy_link` + changelog + tolk-vs-func guide provide sufficient differentiation

---

## ADR-8: 6 resources (without NFT example)

**Status:** Approved
**Context:** Research plan listed 7 potential resources including an NFT example. The current scope defines 6 resources.
**Decision:** Ship 6 resources: language-guide, stdlib-reference, changelog, tolk-vs-func, example-counter, example-jetton. No NFT example.
**Rationale:**
- 6 resources already exceeds all competitors (oxgeneral has 4)
- Counter + Jetton cover the key patterns (simple storage + token standard)
- NFT adds marginal value over Jetton for demonstrating Tolk patterns
- Keeps content curation effort manageable

---

## ADR-9: Test strategy — vitest + InMemoryTransport

**Status:** Approved
**Context:** Need integration tests that verify tools/resources/prompts work through the MCP protocol, not just unit tests of the compiler wrapper.
**Decision:** Use vitest with MCP SDK's InMemoryTransport for protocol-level integration tests.
**Rationale:**
- InMemoryTransport creates a linked client-server pair in-memory
- Tests exercise the full MCP protocol path (serialization, dispatch, response)
- Same pattern used by oxgeneral (14 tests) — proven approach
- vitest is faster than jest for ESM TypeScript projects

**Structure:** Single test file `test/server.test.ts` with 3 groups:
1. Direct tolk-js tests (compiler works)
2. MCP integration tests (tools/resources/prompts via protocol)
3. Edge case tests (validation, error handling)

---

## ADR-10: Console output discipline

**Status:** Approved
**Context:** MCP servers communicate over stdio. stdout is the JSON-RPC channel. Any console.log() call corrupts the protocol stream.
**Decision:** NEVER use console.log in production code. Use console.error for all diagnostic logging.
**Rationale:** This is a hard requirement for stdio-based MCP servers. Violation causes immediate protocol failure.

---

## Summary

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
