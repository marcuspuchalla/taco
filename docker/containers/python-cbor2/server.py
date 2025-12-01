#!/usr/bin/env python3
"""
CBOR Test Container - Python with cbor2 library
Implements the standard HTTP bridge protocol
"""

import json
import math
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any

import cbor2

PORT = 8080
LIBRARY_NAME = 'cbor2'
LIBRARY_VERSION = '5.6.5'
LANGUAGE = 'python'


def to_json_safe(value: Any) -> Any:
    """Convert Python value to JSON-safe format with type markers."""

    if value is None:
        return None

    if isinstance(value, bytes):
        return {'__cbor_bytes__': value.hex()}

    if isinstance(value, bytearray):
        return {'__cbor_bytes__': bytes(value).hex()}

    if isinstance(value, float):
        if math.isnan(value):
            return {'__cbor_float__': 'NaN'}
        if math.isinf(value):
            return {'__cbor_float__': 'Infinity' if value > 0 else '-Infinity'}
        return value

    if isinstance(value, int):
        # Large integers beyond JS safe range as strings
        if value > 9007199254740991 or value < -9007199254740991:
            return str(value)
        return value

    # Handle cbor2 Tag objects
    if isinstance(value, cbor2.CBORTag):
        return {
            '__cbor_tag__': value.tag,
            '__cbor_value__': to_json_safe(value.value)
        }

    if isinstance(value, dict):
        result = {}
        for k, v in value.items():
            # Convert non-string keys
            if isinstance(k, bytes):
                key = k.hex()
            elif isinstance(k, int):
                key = str(k)
            elif isinstance(k, str):
                key = k
            else:
                key = json.dumps(to_json_safe(k))
            result[key] = to_json_safe(v)
        return result

    if isinstance(value, (list, tuple)):
        return [to_json_safe(v) for v in value]

    if isinstance(value, set):
        return [to_json_safe(v) for v in value]

    return value


def from_json_safe(value: Any) -> Any:
    """Convert JSON value with type markers back to Python."""

    if value is None:
        return None

    if isinstance(value, dict):
        if '__cbor_bytes__' in value:
            return bytes.fromhex(value['__cbor_bytes__'])

        if '__cbor_float__' in value:
            float_val = value['__cbor_float__']
            if float_val == 'NaN':
                return float('nan')
            if float_val == 'Infinity':
                return float('inf')
            if float_val == '-Infinity':
                return float('-inf')

        if '__cbor_tag__' in value and '__cbor_value__' in value:
            return cbor2.CBORTag(value['__cbor_tag__'], from_json_safe(value['__cbor_value__']))

        if '__cbor_undefined__' in value:
            return cbor2.undefined

        return {k: from_json_safe(v) for k, v in value.items()}

    if isinstance(value, list):
        return [from_json_safe(v) for v in value]

    return value


def decode_cbor(hex_string: str) -> dict:
    """Decode CBOR hex string."""
    start_time = time.perf_counter()

    try:
        data = bytes.fromhex(hex_string)
        result = cbor2.loads(data)
        json_result = to_json_safe(result)

        duration_ms = (time.perf_counter() - start_time) * 1000

        return {
            'success': True,
            'result': json_result,
            'duration_ms': duration_ms
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def encode_cbor(value: Any) -> dict:
    """Encode value to CBOR hex string."""
    start_time = time.perf_counter()

    try:
        py_value = from_json_safe(value)
        encoded = cbor2.dumps(py_value)
        hex_string = encoded.hex()

        duration_ms = (time.perf_counter() - start_time) * 1000

        return {
            'success': True,
            'hex': hex_string,
            'duration_ms': duration_ms
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


class CBORHandler(BaseHTTPRequestHandler):
    """HTTP request handler for CBOR operations."""

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

    def send_json(self, status: int, data: dict):
        """Send JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        """Handle GET requests."""
        if self.path == '/health':
            self.send_json(200, {
                'status': 'ok',
                'library': LIBRARY_NAME,
                'version': LIBRARY_VERSION,
                'language': LANGUAGE
            })
        else:
            self.send_json(404, {'error': 'Not found'})

    def do_POST(self):
        """Handle POST requests."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode()
            data = json.loads(body)

            if self.path == '/decode':
                if 'hex' not in data:
                    self.send_json(400, {'success': False, 'error': 'Missing "hex" field'})
                    return
                result = decode_cbor(data['hex'])
                self.send_json(200, result)

            elif self.path == '/encode':
                if 'value' not in data:
                    self.send_json(400, {'success': False, 'error': 'Missing "value" field'})
                    return
                result = encode_cbor(data['value'])
                self.send_json(200, result)

            else:
                self.send_json(404, {'error': 'Not found'})

        except json.JSONDecodeError:
            self.send_json(400, {'success': False, 'error': 'Invalid JSON'})
        except Exception as e:
            self.send_json(500, {'success': False, 'error': str(e)})


def main():
    """Start the HTTP server."""
    server = HTTPServer(('0.0.0.0', PORT), CBORHandler)
    print(f'CBOR test container ({LIBRARY_NAME} {LIBRARY_VERSION}) listening on port {PORT}')
    server.serve_forever()


if __name__ == '__main__':
    main()
