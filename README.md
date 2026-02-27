[English](README.md) | [Русский](README.ru.md)

# iz-tolk-mcp

MCP server for the Tolk smart contract compiler — compile, check, and deploy TON blockchain smart contracts from any MCP-compatible AI assistant.

## Overview

**iz-tolk-mcp** is a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that brings the [Tolk](https://docs.ton.org/v3/documentation/smart-contracts/tolk/overview) smart contract compiler directly into AI assistants like Claude, enabling a seamless write-compile-deploy workflow for TON blockchain development.

- **Tolk** is the next-generation smart contract language for the TON blockchain, designed as a modern successor to FunC with familiar syntax (C/TypeScript-like), type safety, and cleaner semantics.
- **MCP** (Model Context Protocol) is an open standard that lets AI assistants use external tools, access data sources, and follow guided workflows — turning them into capable development environments.

With this server, an AI assistant can write Tolk code, compile it, check for errors, read language documentation, and generate wallet-ready deployment links — all without leaving the conversation.

## Features

- **4 MCP Tools** — `compile_tolk`, `check_tolk_syntax`, `get_compiler_version`, `generate_deploy_link`
- **6 MCP Resources** — language guide, stdlib reference, changelog, FunC migration guide, example contracts
- **3 MCP Prompts** — guided workflows for writing, reviewing, and debugging smart contracts
- **Full compiler options** — optimization levels (0-2), stack comments, multi-file compilation
- **Multi-file support** — compile projects with multiple `.tolk` source files and `@stdlib/*` imports
- **Compiler changelog** — built-in version history from v0.6 to latest
- **Deployment links** — generate `ton://` deeplinks and Tonkeeper URLs for wallet deployment
- **Zero configuration** — runs via `npx` with no external dependencies beyond Node.js

## Quick Start

```bash
npx iz-tolk-mcp
```

The server communicates over stdio and is designed to be launched by an MCP client.

## Installation

### Option A: npx (no install needed)

MCP clients launch the server automatically — just add it to your configuration (see below).

### Option B: Global install

```bash
npm install -g iz-tolk-mcp
```

### Option C: Clone and build

```bash
git clone https://github.com/izzzzzi/izTolkMcp.git
cd iz-tolk-mcp
npm install
npm run build
```

> **Requirement:** Node.js >= 18

## Configuration for MCP Clients

### Claude Desktop

File: `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tolk": {
      "command": "npx",
      "args": ["-y", "iz-tolk-mcp"]
    }
  }
}
```

### Cursor

File: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "tolk": {
      "command": "npx",
      "args": ["-y", "iz-tolk-mcp"]
    }
  }
}
```

### Windsurf

File: `~/.windsurf/mcp.json`

```json
{
  "mcpServers": {
    "tolk": {
      "command": "npx",
      "args": ["-y", "iz-tolk-mcp"]
    }
  }
}
```

### Local build (any client)

If you cloned and built the project locally:

```json
{
  "mcpServers": {
    "tolk": {
      "command": "node",
      "args": ["/absolute/path/to/iz-tolk-mcp/dist/index.js"]
    }
  }
}
```

## Tools Reference

### `get_compiler_version`

Returns the version of the Tolk compiler bundled in `@ton/tolk-js` (WASM).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | No parameters |

---

### `compile_tolk`

Compiles Tolk smart contract source code. Returns Fift output, BoC (Bag of Cells) in base64, and the code hash.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entrypointFileName` | `string` | Yes | The main `.tolk` file to compile (e.g., `"main.tolk"`) |
| `sources` | `object` | Yes | Map of `filename -> source code`. Must include the entrypoint file. |
| `optimizationLevel` | `number` | No | Optimization level 0-2 (default: 2) |
| `withStackComments` | `boolean` | No | Include stack layout comments in Fift output |

---

### `check_tolk_syntax`

Checks Tolk source code for syntax and type errors without returning full compilation output. Faster feedback loop for iterative development.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entrypointFileName` | `string` | Yes | The main `.tolk` file to check |
| `sources` | `object` | Yes | Map of `filename -> source code` |

---

### `generate_deploy_link`

Generates TON deployment deeplinks for a compiled contract. Computes the deterministic contract address and returns `ton://` and Tonkeeper links ready for wallet deployment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `codeBoc64` | `string` | Yes | Base64-encoded BoC of compiled contract code (from `compile_tolk`) |
| `initialDataBoc64` | `string` | No | Base64-encoded BoC for initial data cell (default: empty cell) |
| `workchain` | `number` | No | Target workchain ID (default: 0) |
| `amount` | `string` | No | Deploy amount in nanoTON (default: `"50000000"` = 0.05 TON) |

## Resources Reference

