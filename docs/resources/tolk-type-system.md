# Tolk Type System Reference

> Source: https://docs.ton.org/languages/tolk/types/
> Complete reference for all types available in Tolk.

---

## List of Types

The Tolk type system encompasses:

- **Numbers** -- `int`, `int32`, `uint64`, `coins`, and others
- **Booleans** -- `bool` with values `true` and `false`
- **Addresses** -- `address`, `address?`, `any_address`
- **Cells** -- containers with up to 1023 bits and up to 4 references
- **Builders** -- `builder` for constructing cells
- **Slices** -- `slice` for reading cells
- **Typed cells** -- `Cell<T>` for cells with known structure
- **Structures** -- multiple fields grouped into one entity
- **Generics** -- any struct can be generic `<T>`
- **Enums** -- distinct types containing integer variants
- **Nullable** -- `T?` shorthand for `T | null`
- **Union types** -- variables holding one of several possible values
- **Tensors** -- multiple values placed sequentially on the stack
- **Tuples** -- multiple values stored in a single TVM tuple
- **Maps** -- `map<K, V>` key-value dictionaries
- **Callables** -- first-class functions
- **Type aliases** -- `type MyAlias = SomeType`
- **void** -- absence of value
- **never** -- function never returns (always throws)

There is no distinct type for strings -- they are not native to TVM and thus are emulated using slices.

---

## Numbers

### Runtime Representation

At runtime, only 257-bit signed integers exist, represented by Tolk's `int` type. During serialization/deserialization, integer values can be encoded with fewer bits.

### Fixed-Width Integer Types

**Signed integers (`intN`):** Range from -2^(N-1) to 2^(N-1)-1, using N bits where N is between 1 and 257.
Examples: `int8`, `int32`, `int64`, `int257`

**Unsigned integers (`uintN`):** Range from 0 to 2^N-1, using N bits where N is between 1 and 256.
Examples: `uint8`, `uint16`, `uint32`, `uint64`, `uint256`

### Variable-Width Integer Types

| Type | Range | Space | Notes |
|------|-------|-------|-------|
| `coins` | 0 to 2^120-1 | 4-124 bits | Represents nanoToncoin; 10^9 nanoToncoin = 1 Toncoin |
| `varuint16` | Same as `coins` | Same as `coins` | Rarely used |
| `varuint32` | 0 to 2^248-1 | 5-253 bits | Rarely used |
| `varint16` | -2^119 to 2^119-1 | 4-124 bits | Rarely used |
| `varint32` | -2^247 to 2^247-1 | 5-253 bits | Rarely used |

**Important:** All these types are 257-bit integers at runtime. Overflows can occur at runtime, but they are more likely during serialization.

### Literals

```tolk
const TEN = 0b1010;           // Binary literal
const MAX_UINT8 = 0xFF;       // Hex literal
const MAX_INT = 115792089237316195423570985008687907853269984665640564039457584007913129639935;
```

### The `coins` Type and `ton()` Function

```tolk
const ONE_TON = ton("1");     // `coins`, value: 1000000000

fun calcCost() {
    val cost = ton("0.05");   // `coins`, value: 50000000
    return ONE_TON + cost;
}
```

Arithmetic with `coins` degrades to `int`, except addition and subtraction which preserve the `coins` type.

### No Floating-Point Support

The virtual machine supports only signed 257-bit integers. Floating-point numbers do not exist.

### Serialization Rules

- `int` -- not serializable; use `intN` and other types
- `intN` -- fixed N-bit signed integer
- `uintN` -- fixed N-bit unsigned integer
- `coins` -- alias to `varuint16`

### Overflow Timing

There are no runtime bounds checks. Overflows occur only during serialization:

```tolk
var v: uint8 = 255;
v += 1;     // 256, no error yet
// Error occurs when serializing: resp.toCell();
```

### Implicit Casting

All arithmetic operations on `intN` degrade to `int`. All numeric literals are of type `int`.

```tolk
fun f(op: int32, qid: uint64) {
    op = qid;               // error
    op = qid as int32;      // ok
    op + qid;               // ok, result is int
    if (op == qid) {}       // ok, comparison works
}
```

---

## Booleans

`bool` type with values `true` and `false`.

### TVM Representation

TVM does not have booleans as a separate type. `true` is represented as -1 (all bits set) and `false` as 0.

### Operators

- `!x` -- logical negation (accepts bool and int)
- `&&` and `||` -- short-circuit logical operators
- `&`, `|`, `^` -- bitwise operators (always evaluate both operands)

Integers are treated as `true` when non-zero and `false` when zero in conditions.

### Serialization

Booleans serialize as single bits (1 for `true`, 0 for `false`).

### Casting

```tolk
val intVal = someBool as int;  // no runtime transformation
```

---

## Address

### Types

- `address` -- standard internal address (workchain + hash)
- `address?` -- nullable address (internal or null)
- `any_address` -- any address type including external

### Components

A standard internal `address` consists of:
- `int8` workchain (masterchain at -1, basechain at 0)
- `uint256` hash (256-bit account ID)

