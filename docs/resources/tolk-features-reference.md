# Tolk Features Reference

> Source: https://docs.ton.org/languages/tolk/features/
> Detailed reference for Tolk language features: serialization, lazy loading, messages, storage, getters, and compiler optimizations.

---

## Automatic Serialization

All data in TON (messages, storage, etc.) is represented as cells. Tolk's type system enables automatic serialization through `fromCell` and `toCell` methods.

### Basic Usage

```tolk
struct Point {
    x: int8
    y: int8
}

fun demo() {
    val p = Point { x: 10, y: 20 };
    val c = p.toCell();           // serialize to cell
    val p2 = Point.fromCell(c);   // deserialize from cell
}
```

### Serialization Prefixes

Structs can define serialization prefixes, commonly 32-bit opcodes for messages:

```tolk
struct (0x7362d09c) TransferNotification {
    queryId: uint64
}
```

Prefixes support various bit widths: 32-bit, 16-bit, 3-bit, etc.

### Cell References

- `Cell<T>` -- typed references with known structure
- `cell` -- untyped references without structural description

Accessing nested fields requires loading:

```tolk
storage.royalty.load()
// or
RoyaltyParams.fromCell(storage.royalty)
```

### Custom Serializers

Type aliases enable custom encoding logic:

```tolk
type MyString = slice

fun MyString.packToBuilder(self, mutate b: builder) { }
fun MyString.unpackFromSlice(mutate s: slice) { }
```

### Error Handling

`Point.fromCell(c)` throws an exception if the cell does not contain the required data. Common failures include insufficient bits/refs, format inconsistencies, and opcode mismatches.

### Serialization Options

```tolk
MyMsg.fromCell(c, {
    assertEndAfterReading: true,
    throwIfOpcodeDoesNotMatch: 63
})
```

### Deserialization Functions

- `T.fromCell()` -- parses complete cell
- `T.fromSlice()` -- parses slice without mutation
- `slice.loadAny<T>()` -- mutates slice during parsing
- `slice.skipAny<T>()` -- skips type-sized data

### Size Limitations

The Tolk compiler issues a warning if a serializable struct may exceed 1023 bits. Solutions: suppress warnings, split into multiple cells, or extract fields into refs.

---

## Lazy Loading

The `lazy` keyword enables selective field loading. The compiler identifies which fields are accessed and loads only those, skipping the rest.

### Basic Usage

```tolk
val st = lazy Storage.fromCell(contract.getData());
return st.publicKey
// Compiler inserts: "skip 65 bits, preload uint256"
```

In practice, prefer `lazy T.fromCell()` over `T.fromCell()`.

### Referenced Cells

For nested structures, lazy loading applies at multiple levels:

```tolk
val storage = lazy Storage.load();
val content = lazy storage.content.load();
```

### Union Type Matching

No union is allocated on the stack upfront; matching and loading are deferred:

```tolk
val msg = lazy AllowedMessage.fromSlice(in.body);
match (msg) {
    CounterIncBy => { msg.byValue }    // only loads byValue
    CounterReset => { /* ... */ }
}
```

The `else` branch catches unmatched cases without throwing errors -- even input less than 32 bits, no "underflow" thrown.

### Partial Updates

During write-back, lazy loading preserves an "immutable tail" of unmodified fields, reusing it when reconstructing the cell.

### Field Skipping Strategy

- Fixed-size consecutive fields (`intN`, `bitsN`) are grouped into single skip instructions
- Variable-width fields (`coins`, `address`) require load-and-ignore operations

### Trade-offs

Gas consumption remains comparable to non-lazy versions. However, lazy loading accepts partially invalid input -- missing or extra data is tolerated if unused fields aren't accessed.

---

## Message Handling

### Internal Messages (`onInternalMessage`)

```tolk
fun onInternalMessage(in: InMessage) {
    in.senderAddress;
    in.valueCoins;
    in.originalForwardFee;
    // and other fields
}
```

### Message Routing Pattern

1. Define message structs with 32-bit opcode prefixes
2. Create union type of all allowed messages
3. Use `lazy` parsing with pattern matching

```tolk
struct (0x12345678) CounterIncBy {
    incBy: uint32
}

struct (0x00000000) CounterReset {}

type AllowedMessage = CounterIncBy | CounterReset

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    match (msg) {
        CounterIncBy => {
            // handle increment
        }
        CounterReset => {
            // handle reset
        }
        else => {
            if (in.body.isEmpty()) { return }
            throw 0xFFFF
        }
    }
}
```

### Bounced Message Handling (`onBouncedMessage`)

```tolk
fun onBouncedMessage(in: InMessageBounced) {
    // bounced messages arrive here
}
```

#### BounceMode Options

- `BounceMode.NoBounce` -- messages never bounce
- `BounceMode.Only256BitsOfBody` -- minimal data (0xFFFFFFFF prefix + 256 bits)
- `BounceMode.RichBounce` -- complete body with `gasUsed`, `exitCode`, failure details
- `BounceMode.RichBounceOnlyRootCell` -- similar but root cell only

For minimal bounces: `in.bouncedBody.skipBouncedPrefix()`
For rich bounces: `RichBounceBody.fromSlice()`

### External Messages (`onExternalMessage`)

```tolk
fun onExternalMessage(in: InExternalMessage) {
    // off-chain messages, commonly for wallet signature validation
    acceptExternalMessage();  // must call to increase available gas
}
```

### Additional Entrypoints

