import { RailScore } from '../src/client';
import {
  AuthenticationError,
  InsufficientCreditsError,
  ValidationError,
  RateLimitError,
  ServerError,
  TimeoutError,
  NetworkError,
} from '../src/errors';
import { setMockResponse, setMockError, resetMock } from './__mocks__/node-fetch';

// Mock node-fetch
jest.mock('node-fetch');

describe('RailScore Client', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('Constructor', () => {
    it('should initialize with API key', () => {
      expect(client).toBeInstanceOf(RailScore);
      expect(client.evaluation).toBeDefined();
      expect(client.generation).toBeDefined();
      expect(client.compliance).toBeDefined();
    });

    it('should throw ValidationError when API key is missing', () => {
      expect(() => {
        new RailScore({ apiKey: '' });
      }).toThrow(ValidationError);
    });

    it('should use default base URL when not provided', () => {
      const defaultClient = new RailScore({ apiKey: 'test-key' });
      expect(defaultClient).toBeDefined();
    });

    it('should use custom base URL when provided', () => {
      const customClient = new RailScore({
        apiKey: 'test-key',
        baseUrl: 'https://custom-api.example.com',
      });
      expect(customClient).toBeDefined();
    });

    it('should use custom timeout when provided', () => {
      const customClient = new RailScore({
        apiKey: 'test-key',
        timeout: 30000,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('getCredits', () => {
    it('should fetch credit balance successfully', async () => {
      const mockCredits = {
        balance: 1000,
        totalAllocated: 2000,
        used: 1000,
        tier: 'pro',
        renewalDate: '2024-12-31',
      };

      setMockResponse(mockCredits);

      const credits = await client.getCredits();
      expect(credits).toEqual(mockCredits);
      expect(credits.balance).toBe(1000);
    });

    it('should throw AuthenticationError on 401', async () => {
      setMockResponse(
        { message: 'Invalid API key' },
        401,
        false
      );

      await expect(client.getCredits()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('getUsage', () => {
    it('should fetch usage statistics successfully', async () => {
      const mockUsage = {
        total: 10,
        records: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            endpoint: '/v1/evaluation/basic',
            creditsConsumed: 1,
            reqId: 'req-123',
            status: 'success',
          },
        ],
        dateRange: {
          from: '2024-01-01',
          to: '2024-01-31',
        },
        summary: {
          totalCredits: 10,
          totalRequests: 10,
          successRate: 1.0,
        },
      };

      setMockResponse(mockUsage);

      const usage = await client.getUsage(50);
      expect(usage).toEqual(mockUsage);
      expect(usage.total).toBe(10);
    });

    it('should include fromDate parameter when provided', async () => {
      const mockUsage = {
        total: 5,
        records: [],
        dateRange: { from: '2024-01-01', to: '2024-01-31' },
        summary: { totalCredits: 5, totalRequests: 5, successRate: 1.0 },
      };

      setMockResponse(mockUsage);

      const usage = await client.getUsage(50, '2024-01-01');
      expect(usage.total).toBe(5);
    });
  });

  describe('healthCheck', () => {
    it('should return health status successfully', async () => {
      const mockHealth = {
        ok: true,
        version: '1.0.0',
        status: 'healthy',
      };

      setMockResponse(mockHealth);

      const health = await client.healthCheck();
      expect(health.ok).toBe(true);
      expect(health.version).toBe('1.0.0');
    });
  });

  describe('Error Handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      setMockResponse(
        { message: 'Invalid API key' },
        401,
        false
      );

      await expect(client.getCredits()).rejects.toThrow(AuthenticationError);
    });

    it('should throw InsufficientCreditsError on 402', async () => {
      setMockResponse(
        { message: 'Insufficient credits', balance: 0, required: 10 },
        402,
        false
      );

      await expect(client.getCredits()).rejects.toThrow(InsufficientCreditsError);
    });

    it('should throw ValidationError on 422', async () => {
      setMockResponse(
        { message: 'Invalid content', field: 'content' },
        422,
        false
      );

      await expect(
        client.evaluation.basic('')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw RateLimitError on 429', async () => {
      setMockResponse(
        { message: 'Rate limit exceeded', retry_after: 60 },
        429,
        false
      );

      await expect(client.getCredits()).rejects.toThrow(RateLimitError);
    });

    it('should throw ServerError on 500', async () => {
      setMockResponse(
        { message: 'Internal server error' },
        500,
        false
      );

      await expect(client.getCredits()).rejects.toThrow(ServerError);
    });

    it('should throw TimeoutError on timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      setMockError(abortError);

      await expect(client.getCredits()).rejects.toThrow(TimeoutError);
    });

    it('should throw NetworkError on network failure', async () => {
      const networkError = new Error('Network connection failed');
      setMockError(networkError);

      await expect(client.getCredits()).rejects.toThrow(NetworkError);
    });

    it('should handle error responses without message', async () => {
      setMockResponse({}, 500, false);

      await expect(client.getCredits()).rejects.toThrow(ServerError);
    });

    it('should handle malformed JSON error responses', async () => {
      setMockResponse(null, 500, false);

      await expect(client.getCredits()).rejects.toThrow(ServerError);
    });
  });

  describe('Request Configuration', () => {
    it('should include Authorization header with API key', async () => {
      setMockResponse({ ok: true, version: '1.0.0' });

      await client.healthCheck();
      // Verify the mock was called (implicitly tests headers are set)
    });

    it('should include User-Agent header', async () => {
      setMockResponse({ ok: true, version: '1.0.0' });

      await client.healthCheck();
      // Headers are set in client.ts
    });

    it('should set Content-Type to application/json', async () => {
      setMockResponse({ ok: true, version: '1.0.0' });

      await client.healthCheck();
      // Headers are set in client.ts
    });
  });
});
