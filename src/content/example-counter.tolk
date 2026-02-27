// Counter Smart Contract -- Tolk v0.6 compatible example
//
// A minimal but complete counter contract demonstrating key Tolk patterns:
// - fun keyword for function declarations
// - val (immutable) and var (mutable) variables
// - get fun for getter methods
// - Manual cell serialization with beginCell()/beginParse()
// - getContractData()/setContractData() for persistent storage
// - Proper handling of empty messages and opcodes
//
// Compatible with tolk-js v0.6 (no struct auto-serialization)

// ============================================================
// Operation codes -- used to identify incoming message types
// ============================================================

const OP_INCREMENT = 1;
const OP_DECREMENT = 2;
const OP_RESET = 3;

// ============================================================
// Error codes -- should be between 64 and 2048
// ============================================================

const ERR_UNKNOWN_OP = 100;
const ERR_COUNTER_UNDERFLOW = 101;

// ============================================================
// Storage helpers -- manual cell serialization
// ============================================================

// Load the counter value from contract persistent storage.
// Storage layout: 32-bit signed integer (counter).
fun loadData(): int {
    val ds = getContractData().beginParse();
    return ds.loadInt(32);
}

// Save the counter value to contract persistent storage.
fun saveData(counter: int) {
    setContractData(
        beginCell()
            .storeInt(counter, 32)
            .endCell()
    );
}

// ============================================================
// Internal message handler -- main contract entrypoint
// ============================================================

// Called when the contract receives an internal message from another
// contract or wallet. Parameters follow the v0.6 convention:
//   myBalance  -- contract balance before this transaction
//   msgValue   -- value (in nanoTON) attached to this message
//   msgFull    -- full message cell (includes headers)
//   msgBody    -- message body slice (after headers)
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    // If the message body has fewer than 32 bits, it cannot contain
    // an operation code. Accept these as simple TON transfers.
    if (msgBody.remainingBitsCount() < 32) {
        return;
    }

    // Read the 32-bit operation code from the message body
    val op = msgBody.loadUint(32);

    // Load current counter from storage
    var counter = loadData();

    // Route by operation code
    if (op == OP_INCREMENT) {
        // Increment the counter by 1
        counter += 1;
        saveData(counter);
        return;
    }

    if (op == OP_DECREMENT) {
        // Decrement the counter by 1, but prevent going below zero
        assert(counter > 0, ERR_COUNTER_UNDERFLOW);
        counter -= 1;
        saveData(counter);
        return;
    }

    if (op == OP_RESET) {
        // Reset the counter to zero
        saveData(0);
        return;
    }

    // Unknown operation code -- throw an error
    throw ERR_UNKNOWN_OP;
}

// ============================================================
// Getter methods -- callable off-chain via lite-client / RPC
// ============================================================

// Returns the current counter value.
// Getters use `get fun` syntax (replaces FunC's method_id).
get fun counter(): int {
    return loadData();
}
