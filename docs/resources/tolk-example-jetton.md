# Tolk Example: Jetton (Fungible Token) Contract

> Source: https://github.com/ton-blockchain/tolk-bench/tree/master/contracts_Tolk/01_jetton
> A complete, production-grade Jetton (TEP-74) implementation in Tolk.
> This contract achieves 33-41% gas savings compared to the equivalent FunC implementation.

---

## File Structure

```
01_jetton/
  errors.tolk                  -- Error code constants
  fees-management.tolk         -- Gas/fee constants
  storage.tolk                 -- Storage struct definitions
  messages.tolk                -- Message struct definitions with opcodes
  jetton-utils.tolk            -- Utility functions for wallet address calculation
  jetton-wallet-contract.tolk  -- Jetton wallet contract (per-user)
  jetton-minter-contract.tolk  -- Jetton minter contract (central)
```

---

## errors.tolk

```tolk
// these error codes are quite strange, but they are exactly the same as in FunC implementation

const ERR_INVALID_OP = 709
const ERR_NOT_FROM_ADMIN = 73
const ERR_UNAUTHORIZED_BURN = 74
const ERR_NOT_ENOUGH_AMOUNT_TO_RESPOND = 75
const ERR_NOT_FROM_OWNER = 705
const ERR_NOT_ENOUGH_TON = 709
const ERR_NOT_ENOUGH_GAS = 707
const ERR_INVALID_WALLET = 707
const ERR_WRONG_WORKCHAIN = 333
const ERR_NOT_ENOUGH_BALANCE = 706
const ERR_INVALID_PAYLOAD = 708
```

---

## fees-management.tolk

```tolk
// 6905(computational_gas_price) * 1000(cur_gas_price) = 6905000 ~= 0.01 TON
const MINIMAL_MESSAGE_VALUE_BOUND = ton("0.01")

const MIN_TONS_FOR_STORAGE = ton("0.01")

const JETTON_WALLET_GAS_CONSUMPTION = ton("0.015")
```

---

## storage.tolk

```tolk
struct WalletStorage {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

struct MinterStorage {
    totalSupply: coins
    adminAddress: address
    content: cell
    jettonWalletCode: cell
}


fun MinterStorage.load() {
    return MinterStorage.fromCell(contract.getData())
}

fun MinterStorage.save(self) {
    contract.setData(self.toCell())
}


fun WalletStorage.load() {
    return WalletStorage.fromCell(contract.getData())
}

fun WalletStorage.save(self) {
    contract.setData(self.toCell())
}
```

---

## messages.tolk

```tolk
type ForwardPayloadRemainder = RemainingBitsAndRefs

struct (0x0f8a7ea5) AskToTransfer {
    queryId: uint64
    jettonAmount: coins
    transferRecipient: address
    sendExcessesTo: address?
    customPayload: cell?
    forwardTonAmount: coins
    forwardPayload: ForwardPayloadRemainder
}

struct (0x7362d09c) TransferNotificationForRecipient {
    queryId: uint64
    jettonAmount: coins
    transferInitiator: address?
    forwardPayload: ForwardPayloadRemainder
}

struct (0x178d4519) InternalTransferStep {
    queryId: uint64
    jettonAmount: coins
    transferInitiator: address? // is null when minting (not initiated by another wallet)
    sendExcessesTo: address?
    forwardTonAmount: coins
    forwardPayload: ForwardPayloadRemainder
}

struct (0xd53276db) ReturnExcessesBack {
    queryId: uint64
}

struct (0x595f07bc) AskToBurn {
    queryId: uint64
    jettonAmount: coins
    sendExcessesTo: address?
    customPayload: cell?
}

struct (0x7bdd97de) BurnNotificationForMinter {
    queryId: uint64
    jettonAmount: coins
    burnInitiator: address
    sendExcessesTo: address?
}

struct (0x2c76b973) RequestWalletAddress {
    queryId: uint64
    ownerAddress: address
    includeOwnerAddress: bool
}

struct (0xd1735400) ResponseWalletAddress {
    queryId: uint64
    jettonWalletAddress: address?
    ownerAddress: Cell<address>?
}

struct (0x00000015) MintNewJettons {
    queryId: uint64
    mintRecipient: address
    tonAmount: coins
    internalTransferMsg: Cell<InternalTransferStep>
}

struct (0x00000003) ChangeMinterAdmin {
    queryId: uint64
    newAdminAddress: address
}

struct (0x00000004) ChangeMinterContent {
    queryId: uint64
    newContent: cell
}
```

---

## jetton-utils.tolk

```tolk
import "storage"

fun calcDeployedJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell): AutoDeployAddress {
    val emptyWalletStorage: WalletStorage = {
        jettonBalance: 0,
        ownerAddress,
        minterAddress,
    };

    return {
        stateInit: {
            code: jettonWalletCode,
            data: emptyWalletStorage.toCell()
        }
    }
}

fun calcAddressOfJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell) {
    val jwDeployed = calcDeployedJettonWallet(ownerAddress, minterAddress, jettonWalletCode);
    return jwDeployed.calculateAddress()
}
```