```tolk
fun checkAddress(addr: address, expectHash: uint256) {
    val (wc, hash) = addr.getWorkchainAndHash();
    assert (wc == 0) throw 123;
    assert (hash == expectHash) throw 456;
}
```

### Serialization

When serialized, `address` occupies 267 bits: 3 bits prefix (0b100) + 8-bit workchain + 256-bit hash.

Non-null `address?` occupies 267 bits; null values occupy 2 zero bits (`addr_none`).

### Comparison

```tolk
if (in.senderAddress == st.owner) {
    // process message from owner
}
```

### Constants

```tolk
const REFUND_ADDR = address("EQCRDM9h4k3UJdOePPuyX40mCgA4vxge5Dc5vjBR8djbEKC5")
```

### Creating None Address

```tolk
createAddressNone()
```

### Casting

```tolk
val s = someAddr as slice;
s.loadUint(3);     // 0b100 tag
s.loadInt(8);      // workchain
```

---

## Cells, Builders, and Slices

### Cells

Cells are the fundamental data storage unit in TON. They can hold up to 1023 bits of data and up to 4 references to other cells. Cells are read-only and immutable once created.

**Untyped cells:** `cell` type for data without known structure.

**Typed cells:** `Cell<T>` for cells with known internal structure. Use `load()` to extract the value.

### Slices

Call `beginParse()` to get a slice, then load data with methods like `loadUint()`, `loadAddress()`, `loadRef()`.

Fixed-size `bitsN` types work as regular slices at runtime.

String literals create binary slices where each character maps to its ASCII value.

### Builders

Create with `beginCell()`, finalize with `endCell()`. Methods named `storeXYZ` return self, enabling chaining:

```tolk
val c = beginCell()
    .storeUint(0, 1)
    .storeAddress(addr)
    .endCell();
```

### Automatic Serialization

```tolk
val parsed = Something.fromCell(c);    // parse from cell
val cell = smth.toCell();               // serialize to cell
val parsed2 = Something.fromSlice(s);  // parse from slice
s.loadAny<T>();                         // load from slice (mutating)
b.storeAny<T>(value);                   // store to builder
```

### Special Types

- `RemainingBitsAndRefs` -- captures unread data (must be last struct field)
- `Cell<T>` nullable variant uses 0 for null and 1 followed by reference

---

## Nullable Types

`T?` is shorthand for `T | null`.

### Null Safety

The compiler enforces null safety: nullable values cannot be accessed without an explicit check.

```tolk
fun checkWithOptional(a: int, b: int?): bool {
    if (b == null) {
        return checkSingle(a);
    }
    return b >= 0 && checkDouble(a, b);  // b auto-narrowed to int
}
```

### Smart Casts

After null checks, the compiler automatically narrows the type:

```tolk
var x: int? = getValue();
if (x != null) {
    // x is now int, not int?
    return x + 1;
}
```

### Non-null Assertion

```tolk
val value = nullableVar!;  // throws if null at runtime
```

Global variables cannot be smart-cast and require `!` for type narrowing.

### Serialization

Nullable primitives serialize as TVM values or null. Nullable structures are serialized as tagged unions: `0` for null, `1` followed by the non-null value. `address?` uses different serialization rules.

---

## Enums

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

### Type System

Enums are distinct types, not integers. `Color.Red` has type `Color`, not `int`.

```tolk
fun isRed(c: Color) {
    return c == Color.Red
}

isRed(Color.Blue);    // ok
isRed(1);             // error, cannot pass `int` to `Color`
```

### Usage in Structs

```tolk
struct Gradient {
    from: Color
    to: Color? = null
}
```

### Casting

```tolk
Color.Blue as int     // 2
2 as Color            // Color.Blue
100 as Color          // valid but dangerous -- == returns false, match throws 5
```

### Serialization

Every enum is backed by TVM `INT` and serialized as `(u)intN`, where N is specified manually (e.g., `enum Role: int8 { ... }`) or calculated automatically to fit all values.

### Use in Exceptions

```tolk
enum Err {
    InvalidId = 0x100
    TooHighId
}

fun validate(id: int) {
    assert (id < 1000) throw Err.TooHighId;  // excno = 257
}
```

---

## Maps

`map<K, V>` is a high-level abstraction over TVM dictionaries.

### Creation

```tolk
var m: map<int8, int32> = createEmptyMap();
var m = createEmptyMap<int8, int32>();
```

### Core Operations

```tolk
m.set(k, v)              // set a key-value pair
m.addIfNotExists(k, v)   // add only if key absent
m.replaceIfExists(k, v)  // update only if key exists
m.delete(k)              // remove an entry
m.exists(key)            // check key presence
m.isEmpty()              // check if empty
```

### Getting Values

```tolk
var r = m.get(1);
if (r.isFound) {
    val v = r.loadValue();
}

// Or throw if missing:
val v = m.mustGet(key);
```

### Iteration

