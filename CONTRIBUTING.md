# Contributing to @civic/mcp-tools

Thank you for your interest in contributing to the MCP Tools project! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/mcp-tools.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Submit a pull request

## Development Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint
```

## Guidelines

### Code Style

- We use TypeScript for all code
- Follow the existing code style (enforced by Biome)
- Write clear, self-documenting code
- Add JSDoc comments for public APIs

### Testing

- Write tests for new functionality
- Ensure all tests pass before submitting PR
- Aim for high test coverage

### Commit Messages

- Use clear, descriptive commit messages
- Follow conventional commit format when possible
- Reference issues in commit messages when applicable

### Pull Requests

- Keep PRs focused on a single feature/fix
- Update documentation as needed
- Add tests for new functionality
- Ensure CI passes before requesting review

## Creating a New Hook

If you're contributing a new hook:

1. Create a new package in `packages/`
2. Follow the structure of existing hooks
3. Extend `AbstractHook` from `@civic/hook-common`
4. Add comprehensive tests
5. Document the hook's purpose and usage
6. Add an example to the test configurations

## Questions?

Feel free to open an issue for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.