---

## jetton-wallet-contract.tolk

```tolk
import "@stdlib/gas-payments"
import "errors"
import "jetton-utils"
import "messages"
import "fees-management"
import "storage"

type AllowedMessageToWallet =
    | AskToTransfer
    | AskToBurn
    | InternalTransferStep

type BounceOpToHandle = InternalTransferStep | BurnNotificationForMinter

fun onBouncedMessage(in: InMessageBounced) {
    in.bouncedBody.skipBouncedPrefix();

    val msg = lazy BounceOpToHandle.fromSlice(in.bouncedBody);
    val restoreAmount = match (msg) {
        InternalTransferStep => msg.jettonAmount,
        BurnNotificationForMinter => msg.jettonAmount,
    };

    var storage = lazy WalletStorage.load();
    storage.jettonBalance += restoreAmount;
    storage.save();
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessageToWallet.fromSlice(in.body);

    match (msg) {
        InternalTransferStep => {
            var storage = lazy WalletStorage.load();
            if (in.senderAddress != storage.minterAddress) {
                assert (in.senderAddress == calcAddressOfJettonWallet(msg.transferInitiator!, storage.minterAddress, contract.getCode())) throw ERR_INVALID_WALLET;
            }
            storage.jettonBalance += msg.jettonAmount;
            storage.save();

            var msgValue = in.valueCoins;
            var tonBalanceBeforeMsg = contract.getOriginalBalance() - msgValue;
            var storageFee = MIN_TONS_FOR_STORAGE - min(tonBalanceBeforeMsg, MIN_TONS_FOR_STORAGE);
            msgValue -= (storageFee + JETTON_WALLET_GAS_CONSUMPTION);

            if (msg.forwardTonAmount) {
                msgValue -= (msg.forwardTonAmount + in.originalForwardFee);

                val notifyOwnerMsg = createMessage({
                    bounce: BounceMode.NoBounce,
                    dest: storage.ownerAddress,
                    value: msg.forwardTonAmount,
                    body: TransferNotificationForRecipient {
                        queryId: msg.queryId,
                        jettonAmount: msg.jettonAmount,
                        transferInitiator: msg.transferInitiator,
                        forwardPayload: msg.forwardPayload
                    }
                });
                notifyOwnerMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
            }

            if (msg.sendExcessesTo != null & (msgValue > 0)) {
                val excessesMsg = createMessage({
                    bounce: BounceMode.NoBounce,
                    dest: msg.sendExcessesTo!,
                    value: msgValue,
                    body: ReturnExcessesBack {
                        queryId: msg.queryId
                    }
                });
                excessesMsg.send(SEND_MODE_IGNORE_ERRORS);
            }
        }

        AskToTransfer => {
            assert (msg.forwardPayload.remainingBitsCount()) throw ERR_INVALID_PAYLOAD;
            assert (msg.transferRecipient.getWorkchain() == BASECHAIN) throw ERR_WRONG_WORKCHAIN;

            var storage = lazy WalletStorage.load();
            assert (in.senderAddress == storage.ownerAddress) throw ERR_NOT_FROM_OWNER;
            assert (storage.jettonBalance >= msg.jettonAmount) throw ERR_NOT_ENOUGH_BALANCE;
            storage.jettonBalance -= msg.jettonAmount;
            storage.save();

            var forwardedMessagesCount = msg.forwardTonAmount ? 2 : 1;
            assert (in.valueCoins >
                msg.forwardTonAmount +
                forwardedMessagesCount * in.originalForwardFee +
                (2 * JETTON_WALLET_GAS_CONSUMPTION + MIN_TONS_FOR_STORAGE)
            ) throw ERR_NOT_ENOUGH_TON;

            val deployMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: calcDeployedJettonWallet(msg.transferRecipient, storage.minterAddress, contract.getCode()),
                value: 0,
                body: InternalTransferStep {
                    queryId: msg.queryId,
                    jettonAmount: msg.jettonAmount,
                    transferInitiator: storage.ownerAddress,
                    sendExcessesTo: msg.sendExcessesTo,
                    forwardTonAmount: msg.forwardTonAmount,
                    forwardPayload: msg.forwardPayload,
                }
            });
            deployMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        AskToBurn => {
            var storage = lazy WalletStorage.load();
            assert (in.senderAddress == storage.ownerAddress) throw ERR_NOT_FROM_OWNER;
            assert (storage.jettonBalance >= msg.jettonAmount) throw ERR_NOT_ENOUGH_BALANCE;
            storage.jettonBalance -= msg.jettonAmount;
            storage.save();

            val notifyMinterMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: storage.minterAddress,
                value: 0,
                body: BurnNotificationForMinter {
                    queryId: msg.queryId,
                    jettonAmount: msg.jettonAmount,
                    burnInitiator: storage.ownerAddress,
                    sendExcessesTo: msg.sendExcessesTo,
                }
            });
            notifyMinterMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE | SEND_MODE_BOUNCE_ON_ACTION_FAIL);
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}


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

---

## jetton-minter-contract.tolk

```tolk
import "@stdlib/gas-payments"
import "errors"
import "jetton-utils"
import "messages"
import "storage"
import "fees-management"

