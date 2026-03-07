# Tolk Language Guide

> Source: https://docs.ton.org/languages/tolk/
> Comprehensive reference for the Tolk smart contract language on TON.

---

## Overview

Tolk is a statically typed language for writing smart contracts on TON. It provides declarative data structures, automatic cell serialization, and message handling primitives. The language compiles to TVM and provides direct control over execution.

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

### Key Features

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

// Symbols from `another-file.tolk` become available in this file.
```

In most workflows, the IDE adds imports automatically. For example, when selecting an item from auto-completion.

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

In projects with multiple contracts, each contract file serves as a separate compilation target. Since contract files don't import one another, duplicate declarations like `onInternalMessage` or `get fun` across different contracts don't conflict. The shared codebase (messages, storage, utilities) is imported by each contract file as needed.

---

## Structures

A struct `Point` holding two 8-bit integers:

```tolk
struct Point {
    x: int8
    y: int8
}

fun demo() {
    // create an object
    val p1: Point = { x: 10, y: 20 };

    // the same, type of p2 is auto-inferred
    val p2 = Point { x: 10, y: 20 };
}
```

- Methods are declared as `fun Point.method(self)`.
- Fields can use any types: numeric, cell, union, and others.
- Fields can define default values: `x: int8 = 0`.
- Fields can be `private` and `readonly`.
- Structs can be generic: `struct Wrapper<T> { ... }`.

### Object Creation

When context makes the type evident, use `{ ... }` syntax:

```tolk
fun demo() {
    var o1: Demo = { customData: someTuple };
    o1.someMethod();
    Demo{customData: someTuple}.someMethod();
}
```

Shorthand syntax like `{ a, b }` expands to `{ a: a, b: b }`, mirroring TypeScript object shorthand.

### Default Values

Fields with defaults can be omitted from literals:

```tolk
struct DefDemo {
    f1: int = 0
    f2: int? = null
    f3: (int, coins) = (0, ton("0.05"))
}
```

### Field Access Controls

- `private` -- accessible only within methods
- `readonly` -- immutable after object creation

Objects with private fields can only be constructed by static methods or assembler functions.

### Serialization Prefixes

The syntax `struct (PREFIX) Name { ... }` specifies serialization prefixes for message structs:

```tolk
struct (0x7362d09c) TransferNotification {
    queryId: uint64
}
```

Prefixes support various bit widths: hexadecimal (`0x7362d09c`), binary (`0b010`), and others.

### Auto-Serialization

If all fields are serializable, a struct can be automatically serialized:

```tolk
// makes a cell containing hex "0A14"
val c = p1.toCell();
// back to { x: 10, y: 20 }
val p3 = Point.fromCell(c);
```

### Generic Structs

Generic structs incur no runtime cost:

```tolk
struct Container<T> {
    element: T?
}

struct Nothing

type Wrapper<T> = Nothing | Container<T>
```

---

## Functions

A function that returns the sum of two integers:

```tolk
fun sum(a: int, b: int): int {
    return a + b;
}
```

- Parameter types are mandatory.
- The return type can be omitted: it is auto-inferred.
- Parameters can define default values: `fun f(b: int = 0)`
- Statements in a block are separated by semicolons `;`.
- Generic functions are supported: `fun f<T>(value: T) { ... }`
- Assembler functions are supported: `fun f(...): int asm "..."`

### Generic Functions

Generic functions accept type parameters that are automatically inferred:

```tolk
fun duplicate<T>(value: T): (T, T) { }
```

Type arguments can be explicit (`duplicate<int>(1)`) or inferred from context. Multiple type parameters and defaults are supported.

### Function Attributes

- `@inline` -- forces inlining
- `@noinline` -- prevents inlining
- `@inline_ref` -- preserves inline references for rarely executed paths
- `@pure` -- indicates the function avoids state modifications and exceptions
- `@deprecated` -- marks a function as deprecated

### Anonymous Functions (Lambdas)

Tolk supports first-class functions and lambdas for callbacks:

```tolk
fun customRead(reader: (slice) -> int) { }
fun demo() {
    customRead(fun(s) { return s.loadUint(32) })
}
```

---

## Methods

A function declared as `fun <receiver>.name(...)` is a method.

- If the first parameter is `self`, it's an instance method.
- If the first parameter is not `self`, it's a static method.

```tolk
// `self` -- instance method (invoked on a value)
fun Point.sumCoords(self) {
    return sum(self.x, self.y);
}

// not `self` -- static method
fun Point.createZero(): Point {
    return { x: 0, y: 0 };
}

