/**
 * CBOR Test Container - Node.js with borc library
 * Implements the standard HTTP bridge protocol
 */

const http = require('http');
const borc = require('borc');

const PORT = 8080;
const LIBRARY_NAME = 'borc';
const LIBRARY_VERSION = '3.0.0';
const LANGUAGE = 'nodejs';

/**
 * Convert JavaScript value to JSON-safe format with type markers
 */
function toJsonSafe(value) {
  if (value === undefined) {
    return { __cbor_undefined__: true };
  }

  if (value === null) {
    return null;
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __cbor_bytes__: Buffer.from(value).toString('hex') };
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return { __cbor_float__: 'NaN' };
    }
    if (value === Infinity) {
      return { __cbor_float__: 'Infinity' };
    }
    if (value === -Infinity) {
      return { __cbor_float__: '-Infinity' };
    }
    return value;
  }

  if (typeof value === 'bigint') {
    const str = value.toString();
    // Keep as string for large values
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      return str;
    }
    return Number(value);
  }

  // Handle borc Tagged values
  if (value && typeof value === 'object' && value.tag !== undefined && value.value !== undefined) {
    return {
      __cbor_tag__: Number(value.tag),
      __cbor_value__: toJsonSafe(value.value)
    };
  }

  // Handle Map objects
  if (value instanceof Map) {
    const obj = {};
    for (const [k, v] of value) {
      const key = typeof k === 'object' ? JSON.stringify(toJsonSafe(k)) : String(k);
      obj[key] = toJsonSafe(v);
    }
    return obj;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }

  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = toJsonSafe(v);
    }
    return result;
  }

  return value;
}

/**
 * Convert JSON value with type markers back to JavaScript
 */
function fromJsonSafe(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    if ('__cbor_bytes__' in value) {
      return Buffer.from(value.__cbor_bytes__, 'hex');
    }
    if ('__cbor_float__' in value) {
      switch (value.__cbor_float__) {
        case 'NaN': return NaN;
        case 'Infinity': return Infinity;
        case '-Infinity': return -Infinity;
      }
    }
    if ('__cbor_tag__' in value && '__cbor_value__' in value) {
      return new borc.Tagged(value.__cbor_tag__, fromJsonSafe(value.__cbor_value__));
    }
    if ('__cbor_undefined__' in value) {
      return undefined;
    }

    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = fromJsonSafe(v);
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map(fromJsonSafe);
  }

  return value;
}

/**
 * Decode CBOR hex string
 */
function decode(hexString) {
  const startTime = process.hrtime.bigint();

  try {
    const bytes = Buffer.from(hexString, 'hex');
    const result = borc.decode(bytes);
    const jsonResult = toJsonSafe(result);

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    return {
      success: true,
      result: jsonResult,
      duration_ms: durationMs
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Encode value to CBOR hex string
 */
function encode(value) {
  const startTime = process.hrtime.bigint();

  try {
    const jsValue = fromJsonSafe(value);
    const encoded = borc.encode(jsValue);
    const hex = Buffer.from(encoded).toString('hex');

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    return {
      success: true,
      hex: hex,
      duration_ms: durationMs
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse request body as JSON
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * HTTP server handler
 */
async function handleRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        library: LIBRARY_NAME,
        version: LIBRARY_VERSION,
        language: LANGUAGE
      }));
      return;
    }

    // Decode endpoint
    if (req.method === 'POST' && req.url === '/decode') {
      const body = await parseBody(req);
      if (!body.hex) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing "hex" field' }));
        return;
      }

      const result = decode(body.hex);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // Encode endpoint
    if (req.method === 'POST' && req.url === '/encode') {
      const body = await parseBody(req);
      if (!('value' in body)) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing "value" field' }));
        return;
      }

      const result = encode(body.value);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // Not found
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

// Start server
const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`CBOR test container (${LIBRARY_NAME} ${LIBRARY_VERSION}) listening on port ${PORT}`);
});
