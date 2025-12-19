# Security and Software Audit Request

## Project Overview

**Project Name:** TACO (TACO's A CBOR Observer)
**Repository:** https://github.com/marcuspuchalla/taco
**License:** GPL-3.0
**Version:** 0.1.1

TACO is a comprehensive testing framework for validating CBOR (Concise Binary Object Representation) encoder/decoder implementations. The project tests 19 CBOR libraries across 10 programming languages using a Docker-based test infrastructure.

### Architecture

- **Test Runner:** Node.js-based orchestrator running in Docker
- **Library Containers:** Isolated Docker containers for each CBOR library (Node.js, Python, Rust, Go, C, Java, C#, PHP, Ruby, Perl)
- **Test Cases:** 358 JSON-defined test cases covering RFC 8949 compliance, Cardano blockchain data, and edge cases
- **Communication:** HTTP API between test runner and library containers

### Key Components

| Component | Description |
|-----------|-------------|
| `docker/runner/` | Test orchestration and result aggregation |
| `docker/containers/` | 19 isolated CBOR library implementations |
| `tests/` | JSON test case definitions |
| `src/generators/` | Test case generation scripts |

---

## Audit Scope

We are requesting a comprehensive review covering the following areas:

### 1. Code Quality Review

- Overall code structure and maintainability
- Adherence to language-specific best practices (TypeScript, Python, Rust, Go, etc.)
- Error handling patterns across all container implementations
- Documentation completeness and accuracy

### 2. Security Assessment

- Docker container isolation and configuration
- HTTP API security between containers
- Input validation and sanitization in decode/encode endpoints
- Potential for resource exhaustion or denial-of-service
- Dependency vulnerability analysis for all language ecosystems
- Secret/credential handling (if any)

### 3. CBOR Conversion Quality

- Correctness of CBOR encoding/decoding across implementations
- Handling of edge cases (malformed input, boundary values, canonical encoding)
- BigInt and large number handling
- UTF-8 string validation
- Tagged value support (especially Cardano Plutus tags 121-127, 102)

### 4. Testing Quality

- Test case coverage and completeness against RFC 8949
- Accuracy of expected outputs in test definitions
- Validity of pass/fail determinations
- Consistency of testing methodology across libraries
- Fairness of comparison (are all libraries tested equivalently?)

### 5. Test Infrastructure

- Reliability of Docker-based test execution
- Accuracy of result aggregation and reporting
- Health check and timeout handling
- Reproducibility of test results

---

## Deliverables Expected

1. **Executive Summary** - High-level findings and recommendations
2. **Detailed Findings Report** - Issue-by-issue breakdown with severity ratings
3. **Code Quality Metrics** - Quantitative assessment where applicable
4. **Remediation Recommendations** - Prioritized list of suggested improvements
5. **Test Case Review** - Assessment of test validity and coverage gaps

---

## Contact

For questions or to discuss engagement terms, please open an issue on the repository or contact the maintainer.

---

*Document generated: December 2024*
