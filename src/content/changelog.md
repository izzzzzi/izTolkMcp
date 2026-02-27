# Tolk Changelog

Tolk is a fork of FunC, first announced at TON Gateway in 2024, with v0.6 marking its initial release relative to FunC v0.5.

---

## v0.6 -- First Public Release

- Initial release of Tolk as a fork of FunC
- TypeScript/Rust/Kotlin-like syntax replacing C-like FunC syntax
- `fun` keyword for function declarations
- `val` and `var` for variable declarations
- `return` keyword required (no implicit last-expression return)
- Semicolons required between statements inside functions
- Removed `impure` keyword -- user function calls are not removed by the compiler
- Removed `~` tilde methods -- dot `.` syntax for all method calls
- Removed `method_id` -- replaced by `get fun` for getter declarations
- Alphanumeric-only identifiers (no more `2+2` as variable name)
- `import` statement for file includes
- `@stdlib` imports for standard library modules
- Basic type inference for variables and return types

## v0.7 -- Static Typing

- Full static typing system with clear and readable error messages
- Generic functions: `fun f<T>(value: T) { ... }`
- The `bool` type with `true`/`false` values
- Logical operators `&&`, `||`, `!` with short-circuit evaluation
- Type inference improvements
- Better compiler error messages with source locations

## v0.8 -- Compiler Improvements

- Improved type checking across function boundaries
- Enhanced error diagnostics
- Performance improvements in compilation

## v0.9 -- Nullable Types and Null Safety

- Nullable types: `int?`, `cell?`, etc.
- Smart type casting after null checks
- Unreachable code detection after `throw` statements
- Null safety enforcement by the compiler
- `T?` as shorthand for `T | null`

## v0.10 -- Fixed-Width Integers

- Fixed-width integer types: `int8`, `int32`, `uint64`, `uint256`, etc.
- The `coins` type for nanoToncoin values
- The `ton("0.05")` compile-time function
- Variable-width types: `varuint16`, `varuint32`, `varint16`, `varint32`
- Overflow checking during serialization

## v0.11 -- Union Types and Pattern Matching

- Union types: `A | B | C`
- `match` expression for pattern matching
- Exhaustive matching enforcement
- `is` and `!is` operators for type checking
- Smart casts after `is` checks

## v0.12 -- Structures and Methods

- `struct` keyword for defining data structures
- Field types, default values, `private` and `readonly` modifiers
- Methods: `fun Type.method(self) { ... }`
- Static methods: `fun Type.method() { ... }`
- `mutate self` for mutable instance methods
- Method declarations for any type including primitives
- Generic structs: `struct Container<T> { ... }`
- Automatic serialization with `toCell()` and `fromCell()`
- Serialization prefixes: `struct (0x12345678) MsgName { ... }`
- Short method naming conventions

## v0.13 -- Address Type and Auto-Packing

- The `address` type replacing raw slices for contract addresses
- `address?` for nullable addresses
- `any_address` for external address support
- `address("EQ...")` compile-time function
- Address comparison with `==` and `!=`
- `getWorkchain()` and `getWorkchainAndHash()` methods
- Auto-packing optimizations in message construction

## v1.0 -- Production Release

- The `lazy` keyword for on-demand field loading
- `lazy T.fromCell()` and `lazy T.fromSlice()` for deferred parsing
- Automatic function inlining at the compiler level
- Constant folding and dead code elimination
- Merging consecutive `builder.storeUint` calls
- Peephole and stack optimizations
- Gas efficiency improvements (30-50% reduction compared to FunC)
- TVM 11 compatibility
- Message handling: `onInternalMessage(in: InMessage)`
- `onBouncedMessage(in: InMessageBounced)` entrypoint
- `onExternalMessage` entrypoint
- `createMessage()` function for message composition
- `BounceMode` enum: `NoBounce`, `Only256BitsOfBody`, `RichBounce`, `RichBounceOnlyRootCell`
- `SEND_MODE_*` constants for message sending
- Contract storage: `contract.getData()`, `contract.setData()`
- `contract.getAddress()`, `contract.getCode()`
- `blockchain.now()`, `blockchain.logicalTime()`, `blockchain.configParam()`
- `Cell<T>` typed cell references
- `AutoDeployAddress` for contract deployment
- `ContractState` struct for code + data
- Standard library redesigned with descriptive naming

## v1.1 -- Maps and Enums

- `map<K, V>` native dictionary support
- Map methods: `set`, `get`, `delete`, `exists`, `isEmpty`, `mustGet`
- Map iteration: `findFirst`, `findLast`, `iterateNext`, `iteratePrev`
- Conditional iteration: `findKeyGreater`, `findKeyLess`, etc.
- `MapLookupResult<V>` with `isFound` and `loadValue()`
- `enum` type with auto-incrementing values
- Enum exhaustive matching
- Enum serialization as `(u)intN`
- Enum casting with `as`
- Field visibility controls: `private`, `readonly`
- Enhanced field access patterns

## v1.2 -- Borrow Checker and Rich Bounces

- Borrow checker for undefined-behavior detection
- Internal-only addresses support
- Rich bounces: return the full body instead of 256 bits
- `RichBounceBody.fromSlice()` for parsing rich bounce data
- `gasUsed`, `exitCode`, and failure details in bounced messages
- Anonymous function support (lambdas)
- First-class functions with `(ParamTypes) -> ReturnType` syntax
- Enhanced compiler diagnostics
- Additional standard library methods

---

## Standard Library Modules

### Always Available (`@stdlib/common.tolk`)

**Compile-time functions:**
- `address("...")` -- embed contract address
- `stringCrc32("...")` / `stringCrc16("...")` -- checksum
- `stringSha256("...")` / `stringSha256_32("...")` -- SHA256
- `stringToBase256("...")` -- base-256 conversion
- `stringHexToSlice("...")` -- hex to slice
- `ton("0.05")` -- nanoToncoin calculation

**Tuple operations:**
- `push()`, `get()`, `size()`, `toTuple()`, `fromTuple()`

**Math primitives:**
- `min()`, `max()`, `abs()`, `divMod()`, `mulDivFloor()`

**Contract state:**
- `contract.getAddress()`, `contract.getData()`, `contract.setData()`, `contract.getCode()`

**Blockchain getters:**
- `blockchain.now()`, `blockchain.logicalTime()`, `blockchain.configParam()`

**Crypto:**
- `cell.hash()`, `slice.hash()`, `isSignatureValid()`
- `random.uint256()`, `random.range()`

**Messages:**
- `createMessage()`, `createExternalLogMessage()`
- `sendRawMessage()`
- `SEND_MODE_REGULAR`, `SEND_MODE_PAY_FEES_SEPARATELY`, `SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE`, `SEND_MODE_BOUNCE_ON_ACTION_FAIL`, `SEND_MODE_IGNORE_ERRORS`

**Balance:**
- `reserveToncoinsOnBalance()`
- `acceptExternalMessage()`
- `commitContractDataAndActions()`

### Optional Modules (require import)

**`@stdlib/gas-payments`**
- `getGasConsumedAtTheMoment()`
- `calculateStorageFee()`

**`@stdlib/exotic-cells`**
- Exotic cell parsing, library references handling

**`@stdlib/lisp-lists`**
- Nested tuple-based list structures

**`@stdlib/tvm-dicts`**
- Low-level dictionary operations (for cases where `map<K,V>` is insufficient)

**`@stdlib/tvm-lowlevel`**
- Direct TVM register access, stack manipulation operations
