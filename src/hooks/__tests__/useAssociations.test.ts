import { renderHook, waitFor } from '@testing-library/react-native';
import { useAssociations, Association } from '../useAssociations';
import { apiGet } from '../../utils/api';

// Mock the api module
jest.mock('../../utils/api', () => ({
  apiGet: jest.fn(),
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

describe('useAssociations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error in tests
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return empty array when storyId is undefined', () => {
    const { result } = renderHook(() => useAssociations(undefined));

    expect(result.current.associations).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('should fetch associations successfully when storyId is provided', async () => {
    const mockAssociations: Association[] = [
      {
        association_id: '1',
        association_name: 'John Doe',
        aliases: 'Johnny, JD',
        association_type: 'character',
        short_description: 'Main character',
        portrait: 'http://example.com/john.jpg',
        case_sensitive: false,
      },
      {
        association_id: '2',
        association_name: 'New York',
        aliases: 'NYC',
        association_type: 'place',
        short_description: 'The big apple',
        portrait: 'http://example.com/nyc.jpg',
        case_sensitive: false,
      },
    ];

    mockApiGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAssociations,
    } as Response);

    const { result } = renderHook(() => useAssociations('story-123'));

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual(mockAssociations);
    expect(result.current.error).toBe(null);
    expect(mockApiGet).toHaveBeenCalledWith('/stories/story-123/associations/thumbs');
  });

  it('should handle empty associations array', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response);

    const { result } = renderHook(() => useAssociations('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should handle null data from API', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    } as Response);

    const { result } = renderHook(() => useAssociations('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should set error when API returns non-ok response', async () => {
    mockApiGet.mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { result } = renderHook(() => useAssociations('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch associations: 404');
    expect(console.error).toHaveBeenCalled();
  });

  it('should set error when API returns 500', async () => {
    mockApiGet.mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useAssociations('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch associations: 500');
  });

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network error');
    mockApiGet.mockRejectedValue(networkError);

    const { result } = renderHook(() => useAssociations('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual([]);
    expect(result.current.error).toBe('Network error');
    expect(console.error).toHaveBeenCalledWith('Failed to fetch associations:', networkError);
  });

  it('should handle non-Error thrown values', async () => {
    mockApiGet.mockRejectedValue('String error');

    const { result } = renderHook(() => useAssociations('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual([]);
    expect(result.current.error).toBe('Unknown error');
  });

  it('should refetch associations when storyId changes', async () => {
    const mockAssociations1: Association[] = [
      {
        association_id: '1',
        association_name: 'Character A',
        aliases: '',
        association_type: 'character',
        short_description: 'First character',
        portrait: '',
        case_sensitive: false,
      },
    ];

    const mockAssociations2: Association[] = [
      {
        association_id: '2',
        association_name: 'Character B',
        aliases: '',
        association_type: 'character',
        short_description: 'Second character',
        portrait: '',
        case_sensitive: false,
      },
    ];

    mockApiGet
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAssociations1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAssociations2,
      } as Response);

    const { result, rerender } = renderHook<
      ReturnType<typeof useAssociations>,
      { id: string }
    >(({ id }) => useAssociations(id), { initialProps: { id: 'story-123' } });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual(mockAssociations1);
    expect(mockApiGet).toHaveBeenCalledWith('/stories/story-123/associations/thumbs');

    // Change the storyId
    rerender({ id: 'story-456' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual(mockAssociations2);
    expect(mockApiGet).toHaveBeenCalledWith('/stories/story-456/associations/thumbs');
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it('should clear associations when storyId changes to undefined', async () => {
    const mockAssociations: Association[] = [
      {
        association_id: '1',
        association_name: 'Test',
        aliases: '',
        association_type: 'character',
        short_description: 'Test',
        portrait: '',
        case_sensitive: false,
      },
    ];

    mockApiGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAssociations,
    } as Response);

    const { result, rerender} = renderHook<
      ReturnType<typeof useAssociations>,
      { id: string | undefined }
    >(({ id }) => useAssociations(id), {
      initialProps: { id: 'story-123' as string | undefined },
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.associations).toEqual(mockAssociations);

    // Change to undefined
    rerender({ id: undefined });

    expect(result.current.associations).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should maintain loading state during fetch', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockApiGet.mockReturnValue(promise as Promise<Response>);

    const { result } = renderHook(() => useAssociations('story-123'));

    // Should be loading
    expect(result.current.loading).toBe(true);
    expect(result.current.associations).toEqual([]);

    // Resolve the promise
    resolvePromise!({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
