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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { apiGet, apiPut } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAssociations } from '../hooks/useAssociations';
import { useDocumentSettings } from '../hooks/useDocumentSettings';
import { AssociationPanel } from '../components/AssociationPanel';
import { LexicalEditor, LexicalEditorRef } from '../components/LexicalEditor';

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

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [associationPanelVisible, setAssociationPanelVisible] = useState(false);
  const [selectedAssociationId, setSelectedAssociationId] = useState<string | null>(null);
  const [associationsListVisible, setAssociationsListVisible] = useState(false);

  // Formatting state
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

  // Fetch associations for coloring text
  const { associations } = useAssociations(storyId);

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

  // Auto-select first chapter
  useEffect(() => {
    if (story && story.chapters.length > 0 && !currentChapterId) {
      setCurrentChapterId(story.chapters[0].id);
    }
  }, [story]);

  const loadStory = async () => {
    try {
      const response = await apiGet(`/stories/${storyId}`);

      if (!response.ok) {
        throw new Error(`Failed to load story: ${response.status}`);
      }

      const storyData: Story = await response.json();
      setStory(storyData);
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
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load content: ${response.status}`);
      }

      const data = await response.json();

      // Send Lexical data directly to editor - no conversion needed!
      editorRef.current?.setContent(data);
    } catch (error) {
      console.error('Failed to load chapter content:', error);
      Alert.alert('Error', 'Failed to load chapter content');
    }
  };

  const handleSave = useCallback(async () => {
    if (!storyId || !currentChapterId) {
      Alert.alert('Error', 'No story or chapter selected');
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

      Alert.alert('Success', 'Story saved successfully');
    } catch (error) {
      console.error('Failed to save story:', error);
      Alert.alert('Error', 'Failed to save story. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [storyId, currentChapterId]);

  if (loading) {
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {story.title}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
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

      {/* Chapter Selector */}
      {story.chapters.length > 0 && (
        <View style={[styles.chapterSelector, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.chapterLabel, { color: colors.textSecondary }]}>Chapter:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {story.chapters.map((chapter) => (
              <TouchableOpacity
                key={chapter.id}
                onPress={() => setCurrentChapterId(chapter.id)}
                style={[
                  styles.chapterTab,
                  { backgroundColor: colors.bgCard, borderColor: colors.borderMedium },
                  currentChapterId === chapter.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.chapterTabText,
                    { color: colors.textSecondary },
                    currentChapterId === chapter.id && { color: colors.textPrimary, fontWeight: '600' },
                  ]}
                >
                  {chapter.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
      <View style={styles.editorContainer}>
        <LexicalEditor
          ref={editorRef}
          backgroundColor={colors.bgEditor}
          textColor={colors.textPrimary}
          associations={associations}
          autotab={settings.autotab}
          spellcheck={settings.spellcheck}
          onSave={(content) => {
            // Save triggered from editor
          }}
          onAssociationClick={(association) => {
            setSelectedAssociationId(association.association_id);
            setAssociationPanelVisible(true);
          }}
          onFormatChange={(formatState) => {
            setIsBold(formatState.isBold);
            setIsItalic(formatState.isItalic);
            setIsUnderline(formatState.isUnderline);
            setIsStrikethrough(formatState.isStrikethrough);
            setAlignment(formatState.alignment || 'left');
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
        <View style={styles.modalOverlay}>
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
  chapterSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  chapterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  chapterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  chapterTabText: {
    fontSize: 14,
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
  modalOverlay: {
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
});
