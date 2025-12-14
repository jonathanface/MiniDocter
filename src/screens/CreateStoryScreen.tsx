import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { apiGet, getApiBaseUrl } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { Series } from '../types';

export const CreateStoryScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSeries, setIsLoadingSeries] = useState(true);
  const [tempImagePath, setTempImagePath] = useState<string | null>(null);

  // Fetch series list on mount
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const response = await apiGet('/series');
        if (response.ok) {
          const data = await response.json();
          setSeriesList(data);
        }
      } catch (error) {
        console.error('Error fetching series:', error);
      } finally {
        setIsLoadingSeries(false);
      }
    };

    fetchSeries();
  }, []);

  // Fetch random default image on mount
  useEffect(() => {
    const fetchRandomImage = async () => {
      try {
        // Download the random image to a local temp file
        const fileUri = FileSystem.cacheDirectory + 'random-image-' + Date.now() + '.jpg';
        const downloadResult = await FileSystem.downloadAsync(
          'https://picsum.photos/300',
          fileUri
        );

        if (downloadResult.status === 200) {
          // Set the image URI for display
          setImageUri(downloadResult.uri);

          // Store file info for FormData
          setImageFile({
            uri: downloadResult.uri,
            name: 'random-image.jpg',
            type: 'image/jpeg',
          });

          // Track temp file path for cleanup
          setTempImagePath(downloadResult.uri);
        }
      } catch (error) {
        console.error('Error fetching random image:', error);
        // Silently fail - user can still pick their own image
      }
    };

    fetchRandomImage();

    // Cleanup temp file on unmount
    return () => {
      if (tempImagePath) {
        FileSystem.deleteAsync(tempImagePath, { idempotent: true }).catch((err) => {
          console.warn('Failed to delete temp image:', err);
        });
      }
    };
  }, []);

  const handlePickImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need permission to access your photos');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);

      // Delete temp random image if it exists (user is replacing it)
      if (tempImagePath) {
        FileSystem.deleteAsync(tempImagePath, { idempotent: true }).catch((err) => {
          console.warn('Failed to delete temp image:', err);
        });
        setTempImagePath(null);
      }

      // Prepare file metadata for FormData
      const filename = asset.uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      setImageFile({
        uri: asset.uri,
        name: filename,
        type,
      });
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a title for your story');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Required Field', 'Please enter a description for your story');
      return;
    }

    try {
      setIsSaving(true);

      // Get session token for authentication
      const sessionToken = await SecureStore.getItemAsync('session_token');

      // Create FormData for multipart/form-data submission
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());

      // Add image if selected
      // Backend expects field name "file", not "image"
      if (imageFile) {
        formData.append('file', {
          uri: imageFile.uri,
          name: imageFile.name,
          type: imageFile.type,
        } as any);
      }

      // Handle series assignment
      if (selectedSeriesId === 'new' && newSeriesName.trim()) {
        // Creating a new series
        formData.append('series_title', newSeriesName.trim());
        formData.append('series_place', '1');
      } else if (selectedSeriesId && selectedSeriesId !== 'none' && selectedSeriesId !== 'new') {
        // Assigning to existing series
        const selectedSeries = seriesList.find(s => s.series_id === selectedSeriesId);
        if (selectedSeries) {
          formData.append('series_id', selectedSeries.series_id);
          formData.append('series_name', selectedSeries.series_title);
          formData.append('series_place', String(selectedSeries.stories?.length || 1));
        }
      }

      // Debug logging
      console.log('Creating story with XMLHttpRequest');

      // Use XMLHttpRequest for file upload
      const newStory = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${getApiBaseUrl()}/stories`);

        // Set headers
        xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
        if (sessionToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
        }
        // Don't set Content-Type - let XMLHttpRequest set it with boundary

        xhr.withCredentials = true;

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            console.error('Server error:', xhr.status, xhr.responseText);
            reject(new Error(`HTTP error! status: ${xhr.status} - ${xhr.responseText}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network request failed'));
        };

        xhr.send(formData);
      });

      // Clean up temp image file after successful upload
      if (tempImagePath) {
        FileSystem.deleteAsync(tempImagePath, { idempotent: true }).catch((err) => {
          console.warn('Failed to delete temp image after upload:', err);
        });
        setTempImagePath(null);
      }

      // Navigate back to story list
      Alert.alert(
        'Success',
        'Story created successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to story list - it will refresh automatically
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating story:', error);
      Alert.alert(
        'Error',
        'Failed to create story. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (title.trim() || description.trim() || imageUri || selectedSeriesId !== '' || newSeriesName.trim()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgBody,
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
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    headerButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    headerButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelText: {
      color: colors.textSecondary,
    },
    saveText: {
      color: colors.primary,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 20,
    },
    descriptionInput: {
      height: 120,
      textAlignVertical: 'top',
    },
    helpText: {
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: -12,
      marginBottom: 20,
    },
    imageSection: {
      marginBottom: 20,
    },
    imageButton: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      marginBottom: 12,
    },
    imageButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    imagePreview: {
      width: '100%',
      height: 200,
      borderRadius: 8,
      backgroundColor: colors.bgSecondary,
    },
    pickerContainer: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      marginBottom: 20,
      overflow: 'hidden',
    },
    picker: {
      color: colors.textPrimary,
    },
    newSeriesInput: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 20,
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.cancelText]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Story</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerButton}
          disabled={isSaving}
        >
          <Text style={[styles.headerButtonText, styles.saveText]}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Enter story title"
          placeholderTextColor={colors.textPlaceholder}
          editable={!isSaving}
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Enter story description"
          placeholderTextColor={colors.textPlaceholder}
          multiline
          editable={!isSaving}
        />
        <Text style={styles.helpText}>
          Provide a brief description of your story
        </Text>

        <View style={styles.imageSection}>
          <Text style={styles.label}>Cover Image (Optional)</Text>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handlePickImage}
            disabled={isSaving}
          >
            <Text style={styles.imageButtonText}>
              {imageUri ? 'Change Image' : 'Pick an Image'}
            </Text>
          </TouchableOpacity>
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
          )}
        </View>

        <Text style={styles.label}>Series (Optional)</Text>
        {isLoadingSeries ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedSeriesId}
                onValueChange={(value) => {
                  setSelectedSeriesId(value);
                  if (value !== 'new') {
                    setNewSeriesName('');
                  }
                }}
                style={styles.picker}
                enabled={!isSaving}
              >
                <Picker.Item label="No series (standalone story)" value="none" />
                {seriesList.map((series) => (
                  <Picker.Item
                    key={series.series_id}
                    label={series.series_title}
                    value={series.series_id}
                  />
                ))}
                <Picker.Item label="Create new series..." value="new" />
              </Picker>
            </View>
            {selectedSeriesId === 'new' && (
              <TextInput
                style={styles.newSeriesInput}
                value={newSeriesName}
                onChangeText={setNewSeriesName}
                placeholder="Enter new series name"
                placeholderTextColor={colors.textPlaceholder}
                editable={!isSaving}
              />
            )}
          </>
        )}
      </ScrollView>

      {isSaving && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </SafeAreaView>
  );
};
