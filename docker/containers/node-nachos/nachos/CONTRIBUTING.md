# Contributing to NACHOS

Thank you for your interest in contributing to NACHOS (Not Another CBOR Handling Object System)! This document provides guidelines and instructions for contributing.

## Development Philosophy

This project follows **Test-Driven Development (TDD)** and **Composable Architecture** principles. Please read this document carefully before submitting contributions.

## Getting Started

### Prerequisites

- Node.js >= 16.0.0
- npm >= 7.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/marcuspuchalla/nachos.git
cd nachos

# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build
```

## Development Workflow

### 1. Test-Driven Development (MANDATORY)

**ALWAYS write tests BEFORE implementation:**

1. **Define the test case** with real-world CBOR examples
2. **Write at least 3 distinct test cases** per function
3. **Run the test** (it should fail initially - RED)
4. **Implement the function** to pass the test (GREEN)
5. **Refactor** if needed while keeping tests green (REFACTOR)

### 2. Composable Architecture (NO CLASSES)

**Use composables pattern - Classes are NOT allowed:**

```typescript
// WRONG - Class-based
class CborParser {
  parse(data: Uint8Array) { }
}

// CORRECT - Composable
export function useCborParser() {
  const parse = (data: Uint8Array) => { }
  const validate = (hex: string) => { }

  return {
    parse,
    validate
  }
}
```

### 3. Code Quality Standards

- **All functions must have explicit TypeScript types**
- **No `any` types** (use `unknown` if needed)
- **Pure functions** - no side effects, no shared mutable state
- **JSDoc documentation** for all public functions

## Making Changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions/changes

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes following TDD
4. Ensure all tests pass (`npm test`)
5. Ensure type checking passes (`npm run type-check`)
6. Update documentation if needed
7. Submit a pull request

### Pull Request Checklist

- [ ] Tests added/updated for all changes
- [ ] All tests passing
- [ ] TypeScript types are correct
- [ ] No `any` types introduced
- [ ] JSDoc added for new public functions
- [ ] CHANGELOG.md updated (for significant changes)
- [ ] Composable pattern followed (no classes)

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test src/parser/__tests__/cbor-integer.test.ts
```

### Test Requirements

- Minimum 90% code coverage
- All RFC 8949 test vectors must pass
- Real-world Cardano transaction tests must pass

## Code Style

- Use consistent formatting (Prettier configured)
- Follow TypeScript best practices
- Keep functions small and focused
- Use descriptive variable and function names

## Reporting Issues

### Bug Reports

Include:
- Version of @marcuspuchalla/nachos
- Node.js version
- Minimal reproduction code
- Expected vs actual behavior
- CBOR hex string that causes the issue

### Feature Requests

Include:
- Use case description
- Proposed API design
- Example usage code

## Security

For security vulnerabilities, please email security@marcuspuchalla.com instead of opening a public issue.

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 License.

## Questions?

Open a GitHub Discussion for questions about contributing.
