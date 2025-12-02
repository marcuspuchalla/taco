# Contributing to TACO

Thank you for your interest in contributing to TACO (TACO's A CBOR Observer)!

## Ways to Contribute

### Adding Test Cases

Test cases are JSON files in the `tests/` directory. To add a new test:

1. Choose the appropriate category:
   - `tests/core/` - RFC 8949 compliance tests
   - `tests/cardano/` - Cardano blockchain specific tests
   - `tests/edge_cases/` - Malformed input, boundaries, canonical encoding

2. Add your test case to the relevant JSON file:
   ```json
   {
     "id": "unique-test-id",
     "description": "What this test validates",
     "inputHex": "cbor hex without 0x prefix",
     "expectedOutput": { "decoded": "value" },
     "shouldSucceed": true
   }
   ```

3. Run the test suite to verify: `cd docker && docker compose up --abort-on-container-exit`

### Adding a New CBOR Library

1. Create a directory: `docker/containers/language-library/`

2. Add a `Dockerfile` and implement an HTTP server with these endpoints:
   - `GET /health` - Returns `{"status": "ok", "library": "name", "version": "x.y.z"}`
   - `POST /decode` - Accepts `{"hex": "..."}`, returns `{"success": true, "result": ...}`
   - `POST /encode` - Accepts `{"value": ..."}`, returns `{"success": true, "hex": "..."}`

3. See `docker/PROTOCOL.md` for the full specification

4. Add your service to `docker/docker-compose.yml`

5. Test with: `docker compose up --abort-on-container-exit`

### Reporting Bugs

Please open a GitHub Issue with:
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Docker and OS version

### Pull Requests

**Important:** Before submitting any pull request, you must run the complete test suite to ensure no regression in quality.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. **Run the full test suite:**
   ```bash
   cd docker
   docker compose up --abort-on-container-exit
   ```
5. Verify that pass rates have not decreased compared to the baseline results
6. Submit a pull request with:
   - A clear description of your changes
   - Confirmation that tests were run
   - Any changes in pass rates (if applicable)

Pull requests that introduce test regressions will not be merged.

## Code Style

- Keep implementations simple (KISS principle)
- Each container should be self-contained
- Test cases should include diagnostic notation when possible
- Follow existing patterns in the codebase

## Questions?

Open a GitHub Issue with the `question` label.
