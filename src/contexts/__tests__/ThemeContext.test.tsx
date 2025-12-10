import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from '../../theme/colors';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ThemeProvider', () => {
    it('should provide default dark theme when no saved theme exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      expect(result.current.colors).toEqual(darkColors);
    });

    it('should load saved dark theme from AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('dark');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@minidocter_theme');
      expect(result.current.colors).toEqual(darkColors);
    });

    it('should load saved light theme from AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('light');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
      });

      expect(result.current.colors).toEqual(lightColors);
    });

    it('should default to dark theme if AsyncStorage returns invalid value', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });
    });

    it('should handle AsyncStorage getItem error gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load theme preference:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light theme', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('dark');
      mockAsyncStorage.setItem.mockResolvedValue();

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
      });

      expect(result.current.colors).toEqual(lightColors);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@minidocter_theme', 'light');
    });

    it('should toggle from light to dark theme', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('light');
      mockAsyncStorage.setItem.mockResolvedValue();

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
      });

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      expect(result.current.colors).toEqual(darkColors);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@minidocter_theme', 'dark');
    });

    it('should handle AsyncStorage setItem error gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('dark');
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
      });

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to save theme preference:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('dark');
      mockAsyncStorage.setItem.mockResolvedValue();

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      act(() => {
        result.current.setTheme('light');
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
      });

      expect(result.current.colors).toEqual(lightColors);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@minidocter_theme', 'light');
    });

    it('should set theme to dark', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('light');
      mockAsyncStorage.setItem.mockResolvedValue();

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
      });

      act(() => {
        result.current.setTheme('dark');
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      expect(result.current.colors).toEqual(darkColors);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@minidocter_theme', 'dark');
    });
  });

  describe('useTheme', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleError.mockRestore();
    });
  });

  describe('color schemes', () => {
    it('should return dark colors when theme is dark', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('dark');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('dark');
      });

      expect(result.current.colors).toBe(darkColors);
      expect(result.current.colors).toHaveProperty('bgBody');
      expect(result.current.colors).toHaveProperty('textPrimary');
    });

    it('should return light colors when theme is light', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('light');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe('light');
      });

      expect(result.current.colors).toBe(lightColors);
      expect(result.current.colors).toHaveProperty('bgBody');
      expect(result.current.colors).toHaveProperty('textPrimary');
    });
  });
});