type AllowedMessageToMinter =
    | MintNewJettons
    | BurnNotificationForMinter
    | RequestWalletAddress
    | ChangeMinterAdmin
    | ChangeMinterContent

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessageToMinter.fromSlice(in.body);

    match (msg) {
        BurnNotificationForMinter => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == calcAddressOfJettonWallet(msg.burnInitiator, contract.getAddress(), storage.jettonWalletCode)) throw ERR_UNAUTHORIZED_BURN;

            storage.totalSupply -= msg.jettonAmount;
            storage.save();

            if (msg.sendExcessesTo == null) {
                return;
            }

            val excessesMsg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: msg.sendExcessesTo,
                value: 0,
                body: ReturnExcessesBack {
                    queryId: msg.queryId
                }
            });
            excessesMsg.send(SEND_MODE_IGNORE_ERRORS + SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        RequestWalletAddress => {
            assert (in.valueCoins > in.originalForwardFee + MINIMAL_MESSAGE_VALUE_BOUND) throw ERR_NOT_ENOUGH_AMOUNT_TO_RESPOND;

            var respondOwnerAddress: Cell<address>? = msg.includeOwnerAddress
                ? msg.ownerAddress.toCell()
                : null;

            var walletAddress: address? = null;
            if (msg.ownerAddress.getWorkchain() == BASECHAIN) {
                var storage = lazy MinterStorage.load();
                walletAddress = calcAddressOfJettonWallet(msg.ownerAddress, contract.getAddress(), storage.jettonWalletCode);
            }

            val respondMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: in.senderAddress,
                value: 0,
                body: ResponseWalletAddress {
                    queryId: msg.queryId,
                    jettonWalletAddress: walletAddress,
                    ownerAddress: respondOwnerAddress,
                }
            });
            respondMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        MintNewJettons => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;

            var internalTransferMsg = lazy msg.internalTransferMsg.load();
            storage.totalSupply += internalTransferMsg.jettonAmount;
            storage.save();

            val deployMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: calcDeployedJettonWallet(msg.mintRecipient, contract.getAddress(), storage.jettonWalletCode),
                value: msg.tonAmount,
                body: msg.internalTransferMsg,
            });
            deployMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
        }

        ChangeMinterAdmin => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            storage.adminAddress = msg.newAdminAddress;
            storage.save();
        }

        ChangeMinterContent => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            storage.content = msg.newContent;
            storage.save();
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}


struct JettonDataReply {
    totalSupply: int
    mintable: bool
    adminAddress: address
    jettonContent: cell
    jettonWalletCode: cell
}

get fun get_jetton_data(): JettonDataReply {
    val storage = lazy MinterStorage.load();

    return {
        totalSupply: storage.totalSupply,
        mintable: true,
        adminAddress: storage.adminAddress,
        jettonContent: storage.content,
        jettonWalletCode: storage.jettonWalletCode,
    }
}

get fun get_wallet_address(ownerAddress: address): address {
    val storage = lazy MinterStorage.load();
    return calcAddressOfJettonWallet(ownerAddress, contract.getAddress(), storage.jettonWalletCode);
}
```

---

## Key Patterns Demonstrated

### 1. Project Organization
- Separate files for errors, fees, storage, messages, and contracts
- Shared code (messages, storage) imported by both wallet and minter contracts

### 2. Message Structs with Opcodes
- Every message has a 32-bit opcode prefix: `struct (0x0f8a7ea5) AskToTransfer { ... }`
- `RemainingBitsAndRefs` used for forward payload (must be last field)

### 3. Union Types for Message Routing
- `type AllowedMessageToWallet = AskToTransfer | AskToBurn | InternalTransferStep`
- Lazy parsing: `val msg = lazy AllowedMessage.fromSlice(in.body)`
- Pattern matching with `match`

### 4. Storage Pattern
- Static `load()` method using `fromCell(contract.getData())`
- Instance `save(self)` method using `contract.setData(self.toCell())`
- Always use `lazy` when loading storage

### 5. Contract Deployment
- `calcDeployedJettonWallet` returns `AutoDeployAddress` with `stateInit`
- `calculateAddress()` to pre-compute deployed address
- Deploy via `createMessage` with `dest: AutoDeployAddress`

### 6. Bounce Handling
- Separate `onBouncedMessage` handler
- Restore balances on bounced transfers and burns

### 7. Access Control
- `assert (in.senderAddress == storage.ownerAddress) throw ERR_NOT_FROM_OWNER`
- Wallet address verification via recalculation

### 8. Gas Management
- Fee constants for storage and gas consumption
- Calculate available message value after fees
- Use appropriate send modes (`SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE`, etc.)
