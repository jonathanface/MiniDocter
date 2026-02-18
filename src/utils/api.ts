import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/environment';

const SESSION_TOKEN_KEY = 'session_token';

export const getApiBaseUrl = () => {
  return API_BASE_URL;
};

/**
 * Make an authenticated API request with session token
 */
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  // Get session token from secure storage
  const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);

  // Prepare headers as a plain object for easy manipulation
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Bypass ngrok warning page
    ...(options.headers as Record<string, string> || {}),
  };

  // Add Authorization header if token exists
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  // Make the request with credentials and authorization
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Still include credentials for backward compatibility
  });
};

/**
 * Helper for GET requests
 */
export const apiGet = async (endpoint: string): Promise<Response> => {
  const baseUrl = getApiBaseUrl();
  return authenticatedFetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
  });
};

/**
 * Helper for POST requests
 */
export const apiPost = async (
  endpoint: string,
  body?: unknown
): Promise<Response> => {
  const baseUrl = getApiBaseUrl();
  return authenticatedFetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * Helper for PUT requests
 */
export const apiPut = async (
  endpoint: string,
  body?: unknown
): Promise<Response> => {
  const baseUrl = getApiBaseUrl();
  return authenticatedFetch(`${baseUrl}${endpoint}`, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * Helper for DELETE requests
 * Uses XMLHttpRequest when a body is provided because React Native's fetch
 * on Android (via OkHttp) silently strips the body from DELETE requests.
 */
export const apiDelete = async (
  endpoint: string,
  body?: unknown
): Promise<Response> => {
  const baseUrl = getApiBaseUrl();

  if (body) {
    const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    const url = `${baseUrl}${endpoint}`;
    const bodyStr = JSON.stringify(body);

    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('DELETE', url);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
      if (sessionToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
      }

      xhr.onload = () => {
        resolve(new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
        }));
      };

      xhr.onerror = () => {
        reject(new TypeError('Network request failed'));
      };

      xhr.send(bodyStr);
    });
  }

  return authenticatedFetch(`${baseUrl}${endpoint}`, {
    method: 'DELETE',
  });
};

/**
 * Billing API helpers
 */
export const getBillingSummary = async () => {
  const baseUrl = getApiBaseUrl();
  // Remove /api suffix if present and add /billing/summary
  const url = baseUrl.replace(/\/api$/, '') + '/billing/summary';
  return authenticatedFetch(url, {
    method: 'GET',
  });
};

export const createPortalSession = async (returnUrl: string) => {
  const baseUrl = getApiBaseUrl();
  // Remove /api suffix if present and add /billing/portal-session
  const url = baseUrl.replace(/\/api$/, '') + '/billing/portal-session';
  return authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'X-Return-Url': returnUrl,
    },
  });
};
