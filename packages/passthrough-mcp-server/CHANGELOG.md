# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- MCP Authorization specification compliance
  - 401 response passthrough for httpStream and SSE transports
  - Authorization header forwarding to target servers
  - Non-MCP request proxying (all non-/mcp paths routed directly to target)
- Custom HTTP proxy server implementation replacing FastMCP
- Per-request MCP server instances following stateless pattern
- Session-based authorization context management
- Configurable MCP endpoint (default: /mcp)

### Changed
- **BREAKING**: Migrated from FastMCP to direct MCP SDK usage
- **BREAKING**: Default MCP endpoint changed from /stream to /mcp
- Updated to @modelcontextprotocol/sdk version 1.13.0
- Refactored server architecture for authorization support
- Enhanced session management to include authorization headers

### Fixed
- Proper handling of authorization flows for OAuth-enabled MCP servers
- Type safety improvements throughout the codebase

## [0.2.0] - 2025-01-09

### Added
- Simplified Hook API for external service integration
  - New `applyHooks` function providing a unified interface for processing request/response hooks
  - Hook creation utilities: `createHookClient` and `createHookClients`
  - Export of `AbstractHook` as a value for easy custom hook creation
  - Comprehensive error handling with `messageFromError` utility
- Enhanced exports from `@civic/hook-common` making the library self-contained
- Validation for tool call data in `applyHooks` function
- Processor enhancements to include rejection reasons
- Example demonstrating hook API usage patterns (`hook-api-example.ts`)
- Full test coverage for new functionality

### Added (from previous unreleased)
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