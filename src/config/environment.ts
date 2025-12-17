/**
 * Environment configuration for MiniDocter
 *
 * This module provides a centralized configuration based on the APP_ENV variable.
 * Supported environments: local, staging, production
 */

export type Environment = 'local' | 'staging' | 'production';

interface EnvironmentConfig {
  apiBaseUrl: string;
  useExpoGo: boolean;
  googleClientId: string;
  amazonClientId: string;
}

// OAuth client IDs (same across all environments)
const OAUTH_GOOGLE_CLIENT_ID = '878388830212-0kjicm0hvvpc322q07ni82ijdqck1bhs.apps.googleusercontent.com';
const OAUTH_AMAZON_CLIENT_ID = 'amzn1.application-oa2-client.a4c7f8a3627043f5a11eae34aca5ad00';

// Get the current environment from env variable
const getCurrentEnvironment = (): Environment => {
  const env = process.env.EXPO_PUBLIC_APP_ENV?.toLowerCase();

  if (env === 'local' || env === 'staging' || env === 'production') {
    return env;
  }

  // Default to staging for safety
  console.warn(`Invalid EXPO_PUBLIC_APP_ENV: "${env}". Defaulting to "staging".`);
  return 'staging';
};

// Get ngrok URL if set (for local development)
const getNgrokUrl = (): string | null => {
  const ngrokUrl = process.env.EXPO_PUBLIC_NGROK_URL;
  return ngrokUrl && ngrokUrl.trim() !== '' ? ngrokUrl : null;
};

// Build configuration based on environment
const buildConfig = (): EnvironmentConfig => {
  const env = getCurrentEnvironment();

  switch (env) {
    case 'local': {
      const ngrokUrl = getNgrokUrl();
      if (!ngrokUrl) {
        console.error('EXPO_PUBLIC_APP_ENV is "local" but EXPO_PUBLIC_NGROK_URL is not set!');
        console.error('Please set EXPO_PUBLIC_NGROK_URL or run backend with "make dev-mobile"');
      }
      return {
        apiBaseUrl: ngrokUrl ? `${ngrokUrl}/api` : 'https://stage.docter.io/api',
        useExpoGo: true,
        googleClientId: OAUTH_GOOGLE_CLIENT_ID,
        amazonClientId: OAUTH_AMAZON_CLIENT_ID,
      };
    }

    case 'staging':
      return {
        apiBaseUrl: 'https://stage.docter.io/api',
        useExpoGo: true, // Can use Expo Go for staging testing
        googleClientId: OAUTH_GOOGLE_CLIENT_ID,
        amazonClientId: OAUTH_AMAZON_CLIENT_ID,
      };

    case 'production':
      return {
        apiBaseUrl: 'https://docter.io/api', // TODO: Update with actual production URL
        useExpoGo: false,
        googleClientId: OAUTH_GOOGLE_CLIENT_ID,
        amazonClientId: OAUTH_AMAZON_CLIENT_ID,
      };
  }
};

// Export the configuration
const config = buildConfig();

export const ENV = getCurrentEnvironment();
export const API_BASE_URL = config.apiBaseUrl;
export const USE_EXPO_GO = config.useExpoGo;
export const GOOGLE_CLIENT_ID = config.googleClientId;
export const AMAZON_CLIENT_ID = config.amazonClientId;

// Configuration is loaded silently
