import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextStyle,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { apiGet, apiPut } from '../utils/api';
import { SimplifiedAssociation } from '../types/associations';
import { AssociationPanel } from '../components/AssociationPanel';
import { useTheme } from '../contexts/ThemeContext';

// Lexical text format bit flags
const TEXT_FORMAT_BOLD = 1;
const TEXT_FORMAT_ITALIC = 2;
const TEXT_FORMAT_STRIKETHROUGH = 4;
const TEXT_FORMAT_UNDERLINE = 8;

// Types for lexical paragraph structure
interface LexicalTextNode {
  text: string;
  type: 'text';
  format?: number;
  style?: string;
  [key: string]: any;
}

interface LexicalParagraph {
  type: string;
  key_id: string;
  children: LexicalTextNode[];
  direction?: string;
  format?: string;
  indent?: number;
  version?: number;
  [key: string]: any;
}

interface DynamoDBItem {
  key_id: { Value: string };
  chunk: { Value: string };
  place: { Value: string };
  composite_key?: { Value: string };
}

interface BlocksResponse {
  items: DynamoDBItem[];
  last_evaluated_key?: any;
  scanned_count?: number;
}

interface Story {
  story_id: string;
  title: string;
  description: string;
  chapters: Array<{
    id: string;
    title: string;
    place: number;
  }>;
}

