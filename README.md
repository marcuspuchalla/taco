<p align="center">
  <img src="assets/taco1.jpg" alt="TACO Logo" height="242">
</p>

<h1 align="center">TACO</h1>

<p align="center"><strong>TACO's A CBOR Observer</strong></p>

> A comprehensive testing framework for validating CBOR encoder/decoder implementations

> **Disclaimer:** The test framework may contain bugs that affect results. Libraries might perform better than shown here - any discrepancies are likely issues with my testing code, not the libraries themselves. If you spot issues, please [open a pull request](https://github.com/marcuspuchalla/taco/pulls). This project is under active development and I strive to treat every library fairly.

[![CI](https://github.com/marcuspuchalla/taco/actions/workflows/ci.yml/badge.svg)](https://github.com/marcuspuchalla/taco/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Libraries](https://img.shields.io/badge/libraries-19-green.svg)](#libraries-tested)
[![Languages](https://img.shields.io/badge/languages-10-orange.svg)](#libraries-tested)

Test cases derived from the official RFC 8949 specification and real Cardano blockchain data.

## Why This Exists

I built a CBOR parser from scratch for educational purposes and needed a robust way to validate it. This test suite provides:

1. **Parser validation** - Comprehensive test cases to verify correctness
2. **Library comparison** - Side-by-side results from 19 implementations across 10 languages
3. **Edge case coverage** - Malformed input, canonical encoding, and boundary values

> **Note:** The educational CBOR parser this suite was built to validate is [NACHOS](https://github.com/marcuspuchalla/nachos) (Not Another CBOR Handling Object System).

## Quick Start

Run the complete test suite using Docker:

```bash
cd docker
docker compose up --abort-on-container-exit
```

Results are saved to `docker/reports/`:
- `TEST_RESULTS.md` - Full rankings and analysis
- `summary.json` - Machine-readable summary
- Individual JSON results per library

For detailed Docker setup, troubleshooting, and architecture documentation, see [docker/README.md](docker/README.md).

## Test Results

<!-- AUTO-GENERATED-RESULTS-START -->
| Rank | Library | Language | Pass Rate |
|------|---------|----------|-----------|
| 🥇 1 | python-cbor2 | Python | **79.89%** |
| 🥈 2 | rust-ciborium | Rust | **74.86%** |
| 🥉 3 | java-cbor | Java | **74.58%** |
|  4 | node-cbor-x | Node.js | **74.02%** |
|  5 | node-cbor-js | Node.js | **74.02%** |
|  6 | csharp-cbor | C# | **74.02%** |
|  7 | node-cbor | Node.js | **73.74%** |
|  8 | ruby-cbor | Ruby | **73.18%** |
|  9 | node-nachos | Node.js | **72.63%** |
|  10 | node-borc | Node.js | **72.35%** |

*See [docker/reports/TEST_RESULTS.md](docker/reports/TEST_RESULTS.md) for full results (19 libraries tested)*
<!-- AUTO-GENERATED-RESULTS-END -->

### Libraries Tested

The test suite currently validates **19 libraries across 10 programming languages**:

| Language | Libraries | Notes |
|----------|-----------|-------|
| **Node.js** | borc, cbor-x, cbor, cbor-js, cbor-redux, tiny-cbor, cbor-sync, cborg, dag-cbor, nachos | cbor-x offers best performance |
| **Python** | [cbor2](https://github.com/agronholm/cbor2) | Most popular Python CBOR library (~220 stars) |
| **Rust** | [ciborium](https://github.com/enarx/ciborium) | Active Serde-based implementation |
| **Go** | [fxamacker/cbor](https://github.com/fxamacker/cbor) | Production-quality, used by Kubernetes |
| **C** | [libcbor](https://github.com/PJK/libcbor) | Full RFC 8949 conformance |
| **Java** | [PeterO.Cbor](https://github.com/peteroupc/CBOR-Java) | Supports arbitrary-precision numbers |
| **C#** | [PeterO.Cbor](https://github.com/peteroupc/CBOR) | .NET implementation, also available via NuGet |
| **PHP** | [spomky-labs/cbor-php](https://github.com/Spomky-Labs/cbor-php) | 4.7M+ Packagist installs |
| **Ruby** | [cbor](https://github.com/cabo/cbor-ruby) | Based on MessagePack, Apache-2.0 licensed |
| **Perl** | [CBOR::XS](https://metacpan.org/pod/CBOR::XS) | High-performance XS implementation |

## Test Cases

**358 test cases** organized into three categories:

```
tests/
├── core/                  # Core CBOR (RFC 8949)
│   ├── 01_unsigned_integers.json
│   ├── 02_negative_integers.json
│   ├── 03_byte_strings.json
│   ├── 04_text_strings.json
│   ├── 05_arrays.json
│   ├── 06_maps.json
│   ├── 07_tags.json
│   └── 08_simple_floats.json
├── cardano/              # Cardano-specific CBOR
│   ├── plutus_data.json
│   ├── transactions.json
│   └── metadata.json
└── edge_cases/           # Malformed input and boundaries
    ├── canonical.json
    ├── malformed.json
    └── limits.json
```

### Test Case Format

```json
{
  "id": "unsigned-int-001",
  "description": "Single byte integer 0",
  "inputHex": "00",
  "expectedOutput": 0,
  "shouldSucceed": true
}
```

![TACO](assets/taco2.jpg)

## Adding Your Own Library

The test infrastructure uses Docker Compose to run each CBOR library in an isolated container. Each container exposes a simple HTTP API that the test runner calls to encode/decode CBOR data. This architecture ensures:

- **Fair comparison** - Each library runs in its native environment
- **No dependency conflicts** - Libraries are completely isolated
- **Easy extensibility** - Adding a new library requires only a Dockerfile and HTTP server
- **Reproducibility** - Anyone with Docker can run the exact same tests

The HTTP protocol is simple: containers expose a health check endpoint and decode/encode endpoints that accept hex-encoded CBOR data. See [docker/PROTOCOL.md](docker/PROTOCOL.md) for the complete specification.

### Steps to Add a Library

1. Create a directory: `docker/containers/your-library/`
2. Add a `Dockerfile` that builds your HTTP server
3. Implement the required endpoints:
   - `GET /health` → `{"status": "ok", "library": "name", "version": "x.y.z"}`
   - `POST /decode` → Accepts `{"hex": "..."}`, returns `{"success": true, "result": ...}`
   - `POST /encode` → Accepts `{"value": ...}`, returns `{"success": true, "hex": "..."}`
4. Add your service to `docker/docker-compose.yml`
5. Run `docker compose up` to test

See existing containers in `docker/containers/` for reference implementations in various languages.

## Project Structure

```
taco/
├── docker/
│   ├── containers/       # One folder per CBOR library
│   ├── runner/           # Test orchestrator (Node.js)
│   ├── reports/          # Generated results (gitignored)
│   ├── docker-compose.yml
│   ├── README.md         # Detailed Docker documentation
│   └── PROTOCOL.md       # HTTP API specification
├── tests/                # JSON test case files
└── docs/                 # Reference documentation
```

## Requirements

- **Docker** and **Docker Compose**

## Related Projects

- [NACHOS](https://github.com/marcuspuchalla/nachos) - Not Another CBOR Handling Object System (the CBOR library TACO was built to test)

## License

GPL-3.0 License - see [LICENSE](LICENSE) for details.
