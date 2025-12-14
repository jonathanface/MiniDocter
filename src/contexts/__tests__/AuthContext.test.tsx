import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openBrowserAsync: jest.fn(),
}));
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  parse: jest.fn(),
  addEventListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockWebBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;
const mockLinking = Linking as jest.Mocked<typeof Linking>;

describe('AuthContext', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    subscriber: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8443';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AuthProvider initialization', () => {
    it('should initialize with null user and check session', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('should load existing session on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: jest.fn(() => 'application/json'),
        },
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8443/user',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should handle session check with non-JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: jest.fn(() => 'text/html'),
        },
      });

      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(consoleWarn).toHaveBeenCalledWith(
        'Unexpected content type from /user endpoint:',
        'text/html'
      );

      consoleWarn.mockRestore();
    });

    it('should handle JSON parse error gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: jest.fn(() => 'application/json'),
        },
        json: async () => {
          throw new Error('JSON parse error');
        },
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to parse JSON from /user endpoint:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should handle session check network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(consoleError).toHaveBeenCalledWith('Session check failed:', expect.any(Error));

      consoleError.mockRestore();
    });
  });

  describe('signIn', () => {
    it('should initiate Google OAuth flow', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      mockWebBrowser.openBrowserAsync.mockResolvedValue({
        type: 'success',
      } as any);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('google');
      });

      expect(mockWebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        'http://localhost:8443/auth/google?next=minidocter%3A%2F%2Fauth%2Fcallback'
      );
    });

    it('should initiate Amazon OAuth flow', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      mockWebBrowser.openBrowserAsync.mockResolvedValue({
        type: 'success',
      } as any);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('amazon');
      });

      expect(mockWebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        'http://localhost:8443/auth/amazon?next=minidocter%3A%2F%2Fauth%2Fcallback'
      );
    });

    it('should handle cancelled authentication', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      mockWebBrowser.openBrowserAsync.mockResolvedValue({
        type: 'cancel',
      } as any);

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signIn('google');
        })
      ).rejects.toThrow('Authentication cancelled');

      expect(consoleError).toHaveBeenCalledWith('Sign in failed:', expect.any(Error));

      consoleError.mockRestore();
    });

    it('should handle sign in error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      mockWebBrowser.openBrowserAsync.mockRejectedValue(new Error('Browser error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signIn('google');
        })
      ).rejects.toThrow('Browser error');

      expect(consoleError).toHaveBeenCalledWith('Sign in failed:', expect.any(Error));

      consoleError.mockRestore();
    });
  });

  describe('signOut', () => {
    it('should sign out successfully with session token', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('session-token-123');
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: jest.fn(() => 'application/json') },
          json: async () => mockUser,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('session_token');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8443/auth/logout',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer session-token-123',
            'ngrok-skip-browser-warning': 'true',
          },
        })
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('session_token');
      expect(result.current.user).toBeNull();
    });

    it('should sign out locally even if backend call fails', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('session-token-123');
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: jest.fn(() => 'application/json') },
          json: async () => mockUser,
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to call backend logout:', expect.any(Error));
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('session_token');
      expect(result.current.user).toBeNull();

      consoleError.mockRestore();
    });

    it('should sign out when no session token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: jest.fn(() => 'application/json') },
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('session_token');
      expect(result.current.user).toBeNull();
    });

    it('should handle sign out error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: jest.fn(() => 'application/json') },
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await expect(
        act(async () => {
          await result.current.signOut();
        })
      ).rejects.toThrow('Storage error');

      expect(consoleError).toHaveBeenCalledWith('Sign out failed:', expect.any(Error));

      consoleError.mockRestore();
    });
  });

  describe('getSessionToken', () => {
    it('should return session token', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('session-token-123');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const token = await result.current.getSessionToken();

      expect(token).toBe('session-token-123');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('session_token');
    });

    it('should return null when no session token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const token = await result.current.getSessionToken();

      expect(token).toBeNull();
    });

    it('should handle getSessionToken error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const token = await result.current.getSessionToken();

      expect(token).toBeNull();
      expect(consoleError).toHaveBeenCalledWith('Failed to get session token:', expect.any(Error));

      consoleError.mockRestore();
    });
  });

  describe('setUser', () => {
    it('should allow manually setting user', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setUser(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
    });

    it('should allow clearing user', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: jest.fn(() => 'application/json') },
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('useAuth', () => {
    it('should throw error when used outside AuthProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within AuthProvider');

      consoleError.mockRestore();
    });
  });
});