fun demo() {
    val p = Point.createZero();    // { 0, 0 }
    return p.sumCoords();          // 0
}
```

By default, `self` is immutable; `mutate self` allows modifying the object.

Methods can be declared for any type, including primitives:

```tolk
fun int.isNegative(self) {
    return self < 0
}
```

### Mutability and Method Chaining

Use `mutate self` to allow modifications. Methods can return `self` to enable chaining:

```tolk
fun builder.myStoreInt32(mutate self, v: int): self {
    self.storeInt(v, 32);
    return self;
}
```

### Generic Methods

Methods for generic types treat unknown symbols in the receiver as type parameters:

```tolk
fun Pair<A, B>.compareFirst(self, rhs: A) { }
```

---

## Variables

Within functions, variables are declared with `val` or `var` keywords.

### val (immutable)

```tolk
val coeff = 5;
// cannot change its value, `coeff += 1` is an error
```

### var (mutable)

```tolk
var x = 5;
x += 1;      // now 6
```

### Explicit Type

```tolk
var x: int8 = 5;
```

### Multiple Variables (Tensor Destructuring)

```tolk
var (a, b) = (1, "");
```

### Global Variables

Declaring variables at the top level, outside functions, is supported using the `global` keyword. Avoid globals when possible. Uninitialized globals hold TVM `NULL` and cause runtime failures if accessed improperly.

---

## Constants

Constants can be declared only at the top level, not inside functions:

```tolk
const ONE = 1
const MAX_AMOUNT = ton("0.05")
const ADMIN_ADDRESS = address("EQ...")
```

The right-hand side must be a constant expression: numbers, const literals, compile-time functions, etc.

To group integer constants, enums are useful.

---

## Value Semantics and Mutability

Tolk follows value semantics: assignments create independent copies, and function calls do not mutate arguments unless explicitly specified.

```tolk
var a = Point { x: 1, y: 2 };
var b = a;   // `b` is a copy
b.x = 99;    // `a.x` remains 1
someFn(a);   // pass a copy; `a` will not change

// but there can be mutating functions, called this way:
anotherFn(mutate a);
```

### The `mutate` Parameter

The `mutate` keyword must appear at both the function definition and call site:

```tolk
fun increment(mutate x: int) {
    x += 1;
}

var n = 5;
increment(mutate n);  // n is now 6
```

Tolk transforms mutating parameters into implicit return values through the stack.

---

## Semicolons

- Semicolons are optional at the top level, after imports, aliases, etc.
- Semicolons are required between statements in a function.
- After the last statement in a block, a semicolon is optional.

```tolk
// optional at the top-level
const ONE = 1
type UserId = int

// required inside functions
fun demo() {
    val x = 5;
    val y = 6;
    return x + y    // optional after the last statement
}
```

---

## Comments

```tolk
// This is a single-line comment

/* This is a block comment
   across multiple lines. */

const TWO = 1 /* + 100 */ + 1    // 2
```

---

## Conditional Operators

`if` is a statement. `else if` and `else` blocks are optional.

```tolk
fun sortNumbers(a: int, b: int) {
    if (a > b) {
        return (b, a)
    } else {
        return (a, b)
    }
}
```

A ternary operator is also available:

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

Union types allow a variable to hold one of several possible types:

```tolk
fun processValue(value: int | slice) {
    match (value) {
        int => {
            value * 2
        }
        slice => {
            value.loadUint(8)
        }
    }
}
```

### Testing with `is` / `!is`

```tolk
fun processValue(value: int | slice) {
    if (value is slice) {
        return;
    }
    // value is `int`
    return value * 2;
}
```

### Match Exhaustiveness

A `match` on a union must be exhaustive: all alternatives must be covered. The `else` keyword is prohibited for unions but allowed in lazy matching contexts.

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

- Unions automatically flatten, so nested unions resolve into single-level types
- `T | null` is abbreviated as `T?` for nullable types
- Any types can combine: `int | slice`, `address | Point | null`, `int8 | int16 | int32 | int64`
- Assignment between unions follows subtype relationships; a `B | C` value can be assigned to `A | B | C | D`

---

## While Loop

Tolk does not have a `for` loop; use `while` loop for repeated execution.

```tolk
while (i > 0) {
    // ...
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

**Note:** The keywords `break` and `continue` are not supported.

---

## Iterate Over a Map

```tolk
fun iterateOverMap(m: map<int32, Point>) {
    var r = m.findFirst();
    while (r.isFound) {
        // ...
        r = m.iterateNext(r);
    }
}
```

---

## Exceptions

### Error Code Definition

```tolk
enum ErrCode {
    LowBalance = 200,
    SignatureMismatch,    // implicitly 201
}
```

Error codes should fall between 64 and 2048, as lower values are reserved by TVM and higher values cost more gas.

### Throw

```tolk
throw ERR_CODE;
throw (ERR_CODE, errArg);  // throw with argument
```

### Assert

```tolk
assert (balance > 0) throw ERROR_NO_BALANCE;
```

### Try-Catch

```tolk
try {
    // protected code
} catch (errCode) {
    // handle error
}

// Extended form with arguments:
try {
    throw (ERR_LOW_BALANCE, 555);
} catch (errCode, arg) {
    val data = arg as int;    // 555
}
```

**Critical caveat:** Any error inside a `try` block reverts all changes made within. TVM restores local variables and control registers to the state before entering `try`. However, gas consumption and codepage settings are not rolled back.

---

## Send a Message

```tolk
val reply = createMessage({
    bounce: BounceMode.NoBounce,
    value: ton("0.05"),
    dest: someAddress,
    body: RequestedInfo { ... }
});
reply.send(SEND_MODE_REGULAR);
```

---

## Contract Getters

```tolk
get fun currentOwner() {
    val storage = lazy Storage.load();
    return storage.ownerAddress;
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
6. `as is !is` -- Type operators (casting, union checking)
7. `* / % ^/ ~/` -- Multiplicative (257-bit precision)
8. `+ -` -- Additive
9. `<< >> ^>> ~>>` -- Bitwise shifts with ceiling and rounding variants
10. `== < > <= >= != <=>` -- Comparison (includes spaceship operator)
11. `& | ^` -- Bitwise AND, OR, XOR
12. `&& ||` -- Logical (short-circuit)
13. `= += -= ...` -- Assignment
14. `? :` -- Ternary

**Unsupported:** `i++` and `i--`. Use `i += 1` and `i -= 1` instead.
