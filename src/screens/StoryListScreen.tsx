import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Story, Series } from '../types';
import { apiGet } from '../utils/api';
import { UserMenu } from '../components/UserMenu';
import { useTheme } from '../contexts/ThemeContext';

export const StoryListScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [stories, setStories] = useState<Story[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {

      // Fetch both stories and series in parallel using authenticated API
      const [storiesResponse, seriesResponse] = await Promise.all([
        apiGet('/stories'),
        apiGet('/series'),
      ]);


      if (storiesResponse.ok) {
        const storiesData = await storiesResponse.json();
        setStories(storiesData);
      } else {
        console.error('Failed to fetch stories:', storiesResponse.status);
      }

      if (seriesResponse.ok) {
        const seriesData = await seriesResponse.json();
        setSeries(seriesData);
      } else {
        console.error('Failed to fetch series:', seriesResponse.status);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeriesExpanded = (seriesId: string) => {
    setExpandedSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesId)) {
        newSet.delete(seriesId);
      } else {
        newSet.add(seriesId);
      }
      return newSet;
    });
  };

  const renderSeries = ({ item }: { item: Series }) => {
    // Check if image_url is a full URL (starts with http:// or https://)
    const hasValidImageUrl = item.image_url && (item.image_url.startsWith('http://') || item.image_url.startsWith('https://'));

    // Check if it's the default series icon path
    const isDefaultSeriesIcon = item.image_url && item.image_url.includes('story_series_icon.jpg');

    // If no custom image but has stories, use the first story's image (web app uses composite, we'll use first for simplicity)
    const shouldUseStoryImage = isDefaultSeriesIcon && item.stories && item.stories.length > 0;
    const firstStoryImage = shouldUseStoryImage ? item.stories[0].image_url : null;

    const isExpanded = expandedSeries.has(item.series_id);

    return (
      <View style={styles.card}>
        <View style={styles.imageContainer}>
          {hasValidImageUrl ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : shouldUseStoryImage && firstStoryImage ? (
            <Image
              source={{ uri: firstStoryImage }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : isDefaultSeriesIcon ? (
            <Image
              source={require('../../assets/img/icons/story_series_icon.jpg')}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>📚</Text>
            </View>
          )}
          <View style={styles.seriesBadge}>
            <Text style={styles.seriesBadgeText}>SERIES</Text>
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.series_title}
          </Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.series_description}
          </Text>
          {item.stories && item.stories.length > 0 && (
            <TouchableOpacity
              onPress={() => toggleSeriesExpanded(item.series_id)}
              style={styles.storyCountButton}
            >
              <Text style={styles.cardMeta}>
                {item.stories.length} {item.stories.length === 1 ? 'story' : 'stories'}
              </Text>
              <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>
          )}
          {isExpanded && item.stories && (
            <View style={styles.storiesListContainer}>
              {item.stories.map((story, index) => (
                <TouchableOpacity
                  key={story.story_id}
                  style={styles.storyItem}
                  onPress={() => (navigation as any).navigate('Editor', { storyId: story.story_id })}
                >
                  <Image
                    source={{ uri: story.image_url }}
                    style={styles.storyThumbnail}
                    resizeMode="cover"
                  />
                  <View style={styles.storyItemInfo}>
                    <Text style={styles.storyItemTitle} numberOfLines={1}>
                      {story.title}
                    </Text>
                    <Text style={styles.storyItemDescription} numberOfLines={2}>
                      {story.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderStory = ({ item }: { item: Story }) => {
    // Check if image_url is a full URL (starts with http:// or https://)
    const hasValidImageUrl = item.image_url && (item.image_url.startsWith('http://') || item.image_url.startsWith('https://'));

    // Check if it's the default story icon path
    const isDefaultStoryIcon = item.image_url && item.image_url.includes('story_standalone_icon.jpg');

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => (navigation as any).navigate('Editor', { storyId: item.story_id })}
      >
        {hasValidImageUrl ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : isDefaultStoryIcon ? (
          <Image
            source={require('../../assets/img/icons/story_standalone_icon.jpg')}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>📖</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgBody,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.bgPrimary,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    newButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
    },
    newButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    listContent: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: colors.shadowCard,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    imageContainer: {
      position: 'relative',
      width: '100%',
      height: 150,
    },
    cardImage: {
      width: '100%',
      height: 150,
      backgroundColor: colors.bgSecondary,
    },
    placeholderImage: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      fontSize: 48,
    },
    seriesBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    seriesBadgeText: {
      color: colors.textPrimary,
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    cardInfo: {
      padding: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    cardDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    cardMeta: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 8,
    },
    storyCountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    expandIcon: {
      fontSize: 10,
      color: colors.primary,
      marginLeft: 6,
    },
    storiesListContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    storyItem: {
      flexDirection: 'row',
      marginBottom: 12,
      backgroundColor: colors.bgSecondary,
      borderRadius: 8,
      overflow: 'hidden',
    },
    storyThumbnail: {
      width: 60,
      height: 60,
      backgroundColor: colors.bgPrimary,
    },
    storyItemInfo: {
      flex: 1,
      padding: 8,
      justifyContent: 'center',
    },
    storyItemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    storyItemDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 64,
    },
    emptyText: {
      fontSize: 18,
      color: colors.textTertiary,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textPlaceholder,
    },
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  const hasContent = series.length > 0 || stories.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <UserMenu />
        <Text style={styles.headerTitle}>My Works</Text>
        <TouchableOpacity style={styles.newButton}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {!hasContent ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No stories or series yet</Text>
          <Text style={styles.emptySubtext}>Tap + New to create your first story</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {series.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Series</Text>
              {series.map((item) => (
                <View key={item.series_id}>{renderSeries({ item })}</View>
              ))}
            </View>
          )}

          {stories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stories</Text>
              {stories.map((item) => (
                <View key={item.story_id}>{renderStory({ item })}</View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