export const StoryEditorScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as { storyId: string } | undefined;
  const storyId = params?.storyId;
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<LexicalParagraph[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [textSelection, setTextSelection] = useState<{ start: number; end: number } | null>(null);
  const [associations, setAssociations] = useState<SimplifiedAssociation[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState<string | null>(null);
  const [showAssociationPanel, setShowAssociationPanel] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const textInputRefs = useRef<Map<number, TextInput>>(new Map());

  useEffect(() => {
    if (storyId) {
      loadStory();
    } else {
      Alert.alert('Error', 'No story ID provided');
      navigation.goBack();
    }
  }, [storyId]);

  useEffect(() => {
    if (story && story.chapters.length > 0 && !currentChapterId) {
      // Load first chapter by default
      setCurrentChapterId(story.chapters[0].id);
    }
  }, [story]);

  useEffect(() => {
    if (currentChapterId) {
      loadChapterContent();
    }
  }, [currentChapterId]);

  // Handle back navigation - intercept when there are unsaved changes
  useEffect(() => {
    const handleBeforeRemove = (e: any) => {
      if (!hasUnsavedChanges) {
        // No unsaved changes, allow navigation
        return;
      }

      // Prevent default navigation
      e.preventDefault();

      // Show alert
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save before leaving?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              if (e.data?.action) {
                navigation.dispatch(e.data.action);
              } else {
                navigation.goBack();
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Save',
            onPress: async () => {
              await handleSave();
              if (e.data?.action) {
                navigation.dispatch(e.data.action);
              } else {
                navigation.goBack();
              }
            },
          },
        ]
      );
    };

    // Add listener for navigation attempts
    const unsubscribe = navigation.addListener('beforeRemove', handleBeforeRemove);

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, handleSave]);

  // Handle hardware back button on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasUnsavedChanges) {
        Alert.alert(
          'Unsaved Changes',
          'You have unsaved changes. Do you want to save before leaving?',
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => navigation.goBack(),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Save',
              onPress: async () => {
                await handleSave();
                navigation.goBack();
              },
            },
          ]
        );
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    });

    return () => backHandler.remove();
  }, [hasUnsavedChanges, navigation, handleSave]);

  const loadStory = async () => {
    if (!storyId) return;

    try {
      console.log('Loading story:', storyId);
      const response = await apiGet(`/stories/${storyId}`);

      if (!response.ok) {
        throw new Error(`Failed to load story: ${response.status}`);
      }

      const storyData: Story = await response.json();
      console.log('Story loaded:', storyData.title, 'with', storyData.chapters.length, 'chapters');
      setStory(storyData);

      // Load associations for this story
      loadAssociations();
    } catch (error) {
      console.error('Failed to load story:', error);
      Alert.alert('Error', 'Failed to load story');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadAssociations = async () => {
    if (!storyId) return;

    try {
      console.log('Loading associations for story:', storyId);
      const response = await apiGet(`/stories/${storyId}/associations/thumbs`);

      if (response.status === 404) {
        // No associations yet, that's okay
        console.log('No associations found (404)');
        setAssociations([]);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load associations: ${response.status}`);
      }

      const associationsData: SimplifiedAssociation[] = await response.json();
      // Filter out empty association names
      const filteredAssociations = associationsData.filter(
        (assoc) => assoc.association_name && assoc.association_name.trim() !== ''
      );
      console.log('Loaded', filteredAssociations.length, 'associations');
      setAssociations(filteredAssociations);
    } catch (error) {
      console.error('Failed to load associations:', error);
      // Don't show alert, associations are optional
      setAssociations([]);
    }
  };

  const loadChapterContent = async () => {
    if (!storyId || !currentChapterId) return;

    try {
      console.log('Loading chapter content for chapterID:', currentChapterId);
      console.log('Full URL:', `/stories/${storyId}/content?chapter=${currentChapterId}`);

      // Correct endpoint is /content not /blocks
      const response = await apiGet(`/stories/${storyId}/content?chapter=${currentChapterId}`);

      console.log('Chapter content response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No content yet, start with blank paragraph
          console.log('No content found (404), starting with blank paragraph');
          setParagraphs([createBlankParagraph()]);
          return;
        }

        // Log error response body
        const errorText = await response.text();
        console.error('Error response body:', errorText.substring(0, 200));
        throw new Error(`Failed to load chapter content: ${response.status}`);
      }

      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response received:', {
          contentType,
          bodyPreview: responseText.substring(0, 200),
        });
        throw new Error('Server returned non-JSON response');
      }

      const blocksData: BlocksResponse = await response.json();
      console.log('API Response:', {
        itemCount: blocksData.items?.length || 0,
        hasLastEvaluatedKey: !!blocksData.last_evaluated_key,
        scannedCount: blocksData.scanned_count,
      });

      if (!blocksData.items || blocksData.items.length === 0) {
        // No content, start with blank paragraph
        console.log('No blocks in response, starting with blank paragraph');
        setParagraphs([createBlankParagraph()]);
        return;
      }

      // Log first few items to verify structure
      console.log('Sample items:', blocksData.items.slice(0, 2).map(item => ({
        key_id: item.key_id?.Value,
        place: item.place?.Value,
        hasChunk: !!item.chunk?.Value,
      })));

      // Parse DynamoDB items into lexical paragraphs
      const parsedParagraphs = blocksData.items.map((item, index) => {
        const keyId = item.key_id?.Value || uuidv4();
        const chunkValue = item.chunk?.Value;
        const place = item.place?.Value;

        console.log(`Processing item ${index}: place=${place}, keyId=${keyId}, hasChunk=${!!chunkValue}`);

        if (chunkValue) {
          try {
            // Parse once
            let parsed = JSON.parse(chunkValue);

            // Check if it's double-encoded (parsed result is still a string)
            if (typeof parsed === 'string') {
              console.log(`Double-encoded JSON detected at index ${index}, parsing again`);
              parsed = JSON.parse(parsed);
            }

            // Now we should have the object
            const paragraph = parsed as LexicalParagraph;
            paragraph.key_id = keyId; // Ensure key_id is set
            return paragraph;
          } catch (error) {
            console.error(`Failed to parse chunk at index ${index}:`, error);
            return createBlankParagraph(keyId);
          }
        }

        return createBlankParagraph(keyId);
      });

      console.log('Successfully parsed', parsedParagraphs.length, 'paragraphs');
      console.log('Setting paragraphs state with', parsedParagraphs.length, 'items');
      setParagraphs(parsedParagraphs);
      setHasUnsavedChanges(false); // Reset flag after loading content
    } catch (error) {
      console.error('Failed to load chapter content:', error);
      Alert.alert(
        'Error',
        'Failed to load chapter content. Starting with blank document.'
      );
      // Start with blank paragraph on error
      setParagraphs([createBlankParagraph()]);
    }
  };

  const createBlankParagraph = (keyId?: string): LexicalParagraph => ({
    type: 'custom-paragraph',
    key_id: keyId || uuidv4(),
    children: [],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  });

  // Extract text content from a lexical paragraph
  const extractTextFromParagraph = (paragraph: LexicalParagraph): string => {
    if (!paragraph.children || paragraph.children.length === 0) {
      return '';
    }
    return paragraph.children.map((child) => child.text || '').join('');
  };

  // Extract text alignment from paragraph format
  const getTextAlignment = (format?: string): 'left' | 'center' | 'right' | 'justify' => {
    if (!format) return 'left';

    // In Lexical, format can be 'left', 'center', 'right', 'justify', or ''
    if (format === 'center') return 'center';
    if (format === 'right') return 'right';
    if (format === 'justify') return 'justify';

    return 'left';
  };

  // Expand tabs to 5 spaces for mobile display (preserves tabs in actual data)
  const expandTabsForDisplay = (text: string): string => {
    return text.replace(/\t/g, '     '); // 5 spaces
  };

  // Render paragraph children with formatting
  const renderFormattedChildren = (paragraph: LexicalParagraph) => {
    if (!paragraph.children || paragraph.children.length === 0) {
      return null;
    }

    return paragraph.children.map((child, childIndex) => {
      const childText = child.text || '';
      const childFormat = child.format || 0;
      const childStyle = getTextStyle(childFormat);

      // Find association matches within this child's text
      const segments = findAssociationMatches(childText);

      return segments.map((segment, segmentIndex) => (
        <Text
          key={`${childIndex}-${segmentIndex}`}
          style={[
            childStyle, // Apply formatting from text node
            segment.association
              ? {
                  color: getAssociationColor(segment.association.association_type),
                  fontWeight: '600',
                }
              : undefined,
          ]}
          onPress={
            segment.association
              ? () => {
                  setSelectedAssociationId(segment.association!.association_id);
                  setShowAssociationPanel(true);
                }
              : undefined
          }
        >
          {segment.text}
        </Text>
      ));
    });
  };

  // Get text format flags from paragraph's first child
  const getTextFormat = (paragraph: LexicalParagraph): number => {
    if (!paragraph.children || paragraph.children.length === 0) {
      return 0;
    }
    return paragraph.children[0].format || 0;
  };

  // Get text format at the current selection/cursor position
  const getFormatAtSelection = (paragraph: LexicalParagraph, selection: { start: number; end: number } | null): number => {
    if (!paragraph.children || paragraph.children.length === 0) {
      return 0;
    }

    // If only one child, return its format
    if (paragraph.children.length === 1) {
      return paragraph.children[0].format || 0;
    }

    // If no selection info, check if all children have the same format
    if (!selection) {
      const firstFormat = paragraph.children[0].format || 0;
      const allSameFormat = paragraph.children.every(child => (child.format || 0) === firstFormat);
      return allSameFormat ? firstFormat : 0;
    }

    // Check if this is a selection range (not just cursor position)
    const hasRange = selection.start !== selection.end;

    // Collect formats of all characters in the selection range
    let currentPosition = 0;
    const formatsInSelection: number[] = [];

    for (const child of paragraph.children) {
      const childLength = child.text?.length || 0;
      const childEnd = currentPosition + childLength;
      const childFormat = child.format || 0;

      // Check if this child overlaps with the selection
      if (hasRange) {
        // Selection range: check if any part of this child is selected
        if (childEnd > selection.start && currentPosition < selection.end) {
          formatsInSelection.push(childFormat);
        }
      } else {
        // Just a cursor position: find which child contains it
        if (selection.start >= currentPosition && selection.start <= childEnd) {
          // At boundary, prefer the next child unless it's the very end
          if (selection.start === childEnd && childEnd < paragraph.children.reduce((sum, c) => sum + (c.text?.length || 0), 0)) {
            // Continue to next child
          } else {
            return childFormat;
          }
        }
      }

      currentPosition = childEnd;
    }

    // For range selections, only return a format if ALL selected text has the same format
    if (hasRange && formatsInSelection.length > 0) {
      const firstFormat = formatsInSelection[0];
      const allSame = formatsInSelection.every(f => f === firstFormat);
      return allSame ? firstFormat : 0;
    }

    // Fallback to first child's format
    return paragraph.children[0].format || 0;
  };

  // Check if a format flag is set
  const hasFormat = (formatFlags: number, flag: number): boolean => {
    return (formatFlags & flag) !== 0;
  };

  // Toggle a format flag
  const toggleFormat = (currentFormat: number, flag: number): number => {
    return currentFormat ^ flag;
  };

  // Get text style based on format flags
  const getTextStyle = (formatFlags: number): TextStyle => {
    const style: TextStyle = {};

    if (hasFormat(formatFlags, TEXT_FORMAT_BOLD)) {
      style.fontWeight = 'bold';
    }

    if (hasFormat(formatFlags, TEXT_FORMAT_ITALIC)) {
      style.fontStyle = 'italic';
    }

    if (hasFormat(formatFlags, TEXT_FORMAT_UNDERLINE)) {
      style.textDecorationLine = style.textDecorationLine
        ? `${style.textDecorationLine} underline`
        : 'underline';
    }

    if (hasFormat(formatFlags, TEXT_FORMAT_STRIKETHROUGH)) {
      style.textDecorationLine = style.textDecorationLine
        ? `${style.textDecorationLine} line-through`
        : 'line-through';
    }

    return style;
  };

  // Get color for association type
  const getAssociationColor = (type: string): string => {
    switch (type) {
      case 'character':
        return '#4ade80'; // Green
      case 'place':
        return '#60a5fa'; // Blue
      case 'event':
        return '#f87171'; // Red
      case 'item':
        return '#fbbf24'; // Yellow
      default:
        return '#9ca3af'; // Gray fallback
    }
  };

  // Find association matches in text
  interface TextSegment {
    text: string;
    association?: SimplifiedAssociation;
  }

  const findAssociationMatches = (text: string): TextSegment[] => {
    if (!text || associations.length === 0) {
      return [{ text }];
    }

    const segments: TextSegment[] = [];
    let remainingText = text;
    let currentIndex = 0;

    // Build list of all possible matches (names + aliases)
    const matchCandidates: Array<{
      text: string;
      association: SimplifiedAssociation;
      caseSensitive: boolean;
    }> = [];

    associations.forEach((assoc) => {
      // Add the main name
      matchCandidates.push({
        text: assoc.association_name,
        association: assoc,
        caseSensitive: assoc.case_sensitive,
      });

      // Add aliases
      if (assoc.aliases) {
        const aliasesArray = assoc.aliases.split(',').map((a) => a.trim()).filter((a) => a);
        aliasesArray.forEach((alias) => {
          matchCandidates.push({
            text: alias,
            association: assoc,
            caseSensitive: assoc.case_sensitive,
          });
        });
      }
    });

    // Sort by length (longest first) to avoid nested matches
    matchCandidates.sort((a, b) => b.text.length - a.text.length);

    while (remainingText.length > 0) {
      let foundMatch = false;
      let bestMatch: { index: number; length: number; association: SimplifiedAssociation } | null = null;

      // Find the earliest match
      for (const candidate of matchCandidates) {
        const searchText = candidate.caseSensitive ? remainingText : remainingText.toLowerCase();
        const matchText = candidate.caseSensitive ? candidate.text : candidate.text.toLowerCase();

        // Use word boundary regex for more accurate matching
        const escapedMatch = matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedMatch}\\b`, candidate.caseSensitive ? '' : 'i');
        const match = searchText.match(regex);

        if (match && match.index !== undefined) {
          if (!bestMatch || match.index < bestMatch.index) {
            bestMatch = {
              index: match.index,
              length: match[0].length,
              association: candidate.association,
            };
          }
        }
      }

      if (bestMatch) {
        // Add text before the match
        if (bestMatch.index > 0) {
          segments.push({ text: remainingText.substring(0, bestMatch.index) });
        }

        // Add the matched text with association
        segments.push({
          text: remainingText.substring(bestMatch.index, bestMatch.index + bestMatch.length),
          association: bestMatch.association,
        });

        // Continue with remaining text
        remainingText = remainingText.substring(bestMatch.index + bestMatch.length);
        foundMatch = true;
      }

      if (!foundMatch) {
        // No more matches, add remaining text
        segments.push({ text: remainingText });
        break;
      }
    }

    return segments;
  };

  // Update paragraph text content
  const updateParagraphText = (index: number, newText: string) => {
    // Check if newText contains a newline character (Enter key was pressed)
    const newlineIndex = newText.indexOf('\n');

    if (newlineIndex !== -1) {
      // Split at newline instead of allowing it in the paragraph
      const textBeforeCursor = newText.substring(0, newlineIndex);
      const textAfterCursor = newText.substring(newlineIndex + 1);

      // Call handleEnterKey with the split position
      handleEnterKey(index, textBeforeCursor + textAfterCursor, textBeforeCursor.length);
      return;
    }

    setParagraphs((prev) => {
      const updated = [...prev];
      const paragraph = updated[index];

      if (newText === '') {
        // Empty text - clear children
        paragraph.children = [];
      } else {
        // Preserve formatting when editing by keeping the same children structure
        // Only update the text content, maintaining existing formats
        if (paragraph.children.length > 0) {
          // If multiple formatted children exist, preserve them
          // This maintains the bold/italic/etc state during editing
          const totalLength = paragraph.children.reduce((sum, child) => sum + (child.text?.length || 0), 0);

          // If text length changed significantly or is very different, reset to single child
          // This handles paste operations and major edits
          if (Math.abs(newText.length - totalLength) > 10) {
            const currentFormat = paragraph.children[0].format || 0;
            paragraph.children = [{
              text: newText,
              type: 'text',
              format: currentFormat,
            }];
          } else {
            // For small edits, update the last child (where cursor usually is)
            const lastChild = paragraph.children[paragraph.children.length - 1];
            const currentFormat = lastChild.format || 0;
            // Simply create a single child with the new text and last format
            // This is simpler and more predictable than trying to preserve structure
            paragraph.children = [{
              text: newText,
              type: 'text',
              format: currentFormat,
            }];
          }
        } else {
          // No existing children, create new one
          paragraph.children = [{
            text: newText,
            type: 'text',
            format: 0,
          }];
        }
      }

      return updated;
    });

    setHasUnsavedChanges(true);
  };

  // Apply text formatting to current paragraph
  const applyTextFormat = (index: number | null, flag: number) => {
    if (index === null) return; // No paragraph focused

    const hadSelection = textSelection && textSelection.start !== textSelection.end;

    setParagraphs((prev) => {
      const updated = [...prev];
      const paragraph = updated[index];

      // If there's a text selection, format only the selected text
      if (hadSelection) {
        const fullText = extractTextFromParagraph(paragraph);
        const { start, end } = textSelection!;

        const beforeText = fullText.substring(0, start);
        const selectedText = fullText.substring(start, end);
        const afterText = fullText.substring(end);

        const currentFormat = getTextFormat(paragraph);
        const newFormat = toggleFormat(currentFormat, flag);

        // Create new children array with split text nodes
        const newChildren: Array<{ text: string; type: string; format?: number }> = [];

        if (beforeText) {
          newChildren.push({ text: beforeText, type: 'text', format: currentFormat });
        }
        if (selectedText) {
          newChildren.push({ text: selectedText, type: 'text', format: newFormat });
        }
        if (afterText) {
          newChildren.push({ text: afterText, type: 'text', format: currentFormat });
        }

        paragraph.children = newChildren.length > 0 ? newChildren : [
          { text: '', type: 'text', format: newFormat }
        ];
      } else {
        // No selection - format entire paragraph
        const currentFormat = getTextFormat(paragraph);
        const newFormat = toggleFormat(currentFormat, flag);

        // Apply format to all children
        paragraph.children = paragraph.children.map((child) => ({
          ...child,
          format: newFormat,
        }));

        // If no children, create empty text node with format
        if (paragraph.children.length === 0) {
          paragraph.children = [
            {
              text: '',
              type: 'text',
              format: newFormat,
            },
          ];
        }
      }

      return updated;
    });

    // If we had a selection, deselect to show the formatted result
    if (hadSelection) {
      setFocusedIndex(null);
      setTextSelection(null);
    }

    setHasUnsavedChanges(true);
  };

  // Apply alignment to current paragraph
  const applyAlignment = (index: number | null, alignment: string) => {
    if (index === null) return; // No paragraph focused

    setParagraphs((prev) => {
      const updated = [...prev];
      updated[index].format = alignment;
      return updated;
    });

    setHasUnsavedChanges(true);
  };

  // Handle Enter key - create new paragraph
  const handleEnterKey = (index: number, text: string, cursorPosition: number) => {
    const textBeforeCursor = text.substring(0, cursorPosition);
    const textAfterCursor = text.substring(cursorPosition);

    setParagraphs((prev) => {
      const updated = [...prev];
      const currentParagraph = updated[index];

      // Get current text format to preserve it
      const currentTextFormat = getTextFormat(currentParagraph);

      // Update current paragraph with text before cursor
      updated[index].children = textBeforeCursor
        ? [{ text: textBeforeCursor, type: 'text', format: currentTextFormat }]
        : [];

      // Create new paragraph with text after cursor
      // Preserve text formatting but reset alignment
      const newParagraph = createBlankParagraph();
      newParagraph.children = [{
        text: '\t' + textAfterCursor,
        type: 'text',
        format: currentTextFormat
      }];

      // Insert new paragraph after current
      updated.splice(index + 1, 0, newParagraph);

      return updated;
    });

    // Focus next paragraph after render
    setFocusedIndex(index + 1);

    // Set cursor position at the start (after the tab character) after re-render
    setTimeout(() => {
      const nextInput = textInputRefs.current.get(index + 1);
      if (nextInput) {
        // Position cursor at index 1 (after the tab character)
        nextInput.setSelection(1, 1);
      }
    }, 100);

    setHasUnsavedChanges(true);
  };

  // Handle Backspace at start of paragraph or on empty paragraph
  const handleBackspace = (index: number, text: string, cursorPosition: number) => {
    // Only handle if at start of paragraph or paragraph is empty
    if ((cursorPosition === 0 || text === '') && paragraphs.length > 1 && index > 0) {
      const prevIndex = index - 1;
      let cursorPositionAfterMerge = 0;

      setParagraphs((prev) => {
        const updated = [...prev];

        if (text !== '' && cursorPosition === 0) {
          // Merge current paragraph text with previous paragraph
          const prevParagraph = updated[prevIndex];
          const currentParagraph = updated[index];
          const prevText = extractTextFromParagraph(prevParagraph);

          // Save the position where the merge happens (end of previous text)
          cursorPositionAfterMerge = prevText.length;

          // Get format from previous paragraph
          const prevFormat = prevParagraph.children.length > 0
            ? prevParagraph.children[0].format || 0
            : 0;

          // Append current text to previous paragraph
          prevParagraph.children = [
            {
              text: prevText + text,
              type: 'text',
              format: prevFormat,
            },
          ];
        }

        // Delete current paragraph
        updated.splice(index, 1);
        return updated;
      });

      // Focus previous paragraph after render and set cursor position
      setFocusedIndex(prevIndex);

      // Set cursor position after the component has re-rendered
      setTimeout(() => {
        const prevInput = textInputRefs.current.get(prevIndex);
        if (prevInput && cursorPositionAfterMerge > 0) {
          prevInput.setSelection(cursorPositionAfterMerge, cursorPositionAfterMerge);
        }
      }, 100);

      setHasUnsavedChanges(true);
    }
  };

  const handleSave = async () => {
    if (!storyId || !currentChapterId) {
      Alert.alert('Error', 'No story or chapter selected');
      return;
    }

    try {
      console.log('Saving story...');

      // Convert paragraphs to API format
      // Each paragraph maintains its full lexical structure:
      // - type: "custom-paragraph"
      // - key_id: unique identifier
      // - children: array of text nodes
      // - direction, format, indent, version: lexical properties
      const blocksToSave = paragraphs.map((paragraph, index) => {
        // Ensure the paragraph has all required lexical properties
        const lexicalParagraph: LexicalParagraph = {
          type: paragraph.type || 'custom-paragraph',
          key_id: paragraph.key_id,
          children: paragraph.children || [],
          direction: paragraph.direction || 'ltr',
          format: paragraph.format || '',
          indent: paragraph.indent || 0,
          version: paragraph.version || 1,
        };

        return {
          key_id: paragraph.key_id,
          chunk: lexicalParagraph, // Send as object, apiPut will stringify
          place: index.toString(),
        };
      });

      const payload = {
        story_id: storyId,
        chapter_id: currentChapterId,
        blocks: blocksToSave,
      };

      console.log('Saving', blocksToSave.length, 'blocks to chapter', currentChapterId);
      // Log first block as sample to verify format
      if (blocksToSave.length > 0) {
        console.log('Sample block chunk:', blocksToSave[0].chunk);
      }

      const response = await apiPut(`/stories/${storyId}`, payload);

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      console.log('Save successful');
      setHasUnsavedChanges(false);
      Alert.alert('Success', 'Story saved successfully');
    } catch (error) {
      console.error('Failed to save story:', error);
      Alert.alert('Error', 'Failed to save story. Please try again.');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgEditor,
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
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.bgPrimary,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    backButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    backButtonText: {
      fontSize: 16,
      color: colors.primary,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
    },
    saveButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    chapterSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.bgSecondary,
    },
    chapterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginRight: 8,
    },
    chapterTab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
      borderRadius: 6,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    chapterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chapterTabText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    chapterTabTextActive: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    scrollContent: {
      paddingBottom: 400,
    },
    paragraphInput: {
      fontSize: 18,
      color: colors.textPrimary,
      lineHeight: 28,
      minHeight: 40,
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 4,
      borderRadius: 4,
    },
    formattingToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgToolbar,
      borderRadius: 8,
      padding: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    formatButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 6,
      marginRight: 6,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    formatButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    formatButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    formatButtonTextActive: {
      color: colors.textPrimary,
    },
    toolbarSeparator: {
      width: 1,
      height: 24,
      backgroundColor: colors.borderMedium,
      marginHorizontal: 8,
    },
    infoBox: {
      backgroundColor: colors.bgCardHover,
      padding: 12,
      borderRadius: 8,
      marginTop: 24,
      marginBottom: 32,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    errorText: {
      fontSize: 16,
      color: colors.textTertiary,
      marginBottom: 16,
    },
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Story not found</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {story.title}
        </Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {story.chapters.length > 0 && (
        <View style={styles.chapterSelector}>
          <Text style={styles.chapterLabel}>Chapter:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {story.chapters.map((chapter) => (
              <TouchableOpacity
                key={chapter.id}
                onPress={() => setCurrentChapterId(chapter.id)}
                style={[
                  styles.chapterTab,
                  currentChapterId === chapter.id && styles.chapterTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.chapterTabText,
                    currentChapterId === chapter.id && styles.chapterTabTextActive,
                  ]}
                >
                  {chapter.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Formatting Toolbar - always visible */}
      <View style={styles.formattingToolbar}>
        {(() => {
          // Get format from focused paragraph, or use defaults
          const paragraph = focusedIndex !== null && paragraphs[focusedIndex]
            ? paragraphs[focusedIndex]
            : null;
          const textAlign = paragraph ? getTextAlignment(paragraph.format) : 'left';
          // Use getFormatAtSelection to check format at cursor/selection position
          const textFormat = paragraph ? getFormatAtSelection(paragraph, textSelection) : 0;
          const isActive = focusedIndex !== null;

          return (
            <>
                {/* Text formatting buttons */}
                <TouchableOpacity
                  style={[
                    styles.formatButton,
                    hasFormat(textFormat, TEXT_FORMAT_BOLD) && styles.formatButtonActive,
                  ]}
                  onPress={() => applyTextFormat(focusedIndex, TEXT_FORMAT_BOLD)}
                >
                  <Text
                    style={[
                      styles.formatButtonText,
                      hasFormat(textFormat, TEXT_FORMAT_BOLD) && styles.formatButtonTextActive,
                      { fontWeight: 'bold' },
                    ]}
                  >
                    B
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatButton,
                    hasFormat(textFormat, TEXT_FORMAT_ITALIC) && styles.formatButtonActive,
                  ]}
                  onPress={() => applyTextFormat(focusedIndex, TEXT_FORMAT_ITALIC)}
                >
                  <Text
                    style={[
                      styles.formatButtonText,
                      hasFormat(textFormat, TEXT_FORMAT_ITALIC) && styles.formatButtonTextActive,
                      { fontStyle: 'italic' },
                    ]}
                  >
                    I
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatButton,
                    hasFormat(textFormat, TEXT_FORMAT_UNDERLINE) && styles.formatButtonActive,
                  ]}
                  onPress={() => applyTextFormat(focusedIndex, TEXT_FORMAT_UNDERLINE)}
                >
                  <Text
                    style={[
                      styles.formatButtonText,
                      hasFormat(textFormat, TEXT_FORMAT_UNDERLINE) && styles.formatButtonTextActive,
                      { textDecorationLine: 'underline' },
                    ]}
                  >
                    U
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatButton,
                    hasFormat(textFormat, TEXT_FORMAT_STRIKETHROUGH) && styles.formatButtonActive,
                  ]}
                  onPress={() => applyTextFormat(focusedIndex, TEXT_FORMAT_STRIKETHROUGH)}
                >
                  <Text
                    style={[
                      styles.formatButtonText,
                      hasFormat(textFormat, TEXT_FORMAT_STRIKETHROUGH) && styles.formatButtonTextActive,
                      { textDecorationLine: 'line-through' },
                    ]}
                  >
                    S
                  </Text>
                </TouchableOpacity>

                <View style={styles.toolbarSeparator} />

                {/* Alignment buttons */}
                <TouchableOpacity
                  style={[
                    styles.formatButton,
                    textAlign === 'left' && styles.formatButtonActive,
                  ]}
                  onPress={() => applyAlignment(focusedIndex, '')}
                >
                  <Text
                    style={[
                      styles.formatButtonText,
                      textAlign === 'left' && styles.formatButtonTextActive,
                    ]}
                  >
                    ≡
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatButton,
                    textAlign === 'center' && styles.formatButtonActive,
                  ]}
                  onPress={() => applyAlignment(focusedIndex, 'center')}
                >
                  <Text
                    style={[
                      styles.formatButtonText,
                      textAlign === 'center' && styles.formatButtonTextActive,
                    ]}
                  >
                    ≣
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatButton,
                    textAlign === 'right' && styles.formatButtonActive,
                  ]}
                  onPress={() => applyAlignment(focusedIndex, 'right')}
                >
                  <Text
                    style={[
                      styles.formatButtonText,
                      textAlign === 'right' && styles.formatButtonTextActive,
                    ]}
                  >
                    ≡
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatButton,
                    textAlign === 'justify' && styles.formatButtonActive,
                  ]}
                  onPress={() => applyAlignment(focusedIndex, 'justify')}
                >
                  <Text
                    style={[
                      styles.formatButtonText,
                      textAlign === 'justify' && styles.formatButtonTextActive,
                    ]}
                  >
                    ≣
                  </Text>
                </TouchableOpacity>
              </>
            );
          })()}
      </View>

      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {paragraphs.map((paragraph, index) => {
          const text = extractTextFromParagraph(paragraph);
          const textAlign = getTextAlignment(paragraph.format);
          const textFormat = getTextFormat(paragraph);
          const textStyle = getTextStyle(textFormat);

          return (
            <View key={paragraph.key_id}>
              {focusedIndex === index ? (
                // Editing mode: show TextInput
                <TextInput
                  ref={(ref) => {
                    if (ref) {
                      textInputRefs.current.set(index, ref);
                    } else {
                      textInputRefs.current.delete(index);
                    }
                  }}
                  style={[styles.paragraphInput, { textAlign }, textStyle]}
                  placeholder={index === 0 ? 'Start writing your story...' : ''}
                  placeholderTextColor="#999"
                  value={text}
                  onChangeText={(newText) => updateParagraphText(index, newText)}
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => {
                    setFocusedIndex(null);
                    setTextSelection(null);
                  }}
                  onSelectionChange={({ nativeEvent: { selection } }) => {
                    setTextSelection(selection);
                  }}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace') {
                      const cursorPos = textSelection?.start ?? 0;
                      handleBackspace(index, text, cursorPos);
                    }
                  }}
                  multiline
                  textAlignVertical="top"
                  blurOnSubmit={false}
                  returnKeyType="default"
                  autoFocus
                />
              ) : (
                // Display mode: show Text with formatting and association highlighting
                <TouchableOpacity
                  onPress={() => setFocusedIndex(index)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.paragraphInput, { textAlign }]}>
                    {text.length === 0 && index === 0 ? (
                      <Text style={{ color: '#999' }}>Start writing your story...</Text>
                    ) : (
                      renderFormattedChildren(paragraph)
                    )}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Press Enter to create a new paragraph. Tap a paragraph to edit and use the formatting toolbar above.
          </Text>
        </View>
      </ScrollView>

      <AssociationPanel
        visible={showAssociationPanel}
        associationId={selectedAssociationId}
        storyId={storyId || ''}
        onClose={() => {
          setShowAssociationPanel(false);
          setSelectedAssociationId(null);
        }}
      />
    </SafeAreaView>
  );
};
