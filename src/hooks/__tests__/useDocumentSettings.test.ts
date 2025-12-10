import { renderHook, waitFor } from '@testing-library/react-native';
import { useDocumentSettings } from '../useDocumentSettings';
import { apiGet } from '../../utils/api';

// Mock the api module
jest.mock('../../utils/api', () => ({
  apiGet: jest.fn(),
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

describe('useDocumentSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log and console.error in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return default settings when storyId is undefined', () => {
    const { result } = renderHook(() => useDocumentSettings(undefined));

    expect(result.current.settings).toEqual({
      spellcheck: true,
      autotab: true,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('should fetch settings successfully when storyId is provided', async () => {
    const mockSettings = {
      spellcheck: false,
      autotab: true,
    };

    mockApiGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSettings,
    } as Response);

    const { result } = renderHook(() => useDocumentSettings('story-123'));

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual(mockSettings);
    expect(result.current.error).toBe(null);
    expect(mockApiGet).toHaveBeenCalledWith('/stories/story-123/settings');
  });

  it('should use default settings when API returns 404', async () => {
    mockApiGet.mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { result } = renderHook(() => useDocumentSettings('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual({
      spellcheck: true,
      autotab: true,
    });
    expect(result.current.error).toBe(null);
    expect(mockApiGet).toHaveBeenCalledWith('/stories/story-123/settings');
  });

  it('should use default settings and set error when API fails', async () => {
    mockApiGet.mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useDocumentSettings('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual({
      spellcheck: true,
      autotab: true,
    });
    expect(result.current.error).toBe('Failed to fetch settings: 500');
    expect(mockApiGet).toHaveBeenCalledWith('/stories/story-123/settings');
  });

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network error');
    mockApiGet.mockRejectedValue(networkError);

    const { result } = renderHook(() => useDocumentSettings('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual({
      spellcheck: true,
      autotab: true,
    });
    expect(result.current.error).toBe('Network error');
    expect(console.error).toHaveBeenCalledWith('[DocumentSettings] Failed to fetch:', networkError);
  });

  it('should refetch settings when storyId changes', async () => {
    const mockSettings1 = {
      spellcheck: false,
      autotab: true,
    };
    const mockSettings2 = {
      spellcheck: true,
      autotab: false,
    };

    mockApiGet
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSettings1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSettings2,
      } as Response);

    const { result, rerender } = renderHook<
      ReturnType<typeof useDocumentSettings>,
      { id: string }
    >(
      ({ id }) => useDocumentSettings(id),
      { initialProps: { id: 'story-123' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual(mockSettings1);
    expect(mockApiGet).toHaveBeenCalledWith('/stories/story-123/settings');

    // Change the storyId
    rerender({ id: 'story-456' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual(mockSettings2);
    expect(mockApiGet).toHaveBeenCalledWith('/stories/story-456/settings');
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it('should use default settings when API returns null data', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    } as Response);

    const { result } = renderHook(() => useDocumentSettings('story-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual({
      spellcheck: true,
      autotab: true,
    });
    expect(result.current.error).toBe(null);
  });
});
