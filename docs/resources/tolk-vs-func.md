# Tolk vs FunC: Complete Comparison

> Source: https://docs.ton.org/languages/tolk/from-func/tolk-vs-func
> Key differences between Tolk and its predecessor FunC, with migration guidance.

---

## Overview

FunC is the first high-level language for TON smart contracts. Legacy FunC codebases exist, but the compiler is no longer maintained. Tolk is the primary and only actively supported language in the TON ecosystem.

## Gas Benchmarks

The tolk-bench repository compares FunC and Tolk across several TEPs. Tolk reduces gas consumption by 30-50% compared to FunC. This reduction is primarily due to differences in language design.

## Common Characteristics

- Both compile to Fift assembler
- Both run on TVM after compilation to bitcode
- Both are supported by IDE plugins
- Both are available in Blueprint and other client-side tooling
- Both support command-line usage

## Migration Steps

1. Review the list of differences below
2. Refer to the reference contracts at https://github.com/ton-blockchain/tolk-bench
3. Use the FunC-to-Tolk converter to migrate existing projects

---

## Key Differences

### 1. Basic Syntax

FunC resembles C (the name stands for "functional C"), while Tolk resembles TypeScript, Rust, and Kotlin.

```tolk
fun sum(a: int, b: int): int {
    return a + b;
}
```

### 2. Structures vs Unnamed Tensors

FunC uses unnamed tensors such as `(int, slice, int, int)`. Tolk uses named structures with the same runtime efficiency.

```tolk
struct Demo {
    previousValue: int256
    ownerAddress: address
    effectsCount: uint32
    totalAmount: coins
}
```

### 3. Automatic Serialization

FunC requires manual bit-level serialization using builders and slices. Tolk derives serialization from `struct` using `toCell` and `fromCell`.

```tolk
struct Point {
    x: int8
    y: int8
}

fun demo() {
    var value: Point = { x: 10, y: 20 };
    var c = value.toCell();        // makes a cell containing "0A14" (hex)
    var p = Point.fromCell(c);     // back to { x: 10, y: 20 }
}
```

### 4. Lazy Loading

FunC requires manual control over preloads and skips for optimization. Tolk uses the `lazy` keyword to load only accessed fields.

```tolk
get fun publicKey() {
    val st = lazy Storage.load();
    // <-- here "skip 65 bits, preload uint256" is inserted
    return st.publicKey
}
```

### 5. Boolean Type

FunC represents only integers: -1 for true, 0 for false; uses `ifnot`. Tolk provides a `bool` type and logical operators `&&`, `||`, and `!`.

```tolk
if (trustInput || validate(input)) {
    // ...
}
```

### 6. Address Type

FunC uses raw slices with bits comparison and parsing. Tolk provides an `address` type with methods and the `==` operator.

```tolk
if (in.senderAddress == storage.ownerAddress) {
    val workchain = storage.ownerAddress.getWorkchain();
}
```

### 7. Null Safety

FunC allows any variable to hold `null`, which may lead to runtime errors. Tolk provides nullable types `T?`, null safety, and smart casts.

```tolk
fun checkWithOptional(a: int, b: int?): bool {
    if (b == null) {
        return checkSingle(a);
    }
    return b >= 0 && checkDouble(a, b);
}
```

### 8. Type System Features

FunC provides several types that expose TVM primitives. Tolk provides a type system including unions, generics, and enums.

```tolk
struct Container<T> {
    element: T?
}

struct Nothing

type Wrapper<T> = Nothing | Container<T>
```

### 9. Methods for All Types

FunC provides functions in the global scope only. Tolk provides both functions and methods, applicable to structures and primitives.

```tolk
fun Point.createZero(): Point {
    return { x: 0, y: 0 }
}

fun Point.sumCoords(self) {
    return self.x + self.y
}

fun tuple.isEmpty(self) {
    return self.size() == 0
}
```

### 10. No `impure` Keyword

In FunC, if `impure` is omitted, a function call may be dropped. In Tolk, user function calls are not removed by the compiler.

### 11. No `~` Tilde Methods

FunC distinguishes between `x~f()` and `x.f()`. Tolk uses dot `.` syntax for all method calls.

```tolk
val delta = someSlice.loadUint(32);   // mutates someSlice
val owner = someSlice.loadAddress();
```

### 12. Native Maps Over TVM Dictionaries

FunC uses dictionaries like `m~idict_set_builder(1,32,begin_cell().store_uint(10,32))`. Tolk provides native maps like `m.set(1, 10)`.

```tolk
var m: map<int8, int32> = createEmptyMap();
m.set(1, 10);
m.addIfNotExists(2, -20);
m.delete(2);   // now: [ 1 => 10 ]
```

### 13. Message Handling

FunC defines `() recv_internal(4 params)` and parses a message cell. Tolk provides `onInternalMessage(in)` with fields like `in.senderAddress`.

