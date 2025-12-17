import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { CreateStoryScreen } from '../CreateStoryScreen';
import { apiGet } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';

// Mock dependencies
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  })),
}));

jest.mock('../../utils/api');
const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));
const mockImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;

jest.mock('expo-file-system/legacy', () => ({
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
  cacheDirectory: 'file:///cache/',
}));
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockColors = {
  bgBody: '#f5f5f5',
  bgPrimary: '#ffffff',
  bgCard: '#ffffff',
  bgSecondary: '#f0f0f0',
  borderLight: '#e0e0e0',
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textPlaceholder: '#cccccc',
  primary: '#4285F4',
};

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => ({
    colors: mockColors,
    theme: 'light',
  })),
}));

// Mock @react-native-picker/picker
jest.mock('@react-native-picker/picker', () => ({
  Picker: {
    Item: 'PickerItem',
  },
}));

describe('CreateStoryScreen', () => {
  const mockSeries = [
    {
      series_id: 'series-1',
      series_title: 'Test Series 1',
      series_description: 'Description',
      stories: [{ story_id: 'story-1', title: 'Story 1' }],
    },
    {
      series_id: 'series-2',
      series_title: 'Test Series 2',
      series_description: 'Description',
      stories: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => mockSeries,
    } as Response);

    (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
      status: 200,
      uri: 'file:///cache/random-image.jpg',
    });

    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never',
    });

    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: [],
    });
  });

  describe('Initial Rendering', () => {
    it('should render header with title and buttons', async () => {
      const { getByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('New Story')).toBeTruthy();
        expect(getByText('Cancel')).toBeTruthy();
        expect(getByText('Save')).toBeTruthy();
      });
    });

    it('should render all required form fields', async () => {
      const { getByPlaceholderText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByPlaceholderText('Enter story title')).toBeTruthy();
        expect(getByPlaceholderText('Enter story description')).toBeTruthy();
      });
    });

    it('should render cover image section', async () => {
      const { getByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Cover Image (Optional)')).toBeTruthy();
      });
    });

    it('should render series selector', async () => {
      const { getByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Series (Optional)')).toBeTruthy();
      });
    });
  });

  describe('Series Loading', () => {
    it('should fetch series list on mount', async () => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => mockSeries,
      } as Response);

      render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/series');
      });
    });

    it('should show loading indicator while fetching series', () => {
      mockApiGet.mockImplementation(
        () => new Promise(() => {}) as Promise<Response>
      );

      const { UNSAFE_queryByType } = render(<CreateStoryScreen />);

      const activityIndicator = UNSAFE_queryByType(
        require('react-native').ActivityIndicator
      );
      expect(activityIndicator).toBeTruthy();
    });

    it('should handle series fetch error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      mockApiGet.mockRejectedValue(new Error('Network error'));

      render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Error fetching series:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe('Random Image Loading', () => {
    it('should attempt to fetch random image on mount', async () => {
      render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
          'https://picsum.photos/300',
          expect.stringContaining('random-image')
        );
      });
    });

    it('should handle random image fetch failure gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      (FileSystem.downloadAsync as jest.Mock).mockRejectedValue(
        new Error('Download failed')
      );

      render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Error fetching random image:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      // Ensure series loads successfully for these tests
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => mockSeries,
      } as Response);
    });

    it.skip('should show error when saving without title', async () => {
      const { getByText, getByPlaceholderText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Save')).toBeTruthy();
      });

      const descInput = getByPlaceholderText('Enter story description');
      fireEvent.changeText(descInput, 'Test description');

      const saveButton = getByText('Save');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Required Field',
          'Please enter a title for your story'
        );
      });
    });

    it.skip('should show error when saving without description', async () => {
      const { getByText, getByPlaceholderText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Save')).toBeTruthy();
      });

      const titleInput = getByPlaceholderText('Enter story title');
      fireEvent.changeText(titleInput, 'Test title');

      const saveButton = getByText('Save');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Required Field',
          'Please enter a description for your story'
        );
      });
    });

    it.skip('should trim whitespace from title and description', async () => {
      const { getByText, getByPlaceholderText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Save')).toBeTruthy();
      });

      const titleInput = getByPlaceholderText('Enter story title');
      const descInput = getByPlaceholderText('Enter story description');

      fireEvent.changeText(titleInput, '   ');
      fireEvent.changeText(descInput, '   ');

      const saveButton = getByText('Save');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Required Field',
          'Please enter a title for your story'
        );
      });
    });
  });

  describe('Image Picker', () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => mockSeries,
      } as Response);
    });

    it.skip('should request permissions when picking image', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        granted: true,
        expires: 'never',
      });

      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: true,
        assets: [],
      });

      const { getByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Pick an Image')).toBeTruthy();
      });

      const pickButton = getByText('Pick an Image');
      fireEvent.press(pickButton);

      await waitFor(() => {
        expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
      });
    });

    it.skip('should show alert when permission is denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
        granted: false,
        expires: 'never',
      });

      const { getByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Pick an Image')).toBeTruthy();
      });

      const pickButton = getByText('Pick an Image');
      fireEvent.press(pickButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Required',
          'We need permission to access your photos'
        );
      });
    });

    it.skip('should update button text to "Change Image" after selecting image', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        granted: true,
        expires: 'never',
      });

      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{
          uri: 'file:///user-image.jpg',
          width: 300,
          height: 200,
          assetId: '123',
        }],
      });

      const { getByText, findByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Pick an Image')).toBeTruthy();
      });

      const pickButton = getByText('Pick an Image');
      fireEvent.press(pickButton);

      await waitFor(() => {
        expect(findByText('Change Image')).toBeTruthy();
      });
    });
  });

  describe('Cancel Functionality', () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => mockSeries,
      } as Response);
    });

    it.skip('should go back immediately if no changes made', async () => {
      const { getByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Cancel')).toBeTruthy();
      });

      const cancelButton = getByText('Cancel');
      fireEvent.press(cancelButton);

      expect(mockGoBack).toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it.skip('should show confirmation dialog when canceling with unsaved changes', async () => {
      const { getByText, getByPlaceholderText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Cancel')).toBeTruthy();
      });

      const titleInput = getByPlaceholderText('Enter story title');
      fireEvent.changeText(titleInput, 'Test title');

      const cancelButton = getByText('Cancel');
      fireEvent.press(cancelButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Discard Changes?',
          'You have unsaved changes. Are you sure you want to go back?',
          expect.arrayContaining([
            expect.objectContaining({ text: 'Keep Editing' }),
            expect.objectContaining({ text: 'Discard' }),
          ])
        );
      });
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => mockSeries,
      } as Response);
    });

    it('should render save button', async () => {
      const { getByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Save')).toBeTruthy();
      });
    });

    it.skip('should validate form before saving', async () => {
      const { getByText } = render(<CreateStoryScreen />);

      await waitFor(() => {
        expect(getByText('Save')).toBeTruthy();
      });

      const saveButton = getByText('Save');
      fireEvent.press(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator while fetching series', () => {
      mockApiGet.mockImplementation(
        () => new Promise(() => {}) as Promise<Response>
      );

      const { UNSAFE_queryByType } = render(<CreateStoryScreen />);

      const activityIndicator = UNSAFE_queryByType(
        require('react-native').ActivityIndicator
      );
      expect(activityIndicator).toBeTruthy();
    });
  });
});
