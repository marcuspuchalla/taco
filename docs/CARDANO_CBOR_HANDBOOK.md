# Cardano CBOR Handbook

**Version:** 1.0
**Last Updated:** 2025-10-26

---

## Table of Contents

1. [Introduction](#introduction)
2. [Why CBOR for Cardano](#why-cbor-for-cardano)
3. [Deterministic Encoding](#deterministic-encoding)
4. [Plutus Data](#plutus-data)
5. [Transaction Structure](#transaction-structure)
6. [Multi-Asset Values](#multi-asset-values)
7. [NFT Metadata (CIP-25)](#nft-metadata-cip-25)
8. [Common Patterns](#common-patterns)
9. [Best Practices](#best-practices)
10. [Migration Guide](#migration-guide)

---

## Introduction

This handbook provides practical guidance for working with CBOR encoding in the Cardano ecosystem. It covers Cardano-specific conventions, common patterns, and best practices.

### Audience

- Smart contract developers
- DApp developers
- Wallet implementers
- Blockchain explorers
- Testing tool developers

---

## Why CBOR for Cardano

### Design Rationale

Cardano uses CBOR (Concise Binary Object Representation) as its primary serialization format because:

1. **Compact**: Smaller transaction sizes = lower fees
2. **Deterministic**: Same data always encodes the same way (critical for hashing)
3. **Extensible**: Tag system allows new features without breaking changes
4. **Well-Specified**: RFC 8949 provides clear, unambiguous rules
5. **Widely Supported**: Libraries available in most programming languages

### Key Requirements

Cardano imposes these CBOR requirements:

- **Deterministic encoding** (RFC 8949 Section 4.2)
- **Definite-length encoding** (no indefinite lengths)
- **Canonical map key ordering** (sorted by encoded length, then lexicographic)
- **No duplicate map keys**
- **Specific tag usage** (121-127 for Plutus constructors, 258 for sets, 24 for embedded CBOR)

---

## Deterministic Encoding

### Why It Matters

**Transaction hashes** are computed from CBOR-encoded transaction bodies. If the same logical transaction could encode differently, it would produce different hashes, breaking the blockchain's integrity.

### Rules

1. **Smallest Integer Encoding**
   - 0-23: Use initial byte only
   - 24-255: Use 1 additional byte
   - 256-65535: Use 2 additional bytes
   - 65536+: Use appropriate size (4 or 8 bytes)

   ```
   WRONG: 0x1817 (23 with extra byte)
   RIGHT: 0x17 (23 in initial byte)
   ```

2. **Definite Length Only**
   - Never use indefinite-length encodings (additional info 31)
   - Always specify exact length upfront

   ```
   WRONG: 0x9f010203ff (indefinite array)
   RIGHT: 0x83010203 (definite array of 3)
   ```

3. **Canonical Map Key Ordering**
   - Sort by encoded byte length (ascending)
   - Then by lexicographic byte order (ascending)

   ```json
   {
     "a": 1,     // 1 byte: 0x6161
     "bb": 2,    // 2 bytes: 0x626262
     "ccc": 3    // 3 bytes: 0x63636363
   }
   ```

4. **No Duplicate Keys**
   - Each map key appears exactly once

5. **Preferred Float**
   - Use smallest float representation that preserves value

### Validation

```typescript
function isCanonical(cbor: Uint8Array): boolean {
  // Decode, re-encode canonically, compare
  const decoded = decode(cbor);
  const reencoded = encodeCanonical(decoded);
  return bytesEqual(cbor, reencoded);
}
```

---

## Plutus Data

### Overview

**Plutus Data** is the universal data type for smart contract datum and redeemers. It has **5 variants**:

1. **Constructor**: Tagged unions (similar to Rust enums)
2. **Map**: Key-value pairs
3. **List**: Ordered sequences
4. **Integer**: Arbitrary-precision integers (including bignums)
5. **Bytes**: Bounded byte strings (0-64 bytes)

### CDDL Definition

```cddl
plutus_data = constr<plutus_data>
            / { * plutus_data => plutus_data }
            / [ * plutus_data ]
            / big_int
            / bounded_bytes

constr<a> = #6.121([* a])              ; Constructor 0
          / #6.122([* a])              ; Constructor 1
          / #6.123([* a])              ; Constructor 2
          / #6.124([* a])              ; Constructor 3
          / #6.125([* a])              ; Constructor 4
          / #6.126([* a])              ; Constructor 5
          / #6.127([* a])              ; Constructor 6
          / #6.102([uint, [* a]])      ; General constructor (>= 7)

bounded_bytes = bytes .size (0..64)
```

### Constructor Encoding

**Compact form** (constructors 0-6):

```typescript
// Constructor 0 with fields [1, 2]
// Tag 121, array [1, 2]
const hex = "d879820102";
// Decoded: { constructor: 0, fields: [1, 2] }
```

**General form** (constructors >= 7):

```typescript
// Constructor 7 with fields [100]
// Tag 102, array [7, [100]]
const hex = "d866820781 64";
// Decoded: { constructor: 7, fields: [100] }
```

### List Variant

```typescript
// Simple list: [1, 2, 3]
const hex = "83010203";
// Decoded: [1, 2, 3]

// Nested list: [[1, 2], [3, 4]]
const hex = "828201028203 04";
// Decoded: [[1, 2], [3, 4]]
```

### Map Variant

```typescript
// Map with integer keys: {0: "a", 1: "b"}
const hex = "a2006161016162";
// Decoded: {0: "a", 1: "b"}

// Map with byte string keys
const hex = "a142000101";
// Decoded: {h'00': 1}
```

### Integer Variant

```typescript
// Small integer: 42
const hex = "182a";
// Decoded: 42

// Bignum: 2^64 (tag 2 + byte string)
const hex = "c249010000000000000000";
// Decoded: 18446744073709551616n
```

### Bytes Variant

**Important**: Maximum 64 bytes!

```typescript
// Empty bytes
const hex = "40";
// Decoded: h''

// 32-byte hash
const hex = "5820" + "ab".repeat(32);
// Decoded: h'abab...ab'

// 64 bytes (maximum)
const hex = "5840" + "ff".repeat(64);
// Decoded: h'ffff...ff'

// 65 bytes (INVALID)
const hex = "5841" + "00".repeat(65);
// Error: Plutus Data bytes must be 0-64 length
```

### Real-World Examples

#### Vesting Contract Datum

```typescript
// Beneficiary PKH + deadline (POSIX timestamp)
{
  constructor: 0,
  fields: [
    h'aabbcc...', // 28-byte public key hash
    1698364800    // Unix timestamp
  ]
}

// CBOR hex: d879825 81caabbcc...1a65466780
```

#### DEX Swap Redeemer

```typescript
// Swap action with minimum output
{
  constructor: 0,  // Swap
  fields: [
    100000         // Minimum ADA out
  ]
}

// CBOR hex: d8798 11a000186a0
```

#### NFT Marketplace Datum

```typescript
// Seller + price + royalty
{
  constructor: 0,
  fields: [
    h'seller_pkh',  // Seller public key hash
    2000000,        // Price in lovelace
    5               // Royalty percentage
  ]
}

// CBOR hex: d879835 81c<seller>1a001e8480 05
```

---

## Transaction Structure

### Conway Era Transaction

```cddl
transaction = [
  transaction_body,
  transaction_witness_set,
  bool,                    ; is_valid flag
  auxiliary_data / nil
]
```

### Transaction Body

The transaction body is a **map** with **integer keys**:

```cddl
transaction_body = {
  0: set<transaction_input>,     ; inputs
  1: [* transaction_output],     ; outputs
  2: coin,                       ; fee
  ? 3: slot_no,                  ; validity start
  ? 8: slot_no,                  ; validity end (TTL)
  ? 9: mint,                     ; minted/burned assets
  ? 11: script_data_hash,        ; hash of plutus data
  ? 13: nonempty_set<transaction_input>,  ; collateral
  ? 14: required_signers,        ; required signers
  ? 18: nonempty_set<transaction_input>,  ; reference inputs
  ...
}
```

**Key ordering**: Integer keys are naturally ordered (0, 1, 2, ...).

### Transaction Input

```cddl
transaction_input = [
  transaction_id: hash32,
  index: uint
]
```

**Example:**

```typescript
// Input referencing output #0 of tx with hash aa...
[
  h'aaaa...aaaa',  // 32-byte transaction hash
  0                // Output index
]

// CBOR hex: 825820aaaa...aaaa00
```

### Transaction Output

```cddl
transaction_output = [
  address,
  value,
  ? datum_option,
  ? script_ref
]

datum_option = [0, hash32] / [1, data]
```

**Example with inline datum:**

```typescript
[
  h'addr...',              // Address bytes
  2000000,                 // 2 ADA in lovelace
  [1, plutus_data],        // Inline datum
  null                     // No script reference
]
```

### Witness Set

```cddl
transaction_witness_set = {
  ? 0: nonempty_set<vkeywitness>,       ; VKey witnesses
  ? 1: nonempty_set<native_script>,     ; Native scripts
  ? 3: nonempty_set<plutus_v1_script>,  ; Plutus V1 scripts
  ? 4: nonempty_set<plutus_data>,       ; Datums
  ? 5: redeemers,                       ; Redeemers
  ? 6: nonempty_set<plutus_v2_script>,  ; Plutus V2 scripts
  ? 7: nonempty_set<plutus_v3_script>   ; Plutus V3 scripts
}
```

### Redeemers

```cddl
redeemers = [+ [
  tag: redeemer_tag,
  index: uint,
  data: plutus_data,
  ex_units: [mem: uint, steps: uint]
]]

redeemer_tag = 0 (spend) / 1 (mint) / 2 (cert)
             / 3 (reward) / 4 (voting) / 5 (proposing)
```

**Example:**

```typescript
// Spend redeemer for input #0
[
  0,                          // tag: spend
  0,                          // index
  { constructor: 0, fields: [] },  // data
  [1000000, 500000000]        // ex_units [mem, steps]
]

// CBOR hex: 840000d8798081 1a000f42401a1dcd6500
```

---

## Multi-Asset Values

### Structure

Multi-asset values use **nested maps**:

```cddl
value = coin / [coin, multiasset<positive_coin>]
multiasset<a> = {* policy_id => {+ asset_name => a}}

policy_id = hash28     ; 28-byte script hash
asset_name = bytes .size (0..32)
```

### Encoding Patterns

**ADA only:**

```typescript
// 2 ADA = 2,000,000 lovelace
const hex = "1a001e8480";
// Decoded: 2000000
```

**ADA + single token:**

```typescript
// 2 ADA + 100 tokens
[
  2000000,                    // Lovelace
  {
    h'policy_id': {
      h'TokenName': 100
    }
  }
]

// CBOR hex:
// 82                              ; Array of 2
//   1a001e8480                    ; 2000000 lovelace
//   a1                            ; Map with 1 entry
//     581c<policy_id>             ; 28-byte policy ID
//     a1                          ; Map with 1 entry
//       48546f6b656e4e616d65      ; "TokenName"
//       1864                      ; 100
```

**Multiple policies:**

```typescript
[
  5000000,
  {
    h'policyA': {
      h'NFT1': 1
    },
    h'policyB': {
      h'FT1': 1000,
      h'FT2': 2000
    }
  }
]
```

### Key Ordering

**Canonical ordering applies**:

1. Policy IDs sorted by encoded bytes
2. Asset names within policy sorted by encoded bytes
3. Both use: length-first, then lexicographic

---

## NFT Metadata (CIP-25)

### Label 721

NFT metadata uses **transaction metadata label 721**:

```json
{
  "721": {
    "<policy_id>": {
      "<asset_name>": {
        "name": "NFT Name",
        "image": "ipfs://...",
        "mediaType": "image/png",
        "description": "...",
        "files": [...]
      }
    },
    "version": "1.0"
  }
}
```

### Version Differences

**Version 1** (default):
- `policy_id` and `asset_name` as **UTF-8 text keys**
- Version field optional (defaults to 1.0)

**Version 2**:
- `policy_id` and `asset_name` as **raw byte keys** (hex)
- Version field required: `"version": "2.0"`

### Required Fields

- **`name`**: Text string (mandatory)
- **`image`**: Valid URI (mandatory)

### Optional Fields

- **`description`**: Text or array
- **`mediaType`**: MIME type
- **`files`**: Array of file objects

### Files Array

```json
"files": [
  {
    "name": "High Resolution",
    "mediaType": "image/png",
    "src": "ipfs://QmHighRes...",
    "size": 1024768
  }
]
```

### Example CBOR Encoding

```typescript
// Minimal NFT metadata
{
  "721": {
    h'<28-byte-policy>': {
      h'NFT001': {
        "name": "My First NFT",
        "image": "ipfs://QmHash123"
      }
    }
  }
}

// This gets encoded as transaction auxiliary data
```

---

## Common Patterns

### Pattern 1: Transaction Input Set (Tag 258)

```typescript
// Set of 2 inputs
258([
  [h'tx_hash_1', 0],
  [h'tx_hash_2', 1]
])

// CBOR hex: d90102828258 20<hash1>00825820<hash2>01
```

### Pattern 2: CBOR-in-CBOR (Tag 24)

Used for **inline datums** and **reference scripts**:

```typescript
// Plutus Data wrapped in tag 24
24(h'<inner_cbor>')

// Example: Inline datum
[
  1,                    // Inline datum flag
  24(plutus_data_cbor)  // Embedded CBOR
]

// CBOR hex: 8201d8184 3<plutus_cbor>
```

### Pattern 3: Bignum for Large ADA Amounts

```typescript
// If amount > 2^64 lovelace (unlikely but possible)
2(h'<big_endian_bytes>')

// Example: 2^65
const hex = "c24a02000000000000000 0";
```

### Pattern 4: Empty Script Execution Units

```typescript
// When no Plutus scripts in transaction
ex_units = [0, 0]

// CBOR hex: 820000
```

---

## Best Practices

### For Smart Contract Developers

1. **Keep datums small**: Costs scale with size
2. **Use constructors over maps**: More efficient
3. **Bounded bytes only**: Max 64 bytes in Plutus Data
4. **Test encoding**: Validate with cardano-cli before deployment
5. **Version your datums**: Add version field for future upgrades

### For DApp Developers

1. **Validate CBOR before signing**: Never sign unverified data
2. **Use established libraries**: cardano-serialization-lib, Lucid, etc.
3. **Handle BigInt properly**: JavaScript Number is limited to 2^53
4. **Cache decoded data**: Avoid redundant decoding
5. **Monitor encoding size**: Affects transaction fees

### For Wallet Implementers

1. **Support all Plutus Data variants**: Your users will need them
2. **Canonical encoding always**: Non-deterministic = wrong transaction hash
3. **Validate transaction structure**: Protect users from malformed transactions
4. **Display human-readable data**: Parse Plutus Data for UI
5. **Test with real transactions**: Use mainnet data for validation

### For Testing

1. **Test round-trip**: `encode(decode(x)) == x`
2. **Test canonical**: `encodeCanonical(decode(x)) == x` (if x is canonical)
3. **Test boundary values**: 23/24, 255/256, 64 bytes for Plutus Data
4. **Test real-world data**: Use actual transaction CBOR from mainnet
5. **Stress test**: Large maps, deep nesting, max-size arrays

---

## Migration Guide

### From JSON to CBOR

**Don't:**
- Assume string keys work like JSON (CBOR supports any key type)
- Ignore encoding size (CBOR is smaller but matters for fees)
- Forget about deterministic encoding

**Do:**
- Use integer keys for efficiency (like transaction body)
- Test with actual CBOR tools (cbor-diag, cardano-cli)
- Validate canonical encoding

### From Other Formats

**From Protobuf:**
- CBOR is more flexible (no schema required)
- Tags provide extensibility
- Self-describing (no separate IDL file)

**From MessagePack:**
- CBOR has standardized extensions (tags)
- Better specification (RFC vs informal)
- Cardano ecosystem support

### Common Migration Issues

1. **Integer Size**: JavaScript Number → BigInt for > 2^53
2. **Map Keys**: Strings only → Any CBOR type
3. **Encoding**: Arbitrary → Deterministic only
4. **Byte Strings**: Base64 in JSON → Raw bytes in CBOR
5. **Tags**: Not in JSON → Essential in Cardano CBOR

---

## Additional Resources

### Specifications

- [RFC 8949: CBOR](https://www.rfc-editor.org/rfc/rfc8949.html)
- [RFC 8610: CDDL](https://www.rfc-editor.org/rfc/rfc8610.html)
- [Cardano Ledger CDDL](https://github.com/IntersectMBO/cardano-ledger)

### CIPs

- [CIP-25: NFT Metadata Standard](https://cips.cardano.org/cip/CIP-25)
- [CIP-68: Datum Metadata Standard](https://cips.cardano.org/cip/CIP-68)
- [CIP-30: dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30)

### Tools

- **cardano-cli**: Official Cardano CLI with CBOR utilities
- **cardano-serialization-lib**: Rust library (WASM bindings)
- **Lucid**: Lightweight Cardano library
- **Aiken**: Smart contract language with CBOR support
- **cbor-diag**: CBOR diagnostic tools

### Testing Resources

- [CBOR Test Suite](../README.md)
- [Test Suite Guide](./TEST_SUITE_GUIDE.md)
- [CBOR Research Report](./CBOR_RESEARCH.md)

---

**Version:** 1.0
**Maintainer:** CORE Team
**License:** MIT
