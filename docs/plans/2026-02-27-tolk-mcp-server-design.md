# MCP Server for Tolk Compiler — Deep Analysis

> **Status:** Research complete
> **Date:** 2026-02-27
> **Goal:** Проанализировать bounty #1200 (MCP-сервер для компилятора Tolk), оценить конкурентов, аналоги, сложность и стратегию

---

## Table of Contents

1. [Overview](#overview)
2. [Scope и требования](#1-scope-и-требования)
3. [API tolk-js и обёртка](#2-api-tolk-js-и-обёртка)
4. [MCP архитектура](#3-mcp-архитектура-toolsresourcesprompts)
5. [Анализ 3 конкурентов](#4-анализ-3-конкурентов)
6. [Аналоги в индустрии](#5-аналоги-в-индустрии)
7. [Стратегия дифференциации](#6-стратегия-дифференциации)
8. [Оценка сложности](#7-оценка-сложности-и-трудозатрат)
9. [Implementation Plan](#implementation-plan)
10. [Success Metrics](#success-metrics)

---

## Overview

### Суть задачи

[Issue #1200](https://github.com/ton-society/grants-and-bounties/issues/1200) просит создать MCP-сервер для компилятора **Tolk** — нового языка смарт-контрактов TON (замена FunC). Сервер должен обернуть WASM-библиотеку [`@ton/tolk-js`](https://github.com/ton-blockchain/tolk-js) и предоставить LLM возможность компилировать код и работать с результатом.

### Goals

1. **Компиляция Tolk-кода через LLM** — LLM может проверить, компилируется ли написанный код
2. **Работа с байткодом** — LLM может предоставить пользователю ссылку для деплоя
3. **Дополнительная ценность** — changelog, документация, миграция с FunC (на усмотрение)

### Key Decisions

| Аспект | Решение |
|--------|---------|
| Сложность | **EASY** — ~24 часа для опытного разработчика |
| Конкуренция | 3 submission, oxgeneral — сильнейший (3 tools, 4 resources, 2 prompts, 14 tests) |
| Стратегия | **Targeted Sniper** — всё что у oxgeneral + changelog + convert FunC + deploy deeplink |
| Архитектура | 2-3 core tools, stateless, in-memory sources, stdio transport |
| Рекомендация | **GO** — при знании TypeScript и базовом понимании TON |

---

## 1. Scope и требования

### Обязательные требования (MVP)

| # | Требование | Источник |
|---|-----------|----------|
| 1 | MCP-сервер, реализующий Model Context Protocol | Текст issue |
| 2 | `get_compiler_version` — строка версии Tolk | "mirror API from tolk-js" |
| 3 | `compile_tolk` — компиляция с полным `TolkCompilerConfig` | "mirror API from tolk-js" |
| 4 | Возврат `fiftCode`, `codeBoc64`, `codeHashHex` или ошибки | Из tolk-js API |
| 5 | LLM может проверять, компилируется ли код | Цель issue |

### Опциональные требования (nice-to-have)

| # | Требование | Источник |
|---|-----------|----------|
| 6 | Compiler changelog | Прямо упомянут в issue |
| 7 | Дополнительные фичи | "left to implementor's discretion" |

### Неявные требования

- Multi-file поддержка (контракты состоят из нескольких файлов)
- stdio transport (стандарт для Claude Desktop / Cursor)
- npm-пакет на TypeScript
- Тесты и документация (задаёт планку oxgeneral с 14 тестами)

### Процесс ревью

- Bounty hunter создает реализацию → открывает PR → мейнтейнеры ревьюят → при одобрении $500
- **Ни один из 3 PR не замержен** — окно возможностей ещё открыто

---

## 2. API tolk-js и обёртка

### API tolk-js

```typescript
// Функция 1: версия
getTolkCompilerVersion(): Promise<string>

// Функция 2: компиляция
runTolkCompiler(config: TolkCompilerConfig): Promise<TolkResultSuccess | TolkResultError>

// Конфигурация
interface TolkCompilerConfig {
  entrypointFileName: string;         // Главный .tolk файл
  fsReadCallback: (path: string) => string; // Синхронный коллбэк для чтения файлов
  optimizationLevel?: number;         // 0-2, default 2
  withStackComments?: boolean;        // default false
  withSrcLineComments?: boolean;      // default false
  experimentalOptions?: string;       // default ''
}

// Результаты
interface TolkResultSuccess { status: "success"; fiftCode: string; codeBoc64: string; codeHashHex: string; }
interface TolkResultError { status: "error"; message: string; }
```

### Решение: маппинг на MCP

| tolk-js | MCP Tool | Адаптация |
|---------|----------|-----------|
| `getTolkCompilerVersion()` | `get_compiler_version` | Прямой passthrough |
| `runTolkCompiler(config)` | `compile_tolk` | `fsReadCallback` → `sources: Record<string, string>` (in-memory dictionary) |

**fsReadCallback** реализуется как lookup в `sources` dictionary:
```typescript
fsReadCallback: (path: string): string => {
  if (path in sources) return sources[path];
  throw new Error(`Import "${path}" not found. Available: [${Object.keys(sources).join(', ')}]. @stdlib/* resolves automatically.`);
}
```

### Параметры MCP-инструмента compile_tolk

| Параметр | Тип | Раскрывать? |
|----------|-----|-------------|
| `sources` | `Record<string, string>` | Да (обязательный) |
| `entrypointFileName` | `string` | Да (обязательный) |
| `optimizationLevel` | `number (0-2)` | Да (optional, default 2) |
| `withStackComments` | `boolean` | Да (optional, default false) |
| `experimentalOptions` | `string` | Нет (опасная строка без структуры) |
| `withSrcLineComments` | `boolean` | Нет (бесполезно для inline-sources) |

### Защита

- Макс. размер всех sources: 1MB
- Макс. количество файлов: 50
- Таймаут компиляции: 30 секунд (Promise.race)
- Проверка наличия entrypoint в sources до компиляции

---

## 3. MCP архитектура (Tools/Resources/Prompts)

### Tools (3 инструмента)

| Tool | Описание | Annotations |
|------|----------|-------------|
| `get_compiler_version` | Версия WASM-компилятора | readOnly, idempotent |
| `compile_tolk` | Полная компиляция → fiftCode + codeBoc64 + codeHashHex | readOnly, idempotent |
| `check_tolk_syntax` | Быстрая валидация без генерации кода | readOnly, idempotent |

### Resources (6+ ресурсов)

| URI | Описание | Priority |
|-----|----------|----------|
| `tolk://docs/language-guide` | Полный справочник синтаксиса Tolk | 1.0 |
| `tolk://docs/stdlib-reference` | Сигнатуры stdlib функций | 0.9 |
| `tolk://docs/changelog` | **Changelog компилятора (v0.6-v1.2)** | 0.8 |
| `tolk://examples/counter` | Минимальный рабочий пример | 0.8 |
| `tolk://examples/jetton` | Токен (fungible) | 0.7 |
| `tolk://examples/nft` | NFT контракт | 0.7 |
| `tolk://docs/tolk-vs-func` | Миграция FunC → Tolk | 0.5 |

### Prompts (3-5 промптов)

| Prompt | Описание |
|--------|----------|
| `write_contract` | Guided workflow написания контракта |
| `review_contract` | Security review (bounces, overflow, gas) |
| `debug_compilation` | Помощь с ошибками компиляции |
| `migrate_func_to_tolk` | Миграция FunC → Tolk |
| `optimize_gas` | Оптимизация газа |

### Transport

- **Primary:** stdio (Claude Desktop, Cursor, Windsurf)
- **Secondary:** Streamable HTTP (через флаг `--http`)

---

## 4. Анализ 3 конкурентов

### Сравнительная таблица

| Критерий | robustfengbin | amoghacloud | oxgeneral |
|----------|---------------|-------------|-----------|
| **Дата подачи** | 28 дек 2025 | 4 фев 2026 | 22 фев 2026 |
| **MCP Tools** | 2 | 2 | **3** |
| **MCP Resources** | 0 | 0 | **4** |
| **MCP Prompts** | 0 | 0 | **2** |
| **Тесты** | 4 (tolk-js direct) | **0** | **14 (MCP integration)** |
| **Транспорт** | **stdio + HTTP/SSE** | stdio | stdio |
| **Docker** | **Да** | Нет | Нет |
| **npm publish** | **Да** | Нет | Нет |
| **API полнота** | Полная | Неполная | **Полная + бонусы** |
| **Git-история** | Нормальная | 1 коммит | 3 коммита |
| **Smithery** | Нет | Нет | **Да** |
| **Качество** | Среднее | Низкое | **Высокое** |

### Кто скорее выиграет

**oxgeneral (PR #1212)** — наиболее вероятный победитель:
- Единственный, использующий все 3 примитива MCP (Tools + Resources + Prompts)
- 14 тестов с MCP integration testing (не просто tolk-js direct)
- `check_tolk_syntax` — бонус сверх требований

### Что НЕ сделал никто

1. **Compiler changelog** (прямо упомянут в issue!)
2. **FunC → Tolk конвертация** (реальная потребность разработчиков)
3. **Deploy deeplink** (генерация `ton://transfer/...?init=<boc>`)
4. **Кэширование** результатов компиляции
5. **Модульная архитектура** (все пишут в один файл)

---

## 5. Аналоги в индустрии

### Карта compiler/language MCP серверов

| Паттерн | Примеры | Инструментов |
|---------|---------|-------------|
| **API Bridge** | compiler-explorer-mcp | 3 |
| **Universal LSP Bridge** | mcp-language-server, lsp-mcp | 6 |
| **Dedicated LSP Wrapper** | rust-analyzer-mcp | 10-19 |
| **IDE-embedded** | JetBrains MCP | 5+ |
| **Template Generator** | OpenZeppelin Contracts MCP | 8 |
| **Full Toolchain Wrapper** | Foundry MCP (Solidity) | **30+** |
| **Static Analysis Wrapper** | Slither MCP (Trail of Bits) | 12 |

### Ближайшие аналоги (блокчейн)

- **[Foundry MCP](https://github.com/PraneshASP/foundry-mcp-server)** — полный Solidity тулчейн: compile + test + deploy + interact (30+ tools)
- **[Slither MCP](https://github.com/trailofbits/slither-mcp)** — статический анализ Solidity (12 tools, кэширование в artifacts)
- **[OpenZeppelin Contracts MCP](https://mcp.openzeppelin.com/)** — генерация безопасных контрактов по шаблонам (8 tools)

### Ключевые best practices из аналогов

1. **Single responsibility per tool** — никто не делает "одного бога-инструмента"
2. **Кэширование** (Slither) — `artifacts/project_facts.json`
3. **Dual-API** (Slither) — и как MCP, и как библиотека
4. **Workspace** (Foundry) — персистентное рабочее пространство
5. **Фильтрация результатов** — снижает потребление токенов
6. **`isError: true`** — для ошибок компиляции, чтобы LLM мог self-correct

---

## 6. Стратегия дифференциации

### Рекомендованная стратегия: "Targeted Sniper"

Реализовать всё, что есть у oxgeneral + 3 killer features, которых нет ни у кого:

| Killer Feature | Обоснование | Трудозатраты |
|----------------|-------------|-------------|
| **`compiler_changelog` resource** | Прямо запрошен в bounty, никто не сделал | ~3ч |
| **`convert_func_to_tolk` tool** | Решает реальную проблему миграции, blue ocean | ~4ч |
| **Deploy deeplink generation** | `ton://transfer/...?init=<boc>` из BOC, wow-эффект | ~2ч |

### Pitch для bounty submission

> "Всё что есть у лучшего конкурента (3 tools, resources, prompts, tests) + changelog (который вы просили) + FunC миграция (которой нет ни у кого) + deploy deeplinks + модульная архитектура + 20+ тестов"

### Вероятность победы

- Без дифференциации (клон oxgeneral): ~15-20%
- С Targeted Sniper стратегией: **~40-50%**
- Основной риск: oxgeneral может обновить свой PR

---

## 7. Оценка сложности и трудозатрат

### Общая оценка: EASY

### Декомпозиция по компонентам

| Компонент | Часы (опытный) | Часы (новичок MCP) |
|-----------|---------------|-------------------|
| Инициализация проекта | 1-2 | 2-3 |
| MCP обвязка | 1-2 | 3-5 |
| Tool: version | 0.5 | 1 |
| Tool: compile | 3-5 | 5-8 |
| Tool: syntax check | 1-2 | 2-3 |
| Tool: convert FunC (бонус) | 3-4 | 5-6 |
| Tool: deploy link (бонус) | 1-2 | 2-3 |
| Resources (docs, examples, changelog) | 4-6 | 6-8 |
| Prompts | 2-3 | 3-4 |
| Тесты (20+) | 4-6 | 6-8 |
| Документация + npm | 2-3 | 3-4 |
| **ИТОГО** | **23-36** | **38-53** |

### Центральная оценка

- **Опытный разработчик, знает TON:** ~26 часов (3-4 дня)
- **Опытный разработчик, не знает TON:** ~34 часа (4-5 дней)
- **Новичок в MCP, знает TON:** ~40 часов (~5 дней)

### Экономика

| Сценарий | Часы | $/час |
|----------|------|-------|
| Опытный + знает TON | 26 | ~$19/час |
| Опытный + не знает TON | 34 | ~$15/час |
| Новичок MCP + не знает TON | 50 | ~$10/час |

Для bounty это приемлемо (open-source bounty никогда не платят рыночную ставку). Компенсация: portfolio piece + опыт MCP + вклад в TON.

### Риски

1. **fsReadCallback** — исследовать как tolk-js обрабатывает stdlib (+2-4ч)
2. **Контент ресурсов** — курирование документации Tolk это content work (+3-5ч)
3. **Совместимость WASM** — низкий риск, но может быть неожиданным
4. **Domain knowledge** — если нет опыта с TON, заложить время на изучение

---

## Implementation Plan

### Phase 1: Core MVP (день 1-2)

- [ ] Инициализация проекта (package.json, tsconfig, структура)
- [ ] Подключение `@ton/tolk-js` и `@modelcontextprotocol/sdk`
- [ ] Tool: `get_compiler_version`
- [ ] Tool: `compile_tolk` (с in-memory sources, валидацией, LLM-friendly output)
- [ ] Tool: `check_tolk_syntax`
- [ ] Базовые тесты (5-7 для core tools)
- [ ] Проверка с MCP Inspector

### Phase 2: Resources & Prompts (день 2-3)

- [ ] Resource: `tolk://docs/language-guide`
- [ ] Resource: `tolk://docs/stdlib-reference`
- [ ] Resource: `tolk://docs/changelog` (unique!)
- [ ] Resources: примеры контрактов (counter, jetton, nft)
- [ ] Prompt: `write_contract`
- [ ] Prompt: `review_contract`
- [ ] Prompt: `debug_compilation`
- [ ] Тесты для resources/prompts

### Phase 3: Killer Features (день 3-4)

- [ ] Tool: `convert_func_to_tolk` (unique!)
- [ ] Tool: `generate_deploy_link` (unique!)
- [ ] Resource: `tolk://docs/tolk-vs-func`
- [ ] Prompt: `migrate_func_to_tolk`
- [ ] Расширенные тесты (до 20+)

### Phase 4: Polish & Publish (день 4)

- [ ] README с примерами для Claude Desktop / Cursor
- [ ] npm publish
- [ ] Smithery integration
- [ ] GitHub Actions CI
- [ ] Submit PR в grants-and-bounties

---

## Success Metrics

| Metric | Baseline (oxgeneral) | Target |
|--------|---------------------|--------|
| MCP Tools | 3 | **5** (+ convert, deploy) |
| MCP Resources | 4 | **7** (+ changelog, stdlib-ref, tolk-vs-func) |
| MCP Prompts | 2 | **5** (+ debug, migrate, optimize) |
| Tests | 14 | **20+** |
| Unique features | 0 | **3** (changelog, convert, deploy) |
| Transport | stdio only | stdio + HTTP |
| Architecture | 1 file | Modular (tools/, resources/, prompts/) |

---

## Sources

- [Issue #1200](https://github.com/ton-society/grants-and-bounties/issues/1200)
- [tolk-js](https://github.com/ton-blockchain/tolk-js)
- [compiler-explorer-mcp](https://github.com/torshepherd/compiler-explorer-mcp)
- [Tolk Language Overview](https://docs.ton.org/v3/documentation/smart-contracts/tolk/overview)
- [Tolk Language Guide](https://docs.ton.org/v3/documentation/smart-contracts/tolk/language-guide)
- [Tolk Changelog](https://docs.ton.org/languages/tolk/changelog)
- [convert-func-to-tolk](https://github.com/ton-blockchain/convert-func-to-tolk)
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [robustfengbin/tolk-mcp-server](https://github.com/robustfengbin/tolk-mcp-server)
- [amoghacloud/tolk-mcp-server](https://github.com/amoghacloud/tolk-mcp-server)
- [oxgeneral/tolk-mcp-server](https://github.com/oxgeneral/tolk-mcp-server)
- [Foundry MCP Server](https://github.com/PraneshASP/foundry-mcp-server)
- [Slither MCP](https://github.com/trailofbits/slither-mcp)
- [OpenZeppelin Contracts MCP](https://mcp.openzeppelin.com/)
- [MCP Best Practices](https://thenewstack.io/15-best-practices-for-building-mcp-servers-in-production/)
