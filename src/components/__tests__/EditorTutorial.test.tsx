import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EditorTutorial } from '../EditorTutorial';

// Mock the theme context
const mockColors = {
  bgCard: '#ffffff',
  primary: '#4285F4',
  textPrimary: '#333333',
  textSecondary: '#666666',
  borderLight: '#e0e0e0',
  bgSecondary: '#f0f0f0',
};

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => ({
    colors: mockColors,
    theme: 'light',
  })),
}));

describe('EditorTutorial', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when visible', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      expect(getByText('Welcome to Your Story Editor!')).toBeTruthy();
    });

    it('should not render when not visible', () => {
      const { queryByText } = render(
        <EditorTutorial visible={false} onComplete={mockOnComplete} />
      );

      expect(queryByText('Welcome to Your Story Editor!')).toBeNull();
    });

    it('should display step indicator', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      expect(getByText('Step 1 of 6')).toBeTruthy();
    });

    it('should display progress dots', () => {
      const { UNSAFE_queryAllByType } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      const View = require('react-native').View;
      const allViews = UNSAFE_queryAllByType(View);
      // Should have 6 progress dots (one for each step)
      expect(allViews.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation', () => {
    it('should advance to next step when Next is pressed', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      expect(getByText('Welcome to Your Story Editor!')).toBeTruthy();

      fireEvent.press(getByText('Next'));

      expect(getByText('Writing Your Story')).toBeTruthy();
      expect(getByText('Step 2 of 6')).toBeTruthy();
    });

    it('should go back to previous step when Back is pressed', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      // Go to step 2
      fireEvent.press(getByText('Next'));
      expect(getByText('Writing Your Story')).toBeTruthy();

      // Go back to step 1
      fireEvent.press(getByText('Back'));
      expect(getByText('Welcome to Your Story Editor!')).toBeTruthy();
    });

    it('should not show Back button on first step', () => {
      const { queryByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      expect(queryByText('Back')).toBeNull();
    });

    it('should show Back button on later steps', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      fireEvent.press(getByText('Next'));
      expect(getByText('Back')).toBeTruthy();
    });
  });

  describe('Completion', () => {
    it('should call onComplete when Get Started is pressed on last step', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      // Navigate to last step
      for (let i = 0; i < 5; i++) {
        fireEvent.press(getByText('Next'));
      }

      expect(getByText("You're All Set!")).toBeTruthy();
      expect(getByText('Get Started')).toBeTruthy();

      fireEvent.press(getByText('Get Started'));

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('should call onComplete when Skip Tutorial is pressed', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      fireEvent.press(getByText('Skip Tutorial'));

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('should not show Skip Tutorial button on last step', () => {
      const { getByText, queryByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      // Navigate to last step
      for (let i = 0; i < 5; i++) {
        fireEvent.press(getByText('Next'));
      }

      expect(queryByText('Skip Tutorial')).toBeNull();
    });
  });

  describe('Content', () => {
    it('should display all tutorial steps', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      const steps = [
        'Welcome to Your Story Editor!',
        'Writing Your Story',
        'Text Formatting',
        'Associations',
        'Multiple Chapters',
        "You're All Set!",
      ];

      steps.forEach((stepTitle, index) => {
        if (index > 0) {
          fireEvent.press(getByText('Next'));
        }
        expect(getByText(stepTitle)).toBeTruthy();
      });
    });

    it('should display correct description for Writing Your Story step', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      fireEvent.press(getByText('Next'));

      expect(getByText(/Remember to save your work using the save button/)).toBeTruthy();
      expect(getByText(/Simply tap anywhere in the editor and start typing/)).toBeTruthy();
    });

    it('should display correct description for Text Formatting step', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      // Navigate to Text Formatting step (step 3)
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText(/bold, italic, underlined, strikethrough/)).toBeTruthy();
      expect(getByText(/paragraph alignment/)).toBeTruthy();
    });

    it('should display correct description for Associations step', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      // Navigate to Associations step (step 4)
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText(/Associations connect text to characters, places, and other story elements/)).toBeTruthy();
      expect(getByText(/select text and long press to create new ones/)).toBeTruthy();
    });

    it('should explain how to view existing associations', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      // Navigate to Associations step (step 4)
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText(/Tap highlighted text to view existing associations/)).toBeTruthy();
    });

    it('should explain how to create new associations', () => {
      const { getByText } = render(
        <EditorTutorial visible={true} onComplete={mockOnComplete} />
      );

      // Navigate to Associations step (step 4)
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Next'));

      expect(getByText(/select text and long press to create new ones/)).toBeTruthy();
    });
  });
});
