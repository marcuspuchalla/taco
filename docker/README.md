# TACO - Docker Architecture

This directory contains the Docker-based testing infrastructure for running CBOR library tests in isolated containers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Runner Container                         │
│         Reads test cases, sends requests, generates reports     │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  node-borc      │  │  python-cbor2   │  │  rust-ciborium  │
│  ─────────────  │  │  ─────────────  │  │  ─────────────  │
│  Node.js 20     │  │  Python 3.12    │  │  Rust 1.75      │
│  + borc lib     │  │  + cbor2 lib    │  │  + ciborium     │
│  Port: 8081     │  │  Port: 8082     │  │  Port: 8083     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Quick Start

### Run All Tests

```bash
./run-tests.sh
```

This will:
1. Build all containers
2. Start library containers
3. Wait for health checks
4. Run test suite against all libraries
5. Generate reports in `./reports/`

### Run with Rebuild

```bash
./run-tests.sh --build
```

### Test a Single Container

```bash
./test-single-container.sh node-borc
./test-single-container.sh python-cbor2
./test-single-container.sh rust-ciborium
```

## Directory Structure

```
docker/
├── docker-compose.yml       # Orchestration config
├── run-tests.sh             # Main test script
├── test-single-container.sh # Single container test
├── PROTOCOL.md              # HTTP API specification
├── README.md                # This file
│
├── runner/                  # Test orchestrator
│   ├── Dockerfile
│   ├── package.json
│   └── runner.js
│
├── containers/              # Library containers
│   ├── node-borc/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js
│   │
│   ├── python-cbor2/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── server.py
│   │
│   └── rust-ciborium/
│       ├── Dockerfile
│       ├── Cargo.toml
│       └── src/main.rs
│
└── reports/                 # Generated reports (gitignored)
    ├── summary.json
    ├── node-borc-results.json
    ├── python-cbor2-results.json
    └── rust-ciborium-results.json
```

## HTTP Protocol

Each container implements the same HTTP API (see [PROTOCOL.md](./PROTOCOL.md)):

### Health Check
```bash
curl http://localhost:8081/health
# {"status":"ok","library":"borc","version":"3.0.0","language":"nodejs"}
```

### Decode CBOR
```bash
curl -X POST http://localhost:8081/decode \
  -H "Content-Type: application/json" \
  -d '{"hex": "1864"}'
# {"success":true,"result":100,"duration_ms":0.123}
```

### Encode to CBOR
```bash
curl -X POST http://localhost:8081/encode \
  -H "Content-Type: application/json" \
  -d '{"value": 100}'
# {"success":true,"hex":"1864","duration_ms":0.123}
```

## Adding New Libraries

### 1. Create Container Directory

```bash
mkdir -p containers/go-cbor
```

### 2. Implement HTTP Server

Create a server that implements:
- `GET /health` - Health check
- `POST /decode` - Decode CBOR hex to JSON
- `POST /encode` - Encode JSON to CBOR hex

See existing containers for reference.

### 3. Create Dockerfile

```dockerfile
FROM golang:1.21-alpine
# ... build and run
EXPOSE 8080
HEALTHCHECK ...
CMD ["./server"]
```

### 4. Add to docker-compose.yml

```yaml
services:
  go-cbor:
    build:
      context: ./containers/go-cbor
    ports:
      - "8084:8080"
    networks:
      - cbor-test-network
```

### 5. Update Test Runner

Add the new container to the `CONTAINERS` environment variable:

```yaml
environment:
  - CONTAINERS=node-borc:8080,python-cbor2:8080,rust-ciborium:8080,go-cbor:8080
```

## Type Mapping

Since JSON cannot represent all CBOR types, we use special markers:

| CBOR Type | JSON Representation |
|-----------|---------------------|
| Byte string | `{"__cbor_bytes__": "hex"}` |
| NaN | `{"__cbor_float__": "NaN"}` |
| Infinity | `{"__cbor_float__": "Infinity"}` |
| -Infinity | `{"__cbor_float__": "-Infinity"}` |
| Large integer | `"12345678901234567890"` (string) |
| Tag | `{"__cbor_tag__": 121, "__cbor_value__": [...]}` |

## Benefits

1. **No library code in main repo** - Dependencies stay in containers
2. **Fair comparison** - Each library in its native environment
3. **Easy to add languages** - Just add a new container
4. **Parallel testing** - Containers run simultaneously
5. **CI/CD ready** - Works in any Docker environment
6. **Portable** - Any developer can run tests with Docker

## Troubleshooting

### Container won't start
```bash
docker logs cbor-test-node-borc
```

### Health check failing
```bash
curl -v http://localhost:8081/health
```

### Test runner can't connect
Check that containers are on the same network:
```bash
docker network ls
docker network inspect docker_cbor-test-network
```

## License

MIT
