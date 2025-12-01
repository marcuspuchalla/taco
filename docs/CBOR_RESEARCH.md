# CBOR Research Report
## Comprehensive Analysis of RFC 8949 and Cardano Extensions

**Version:** 1.0
**Date:** 2025-10-26
**Author:** CORE Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [CBOR Specification Overview](#cbor-specification-overview)
3. [Major Types Deep Dive](#major-types-deep-dive)
4. [Encoding Rules and Conventions](#encoding-rules-and-conventions)
5. [Cardano-Specific Extensions](#cardano-specific-extensions)
6. [Implementation Considerations](#implementation-considerations)
7. [Best Practices](#best-practices)
8. [References](#references)

---

## Executive Summary

CBOR (Concise Binary Object Representation) is a data format defined in RFC 8949 that provides compact, extensible binary encoding for structured data. It is the foundational serialization format used throughout the Cardano blockchain ecosystem.

### Key Findings

- **8 Major Types**: CBOR defines 8 major types (0-7) encoded in the first 3 bits
- **Compact Encoding**: Optimized for size with variable-length integer encoding
- **Extensibility**: Tag system (major type 6) allows semantic extensions
- **Cardano Usage**: Transactions, Plutus Data, metadata all use CBOR encoding
- **Deterministic Encoding**: Critical for Cardano's cryptographic hashing

### Cardano-Specific Requirements

1. **Deterministic Encoding**: Required for transaction hashing
2. **Plutus Data**: Uses CBOR tags 121-127 and 102 for constructors
3. **Tag 258**: Represents sets (ordered, no duplicates)
4. **Tag 24**: CBOR-in-CBOR encoding for data and scripts
5. **Canonical Ordering**: Map keys must be sorted for determinism

---

## CBOR Specification Overview

### What is CBOR?

CBOR (RFC 8949) is a binary data serialization format designed to:
- Be extremely small code size and message size
- Support a rich data model (superset of JSON)
- Be extensible without version negotiation
- Be efficiently encodable and decodable
- Be self-describing

### Data Model

CBOR supports these fundamental types:
- **Integers**: Signed and unsigned, arbitrary size
- **Binary Data**: Byte strings of any length
- **Text Data**: UTF-8 encoded strings
- **Collections**: Arrays and maps
- **Tagged Values**: Semantic annotations
- **Simple Values**: Booleans, null, undefined, floats

### Initial Byte Structure

Every CBOR data item begins with an initial byte:

```
  Bit:  7 6 5 | 4 3 2 1 0
       -------+-----------
        Major  | Additional
        Type   | Information
```

- **Bits 7-5**: Major type (0-7)
- **Bits 4-0**: Additional information (0-31)

---

## Major Types Deep Dive

### Major Type 0: Unsigned Integers

**Purpose**: Encode non-negative integers from 0 to 2^64-1

**Encoding Rules**:
- Values 0-23: Encoded in additional info (1 byte total)
- Values 24-255: Additional info 24, followed by 1-byte value
- Values 256-65535: Additional info 25, followed by 2-byte value (big-endian)
- Values 65536-4294967295: Additional info 26, followed by 4-byte value
- Values 4294967296-18446744073709551615: Additional info 27, followed by 8-byte value

**Examples**:
```
Value    Hex         Diagnostic
0        00          0
23       17          23
24       18 18       24
255      18 FF       255
256      19 01 00    256
65535    19 FF FF    65535
65536    1A 00 01 00 00    65536
```

**Cardano Usage**:
- Transaction fees (lovelace amounts)
- Array/map lengths
- Epoch numbers, slot numbers
- Asset quantities (when < 2^64)

### Major Type 1: Negative Integers

**Purpose**: Encode negative integers from -2^64 to -1

**Value Calculation**: -1 - n (where n is the unsigned value)

**Encoding Rules**: Same as major type 0, but with major type bits set to 001

**Examples**:
```
Value    Hex         Diagnostic
-1       20          -1
-24      37          -24
-25      38 18       -25
-256     38 FF       -256
-65536   3A 00 00 FF FF    -65536
```

**Cardano Usage**:
- Rare in Cardano (most values are non-negative)
- Possible in Plutus Data custom types
- Integer arithmetic results in smart contracts

### Major Type 2: Byte Strings

**Purpose**: Arbitrary binary data

**Encoding Rules**:
- Definite-length: Length in additional info, followed by bytes
- Indefinite-length: Additional info 31, followed by definite-length chunks, terminated by break (0xFF)

**Examples**:
```
Value            Hex                 Diagnostic
h''              40                  h''
h'01020304'      44 01020304         h'01020304'
h'0102...' (indef) 5F 42 0102 43 030405 FF    (_ h'0102', h'030405')
```

**Cardano Usage**:
- Ed25519 public keys (32 bytes)
- Ed25519 signatures (64 bytes)
- Transaction hashes (32 bytes, Blake2b-256)
- Script hashes (28 bytes)
- Policy IDs (28 bytes)
- Asset names (0-32 bytes)
- Arbitrary Plutus Data byte strings

### Major Type 3: Text Strings

**Purpose**: UTF-8 encoded text

**Encoding Rules**:
- Same structure as byte strings
- Content MUST be valid UTF-8
- Indefinite-length supported

**Examples**:
```
Value            Hex                     Diagnostic
""               60                      ""
"Hello"          65 48656C6C6F           "Hello"
"🚀"             64 F09F9A80             "\u{1F680}"
"test" (indef)   7F 62 7465 62 7374 FF   (_ "te", "st")
```

**Cardano Usage**:
- Asset names (when text-based)
- NFT metadata (names, descriptions)
- Transaction metadata strings
- Plutus Data text values

### Major Type 4: Arrays

**Purpose**: Ordered sequence of data items

**Encoding Rules**:
- Definite-length: Count in additional info, followed by elements
- Indefinite-length: Additional info 31, elements, break (0xFF)

**Examples**:
```
Value                Hex                 Diagnostic
[]                   80                  []
[1, 2, 3]            83 01 02 03         [1, 2, 3]
[1, [2, 3]]          82 01 82 02 03      [1, [2, 3]]
[_ 1, 2, 3]          9F 01 02 03 FF      [_ 1, 2, 3]
```

**Cardano Usage**:
- Transaction inputs array
- Transaction outputs array
- Plutus Data list type
- Constructor fields in Plutus Data
- Redeemer arrays
- Witness arrays

### Major Type 5: Maps

**Purpose**: Key-value pairs (dictionaries)

**Encoding Rules**:
- Definite-length: Pair count in additional info, followed by key-value pairs
- Indefinite-length: Additional info 31, pairs, break (0xFF)
- Keys can be any CBOR type

**Examples**:
```
Value                    Hex                     Diagnostic
{}                       A0                      {}
{1: 2, 3: 4}             A2 01 02 03 04          {1: 2, 3: 4}
{"a": 1, "b": 2}         A2 61 61 01 61 62 02    {"a": 1, "b": 2}
{_ "a": 1}               BF 61 61 01 FF          {_ "a": 1}
```

**Cardano Usage**:
- Transaction body structure
- Plutus Data map type
- Multi-asset value structure (nested maps: policy -> asset -> amount)
- Metadata maps
- Certificate maps

**Canonical Ordering**:
For deterministic encoding, map keys MUST be sorted:
1. First by encoded byte length (shorter keys first)
2. Then by lexicographic byte order

### Major Type 6: Tags

**Purpose**: Semantic annotations for extensibility

**Encoding Rules**:
- Tag number in additional info (or following bytes)
- Followed by single tagged data item

**Common Tags**:
```
Tag    Content          Purpose
0      Text string      RFC 3339 date/time
1      Integer/float    Unix epoch timestamp
2      Byte string      Unsigned bignum
3      Byte string      Negative bignum
4      Array [e,m]      Decimal fraction (m × 10^e)
5      Array [e,m]      Bigfloat (m × 2^e)
21     Any              Expected base64url encoding
22     Any              Expected base64 encoding
23     Any              Expected base16 encoding
24     Byte string      Embedded CBOR data
32     Text string      URI
55799  Any              Self-describe CBOR magic
```

**Cardano-Specific Tags**:
```
Tag    Purpose
102    General constructor (Plutus)
121    Constructor alternative 0 (Plutus)
122    Constructor alternative 1 (Plutus)
123    Constructor alternative 2 (Plutus)
124    Constructor alternative 3 (Plutus)
125    Constructor alternative 4 (Plutus)
126    Constructor alternative 5 (Plutus)
127    Constructor alternative 6 (Plutus)
258    Set (ordered, unique elements)
```

**Examples**:
```
Tagged Value         Hex                         Diagnostic
0("2024-10-26...")   C0 74 32303234...           0("2024-10-26T00:00:00Z")
1(1698364800)        C1 1A 65466780              1(1698364800)
2(h'010000...')      C2 49 01000000000000000     2(h'010000...')
121([1, 2])          D8 79 82 01 02              121([1, 2])
258([1, 2, 3])       D9 0102 83 01 02 03         258([1, 2, 3])
```

### Major Type 7: Simple Values and Floats

**Purpose**: Boolean, null, undefined, and floating-point numbers

**Simple Values**:
```
Value        Additional Info    Hex    Diagnostic
false        20                 F4     false
true         21                 F5     true
null         22                 F6     null
undefined    23                 F7     undefined
```

**Float Encodings**:
- **Float16** (additional info 25): Half-precision (16 bits)
- **Float32** (additional info 26): Single-precision (32 bits)
- **Float64** (additional info 27): Double-precision (64 bits)

**Special Floats**:
```
Value        Float16              Float32                Float64
Infinity     F9 7C 00             FA 7F 80 00 00         FB 7FF0000000000000
-Infinity    F9 FC 00             FA FF 80 00 00         FB FFF0000000000000
NaN          F9 7E 00             FA 7FC00000            FB 7FF8000000000000
```

**Break Code**:
- **0xFF**: Additional info 31, terminates indefinite-length items

**Cardano Usage**:
- Booleans in Plutus Data
- Null/undefined rarely used
- Floats generally avoided (rationals preferred for precision)

---

## Encoding Rules and Conventions

### Deterministic Encoding

**Why it matters**: Cardano requires deterministic encoding for cryptographic hashing of transactions. Two different encodings of the same value would produce different hashes.

**Core Rules** (RFC 8949 Section 4.2):

1. **Shortest Form**: Use minimal bytes for integers and lengths
   - 0-23: Use initial byte only
   - 24-255: Use 1 additional byte
   - 256-65535: Use 2 additional bytes
   - 65536+: Use appropriate size (4 or 8 bytes)

2. **Definite Length**: Never use indefinite-length encoding

3. **Map Key Sorting**: Keys sorted by:
   - Length of encoded key (ascending)
   - Lexicographic order of bytes (ascending)

4. **No Duplicate Keys**: Each key appears exactly once

5. **Preferred Float**: Use smallest float representation

**Example - Non-Canonical vs Canonical**:
```
Non-canonical:    19 00 17    (value 23 in 2 bytes)
Canonical:        17          (value 23 in 1 byte)

Non-canonical:    A2 61 62 01 61 61 02    ({"b": 1, "a": 2})
Canonical:        A2 61 61 02 61 62 01    ({"a": 2, "b": 1} - sorted)
```

### Indefinite-Length Encoding

**When to use**: Streaming applications where length unknown upfront

**Structure**:
- Initial byte with additional info 31
- Zero or more data items (chunks for strings)
- Break stop code (0xFF)

**Example - Indefinite Array**:
```
Definite:    83 01 02 03           [1, 2, 3]
Indefinite:  9F 01 02 03 FF        [_ 1, 2, 3]
```

**Restrictions**:
- Cannot nest indefinite strings within indefinite strings
- Break can only appear where expected
- Not allowed in canonical encoding

**Cardano Usage**: Rarely used due to deterministic encoding requirement

### UTF-8 Validation

**Requirement**: All text strings (major type 3) MUST contain valid UTF-8

**Invalid Sequences**:
- Overlong encodings
- Surrogate halves (U+D800 to U+DFFF)
- Code points beyond U+10FFFF
- Truncated multi-byte sequences

**Example**:
```
Valid:      63 E2 82 AC         "€" (U+20AC)
Invalid:    63 C0 80 41         Overlong encoding of NULL
Invalid:    63 ED A0 80         Surrogate half
```

### Bignum Encoding

**For values beyond 64-bit integers**:

**Positive bignum** (tag 2):
```
Tag 2 + byte string containing big-endian unsigned integer

Example: 2^64 = 18446744073709551616
C2 49 01 00 00 00 00 00 00 00 00
```

**Negative bignum** (tag 3):
```
Tag 3 + byte string, value = -1 - bignum

Example: -2^64 - 1
C3 49 01 00 00 00 00 00 00 00 00
```

**Cardano Usage**:
- Large ADA amounts (when > 2^64 lovelace)
- Plutus Data arbitrary-precision integers
- Some protocol parameters

---

## Cardano-Specific Extensions

### Plutus Data Encoding

**Purpose**: Universal data type for smart contract datum and redeemers

**Five Variants**:

1. **Constructor**: Tagged with alternatives or general form
2. **Map**: CBOR map with Plutus Data keys/values
3. **List**: CBOR array of Plutus Data
4. **Integer**: Bignum or CBOR integer
5. **Bytes**: Bounded byte string (0-64 bytes)

**CDDL Definition**:
```cddl
plutus_data = constr<plutus_data>
            / { * plutus_data => plutus_data }
            / [ * plutus_data ]
            / big_int
            / bounded_bytes

constr<a> = #6.121([* a])      ; Constructor 0
          / #6.122([* a])      ; Constructor 1
          / #6.123([* a])      ; Constructor 2
          / #6.124([* a])      ; Constructor 3
          / #6.125([* a])      ; Constructor 4
          / #6.126([* a])      ; Constructor 5
          / #6.127([* a])      ; Constructor 6
          / #6.102([uint, [* a]])  ; General constructor

bounded_bytes = bytes .size (0..64)
```

**Examples**:
```
Constructor 0, fields [1, 2]:
D8 79 82 01 02
Diagnostic: 121([1, 2])

Constructor 7, fields []:
D8 66 82 07 80
Diagnostic: 102([7, []])

List [1, 2, 3]:
83 01 02 03
Diagnostic: [1, 2, 3]

Map {h'00' => 1}:
A1 41 00 01
Diagnostic: {h'00': 1}

Bignum 2^64:
C2 49 01 00 00 00 00 00 00 00 00
Diagnostic: 2(h'010000000000000000')

Bounded bytes h'ABCD':
42 AB CD
Diagnostic: h'ABCD'
```

### Transaction Structure

**Conway Era Transaction**:
```cddl
transaction = [
  transaction_body,
  transaction_witness_set,
  bool,                    ; is_valid
  auxiliary_data / nil
]
```

**Transaction Body** (map with specific keys):
```
{
  0: set<transaction_input>,     ; inputs
  1: [* transaction_output],     ; outputs
  2: coin,                       ; fee
  ? 3: slot_no,                  ; ttl
  ? 9: mint,                     ; minted/burned assets
  ? 11: script_data_hash,        ; hash of datum/redeemer/cost models
  ? 13: nonempty_set<transaction_input>,  ; collateral inputs
  ? 18: nonempty_set<transaction_input>,  ; reference inputs
  ...
}
```

**Key Points**:
- Map keys are integers for compactness
- Optional fields prefixed with `?` in CDDL
- Deterministic encoding required
- Keys must be sorted numerically

### Multi-Asset Values

**Structure**: Nested maps for policy -> asset name -> amount

```cddl
value = coin / [coin, multiasset<positive_coin>]
multiasset<a> = { * policy_id => { + asset_name => a } }
policy_id = script_hash  ; 28 bytes
asset_name = bytes .size (0..32)
```

**Example**:
```
2 ADA + 100 of PolicyA.TokenX:

82                           ; Array of 2 elements
  1A 001E8480                ; 2000000 lovelace (2 ADA)
  A1                         ; Map with 1 entry
    581C ABCD...1234         ; Policy ID (28 bytes)
    A1                       ; Map with 1 entry
      46 546F6B656E58        ; Asset name "TokenX"
      18 64                  ; Amount 100
```

### CIP-25: NFT Metadata

**Label**: 721 (in transaction metadata)

**Structure**:
```json
{
  "721": {
    "<policy_id_hex>": {
      "<asset_name_hex>": {
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

**Encoding Notes**:
- Policy ID and asset name as hex-encoded byte strings in version 2
- UTF-8 text strings in version 1
- Image URIs must follow proper format (ipfs://, https://, data:)

### CIP-68: Datum Metadata Standard

**Purpose**: On-chain metadata stored in datum

**Reference NFT**: Contains datum with metadata
**User Token**: Actual tradeable token

**Benefits**:
- Updateable metadata
- No transaction metadata limits
- Composable with smart contracts

### Cardano Addresses

**Byron Era** (legacy):
- Base58-encoded
- CBOR-wrapped internally
- Contains spending data, attributes, CRC

**Shelley Era**:
- Bech32-encoded (human-readable: addr1...)
- Binary payload is NOT CBOR (raw bytes)
- Structure: Header byte + payment credential + optional stake credential

**In Transactions**:
Raw binary address bytes are used (not CBOR-encoded further)

### Sets (Tag 258)

**Purpose**: Represent mathematical sets (ordered, no duplicates)

**CDDL**:
```cddl
set<a> = #6.258([* a])  ; Elements must be sorted
```

**Example**:
```
Set {1, 2, 3}:
D9 0102 83 01 02 03
Diagnostic: 258([1, 2, 3])
```

**Cardano Usage**:
- Transaction input sets
- Required signers
- Collateral inputs

**Requirements**:
- Elements sorted in canonical order
- No duplicates allowed

### CBOR-in-CBOR (Tag 24)

**Purpose**: Embed serialized CBOR as a byte string

**CDDL**:
```cddl
data = #6.24(bytes .cbor plutus_data)
```

**Example**:
```
Plutus Data list [1, 2] embedded:

Inner CBOR: 83 01 02
Wrapped: D8 18 43 83 01 02
         ^tag  ^len ^inner CBOR

Diagnostic: 24(h'830102')
```

**Cardano Usage**:
- Datum in transactions
- Redeemer data
- Script references

**Purpose**: Allows lazy deserialization - the inner CBOR is only parsed when needed

---

## Implementation Considerations

### JavaScript/TypeScript Challenges

**64-bit Integers**:
- JavaScript's `Number` type is 53-bit safe integer
- Values > 2^53 require `BigInt`
- Must handle conversion carefully

**Example**:
```typescript
// ❌ Incorrect
const value = 9007199254740993; // Loses precision

// ✅ Correct
const value = 9007199254740993n; // BigInt
```

**Byte Buffers**:
- Use `Uint8Array` for binary data
- Be careful with buffer copies and slices
- Consider `Buffer` in Node.js vs `Uint8Array` in browsers

**Maps with Non-String Keys**:
- JavaScript `Map` supports any key type
- JSON doesn't - must serialize carefully
- CBOR maps can have integer, bytes, or array keys

### Deterministic Encoding Implementation

**Critical for Cardano**:

```typescript
function encodeCanonical(value: any): Uint8Array {
  // 1. Use shortest integer encoding
  // 2. Use definite-length only
  // 3. Sort map keys properly
  // 4. Use smallest float representation
  // 5. No duplicate keys
}

function sortMapKeys(entries: [any, any][]): [any, any][] {
  return entries.sort((a, b) => {
    const aEncoded = encode(a[0]);
    const bEncoded = encode(b[0]);

    // Compare lengths first
    if (aEncoded.length !== bEncoded.length) {
      return aEncoded.length - bEncoded.length;
    }

    // Then lexicographic
    for (let i = 0; i < aEncoded.length; i++) {
      if (aEncoded[i] !== bEncoded[i]) {
        return aEncoded[i] - bEncoded[i];
      }
    }

    return 0;
  });
}
```

### Error Handling

**Categories of Errors**:

1. **Well-formedness errors**: Invalid CBOR structure
2. **Validity errors**: Valid CBOR but semantically wrong (e.g., invalid UTF-8)
3. **Domain errors**: CBOR is valid but doesn't match expected schema

**Recommended Approach**:
```typescript
class CBORDecodeError extends Error {
  constructor(
    message: string,
    public readonly position?: number,
    public readonly partialData?: Uint8Array
  ) {
    super(message);
  }
}

try {
  const decoded = decoder.decode(bytes);
} catch (e) {
  if (e instanceof CBORDecodeError) {
    console.error(`CBOR error at position ${e.position}: ${e.message}`);
  }
}
```

### Performance Optimization

**Strategies**:

1. **Preallocate buffers** when encoding
2. **Stream processing** for large data
3. **Cache canonical encodings** for frequently used values
4. **Lazy deserialization** with tag 24
5. **Avoid unnecessary copies** of byte arrays

**Benchmark targets**:
- Encode/decode 1MB CBOR: < 50ms
- Encode/decode simple transaction: < 5ms
- Canonical encoding overhead: < 10%

### Testing Strategies

**Essential test categories**:

1. **Round-trip**: encode(decode(x)) = x
2. **Canonical**: encodeCanonical produces deterministic output
3. **Boundary values**: 23/24, 255/256, etc.
4. **Error cases**: Truncated data, invalid UTF-8
5. **Real-world data**: Actual Cardano transactions

---

## Best Practices

### For Implementers

1. **Always support deterministic encoding** for Cardano compatibility
2. **Use BigInt for large integers** (> 2^53)
3. **Validate UTF-8** strictly in text strings
4. **Handle all 8 major types** completely
5. **Implement proper error handling** with context
6. **Test with real Cardano data** from mainnet
7. **Benchmark performance** on typical workloads
8. **Document deviations** from RFC 8949

### For Smart Contract Developers

1. **Prefer constructors over maps** in Plutus Data (more efficient)
2. **Keep datum/redeemer small** (costs scale with size)
3. **Use bounded bytes** (max 64 bytes) for Plutus Data
4. **Test encoding compatibility** with cardano-cli
5. **Validate encoded size** before submission
6. **Use canonical encoding** always

### For Application Developers

1. **Validate CBOR before signing** transactions
2. **Use established libraries** (cardano-serialization-lib, etc.)
3. **Handle large integers** properly
4. **Test round-trip encoding** in your app
5. **Cache decoded data** when appropriate
6. **Monitor encoding errors** in production

### Security Considerations

1. **Resource exhaustion**: Limit nesting depth, array/map sizes
2. **Integer overflow**: Use BigInt, validate ranges
3. **Hash collisions**: Use deterministic encoding always
4. **Malicious CBOR**: Validate structure before processing
5. **Timing attacks**: Be careful with canonical comparison

---

## References

### Specifications

- **RFC 8949**: CBOR specification (https://www.rfc-editor.org/rfc/rfc8949.html)
- **RFC 8610**: CDDL specification (https://www.rfc-editor.org/rfc/rfc8610.html)
- **Cardano Ledger CDDL**: Conway era specification
  (https://github.com/IntersectMBO/cardano-ledger/blob/master/eras/conway/impl/cddl-files/conway.cddl)

### CIPs (Cardano Improvement Proposals)

- **CIP-25**: NFT Metadata Standard (https://cips.cardano.org/cip/CIP-25)
- **CIP-68**: Datum Metadata Standard (https://cips.cardano.org/cip/CIP-68)
- **CIP-30**: dApp-Wallet Web Bridge (https://cips.cardano.org/cip/CIP-30)

### Tools and Libraries

- **cardano-serialization-lib**: Rust CBOR library for Cardano (WASM bindings)
- **cbor-x**: High-performance JavaScript CBOR library
- **cbor2**: Python CBOR implementation
- **Aiken**: Smart contract language with CBOR support
- **cardano-cli**: Official CLI with CBOR utilities

### Further Reading

- Cardano Ledger Documentation: https://github.com/IntersectMBO/cardano-ledger
- Plutus Documentation: https://plutus.readthedocs.io/
- CBOR Playground: https://cbor.me/
- Cardano Docs: https://docs.cardano.org/

---

**Document Version**: 1.0
**Last Updated**: 2025-10-26
**Maintainer**: CORE Team
