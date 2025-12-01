#!/usr/bin/env python3
"""
CBOR Bridge Script for Node.js Integration
Provides encode/decode functionality via stdin/stdout
"""

import sys
import json
import cbor2
import dag_cbor

def cbor2_encode(data):
    """Encode data using cbor2"""
    return cbor2.dumps(data).hex()

def cbor2_decode(hex_string):
    """Decode hex string using cbor2"""
    bytes_data = bytes.fromhex(hex_string)
    result = cbor2.loads(bytes_data)
    return convert_types(result)

def dag_cbor_encode(data):
    """Encode data using dag-cbor"""
    from dag_cbor import encode
    return encode(data).hex()

def dag_cbor_decode(hex_string):
    """Decode hex string using dag-cbor"""
    from dag_cbor import decode
    bytes_data = bytes.fromhex(hex_string)
    result = decode(bytes_data)
    return convert_types(result)

def convert_types(value):
    """Convert Python types to JSON-serializable types"""
    import math

    if isinstance(value, bytes):
        # Return as object with special marker to preserve hex string format
        return {"__cbor_bytes__": value.hex()}
    elif isinstance(value, bytearray):
        return {"__cbor_bytes__": bytes(value).hex()}
    elif isinstance(value, float):
        # Handle special float values
        if math.isnan(value):
            return {"__cbor_float__": "NaN"}
        elif math.isinf(value):
            if value > 0:
                return {"__cbor_float__": "Infinity"}
            else:
                return {"__cbor_float__": "-Infinity"}
        return value
    elif isinstance(value, int):
        # Convert large integers to strings to preserve precision
        # JavaScript's Number.MAX_SAFE_INTEGER is 2^53-1 = 9007199254740991
        if value > 9007199254740991 or value < -9007199254740991:
            return str(value)
        return value
    elif isinstance(value, dict):
        return {convert_types(k): convert_types(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [convert_types(v) for v in value]
    elif isinstance(value, tuple):
        return [convert_types(v) for v in value]
    elif isinstance(value, set):
        return [convert_types(v) for v in value]
    else:
        return value

def main():
    """Main function to handle requests from Node.js"""
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: cbor_bridge.py <library> <action> [data]"}))
        sys.exit(1)

    library = sys.argv[1]  # 'cbor2' or 'dag-cbor'
    action = sys.argv[2]    # 'encode' or 'decode'

    try:
        if action == 'encode':
            # Read JSON data from stdin
            data = json.load(sys.stdin)

            if library == 'cbor2':
                result = cbor2_encode(data)
            elif library == 'dag-cbor':
                result = dag_cbor_encode(data)
            else:
                raise ValueError(f"Unknown library: {library}")

            print(json.dumps({"success": True, "result": result}))

        elif action == 'decode':
            # Read hex string from stdin
            hex_string = sys.stdin.read().strip()

            if library == 'cbor2':
                result = cbor2_decode(hex_string)
            elif library == 'dag-cbor':
                result = dag_cbor_decode(hex_string)
            else:
                raise ValueError(f"Unknown library: {library}")

            print(json.dumps({"success": True, "result": result}))

        else:
            raise ValueError(f"Unknown action: {action}")

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
