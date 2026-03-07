# Tolk Idioms and Conventions

> Source: https://docs.ton.org/languages/tolk/idioms-conventions
> Best practices and recommended patterns for Tolk smart contract development.

---

## Core Principles

### Prefer Automatic Serialization

Use structures with auto-serialization over manual slice/builder work. Express data with types to prevent bugs.

### Use Typed Cells

```tolk
struct Holder {
    extra: Cell<ExtraInfo>
}
```

### Use Lazy Loading

```tolk
get fun publicKey() {
    val st = lazy Storage.load();
    return st.publicKey
}
```

---

## Custom Serialization

Define type aliases for custom serialization logic:

```tolk
type MyString = slice

fun MyString.unpackFromSlice(mutate s: slice) {
    // custom deserialization
}

fun MyString.packToBuilder(self, mutate b: builder) {
    // custom serialization
}
```

Use synthetic fields for computed values loaded only when parsing (e.g., a "HashOfRemainder" field that validates signatures without manual hash calculations).

---

## Contract Storage Pattern

Structure contract storage as a regular struct with convenience `load()` and `save()` methods:

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

---

## Message Definitions

Express messages as structs with 32-bit opcode prefixes by convention:

```tolk
struct (0x12345678) CounterIncrement {
    incBy: uint32
}
```

---

## Message Handling Pattern

Use unions and pattern matching for efficient lazy loading:

```tolk
type AllowedMessage = CounterIncrement | CounterReset

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    match (msg) {
        CounterIncrement => { /* ... */ }
        CounterReset => { /* ... */ }
        else => {
            if (in.body.isEmpty()) { return }
            throw 0xFFFF
        }
    }
}
```

---

## Sending Messages

Use `createMessage()` with struct bodies:

```tolk
val reply = createMessage({
    bounce: BounceMode.NoBounce,
    value: ton("0.05"),
    dest: senderAddress,
    body: RequestedInfo { ... }
});
reply.send(SEND_MODE_REGULAR);
```

---

## Contract Deployment

Attach initial code and data to deployment messages. Extract `StateInit` generation into separate functions for reusability:

```tolk
fun calcDeployedWallet(owner: address): AutoDeployAddress {
    return {
        stateInit: {
            code: walletCode,
            data: WalletStorage { ownerAddress: owner }.toCell()
        }
    }
}
```

Target specific shards when deploying sibling contracts:

```tolk
dest: {
    stateInit: walletInitialState,
    toShard: {
        closeTo: ownerAddress,
        fixedPrefixLength: 8
    }
}
```

---

## Event Logging

Emit events using external log messages for off-chain indexing:

```tolk
val emitMsg = createExternalLogMessage({
    dest: createAddressNone(),
    body: DepositEvent { ... }
});
emitMsg.send(SEND_MODE_REGULAR);
```

---

## Getters

Return structures from getters instead of unnamed tuples:

```tolk
struct JettonWalletDataReply {
    jettonBalance: coins
    ownerAddress: address
}

get fun get_wallet_data(): JettonWalletDataReply {
    val storage = lazy WalletStorage.load();
    return {
        jettonBalance: storage.jettonBalance,
        ownerAddress: storage.ownerAddress,
    }
}
```

---

## Input Validation

Use assertions after parsing messages:

```tolk
assert (msg.seqno == storage.seqno) throw E_INVALID_SEQNO;
assert (in.senderAddress == storage.ownerAddress) throw ERR_NOT_FROM_OWNER;
```

---

## Project Organization

Organize projects with dedicated files:

```
project/
  errors.tolk       -- Error code constants (or enum)
  storage.tolk       -- Storage struct definitions
  messages.tolk      -- Message struct definitions
  utils.tolk         -- Utility functions
  contract.tolk      -- Main contract entrypoint (minimal)
```

---

## Functions and Methods

Prefer methods over functions to avoid namespace collisions:

```tolk
fun Struct1.validate(self) { }
fun Auction.createFrom(config: cell, minBid: coins) { }
```

Use optional addresses (`address?`) for nullable address fields where `null` represents "none".

---

## Compile-Time Calculations

```tolk
const crc32 = stringCrc32("some_str")
const hash = stringSha256("some_crypto_key")
const ADMIN = address("EQ...")
const FEE = ton("0.05")
```

---

## Encoding Conventions

- Use fixed-size `bitsN` for predefined-length data
- Use snake strings for variable-length data
- Use `RemainingBitsAndRefs` as the last field for forward payloads

---

## Optimization Advice

Avoid micro-optimization. The compiler auto-inlines, reduces allocations, and handles optimizations. Prioritize readability over manual optimization attempts.

- The compiler merges consecutive `storeUint` calls
- Small functions are auto-inlined at no extra gas cost
- Constant folding eliminates dead branches
- Lazy loading skips unused fields automatically
