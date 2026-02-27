# Tolk Language Guide

Tolk is a statically typed language for writing smart contracts on TON. It compiles to TVM and provides declarative data structures, automatic cell serialization, and message handling primitives.

```tolk
type AllowedMessage = CounterIncrement | CounterReset

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    match (msg) {
        CounterIncrement => { ... }
        CounterReset => { ... }
    }
}

get fun currentCounter() {
    val storage = lazy Storage.load();
    return storage.counter;
}
```

## Key Features

- A type system for describing cell layouts
- `lazy` loading that skips unused fields
- Unified message composition and deployment
- A compiler targeting the Fift assembler
- Tooling with IDE integration

---

## Imports

Imports must appear at the top of the file:

```tolk
import "another-file"
```

The entire file is imported. There are no modules or exports; all symbols must have unique names within the project.

### File Import Rules

- All top-level symbols must have unique names
- There is no export syntax -- all top-level declarations are automatically visible
- Name collisions can occur when importing multiple files

### Collision Prevention Strategies

- Use descriptive naming conventions (like `ReturnExcessesBack` rather than `Excesses`)
- Group related integer constants into enums
- Favor methods over global-scope functions

### Multi-Contract Projects

In projects with multiple contracts, each contract file serves as a separate compilation target. Since contract files don't import one another, duplicate declarations like `onInternalMessage` or `get fun` across different contracts don't conflict. Shared code (messages, storage, utilities) is imported by each contract file as needed.

---

## Types

### Numbers

At runtime, only 257-bit signed integers exist (`int` type). During serialization, values can be encoded with fewer bits.

**Fixed-width signed integers (`intN`):** Range from -2^(N-1) to 2^(N-1)-1, N between 1 and 257.
Examples: `int8`, `int32`, `int64`, `int257`

**Fixed-width unsigned integers (`uintN`):** Range from 0 to 2^N-1, N between 1 and 256.
Examples: `uint8`, `uint16`, `uint32`, `uint64`, `uint256`

**Variable-width types:**

| Type | Range | Space | Notes |
|------|-------|-------|-------|
| `coins` | 0 to 2^120-1 | 4-124 bits | Represents nanoToncoin |
| `varuint16` | Same as `coins` | Same | Rarely used |
| `varuint32` | 0 to 2^248-1 | 5-253 bits | Rarely used |
| `varint16` | -2^119 to 2^119-1 | 4-124 bits | Rarely used |
| `varint32` | -2^247 to 2^247-1 | 5-253 bits | Rarely used |

All types are 257-bit integers at runtime. Overflows occur only during serialization.

```tolk
const TEN = 0b1010;
const MAX_UINT8 = 0xFF;
const ONE_TON = ton("1");       // coins, value: 1000000000
val cost = ton("0.05");         // coins, value: 50000000
```

Arithmetic with `coins` degrades to `int`, except addition and subtraction which preserve `coins`. No floating-point support.

### Booleans

`bool` type with values `true` and `false`. TVM represents `true` as -1, `false` as 0.

Operators: `!x` (logical negation), `&&` / `||` (short-circuit), `&` / `|` / `^` (bitwise).

Booleans serialize as single bits (1 for `true`, 0 for `false`).

### Address

- `address` -- standard internal address (workchain + hash, 267 bits serialized)
- `address?` -- nullable address (null serializes as 2 zero bits)
- `any_address` -- any address type including external

```tolk
const ADMIN = address("EQ...")

fun checkAddress(addr: address) {
    val (wc, hash) = addr.getWorkchainAndHash();
    assert (wc == 0) throw 123;
}

if (in.senderAddress == storage.ownerAddress) { /* ... */ }
```

### Cells, Builders, and Slices

Cells hold up to 1023 bits of data and up to 4 references. They are immutable once created.

- `cell` -- untyped cell
- `Cell<T>` -- typed cell with known structure; use `.load()` to extract
- `slice` -- for reading cells (`c.beginParse()`)
- `builder` -- for constructing cells (`beginCell()`, finalize with `.endCell()`)

```tolk
val c = beginCell()
    .storeUint(0, 1)
    .storeAddress(addr)
    .endCell();

val parsed = Something.fromCell(c);
val cell = smth.toCell();
s.loadAny<T>();
b.storeAny<T>(value);
```

Special type: `RemainingBitsAndRefs` captures unread data (must be the last struct field).

### Nullable Types

