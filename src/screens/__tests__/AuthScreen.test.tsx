import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthScreen } from '../AuthScreen';
import { Alert } from 'react-native';

// Mock dependencies
const mockSignIn = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default mock return value
    mockUseAuth.mockReturnValue({
      signIn: mockSignIn,
      isLoading: false,
    });
  });

  describe('Rendering', () => {
    it('should render the auth screen with title and subtitle', () => {
      const { getByText } = render(<AuthScreen />);

      expect(getByText('MiniDocter')).toBeTruthy();
      expect(getByText('Your writing companion')).toBeTruthy();
    });

    it('should render Google sign in button', () => {
      const { getByText } = render(<AuthScreen />);

      expect(getByText('Sign in with Google')).toBeTruthy();
    });

    it('should render Amazon sign in button', () => {
      const { getByText } = render(<AuthScreen />);

      expect(getByText('Sign in with Amazon')).toBeTruthy();
    });

    it('should render terms and privacy policy footer', () => {
      const { getByText } = render(<AuthScreen />);

      expect(
        getByText('By signing in, you agree to our Terms of Service and Privacy Policy')
      ).toBeTruthy();
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator when isLoading is true', () => {
      mockUseAuth.mockReturnValue({
        signIn: mockSignIn,
        isLoading: true,
      });

      const { UNSAFE_queryByType } = render(<AuthScreen />);

      const activityIndicator = UNSAFE_queryByType(
        require('react-native').ActivityIndicator
      );
      expect(activityIndicator).toBeTruthy();
    });

    it('should not show sign in buttons when loading', () => {
      mockUseAuth.mockReturnValue({
        signIn: mockSignIn,
        isLoading: true,
      });

      const { queryByText } = render(<AuthScreen />);

      expect(queryByText('Sign in with Google')).toBeNull();
      expect(queryByText('Sign in with Amazon')).toBeNull();
    });
  });

  describe('Sign In Interactions', () => {
    it('should call signIn with google when Google button is pressed', async () => {
      mockSignIn.mockResolvedValue(undefined);

      const { getByText } = render(<AuthScreen />);

      fireEvent.press(getByText('Sign in with Google'));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('google');
      });
    });

    it('should call signIn with amazon when Amazon button is pressed', async () => {
      mockSignIn.mockResolvedValue(undefined);

      const { getByText } = render(<AuthScreen />);

      fireEvent.press(getByText('Sign in with Amazon'));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('amazon');
      });
    });

    it('should show loading indicator while signing in', async () => {
      let resolveSignIn: () => void;
      const signInPromise = new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      });
      mockSignIn.mockReturnValue(signInPromise);

      const { getByText, UNSAFE_queryByType } = render(<AuthScreen />);

      fireEvent.press(getByText('Sign in with Google'));

      await waitFor(() => {
        const activityIndicator = UNSAFE_queryByType(
          require('react-native').ActivityIndicator
        );
        expect(activityIndicator).toBeTruthy();
      });

      resolveSignIn!();
    });

    it('should show loading while signing in', async () => {
      let resolveSignIn: () => void;
      const signInPromise = new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      });
      mockSignIn.mockReturnValue(signInPromise);

      const { getByText, UNSAFE_queryByType, queryByText } = render(<AuthScreen />);

      fireEvent.press(getByText('Sign in with Google'));

      // The buttons should be hidden while signing in
      await waitFor(() => {
        expect(queryByText('Sign in with Google')).toBeNull();
      });

      resolveSignIn!();
    });

    it('should show alert when sign in fails', async () => {
      mockSignIn.mockRejectedValue(new Error('Sign in failed'));

      const { getByText } = render(<AuthScreen />);

      fireEvent.press(getByText('Sign in with Google'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Sign In Failed',
          'Please try again'
        );
      });
    });

    it('should reset loading state after sign in succeeds', async () => {
      mockSignIn.mockResolvedValue(undefined);

      const { getByText, queryByText } = render(<AuthScreen />);

      fireEvent.press(getByText('Sign in with Google'));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled();
      });

      // Should show the buttons again
      expect(queryByText('Sign in with Google')).toBeTruthy();
      expect(queryByText('Sign in with Amazon')).toBeTruthy();
    });

    it('should reset loading state after sign in fails', async () => {
      mockSignIn.mockRejectedValue(new Error('Sign in failed'));

      const { getByText, queryByText } = render(<AuthScreen />);

      fireEvent.press(getByText('Sign in with Google'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Should show the buttons again
      expect(queryByText('Sign in with Google')).toBeTruthy();
      expect(queryByText('Sign in with Amazon')).toBeTruthy();
    });

    it('should handle multiple sign in attempts', async () => {
      mockSignIn
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const { getByText } = render(<AuthScreen />);

      fireEvent.press(getByText('Sign in with Google'));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('google');
      });

      fireEvent.press(getByText('Sign in with Amazon'));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('amazon');
      });

      expect(mockSignIn).toHaveBeenCalledTimes(2);
    });
  });
});
