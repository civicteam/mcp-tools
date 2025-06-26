# Passthrough Bundle Plan

## Overview
Refactor the MCP tools architecture to properly separate concerns between the passthrough server, proxy builder, and the runtime bundle that combines everything.

## Architecture Changes

### 1. passthrough-mcp-server
**Goal**: Remove built-in hook knowledge while maintaining backward compatibility.

#### Changes Required:
- **Remove** the `BUILTIN_HOOKS` mapping from `/packages/passthrough-mcp-server/src/utils/config.ts`
- **Rename** `/packages/passthrough-mcp-server/src/client/client.ts` to `RemoteClient.ts` for consistency
- **Keep** existing CLI and config-based usage working
- **Keep** ability to load hooks from URLs (remote hooks)

#### Usage Modes:
1. **CLI with config file** (current behavior): 
   - Reads config with hook URLs
   - Creates RemoteHookClient instances for each URL
   - Works exactly as it does today
   
2. **Programmatic with HookClient instances**:
   - createPassthroughProxy accepts pre-instantiated HookClient instances
   - Used by passthrough-bundle to pass in local hooks

### 2. passthrough-proxy-builder
**Goal**: Generate configurations without knowing hook locations.

#### Changes Required:
- Keep the list of built-in hook names in `/packages/passthrough-proxy-builder/src/hooks.ts`
- Generate configurations that only reference hooks by name
- Support both built-in hooks (by name only) and custom hooks (with URL)

### 3. passthrough-bundle (New Package)
**Goal**: Bundle everything together, handle hook loading, and create the runtime.

#### Package Structure:
```
packages/passthrough-bundle/
├── package.json
├── src/
│   ├── index.ts
│   ├── hookRegistry.ts
│   └── hookLoader.ts
├── Dockerfile
├── scripts/
│   └── build-image.sh
└── README.md
```

#### Key Components:
- **Dependencies**: Include all hook packages and passthrough-mcp-server as workspace dependencies
- **Naming Convention**: Convert hook names to package names (e.g., "AuditHook" → "@civic/audit-hook")
- **Hook Loader**: Handle the logic of loading hooks and creating HookClient instances
- **Main Entry Point**: Read config, load hooks, instantiate clients, and start passthrough-mcp-server
- **Dockerfile**: Multi-stage build that compiles everything and creates a runtime image

#### Hook Loading Flow:
1. Read the configuration file (with hook names and URLs)
2. For each hook in the config:
   - If it's a built-in hook (name only), convert name to package name
   - Dynamically import from `@civic/hook-name/hook`
   - Create a LocalHookClient instance
   - If it's a remote hook (has URL), create a RemoteHookClient instance
3. Pass the array of HookClient instances to createPassthroughProxy
4. Start the server with the fully configured proxy

#### Naming Convention:
- Hook name in config: "AuditHook"
- Package name: "@civic/audit-hook" (kebab-case)
- Import path: "@civic/audit-hook/hook"
- Alternative for compound names: "CustomDescriptionHook" → "@civic/custom-description-hook"

## Implementation Steps

### Phase 0: Initial Cleanup
1. ✅ Remove obsolete Docker files from passthrough-mcp-server (Dockerfile, docker-compose.example.yml, etc.)
2. ✅ Run `npx knip` to identify dead code across the project
3. ✅ Remove any unused dependencies and files
4. ✅ Run `pnpm lint` and fix any issues
5. ✅ Run `pnpm build` at top level to ensure everything still builds

### Phase 1: Clean up passthrough-mcp-server
1. ✅ Remove `BUILTIN_HOOKS` constant
2. ✅ Rename client.ts to RemoteClient.ts and update all imports
3. ✅ Keep existing config structure and CLI working
4. ✅ Ensure hooks can be passed as either:
   - URL strings (creates RemoteHookClient) - existing behavior
   - HookClient instances (used directly) - new capability
5. ✅ Run `npx knip` to check for dead code
6. ✅ Run `pnpm lint` and `pnpm build` at top level
7. ✅ Test both CLI and programmatic usage