`T?` is shorthand for `T | null`. The compiler enforces null safety:

```tolk
fun checkOptional(a: int, b: int?): bool {
    if (b == null) {
        return checkSingle(a);
    }
    return b >= 0 && checkDouble(a, b);  // b auto-narrowed to int
}
```

Non-null assertion: `val value = nullableVar!;`

### Maps

`map<K, V>` -- high-level abstraction over TVM dictionaries.

```tolk
var m: map<int8, int32> = createEmptyMap();
m.set(1, 10);
m.addIfNotExists(2, -20);
m.delete(2);

var r = m.get(1);
if (r.isFound) {
    val v = r.loadValue();
}
val v = m.mustGet(key);
```

**Iteration:**

```tolk
var r = m.findFirst();
while (r.isFound) {
    val key = r.getKey();
    val value = r.loadValue();
    r = m.iterateNext(r);
}
```

Key constraints: must be fixed-width, no references. Valid: `int32`, `address`, `bits256`.
Value constraints: must be serializable. Valid: `coins`, structs, `Cell<T>`.

### Enums

```tolk
enum Color {
    Red       // 0
    Green     // 1
    Blue      // 2
}

enum Mode {
    Foo = 256,
    Bar,        // implicitly 257
}
```

Enums are distinct types, not integers. Serialized as `(u)intN`. Casting: `Color.Blue as int` (gives 2), `2 as Color` (gives `Color.Blue`).

### Tensors and Tuples

Tensors are multiple values on the stack: `(T1, T2, T3)`.
Tuples are stored in a single TVM tuple: `[T1, T2, T3]`.

```tolk
var (a, b) = (1, "hello");
val t = [1, 2, 3];
t.push(4);
```

### Type Aliases

```tolk
type UserId = int
type ForwardPayloadRemainder = RemainingBitsAndRefs
```

### Callables

First-class functions: `(ParamTypes) -> ReturnType`.

```tolk
fun customRead(reader: (slice) -> int) { }
fun demo() {
    customRead(fun(s) { return s.loadUint(32) })
}
```

### void and never

- `void` -- functions returning nothing
- `never` -- functions that always throw

---

## Structures

```tolk
struct Point {
    x: int8
    y: int8
}

fun demo() {
    val p1: Point = { x: 10, y: 20 };
    val p2 = Point { x: 10, y: 20 };
}
```

- Methods are declared as `fun Point.method(self)`.
- Fields can use any types: numeric, cell, union, and others.
- Fields can define default values: `x: int8 = 0`.
- Fields can be `private` and `readonly`.
- Structs can be generic: `struct Wrapper<T> { ... }`.
- Shorthand: `{ a, b }` expands to `{ a: a, b: b }`.

### Default Values

```tolk
struct DefDemo {
    f1: int = 0
    f2: int? = null
    f3: (int, coins) = (0, ton("0.05"))
}
```

### Serialization Prefixes

For message structs with opcode prefixes:

```tolk
struct (0x7362d09c) TransferNotification {
    queryId: uint64
}
```

### Auto-Serialization

If all fields are serializable:

```tolk
val c = p1.toCell();
val p3 = Point.fromCell(c);
```

### Generic Structs

```tolk
struct Container<T> {
    element: T?
}
```

---

## Functions

```tolk
fun sum(a: int, b: int): int {
    return a + b;
}
```

- Parameter types are mandatory
- Return type can be omitted (auto-inferred)
- Parameters can have defaults: `fun f(b: int = 0)`
- Statements separated by semicolons `;`
- Generic: `fun f<T>(value: T) { ... }`
- Assembler: `fun f(...): int asm "..."`

### Function Attributes

- `@inline` -- forces inlining
- `@noinline` -- prevents inlining
- `@inline_ref` -- preserves inline references
- `@pure` -- no state modifications or exceptions
- `@deprecated` -- marks as deprecated

### Lambdas

```tolk
fun customRead(reader: (slice) -> int) { }
fun demo() {
    customRead(fun(s) { return s.loadUint(32) })
}
```

---

## Methods

A function declared as `fun <receiver>.name(...)` is a method.

- `self` parameter: instance method
- No `self`: static method

```tolk
fun Point.sumCoords(self) {
    return sum(self.x, self.y);
}

fun Point.createZero(): Point {
    return { x: 0, y: 0 };
}
```

By default, `self` is immutable. Use `mutate self` for modifications.

Methods can be declared for any type, including primitives:

