# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Support for programmatic hooks via Hook instances in addition to URL-based hooks
- `name` getter requirement for Hook interface
- LocalHookClient implementation for programmatic hooks
- Integration tests demonstrating full MCP pipeline with programmatic hooks

### Changed
- Refactored HookClient from class to interface with RemoteHookClient and LocalHookClient implementations
- Configuration structure improvements:
  - Moved `config.server` fields to top level (`config.transportType` and `config.port`)
  - Renamed `client` to `target` for clarity
  - Renamed `target.type` to `target.transportType` for consistency
  - Changed transport type value from "stream" to "httpStream" for consistency
  - Made `port` optional for stdio transport using discriminated union types
- Removed hook client caching to prevent shared state issues in tests

### Fixed
- Test isolation issues caused by shared hook client cache

## [0.1.0] - 2025-01-06

### Added
- Programmatic API with `createPassthroughProxy` function
- TypeScript type exports for better type safety
- Support for custom client factories
- Flattened configuration interface for easier use
- Separate CLI and library entry points

### Changed
- Refactored from CLI-only tool to a library with CLI support
- Improved documentation with programmatic usage examples
- **BREAKING**: Changed from config object to flattened options in `createPassthroughProxy`

## [0.0.2] - Previous version

### Added
- Initial passthrough MCP server implementation
- Hook middleware support
- Multiple transport types (HTTP Stream, SSE, stdio)
- tRPC-based hook system