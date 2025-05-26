import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookClient, createHookClients, type HookClientConfig } from './client.js';
import type { ToolCall, HookResponse } from './types.js';

// Mock tRPC client
vi.mock('@trpc/client', () => ({
  createTRPCClient: vi.fn(() => ({
    processRequest: {
      mutate: vi.fn()
    },
    processResponse: {
      mutate: vi.fn()
    }
  })),
  httpBatchLink: vi.fn(() => ({}))
}));

// Mock superjson
vi.mock('superjson', () => ({
  default: {
    serialize: vi.fn(val => val),
    deserialize: vi.fn(val => val)
  }
}));

describe('HookClient', () => {
  let mockProcessRequest: ReturnType<typeof vi.fn>;
  let mockProcessResponse: ReturnType<typeof vi.fn>;
  let hookClient: HookClient;
  const config: HookClientConfig = {
    url: 'http://localhost:3000',
    name: 'test-hook'
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock implementations
    mockProcessRequest = vi.fn();
    mockProcessResponse = vi.fn();
    
    // Mock the tRPC client creation
    const mockClient = {
      processRequest: { mutate: mockProcessRequest },
      processResponse: { mutate: mockProcessResponse }
    };
    
    const { createTRPCClient } = await import('@trpc/client');
    (createTRPCClient as any).mockReturnValue(mockClient);
    
    hookClient = new HookClient(config);
  });

  describe('constructor', () => {
    it('should create hook client with config', () => {
      expect(hookClient.name).toBe('test-hook');
    });

    it('should initialize tRPC client with correct URL', async () => {
      const { createTRPCClient, httpBatchLink } = await import('@trpc/client');
      
      expect(createTRPCClient).toHaveBeenCalled();
      expect(httpBatchLink).toHaveBeenCalledWith({
        url: 'http://localhost:3000',
        transformer: expect.anything()
      });
    });
  });

  describe('processRequest', () => {
    it('should process tool call and return response', async () => {
      const toolCall: ToolCall = {
        name: 'test-tool',
        arguments: { key: 'value' }
      };

      const expectedResponse: HookResponse = {
        response: 'continue',
        body: { modified: 'toolCall' }
      };

      mockProcessRequest.mockResolvedValue(expectedResponse);

      const result = await hookClient.processRequest(toolCall);

      expect(mockProcessRequest).toHaveBeenCalledWith(toolCall);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle tool calls with metadata', async () => {
      const toolCall: ToolCall = {
        name: 'test-tool',
        arguments: { key: 'value' },
        metadata: {
          sessionId: 'session-123',
          timestamp: '2024-01-01T00:00:00Z',
          source: 'test'
        }
      };

      const expectedResponse: HookResponse = {
        response: 'continue',
        body: toolCall
      };

      mockProcessRequest.mockResolvedValue(expectedResponse);

      const result = await hookClient.processRequest(toolCall);

      expect(mockProcessRequest).toHaveBeenCalledWith(toolCall);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle abort responses', async () => {
      const toolCall: ToolCall = {
        name: 'dangerous-tool',
        arguments: {}
      };

      const abortResponse: HookResponse = {
        response: 'abort',
        body: null,
        reason: 'Tool not allowed'
      };

      mockProcessRequest.mockResolvedValue(abortResponse);

      const result = await hookClient.processRequest(toolCall);

      expect(result).toEqual(abortResponse);
    });

    it('should handle errors and return continue response', async () => {
      const toolCall: ToolCall = {
        name: 'test-tool',
        arguments: {}
      };

      const error = new Error('Network error');
      mockProcessRequest.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await hookClient.processRequest(toolCall);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Hook test-hook request processing failed:',
        error
      );
      expect(result).toEqual({
        response: 'continue',
        body: toolCall
      });

      consoleSpy.mockRestore();
    });
  });

  describe('processResponse', () => {
    it('should process response with original tool call', async () => {
      const originalToolCall: ToolCall = {
        name: 'test-tool',
        arguments: { key: 'value' }
      };

      const toolResponse = { result: 'success' };

      const expectedResponse: HookResponse = {
        response: 'continue',
        body: { modified: 'response' }
      };

      mockProcessResponse.mockResolvedValue(expectedResponse);

      const result = await hookClient.processResponse(toolResponse, originalToolCall);

      expect(mockProcessResponse).toHaveBeenCalledWith({
        response: toolResponse,
        originalToolCall
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle various response types', async () => {
      const originalToolCall: ToolCall = {
        name: 'test-tool',
        arguments: {}
      };

      const testCases = [
        null,
        'string response',
        123,
        true,
        { complex: 'object' },
        ['array', 'response'],
        undefined
      ];

      for (const response of testCases) {
        const expectedResponse: HookResponse = {
          response: 'continue',
          body: response
        };

        mockProcessResponse.mockResolvedValue(expectedResponse);

        const result = await hookClient.processResponse(response, originalToolCall);

        expect(result.body).toBe(response);
      }
    });

    it('should handle abort on response', async () => {
      const originalToolCall: ToolCall = {
        name: 'test-tool',
        arguments: {}
      };

      const toolResponse = { sensitive: 'data' };

      const abortResponse: HookResponse = {
        response: 'abort',
        body: null,
        reason: 'Sensitive data detected'
      };

      mockProcessResponse.mockResolvedValue(abortResponse);

      const result = await hookClient.processResponse(toolResponse, originalToolCall);

      expect(result).toEqual(abortResponse);
    });

    it('should handle errors and return continue response', async () => {
      const originalToolCall: ToolCall = {
        name: 'test-tool',
        arguments: {}
      };

      const toolResponse = { result: 'data' };
      const error = new Error('Processing failed');

      mockProcessResponse.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await hookClient.processResponse(toolResponse, originalToolCall);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Hook test-hook response processing failed:',
        error
      );
      expect(result).toEqual({
        response: 'continue',
        body: toolResponse
      });

      consoleSpy.mockRestore();
    });
  });
});

describe('createHookClients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create multiple hook clients from configs', async () => {
    const configs: HookClientConfig[] = [
      { url: 'http://localhost:3001', name: 'hook1' },
      { url: 'http://localhost:3002', name: 'hook2' },
      { url: 'http://localhost:3003', name: 'hook3' }
    ];

    const { createTRPCClient } = await import('@trpc/client');
    (createTRPCClient as any).mockReturnValue({
      processRequest: { mutate: vi.fn() },
      processResponse: { mutate: vi.fn() }
    });

    const clients = createHookClients(configs);

    expect(clients).toHaveLength(3);
    expect(clients[0].name).toBe('hook1');
    expect(clients[1].name).toBe('hook2');
    expect(clients[2].name).toBe('hook3');
  });

  it('should create empty array for empty configs', () => {
    const clients = createHookClients([]);
    expect(clients).toEqual([]);
  });
});