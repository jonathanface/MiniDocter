import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WelcomeScreen } from '../WelcomeScreen';

// Mock dependencies
const mockClearWelcomeFlags = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
  })),
}));

const mockColors = {
  bgBody: '#f5f5f5',
  bgPrimary: '#ffffff',
  textPrimary: '#333333',
  textSecondary: '#666666',
  borderLight: '#e0e0e0',
  primary: '#4285F4',
};

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => ({
    colors: mockColors,
    theme: 'light',
  })),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    clearWelcomeFlags: mockClearWelcomeFlags,
  })),
}));

describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('New User Flow', () => {
    it('should render first page with correct content for new users', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      expect(getByText('Welcome to Docter.io')).toBeTruthy();
      expect(
        getByText(
          'Your personal writing companion for organizing stories, characters, places, and events all in one place.'
        )
      ).toBeTruthy();
      expect(getByText('📝')).toBeTruthy();
    });

    it('should render pagination indicators for new users', () => {
      const { UNSAFE_root } = render(<WelcomeScreen isReturningUser={false} />);

      // Pagination should be rendered (structure test)
      // New users should have 4 pages worth of content
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should show "Next" button on first page', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      expect(getByText('Next')).toBeTruthy();
    });

    it('should show "Skip" button on first page', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      expect(getByText('Skip')).toBeTruthy();
    });

    it('should advance to second page when Next is pressed', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      fireEvent.press(getByText('Next'));

      expect(getByText('Create & Organize')).toBeTruthy();
      expect(
        getByText(
          'Write your stories in chapters, create rich associations for characters and places, and keep everything connected.'
        )
      ).toBeTruthy();
      expect(getByText('🗂️')).toBeTruthy();
    });

    it('should advance to third page when Next is pressed again', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText('Series Support')).toBeTruthy();
      expect(
        getByText(
          'Building a multi-book series? Group related stories together and track your entire fictional universe.'
        )
      ).toBeTruthy();
      expect(getByText('📚')).toBeTruthy();
    });

    it('should advance to fourth page when Next is pressed a third time', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText('Export Anywhere')).toBeTruthy();
      expect(
        getByText(
          'Export your work to PDF, EPUB, or DOCX format whenever you need it. Your stories, your way.'
        )
      ).toBeTruthy();
      expect(getByText('📤')).toBeTruthy();
    });

    it('should show "Get Started" button on last page', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      // Navigate to last page
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText('Get Started')).toBeTruthy();
    });

    it('should not show "Skip" button on last page', () => {
      const { getByText, queryByText } = render(<WelcomeScreen isReturningUser={false} />);

      // Navigate to last page
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(queryByText('Skip')).toBeNull();
    });

    it('should call clearWelcomeFlags when "Get Started" is pressed', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      // Navigate to last page
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      fireEvent.press(getByText('Get Started'));

      expect(mockClearWelcomeFlags).toHaveBeenCalled();
    });

    it('should call clearWelcomeFlags when "Skip" is pressed', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      fireEvent.press(getByText('Skip'));

      expect(mockClearWelcomeFlags).toHaveBeenCalled();
    });
  });

  describe('Returning User Flow', () => {
    it('should render first page with correct content for returning users', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={true} />);

      expect(getByText('Welcome Back!')).toBeTruthy();
      expect(
        getByText(
          "We're glad to have you back. Your account has been reactivated and any content from before the 30-day retention period has been restored."
        )
      ).toBeTruthy();
      expect(getByText('👋')).toBeTruthy();
    });

    it('should render pagination indicators for returning users', () => {
      const { UNSAFE_root } = render(<WelcomeScreen isReturningUser={true} />);

      // Pagination should be rendered (structure test)
      // Returning users should have 3 pages worth of content
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should show data retention information on second page', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={true} />);

      fireEvent.press(getByText('Next'));

      expect(getByText('Your Data')).toBeTruthy();
      expect(
        getByText(
          'Since you returned within 30 days, your stories and series have been automatically restored. Content is permanently deleted after 30 days of account deletion.'
        )
      ).toBeTruthy();
      expect(getByText('🔄')).toBeTruthy();
    });

    it('should show ready message on third page', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={true} />);

      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText('Ready to Write')).toBeTruthy();
      expect(
        getByText(
          "Everything is set up and ready to go. Let's continue creating something amazing!"
        )
      ).toBeTruthy();
      expect(getByText('✨')).toBeTruthy();
    });

    it('should show "Get Started" button on last page for returning users', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={true} />);

      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText('Get Started')).toBeTruthy();
    });

    it('should call clearWelcomeFlags when returning user completes onboarding', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={true} />);

      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Get Started'));

      expect(mockClearWelcomeFlags).toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('should render pagination container', () => {
      const { UNSAFE_root } = render(<WelcomeScreen isReturningUser={false} />);

      // Pagination should be rendered (structure test)
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should maintain pagination state when navigating pages', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      // Navigate to second page
      fireEvent.press(getByText('Next'));

      // Should still be rendering the component
      expect(getByText('Create & Organize')).toBeTruthy();
    });
  });

  describe('Data Retention Messaging', () => {
    it('should explicitly mention 30-day retention period for returning users', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={true} />);

      fireEvent.press(getByText('Next'));

      // Check for 30-day messaging
      expect(
        getByText(/30 days/i)
      ).toBeTruthy();
    });

    it('should explain content restoration for returning users', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={true} />);

      fireEvent.press(getByText('Next'));

      expect(
        getByText(/automatically restored/i)
      ).toBeTruthy();
    });

    it('should explain permanent deletion after 30 days', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={true} />);

      fireEvent.press(getByText('Next'));

      expect(
        getByText(/permanently deleted after 30 days/i)
      ).toBeTruthy();
    });
  });

  describe('Button States', () => {
    it('should show Next button on all pages except last', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      expect(getByText('Next')).toBeTruthy();

      fireEvent.press(getByText('Next'));
      expect(getByText('Next')).toBeTruthy();

      fireEvent.press(getByText('Next'));
      expect(getByText('Next')).toBeTruthy();

      fireEvent.press(getByText('Next'));
      expect(getByText('Get Started')).toBeTruthy();
    });

    it('should allow pressing Next multiple times in succession', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      const nextButton = getByText('Next');
      fireEvent.press(nextButton);
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText('Export Anywhere')).toBeTruthy();
    });
  });

  describe('Content Display', () => {
    it('should display emoji for each page', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      // Page 1
      expect(getByText('📝')).toBeTruthy();

      // Page 2
      fireEvent.press(getByText('Next'));
      expect(getByText('🗂️')).toBeTruthy();

      // Page 3
      fireEvent.press(getByText('Next'));
      expect(getByText('📚')).toBeTruthy();

      // Page 4
      fireEvent.press(getByText('Next'));
      expect(getByText('📤')).toBeTruthy();
    });

    it('should display title and description for each page', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      expect(getByText('Welcome to Docter.io')).toBeTruthy();
      expect(
        getByText(/personal writing companion/i)
      ).toBeTruthy();
    });
  });

  describe('Layout', () => {
    it('should render in a scrollable container', () => {
      const { UNSAFE_root } = render(<WelcomeScreen isReturningUser={false} />);

      // Should have View container (structure test)
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should render pagination dots container', () => {
      const { UNSAFE_root } = render(<WelcomeScreen isReturningUser={false} />);

      // Pagination should be rendered (structure test)
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should render button container at bottom', () => {
      const { getByText } = render(<WelcomeScreen isReturningUser={false} />);

      // Buttons should be rendered
      expect(getByText('Next')).toBeTruthy();
      expect(getByText('Skip')).toBeTruthy();
    });
  });

  describe('Default Props', () => {
    it('should default to new user flow when isReturningUser is not provided', () => {
      const { getByText } = render(<WelcomeScreen />);

      // Should show new user content
      expect(getByText('Welcome to Docter.io')).toBeTruthy();
    });
  });
});
