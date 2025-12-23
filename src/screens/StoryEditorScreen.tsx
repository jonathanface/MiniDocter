import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Linking,
  Keyboard,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { apiGet, apiPut, apiPost } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssociations, Association } from '../hooks/useAssociations';
import { useDocumentSettings } from '../hooks/useDocumentSettings';
import { AssociationPanel } from '../components/AssociationPanel';
import { LexicalEditor, LexicalEditorRef, SelectionInfo } from '../components/LexicalEditor';
import { EditorTutorial } from '../components/EditorTutorial';

interface Chapter {
  id: string;
  title: string;
  place: number;
}

interface Story {
  story_id: string;
  title: string;
  description: string;
  chapters: Chapter[];
}

export const StoryEditorScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as { storyId: string } | undefined;
  const storyId = params?.storyId;
  const { colors, theme } = useTheme();
  const { user, refreshUser, isNewUser, markTutorialComplete } = useAuth();

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [associationPanelVisible, setAssociationPanelVisible] = useState(false);
  const [selectedAssociationId, setSelectedAssociationId] = useState<string | null>(null);
  const [associationsListVisible, setAssociationsListVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);
  const isNavigatingAwayRef = useRef(false);
  const isHandlingNavigationRef = useRef(false);
  const handleSaveRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);

  // Formatting state
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

  // Text selection state
  const [selectionMenuVisible, setSelectionMenuVisible] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [associationSubmenuVisible, setAssociationSubmenuVisible] = useState(false);
  const [chapterPickerVisible, setChapterPickerVisible] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const editorContainerRef = useRef<View>(null);

  // Fetch associations for coloring text
  const { associations, refreshAssociations } = useAssociations(storyId);

  // Fetch document settings
  const { settings } = useDocumentSettings(storyId);

  // Reference to Lexical editor
  const editorRef = useRef<LexicalEditorRef>(null);

  // Load story and chapters
  useEffect(() => {
    if (!storyId) {
      Alert.alert('Error', 'No story ID provided');
      navigation.goBack();
      return;
    }

    loadStory();
  }, [storyId]);

  // Load chapter content when chapter changes
  useEffect(() => {
    if (currentChapterId && story) {
      loadChapterContent();
    }
  }, [currentChapterId]);

  // Auto-select chapter (last selected or first chapter)
  useEffect(() => {
    const loadLastSelectedChapter = async () => {
      if (story && story.chapters.length > 0 && !currentChapterId && storyId) {
        try {
          // Try to get the last selected chapter for this story
          const lastChapterId = await AsyncStorage.getItem(`lastChapter_${storyId}`);

          // Check if the stored chapter still exists in the story
          if (lastChapterId && story.chapters.some(ch => ch.id === lastChapterId)) {
            setCurrentChapterId(lastChapterId);
          } else {
            // Default to first chapter if no stored chapter or it doesn't exist
            setCurrentChapterId(story.chapters[0].id);
          }
        } catch (error) {
          console.error('Failed to load last selected chapter:', error);
          // Fallback to first chapter on error
          setCurrentChapterId(story.chapters[0].id);
        }
      }
    };

    loadLastSelectedChapter();
  }, [story, storyId]);

  // Save the current chapter selection to AsyncStorage
  useEffect(() => {
    const saveLastSelectedChapter = async () => {
      if (currentChapterId && storyId) {
        try {
          await AsyncStorage.setItem(`lastChapter_${storyId}`, currentChapterId);
        } catch (error) {
          console.error('Failed to save last selected chapter:', error);
        }
      }
    };

    saveLastSelectedChapter();
  }, [currentChapterId, storyId]);

  const createAssociation = async (type: 'character' | 'place' | 'event' | 'item') => {
    if (!storyId || !selectedText.trim()) return;

    try {
      // API expects an array of associations
      const associationData = [{
        association_name: selectedText.trim(),
        association_type: type,
        short_description: '',
        portrait: '',
        details: {
          extended_description: '',
        },
        case_sensitive: false,
        aliases: '',
      }];

      // Use apiPost helper which handles authentication and base URL
      const response = await apiPost(`/stories/${storyId}/associations`, associationData);

      if (response.ok) {
        Alert.alert('Success', `Created ${type}: ${selectedText}`);
        // Refresh associations list to show the new association
        refreshAssociations();
      } else if (response.status === 402) {
        Alert.alert('Subscription Required', 'You have reached the maximum number of associations. Please subscribe to create more.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Error', errorData.message || 'Failed to create association');
      }
    } catch (error) {
      console.error('Error creating association:', error);
      Alert.alert('Error', 'Failed to create association');
    }
  };

  const loadStory = async () => {
    try {
      const response = await apiGet(`/stories/${storyId}`);

      if (!response.ok) {
        throw new Error(`Failed to load story: ${response.status}`);
      }

      const storyData: Story = await response.json();
      setStory(storyData);

      // Show tutorial for new users when they first view their story
      if (isNewUser) {
        setShowTutorial(true);
      }
    } catch (error) {
      console.error('Failed to load story:', error);
      Alert.alert('Error', 'Failed to load story');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadChapterContent = async () => {
    if (!storyId || !currentChapterId) return;

    try {
      const response = await apiGet(`/stories/${storyId}/content?chapter=${currentChapterId}`);

      if (response.status === 404) {
        // No content yet, load empty editor
        editorRef.current?.setContent({ items: [] });
        // Reset unsaved changes flag when loading new content
        setHasUnsavedChanges(false);
        hasUnsavedChangesRef.current = false;
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load content: ${response.status}`);
      }

      const data = await response.json();

      // Send Lexical data directly to editor - no conversion needed!
      editorRef.current?.setContent(data);

      // Reset unsaved changes flag when loading new content
      setHasUnsavedChanges(false);
      hasUnsavedChangesRef.current = false;
    } catch (error) {
      console.error('Failed to load chapter content:', error);
      Alert.alert('Error', 'Failed to load chapter content');
    }
  };

  const handleCreateChapter = async () => {
    if (!storyId || !story) {
      Alert.alert('Error', 'No story loaded');
      return;
    }

    try {
      const newChapterNum = story.chapters.length + 1;
      const newChapterTitle = `Chapter ${newChapterNum}`;

      const response = await apiPost(`/stories/${storyId}/chapter`, {
        title: newChapterTitle,
        place: newChapterNum,
      });

      if (!response.ok) {
        throw new Error(`Failed to create chapter: ${response.status}`);
      }

      const newChapter = await response.json();

      // Reload the story to get updated chapters list
      await loadStory();

      // Switch to the new chapter
      setCurrentChapterId(newChapter.id);

      Alert.alert('Success', `Created ${newChapterTitle}`);
    } catch (error) {
      console.error('Failed to create chapter:', error);
      Alert.alert('Error', 'Failed to create new chapter');
    }
  };

  const handleSave = useCallback(async (silent = false) => {
    if (!storyId || !currentChapterId) {
      if (!silent) {
        Alert.alert('Error', 'No story or chapter selected');
      }
      return;
    }

    setSaving(true);
    try {
      // Get content directly from Lexical editor (already in Lexical JSON format!)
      const content = await editorRef.current?.getContent();

      if (!content) {
        throw new Error('Failed to get editor content');
      }

      // TODO: Convert Lexical editor state to backend format
      // For now, just send content structure
      const payload = {
        story_id: storyId,
        chapter_id: currentChapterId,
        blocks: content.blocks || [],
      };

      const response = await apiPut(`/stories/${storyId}`, payload);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save failed:', response.status, errorText);
        throw new Error(`Failed to save: ${response.status}`);
      }

      if (!silent) {
        Alert.alert('Success', 'Story saved successfully');
      }
      // Clear unsaved changes flag after successful save
      setHasUnsavedChanges(false);
      hasUnsavedChangesRef.current = false;
    } catch (error) {
      console.error('Failed to save story:', error);
      if (!silent) {
        Alert.alert('Error', 'Failed to save story. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [storyId, currentChapterId]);

  // Keep handleSaveRef up to date
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const handleBack = () => {
    // The beforeRemove listener will handle the unsaved changes prompt
    navigation.goBack();
  };

  // Intercept back navigation to check for unsaved changes
  // Set up listener only once, with no dependencies to prevent recreation
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If we're already handling navigation, don't show alert again
      if (isHandlingNavigationRef.current) {
        return;
      }

      // Check ref instead of state to avoid closure issues
      if (!hasUnsavedChangesRef.current) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Prompt the user before leaving
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save before leaving?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              // Set navigating flag to ignore any editor changes during navigation
              isNavigatingAwayRef.current = true;
              // Clear the unsaved changes flag
              hasUnsavedChangesRef.current = false;
              setHasUnsavedChanges(false);
              // Dispatch in next tick to ensure the alert is dismissed first
              // This prevents the component from unmounting before we can navigate
              setTimeout(() => {
                navigation.dispatch(e.data.action);
              }, 0);
            }
          },
          {
            text: 'Save',
            onPress: async () => {
              // Set navigating flag to ignore any editor changes during navigation
              isNavigatingAwayRef.current = true;
              // Use ref to get latest handleSave
              if (handleSaveRef.current) {
                await handleSaveRef.current(true);
              }
              // Flag is already cleared by handleSave
              // Dispatch in next tick to ensure the alert is dismissed first
              setTimeout(() => {
                navigation.dispatch(e.data.action);
              }, 0);
            },
          },
        ]
      );
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (format: 'pdf' | 'docx' | 'epub') => {
    try {
      // Check subscription status from current user object
      if (!user?.subscriber) {
        Alert.alert(
          'Subscription Required',
          'Exporting stories is only available to subscribers. Would you like to subscribe?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Subscribe', onPress: () => navigation.navigate('Subscribe' as never) },
          ]
        );
        return;
      }

      if (!story || !storyId) {
        Alert.alert('Error', 'No story loaded');
        return;
      }

      setExporting(true);
      setExportModalVisible(false);
      // Save current chapter first (silently, without showing success alert)
      await handleSave(true);

      // Fetch full story with all chapters and content in one request
      const fullStoryResponse = await apiGet(`/stories/${storyId}/full`);

      if (!fullStoryResponse.ok) {
        throw new Error('Failed to load story content');
      }

      const fullStoryData = await fullStoryResponse.json();

      // Collect HTML content from all chapters
      const htmlByChapter: Array<{ chapter: string; html: string }> = [];

      for (const chapterWithContent of fullStoryData.chapters_with_contents || []) {
        const chapterTitle = chapterWithContent.chapter.title;
        const blocks = chapterWithContent.blocks;

        // Send Lexical JSON as a special format that backend can detect and convert
        // The backend will see this starts with __LEXICAL__ and convert it
        htmlByChapter.push({
          chapter: chapterTitle,
          html: `__LEXICAL__${JSON.stringify(blocks)}`,
        });
      }

      // Call export API
      const exportPayload = {
        story_id: storyId,
        html_by_chapter: htmlByChapter,
        title: story.title,
        type: format,
        author: user?.first_name ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}` : user?.email || 'Unknown',
      };

      const exportResponse = await apiPut(`/stories/${storyId}/export?type=${format}`, exportPayload);

      if (exportResponse.status === 402) {
        Alert.alert(
          'Subscription Required',
          'Free accounts are unable to export their stories.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Subscribe', onPress: () => navigation.navigate('Subscribe' as never) },
          ]
        );
        return;
      }

      if (!exportResponse.ok) {
        throw new Error(`Export failed: ${exportResponse.status}`);
      }

      const result = await exportResponse.json();

      if (result.url) {
        Alert.alert(
          'Export Complete',
          'Your document is ready!',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Open', onPress: () => Linking.openURL(result.url) },
          ]
        );
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'An error occurred while exporting');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !story) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Story not found
        </Text>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {story.title}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setExportModalVisible(true)}
            style={[styles.iconButton]}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialIcons name="file-download" size={24} color={user?.subscriber ? colors.primary : colors.textSecondary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSave()}
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Chapter Selector - Dropdown Button */}
      {story.chapters.length > 0 && (
        <View style={[styles.chapterSelectorContainer, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity
            testID="chapter-selector-button"
            style={styles.chapterSelector}
            onPress={() => setChapterPickerVisible(true)}
          >
            <Text style={[styles.chapterLabel, { color: colors.textSecondary }]}>Viewing:</Text>
            <View style={styles.chapterDropdown}>
              <Text style={[styles.chapterDropdownText, { color: colors.textPrimary }]} numberOfLines={1}>
                {story.chapters.find(ch => ch.id === currentChapterId)?.title || 'Select Chapter'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            testID="new-chapter-button"
            style={[styles.newChapterButton, { backgroundColor: colors.primary }]}
            onPress={handleCreateChapter}
          >
            <MaterialIcons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Formatting Toolbar */}
      <View style={[styles.formattingToolbar, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.borderLight }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>
          {/* Text Formatting */}
          <TouchableOpacity
            style={[styles.formatButton, isBold && { backgroundColor: colors.primary }]}
            onPress={() => editorRef.current?.applyFormat('bold')}
          >
            <Text style={[styles.formatButtonText, { color: isBold ? colors.textPrimary : colors.textSecondary }]}>B</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatButton, isItalic && { backgroundColor: colors.primary }]}
            onPress={() => editorRef.current?.applyFormat('italic')}
          >
            <Text style={[styles.formatButtonText, styles.italicText, { color: isItalic ? colors.textPrimary : colors.textSecondary }]}>I</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatButton, isUnderline && { backgroundColor: colors.primary }]}
            onPress={() => editorRef.current?.applyFormat('underline')}
          >
            <Text style={[styles.formatButtonText, styles.underlineText, { color: isUnderline ? colors.textPrimary : colors.textSecondary }]}>U</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatButton, isStrikethrough && { backgroundColor: colors.primary }]}
            onPress={() => editorRef.current?.applyFormat('strikethrough')}
          >
            <Text style={[styles.formatButtonText, styles.strikethroughText, { color: isStrikethrough ? colors.textPrimary : colors.textSecondary }]}>S</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderMedium }]} />

          {/* Paragraph Alignment */}
          <TouchableOpacity
            style={[styles.formatButton, alignment === 'left' && { backgroundColor: colors.primary }]}
            onPress={() => editorRef.current?.applyAlignment('left')}
          >
            <MaterialIcons
              name="format-align-left"
              size={20}
              color={alignment === 'left' ? colors.textPrimary : colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatButton, alignment === 'center' && { backgroundColor: colors.primary }]}
            onPress={() => editorRef.current?.applyAlignment('center')}
          >
            <MaterialIcons
              name="format-align-center"
              size={20}
              color={alignment === 'center' ? colors.textPrimary : colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatButton, alignment === 'right' && { backgroundColor: colors.primary }]}
            onPress={() => editorRef.current?.applyAlignment('right')}
          >
            <MaterialIcons
              name="format-align-right"
              size={20}
              color={alignment === 'right' ? colors.textPrimary : colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatButton, alignment === 'justify' && { backgroundColor: colors.primary }]}
            onPress={() => editorRef.current?.applyAlignment('justify')}
          >
            <MaterialIcons
              name="format-align-justify"
              size={20}
              color={alignment === 'justify' ? colors.textPrimary : colors.textSecondary}
            />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Editor */}
      <View style={styles.editorContainer} ref={editorContainerRef}>
        <LexicalEditor
          ref={editorRef}
          backgroundColor={colors.bgEditor}
          textColor={colors.textPrimary}
          associations={associations}
          autotab={settings.autotab}
          spellcheck={settings.spellcheck}
          onContentChange={() => {
            // Mark as having unsaved changes when content changes
            // But ignore changes if we're in the process of navigating away
            if (!isNavigatingAwayRef.current) {
              setHasUnsavedChanges(true);
              hasUnsavedChangesRef.current = true;
            }
          }}
          onSave={(content) => {
            // Save triggered from editor
          }}
          onAssociationClick={(association, position) => {
            // Dismiss keyboard
            Keyboard.dismiss();

            // Open full association panel for editing
            setSelectedAssociationId(association.association_id);
            setAssociationPanelVisible(true);

            // Hide other menus
            setSelectionMenuVisible(false);
          }}
          onFormatChange={(formatState) => {
            setIsBold(formatState.isBold);
            setIsItalic(formatState.isItalic);
            setIsUnderline(formatState.isUnderline);
            setIsStrikethrough(formatState.isStrikethrough);
            setAlignment(formatState.alignment || 'left');
          }}
          onTextSelected={(selection) => {
            setSelectedText(selection.text);

            // Dismiss keyboard when context menu opens
            Keyboard.dismiss();

            // Measure the editor container position to get the correct screen coordinates
            editorContainerRef.current?.measureInWindow((x, y, width, height) => {
              // Store full selection info with absolute coordinates
              setSelectionInfo({
                text: selection.text,
                x: x + selection.x,
                y: y + selection.y,
                width: selection.width,
                height: selection.height,
              });
              setSelectionMenuVisible(true);
              setAssociationSubmenuVisible(false); // Reset submenu when new selection
            });
          }}
          onSelectionCleared={() => {
            setSelectionMenuVisible(false);
            setAssociationSubmenuVisible(false);
          }}
        />

        {/* Floating Associations Button */}
        {associations.length > 0 && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => setAssociationsListVisible(true)}
          >
            <Text style={styles.fabText}>📚</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Associations List Modal */}
      <Modal
        visible={associationsListVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAssociationsListVisible(false)}
      >
        <View style={styles.associationsModalOverlay}>
          <SafeAreaView style={[styles.associationsListPanel, { backgroundColor: colors.bgPrimary }]} edges={['bottom']}>
            <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Associations</Text>
              <TouchableOpacity onPress={() => setAssociationsListVisible(false)} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.associationsList}>
              {associations.map((assoc) => (
                <TouchableOpacity
                  key={assoc.association_id}
                  style={[styles.associationItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => {
                    setAssociationsListVisible(false);
                    setSelectedAssociationId(assoc.association_id);
                    setAssociationPanelVisible(true);
                  }}
                >
                  <Text style={[styles.associationName, { color: colors.textPrimary }]}>
                    {assoc.association_name}
                  </Text>
                  {assoc.short_description && (
                    <Text style={[styles.associationDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {assoc.short_description}
                    </Text>
                  )}
                  <Text style={[styles.associationType, { color: colors.textTertiary }]}>
                    {assoc.association_type.charAt(0).toUpperCase() + assoc.association_type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Association Panel */}
      <AssociationPanel
        visible={associationPanelVisible}
        associationId={selectedAssociationId}
        storyId={storyId || ''}
        onClose={() => {
          setAssociationPanelVisible(false);
          setSelectedAssociationId(null);
        }}
      />

      {/* Export Modal */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.exportModal, { backgroundColor: colors.bgModal }]}>
            <Text style={[styles.exportModalTitle, { color: colors.textPrimary }]}>
              Export Story
            </Text>
            {!user?.subscriber && (
              <Text style={[styles.exportWarning, { color: colors.warning }]}>
                Subscription required to export stories
              </Text>
            )}
            <TouchableOpacity
              style={[styles.exportOption, { borderColor: colors.borderMedium }]}
              onPress={() => handleExport('pdf')}
            >
              <MaterialIcons name="picture-as-pdf" size={24} color={colors.primary} />
              <Text style={[styles.exportOptionText, { color: colors.textPrimary }]}>
                Export as PDF
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportOption, { borderColor: colors.borderMedium }]}
              onPress={() => handleExport('docx')}
            >
              <MaterialIcons name="description" size={24} color={colors.primary} />
              <Text style={[styles.exportOptionText, { color: colors.textPrimary }]}>
                Export as DOCX
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportOption, { borderColor: colors.borderMedium }]}
              onPress={() => handleExport('epub')}
            >
              <MaterialIcons name="menu-book" size={24} color={colors.primary} />
              <Text style={[styles.exportOptionText, { color: colors.textPrimary }]}>
                Export as EPUB
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.bgSecondary }]}
              onPress={() => setExportModalVisible(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Chapter Picker Modal */}
      <Modal
        visible={chapterPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChapterPickerVisible(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <SafeAreaView edges={['bottom']} style={[styles.chapterPickerModal, { backgroundColor: colors.bgModal }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Chapter</Text>
              <TouchableOpacity onPress={() => setChapterPickerVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.chapterList}>
              {story.chapters.map((chapter, index) => (
                <TouchableOpacity
                  key={chapter.id}
                  style={[
                    styles.chapterListItem,
                    { borderBottomColor: colors.borderLight },
                    currentChapterId === chapter.id && { backgroundColor: colors.bgSecondary },
                  ]}
                  onPress={() => {
                    setCurrentChapterId(chapter.id);
                    setChapterPickerVisible(false);
                  }}
                >
                  <View style={styles.chapterListItemContent}>
                    <Text
                      style={[
                        styles.chapterListItemText,
                        { color: colors.textPrimary },
                        currentChapterId === chapter.id && { fontWeight: '600' },
                      ]}
                      numberOfLines={2}
                    >
                      {chapter.title}
                    </Text>
                  </View>
                  {currentChapterId === chapter.id && (
                    <MaterialIcons name="check" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Text Selection Context Menu */}
      <Modal
        visible={selectionMenuVisible && selectionInfo !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setSelectionMenuVisible(false);
          setAssociationSubmenuVisible(false);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setSelectionMenuVisible(false);
          setAssociationSubmenuVisible(false);
        }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              {selectionInfo && (() => {
                const screenWidth = Dimensions.get('window').width;
                const screenHeight = Dimensions.get('window').height;
                const menuWidth = 200; // minWidth from styles
                const menuHeight = associationSubmenuVisible ? 340 : 230; // Approximate height with/without submenu
                const padding = 10;
                const topSafeZone = 100; // Account for header/status bar
                const bottomSafeZone = 50; // Account for bottom safe area

                // Calculate horizontal position (center on selection, but keep within bounds)
                let leftPosition = selectionInfo.x - (menuWidth / 2);
                leftPosition = Math.max(padding, Math.min(leftPosition, screenWidth - menuWidth - padding));

                // Calculate vertical position
                // Try to show above selection first
                let topPosition = selectionInfo.y - menuHeight - padding;

                // If menu would go off top of screen, show it below the selection instead
                if (topPosition < topSafeZone) {
                  topPosition = selectionInfo.y + selectionInfo.height + padding;

                  // If it still goes off the bottom, adjust to fit on screen
                  if (topPosition + menuHeight > screenHeight - bottomSafeZone) {
                    // Position it to fit within screen bounds, prioritizing visibility
                    topPosition = Math.max(topSafeZone, screenHeight - menuHeight - bottomSafeZone);
                  }
                } else {
                  // Ensure it doesn't go off bottom even when positioned above
                  topPosition = Math.max(topSafeZone, Math.min(topPosition, screenHeight - menuHeight - bottomSafeZone));
                }

                return (
                  <View
                    style={[
                      styles.selectionMenu,
                      {
                        backgroundColor: colors.bgModal,
                        borderColor: colors.borderMedium,
                        top: topPosition,
                        left: leftPosition,
                        maxHeight: menuHeight,
                        maxWidth: menuWidth,
                      },
                    ]}
                  >

          {/* Selected Text Header - Non-clickable */}
          <View style={[styles.selectionHeader, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.selectionHeaderText, { color: colors.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">
              "{selectedText}"
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.selectionMenuItem, { borderBottomColor: colors.borderLight }]}
            onPress={async () => {
              // Cut - copy to clipboard and delete from editor
              await Clipboard.setStringAsync(selectedText);
              editorRef.current?.deleteSelection();
              setSelectionMenuVisible(false);
            }}
          >
            <MaterialIcons name="content-cut" size={20} color={colors.textPrimary} />
            <Text style={[styles.selectionMenuItemText, { color: colors.textPrimary }]}>Cut</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.selectionMenuItem, { borderBottomColor: colors.borderLight }]}
            onPress={async () => {
              // Copy to clipboard
              await Clipboard.setStringAsync(selectedText);
              setSelectionMenuVisible(false);
            }}
          >
            <MaterialIcons name="content-copy" size={20} color={colors.textPrimary} />
            <Text style={[styles.selectionMenuItemText, { color: colors.textPrimary }]}>Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.selectionMenuItem, { borderBottomColor: colors.borderLight }]}
            onPress={async () => {
              // Paste from clipboard
              const clipboardText = await Clipboard.getStringAsync();
              if (clipboardText) {
                editorRef.current?.insertText(clipboardText);
                setSelectionMenuVisible(false);
              }
            }}
          >
            <MaterialIcons name="content-paste" size={20} color={colors.textPrimary} />
            <Text style={[styles.selectionMenuItemText, { color: colors.textPrimary}]}>Paste</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selectionMenuItem}
            onPress={() => {
              setAssociationSubmenuVisible(!associationSubmenuVisible);
            }}
          >
            <MaterialIcons name="bookmark-add" size={20} color={colors.textPrimary} />
            <Text style={[styles.selectionMenuItemText, { color: colors.textPrimary }]}>Create Association</Text>
            <MaterialIcons
              name={associationSubmenuVisible ? "expand-less" : "expand-more"}
              size={20}
              color={colors.textSecondary}
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          {/* Association Type Submenu */}
          {associationSubmenuVisible && (
            <View style={[styles.submenu, { backgroundColor: colors.bgSecondary }]}>
              <TouchableOpacity
                style={[styles.submenuItem, { borderBottomColor: colors.borderLight }]}
                onPress={async () => {
                  await createAssociation('character');
                  setSelectionMenuVisible(false);
                  setAssociationSubmenuVisible(false);
                }}
              >
                <MaterialIcons name="person" size={18} color={colors.textPrimary} />
                <Text style={[styles.submenuItemText, { color: colors.textPrimary }]}>Character</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submenuItem, { borderBottomColor: colors.borderLight }]}
                onPress={async () => {
                  await createAssociation('place');
                  setSelectionMenuVisible(false);
                  setAssociationSubmenuVisible(false);
                }}
              >
                <MaterialIcons name="place" size={18} color={colors.textPrimary} />
                <Text style={[styles.submenuItemText, { color: colors.textPrimary }]}>Place</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submenuItem, { borderBottomColor: colors.borderLight }]}
                onPress={async () => {
                  await createAssociation('event');
                  setSelectionMenuVisible(false);
                  setAssociationSubmenuVisible(false);
                }}
              >
                <MaterialIcons name="event" size={18} color={colors.textPrimary} />
                <Text style={[styles.submenuItemText, { color: colors.textPrimary }]}>Event</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submenuItem}
                onPress={async () => {
                  await createAssociation('item');
                  setSelectionMenuVisible(false);
                  setAssociationSubmenuVisible(false);
                }}
              >
                <MaterialIcons name="category" size={18} color={colors.textPrimary} />
                <Text style={[styles.submenuItemText, { color: colors.textPrimary }]}>Item</Text>
              </TouchableOpacity>
            </View>
          )}
          </ScrollView>
          </View>
                );
              })()}
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Tutorial Modal for New Users */}
      <EditorTutorial
        visible={showTutorial}
        onComplete={async () => {
          setShowTutorial(false);
          await markTutorialComplete();
        }}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chapterSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  chapterSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  chapterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  chapterDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chapterDropdownText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  newChapterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterPickerModal: {
    width: '100%',
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  chapterList: {
    maxHeight: 500,
  },
  chapterListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  chapterListItemContent: {
    flex: 1,
    marginRight: 12,
  },
  chapterNumber: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  chapterListItemText: {
    fontSize: 16,
  },
  formattingToolbar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formatButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  formatButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  italicText: {
    fontStyle: 'italic',
  },
  underlineText: {
    textDecorationLine: 'underline',
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  editorContainer: {
    flex: 1,
    position: 'relative',
  },
  editor: {
    flex: 1,
    padding: 16,
  },
  toolbarContainer: {
    height: 50,
    paddingHorizontal: 8,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  fabText: {
    fontSize: 24,
  },
  associationsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  associationsListPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
  },
  associationsList: {
    flex: 1,
  },
  associationItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  associationName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  associationDesc: {
    fontSize: 14,
    marginBottom: 4,
  },
  associationType: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  exportModal: {
    width: '80%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  exportModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  exportWarning: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    gap: 12,
  },
  exportOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
  },
  selectionMenu: {
    position: 'absolute',
    borderRadius: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 9999,
    overflow: 'hidden',
    borderWidth: 1,
  },
  selectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  selectionHeaderText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  selectionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  selectionMenuItemText: {
    fontSize: 16,
  },
  submenu: {
    paddingLeft: 8,
    marginTop: 4,
  },
  submenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
  },
  submenuItemText: {
    fontSize: 15,
  },
});