```tolk
fun int.isNegative(self) {
    return self < 0
}
```

### Mutability and Method Chaining

```tolk
fun builder.myStoreInt32(mutate self, v: int): self {
    self.storeInt(v, 32);
    return self;
}
```

---

## Variables

### val (immutable)

```tolk
val coeff = 5;
```

### var (mutable)

```tolk
var x = 5;
x += 1;
```

### Explicit Type

```tolk
var x: int8 = 5;
```

### Tensor Destructuring

```tolk
var (a, b) = (1, "");
```

### Global Variables

Declared at the top level with `global` keyword. Avoid when possible.

---

## Constants

Constants are declared only at the top level:

```tolk
const ONE = 1
const MAX_AMOUNT = ton("0.05")
const ADMIN_ADDRESS = address("EQ...")
```

---

## Value Semantics and Mutability

Assignments create independent copies. Function calls do not mutate arguments unless specified.

```tolk
var a = Point { x: 1, y: 2 };
var b = a;       // copy
b.x = 99;       // a.x remains 1
someFn(a);       // pass a copy
anotherFn(mutate a);  // explicit mutation
```

The `mutate` keyword must appear at both definition and call site:

```tolk
fun increment(mutate x: int) {
    x += 1;
}

var n = 5;
increment(mutate n);  // n is now 6
```

---

## Control Flow

### If/Else

```tolk
if (a > b) {
    return (b, a)
} else {
    return (a, b)
}
```

### Ternary Operator

```tolk
val sign = a > 0 ? 1 : a < 0 ? -1 : 0;
```

### Assert

```tolk
assert (condition) throw ERR_CODE;
assert (condition, ERR_CODE)  // short form
```

---

## Union Types and Pattern Matching

```tolk
fun processValue(value: int | slice) {
    match (value) {
        int => { value * 2 }
        slice => { value.loadUint(8) }
    }
}
```

### Testing with `is` / `!is`

```tolk
if (value is slice) { return; }
// value is `int` here
```

### Match as Expression

```tolk
val nextValue = match (curValue) {
    1 => 0,
    0 => 1,
    else => -1
};
```

### Enum Matching

```tolk
match (someColor) {
    Color.Red => {}
    Color.Green => {}
    Color.Blue => {}
}
```

### Union Type Rules

- Unions automatically flatten
- `T | null` abbreviates to `T?`
- Any types can combine: `int | slice`, `address | Point | null`
- Subtype assignment: `B | C` value can be assigned to `A | B | C | D`

---

## Loops

### While Loop

```tolk
while (i > 0) {
    i -= 1;
}
```

### Do-While Loop

```tolk
do {
    // executes at least once
} while (condition);
```

### Repeat Loop

```tolk
repeat (N) {
    // executes N times
}
```

There is no `for` loop. `break` and `continue` are not supported.

---

## Exceptions

### Error Code Definition

```tolk
enum ErrCode {
    LowBalance = 200,
    SignatureMismatch,    // implicitly 201
}
```

Error codes should fall between 64 and 2048.

### Throw

```tolk
throw ERR_CODE;
throw (ERR_CODE, errArg);
```

### Try-Catch

```tolk
try {
    // protected code
} catch (errCode) {
    // handle error
}

try {
    throw (ERR_LOW_BALANCE, 555);
} catch (errCode, arg) {
    val data = arg as int;
}
```

Any error inside a `try` block reverts all changes made within.

---

## Sending Messages

```tolk
val reply = createMessage({
    bounce: BounceMode.NoBounce,
    value: ton("0.05"),
    dest: someAddress,
    body: RequestedInfo { ... }
});
reply.send(SEND_MODE_REGULAR);
```

### Destination Options

- `address` -- send to an address
- `builder` -- manually constructed
- `(int8, uint256)` -- workchain + hash
- `AutoDeployAddress` -- deploy with auto-calculated address

### Contract Deployment

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

### Shard-Based Deployment

```tolk
dest: {
    stateInit: walletInitialState,
    toShard: {
        closeTo: ownerAddress,
        fixedPrefixLength: 8
    }
}
```

### Body Handling

- Embedded: less than 500 bits and 2 refs or fewer
- Reference: 500+ bits or more than 2 refs
- Decision is made at compile time

Do not pass `body: obj.toCell()`. Pass `body: obj` and the compiler chooses optimal encoding.

### Send Modes