```tolk
fun onInternalMessage(in: InMessage) {
    in.senderAddress;
    in.originalForwardFee;
}

fun onBouncedMessage(in: InMessageBounced) {
    // bounced messages arrive here
}
```

### 14. Message Routing

FunC routes incoming messages using `if-else` checks on the `opcode`. Tolk routes using union types and pattern matching.

```tolk
type MyMessage =
    | CounterIncBy
    | CounterReset

fun onInternalMessage(in: InMessage) {
    val msg = lazy MyMessage.fromSlice(in.body);
    match (msg) {
        CounterIncBy => { ... }
        CounterReset => { ... }
    }
}
```

### 15. Empty Messages Handling

FunC checks for empty bodies using `if (slice_empty?(...))`. Tolk handles empty or unknown messages using `else` in lazy matching.

```tolk
match (msg) {
    CounterReset => { /* ... */ }
    else => {
        if (in.body.isEmpty()) { return }
        throw 0xFFFF
    }
}
```

### 16. Message Composition

FunC requires manual bit-level message construction. Tolk provides `createMessage` which automatically chooses between inline body and body reference.

```tolk
val reply = createMessage({
    bounce: BounceMode.NoBounce,
    value: ton("0.05"),
    dest: senderAddress,
    body: RequestedInfo { ... }
});
reply.send(SEND_MODE_REGULAR);
```

### 17. Deployment and StateInit

FunC requires manual packing of contract code and data. Tolk uses `createMessage` to attach `StateInit` and compute the destination automatically.

```tolk
val deployMsg = createMessage({
    dest: {
        stateInit: {
            code: contractCodeCell,
            data: emptyStorage.toCell(),
        },
    }
});
```

### 18. Identifier Syntax

FunC allows arbitrary symbols in identifiers (e.g., `var 2+2 = ...`). Tolk allows only alphanumeric identifiers.

### 19. Automatic Inlining

In FunC, prefer larger functions for reduced gas consumption. In Tolk, the compiler auto-inlines functions without additional gas cost.

```tolk
fun int.zero() { return 0 }
fun int.inc(mutate self, byValue: int = 1): self {
    self += byValue;
    return self;
}
fun main() { return int.zero().inc().inc() }
// Compiles to: 2 PUSHINT
```

In FunC, `inline` modifier operates at the Fift level. In Tolk, inlining is at the compiler level combined with constant folding.

### 20. Merging Consecutive Store Operations

FunC manually combines constant stores. Tolk merges `b.storeUint(...).storeUint(...)` if constant.

```tolk
b.storeUint(0, 1)
 .storeUint(1, 1)
 .storeUint(1, 1)
 .storeUint(0, 1)
 .storeUint(0, 2)
// Compiles to: b{011000} STSLICECONST
```

---

## Standard Library Comparison

### Renamed Functions

| FunC | Tolk |
|------|------|
| `cur_lt()` | `blockchain.logicalTime()` |
| `car(l)` | `listGetHead(l)` |
| `raw_reserve(coins)` | `reserveToncoinsOnBalance(coins)` |
| `~dump(x)` | `debug.print(x)` |
| `now` | `blockchain.now` |
| `my_address` | `contract.getAddress` |
| `divmod` | `divMod` |
| `begin_parse` | `beginParse` |
| `random` | `random.uint256` |
| `minmax` | `minMax` |

### Functions Converted to Methods

| FunC | Tolk |
|------|------|
| `s.slice_hash()` | `s.hash()` |
| `equal_slices_bits(a, b)` | `a.bitsEqual(b)` |
| `t.tuple_len()` | `t.size()` |
| `t~tpush(triple(x, y, z))` | `t.push([x, y, z])` |

### String Functions Replaced by Built-ins

| FunC | Tolk |
|------|------|
| `"..."c` | `stringCrc32("...")` |
| `"..."H` | `stringSha256("...")` |
| `"..."h` | `stringSha256_32("...")` |
| `"..."a` | `address("...")` |
| `"..."s` | `stringHexToSlice("...")` |
| `"..."u` | `stringToBase256("...")` |

### Removed Functions (No Tolk Equivalent)

`impure_touch`, `single`, `unsingle`, `pair`, `unpair`, `triple`, `untriple`, `tuple4`, `untuple4`, `second`, `third`, `fourth`, `pair_first`, `pair_second`, `triple_first`, `triple_second`, `triple_third`, `buy_gas`, `parse_addr`, `parse_var_addr`

### Mutability Model Change

In FunC, `x~method` mutates, whereas `x.method` returns a copy. In Tolk, methods are called with dot `.` and may mutate the object depending on `mutate` annotation.

---

## Assembler Functions

Although Tolk is a high-level language, it exposes low-level capabilities. TVM instructions are supported:

```tolk
@pure
fun incThenNegate(v: int): int
    asm "INC" "NEGATE"
```
