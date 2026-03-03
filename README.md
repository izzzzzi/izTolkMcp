<div align="center">

# iz-tolk-mcp

**MCP server for the Tolk smart contract compiler — compile, check, and deploy TON blockchain smart contracts from any AI assistant**

[![CI](https://github.com/izzzzzi/izTolkMcp/actions/workflows/ci.yml/badge.svg)](https://github.com/izzzzzi/izTolkMcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/iz-tolk-mcp.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/iz-tolk-mcp)
[![npm downloads](https://img.shields.io/npm/dm/iz-tolk-mcp.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/iz-tolk-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat&colorA=18181B&colorB=28CF8D)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&colorA=18181B&colorB=3178C6)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-ESM-green?style=flat&colorA=18181B&colorB=339933)](https://nodejs.org/)

[🇷🇺 Русский](README.ru.md) | **🇬🇧 English**

<br />

*MCP server that brings the [Tolk](https://docs.ton.org/v3/documentation/smart-contracts/tolk/overview) smart contract compiler directly into AI assistants like Claude — write, compile, check, and deploy TON contracts without leaving the conversation.*

</div>

---

## 📖 Overview

**iz-tolk-mcp** is a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that integrates the Tolk smart contract compiler into AI assistants, enabling a seamless write-compile-deploy workflow for TON blockchain development.

- **Tolk** is the next-generation smart contract language for the TON blockchain, designed as a modern successor to FunC with familiar syntax (C/TypeScript-like), type safety, and cleaner semantics.
- **MCP** (Model Context Protocol) is an open standard that lets AI assistants use external tools, access data sources, and follow guided workflows — turning them into capable development environments.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔨 **4 MCP Tools** | `compile_tolk`, `check_tolk_syntax`, `get_compiler_version`, `generate_deploy_link` |
| 📄 **6 MCP Resources** | Language guide, stdlib reference, changelog, FunC migration guide, example contracts |
| 💬 **3 MCP Prompts** | Guided workflows for writing, reviewing, and debugging smart contracts |
| ⚙️ **Full Compiler Options** | Optimization levels (0-2), stack comments, multi-file compilation |
| 📦 **Multi-file Support** | Compile projects with multiple `.tolk` source files and `@stdlib/*` imports |
| 🔗 **Deployment Links** | Generate `ton://` deeplinks and Tonkeeper URLs for wallet deployment |
| 🚀 **Zero Configuration** | Runs via `npx` with no external dependencies beyond Node.js |

---

## 🚀 Quick Start

```bash
npx iz-tolk-mcp
```

The server communicates over stdio and is designed to be launched by an MCP client.

---

## 📦 Installation

### Using npx (no install needed)

MCP clients launch the server automatically — just add it to your configuration (see below).

### Global install

```bash
npm install -g iz-tolk-mcp
```

### From source

```bash
git clone https://github.com/izzzzzi/izTolkMcp.git
cd izTolkMcp
npm install
npm run build
```

> **Requirement:** Node.js >= 18

---

## 🔧 MCP Client Configuration

<details>
<summary><b>Claude Desktop</b></summary>

Add to `claude_desktop_config.json`:

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

</details>

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add tolk -- npx -y iz-tolk-mcp
```

</details>

<details>
<summary><b>Cursor</b></summary>

Add to `.cursor/mcp.json`:

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

</details>

<details>
<summary><b>Windsurf</b></summary>

Add to `~/.windsurf/mcp.json`:

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

</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "tolk": {
      "command": "npx",
      "args": ["-y", "iz-tolk-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Local build (any client)</b></summary>

```json
{
  "mcpServers": {
    "tolk": {
      "command": "node",
      "args": ["/absolute/path/to/izTolkMcp/dist/index.js"]
    }
  }
}
```

</details>

---

## 🛠️ MCP Tools

### 🔍 `get_compiler_version`

Returns the version of the Tolk compiler bundled in `@ton/tolk-js` (WASM).

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| *(none)* | — | — | No parameters |

### 🔨 `compile_tolk`

Compiles Tolk smart contract source code. Returns Fift output, BoC (Bag of Cells) in base64, and the code hash.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `entrypointFileName` | `string` | ✅ | The main `.tolk` file to compile (e.g., `"main.tolk"`) |
| `sources` | `object` | ✅ | Map of `filename -> source code`. Must include the entrypoint file. |
| `optimizationLevel` | `number` | — | Optimization level 0-2 (default: 2) |
| `withStackComments` | `boolean` | — | Include stack layout comments in Fift output |

### ✅ `check_tolk_syntax`

Checks Tolk source code for syntax and type errors without returning full compilation output. Faster feedback loop for iterative development.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `entrypointFileName` | `string` | ✅ | The main `.tolk` file to check |
| `sources` | `object` | ✅ | Map of `filename -> source code` |

### 🔗 `generate_deploy_link`

Generates TON deployment deeplinks for a compiled contract. Computes the deterministic contract address and returns `ton://` and Tonkeeper links ready for wallet deployment.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `codeBoc64` | `string` | ✅ | Base64-encoded BoC of compiled contract code (from `compile_tolk`) |
| `initialDataBoc64` | `string` | — | Base64-encoded BoC for initial data cell (default: empty cell) |
| `workchain` | `number` | — | Target workchain ID (default: 0) |
| `amount` | `string` | — | Deploy amount in nanoTON (default: `"50000000"` = 0.05 TON) |

---

## 📄 MCP Resources

| Resource | URI | Description |
|----------|-----|-------------|
| 📘 `language-guide` | `tolk://docs/language-guide` | Complete Tolk language syntax reference |
| 📗 `stdlib-reference` | `tolk://docs/stdlib-reference` | Standard library modules and functions reference |
| 📋 `changelog` | `tolk://docs/changelog` | Tolk compiler version history from v0.6 to latest |
| 🔄 `tolk-vs-func` | `tolk://docs/tolk-vs-func` | FunC to Tolk migration guide — key differences and comparison |
| 📝 `example-counter` | `tolk://examples/counter` | Simple counter smart contract example in Tolk |
| 💎 `example-jetton` | `tolk://examples/jetton` | Jetton (fungible token) minter contract example in Tolk |

---

## 💬 MCP Prompts

### `write_smart_contract`

Guided workflow for writing a new Tolk smart contract on TON. Injects the language reference and a relevant example contract into the conversation context.

| Argument | Type | Required | Description |
|----------|------|:--------:|-------------|
| `description` | `string` | ✅ | Description of what the smart contract should do |
| `contractType` | `string` | — | `"counter"` \| `"jetton"` \| `"nft"` \| `"wallet"` \| `"custom"` (default: `"custom"`) |

### `review_smart_contract`

Security-focused review of a Tolk smart contract. Checks for access control, message handling, integer overflow, gas management, storage integrity, and TON-specific vulnerabilities.

| Argument | Type | Required | Description |
|----------|------|:--------:|-------------|
| `code` | `string` | ✅ | The Tolk smart contract source code to review |

### `debug_compilation_error`

Diagnose and fix a Tolk compilation error. Analyzes the error against the language reference and provides corrected code.

| Argument | Type | Required | Description |
|----------|------|:--------:|-------------|
| `errorMessage` | `string` | ✅ | The compilation error message from the Tolk compiler |
| `code` | `string` | ✅ | The Tolk source code that failed to compile |

---

## 💡 Usage Examples

Once configured, interact with the Tolk MCP server through natural language in your AI assistant:

**Compile a contract:**

> "Compile this Tolk smart contract:"
> ```tolk
> import "@stdlib/tvm-dicts";
>
> fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
>     // handle messages
> }
> ```

**Write a new contract from scratch:**

> "Write a simple counter contract for TON that stores a number and lets anyone increment it. Include a getter to read the current value."

**Review an existing contract:**

> "Review this contract for security issues" *(paste code)*

**Debug a compilation error:**

> "I'm getting this error when compiling: `unexpected token 'fun'` — here's my code:" *(paste code)*

**Generate a deploy link:**

> "Generate a deployment link for the contract we just compiled."

---

## 📁 Project Structure

```
src/
├── index.ts        — Server initialization and stdio transport
├── tools.ts        — 4 MCP tools (compile, check, version, deploy)
├── resources.ts    — 6 MCP resources (docs, examples)
├── prompts.ts      — 3 MCP prompts (write, review, debug)
└── content/        — Bundled documentation and example contracts
    ├── language-guide.md
    ├── stdlib-reference.md
    ├── changelog.md
    ├── tolk-vs-func.md
    ├── example-counter.tolk
    └── example-jetton.tolk
```

Key dependencies:

- `@modelcontextprotocol/sdk` — MCP server framework
- `@ton/tolk-js` — Tolk compiler (WASM, runs locally)
- `@ton/core` — TON primitives for address computation and cell serialization
- `zod` — Schema validation for tool parameters

---

## 🧑‍💻 Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript + copy content files
npm run dev          # Run with tsx (hot reload for development)
npm test             # Run test suite (vitest)
npm run lint         # Check for lint errors
npm run lint:fix     # Fix lint errors automatically
npm run format       # Format code with Biome
```

Pre-commit hooks enforce code quality automatically:

- **Biome** — fast linter and formatter for TypeScript
- **Husky** — Git hooks manager
- **lint-staged** — runs checks only on staged files

