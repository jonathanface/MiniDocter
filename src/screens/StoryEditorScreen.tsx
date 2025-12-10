import React, { useState, useEffect, useCallback } from 'react';
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
import { RichText, useEditorBridge } from '@10play/tentap-editor';
import { apiGet, apiPut } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import { CustomToolbar } from '../components/CustomToolbar';
import { useAssociations } from '../hooks/useAssociations';
import { useDocumentSettings } from '../hooks/useDocumentSettings';
import { applyAssociationColors } from '../utils/applyAssociationColors';
import { AssociationPanel } from '../components/AssociationPanel';

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
  const [originalBlocks, setOriginalBlocks] = useState<any[]>([]);
  const [associationPanelVisible, setAssociationPanelVisible] = useState(false);
  const [selectedAssociationId, setSelectedAssociationId] = useState<string | null>(null);
  const [associationsListVisible, setAssociationsListVisible] = useState(false);

  // Fetch associations for coloring text
  const { associations } = useAssociations(storyId);

  // Fetch document settings (e.g., autotab)
  const { settings } = useDocumentSettings(storyId);

  // Track if we're currently applying colors to prevent infinite loops
  const [isApplyingColors, setIsApplyingColors] = useState(false);

  // Track if CSS has been injected
  const [cssInjected, setCssInjected] = useState(false);

  // Initialize editor with empty content
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: '',
  });

  // Inject theme-aware CSS after editor initialization
  useEffect(() => {
    if (!editor || !editor.injectCSS) return;

    editor.injectCSS(`
        * {
          white-space: pre-wrap !important;
          tab-size: 4 !important;
        }
        body {
          background-color: ${colors.bgEditor} !important;
          color: ${colors.textPrimary} !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 17px;
          margin: 0;
          white-space: pre-wrap !important;
          tab-size: 4 !important;
        }
        /* Add padding to the editor content container */
        .ProseMirror {
          padding: 20px !important;
          box-sizing: border-box !important;
        }
        p {
          color: ${colors.textPrimary} !important;
          font-size: 17px;
          line-height: 1.6;
          margin: 0.5em 0;
          white-space: pre-wrap !important;
          tab-size: 4 !important;
        }
        span, strong, em, u, s {
          white-space: pre-wrap !important;
        }
        strong, em, u, s {
          color: ${colors.textPrimary} !important;
        }
        /* Default text color for regular spans */
        span {
          color: ${colors.textPrimary};
        }
        /* Association spans use their inline color - higher specificity */
        span.association-mark[style*="color"] {
          /* Inline style color takes precedence (no !important to allow inline) */
        }
        blockquote {
          background-color: ${colors.bgEditorBlockquote};
          color: ${colors.textSecondary} !important;
          border-left: 4px solid ${colors.primary};
          padding: 0.5em 1em;
          margin: 1em 0;
        }
        ul, ol, li {
          color: ${colors.textPrimary} !important;
        }
        code {
          background-color: ${colors.bgSecondary};
          color: ${colors.primary} !important;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
        h1, h2, h3, h4, h5, h6 {
          color: ${colors.textPrimary} !important;
        }
      `);

    // Small delay to ensure CSS is applied before loading content
    setTimeout(() => {
      setCssInjected(true);
    }, 100);
  }, [editor, colors]);

  // Load story and chapters
  useEffect(() => {
    if (!storyId) {
      Alert.alert('Error', 'No story ID provided');
      navigation.goBack();
      return;
    }

    loadStory();
  }, [storyId]);

  // Load chapter content when chapter changes or CSS is ready
  useEffect(() => {
    if (currentChapterId && story && cssInjected) {
      setOriginalBlocks([]); // Clear original blocks when switching chapters
      loadChapterContent();
    }
  }, [currentChapterId, cssInjected]);

  // Auto-select first chapter
  useEffect(() => {
    if (story && story.chapters.length > 0 && !currentChapterId) {
      setCurrentChapterId(story.chapters[0].id);
    }
  }, [story]);

  // Real-time association highlighting as user types
  // DISABLED: Causes cursor jumping due to setContent() limitations with TenTap
  // TODO: Implement using WebView-based highlighting that doesn't require setContent
  useEffect(() => {
    if (true) return; // Disabled for now
    if (!editor || associations.length === 0) return;

    const editorAny = editor as any;
    let debounceTimer: NodeJS.Timeout | null = null;

    // Subscribe to content updates
    const unsubscribe = editorAny._subscribeToContentUpdate?.(() => {
      // Clear previous timer
      if (debounceTimer) clearTimeout(debounceTimer);

      // Debounce the color application to avoid disrupting typing
      debounceTimer = setTimeout(async () => {
        if (isApplyingColors) return;

        try {
          setIsApplyingColors(true);

          // Get current HTML content and selection
          const currentHtml = await editor.getHTML();
          const currentJson = await editor.getJSON();

          // Try to get cursor position (this might not work perfectly with TenTap)
          let cursorPosition: any = null;
          try {
            // Store the selection state if available
            if (editorAny.current?.state?.selection) {
              cursorPosition = editorAny.current.state.selection;
            }
          } catch (e) {
            // Selection API might not be available
          }

          // Strip ALL existing association spans to get clean text
          // Use multiple passes to ensure we get nested or malformed spans
          let cleanHtml = currentHtml;
          let previousHtml = '';
          let iterations = 0;

          // Log original HTML

          // Keep stripping until no more association spans found (max 5 iterations)
          while (cleanHtml !== previousHtml && iterations < 5) {
            previousHtml = cleanHtml;
            cleanHtml = cleanHtml.replace(
              /<span[^>]*data-association-id[^>]*>([^<]*)<\/span>/gi,
              '$1'
            );
            iterations++;
          }


          // Re-apply association colors
          const coloredHtml = applyAssociationColors(cleanHtml, associations);


          // Only update if there's a meaningful difference (associations added/removed)
          // Compare the text content to see if anything actually changed
          const currentText = currentHtml.replace(/<[^>]*>/g, '');
          const coloredText = coloredHtml.replace(/<[^>]*>/g, '');

          // Only update if:
          // 1. The text is the same (just styling changed), OR
          // 2. There's actually a difference in highlighting
          const hasAssociationInCurrent = /<span[^>]*data-association-id/.test(currentHtml);
          const hasAssociationInColored = /<span[^>]*data-association-id/.test(coloredHtml);

          if (currentText === coloredText && hasAssociationInCurrent !== hasAssociationInColored) {
            // Associations added or removed - update
            editor.setContent(coloredHtml);
          } else if (coloredHtml !== currentHtml && currentText === coloredText) {
            // Just styling changed, safe to update
            editor.setContent(coloredHtml);
          } else {
          }
        } catch (error) {
          console.error('[Association Colors] Error:', error);
        } finally {
          setIsApplyingColors(false);
        }
      }, 800); // 800ms debounce - wait for user to pause typing
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (unsubscribe) unsubscribe();
    };
  }, [editor, associations, isApplyingColors]);

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

    // Wait for CSS to be injected first
    if (!cssInjected) {
      return;
    }

    try {
      const response = await apiGet(`/stories/${storyId}/content?chapter=${currentChapterId}`);

      if (response.status === 404) {
        // No content yet, start with empty
        // Delay to allow editor to initialize
        setTimeout(() => {
          editor.setContent('');
        }, 500);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load content: ${response.status}`);
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
      }

      // Store original blocks for preserving key_ids on save
      if (data.items) {
        setOriginalBlocks(data.items);
      }

      // Convert from Lexical format to HTML
      if (data.items && data.items.length > 0) {
        // Lexical format bit flags
        const FORMAT_BOLD = 1;
        const FORMAT_ITALIC = 2;
        const FORMAT_STRIKETHROUGH = 4;
        const FORMAT_UNDERLINE = 8;

        // Convert Lexical blocks to HTML
        const htmlContent = data.items
          .map((item: any) => {
            try {
              const chunk = JSON.parse(item.chunk.Value);

              // Debug: check for tabs in content
              if (chunk.children?.some((child: any) => child.text?.includes('\t'))) {
              }

              // Convert text nodes with formatting
              const textContent = chunk.children?.map((textNode: any) => {
                let text = textNode.text || '';
                const format = textNode.format || 0;

                // Preserve special characters like tabs
                // Don't HTML-escape them, keep them as-is for pre-wrap to handle

                // Apply formatting by wrapping in HTML tags
                if (format & FORMAT_BOLD) {
                  text = `<strong>${text}</strong>`;
                }
                if (format & FORMAT_ITALIC) {
                  text = `<em>${text}</em>`;
                }
                if (format & FORMAT_UNDERLINE) {
                  text = `<u>${text}</u>`;
                }
                if (format & FORMAT_STRIKETHROUGH) {
                  text = `<s>${text}</s>`;
                }

                return text;
              }).join('') || '';

              // Note: Alignment is preserved in data but not rendered on mobile
              return `<p>${textContent}</p>`;
            } catch (e) {
              return '<p></p>';
            }
          })
          .join('');

        // Apply association colors to the HTML
        const coloredHtmlContent = applyAssociationColors(htmlContent, associations);

        // Debug: check if tabs survived
        const tabCount = (coloredHtmlContent.match(/\t/g) || []).length;
        if (tabCount > 0) {
        }

        // Convert tabs to non-breaking spaces (4 spaces per tab)
        // TenTap strips actual tab characters, so we need to use entities
        const contentWithVisibleTabs = coloredHtmlContent.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');


        // Delay to allow editor to initialize, with retry
        const trySetContent = (retries = 3) => {
          try {
            editor.setContent(contentWithVisibleTabs);
          } catch (err) {
            if (retries > 0) {
              setTimeout(() => trySetContent(retries - 1), 500);
            } else {
              console.error('Failed to load content after retries:', err);
            }
          }
        };

        setTimeout(() => trySetContent(), 500);
      } else {
        setTimeout(() => {
          editor.setContent('');
        }, 500);
      }
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

      // Get editor content as HTML
      const html = await editor.getHTML();

      // Debug: check for tabs in the HTML
      const tabsInHtml = (html.match(/\t/g) || []).length;
      const nbspInHtml = (html.match(/&nbsp;/g) || []).length;

      // Extract text from paragraphs using regex
      const paragraphMatches = html.match(/<p[^>]*>(.*?)<\/p>/gi) || [];
      if (paragraphMatches.length > 10) {
      }

      // Lexical format flags
      const TEXT_FORMAT_BOLD = 1;
      const TEXT_FORMAT_ITALIC = 2;
      const TEXT_FORMAT_STRIKETHROUGH = 4;
      const TEXT_FORMAT_UNDERLINE = 8;

      // Convert to Lexical format
      const blocks = paragraphMatches.map((pTag, index) => {
        // Extract content between <p> tags
        const content = pTag.match(/<p[^>]*>(.*?)<\/p>/i)?.[1] || '';

        // Parse formatted content into text nodes
        const children: any[] = [];

        // Simple parsing - split by tags and track formatting
        let currentText = '';
        let currentFormat = 0;
        let tempContent = content;

        // Helper to add current text node
        const flushText = () => {
          if (currentText) {
            children.push({
              text: currentText,
              type: 'text',
              format: currentFormat || undefined,
            });
            currentText = '';
          }
        };

        // Basic HTML entity decoding
        // Convert sequences of 4 nbsp back to tabs (we use 4 nbsp per tab)
        // Handle both &nbsp; entities and Unicode U+00A0 characters
        const nbsp = '\u00A0'; // Non-breaking space character

        // Debug: check what we have before conversion
        const unicodeNbspCount = (tempContent.match(new RegExp(nbsp, 'g')) || []).length;
        const entityNbspCount = (tempContent.match(/&nbsp;/g) || []).length;
        if (unicodeNbspCount > 0 || entityNbspCount > 0) {
        }

        tempContent = tempContent
          // First convert Unicode nbsp sequences to tabs
          .replace(new RegExp(`${nbsp}{4}`, 'g'), '\t')
          // Then convert HTML entity nbsp sequences to tabs
          .replace(/(&nbsp;){4}/g, '\t')
          // Convert remaining nbsp (both forms) to regular spaces
          .replace(new RegExp(nbsp, 'g'), ' ')
          .replace(/&nbsp;/g, ' ')
          // Other entity conversions
          .replace(/&#9;/g, '\t')  // Preserve tab entities
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');

        // Debug: check how many tabs we have after conversion
        const tabsAfterConversion = (tempContent.match(/\t/g) || []).length;
        if (tabsAfterConversion > 0) {
        }

        // Parse HTML to preserve formatting (bold, italic, underline, strikethrough)
        // This is a simple parser that handles basic formatting
        const parseFormattedHTML = (html: string): any[] => {
          const nodes: any[] = [];
          let currentFormat = 0;
          let currentText = '';

          const flushNode = () => {
            if (currentText) {
              // Don't trim individual nodes - preserve all spaces
              // Only the first/last nodes should be trimmed
              nodes.push({
                type: 'text',
                version: 1,
                text: currentText,
                format: currentFormat || 0,
                mode: 'normal',
              });
              currentText = '';
            }
          };

          // Simple state machine to track formatting
          let i = 0;
          while (i < html.length) {
            if (html[i] === '<') {
              // Found a tag
              const tagEnd = html.indexOf('>', i);
              if (tagEnd === -1) break;

              const tag = html.substring(i, tagEnd + 1);
              const tagName = tag.match(/<\/?(\w+)/)?.[1]?.toLowerCase();
              const isClosing = tag.startsWith('</');

              // Handle formatting tags
              if (tagName === 'strong' || tagName === 'b') {
                if (!isClosing) {
                  flushNode();
                  currentFormat |= TEXT_FORMAT_BOLD;
                } else {
                  flushNode();
                  currentFormat &= ~TEXT_FORMAT_BOLD;
                }
              } else if (tagName === 'em' || tagName === 'i') {
                if (!isClosing) {
                  flushNode();
                  currentFormat |= TEXT_FORMAT_ITALIC;
                } else {
                  flushNode();
                  currentFormat &= ~TEXT_FORMAT_ITALIC;
                }
              } else if (tagName === 'u') {
                if (!isClosing) {
                  flushNode();
                  currentFormat |= TEXT_FORMAT_UNDERLINE;
                } else {
                  flushNode();
                  currentFormat &= ~TEXT_FORMAT_UNDERLINE;
                }
              } else if (tagName === 's' || tagName === 'strike' || tagName === 'del') {
                if (!isClosing) {
                  flushNode();
                  currentFormat |= TEXT_FORMAT_STRIKETHROUGH;
                } else {
                  flushNode();
                  currentFormat &= ~TEXT_FORMAT_STRIKETHROUGH;
                }
              }

              i = tagEnd + 1;
            } else {
              // Regular text character
              currentText += html[i];
              i++;
            }
          }

          flushNode();

          // Trim only the first and last nodes to remove paragraph-level whitespace
          if (nodes.length > 0) {
            // Trim leading whitespace from first node (but preserve tabs)
            nodes[0].text = nodes[0].text.replace(/^[ \r\n]+/, '');
            // Trim trailing whitespace from last node (but preserve tabs)
            nodes[nodes.length - 1].text = nodes[nodes.length - 1].text.replace(/[ \r\n]+$/, '');
            // Remove empty nodes
            return nodes.filter(node => node.text.length > 0);
          }

          return nodes;
        };

        const parsedNodes = parseFormattedHTML(tempContent);

        // Try to preserve original key_id and alignment, or generate new ones
        let key_id: string;
        let alignment = '';
        if (originalBlocks[index]) {
          try {
            const originalChunk = JSON.parse(originalBlocks[index].chunk.Value);
            key_id = originalChunk.key_id;
            alignment = originalChunk.format || '';
          } catch (e) {
            // If parsing fails, generate new key_id
            key_id = `para-${Date.now()}-${index}`;
          }
        } else {
          // New paragraph, generate new key_id
          key_id = `para-${Date.now()}-${index}`;
        }

        // Create Lexical paragraph structure matching web app format
        const lexicalParagraph = {
          children: parsedNodes,
          direction: 'ltr',
          format: alignment,
          indent: 0,
          type: 'custom-paragraph',
          version: 1,
          textFormat: 0,
          textStyle: '',
          key_id: key_id,
        };

        return {
          key_id: lexicalParagraph.key_id,
          chunk: lexicalParagraph, // Send as object, backend will handle marshalling
          place: index.toString(),
        };
      });

      // If no paragraphs, create one empty paragraph
      if (blocks.length === 0) {
        const emptyPara = {
          children: [],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'custom-paragraph',
          version: 1,
          textFormat: 0,
          textStyle: '',
          key_id: `para-${Date.now()}-0`,
        };
        blocks.push({
          key_id: emptyPara.key_id,
          chunk: emptyPara, // Send as object, backend will handle marshalling
          place: '0',
        });
      }

      const payload = {
        story_id: storyId,
        chapter_id: currentChapterId,
        blocks: blocks,
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
  }, [storyId, currentChapterId, editor]);

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

      {/* Toolbar - at top so keyboard doesn't cover it */}
      <View style={[styles.toolbarContainer, { backgroundColor: colors.bgToolbar, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
        <CustomToolbar editor={editor} />
      </View>

      {/* Editor */}
      <View style={styles.editorContainer}>
        <RichText
          editor={editor}
          style={[styles.editor, { backgroundColor: colors.bgEditor }]}
          injectedJavaScript={`
            (function() {
              var autotabEnabled = ${settings.autotab};

              // Helper function to insert tab (4 non-breaking spaces)
              function insertTab() {
                // Insert 4 non-breaking spaces to represent a tab
                // TenTap strips actual \\t characters, so we use nbsp entities
                var tabString = '\\u00A0\\u00A0\\u00A0\\u00A0'; // 4 non-breaking spaces
                document.execCommand('insertText', false, tabString);
              }

              // Intercept Tab key to insert tab
              document.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  insertTab();
                }

                // Intercept Enter key to auto-indent new paragraphs (if enabled)
                if (autotabEnabled && e.key === 'Enter' && !e.shiftKey) {
                  // Let the default behavior create the new paragraph first
                  setTimeout(function() {
                    insertTab();
                  }, 10);
                }
              }, true);

            })();
            true;
          `}
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
