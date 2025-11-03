/**
 * Mock implementation of node-fetch for testing
 */

export interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<any>;
}

let mockResponseData: any = {};
let mockResponseStatus = 200;
let mockResponseOk = true;
let shouldThrowError = false;
let errorToThrow: Error | null = null;

/**
 * Mock fetch function
 */
const fetch = jest.fn(async (url: string, options?: any): Promise<MockResponse> => {
  if (shouldThrowError && errorToThrow) {
    throw errorToThrow;
  }

  return {
    ok: mockResponseOk,
    status: mockResponseStatus,
    statusText: mockResponseStatus === 200 ? 'OK' : 'Error',
    json: async () => mockResponseData,
  };
});

/**
 * Helper to set mock response data
 */
export function setMockResponse(data: any, status = 200, ok = true) {
  mockResponseData = data;
  mockResponseStatus = status;
  mockResponseOk = ok;
  shouldThrowError = false;
  errorToThrow = null;
}

/**
 * Helper to make fetch throw an error
 */
export function setMockError(error: Error) {
  shouldThrowError = true;
  errorToThrow = error;
}

/**
 * Helper to reset mock state
 */
export function resetMock() {
  mockResponseData = {};
  mockResponseStatus = 200;
  mockResponseOk = true;
  shouldThrowError = false;
  errorToThrow = null;
  fetch.mockClear();
}

export default fetch;
