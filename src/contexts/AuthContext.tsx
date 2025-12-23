import React, { createContext, useState, useContext, useEffect } from 'react';
import { UserDetails } from '../types';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { API_BASE_URL, USE_EXPO_GO } from '../config/environment';

interface AuthContextType {
  user: UserDetails | null;
  isLoading: boolean;
  signIn: (provider: 'google' | 'amazon') => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: UserDetails | null) => void;
  getSessionToken: () => Promise<string | null>;
  refreshUser: () => Promise<UserDetails | null>;
  showWelcome: boolean;
  isReturningUser: boolean;
  clearWelcomeFlags: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TOKEN_KEY = 'session_token';

// Call this at the top level to register deep link handler for OAuth flows
WebBrowser.maybeCompleteAuthSession();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [listenerReady, setListenerReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [processedTokens, setProcessedTokens] = useState<Set<string>>(new Set());

  // Handle deep link callback for OAuth
  const handleDeepLinkCallback = async (path: string | null, queryParams: Record<string, string | string[] | undefined> | null | undefined, rawUrl?: string) => {
    console.log('[Auth] Deep link callback received:', { path, queryParams, rawUrl });

    // Accept both 'auth/callback' and just 'callback' paths
    if (path !== 'callback' && path !== 'auth/callback' && !path?.endsWith('/callback')) {
      console.log('[Auth] Path does not match callback pattern, ignoring');
      return;
    }

    // If user is already logged in, ignore OAuth callbacks (they're likely stale deep links)
    if (user) {
      console.log('[Auth] User already logged in, ignoring callback');
      return;
    }

    // Extract and decode the token from the deep link
    console.log('[Auth] Checking for token in queryParams:', {
      hasQueryParams: !!queryParams,
      queryParamsKeys: queryParams ? Object.keys(queryParams) : [],
      tokenValue: queryParams?.token,
    });

    // Fallback: manually parse query params from raw URL if Linking.parse didn't extract them
    let token = queryParams?.token as string | undefined;
    if (!token && rawUrl) {
      console.log('[Auth] Token not found in parsed queryParams, trying manual parse of raw URL');
      const urlMatch = rawUrl.match(/[?&]token=([^&]+)/);
      if (urlMatch) {
        token = decodeURIComponent(urlMatch[1]);
        console.log('[Auth] Manually extracted token from URL:', { tokenLength: token.length });
      }
    }

    if (token) {
      console.log('[Auth] Token found, processing...');

      // Check if we've already processed this token to prevent duplicate processing
      if (processedTokens.has(token)) {
        return;
      }

      setProcessedTokens(prev => new Set(prev).add(token));

      // Check for new_user or returning_user flags
      const isNewUser = queryParams?.new_user === 'true';
      const isReturning = queryParams?.returning_user === 'true';

      try {
        const baseUrl = API_BASE_URL.replace(/\/api$/, '');
        const sessionUrl = `${baseUrl}/auth/session`;

        console.log('[Auth] Calling session endpoint:', {
          url: sessionUrl,
          tokenLength: token.length,
          tokenPreview: token.substring(0, 20) + '...',
        });

        // Call the session endpoint to establish a session cookie
        const response = await fetch(sessionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
          body: JSON.stringify({
            token: token,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // Store the session token securely
          if (data.sessionToken) {
            await SecureStore.setItemAsync(SESSION_TOKEN_KEY, data.sessionToken);
          }

          setUser(data.user);

          // Set welcome screen flags
          if (isNewUser || isReturning) {
            setShowWelcome(true);
            setIsReturningUser(isReturning);
          }

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
      console.log('[Auth] No token found in query params, falling back to checkSession');
      await checkSession();
    }
  };

  useEffect(() => {

    // Check if app was opened with a deep link (handles cold start case)
    const checkInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      console.log('[Auth] Initial URL:', initialUrl);
      if (initialUrl) {
        const { path, queryParams } = Linking.parse(initialUrl);
        console.log('[Auth] Parsed initial URL:', { path, queryParams });
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
      console.log('[Auth] Deep link event received:', event.url);
      const { path, queryParams } = Linking.parse(event.url);
      console.log('[Auth] Parsed deep link:', { path, queryParams });
      await handleDeepLinkCallback(path, queryParams, event.url);
    });

    // Mark listener as ready
    setListenerReady(true);

    return () => {
      subscription.remove();
    };
  }, []);

  const checkSession = async () => {
    try {
      // Get the stored session token for mobile authentication
      const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);

      const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
      };

      // Add Authorization header if we have a session token (mobile)
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/user`, {
        headers,
        credentials: 'include', // Also send cookies for web compatibility
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
        // No valid session - clear the stored token if it's invalid
        if (sessionToken) {
          await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
        }
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
      // Auth endpoints are at the root (e.g., /auth/google), not under /api
      const baseUrl = API_BASE_URL.replace(/\/api$/, '');

      let redirectUrl: string;
      if (USE_EXPO_GO) {
        // For Expo Go, use Linking.createURL which handles the correct format
        // This creates: exp://[host]:[port]/--/auth/callback
        redirectUrl = Linking.createURL('auth/callback');
      } else {
        // Production: use custom scheme
        redirectUrl = 'minidocter://auth/callback';
      }

      const authUrl = `${baseUrl}/auth/${provider}?next=${encodeURIComponent(redirectUrl)}`;

      console.log('[Auth] Starting sign in:', { provider, baseUrl, redirectUrl, authUrl });

      // Open OAuth flow in browser
      const result = await WebBrowser.openBrowserAsync(authUrl);

      console.log('[Auth] Browser result:', result);

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
          const baseUrl = API_BASE_URL.replace(/\/api$/, '');

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

  const refreshUser = async (): Promise<UserDetails | null> => {
    try {
      const sessionToken = await SecureStore.getItemAsync('session_token');
      const url = `${API_BASE_URL}/user`;

      const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
      };

      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(url, {
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          const userData = await response.json();
          setUser(userData);
          return userData;
        }
      }
      return null;
    } catch (error) {
      console.error('[AuthContext] Failed to refresh user:', error);
      return null;
    }
  };

  const clearWelcomeFlags = () => {
    setShowWelcome(false);
    setIsReturningUser(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      signIn,
      signOut,
      setUser,
      getSessionToken,
      refreshUser,
      showWelcome,
      isReturningUser,
      clearWelcomeFlags,
    }}>
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
