# Tolk Standard Library Reference

The Tolk standard library is divided into two categories:
1. **Always-available functions** -- bundled in `@stdlib/common.tolk`, available without imports
2. **Optional modules** -- require explicit `import "@stdlib/module-name"`

The library is automatically discovered during compilation and bundled with the compiler as `tolk-stdlib/`.

---

## Always-Available Functions (@stdlib/common.tolk)

### Compile-Time Calculations

These functions evaluate at compile time and embed constant values directly into contracts:

| Function | Description | Return Type |
|----------|-------------|-------------|
| `address("EQ...")` | Embeds a contract address | `address` |
| `ton("0.05")` | Calculates nanoToncoin value | `coins` |
| `"str".crc32()` | CRC32 checksum (v1.3+, replaces `stringCrc32`) | `int` |
| `"str".crc16()` | CRC16 checksum (v1.3+, replaces `stringCrc16`) | `int` |
| `"str".sha256()` | SHA256 hash (v1.3+, replaces `stringSha256`) | `uint256` |
| `"str".sha256_32()` | SHA256 truncated to 32 bits (v1.3+, replaces `stringSha256_32`) | `int` |
| `"str".toBase256()` | Base-256 conversion (v1.3+, replaces `stringToBase256`) | `int` |
| `"hex".hexToSlice()` | Hex bytes to slice (v1.3+, replaces `stringHexToSlice`) | `slice` |
| `"str".literalSlice()` | String to slice literal (v1.3+) | `slice` |

> **Note:** The old `stringCrc32()`, `stringCrc16()`, `stringSha256()`, `stringSha256_32()`, `stringToBase256()` forms still work but are deprecated in v1.3. `stringHexToSlice()` is deprecated -- use `"hex".hexToSlice()` instead.

### Array and Tuple Operations

In v1.3+, `array<T>` replaces raw `tuple` for typed collections. The old `tuple` is now `type tuple = array<unknown>`.

| Function/Method | Description |
|-----------------|-------------|
| `a.push(value)` | Push value onto array |
| `a.get(index)` | Get value at index |
| `a.set(index, value)` | Set value at index |
| `a.size()` | Get array size |
| `a.first()` | Get first element |
| `a.last()` | Get last element |
| `a.pop()` | Remove and return last element |
| `toTuple(...)` | Create tuple from values |
| `fromTuple(t)` | Destructure tuple |

### Mathematical Primitives

| Function | Description |
|----------|-------------|
| `min(a, b)` | Minimum of two values |
| `max(a, b)` | Maximum of two values |
| `minMax(a, b)` | Returns (min, max) pair |
| `abs(x)` | Absolute value |
| `divMod(a, b)` | Division and modulo |
| `mulDivFloor(a, b, c)` | (a * b) / c with floor rounding |
| `mulDivRound(a, b, c)` | (a * b) / c with rounding |
| `mulDivCeil(a, b, c)` | (a * b) / c with ceiling |

### Contract State Management

| Function/Method | Description |
|-----------------|-------------|
| `contract.getAddress()` | Get this contract's address |
| `contract.getData()` | Get persistent storage cell |
| `contract.setData(cell)` | Set persistent storage cell |
| `contract.getCode()` | Get this contract's code cell |
| `contract.getOriginalBalance()` | Get balance before current transaction |

### Blockchain Environment Getters

| Function/Method | Description |
|-----------------|-------------|
| `blockchain.now()` | Current Unix timestamp |
| `blockchain.logicalTime()` | Current logical time |
| `blockchain.configParam(id)` | Get blockchain config parameter |
| `blockchain.getGlobalId()` | Get global blockchain ID |

### Cryptographic Functions

| Function/Method | Description |
|-----------------|-------------|
| `cell.hash()` | Hash of a cell (uint256) |
| `cell.hashEqual(other)` | Compare two cells by hash (v1.3+) |
| `slice.hash()` | Hash of a slice (uint256) |
| `isSignatureValid(hash, signature, publicKey)` | Verify Ed25519 signature |
| `random.uint256()` | Random 256-bit unsigned integer |
| `random.range(max)` | Random integer in range [0, max) |
| `random.setSeed(seed)` | Set random seed |

