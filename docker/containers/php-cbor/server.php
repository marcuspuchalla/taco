<?php
/**
 * CBOR Test Container - PHP with spomky-labs/cbor-php
 */

require_once __DIR__ . '/vendor/autoload.php';

use CBOR\Decoder;
use CBOR\StringStream;
use CBOR\ByteStringObject;
use CBOR\TextStringObject;
use CBOR\UnsignedIntegerObject;
use CBOR\NegativeIntegerObject;
use CBOR\ListObject;
use CBOR\MapObject;
use CBOR\Tag;
use CBOR\IndefiniteLengthByteStringObject;
use CBOR\IndefiniteLengthTextStringObject;
use CBOR\IndefiniteLengthListObject;
use CBOR\IndefiniteLengthMapObject;

const PORT = 8080;
const LIBRARY_NAME = 'spomky-labs/cbor-php';
const LIBRARY_VERSION = '3.1.0';

function toJsonSafe($item) {
    if ($item === null) return null;

    // Handle simple types
    if ($item instanceof \CBOR\OtherObject\FalseObject) return false;
    if ($item instanceof \CBOR\OtherObject\TrueObject) return true;
    if ($item instanceof \CBOR\OtherObject\NullObject) return null;
    if ($item instanceof \CBOR\OtherObject\UndefinedObject) {
        return ['__cbor_undefined__' => true];
    }

    // Handle floats
    if ($item instanceof \CBOR\OtherObject\HalfPrecisionFloatObject ||
        $item instanceof \CBOR\OtherObject\SinglePrecisionFloatObject ||
        $item instanceof \CBOR\OtherObject\DoublePrecisionFloatObject) {
        $value = $item->normalize();
        if (is_nan($value)) return ['__cbor_float__' => 'NaN'];
        if (is_infinite($value) && $value > 0) return ['__cbor_float__' => 'Infinity'];
        if (is_infinite($value) && $value < 0) return ['__cbor_float__' => '-Infinity'];
        return $value;
    }

    // Handle integers
    if ($item instanceof UnsignedIntegerObject || $item instanceof NegativeIntegerObject) {
        $value = $item->normalize();
        // Handle big integers as strings
        if (is_string($value)) return $value;
        if ($value > 9007199254740991 || $value < -9007199254740991) {
            return (string)$value;
        }
        return $value;
    }

    // Handle byte strings
    if ($item instanceof ByteStringObject || $item instanceof IndefiniteLengthByteStringObject) {
        $bytes = $item->normalize();
        return ['__cbor_bytes__' => bin2hex($bytes)];
    }

    // Handle text strings
    if ($item instanceof TextStringObject || $item instanceof IndefiniteLengthTextStringObject) {
        return $item->normalize();
    }

    // Handle arrays/lists
    if ($item instanceof ListObject || $item instanceof IndefiniteLengthListObject) {
        $result = [];
        foreach ($item->normalize() as $element) {
            $result[] = toJsonSafe($element);
        }
        return $result;
    }

    // Handle maps
    if ($item instanceof MapObject || $item instanceof IndefiniteLengthMapObject) {
        $result = [];
        foreach ($item->normalize() as $key => $value) {
            $keyStr = is_string($key) ? $key : json_encode(toJsonSafe($key));
            $result[$keyStr] = toJsonSafe($value);
        }
        return $result;
    }

    // Handle tags
    if ($item instanceof Tag) {
        return [
            '__cbor_tag__' => $item->getTagId(),
            '__cbor_value__' => toJsonSafe($item->getValue())
        ];
    }

    // Fallback: try to normalize
    if (is_object($item) && method_exists($item, 'normalize')) {
        return $item->normalize();
    }

    // If it's a regular array, convert it
    if (is_array($item)) {
        $result = [];
        foreach ($item as $key => $value) {
            $result[$key] = toJsonSafe($value);
        }
        return $result;
    }

    return $item;
}

function handleHealth(): array {
    return [
        'status' => 'ok',
        'library' => LIBRARY_NAME,
        'version' => LIBRARY_VERSION,
        'language' => 'php'
    ];
}

function handleDecode(array $body): array {
    if (!isset($body['hex'])) {
        return ['success' => false, 'error' => 'Missing "hex" field'];
    }

    $hex = $body['hex'];
    $start = microtime(true);

    try {
        $bytes = hex2bin($hex);
        if ($bytes === false) {
            return ['success' => false, 'error' => 'Invalid hex string'];
        }

        $stream = StringStream::create($bytes);
        $decoder = Decoder::create();
        $decoded = $decoder->decode($stream);

        $duration = (microtime(true) - $start) * 1000;

        return [
            'success' => true,
            'result' => toJsonSafe($decoded),
            'duration_ms' => $duration
        ];
    } catch (Throwable $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function handleEncode(array $body): array {
    // Encoding is complex with this library - simplified implementation
    return ['success' => false, 'error' => 'Encoding not fully implemented in PHP container'];
}

// Simple HTTP server
$socket = stream_socket_server("tcp://0.0.0.0:" . PORT, $errno, $errstr);
if (!$socket) {
    die("Failed to create socket: $errstr ($errno)\n");
}

echo "CBOR test container (" . LIBRARY_NAME . " " . LIBRARY_VERSION . ") listening on port " . PORT . "\n";

while ($conn = stream_socket_accept($socket, -1)) {
    $request = '';
    while (($line = fgets($conn)) !== false) {
        $request .= $line;
        if ($line === "\r\n") break;
    }

    // Parse request
    preg_match('/^(\w+)\s+(\S+)/', $request, $matches);
    $method = $matches[1] ?? 'GET';
    $path = $matches[2] ?? '/';

    // Get content length and read body
    $body = '';
    if (preg_match('/Content-Length:\s*(\d+)/i', $request, $clMatches)) {
        $body = fread($conn, (int)$clMatches[1]);
    }

    // Route request
    $response = null;
    $status = 200;

    if ($method === 'GET' && $path === '/health') {
        $response = handleHealth();
    } elseif ($method === 'POST' && $path === '/decode') {
        $bodyArr = json_decode($body, true) ?? [];
        $response = handleDecode($bodyArr);
        if (!$response['success'] && isset($bodyArr['hex']) === false) {
            $status = 400;
        }
    } elseif ($method === 'POST' && $path === '/encode') {
        $bodyArr = json_decode($body, true) ?? [];
        $response = handleEncode($bodyArr);
    } else {
        $response = ['error' => 'Not found'];
        $status = 404;
    }

    $json = json_encode($response, JSON_UNESCAPED_SLASHES);
    $httpResponse = "HTTP/1.1 $status OK\r\n";
    $httpResponse .= "Content-Type: application/json\r\n";
    $httpResponse .= "Content-Length: " . strlen($json) . "\r\n";
    $httpResponse .= "Connection: close\r\n";
    $httpResponse .= "\r\n";
    $httpResponse .= $json;

    fwrite($conn, $httpResponse);
    fclose($conn);
}
