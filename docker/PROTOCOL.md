# CBOR Test Container Protocol

## Overview

Each CBOR library container implements a simple HTTP API for encoding and decoding CBOR data. This protocol ensures fair, isolated testing across different programming languages and libraries.

## Endpoints

### Health Check

```
GET /health
Response: {"status": "ok", "library": "library-name", "version": "x.y.z", "language": "rust|python|node|go|..."}
```

### Decode CBOR

```
POST /decode
Content-Type: application/json

Request:
{
  "hex": "1864"  // CBOR bytes as hex string (no 0x prefix)
}

Response (success):
{
  "success": true,
  "result": <decoded_value>,
  "duration_ms": 0.123
}

Response (error):
{
  "success": false,
  "error": "Error message describing the failure"
}
```

### Encode to CBOR

```
POST /encode
Content-Type: application/json

Request:
{
  "value": <value_to_encode>
}

Response (success):
{
  "success": true,
  "hex": "1864",
  "duration_ms": 0.123
}

Response (error):
{
  "success": false,
  "error": "Error message describing the failure"
}
```

## Type Mapping

Since JSON cannot represent all CBOR types, we use special markers:

### Byte Strings
```json
{"__cbor_bytes__": "0102030405"}
```
Represents CBOR byte string with hex-encoded content.

### Special Floats
```json
{"__cbor_float__": "NaN"}
{"__cbor_float__": "Infinity"}
{"__cbor_float__": "-Infinity"}
```

### Large Integers
Integers outside JavaScript's safe integer range (-2^53+1 to 2^53-1) are represented as strings:
```json
"18446744073709551615"
```

### CBOR Tags
```json
{
  "__cbor_tag__": 121,
  "__cbor_value__": [1, 2, 3]
}
```

## Tag Semantics and Comparison

The Docker runner interprets common tags into semantic values when matching against expected outputs. This section documents the expected behavior for different tag classes.

### Semantic Tags (Interpreted)

These tags are interpreted to their semantic meaning during comparison:

| Tag | Name | Interpretation |
|-----|------|----------------|
| 0 | Date/Time String | Interpreted as ISO 8601 date string |
| 1 | Epoch Timestamp | Interpreted as Unix epoch (seconds) |
| 2 | Positive Bignum | Converted to BigInt/large integer string |
| 3 | Negative Bignum | Converted to negative BigInt/large integer string |
| 24 | Encoded CBOR | Nested CBOR bytes, decoded recursively |
| 55799 | Self-Describe CBOR | Unwrapped, tag ignored for comparison |

### Cardano/Plutus Tags (Preserved)

These tags are specific to Cardano Plutus Data encoding and are preserved as tagged values:

| Tag | Name | Behavior |
|-----|------|----------|
| 121-127 | Plutus Constructor 0-6 | Preserved as `{__cbor_tag__: N, __cbor_value__: [...]}` |
| 102 | Plutus Alternative Constructor | Preserved, contains `[constructor_id, fields]` |
| 1280-1400 | Extended Constructors | Preserved for constructors 7+ |

### Set Tags (Unwrapped)

| Tag | Name | Behavior |
|-----|------|----------|
| 258 | Set | Unwrapped to array for comparison |

### Unknown Tags

Tags not listed above are unwrapped to their contained value during comparison. Libraries that preserve unknown tags will still pass tests as long as the unwrapped value matches.

### Implementation Notes

1. **Tag-preserving libraries** should use the `__cbor_tag__` marker in JSON output
2. **Semantic interpretation** happens in the test runner, not containers
3. **Round-trip encoding** should preserve Plutus tags exactly
4. **Comparison order**: Tags are interpreted before deep equality check

### Undefined
```json
{"__cbor_undefined__": true}
```

## Null, Undefined, and Missing Keys

CBOR distinguishes between these concepts, but JSON conflates them. This protocol handles them as follows:

| CBOR Value | JSON Representation | Notes |
|------------|---------------------|-------|
| `null` (simple value 22) | `null` | Direct mapping |
| `undefined` (simple value 23) | `{"__cbor_undefined__": true}` | Marker required |
| Missing map key | Key absent from object | Standard JSON behavior |

## Precision Guarantees

| Type | Precision | Notes |
|------|-----------|-------|
| Integers ≤ 2^53-1 | Exact | JSON number |
| Integers > 2^53-1 | Exact | String representation |
| Float16 | Best effort | May lose precision in conversion |
| Float32 | IEEE 754 single | Full precision preserved |
| Float64 | IEEE 754 double | Full precision preserved |

## Test Pass Criteria

A test is considered **passed** when:

1. For `shouldSucceed: true` tests:
   - Decode returns `success: true`
   - The `result` deeply equals `expectedOutput` after normalization
   - String representations of large integers match their numeric equivalents

2. For `shouldSucceed: false` tests:
   - Decode returns `success: false`
   - An error message is provided

Partial decoding (returning some data before an error) is considered a **failure**.

## Container Requirements

1. **Port**: Each container listens on port 8080 internally
2. **Timeout**: Requests should complete within 5 seconds
3. **Memory**: Containers should handle payloads up to 10MB
4. **Concurrency**: Handle at least 10 concurrent requests

## Error Handling

Containers should return appropriate error messages for:
- Invalid hex input
- Malformed CBOR data
- Unsupported CBOR features
- Encoding failures

Always return valid JSON, even for errors.
