# Architecture Decisions — iz-tolk-mcp

> MCP Server for Tolk smart contract compiler (TON blockchain)
> Created: 2026-02-27

---

## ADR-1: Modular file structure

**Status:** Approved
**Context:** All 3 competitor submissions use a single-file architecture (everything in one index.ts). This makes the codebase hard to navigate and review.
**Decision:** Split into focused modules:
- `src/index.ts` — server entry point, transport setup, registration orchestration
- `src/tools.ts` — all 4 MCP tools (get_compiler_version, compile_tolk, check_tolk_syntax, generate_deploy_link)
- `src/resources.ts` — all 6 MCP resources with embedded content
- `src/prompts.ts` — all 3 MCP prompts

**Rationale:** Clearer code review, easier testing, demonstrates professional structure to bounty reviewers. Each module exports a single `registerX(server)` function.
**Trade-off:** Slightly more boilerplate vs one-file simplicity, but pays off in maintainability and review clarity.

---

## ADR-2: Resource content embedded as string constants

**Status:** Approved
**Context:** Two approaches for serving documentation content:
  1. Runtime file reading (readFileSync from dist/content/)
  2. Embedded string constants (export const CONTENT = `...`)

**Decision:** Embed content as string constants in `src/resources.ts`.
**Rationale:**
- No file-copying build step needed (avoids dist/content/ synchronization)
- Guaranteed to work after `npm install` — no missing file issues
- Simpler deployment — single JS bundle, no runtime fs dependency
- Matches oxgeneral's pattern (proven to work)

**Trade-off:** Larger source file, harder to edit content in isolation. Acceptable for static documentation that changes infrequently.

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

## ADR-4: z.any() for sources parameter

**Status:** Approved (workaround)
**Context:** The `compile_tolk` tool accepts a `sources` parameter of type `Record<string, string>`. Using `z.record(z.string(), z.string())` causes a Zod type depth issue when combined with MCP SDK's internal type processing, resulting in TypeScript compilation errors.
**Decision:** Use `z.any()` with `.describe()` that documents the expected shape and provides an example.
**Rationale:** Pragmatic workaround. The runtime validation is handled manually (checking that sources is an object with string values). The `.describe()` metadata ensures LLMs understand the expected format.
**Action:** Add a `// TODO: Replace with z.record() when MCP SDK fixes Zod type depth issue` comment in code.

---

## ADR-5: strict: false in tsconfig

**Status:** Approved
**Context:** TypeScript strict mode (`strict: true`) causes type errors when combining Zod schemas with MCP SDK's type system. Specifically, `strictNullChecks` and `strictFunctionTypes` create incompatibilities in tool handler signatures.
**Decision:** Set `strict: false` in tsconfig.json.
**Rationale:**
- Required for Zod/MCP SDK type compatibility
- oxgeneral uses the same approach (validated in production)
- The MCP SDK's type system is not designed for strict TypeScript
- We still enable `skipLibCheck: true` and `esModuleInterop: true` for other safety

**Trade-off:** Loses some type safety guarantees. Mitigated by thorough test coverage (20+ tests).

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
| 2 | Content embedded as string constants | Approved |
| 3 | MCP SDK v1 server.tool() API | Approved |
| 4 | z.any() for sources parameter | Approved (workaround) |
| 5 | strict: false in tsconfig | Approved |
| 6 | generate_deploy_link differentiator | Approved |
| 7 | convert_func_to_tolk excluded | Approved (exclusion) |
| 8 | 6 resources without NFT | Approved |
| 9 | vitest + InMemoryTransport tests | Approved |
| 10 | No console.log, only console.error | Approved |
