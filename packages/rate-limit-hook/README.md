# Rate Limit Hook

A tRPC-based hook that enforces rate limits on tool calls per user.

## Features

- Per-user rate limiting based on userId or sessionId from metadata
- Configurable limits per minute and per hour
- Returns clear error messages with retry-after information
- Automatic cleanup of old rate limit entries
- Memory-efficient implementation

## Usage

### Start the Hook Server

```bash
# Default configuration (10 requests/minute, 100 requests/hour on port 33007)
pnpm start

# Custom configuration
PORT=8080 RATE_LIMIT_PER_MINUTE=5 RATE_LIMIT_PER_HOUR=50 pnpm start

# Development mode with auto-reload
pnpm dev
```

### Configuration

Environment variables:
- `PORT` - HTTP port to listen on (default: 33007)
- `RATE_LIMIT_PER_MINUTE` - Maximum requests per minute per user (default: 10)
- `RATE_LIMIT_PER_HOUR` - Maximum requests per hour per user (default: 100)

### Integration

Add the hook URL to your passthrough MCP server configuration:

```bash
HOOKS=http://localhost:33007 pnpm start
```

Or in programmatic usage:

```typescript
const proxy = await createPassthroughProxy({
  // ... other config
  hooks: [
    { url: "http://localhost:33007", name: "rate-limit" }
  ]
});
```

### How It Works

1. The hook extracts the user ID from the tool call metadata (`userId` or `sessionId`)
2. It tracks the number of requests per user within a rolling time window
3. If the limit is exceeded, it rejects the request with a clear error message
4. The response includes `retryAfter` (in seconds) to indicate when the user can retry

### Example Rejection Response

When rate limit is exceeded:

```json
{
  "response": "abort",
  "reason": "Rate limit exceeded",
  "body": {
    "error": "Too many requests",
    "retryAfter": 45,
    "limit": 10,
    "windowSeconds": 60
  }
}
```

### Metadata Requirements

The hook expects tool calls to include metadata with either:
- `userId` - Preferred user identifier
- `sessionId` - Fallback if userId is not available

Example tool call with metadata:

```typescript
{
  name: "search",
  arguments: { query: "example" },
  metadata: {
    userId: "user-123",
    sessionId: "session-456"
  }
}
```

If no user identifier is found in metadata, the request is allowed to proceed.