```tolk
var r = m.findFirst();
while (r.isFound) {
    val key = r.getKey();
    val value = r.loadValue();
    r = m.iterateNext(r);
}
```

Additional iteration methods: `findFirst()`, `findLast()`, `findKeyGreater()`, `findKeyGreaterOrEqual()`, `findKeyLess()`, `findKeyLessOrEqual()`, `iterateNext()`, `iteratePrev()`.

### Key Constraints

Keys must be fixed-width and contain no references. Valid: `int32`, `address`, `bits256`, `Point`. Invalid: `int`, `coins`, `cell`.

### Value Constraints

Values must be serializable. Valid: `coins`, structs, `Cell<T>`. Invalid: `int`, `builder`.

### Complete Method Reference

- `createEmptyMap<K, V>(): map<K, V>`
- `createMapFromLowLevelDict<K, V>(d: dict): map<K, V>`
- `m.toLowLevelDict(): dict`
- `m.isEmpty(): bool`
- `m.exists(key: K): bool`
- `m.get(key: K): MapLookupResult<V>`
- `m.mustGet(key: K, throwIfNotFound: int = 9): V`
- `m.set(key: K, value: V): self`
- `m.setAndGetPrevious(key: K, value: V): MapLookupResult<V>`
- `m.replaceIfExists(key: K, value: V): bool`
- `m.replaceAndGetPrevious(key: K, value: V): MapLookupResult<V>`
- `m.addIfNotExists(key: K, value: V): bool`
- `m.addOrGetExisting(key: K, value: V): MapLookupResult<V>`
- `m.delete(key: K): bool`
- `m.deleteAndGetDeleted(key: K): MapLookupResult<V>`
- `m.findFirst() / m.findLast(): MapEntry<K, V>`
- `m.findKeyGreater/GreaterOrEqual/Less/LessOrEqual(pivotKey: K): MapEntry<K, V>`
- `m.iterateNext/iteratePrev(current: MapEntry<K, V>): MapEntry<K, V>`

### Set Emulation

```tolk
type Set<T> = map<T, ()>
```

### Stack Representation

Empty maps are TVM `NULL` (serialized as `0`); non-empty maps are TVM `CELL`s (serialized as `1` followed by a reference).

---

## Tensors

Tensors are multiple values placed sequentially on the stack. Syntax: `(T1, T2, T3)`.

```tolk
var (a, b) = (1, "hello");
```

---

## Tuples

Tuples are multiple values stored in a single TVM tuple. Syntax: `[T1, T2, T3]`.

```tolk
val t = [1, 2, 3];
t.push(4);
val first = t.get(0);
val size = t.size();
```

---

## Callables

First-class functions with syntax `(ParamTypes) -> ReturnType`:

```tolk
fun customRead(reader: (slice) -> int) { }
fun demo() {
    customRead(fun(s) { return s.loadUint(32) })
}
```

---

## Type Aliases

```tolk
type UserId = int
type ForwardPayloadRemainder = RemainingBitsAndRefs
```

Type aliases support custom serialization via `packToBuilder()` and `unpackFromSlice()` methods.

---

## Strings

TVM does not have a dedicated string type. Slices are used to encode string-like data.

### Raw String Literals

```tolk
"abcd"  // produces 4 bytes (97,98,99,100)
```

Limited to 127 ASCII characters due to cell size constraints.

### Compile-Time Functions

- `stringCrc32("...")` -- CRC32 checksum
- `stringCrc16("...")` -- CRC16 checksum
- `stringSha256("...")` -- SHA256 hash (uint256)
- `stringSha256_32("...")` -- SHA256 hash truncated to 32 bits
- `stringToBase256("...")` -- base-256 conversion
- `stringHexToSlice("...")` -- hex data to slice
- `address("...")` -- address from string

### Fixed-Size Strings

Use `bitsN` or `bytesN` types (N <= 1023 or 127 respectively).

### Snake Strings

Store data in chains of cells, with portions in current cells and remainders in reference cells.

---

## void and never

### void

Functions returning nothing have type `void`. In structures, void-typed fields are treated as non-existent.

### never

Functions that always throw have return type `never`. Emerges in unreachable code branches.

Neither type produces a value on the stack and occupies zero stack slots and zero bits.

---

## Generics

### Generic Structs

```tolk
struct Container<T> {
    element: T?
}
```

Generic structs exist only at the type level and incur no runtime cost.

### Default Type Arguments

```tolk
struct StrangeUnion<T1, T2 = null> { ... }
// StrangeUnion<int> means T2 = null
```

Type arguments cannot reference one another.

### Generic Type Aliases

```tolk
type Response<R, E> = Ok<R> | Err<E>
```

### Generic Methods

```tolk
fun Container<T>.getElement(self) {
    return self.element;
}
```

---

## Type Checks and Casts

### `is` and `!is` operators

```tolk
if (value is slice) { ... }
if (value !is null) { ... }
```

### `as` operator (unsafe cast)

```tolk
val x = someValue as int32;
```

### Smart Casts

After `is` checks or null checks, the compiler automatically narrows the type within that scope.
