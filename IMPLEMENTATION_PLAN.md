# Implementation Plan

## Scope
This plan tracks audit findings, why each item matters, how to address it, and where to implement changes. Items completed in this patch are marked accordingly.

## To-Do List

| Status | Item | Why Fix | How Fix | Where |
| --- | --- | --- | --- | --- |
| Done | Normalize hex input before decoding | Prevents parser-dependent behavior and inconsistent results across libraries | Strip whitespace and normalize hex in the Docker runner before calling `/decode` and `/encode` | `docker/runner/runner.js` |
| Done | Interpret CBOR tags consistently during comparison | Aligns tag semantics with expected outputs and avoids penalizing tag-preserving libraries | Add tag interpretation for common tags (0,1,2,3,24,102,121-127,258,55799) and fall back to unwrapping | `docker/runner/runner.js`, `docker/PROTOCOL.md` |
| Done | Add encode coverage after successful decode | Surfaces encoder failures and basic round-trip issues | Call `/encode` with the decoded JSON-safe result and fail when encode fails | `docker/runner/runner.js` |
| Done | Enforce non-canonical input detection via encode check | Prevents canonical-violating encoders from passing canonical tests | If `errorType` is `non-canonical`, fail when re-encoded hex matches the non-canonical input | `docker/runner/runner.js` |
| Done | Harden container runtime defaults | Reduces container privilege and filesystem attack surface | Apply `no-new-privileges`, drop caps, read-only rootfs, and tmpfs for `/tmp` | `docker/docker-compose.yml` |
| Done | Add request size limits in container servers | Prevents memory exhaustion from oversized JSON or hex payloads | Enforce max body size in each HTTP server (reject >10MB) | `docker/containers/**/server.*` |
| Open | Pin container dependencies to exact versions and add lockfiles | Improves reproducibility and reduces supply-chain drift | Add lockfiles (npm/pip/gem/cargo/go) or pin exact versions and verify on build | `docker/containers/**` |
| Open | Extend canonical testing beyond encode check | Better detects canonical encoding and ordering behavior | Add canonical expected hex outputs or a canonical encoder path for comparison | `tests/edge_cases/canonical.json`, `docker/runner/runner.js` |
| Open | Validate tests prior to execution | Prevents malformed tests from silently passing through | Run the validator and surface warnings/errors before execution | `src/test-runner/index.ts` |
| Done | Document tag expectations for semantic vs preserved tags | Avoids confusion for implementers across languages | Expand protocol notes and document required behavior per tag class | `docker/PROTOCOL.md`, `docs/` |
| Done | Consider resource limits for CPU/memory | Reduces DoS risk and improves reproducibility | Add `mem_limit`/`cpus`/`pids_limit` where feasible | `docker/docker-compose.yml` |

## Notes
- The Docker runner now normalizes hex, interprets tag markers to match expected outputs, and adds an encode pass after decode.
- Non-canonical inputs are now flagged when an encoder preserves non-canonical forms.
- All container servers now enforce a 10MB max body size limit.
- Docker containers now have resource limits: 512MB memory, 1 CPU, 100 PIDs max.
- PROTOCOL.md now includes detailed documentation for tag semantics (semantic vs preserved vs unwrapped).
