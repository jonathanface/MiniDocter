import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CustomToolbar } from '../CustomToolbar';
import { EditorBridge } from '@10play/tentap-editor';

// Mock the tentap-editor module
jest.mock('@10play/tentap-editor', () => ({
  useBridgeState: jest.fn(() => ({})),
}));

// Mock ThemeContext
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#4285F4',
      bgCard: '#ffffff',
      borderMedium: '#cccccc',
      textPrimary: '#000000',
      textSecondary: '#666666',
      bgToolbar: '#f5f5f5',
    },
  })),
}));

describe('CustomToolbar', () => {
  let mockEditor: Partial<EditorBridge>;

  beforeEach(() => {
    mockEditor = {
      toggleBold: jest.fn(),
      toggleItalic: jest.fn(),
      toggleUnderline: jest.fn(),
      toggleStrike: jest.fn(),
    };
  });

  it('should render all formatting buttons', () => {
    const { getByText } = render(
      <CustomToolbar editor={mockEditor as EditorBridge} />
    );

    expect(getByText('B')).toBeTruthy();
    expect(getByText('I')).toBeTruthy();
    expect(getByText('U')).toBeTruthy();
    expect(getByText('S')).toBeTruthy();
  });

  it('should call toggleBold when Bold button is pressed', () => {
    const { getByText } = render(
      <CustomToolbar editor={mockEditor as EditorBridge} />
    );

    fireEvent.press(getByText('B'));
    expect(mockEditor.toggleBold).toHaveBeenCalledTimes(1);
  });

  it('should call toggleItalic when Italic button is pressed', () => {
    const { getByText } = render(
      <CustomToolbar editor={mockEditor as EditorBridge} />
    );

    fireEvent.press(getByText('I'));
    expect(mockEditor.toggleItalic).toHaveBeenCalledTimes(1);
  });

  it('should call toggleUnderline when Underline button is pressed', () => {
    const { getByText } = render(
      <CustomToolbar editor={mockEditor as EditorBridge} />
    );

    fireEvent.press(getByText('U'));
    expect(mockEditor.toggleUnderline).toHaveBeenCalledTimes(1);
  });

  it('should call toggleStrike when Strike button is pressed', () => {
    const { getByText } = render(
      <CustomToolbar editor={mockEditor as EditorBridge} />
    );

    fireEvent.press(getByText('S'));
    expect(mockEditor.toggleStrike).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple button presses', () => {
    const { getByText } = render(
      <CustomToolbar editor={mockEditor as EditorBridge} />
    );

    fireEvent.press(getByText('B'));
    fireEvent.press(getByText('I'));
    fireEvent.press(getByText('B'));

    expect(mockEditor.toggleBold).toHaveBeenCalledTimes(2);
    expect(mockEditor.toggleItalic).toHaveBeenCalledTimes(1);
  });
});
