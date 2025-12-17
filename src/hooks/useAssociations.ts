import { useState, useEffect } from 'react';
import { apiGet } from '../utils/api';

export interface Association {
  association_id: string;
  association_name: string;
  aliases: string;
  association_type: string;
  short_description: string;
  portrait: string;
  case_sensitive: boolean;
}

export const useAssociations = (storyId: string | undefined) => {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssociations = async () => {
    if (!storyId) {
      setAssociations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiGet(`/stories/${storyId}/associations/thumbs`);

      if (!response.ok) {
        throw new Error(`Failed to fetch associations: ${response.status}`);
      }

      const data = await response.json();
      setAssociations(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch associations:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAssociations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssociations();
  }, [storyId]);

  return { associations, loading, error, refreshAssociations: fetchAssociations };
};
