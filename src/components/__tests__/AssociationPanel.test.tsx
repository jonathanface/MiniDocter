import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AssociationPanel } from '../AssociationPanel';
import { apiGet } from '../../utils/api';
import { Association } from '../../types';

// Mock dependencies
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

jest.mock('expo-file-system', () => ({
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
  cacheDirectory: 'file:///cache/',
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../utils/api', () => ({
  apiGet: jest.fn(),
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      bgPrimary: '#ffffff',
      textPrimary: '#000000',
      textSecondary: '#666666',
      textTertiary: '#999999',
      borderLight: '#e0e0e0',
      associationCharacter: '#4ade80',
      associationPlace: '#60a5fa',
      associationEvent: '#f472b6',
      associationItem: '#a78bfa',
    },
  })),
}));

jest.mock('../../hooks/useAssociations', () => ({
  useAssociations: jest.fn(() => ({
    associations: [],
  })),
}));

jest.mock('../LexicalEditor', () => ({
  LexicalEditor: jest.fn(() => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'lexical-editor-mock' });
  }),
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

describe('AssociationPanel', () => {
  const mockOnClose = jest.fn();
  const defaultProps = {
    visible: true,
    associationId: 'assoc-123',
    storyId: 'story-456',
    onClose: mockOnClose,
  };

  const mockAssociation: Association = {
    association_id: 'assoc-123',
    association_name: 'John Doe',
    aliases: 'Johnny, JD',
    association_type: 'character',
    short_description: 'Main protagonist',
    portrait: 'https://example.com/portrait.jpg',
    case_sensitive: false,
    details: {
      aliases: 'Johnny, JD',
      case_sensitive: false,
      extended_description: 'A brave hero on a quest',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when visible is false', () => {
    const { queryByText } = render(
      <AssociationPanel {...defaultProps} visible={false} />
    );

    expect(queryByText('Association')).toBeNull();
  });

  it('should render modal when visible is true', () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => mockAssociation,
    } as Response);

    const { getByText } = render(<AssociationPanel {...defaultProps} />);

    expect(getByText('Association')).toBeTruthy();
  });

  it('should display loading indicator while fetching data', () => {
    mockApiGet.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => mockAssociation,
              } as Response),
            100
          )
        )
    );

    const { getByTestId, UNSAFE_queryByType } = render(
      <AssociationPanel {...defaultProps} />
    );

    // Check for ActivityIndicator
    const activityIndicator = UNSAFE_queryByType(
      require('react-native').ActivityIndicator
    );
    expect(activityIndicator).toBeTruthy();
  });

  it('should fetch and display association data', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => mockAssociation,
    } as Response);

    const { getByText } = render(<AssociationPanel {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
    });

    // Summary and Background are now in LexicalEditor, so just check other fields
    expect(getByText('Johnny, JD')).toBeTruthy();
    expect(getByText('No')).toBeTruthy(); // case_sensitive: false
  });

  it('should display type badge with correct label', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => mockAssociation,
    } as Response);

    const { getByText } = render(<AssociationPanel {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Character')).toBeTruthy();
    });
  });

  it('should display "Yes" for case sensitive associations', async () => {
    const caseSensitiveAssociation = {
      ...mockAssociation,
      case_sensitive: true,
    };

    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => caseSensitiveAssociation,
    } as Response);

    const { getByText } = render(<AssociationPanel {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Yes')).toBeTruthy();
    });
  });

  it('should handle different association types', async () => {
    const types = [
      { type: 'character', label: 'Character' },
      { type: 'place', label: 'Place' },
      { type: 'event', label: 'Event' },
      { type: 'item', label: 'Item' },
    ];

    for (const { type, label } of types) {
      const association = { ...mockAssociation, association_type: type };
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => association,
      } as Response);

      const { getByText } = render(
        <AssociationPanel {...defaultProps} key={type} />
      );

      await waitFor(() => {
        expect(getByText(label)).toBeTruthy();
      });
    }
  });

  it('should display error message when API call fails', async () => {
    mockApiGet.mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { getByText } = render(<AssociationPanel {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Failed to load association details')).toBeTruthy();
    });
  });

  it('should handle network errors gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    const { getByText } = render(<AssociationPanel {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Failed to load association details')).toBeTruthy();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load association:',
        expect.any(Error)
      );
    });

    consoleError.mockRestore();
  });

  it('should call onClose when close button is pressed', () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => mockAssociation,
    } as Response);

    const { getByText } = render(<AssociationPanel {...defaultProps} />);

    fireEvent.press(getByText('✕'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not fetch data when associationId is null', () => {
    const { queryByText } = render(
      <AssociationPanel {...defaultProps} associationId={null} />
    );

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('should refetch data when associationId changes', async () => {
    const association1: Association = { ...mockAssociation, association_id: 'assoc-1' };
    const association2: Association = {
      ...mockAssociation,
      association_id: 'assoc-2',
      association_name: 'Jane Smith',
    };

    mockApiGet
      .mockResolvedValueOnce({
        ok: true,
        json: async () => association1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => association2,
      } as Response);

    const { rerender, getByText } = render(
      <AssociationPanel {...defaultProps} associationId="assoc-1" />
    );

    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
    });

    rerender(
      <AssociationPanel {...defaultProps} associationId="assoc-2" />
    );

    await waitFor(() => {
      expect(getByText('Jane Smith')).toBeTruthy();
    });

    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it('should not display portrait section when portrait is not provided', async () => {
    const noPortraitAssociation = {
      ...mockAssociation,
      portrait: '',
    };

    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => noPortraitAssociation,
    } as Response);

    const { queryByTestId, UNSAFE_queryByType } = render(
      <AssociationPanel {...defaultProps} />
    );

    await waitFor(() => {
      const images = UNSAFE_queryByType(require('react-native').Image);
      expect(images).toBeNull();
    });
  });

  it('should not display aliases section when aliases are empty', async () => {
    const noAliasesAssociation = {
      ...mockAssociation,
      aliases: '',
    };

    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => noAliasesAssociation,
    } as Response);

    const { queryByText } = render(<AssociationPanel {...defaultProps} />);

    await waitFor(() => {
      expect(queryByText('Aliases')).toBeNull();
    });
  });

  it('should not display extended description when not provided', async () => {
    const noExtendedDescAssociation = {
      ...mockAssociation,
      details: undefined,
    };

    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => noExtendedDescAssociation,
    } as Response);

    const { queryByText } = render(<AssociationPanel {...defaultProps} />);

    await waitFor(() => {
      expect(queryByText('Background')).toBeNull();
    });
  });

  it('should call API with correct endpoint', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: async () => mockAssociation,
    } as Response);

    render(<AssociationPanel {...defaultProps} />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/stories/story-456/associations/assoc-123');
    });
  });

  it('should not fetch when visible changes from false to true without associationId', () => {
    const { rerender } = render(
      <AssociationPanel {...defaultProps} visible={false} associationId={null} />
    );

    rerender(<AssociationPanel {...defaultProps} visible={true} associationId={null} />);

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  describe('LexicalEditor Integration', () => {
    it('should render LexicalEditor components for summary and background', async () => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => mockAssociation,
      } as Response);

      const { getAllByTestId } = render(<AssociationPanel {...defaultProps} />);

      await waitFor(() => {
        const editors = getAllByTestId('lexical-editor-mock');
        // Should have 2 editors: summary and background
        expect(editors.length).toBe(2);
      });
    });

    it('should pass associations to LexicalEditor', async () => {
      const mockAssociations = [
        {
          association_id: 'assoc-1',
          association_name: 'Test',
          association_type: 'character',
          case_sensitive: false,
          aliases: '',
          short_description: '',
          portrait: '',
        },
      ];

      const { useAssociations } = require('../../hooks/useAssociations');
      useAssociations.mockReturnValue({ associations: mockAssociations });

      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => mockAssociation,
      } as Response);

      const { LexicalEditor } = require('../LexicalEditor');

      render(<AssociationPanel {...defaultProps} />);

      await waitFor(() => {
        const calls = LexicalEditor.mock.calls;
        const hasAssociations = calls.some((call: any) =>
          call[0].associations &&
          call[0].associations.length > 0 &&
          call[0].associations[0].association_id === 'assoc-1'
        );
        expect(hasAssociations).toBe(true);
      });
    });

    it('should handle association click by loading new association', async () => {
      const association1 = { ...mockAssociation, association_id: 'assoc-1' };
      const association2 = {
        ...mockAssociation,
        association_id: 'assoc-2',
        association_name: 'Jane Smith',
      };

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => association1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => association2,
        } as Response);

      const { LexicalEditor } = require('../LexicalEditor');
      let onAssociationClick: any;

      LexicalEditor.mockImplementation((props: any) => {
        const React = require('react');
        const { View } = require('react-native');
        onAssociationClick = props.onAssociationClick;
        return React.createElement(View, { testID: 'lexical-editor-mock' });
      });

      const { getByText } = render(<AssociationPanel {...defaultProps} associationId="assoc-1" />);

      await waitFor(() => {
        expect(getByText('John Doe')).toBeTruthy();
      });

      // Simulate clicking an association
      onAssociationClick({ association_id: 'assoc-2', association_name: 'Jane Smith' });

      await waitFor(() => {
        expect(getByText('Jane Smith')).toBeTruthy();
      });

      expect(mockApiGet).toHaveBeenCalledTimes(2);
      expect(mockApiGet).toHaveBeenCalledWith('/stories/story-456/associations/assoc-1');
      expect(mockApiGet).toHaveBeenCalledWith('/stories/story-456/associations/assoc-2');
    });

    it('should pass onReady callback to LexicalEditors', async () => {
      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => mockAssociation,
      } as Response);

      const { LexicalEditor } = require('../LexicalEditor');

      render(<AssociationPanel {...defaultProps} />);

      await waitFor(() => {
        const calls = LexicalEditor.mock.calls;
        const allHaveOnReady = calls.every((call: any) => typeof call[0].onReady === 'function');
        expect(allHaveOnReady).toBe(true);
        expect(calls.length).toBeGreaterThan(0);
      });
    });

    it('should always render background editor even when extended_description is empty', async () => {
      const noExtendedDesc = {
        ...mockAssociation,
        details: undefined,
      };

      mockApiGet.mockResolvedValue({
        ok: true,
        json: async () => noExtendedDesc,
      } as Response);

      const { getAllByTestId } = render(<AssociationPanel {...defaultProps} />);

      await waitFor(() => {
        const editors = getAllByTestId('lexical-editor-mock');
        // Should have 2 editors: summary and background (always rendered)
        expect(editors.length).toBe(2);
      });
    });
  });
});
