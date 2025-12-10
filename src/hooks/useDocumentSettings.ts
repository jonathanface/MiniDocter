import { useState, useEffect } from 'react';
import { apiGet } from '../utils/api';

export interface DocumentSettings {
  spellcheck: boolean;
  autotab: boolean;
}

const defaultSettings: DocumentSettings = {
  spellcheck: true,
  autotab: true,
};

export const useDocumentSettings = (storyId: string | undefined) => {
  const [settings, setSettings] = useState<DocumentSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) {
      setSettings(defaultSettings);
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await apiGet(`/stories/${storyId}/settings`);

        // Handle 404 (no settings) as success with defaults
        if (response.status === 404) {
          setSettings(defaultSettings);
          setError(null);
        } else if (!response.ok) {
          throw new Error(`Failed to fetch settings: ${response.status}`);
        } else {
          const data = await response.json();
          setSettings(data || defaultSettings);
          setError(null);
        }
      } catch (err) {
        console.error('[DocumentSettings] Failed to fetch:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Use defaults on error
        setSettings(defaultSettings);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [storyId]);

  return { settings, loading, error };
};
