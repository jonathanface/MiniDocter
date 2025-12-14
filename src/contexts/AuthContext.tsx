import React, { createContext, useState, useContext, useEffect } from 'react';
import { UserDetails } from '../types';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

interface AuthContextType {
  user: UserDetails | null;
  isLoading: boolean;
  signIn: (provider: 'google' | 'amazon') => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: UserDetails | null) => void;
  getSessionToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TOKEN_KEY = 'session_token';

// Call this at the top level to register deep link handler for OAuth flows
WebBrowser.maybeCompleteAuthSession();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [listenerReady, setListenerReady] = useState(false);

  // Handle deep link callback for OAuth
  const handleDeepLinkCallback = async (path: string | null, queryParams: Record<string, string | string[] | undefined> | null | undefined) => {
    if (path !== 'callback' && path !== 'auth/callback') {
      return;
    }


    // Extract and decode the token from the deep link
    if (queryParams && queryParams.token) {
      try {
        const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.74:8443';
        const baseUrl = apiBaseUrl.replace(/\/api$/, '');

        // Call the session endpoint to establish a session cookie
        const response = await fetch(`${baseUrl}/auth/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
          body: JSON.stringify({
            token: queryParams.token as string,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // Store the session token securely
          if (data.sessionToken) {
            await SecureStore.setItemAsync(SESSION_TOKEN_KEY, data.sessionToken);
          }

          setUser(data.user);
          setIsLoading(false);
        } else {
          const errorText = await response.text();
          console.error('[AuthContext] Failed to establish session:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          await checkSession();
        }
      } catch (error) {
        console.error('[AuthContext] Failed to establish session from token:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        // Fall back to checking session
        await checkSession();
      }
    } else {
      await checkSession();
    }
  };

  useEffect(() => {

    // Check if app was opened with a deep link (handles cold start case)
    const checkInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const { path, queryParams } = Linking.parse(initialUrl);
        if (path === 'callback' || path === 'auth/callback') {
          await handleDeepLinkCallback(path, queryParams);
        }
      }
    };

    // Check for existing session on app start
    checkSession();

    // Check if we were opened with a deep link
    checkInitialURL();

    // Listen for deep link redirects from OAuth
    const subscription = Linking.addEventListener('url', async (event) => {
      const { path, queryParams } = Linking.parse(event.url);
      await handleDeepLinkCallback(path, queryParams);
    });

    // Mark listener as ready
    setListenerReady(true);

    return () => {
      subscription.remove();
    };
  }, []);

  const checkSession = async () => {
    try {
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.74:8443';

      const response = await fetch(`${apiBaseUrl}/user`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include', // Important: send cookies
      });

      if (response.ok) {
        // Check if response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const userData = await response.json();
            setUser(userData);
          } catch (jsonError) {
            console.error('Failed to parse JSON from /user endpoint:', jsonError);
            setUser(null);
          }
        } else {
          console.warn('Unexpected content type from /user endpoint:', contentType);
          setUser(null);
        }
      } else {
        // No valid session (expected on initial mobile app load)
        setUser(null);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (provider: 'google' | 'amazon') => {
    try {
      setIsLoading(true);

      // Open backend OAuth endpoint with custom redirect
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.74:8443';
      // Auth endpoints are at the root (e.g., /auth/google), not under /api
      const baseUrl = apiBaseUrl.replace(/\/api$/, '');
      const redirectUrl = 'minidocter://auth/callback';
      const authUrl = `${baseUrl}/auth/${provider}?next=${encodeURIComponent(redirectUrl)}`;


      // Open OAuth flow in browser
      const result = await WebBrowser.openBrowserAsync(authUrl);


      // If browser was dismissed without redirect, user might have cancelled
      if (result.type === 'cancel') {
        throw new Error('Authentication cancelled');
      }

      // The deep link listener will handle the session check when the redirect happens
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);

      // Get the session token to send to backend for invalidation
      const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);

      // Call backend logout endpoint if we have a token
      if (sessionToken) {
        try {
          const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.74:8443';
          const baseUrl = apiBaseUrl.replace(/\/api$/, '');

          await fetch(`${baseUrl}/auth/logout`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
              'ngrok-skip-browser-warning': 'true',
            },
          });
        } catch (error) {
          console.error('Failed to call backend logout:', error);
          // Continue with local logout even if backend call fails
        }
      }

      // Clear session token from secure storage
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
      setUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getSessionToken = async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get session token:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, setUser, getSessionToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
