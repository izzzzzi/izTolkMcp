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
| `stringCrc32("str")` | CRC32 checksum | `int` |
| `stringCrc16("str")` | CRC16 checksum | `int` |
| `stringSha256("str")` | SHA256 hash | `uint256` |
| `stringSha256_32("str")` | SHA256 truncated to 32 bits | `int` |
| `stringToBase256("str")` | Base-256 conversion | `int` |
| `stringHexToSlice("hex")` | Hex bytes to slice | `slice` |

### Tuple Operations

| Function/Method | Description |
|-----------------|-------------|
| `t.push(value)` | Push value onto tuple |
| `t.get(index)` | Get value at index |
| `t.size()` | Get tuple size |
| `t.first()` | Get first element |
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
| `s.loadUint(bits)` | Load unsigned integer |
| `s.loadInt(bits)` | Load signed integer |
| `s.loadRef()` | Load cell reference |
| `s.loadAddress()` | Load address |
| `s.loadBool()` | Load boolean |
| `s.loadCoins()` | Load coins value |
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

Manages nested tuple-based list structures (cons lists):

| Function | Description |
|----------|-------------|
| `listGetHead(l)` | Get head of list |
| `listGetTail(l)` | Get tail of list |
| `listPrepend(head, tail)` | Prepend to list |

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