### Phase 2: Update passthrough-proxy-builder
1. ✅ Ensure generated configs only use hook names
2. ✅ Remove any hook URL mappings
3. ✅ Update docker-compose template to reference new Docker image from passthrough-bundle
4. ✅ Run `npx knip` to check for dead code
5. ✅ Run `pnpm lint` and `pnpm build` at top level
6. ✅ Test that generated configs work with the new system

### Phase 3: Create passthrough-bundle package
1. ✅ Create new package with proper structure
2. ✅ Use `pnpm add` to add dependencies (NOT manual package.json edits):
   - ✅ `pnpm add @civic/passthrough-mcp-server` (workspace dependency)
   - ✅ `pnpm add @civic/simple-log-hook` (and other hooks)
3. ✅ Run `pnpm install` at top level after adding dependencies
4. ✅ Implement naming convention for hook loading
5. ✅ Create hook loader that:
   - ✅ Reads configuration
   - ✅ Loads built-in hooks via dynamic import
   - ✅ Creates RemoteHookClient for custom hooks
   - ✅ Returns array of HookClient instances
6. ✅ Create main entry point that orchestrates everything
7. ✅ Build Docker image with proper multi-stage build
8. ✅ Run `pnpm lint` and `pnpm build` at top level
9. ✅ Test the complete system

### Phase 3.5: Update Hook Packages to Export Classes
1. ✅ Update each hook package to export its class from a `/hook` subpath:
   - ✅ @civic/simple-log-hook: Export SimpleLogHook from `@civic/simple-log-hook/hook`
   - ✅ @civic/audit-hook: Export AuditHook from `@civic/audit-hook/hook`
   - ✅ @civic/guardrail-hook: Export GuardrailHook from `@civic/guardrail-hook/hook`
   - ✅ @civic/custom-description-hook: Export CustomDescriptionHook from `@civic/custom-description-hook/hook`
   - ✅ @civic/explain-hook: Export ExplainHook from `@civic/explain-hook/hook`
2. ✅ Update package.json exports field in each hook package
3. ✅ Update passthrough-bundle to use dynamic imports with LocalHookClient
4. ✅ Remove the temporary port mapping workaround from hookLoader.ts
5. ✅ Test that all hooks load correctly as LocalHookClient instances

### Phase 4: Final Cleanup and CI/CD
1. ✅ Run `npx knip` across entire project one final time
2. ✅ Remove any remaining dead code (removed duplicate exports, unused dependencies)
3. ✅ Update CI/CD scripts for new Docker image (created docker.yml workflow)
4. ✅ Update Docker Hub publishing to use passthrough-bundle image
5. ✅ Update all documentation (updated main README)
6. ✅ Final `pnpm lint` and `pnpm build` at top level

## Best Practices Throughout Implementation

- **Always use `pnpm add`** for dependencies, never edit package.json directly
- **Run `pnpm install` at top level** after any dependency changes
- **Run `npx knip` frequently** to catch dead code early
- **Run `pnpm lint` and `pnpm build`** at top level after each significant change
- **Clean up as you go** - don't leave obsolete files around
- **Test incrementally** - ensure each phase works before moving to the next

## Benefits of This Approach

1. **Separation of Concerns**: Each package has a clear, single responsibility
2. **Extensibility**: Easy to add new hooks - just add to passthrough-bundle dependencies
3. **Flexibility**: Users can still use remote hooks or build their own images
4. **Type Safety**: Hook registry provides compile-time checking of hook availability
5. **Performance**: Built-in hooks run in-process, no HTTP overhead
6. **Testability**: passthrough-mcp-server can be tested with mock HookClient instances

## Hook Package Convention

Each hook package should export its hook class from a `/hook` subpath:
- Package: `@civic/audit-hook`
- Hook export: `@civic/audit-hook/hook`
- Export: Default export should be the hook class

This convention allows the passthrough-bundle to dynamically import hooks consistently.


## Testing Strategy

1. Unit tests for each package remain independent
2. Integration tests in passthrough-bundle to verify all hooks load correctly
3. End-to-end tests using the Docker image with various configurations
4. Performance tests comparing local vs remote hooks
5. Mock testing for passthrough-mcp-server with fake HookClient instances

## Migration Path

1. These changes are mostly backward compatible
2. Existing remote hook configurations continue to work
3. Built-in hooks will perform better when using the new Docker image
4. Users can gradually migrate to the new image when ready