- `onTickTock` -- invoked on tick-tock transactions
- `onSplitPrepare` / `onSplitInstall` -- reserved for split/install transactions (currently unused)
- `main` -- for simple snippets with `method_id` 0

---

## Message Sending

### Basic Pattern

```tolk
val reply = createMessage({
    bounce: BounceMode.NoBounce,
    value: ton("0.05"),
    dest: senderAddress,
    body: RequestedInfo { ... }
});
reply.send(SEND_MODE_REGULAR);
```

### Destination Options

```tolk
struct CreateMessageOptions<TBody> {
    dest: address |             // send to an address
          builder |             // manually constructed builder
          (int8, uint256) |     // workchain + hash
          AutoDeployAddress     // deploy with auto-calculated address
}
```

### Value Options

```tolk
value: someTonAmount                    // simple coins
value: (someTonAmount, extraDict)       // with extra currencies
```

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

#### Shard-Based Deployment

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

#### Automatic Inline vs. Reference

- **Embedded:** less than 500 bits and 2 refs or fewer
- **Reference:** 500+ bits or more than 2 refs
- **Reference:** if body contains `builder` or `slice`

The decision is made at compile time. No runtime checks.

#### Force Inlining

```tolk
createMessage({
    body: UnsafeBodyNoRef {
        forceInline: contents,
    },
});
```

#### Empty Bodies

Omit the body field:

```tolk
createMessage({
    bounce: BounceMode.NoBounce,
    dest: somewhere,
    value: remainingBalance
});
```

#### Non-Struct Bodies

```tolk
val excessesMsg = createMessage({
   body: (0xd53276db as int32, input.queryId)
});
```

**Important:** Do not pass `body: obj.toCell()`. Pass `body: obj` and the compiler will choose optimal encoding.

### External Log Messages

```tolk
val emitMsg = createExternalLogMessage({
    dest: createAddressNone(),
    body: DepositEvent { ... }
});
emitMsg.send(SEND_MODE_REGULAR);
```

With topic for indexing:

```tolk
val emitMsg = createExternalLogMessage({
    dest: ExtOutLogBucket { topic: 123 },
    body: DepositData { ... }
});
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

### Default Values for Deployment

```tolk
struct WalletStorage {
    jettonBalance: coins = 0
    isFrozen: bool = false
    ownerAddress: address
    minterAddress: address
}
```

### Multi-Contract Projects

Use descriptively-named structs: `MinterStorage`, `WalletStorage`, placed in `storage.tolk`.

### Changing Storage Shape After Deployment

```tolk
// Detect initialization status via bits/refs counts
// Parse into appropriate struct based on state
```

---

## Contract Getters

### Declaration

```tolk
get fun currentOwner(): address {
    val storage = lazy Storage.load();
    return storage.ownerAddress;
}
```

### Naming

Use camelCase. For TEP compatibility, snake_case like `get fun get_wallet_data` is acceptable.

### Returning Structures

```tolk
struct JettonWalletDataReply {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
    jettonWalletCode: cell
}

get fun get_wallet_data(): JettonWalletDataReply {
    val storage = lazy WalletStorage.load();
    return {
        jettonBalance: storage.jettonBalance,
        ownerAddress: storage.ownerAddress,
        minterAddress: storage.minterAddress,
        jettonWalletCode: contract.getCode(),
    }
}
```

### Parameters

```tolk
get fun get_wallet_address(ownerAddress: address): address {
    // ...
}
```

### Method IDs

Getters are identified by `method_id = crc16(name) | 0x10000`, avoiding on-chain name storage.

---

## Compiler Optimizations

### Constant Folding

```tolk
fun calcSecondsInAYear() {
    val days = 365;
    val minutes = 60 * 24 * days;
    return minutes * 60;
}
// Compiles to: 31536000 PUSHINT
```

- If conditions and dead branches are eliminated at compile time
- Applies across inlining boundaries

### Merging Builder Operations

```tolk
b.storeUint(0, 1).storeUint(1, 1).storeUint(1, 1).storeUint(0, 1).storeUint(0, 2)
// Compiles to: b{011000} STSLICECONST
```

### Auto-Inline Functions

- Simple, small functions are always inlined
- Functions called only once are always inlined
- Uses weight calculation with threshold
- Supports any argument width
- Cannot inline: functions with mid-function returns, recursive functions

Manual control: `@inline`, `@noinline`, `@inline_ref`

### Peephole Optimizations

- `DUP + DUP` -> `2DUP`
- `N LDU + NIP` -> `N PLDU`
- `SWAP + N STU` -> `N STUR`
- Symmetric: `SWAP + EQUAL` -> `EQUAL`
- `0 EQINT + N THROWIF` -> `N THROWIFNOT`
- Ternary to `CONDSEL` replacement

### Output

The Tolk compiler outputs Fift assembler. Compiled output in `build/ContractName/` with `.fif` files.

---

## Assembler Functions

### Basic asm Function

```tolk
@pure
fun incThenNegate(v: int): int
    asm "INC" "NEGATE"
```

### Multi-line Assembly

```tolk
fun hashStateInit(code: cell, data: cell): uint256 asm """
    DUP2
    HASHCU
    ONE HASHEXT_SHA256
"""
```

### Stack Ordering

Arguments push in declared order. Use `asm(<INPUT_ORDER>)` and `asm(-> <RETURN_ORDER>)` for reordering.

### Best Practices

Use `asm` only for rarely used TVM instructions not covered by standard library. The `@pure` annotation indicates no state modifications.
