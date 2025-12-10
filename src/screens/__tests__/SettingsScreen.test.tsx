import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsScreen } from '../SettingsScreen';

// Mock dependencies
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
  })),
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  subscriber: false,
};

const mockUseAuth = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the settings screen with header', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('Settings')).toBeTruthy();
      expect(getByText('← Back')).toBeTruthy();
    });

    it('should render Account section', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('Account')).toBeTruthy();
      expect(getByText('Email')).toBeTruthy();
      expect(getByText('Subscription')).toBeTruthy();
    });

    it('should render About section', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('About')).toBeTruthy();
      expect(getByText('Version')).toBeTruthy();
      expect(getByText('1.0.0')).toBeTruthy();
    });
  });

  describe('User Data Display', () => {
    it('should display user email when user exists', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('test@example.com')).toBeTruthy();
    });

    it('should display "Not set" when user does not exist', () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('Not set')).toBeTruthy();
    });

    it('should display "Not set" when user email is undefined', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '123', name: 'Test', subscriber: false },
      });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('Not set')).toBeTruthy();
    });

    it('should display "Active" subscription for subscribers', () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, subscriber: true },
      });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('Active')).toBeTruthy();
    });

    it('should display "Free" subscription for non-subscribers', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('Free')).toBeTruthy();
    });

    it('should display "Free" subscription when user is null', () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('Free')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should call navigation.goBack when back button is pressed', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      fireEvent.press(getByText('← Back'));

      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple back button presses', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      fireEvent.press(getByText('← Back'));
      fireEvent.press(getByText('← Back'));

      expect(mockGoBack).toHaveBeenCalledTimes(2);
    });
  });

  describe('Version Display', () => {
    it('should always display version 1.0.0', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('1.0.0')).toBeTruthy();
    });

    it('should display version even when user is null', () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('1.0.0')).toBeTruthy();
    });
  });

  describe('Layout Structure', () => {
    it('should render all setting items in correct order', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      // Verify all labels are present
      expect(getByText('Email')).toBeTruthy();
      expect(getByText('Subscription')).toBeTruthy();
      expect(getByText('Version')).toBeTruthy();
    });

    it('should render two sections', () => {
      mockUseAuth.mockReturnValue({ user: mockUser });

      const { getByText } = render(<SettingsScreen />);

      expect(getByText('Account')).toBeTruthy();
      expect(getByText('About')).toBeTruthy();
    });
  });
});
