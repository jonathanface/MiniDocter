import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { StoryListScreen } from '../StoryListScreen';
import { apiGet } from '../../utils/api';

// Mock dependencies
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
  })),
}));

jest.mock('../../utils/api');
const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

jest.mock('../../components/UserMenu', () => ({
  UserMenu: () => {
    const React = require('react');
    return React.createElement('View', { testID: 'user-menu' });
  },
}));

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
  shadowCard: '#000000',
};

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => ({
    colors: mockColors,
  })),
}));

describe('StoryListScreen', () => {
  const mockStories = [
    {
      story_id: 'story-1',
      title: 'Test Story 1',
      description: 'Description 1',
      image_url: 'https://example.com/image1.jpg',
    },
    {
      story_id: 'story-2',
      title: 'Test Story 2',
      description: 'Description 2',
      image_url: 'https://example.com/image2.jpg',
    },
  ];

  const mockSeries = [
    {
      series_id: 'series-1',
      series_title: 'Test Series 1',
      series_description: 'Series Description 1',
      image_url: 'https://example.com/series1.jpg',
      stories: [
        {
          story_id: 'story-in-series-1',
          title: 'Story in Series 1',
          description: 'Story Description',
          image_url: 'https://example.com/story-in-series.jpg',
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading indicator while loading data', () => {
      mockApiGet.mockImplementation(
        () => new Promise(() => {}) as Promise<Response>
      );

      const { UNSAFE_queryByType } = render(<StoryListScreen />);

      const activityIndicator = UNSAFE_queryByType(
        require('react-native').ActivityIndicator
      );
      expect(activityIndicator).toBeTruthy();
    });
  });

  describe('Data Loading', () => {
    it('should fetch stories and series on mount', async () => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      render(<StoryListScreen />);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/stories');
        expect(mockApiGet).toHaveBeenCalledWith('/series');
      });
    });

    it('should display stories when fetch succeeds', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === '/stories') {
          return Promise.resolve({
            ok: true,
            json: async () => mockStories,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('Test Story 1')).toBeTruthy();
        expect(getByText('Description 1')).toBeTruthy();
      });
    });

    it('should display series when fetch succeeds', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === '/series') {
          return Promise.resolve({
            ok: true,
            json: async () => mockSeries,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('Test Series 1')).toBeTruthy();
        expect(getByText('Series Description 1')).toBeTruthy();
      });
    });

    it('should handle failed stories fetch', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      mockApiGet.mockImplementation((url: string) => {
        if (url === '/stories') {
          return Promise.resolve({
            ok: false,
            status: 500,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { queryByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to fetch stories:', 500);
      });

      consoleError.mockRestore();
    });

    it('should handle failed series fetch', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      mockApiGet.mockImplementation((url: string) => {
        if (url === '/series') {
          return Promise.resolve({
            ok: false,
            status: 500,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { queryByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to fetch series:', 500);
      });

      consoleError.mockRestore();
    });

    it('should handle network error', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      mockApiGet.mockRejectedValue(new Error('Network error'));

      render(<StoryListScreen />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to load data:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no stories or series exist', async () => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('No stories or series yet')).toBeTruthy();
        expect(getByText('Tap + New to create your first story')).toBeTruthy();
      });
    });
  });

  describe('Content Rendering', () => {
    it('should render series section when series exist', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === '/series') {
          return Promise.resolve({
            ok: true,
            json: async () => mockSeries,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('Series')).toBeTruthy();
      });
    });

    it('should render stories section when stories exist', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === '/stories') {
          return Promise.resolve({
            ok: true,
            json: async () => mockStories,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('Stories')).toBeTruthy();
      });
    });

    it('should render both sections when both exist', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === '/stories') {
          return Promise.resolve({
            ok: true,
            json: async () => mockStories,
          } as Response);
        }
        if (url === '/series') {
          return Promise.resolve({
            ok: true,
            json: async () => mockSeries,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('Series')).toBeTruthy();
        expect(getByText('Stories')).toBeTruthy();
      });
    });
  });

  describe('Series Functionality', () => {
    beforeEach(() => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === '/series') {
          return Promise.resolve({
            ok: true,
            json: async () => mockSeries,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });
    });

    it('should display SERIES badge on series cards', async () => {
      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('SERIES')).toBeTruthy();
      });
    });

    it('should show story count for series', async () => {
      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('1 story')).toBeTruthy();
      });
    });

    it('should show plural "stories" for multiple stories', async () => {
      const seriesWithMultipleStories = [
        {
          ...mockSeries[0],
          stories: [
            mockSeries[0].stories[0],
            { ...mockSeries[0].stories[0], story_id: 'story-2' },
          ],
        },
      ];

      mockApiGet.mockImplementation((url: string) => {
        if (url === '/series') {
          return Promise.resolve({
            ok: true,
            json: async () => seriesWithMultipleStories,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('2 stories')).toBeTruthy();
      });
    });

    it('should toggle series expansion when clicked', async () => {
      const { getByText, queryByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('1 story')).toBeTruthy();
      });

      // Initially not expanded
      expect(queryByText('Story in Series 1')).toBeNull();

      // Click to expand
      fireEvent.press(getByText('▶'));

      await waitFor(() => {
        expect(getByText('Story in Series 1')).toBeTruthy();
      });

      // Click to collapse
      fireEvent.press(getByText('▼'));

      await waitFor(() => {
        expect(queryByText('Story in Series 1')).toBeNull();
      });
    });

    it('should navigate to story editor when story in series is clicked', async () => {
      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('1 story')).toBeTruthy();
      });

      // Expand series
      fireEvent.press(getByText('▶'));

      await waitFor(() => {
        expect(getByText('Story in Series 1')).toBeTruthy();
      });

      // Click story
      fireEvent.press(getByText('Story in Series 1'));

      expect(mockNavigate).toHaveBeenCalledWith('Editor', {
        storyId: 'story-in-series-1',
      });
    });
  });

  describe('Stories Functionality', () => {
    beforeEach(() => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === '/stories') {
          return Promise.resolve({
            ok: true,
            json: async () => mockStories,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });
    });

    it('should display multiple stories', async () => {
      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('Test Story 1')).toBeTruthy();
        expect(getByText('Test Story 2')).toBeTruthy();
      });
    });

    it('should navigate to editor when story is clicked', async () => {
      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('Test Story 1')).toBeTruthy();
      });

      fireEvent.press(getByText('Test Story 1'));

      expect(mockNavigate).toHaveBeenCalledWith('Editor', {
        storyId: 'story-1',
      });
    });
  });

  describe('Header', () => {
    beforeEach(() => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);
    });

    it('should render header with Stories title', async () => {
      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('Stories')).toBeTruthy();
      });
    });

    it('should render UserMenu', async () => {
      const { getByTestId } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByTestId('user-menu')).toBeTruthy();
      });
    });

    it('should render + New button', async () => {
      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('+ New')).toBeTruthy();
      });
    });
  });

  describe('Image Handling', () => {
    it('should render placeholder emoji for stories without valid image URL', async () => {
      const storiesWithoutImage = [
        {
          ...mockStories[0],
          image_url: '',
        },
      ];

      mockApiGet.mockImplementation((url: string) => {
        if (url === '/stories') {
          return Promise.resolve({
            ok: true,
            json: async () => storiesWithoutImage,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('📖')).toBeTruthy();
      });
    });

    it('should render placeholder emoji for series without valid image URL', async () => {
      const seriesWithoutImage = [
        {
          ...mockSeries[0],
          image_url: '',
        },
      ];

      mockApiGet.mockImplementation((url: string) => {
        if (url === '/series') {
          return Promise.resolve({
            ok: true,
            json: async () => seriesWithoutImage,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      const { getByText } = render(<StoryListScreen />);

      await waitFor(() => {
        expect(getByText('📚')).toBeTruthy();
      });
    });
  });
});
