# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-01

### Added

#### Core Features
- **RFC 8949 compliant CBOR decoder** - Full implementation of all major types (0-7)
- **RFC 8949 compliant CBOR encoder** - Roundtrip encoding/decoding support
- **Source map generation** - Bidirectional hex-to-JSON linking for debugging
- **Cardano blockchain support** - Plutus constructor tags (121-127, 1280-1400, 102)
- **Zero runtime dependencies** - Pure TypeScript implementation

#### CBOR Types Supported
- **Major Type 0**: Unsigned integers (0 to 2^64-1)
- **Major Type 1**: Negative integers (-1 to -2^64)
- **Major Type 2**: Byte strings (definite and indefinite length)
- **Major Type 3**: Text strings with UTF-8 validation
- **Major Type 4**: Arrays (definite and indefinite length)
- **Major Type 5**: Maps with various key types
- **Major Type 6**: Tagged values (standard and Cardano-specific)
- **Major Type 7**: Floats (16/32/64-bit), booleans, null, undefined

#### Security Features
- DoS protection with configurable limits
- Maximum input size (default: 10MB)
- Maximum nesting depth (default: 64)
- Maximum parse time (default: 1000ms)
- Tag depth limiting (RUSTSEC-2019-0025 mitigation)
- Bignum size limiting (CVE-2020-28491 mitigation)

#### Encoding Features
- Canonical/deterministic encoding (RFC 8949 Section 4.2.1)
- Indefinite-length encoding option
- Map key type preservation during roundtrip
- Integer key detection for Cardano metadata

#### API
- Functional API: `decode()`, `encode()`, `decodeWithSourceMap()`
- Class API: `CborDecoder`, `CborEncoder`
- Tree-shakeable exports via subpaths
- Full TypeScript type definitions

#### Testing
- 99.4% test coverage
- 83 RFC 8949 Appendix A test vectors
- Real-world Cardano transaction tests
- Security/DoS protection tests

### Known Limitations
- No streaming API for large files (planned for v1.0)
- Source map generation doubles memory usage
- No Web Worker wrapper (planned for v1.0)

---

## Version History

- **0.1.0** - Initial release with full CBOR support and Cardano integration
