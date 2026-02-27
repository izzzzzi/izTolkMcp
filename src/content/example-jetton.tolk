// Simplified Jetton Minter -- Tolk v0.6 compatible
// TEP-74 minter showing: multi-field storage, opcodes, minting, getters.
// Uses manual cell serialization (compatible with tolk-js v0.6).
// Based on: https://github.com/ton-blockchain/tolk-bench

import "@stdlib/tvm-dicts"

// Operation codes (TEP-74 standard)
const OP_MINT = 0x00000015;
const OP_BURN_NOTIFICATION = 0x7bdd97de;
const OP_CHANGE_ADMIN = 0x00000003;

// Error codes
const ERR_NOT_ADMIN = 73;
const ERR_UNAUTHORIZED_BURN = 74;
const ERR_UNKNOWN_OP = 0xFFFF;

// Storage layout: totalSupply(coins) | adminAddr(267b) | content(ref) | walletCode(ref)
fun loadMinterData(): (int, slice, cell, cell) {
    val ds = getContractData().beginParse();
    return (ds.loadCoins(), ds.loadAddress(), ds.loadRef(), ds.loadRef());
}

fun saveMinterData(totalSupply: int, adminAddress: slice, content: cell, walletCode: cell) {
    setContractData(beginCell()
        .storeCoins(totalSupply).storeAddress(adminAddress)
        .storeRef(content).storeRef(walletCode).endCell());
}

// Build initial data cell for a jetton wallet (balance=0)
fun buildWalletData(owner: slice, minter: slice): cell {
    return beginCell().storeCoins(0).storeAddress(owner).storeAddress(minter).endCell();
}

// Calculate StateInit cell for a jetton wallet
fun calcWalletStateInit(owner: slice, minter: slice, code: cell): cell {
    return beginCell()
        .storeUint(0, 2)       // split_depth + special
        .storeUint(1, 1).storeRef(code)                    // code
        .storeUint(1, 1).storeRef(buildWalletData(owner, minter))  // data
        .storeUint(0, 1)       // no libraries
        .endCell();
}

// Calculate address from StateInit cell (workchain 0)
fun calcWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3).storeInt(0, 8).storeUint(stateInit.hash(), 256)
        .endCell().beginParse();
}

// Helper: wrap an address slice as minter address parameter
fun asMinterAddr(addr: slice): slice {
    return beginCell().storeAddress(addr).endCell().beginParse();
}

// Main entrypoint
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    if (msgBody.remainingBitsCount() < 32) {
        return;  // accept simple transfers
    }

    // Parse sender from full message
    val cs = msgFull.beginParse();
    cs.loadUint(4);  // skip flags
    val sender = cs.loadAddress();

    val op = msgBody.loadUint(32);
    val queryId = msgBody.loadUint(64);
    var (totalSupply, adminAddress, content, walletCode) = loadMinterData();

    // Mint new tokens (admin only)
    if (op == OP_MINT) {
        assert(sender.bitsEqual(adminAddress), ERR_NOT_ADMIN);
        val mintTo = msgBody.loadAddress();
        val tonAmount = msgBody.loadCoins();
        val mintBody = msgBody.loadRef();

        // Read jetton amount from mint body to update supply
        val mbs = mintBody.beginParse();
        mbs.loadUint(32);  // skip op
        mbs.loadUint(64);  // skip queryId
        totalSupply += mbs.loadCoins();
        saveMinterData(totalSupply, adminAddress, content, walletCode);

        // Deploy wallet and send internal transfer
        val si = calcWalletStateInit(mintTo, asMinterAddr(sender), walletCode);
        val msg = beginCell()
            .storeUint(0x18, 6)
            .storeAddress(calcWalletAddress(si))
            .storeCoins(tonAmount)
            .storeUint(4 + 2 + 1, 1 + 4 + 4 + 64 + 32 + 1 + 1 + 1)
            .storeRef(si).storeRef(mintBody)
            .endCell();
        sendRawMessage(msg, 1);
        return;
    }

    // Burn notification (from wallet contract)
    if (op == OP_BURN_NOTIFICATION) {
        val jettonAmount = msgBody.loadCoins();
        val burnInitiator = msgBody.loadAddress();
        val expected = calcWalletStateInit(burnInitiator, asMinterAddr(adminAddress), walletCode);
        assert(sender.bitsEqual(calcWalletAddress(expected)), ERR_UNAUTHORIZED_BURN);
        totalSupply -= jettonAmount;
        saveMinterData(totalSupply, adminAddress, content, walletCode);
        return;
    }

    // Change admin address (admin only)
    if (op == OP_CHANGE_ADMIN) {
        assert(sender.bitsEqual(adminAddress), ERR_NOT_ADMIN);
        saveMinterData(totalSupply, msgBody.loadAddress(), content, walletCode);
        return;
    }

    throw ERR_UNKNOWN_OP;
}

// Getter: standard jetton data (totalSupply, mintable, admin, content, walletCode)
get fun get_jetton_data(): (int, int, slice, cell, cell) {
    var (totalSupply, adminAddress, content, walletCode) = loadMinterData();
    return (totalSupply, -1, adminAddress, content, walletCode);
}

// Getter: wallet address for a given owner
get fun get_wallet_address(ownerAddress: slice): slice {
    var (totalSupply, adminAddress, content, walletCode) = loadMinterData();
    val si = calcWalletStateInit(ownerAddress, asMinterAddr(adminAddress), walletCode);
    return calcWalletAddress(si);
}