### Message Creation and Sending

| Function/Constant | Description |
|-------------------|-------------|
| `createMessage(options)` | Create an outgoing message |
| `createExternalLogMessage(options)` | Create an external log message |
| `sendRawMessage(cell, mode)` | Send a raw message cell |
| `SEND_MODE_REGULAR` | Regular send mode (0) |
| `SEND_MODE_PAY_FEES_SEPARATELY` | Pay fees from message value |
| `SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE` | Forward remaining value |
| `SEND_MODE_CARRY_ALL_REMAINING_BALANCE` | Forward entire balance |
| `SEND_MODE_BOUNCE_ON_ACTION_FAIL` | Bounce if action fails |
| `SEND_MODE_IGNORE_ERRORS` | Ignore errors during send |

### Balance and Gas

| Function | Description |
|----------|-------------|
| `reserveToncoinsOnBalance(coins)` | Reserve TON on contract balance |
| `acceptExternalMessage()` | Accept external message (increases gas) |
| `commitContractDataAndActions()` | Commit data and actions |

### Cell/Builder/Slice Operations

| Method | Description |
|--------|-------------|
| `beginCell()` | Create a new builder |
| `b.endCell()` | Finalize builder into cell |
| `c.beginParse()` | Open cell as slice |
| `b.storeUint(value, bits)` | Store unsigned integer |
| `b.storeInt(value, bits)` | Store signed integer |
| `b.storeRef(cell)` | Store cell reference |
| `b.storeAddress(addr)` | Store address |
| `b.storeBool(flag)` | Store boolean |
| `b.storeCoins(amount)` | Store coins value |
| `b.storeSlice(s)` | Store slice data |
| `b.storeString(str)` | Store string value (v1.3+) |
| `s.loadUint(bits)` | Load unsigned integer |
| `s.loadInt(bits)` | Load signed integer |
| `s.loadRef()` | Load cell reference |
| `s.loadAddress()` | Load address |
| `s.loadBool()` | Load boolean |
| `s.loadCoins()` | Load coins value |
| `s.loadString()` | Load string value (v1.3+) |
| `s.skipBits(n)` | Skip bits |
| `s.remainingBitsCount()` | Remaining bits in slice |
| `s.remainingRefsCount()` | Remaining refs in slice |
| `s.isEmpty()` | Check if slice is empty |
| `s.bitsEqual(other)` | Compare bits of two slices |

### Debug

| Function | Description |
|----------|-------------|
| `debug.print(value)` | Print value for debugging |
| `debug.dump(value)` | Dump value (detailed) |

---

## Optional Modules

### @stdlib/gas-payments

```tolk
import "@stdlib/gas-payments"
```

| Function | Description |
|----------|-------------|
| `getGasConsumedAtTheMoment()` | Get gas consumed so far |
| `calculateStorageFee(...)` | Calculate storage fee |

### @stdlib/exotic-cells

```tolk
import "@stdlib/exotic-cells"
```

Handles exotic cell parsing and library references. Used for working with Merkle proofs and library cells.

### @stdlib/lisp-lists

```tolk
import "@stdlib/lisp-lists"
```

Typed lisp-style linked lists using `lisp_list<T>` (v1.3+):

| Method | Description |
|--------|-------------|
| `l.isEmpty()` | Check if list is empty |
| `l.prependHead(value)` | Prepend value to list |
| `l.popHead()` | Remove and return head |
| `l.getHead()` | Get head value |
| `l.getTail()` | Get tail of list |
| `l.calculateSize()` | Calculate list length |
| `l.calculateReversed()` | Return reversed copy |
| `l.calculateConcatenation(other)` | Concatenate two lists |
| `l.packToBuilder(b)` | Serialize to builder |
| `lisp_list<T>.unpackFromSlice(s)` | Deserialize from slice |

> **Note:** The old free functions `listGetHead()`, `listGetTail()`, `listPrepend()`, `createEmptyList()` are deprecated in v1.3. Use method syntax on `lisp_list<T>` and `[] as lisp_list<T>` instead.