- `SEND_MODE_REGULAR` -- regular send (0)
- `SEND_MODE_PAY_FEES_SEPARATELY` -- pay fees from message value
- `SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE` -- forward remaining value
- `SEND_MODE_CARRY_ALL_REMAINING_BALANCE` -- forward entire balance
- `SEND_MODE_BOUNCE_ON_ACTION_FAIL` -- bounce if action fails
- `SEND_MODE_IGNORE_ERRORS` -- ignore errors during send

### External Log Messages

```tolk
val emitMsg = createExternalLogMessage({
    dest: createAddressNone(),
    body: DepositEvent { ... }
});
emitMsg.send(SEND_MODE_REGULAR);
```

---

## Contract Storage

### Common Pattern

```tolk
struct Storage {
    counterValue: int64
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}
```

### Usage

```tolk
get fun currentCounter() {
    var storage = lazy Storage.load();
    return storage.counterValue;
}

fun demoModify() {
    var storage = lazy Storage.load();
    storage.counterValue += 100;
    storage.save();
}
```

---

## Lazy Loading

The `lazy` keyword enables selective field loading. The compiler identifies which fields are accessed and loads only those.

```tolk
val st = lazy Storage.fromCell(contract.getData());
return st.publicKey
// Compiler inserts: "skip 65 bits, preload uint256"
```

Prefer `lazy T.fromCell()` over `T.fromCell()`.

For unions:

```tolk
val msg = lazy AllowedMessage.fromSlice(in.body);
match (msg) {
    CounterIncBy => { msg.byValue }
    CounterReset => { /* ... */ }
}
```

The `else` branch catches unmatched cases without throwing errors.

---

## Contract Getters

```tolk
get fun currentOwner(): address {
    val storage = lazy Storage.load();
    return storage.ownerAddress;
}
```

Use camelCase naming. For TEP compatibility, snake_case like `get_wallet_data` is acceptable.

Getters can return structures and accept parameters.

---

## Message Handling Entrypoints

### Internal Messages

```tolk
fun onInternalMessage(in: InMessage) {
    in.senderAddress;
    in.valueCoins;
    in.originalForwardFee;
}
```

### Bounced Messages

```tolk
fun onBouncedMessage(in: InMessageBounced) {
    // handle bounced messages
}
```

BounceMode options: `NoBounce`, `Only256BitsOfBody`, `RichBounce`, `RichBounceOnlyRootCell`.

### External Messages

```tolk
fun onExternalMessage(in: InExternalMessage) {
    acceptExternalMessage();
}
```

---

## Operators

### Precedence (highest to lowest)

1. `( )` -- Parenthesis / tensor creation
2. `[ ]` -- Typed tuple creation
3. `lazy` -- Lazy loading operator
4. `!` (postfix) -- Non-null assertion
5. `! ~ - +` (unary) -- Logical negation, bitwise complement, sign
6. `as is !is` -- Type operators
7. `* / % ^/ ~/` -- Multiplicative (257-bit precision)
8. `+ -` -- Additive
9. `<< >> ^>> ~>>` -- Bitwise shifts
10. `== < > <= >= != <=>` -- Comparison (includes spaceship)
11. `& | ^` -- Bitwise AND, OR, XOR
12. `&& ||` -- Logical (short-circuit)
13. `= += -= ...` -- Assignment
14. `? :` -- Ternary

`i++` and `i--` are not supported. Use `i += 1` and `i -= 1`.

---

## Semicolons

- Optional at the top level (after imports, aliases, etc.)
- Required between statements in a function
- Optional after the last statement in a block

---

## Assembler Functions

For low-level TVM instructions not covered by the standard library:

```tolk
@pure
fun incThenNegate(v: int): int
    asm "INC" "NEGATE"

fun hashStateInit(code: cell, data: cell): uint256 asm """
    DUP2
    HASHCU
    ONE HASHEXT_SHA256
"""
```

Use `asm` sparingly. The `@pure` annotation indicates no state modifications.

---

## Compiler Optimizations

- **Constant folding:** compile-time evaluation of constant expressions
- **Dead code elimination:** unused branches removed
- **Auto-inlining:** small/single-use functions are inlined automatically
- **Store merging:** consecutive `storeUint` calls merged into single operations
- **Peephole optimizations:** TVM instruction-level improvements
- **Lazy loading:** only accessed fields are loaded from storage

The compiler handles optimization automatically. Prioritize readability over manual optimization.