| Resource | URI | Description |
|----------|-----|-------------|
| `language-guide` | `tolk://docs/language-guide` | Complete Tolk language syntax reference |
| `stdlib-reference` | `tolk://docs/stdlib-reference` | Standard library modules and functions reference |
| `changelog` | `tolk://docs/changelog` | Tolk compiler version history from v0.6 to latest |
| `tolk-vs-func` | `tolk://docs/tolk-vs-func` | FunC to Tolk migration guide — key differences and comparison |
| `example-counter` | `tolk://examples/counter` | Simple counter smart contract example in Tolk |
| `example-jetton` | `tolk://examples/jetton` | Jetton (fungible token) minter contract example in Tolk |

## Prompts Reference

### `write_smart_contract`

Guided workflow for writing a new Tolk smart contract on TON. Injects the language reference and a relevant example contract into the conversation context.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | `string` | Yes | Description of what the smart contract should do |
| `contractType` | `"counter" \| "jetton" \| "nft" \| "wallet" \| "custom"` | No | Type of contract to create (default: `"custom"`) |

### `review_smart_contract`

Security-focused review of a Tolk smart contract. Checks for access control, message handling, integer overflow, gas management, storage integrity, and TON-specific vulnerabilities.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | The Tolk smart contract source code to review |

### `debug_compilation_error`

Diagnose and fix a Tolk compilation error. Analyzes the error against the language reference and provides corrected code.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `errorMessage` | `string` | Yes | The compilation error message from the Tolk compiler |
| `code` | `string` | Yes | The Tolk source code that failed to compile |

## Usage Examples

Once configured, you can interact with the Tolk MCP server through natural language in your AI assistant:

**Compile a contract:**

> "Compile this Tolk smart contract:"
> ```tolk
> import "@stdlib/tvm-dicts";
>
> fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
>     // handle messages
> }
> ```

The assistant will call `compile_tolk` and return the compiled BoC, code hash, and Fift output.

**Check syntax during development:**

> "Check if this Tolk code has any errors — I just want a quick syntax check, not the full compilation output."

The assistant will use `check_tolk_syntax` for faster feedback without returning Fift/BoC.

**Write a new contract from scratch:**

> "Write a simple counter contract for TON that stores a number and lets anyone increment it. Include a getter to read the current value."

The assistant will use the `write_smart_contract` prompt, which injects the Tolk language guide and a relevant example, then iteratively compiles until the contract is error-free.

**Review an existing contract:**

> "Review this contract for security issues" *(paste code)*

The assistant will use `review_smart_contract` to perform a structured security audit covering access control, gas management, and TON-specific attack vectors.

**Debug a compilation error:**

> "I'm getting this error when compiling: `unexpected token 'fun'` — here's my code:" *(paste code)*

The assistant will use `debug_compilation_error` to diagnose the issue against the language reference and provide a fix.

**Generate a deploy link:**

> "Generate a deployment link for the contract we just compiled."

The assistant will take the BoC from the previous compilation and call `generate_deploy_link` to produce a `ton://` deeplink you can open in Tonkeeper or any TON wallet.

## Development

```bash
git clone https://github.com/izzzzzi/izTolkMcp.git
cd iz-tolk-mcp
npm install          # Install dependencies
npm run build        # Compile TypeScript + copy content files
npm run dev          # Run with tsx (hot reload for development)
npm test             # Run test suite (vitest)
```

## Code Quality

Pre-commit hooks enforce code quality automatically:

- **Biome** — fast linter and formatter for TypeScript
- **Husky** — Git hooks manager
- **lint-staged** — runs checks only on staged files

```bash
npm run lint          # Check for lint errors
npm run lint:fix      # Fix lint errors automatically
npm run format        # Format code with Biome
```

Pre-commit hook runs `biome check --write` and `biome format --write` on all staged `.ts` files.

## CI/CD

This project uses automated CI/CD:

- **GitHub Actions** — build, test, and lint on every push and PR
- **Semantic Release** — automated versioning based on [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` — minor version bump (1.x.0)
  - `fix:` — patch version bump (1.0.x)
  - `feat!:` or `BREAKING CHANGE:` — major version bump (x.0.0)
  - `chore:`, `docs:`, `refactor:` — no release
- **Dependabot** — automated weekly dependency updates

Releases are published to npm automatically when changes are pushed to `main`.

## Architecture

The server is organized into focused modules:

```
src/
  index.ts        — Server initialization and stdio transport
  tools.ts        — 4 MCP tools (compile, check, version, deploy)
  resources.ts    — 6 MCP resources (docs, examples)
  prompts.ts      — 3 MCP prompts (write, review, debug)
  content/        — Bundled documentation and example contracts
    language-guide.md
    stdlib-reference.md
    changelog.md
    tolk-vs-func.md
    example-counter.tolk
    example-jetton.tolk
```

Key dependencies:

- `@modelcontextprotocol/sdk` — MCP server framework
- `@ton/tolk-js` — Tolk compiler (WASM, runs locally)
- `@ton/core` — TON primitives for address computation and cell serialization
- `zod` — Schema validation for tool parameters

## License

MIT
