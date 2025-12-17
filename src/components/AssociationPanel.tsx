import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Association } from '../types';
import { apiGet, apiPut, apiPost, getApiBaseUrl } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { LexicalEditor, LexicalEditorRef } from './LexicalEditor';
import { useAssociations, Association as AssociationFromHook } from '../hooks/useAssociations';

interface AssociationPanelProps {
  visible: boolean;
  associationId: string | null;
  storyId: string;
  onClose: () => void;
}

export const AssociationPanel: React.FC<AssociationPanelProps> = ({
  visible,
  associationId,
  storyId,
  onClose,
}) => {
  const { colors } = useTheme();
  const [association, setAssociation] = useState<Association | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summaryEditorReady, setSummaryEditorReady] = useState(false);
  const [backgroundEditorReady, setBackgroundEditorReady] = useState(false);
  const [currentAssociationId, setCurrentAssociationId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const summaryEditorRef = useRef<LexicalEditorRef>(null);
  const backgroundEditorRef = useRef<LexicalEditorRef>(null);

  // Fetch associations for highlighting text
  const { associations } = useAssociations(storyId);

  // Set initial association ID when panel opens
  useEffect(() => {
    if (visible && associationId) {
      setCurrentAssociationId(associationId);
    } else if (!visible) {
      // Reset states when panel closes
      setSummaryEditorReady(false);
      setBackgroundEditorReady(false);
      setCurrentAssociationId(null);
      setSelectedImage(null);
    }
  }, [visible, associationId]);

  // Load association data when currentAssociationId changes
  useEffect(() => {
    if (currentAssociationId) {
      loadAssociation(currentAssociationId);
    }
  }, [currentAssociationId]);

  // Update summary editor content when both association and editor are ready
  useEffect(() => {
    if (association && summaryEditorReady && summaryEditorRef.current) {
      const shortDesc = association.short_description || '';

      // Convert plain text to backend format expected by Lexical editor
      summaryEditorRef.current.setContent({
        items: [{
          key_id: '0',
          chunk: {
            children: [{
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: shortDesc,
              type: "text",
              version: 1
            }],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textFormat: 0
          },
          place: '0'
        }]
      });
    }
  }, [association, summaryEditorReady]);

  // Update background editor content when both association and editor are ready
  useEffect(() => {
    if (association && backgroundEditorReady && backgroundEditorRef.current) {
      const extendedDesc = association.details?.extended_description || '';

      // Convert plain text to backend format expected by Lexical editor
      backgroundEditorRef.current.setContent({
        items: [{
          key_id: '0',
          chunk: {
            children: [{
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: extendedDesc,
              type: "text",
              version: 1
            }],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textFormat: 0
          },
          place: '0'
        }]
      });
    }
  }, [association, backgroundEditorReady]);

  const handleSummaryEditorReady = () => {
    setSummaryEditorReady(true);
  };

  const handleBackgroundEditorReady = () => {
    setBackgroundEditorReady(true);
  };

  const handleAssociationClick = (clickedAssociation: AssociationFromHook) => {
    // Update the current association ID to load the clicked association
    setCurrentAssociationId(clickedAssociation.association_id);
    // Reset editor ready states so they can be set again when new content loads
    setSummaryEditorReady(false);
    setBackgroundEditorReady(false);
    // Clear selected image when switching associations
    setSelectedImage(null);
  };

  const loadAssociation = async (idToLoad: string) => {
    if (!idToLoad || !storyId) return;

    try {
      setLoading(true);
      const response = await apiGet(`/stories/${storyId}/associations/${idToLoad}`);

      if (!response.ok) {
        throw new Error(`Failed to load association: ${response.status}`);
      }

      const data: Association = await response.json();
      setAssociation(data);
    } catch (error) {
      console.error('Failed to load association:', error);
      setAssociation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!association || !storyId || !summaryEditorRef.current || !backgroundEditorRef.current) return;

    try {
      setSaving(true);

      // Get content from both editors
      const summaryContent = await summaryEditorRef.current.getContent();
      const backgroundContent = await backgroundEditorRef.current.getContent();

      if (!summaryContent || !summaryContent.blocks || !backgroundContent || !backgroundContent.blocks) {
        throw new Error('Failed to get editor content');
      }

      // Convert Lexical blocks to plain text
      const shortDescription = summaryContent.blocks
        .map((block: any) => {
          if (!block.chunk || !block.chunk.children) return '';
          return block.chunk.children
            .map((child: any) => child.text || '')
            .join('');
        })
        .join('\n');

      const extendedDescription = backgroundContent.blocks
        .map((block: any) => {
          if (!block.chunk || !block.chunk.children) return '';
          return block.chunk.children
            .map((child: any) => child.text || '')
            .join('');
        })
        .join('\n');

      // Update association with new descriptions
      const payload = {
        ...association,
        short_description: shortDescription,
        details: {
          ...association.details,
          extended_description: extendedDescription,
        },
      };

      // The WriteAssociationsEndpoint expects an array of associations
      const associationsArray = [payload];

      const response = await apiPut(
        `/stories/${storyId}/associations`,
        associationsArray
      );

      if (!response.ok) {
        const responseText = await response.text();
        console.error('Save failed:', response.status, responseText);
        throw new Error(`Failed to save: ${response.status}`);
      }

      // Update local state with the new data
      setAssociation(payload);

      // If a new image was selected, upload it separately using FormData
      if (selectedImage) {
        try {
          const sessionToken = await SecureStore.getItemAsync('session_token');

          // Create FormData
          const formData = new FormData();
          formData.append('file', {
            uri: selectedImage,
            name: 'portrait.jpg',
            type: 'image/jpeg',
          } as any);

          // Use XMLHttpRequest for file upload (PUT with type query parameter)
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', `${getApiBaseUrl()}/stories/${storyId}/associations/${association.association_id}/upload?type=${association.association_type}`);

            // Set headers
            xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
            if (sessionToken) {
              xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
            }

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                console.error('Image upload failed:', xhr.status, xhr.responseText);
                reject(new Error(`Failed to upload image: ${xhr.status}`));
              }
            };

            xhr.onerror = () => {
              reject(new Error('Network request failed'));
            };

            xhr.send(formData);
          });

          // Clear selected image after successful upload
          setSelectedImage(null);

          // Reload association to get updated portrait URL
          await loadAssociation(association.association_id);
        } catch (error) {
          console.error('Failed to upload image:', error);
          Alert.alert('Warning', 'Association saved but image upload failed. Please try again.');
          setSaving(false);
          return;
        }
      }

      Alert.alert('Success', 'Association saved successfully');
    } catch (error) {
      console.error('Failed to save association:', error);
      Alert.alert('Error', 'Failed to save association. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to select an image.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const getTypeLabel = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'character':
        return colors.associationCharacter;
      case 'place':
        return colors.associationPlace;
      case 'event':
        return colors.associationEvent;
      case 'item':
        return colors.associationItem;
      default:
        return '#9ca3af';
    }
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    panel: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      minHeight: '50%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitleContainer: {
      flex: 1,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 2,
    },
    saveButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      marginRight: 8,
    },
    saveButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 24,
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    typeBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginBottom: 16,
    },
    typeBadgeText: {
      color: colors.bgPrimary, // Use background color as text (white in light mode, dark in dark mode)
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
    portraitContainer: {
      alignItems: 'center',
      marginBottom: 16,
      position: 'relative',
    },
    portrait: {
      width: 150,
      height: 150,
      borderRadius: 12,
    },
    imageOverlay: {
      position: 'absolute',
      bottom: 0,
      width: 150,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingVertical: 8,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      alignItems: 'center',
    },
    imageOverlayText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    name: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 16,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    sectionText: {
      fontSize: 16,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    summaryText: {
      fontSize: 16,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    editorContainer: {
      height: 150,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      overflow: 'hidden',
    },
    editorContainerLarge: {
      height: 250,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      overflow: 'hidden',
    },
    errorText: {
      fontSize: 16,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 40,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.panel} edges={['bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              {association ? (
                <>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {association.association_name}
                  </Text>
                  <Text style={styles.headerSubtitle}>ASSOCIATION</Text>
                </>
              ) : (
                <Text style={styles.headerTitle}>Association</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              disabled={saving || !association}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
              </View>
            ) : association ? (
              <>
                {/* Type Badge */}
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: getTypeColor(association.association_type) },
                  ]}
                >
                  <Text style={styles.typeBadgeText}>
                    {getTypeLabel(association.association_type)}
                  </Text>
                </View>

                {/* Portrait */}
                {(association.portrait || selectedImage) && (
                  <TouchableOpacity onPress={handlePickImage} style={styles.portraitContainer}>
                    <Image
                      source={{
                        uri: selectedImage || `${association.portrait}?t=${Date.now()}`,
                        cache: 'reload'
                      }}
                      style={styles.portrait}
                      resizeMode="cover"
                    />
                    <View style={styles.imageOverlay}>
                      <Text style={styles.imageOverlayText}>Tap to change</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Short Description */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Summary</Text>
                  <View style={styles.editorContainer}>
                    <LexicalEditor
                      ref={summaryEditorRef}
                      backgroundColor={colors.bgPrimary}
                      textColor={colors.textPrimary}
                      readOnly={false}
                      associations={associations}
                      onReady={handleSummaryEditorReady}
                      onAssociationClick={handleAssociationClick}
                    />
                  </View>
                </View>

                {/* Extended Description */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Background</Text>
                  <View style={styles.editorContainerLarge}>
                    <LexicalEditor
                      ref={backgroundEditorRef}
                      backgroundColor={colors.bgPrimary}
                      textColor={colors.textPrimary}
                      readOnly={false}
                      associations={associations}
                      onReady={handleBackgroundEditorReady}
                      onAssociationClick={handleAssociationClick}
                    />
                  </View>
                </View>

                {/* Aliases */}
                {association.aliases && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Aliases</Text>
                    <Text style={styles.sectionText}>{association.aliases}</Text>
                  </View>
                )}

                {/* Case Sensitive */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Case Sensitive</Text>
                  <Text style={styles.sectionText}>
                    {association.case_sensitive ? 'Yes' : 'No'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.errorText}>Failed to load association details</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
