import * as SecureStore from 'expo-secure-store';
import {
  getApiBaseUrl,
  authenticatedFetch,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
} from '../api';

// Mock environment config
jest.mock('../../config/environment', () => ({
  API_BASE_URL: 'http://192.168.1.74:8443',
  USE_EXPO_GO: true,
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  AMAZON_CLIENT_ID: 'test-amazon-client-id',
  ENV: 'local',
}));

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  });

  describe('getApiBaseUrl', () => {
    it('should return mocked URL from environment config', () => {
      const url = getApiBaseUrl();
      expect(url).toBe('http://192.168.1.74:8443');
    });
  });

  describe('authenticatedFetch', () => {
    const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);
    });

    it('should make fetch request without Authorization header when no token', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      await authenticatedFetch('https://api.example.com/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        })
      );
    });

    it('should include Authorization header when token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');

      await authenticatedFetch('https://api.example.com/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Authorization': 'Bearer test-token-123',
          },
          credentials: 'include',
        })
      );
    });

    it('should merge custom headers with default headers', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');

      await authenticatedFetch('https://api.example.com/test', {
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token-123',
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('should preserve other fetch options', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');

      await authenticatedFetch('https://api.example.com/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
        signal: new AbortController().signal,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should return the fetch response', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ result: 'success' }),
      } as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const response = await authenticatedFetch('https://api.example.com/test');

      expect(response).toBe(mockResponse);
    });

    it('should handle fetch errors', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      const fetchError = new Error('Network error');
      mockFetch.mockRejectedValue(fetchError);

      await expect(
        authenticatedFetch('https://api.example.com/test')
      ).rejects.toThrow('Network error');
    });
  });

  describe('apiGet', () => {
    const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

    beforeEach(() => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      } as Response);
    });

    it('should make GET request to correct endpoint', async () => {
      await apiGet('/users/123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.74:8443/users/123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should return the response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      } as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const response = await apiGet('/test');

      expect(response).toBe(mockResponse);
    });
  });

  describe('apiPost', () => {
    const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

    beforeEach(() => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ created: true }),
      } as Response);
    });

    it('should make POST request with body', async () => {
      const testData = { name: 'Test', value: 123 };

      await apiPost('/items', testData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.74:8443/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should make POST request without body when undefined', async () => {
      await apiPost('/items');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.74:8443/items',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });

    it('should handle POST request with null body', async () => {
      await apiPost('/items', null);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.74:8443/items',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });

    it('should return the response', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: async () => ({ id: 1 }),
      } as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const response = await apiPost('/items', { name: 'Test' });

      expect(response).toBe(mockResponse);
    });
  });

  describe('apiPut', () => {
    const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

    beforeEach(() => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ updated: true }),
      } as Response);
    });

    it('should make PUT request with body', async () => {
      const updateData = { name: 'Updated', value: 456 };

      await apiPut('/items/1', updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.74:8443/items/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should make PUT request without body when undefined', async () => {
      await apiPut('/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.74:8443/items/1',
        expect.objectContaining({
          method: 'PUT',
          body: undefined,
        })
      );
    });

    it('should return the response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ id: 1, name: 'Updated' }),
      } as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const response = await apiPut('/items/1', { name: 'Updated' });

      expect(response).toBe(mockResponse);
    });
  });

  describe('apiDelete', () => {
    const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

    beforeEach(() => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);
    });

    it('should make DELETE request', async () => {
      await apiDelete('/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.74:8443/items/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should return the response', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
      } as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const response = await apiDelete('/items/1');

      expect(response).toBe(mockResponse);
    });
  });

  describe('integration scenarios', () => {
    const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

    it('should handle 401 unauthorized response', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('invalid-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response);

      const response = await apiGet('/protected');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should handle 404 not found response', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as Response);

      const response = await apiGet('/nonexistent');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should handle 500 server error', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      } as Response);

      const response = await apiPost('/error', { data: 'test' });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it('should handle network timeout', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token-123');
      mockFetch.mockRejectedValue(new Error('Network request failed'));

      await expect(apiGet('/timeout')).rejects.toThrow('Network request failed');
    });
  });
});