### @stdlib/tvm-dicts

```tolk
import "@stdlib/tvm-dicts"
```

Provides low-level dictionary operations for cases where `map<K,V>` is insufficient. Direct access to TVM dictionary instructions.

### @stdlib/tvm-lowlevel

```tolk
import "@stdlib/tvm-lowlevel"
```

Direct TVM register and stack manipulation:
- Access to c3, c4, c5, c7 registers
- Stack inspection and manipulation
- Low-level TVM instruction wrappers
- **`VmExitCode` enum** (v1.3+) -- named constants for all standard TVM exit codes (0-63): `NormalTermination`, `StackUnderflow`, `IntegerOverflow`, `OutOfGasError`, `CellUnderflow`, `CellOverflow`, `DictionaryError`, `TypeCheckError`, etc.

### @stdlib/strings (v1.3+)

```tolk
import "@stdlib/strings"
```

String utilities and `StringBuilder`:

| Function/Method | Description |
|-----------------|-------------|
| `str.depth()` | Get cell depth of string |
| `str.calculateLength()` | Calculate string length |
| `str.hash()` | Hash of string |
| `str.equalTo(other)` | Compare two strings |
| `n.toDecimalString()` | Convert integer to decimal string |
| `str.prefixWith00()` | Prefix string with 0x00 byte |
| `str.prefixWith01()` | Prefix string with 0x01 byte |
| `StringBuilder.create()` | Create new string builder |
| `sb.append(str)` | Append string |
| `sb.appendInt(n)` | Append integer as decimal |
| `sb.build()` | Build final string |

### @stdlib/reflection (v1.3+)

```tolk
import "@stdlib/reflection"
```

Compile-time type introspection:

| Function | Description |
|----------|-------------|
| `reflect.typeNameOf<T>()` | Get type name as string |
| `reflect.typeNameOfObject(obj)` | Get runtime type name |
| `reflect.stackSizeOf<T>()` | Get TVM stack slots for type |
| `reflect.stackSizeOfObject(obj)` | Get TVM stack slots for object |
| `reflect.serializationPrefixOf<T>()` | Get serialization prefix |
| `reflect.estimateSerializationOf<T>()` | Estimate serialization size |
| `reflect.sourceLocation()` | Get current source location |
| `reflect.sourceLocationAsString()` | Get source location as string |

---

## Naming Conventions (from FunC)

### Global Functions to Namespace Methods

| FunC (global) | Tolk (namespaced) |
|---------------|-------------------|
| `cur_lt()` | `blockchain.logicalTime()` |
| `now()` | `blockchain.now()` |
| `my_address()` | `contract.getAddress()` |
| `get_data()` | `contract.getData()` |
| `set_data(c)` | `contract.setData(c)` |
| `raw_reserve(amount, mode)` | `reserveToncoinsOnBalance(amount, mode)` |

### Global Functions to Instance Methods

| FunC | Tolk |
|------|------|
| `cell_hash(c)` / `c.cell_hash()` | `c.hash()` |
| `slice_hash(s)` | `s.hash()` |
| `string_hash(s)` | `s.hash()` |
| `begin_parse(c)` | `c.beginParse()` |
| `begin_cell()` | `beginCell()` |
| `end_cell(b)` | `b.endCell()` |
| `store_uint(b, v, n)` | `b.storeUint(v, n)` |
| `load_uint(s, n)` | `s.loadUint(n)` |
| `store_ref(b, c)` | `b.storeRef(c)` |
| `load_ref(s)` | `s.loadRef()` |
| `slice_bits(s)` | `s.remainingBitsCount()` |
| `slice_refs(s)` | `s.remainingRefsCount()` |
| `slice_empty?(s)` | `s.isEmpty()` |
| `equal_slices_bits(a, b)` | `a.bitsEqual(b)` |
| `tuple_len(t)` / `t.tlen()` | `t.size()` |
| `t~tpush(v)` | `t.push(v)` |
| `first(t)` | `t.first()` |
| `at(t, i)` | `t.get(i)` |
