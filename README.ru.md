<div align="center">

# iz-tolk-mcp

**MCP-сервер для компилятора смарт-контрактов Tolk — компиляция, проверка и деплой смарт-контрактов TON из любого AI-ассистента**

[![CI](https://github.com/izzzzzi/izTolkMcp/actions/workflows/ci.yml/badge.svg)](https://github.com/izzzzzi/izTolkMcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/iz-tolk-mcp.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/iz-tolk-mcp)
[![npm downloads](https://img.shields.io/npm/dm/iz-tolk-mcp.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/iz-tolk-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat&colorA=18181B&colorB=28CF8D)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&colorA=18181B&colorB=3178C6)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-ESM-green?style=flat&colorA=18181B&colorB=339933)](https://nodejs.org/)

**🇷🇺 Русский** | [🇬🇧 English](README.md)

<br />

*MCP-сервер, который интегрирует компилятор [Tolk](https://docs.ton.org/v3/documentation/smart-contracts/tolk/overview) непосредственно в AI-ассистенты — пишите, компилируйте, проверяйте и деплойте контракты TON, не выходя из диалога.*

</div>

---

## 📖 Обзор

**iz-tolk-mcp** — это сервер [Model Context Protocol](https://modelcontextprotocol.io/) (MCP), который интегрирует компилятор смарт-контрактов Tolk в AI-ассистенты, обеспечивая бесшовный рабочий процесс «написание — компиляция — деплой» для разработки на блокчейне TON.

- **Tolk** — это язык смарт-контрактов нового поколения для блокчейна TON, созданный как современный преемник FunC с привычным синтаксисом (в стиле C/TypeScript), типобезопасностью и более чистой семантикой.
- **MCP** (Model Context Protocol) — это открытый стандарт, позволяющий AI-ассистентам использовать внешние инструменты, получать доступ к источникам данных и следовать управляемым рабочим процессам, превращая их в полноценные среды разработки.

---

## ✨ Возможности

| Возможность | Описание |
|-------------|----------|
| 🔨 **4 MCP-инструмента** | `compile_tolk`, `check_tolk_syntax`, `get_compiler_version`, `generate_deploy_link` |
| 📄 **6 MCP-ресурсов** | Руководство по языку, справочник stdlib, журнал изменений, миграция с FunC, примеры контрактов |
| 💬 **3 MCP-промпта** | Управляемые рабочие процессы для написания, ревью и отладки смарт-контрактов |
| ⚙️ **Все опции компилятора** | Уровни оптимизации (0-2), комментарии стека, маппинг путей, многофайловая компиляция |
| 📦 **Многофайловая поддержка** | Компиляция проектов с несколькими `.tolk` файлами, импортами `@stdlib/*` и `@fiftlib/*` |
| 🔗 **Ссылки для деплоя** | Генерация deeplink-ов `ton://` и URL-ов Tonkeeper для деплоя через кошелёк |
| 🚀 **Без настройки** | Запуск через `npx` без внешних зависимостей, кроме Node.js |

---

## 🚀 Быстрый старт

```bash
npx iz-tolk-mcp
```

Сервер взаимодействует через stdio и предназначен для запуска MCP-клиентом.

---

## 📦 Установка

### Через npx (установка не требуется)

MCP-клиенты запускают сервер автоматически — просто добавьте его в конфигурацию (см. ниже).

### Глобальная установка

```bash
npm install -g iz-tolk-mcp
```

### Из исходников

```bash
git clone https://github.com/izzzzzi/izTolkMcp.git
cd izTolkMcp
npm install
npm run build
```

> **Требование:** Node.js >= 18

---

## 🔧 Настройка MCP-клиентов

<details>
<summary><b>Claude Desktop</b></summary>

Добавьте в `claude_desktop_config.json`:

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

Добавьте в `.cursor/mcp.json`:

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

Добавьте в `~/.windsurf/mcp.json`:

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

Добавьте в `.vscode/mcp.json`:

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
<summary><b>Локальная сборка (любой клиент)</b></summary>

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

## 🛠️ MCP-инструменты

### 🔍 `get_compiler_version`

Возвращает версию компилятора Tolk, входящего в состав `@ton/tolk-js` (WASM).

| Параметр | Тип | Обязательный | Описание |
|----------|-----|:------------:|----------|
| *(нет)* | — | — | Без параметров |

### 🔨 `compile_tolk`

Компилирует исходный код смарт-контракта на Tolk. Возвращает Fift-вывод, BoC (Bag of Cells) в base64, хеш кода и версию компилятора.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|:------------:|----------|
| `entrypointFileName` | `string` | ✅ | Главный файл `.tolk` для компиляции (например, `"main.tolk"`) |
| `sources` | `object` | ✅ | Словарь `имя файла -> исходный код`. Должен включать файл точки входа. |
| `optimizationLevel` | `number` | — | Уровень оптимизации 0-2 (по умолчанию: 2) |
| `withStackComments` | `boolean` | — | Включить комментарии расположения стека в Fift-вывод |
| `pathMappings` | `object` | — | Маппинг `@alias` префиксов на пути к папкам для резолва импортов |

### ✅ `check_tolk_syntax`

Проверяет исходный код на синтаксические и типовые ошибки без возврата полного результата компиляции. Более быстрая обратная связь для итеративной разработки.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|:------------:|----------|
| `entrypointFileName` | `string` | ✅ | Главный файл `.tolk` для проверки |
| `sources` | `object` | ✅ | Словарь `имя файла -> исходный код` |
| `pathMappings` | `object` | — | Маппинг `@alias` префиксов на пути к папкам для резолва импортов |

### 🔗 `generate_deploy_link`

Генерирует deeplink-и для деплоя скомпилированного контракта в сети TON. Вычисляет детерминированный адрес контракта и возвращает ссылки `ton://` и Tonkeeper.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|:------------:|----------|
| `codeBoc64` | `string` | ✅ | BoC скомпилированного кода контракта в base64 (из `compile_tolk`) |
| `initialDataBoc64` | `string` | — | BoC начальной ячейки данных в base64 (по умолчанию: пустая ячейка) |
| `workchain` | `number` | — | ID целевого воркчейна (по умолчанию: 0) |
| `amount` | `string` | — | Сумма деплоя в наноTON (по умолчанию: `"50000000"` = 0.05 TON) |

---

## 📄 MCP-ресурсы

| Ресурс | URI | Описание |
|--------|-----|----------|
| 📘 `language-guide` | `tolk://docs/language-guide` | Полный справочник синтаксиса языка Tolk |
| 📗 `stdlib-reference` | `tolk://docs/stdlib-reference` | Справочник модулей и функций стандартной библиотеки |
| 📋 `changelog` | `tolk://docs/changelog` | История версий компилятора Tolk от v0.6 до последней |
| 🔄 `tolk-vs-func` | `tolk://docs/tolk-vs-func` | Руководство по миграции с FunC на Tolk |
| 📝 `example-counter` | `tolk://examples/counter` | Пример простого смарт-контракта счётчика на Tolk |
| 💎 `example-jetton` | `tolk://examples/jetton` | Пример контракта минтера Jetton (взаимозаменяемый токен) |

---

## 💬 MCP-промпты

### `write_smart_contract`

Управляемый рабочий процесс для написания нового смарт-контракта на Tolk. Внедряет справочник языка и релевантный пример контракта в контекст диалога.

| Аргумент | Тип | Обязательный | Описание |
|----------|-----|:------------:|----------|
| `description` | `string` | ✅ | Описание того, что должен делать смарт-контракт |
| `contractType` | `string` | — | `"counter"` \| `"jetton"` \| `"nft"` \| `"wallet"` \| `"custom"` (по умолчанию: `"custom"`) |

### `review_smart_contract`

Ревью смарт-контракта с фокусом на безопасность. Проверяет контроль доступа, обработку сообщений, целочисленное переполнение, управление газом и уязвимости, специфичные для TON.

| Аргумент | Тип | Обязательный | Описание |
|----------|-----|:------------:|----------|
| `code` | `string` | ✅ | Исходный код смарт-контракта на Tolk для ревью |

### `debug_compilation_error`

Диагностика и исправление ошибки компиляции Tolk. Анализирует ошибку на основе справочника языка и предоставляет исправленный код.

| Аргумент | Тип | Обязательный | Описание |
|----------|-----|:------------:|----------|
| `errorMessage` | `string` | ✅ | Сообщение об ошибке компиляции от компилятора Tolk |
| `code` | `string` | ✅ | Исходный код на Tolk, который не удалось скомпилировать |

---

## 💡 Примеры использования

После настройки взаимодействуйте с MCP-сервером через естественный язык в вашем AI-ассистенте:

**Компиляция контракта:**

> «Скомпилируй этот смарт-контракт на Tolk:»
> ```tolk
> import "@stdlib/tvm-dicts";
>
> fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
>     // handle messages
> }
> ```

**Написание нового контракта с нуля:**

> «Напиши простой контракт счётчика для TON, который хранит число и позволяет кому угодно его увеличивать. Добавь геттер для чтения текущего значения.»

**Ревью существующего контракта:**

> «Проверь этот контракт на проблемы безопасности» *(вставьте код)*

**Отладка ошибки компиляции:**

> «Я получаю эту ошибку при компиляции: `unexpected token 'fun'` — вот мой код:» *(вставьте код)*

**Генерация ссылки для деплоя:**

> «Сгенерируй ссылку для деплоя контракта, который мы только что скомпилировали.»

---

## 📁 Структура проекта

```
src/
├── index.ts        — Инициализация сервера и stdio-транспорт
├── tools.ts        — 4 MCP-инструмента (компиляция, проверка, версия, деплой)
├── resources.ts    — 6 MCP-ресурсов (документация, примеры)
├── prompts.ts      — 3 MCP-промпта (написание, ревью, отладка)
└── content/        — Встроенная документация и примеры контрактов
    ├── language-guide.md
    ├── stdlib-reference.md
    ├── changelog.md
    ├── tolk-vs-func.md
    ├── example-counter.tolk
    └── example-jetton.tolk
```

Ключевые зависимости:

- `@modelcontextprotocol/sdk` — фреймворк MCP-сервера
- `@ton/tolk-js` — компилятор Tolk (WASM, работает локально)
- `@ton/core` — примитивы TON для вычисления адресов и сериализации ячеек
- `zod` — валидация схем для параметров инструментов

---

## 🧑‍💻 Разработка

```bash
npm install          # Установка зависимостей
npm run build        # Компиляция TypeScript + копирование файлов контента
npm run dev          # Запуск с tsx (горячая перезагрузка для разработки)
npm test             # Запуск тестов (vitest)
npm run lint         # Проверить на ошибки линтинга
npm run lint:fix     # Автоматически исправить ошибки линтинга
npm run format       # Форматировать код с помощью Biome
```

Pre-commit хуки автоматически обеспечивают качество кода:

- **Biome** — быстрый линтер и форматтер для TypeScript
- **Husky** — менеджер Git-хуков
- **lint-staged** — запускает проверки только для staged-файлов

