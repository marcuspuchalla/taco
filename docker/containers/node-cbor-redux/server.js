/**
 * CBOR Test Container - Node.js with cbor-redux library
 */

const http = require('http');
const { encode, decode } = require('cbor-redux');

const PORT = 8080;
const LIBRARY_NAME = 'cbor-redux';
const LIBRARY_VERSION = '1.0.0';

function toJsonSafe(value) {
  if (value === undefined) return { __cbor_undefined__: true };
  if (value === null) return null;

  if (value instanceof ArrayBuffer) {
    return { __cbor_bytes__: Buffer.from(value).toString('hex') };
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return { __cbor_bytes__: Buffer.from(value).toString('hex') };
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { __cbor_float__: 'NaN' };
    if (value === Infinity) return { __cbor_float__: 'Infinity' };
    if (value === -Infinity) return { __cbor_float__: '-Infinity' };
    return value;
  }

  if (typeof value === 'bigint') {
    if (value > 9007199254740991n || value < -9007199254740991n) {
      return value.toString();
    }
    return Number(value);
  }

  if (value instanceof Map) {
    const obj = {};
    for (const [k, v] of value) {
      const key = typeof k === 'object' ? JSON.stringify(toJsonSafe(k)) : String(k);
      obj[key] = toJsonSafe(v);
    }
    return obj;
  }

  if (Array.isArray(value)) return value.map(toJsonSafe);

  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = toJsonSafe(v);
    }
    return result;
  }

  return value;
}

function fromJsonSafe(value) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'object' && !Array.isArray(value)) {
    if ('__cbor_bytes__' in value) {
      const buf = Buffer.from(value.__cbor_bytes__, 'hex');
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    if ('__cbor_float__' in value) {
      if (value.__cbor_float__ === 'NaN') return NaN;
      if (value.__cbor_float__ === 'Infinity') return Infinity;
      if (value.__cbor_float__ === '-Infinity') return -Infinity;
    }
    if ('__cbor_undefined__' in value) return undefined;

    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = fromJsonSafe(v);
    }
    return result;
  }

  if (Array.isArray(value)) return value.map(fromJsonSafe);
  return value;
}

function decodeHex(hexString) {
  const startTime = process.hrtime.bigint();
  try {
    const bytes = Buffer.from(hexString, 'hex');
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const result = decode(arrayBuffer);
    const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    return { success: true, result: toJsonSafe(result), duration_ms: duration };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function encodeValue(value) {
  const startTime = process.hrtime.bigint();
  try {
    const jsValue = fromJsonSafe(value);
    const arrayBuffer = encode(jsValue);
    const hex = Buffer.from(arrayBuffer).toString('hex');
    const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    return { success: true, hex, duration_ms: duration };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', library: LIBRARY_NAME, version: LIBRARY_VERSION, language: 'nodejs' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/decode') {
      const body = await parseBody(req);
      if (!body.hex) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing "hex" field' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(decodeHex(body.hex)));
      return;
    }

    if (req.method === 'POST' && req.url === '/encode') {
      const body = await parseBody(req);
      if (!('value' in body)) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing "value" field' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(encodeValue(body.value)));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`CBOR test container (${LIBRARY_NAME} ${LIBRARY_VERSION}) listening on port ${PORT}`);
});
