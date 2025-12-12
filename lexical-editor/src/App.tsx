import { useEffect, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode, $getSelection, $setSelection, $createRangeSelection, $isRangeSelection, TextNode, ElementNode, KEY_ENTER_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import type { LexicalNode } from 'lexical';
import type { Association, BackendData, BackendItem, ExportedBlock, TextNodeData, ParagraphChunk, SelectionInfo, SearchPattern } from './types';
import './App.css';

// Lexical format bit flags (matching backend)
const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;

// Association colors (matching React Native theme)
const ASSOCIATION_COLORS = {
  character: '#4ade80',
  place: '#60a5fa',
  event: '#f87171',
  item: '#fbbf24',
};

function EditorPlugin() {
  const [editor] = useLexicalComposerContext();
  const isLoadingRef = useRef(false);
  const isHighlightingRef = useRef(false); // Prevent infinite loop during highlighting
  const originalItemsRef = useRef<BackendItem[]>([]); // Store original items to preserve key_ids
  const associationsRef = useRef<Association[]>([]); // Store associations for color mapping
  const associationMapRef = useRef<Map<string, Association>>(new Map()); // Map text content to association for click handling
  const autotabRef = useRef(false); // Store autotab setting
  const spellCheckRef = useRef(true); // Store spellcheck setting

  useEffect(() => {
    // Override console.log to send to React Native
    const originalLog = console.log;
    console.log = function(...args: unknown[]) {
      originalLog.apply(console, args);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          payload: { message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }
        }));
      }
    };

    // Helper to send messages to React Native
    function sendMessage(type: string, payload?: unknown) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
      }
    }

    // Load content from backend format
    function loadContentFromBackend(data: BackendData) {
      if (!data || !data.items) {
        return;
      }

      // Store original items to preserve key_ids and other metadata
      originalItemsRef.current = data.items;
      isLoadingRef.current = true;
      editor.update(() => {
        const root = $getRoot();
        root.clear();

        data.items.forEach((item: BackendItem) => {
          try {
            let chunk: ParagraphChunk;
            if (typeof item.chunk === 'string') {
              chunk = JSON.parse(item.chunk) as ParagraphChunk;
            } else if (typeof item.chunk === 'object' && item.chunk !== null && 'Value' in item.chunk) {
              // Backend returns chunk wrapped in DynamoDB format
              const chunkValue = item.chunk.Value;
              if (typeof chunkValue === 'string') {
                chunk = JSON.parse(chunkValue) as ParagraphChunk;
              } else {
                chunk = chunkValue as ParagraphChunk;
              }
            } else {
              chunk = item.chunk as ParagraphChunk;
            }

            const paragraph = $createParagraphNode();

            // Apply paragraph format (alignment) if present
            if (chunk.format) {
              paragraph.setFormat(chunk.format as 'left' | 'center' | 'right' | 'justify' | 'start' | 'end' | '');
            }

            // Apply paragraph indent if present
            if (chunk.indent !== undefined) {
              paragraph.setIndent(chunk.indent);
            }

            if (chunk.children && Array.isArray(chunk.children)) {
              chunk.children.forEach((textNode: TextNodeData) => {
                const text = $createTextNode(textNode.text || '');

                const format = textNode.format || 0;
                if (format & FORMAT_BOLD) text.toggleFormat('bold');
                if (format & FORMAT_ITALIC) text.toggleFormat('italic');
                if (format & FORMAT_UNDERLINE) text.toggleFormat('underline');
                if (format & FORMAT_STRIKETHROUGH) text.toggleFormat('strikethrough');

                if (textNode.style) {
                  text.setStyle(textNode.style);
                }

                paragraph.append(text);
              });
            }

            root.append(paragraph);
          } catch (error) {
            console.error('Failed to parse chunk:', error);
          }
        });

        if (root.isEmpty()) {
          root.append($createParagraphNode());
        }
      });
      isLoadingRef.current = false;

      // Highlight associations after content is loaded
      setTimeout(() => highlightAssociations(), 100);
    }

    // Export content to backend format
    function exportContentToBackend() {
      const blocks: ExportedBlock[] = [];

      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();

        children.forEach((node, index) => {
          if (node.getType() === 'paragraph') {
            const textNodes: TextNodeData[] = [];
            const nodeChildren = (node as ElementNode).getChildren();

            nodeChildren.forEach((child: LexicalNode) => {
              if (child.getType() === 'text') {
                const textChild = child as TextNode;
                let format = 0;
                if (textChild.hasFormat('bold')) format |= FORMAT_BOLD;
                if (textChild.hasFormat('italic')) format |= FORMAT_ITALIC;
                if (textChild.hasFormat('underline')) format |= FORMAT_UNDERLINE;
                if (textChild.hasFormat('strikethrough')) format |= FORMAT_STRIKETHROUGH;

                textNodes.push({
                  type: 'text',
                  version: 1,
                  text: child.getTextContent(),
                  format: format || 0,
                  style: (child as TextNode).getStyle?.() || '',
                  mode: 'normal',
                  detail: (child as TextNode).getDetail?.() || 0,
                });
              }
            });

            // Get original item if it exists to preserve metadata
            const originalItem = originalItemsRef.current[index];

            // Get paragraph format and indent
            const paragraphNode = node as ElementNode & {
              getFormatType?: () => string;
              getIndent?: () => number;
            };
            const paragraphFormat = paragraphNode.getFormatType?.() || 'left';
            const paragraphIndent = paragraphNode.getIndent?.() || 0;

            const unwrappedKeyId = typeof originalItem?.key_id === 'object' && originalItem.key_id !== null && 'Value' in originalItem.key_id
              ? String(originalItem.key_id.Value)
              : String(originalItem?.key_id || `para-${Date.now()}-${index}`);

            const lexicalParagraph: ParagraphChunk = {
              children: textNodes,
              direction: 'ltr',
              format: paragraphFormat,
              indent: paragraphIndent,
              type: 'custom-paragraph',
              version: 1,
              textFormat: 0,
              textStyle: '',
              key_id: unwrappedKeyId,
            };

            // Unwrap DynamoDB format - backend expects plain strings not {Value: "..."} objects
            // Send chunk as object, backend will stringify it for DynamoDB
            const block: ExportedBlock = {
              key_id: unwrappedKeyId,
              chunk: lexicalParagraph,
              place: index.toString(),
            };

            // Include other metadata if it exists (unwrapped)
            if (originalItem?.chapter_id) {
              block.chapter_id = typeof originalItem.chapter_id === 'object' && originalItem.chapter_id !== null && 'Value' in originalItem.chapter_id
                ? String(originalItem.chapter_id.Value)
                : String(originalItem.chapter_id);
            }
            if (originalItem?.story_id) {
              block.story_id = typeof originalItem.story_id === 'object' && originalItem.story_id !== null && 'Value' in originalItem.story_id
                ? String(originalItem.story_id.Value)
                : String(originalItem.story_id);
            }
            if (originalItem?.composite_key) {
              block.composite_key = typeof originalItem.composite_key === 'object' && originalItem.composite_key !== null && 'Value' in originalItem.composite_key
                ? String(originalItem.composite_key.Value)
                : String(originalItem.composite_key);
            }

            blocks.push(block);
          }
        });
      });

      return { blocks };
    }

    // Highlight all association names/aliases in the document
    // If paragraphKeys is provided, only highlight those specific paragraphs
    function highlightAssociations(paragraphKeys?: Set<string>) {
      if (associationsRef.current.length === 0) {
        return;
      }

      if (isHighlightingRef.current) {
        return;
      }

      isHighlightingRef.current = true;

      // Clear association map before rebuilding
      associationMapRef.current.clear();

      // Save current selection info to restore after highlighting
      let savedSelectionInfo: SelectionInfo | null = null;

      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && selection.isCollapsed()) {
          const anchor = selection.anchor;
          const node = anchor.getNode();

          // Find the paragraph containing this node
          let currentNode: LexicalNode | null = node;
          while (currentNode && currentNode.getType() !== 'paragraph') {
            currentNode = currentNode.getParent();
          }

          if (currentNode && currentNode.getType() === 'paragraph') {
            // Calculate offset from start of paragraph
            const children = (currentNode as ElementNode).getChildren();
            let charCount = 0;
            let targetOffset = 0;

            for (const child of children) {
              if (child.getKey() === node.getKey()) {
                targetOffset = charCount + anchor.offset;
                break;
              }
              charCount += child.getTextContent().length;
            }

            savedSelectionInfo = {
              paragraphKey: currentNode.getKey(),
              anchorOffset: targetOffset,
              focusOffset: targetOffset,
              isCollapsed: true,
            };
          }
        }
      });

      // Helper to escape regex special characters
      function escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      // Build searchable patterns for each association (sorted longest first)
      const searchPatterns: SearchPattern[] = [];

      for (const assoc of associationsRef.current) {
        const names = [assoc.association_name];
        if (assoc.aliases) {
          const aliases = assoc.aliases.split(',').map((a: string) => a.trim()).filter((a: string) => a);
          names.push(...aliases);
        }

        const color = ASSOCIATION_COLORS[assoc.association_type] || '#9ca3af';

        for (const name of names) {
          if (!name) continue;
          // Create regex with word boundaries and appropriate flags
          const escapedName = escapeRegex(name);
          const flags = assoc.case_sensitive ? 'g' : 'gi';
          const regex = new RegExp(`\\b${escapedName}\\b`, flags);

          searchPatterns.push({
            regex,
            color,
            association: assoc,
          });
        }
      }

      // Sort by pattern length descending (longest first) to prioritize longer matches
      searchPatterns.sort((a, b) => {
        // Extract the pattern without boundaries and flags for length comparison
        const aPattern = a.regex.source.replace(/\\b/g, '');
        const bPattern = b.regex.source.replace(/\\b/g, '');
        return bPattern.length - aPattern.length;
      });

      editor.update(() => {
        const root = $getRoot();

        // If specific paragraphs requested, only get those. Otherwise get all.
        const paragraphsToProcess = paragraphKeys
          ? Array.from(paragraphKeys).map(key => {
              const children = root.getChildren();
              return children.find((p: LexicalNode) => p.getKey() === key);
            }).filter((p): p is ElementNode => p !== undefined && p.getType() === 'paragraph')
          : root.getChildren().filter((p: LexicalNode): p is ElementNode => p.getType() === 'paragraph');

        paragraphsToProcess.forEach((paragraph: ElementNode) => {
          const textNodes = paragraph.getChildren();
          const nodesToProcess: Array<{ node: TextNode; parent: ElementNode }> = [];

          // Collect text nodes to process
          textNodes.forEach((node: LexicalNode) => {
            if (node.getType() === 'text') {
              nodesToProcess.push({ node: node as TextNode, parent: paragraph });
            }
          });

          // Process each text node
          nodesToProcess.forEach(({ node }) => {
            const text = node.getTextContent();
            const originalFormat = node.getFormat();

            // Find all matches in this text node
            const matches: Array<{ start: number; end: number; color: string; association: Association }> = [];

            for (const pattern of searchPatterns) {
              // Reset regex lastIndex for each text node
              pattern.regex.lastIndex = 0;

              let match;
              while ((match = pattern.regex.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;

                // Check if this match overlaps with an existing (longer) match
                const overlaps = matches.some(m =>
                  (start >= m.start && start < m.end) ||
                  (end > m.start && end <= m.end) ||
                  (start <= m.start && end >= m.end)
                );

                if (!overlaps) {
                  matches.push({ start, end, color: pattern.color, association: pattern.association });
                }
              }
            }

            if (matches.length === 0) {
              // No matches, remove any existing color styling
              const currentStyle = node.getStyle();
              if (currentStyle && currentStyle.includes('color:')) {
                node.setStyle('');
              }
              return;
            }

            // Sort matches by start position
            matches.sort((a, b) => a.start - b.start);

            // Build array of new nodes to insert
            const newNodes: TextNode[] = [];
            let lastIndex = 0;

            for (const match of matches) {
              // Text before match (no color)
              if (match.start > lastIndex) {
                const before = $createTextNode(text.substring(lastIndex, match.start));
                before.setFormat(originalFormat);
                newNodes.push(before);
              }

              // Matched text (colored)
              const matchedText = text.substring(match.start, match.end);
              const matched = $createTextNode(matchedText);
              matched.setFormat(originalFormat);
              matched.setStyle(`color: ${match.color}`);
              newNodes.push(matched);

              // Store association mapping for click handling (case-insensitive key)
              associationMapRef.current.set(matchedText.toLowerCase(), match.association);

              lastIndex = match.end;
            }

            // Remaining text after last match
            if (lastIndex < text.length) {
              const after = $createTextNode(text.substring(lastIndex));
              after.setFormat(originalFormat);
              newNodes.push(after);
            }

            // Insert new nodes at the position of the old node, then remove old node
            if (newNodes.length > 0) {
              // Insert all new nodes before the old node
              newNodes.forEach((newNode) => {
                node.insertBefore(newNode);
              });
              // Remove the old node
              node.remove();
            }
          });
        });

        // Restore selection if we saved one
        if (savedSelectionInfo) {
          // Get fresh reference to children after modifications
          const updatedChildren = root.getChildren();
          const paragraph = updatedChildren.find((p: LexicalNode) => p.getKey() === savedSelectionInfo!.paragraphKey);

          if (paragraph) {
            const textNodes = (paragraph as ElementNode).getChildren();
            let charCount = 0;
            let targetNode = null;
            let targetOffset = 0;

            // Find the text node that contains the saved offset
            for (const node of textNodes) {
              const nodeLength = node.getTextContent().length;
              if (charCount + nodeLength >= savedSelectionInfo.anchorOffset) {
                targetNode = node;
                targetOffset = savedSelectionInfo.anchorOffset - charCount;
                break;
              }
              charCount += nodeLength;
            }

            // Restore the selection
            if (targetNode) {
              const newSelection = $createRangeSelection();
              newSelection.anchor.set(targetNode.getKey(), targetOffset, 'text');
              newSelection.focus.set(targetNode.getKey(), targetOffset, 'text');
              $setSelection(newSelection);
            }
          }
        }
      });

      // Clear flag after a delay to ensure update listener sees it
      setTimeout(() => {
        isHighlightingRef.current = false;
      }, 100);
    }

    // Handle messages from React Native
    function handleMessage(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'setContent':
            loadContentFromBackend(data.payload);
            break;

          case 'getContent': {
            const content = exportContentToBackend();
            sendMessage('contentResponse', content);
            break;
          }

          case 'focus':
            editor.focus();
            break;

          case 'setAssociations':
            associationsRef.current = data.payload || [];
            // Highlight associations after setting them
            highlightAssociations();
            break;

          case 'setAutotab':
            autotabRef.current = data.payload || false;
            break;

          case 'setSpellcheck': {
            spellCheckRef.current = data.payload ?? true;
            // Apply spellcheck attribute to contentEditable element
            const contentEditableElement = document.querySelector('.editor-input');
            if (contentEditableElement) {
              contentEditableElement.setAttribute('spellcheck', String(spellCheckRef.current));
            }
            break;
          }

          case 'applyFormat': {
            const format = data.payload;
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                switch (format) {
                  case 'bold':
                    selection.formatText('bold');
                    break;
                  case 'italic':
                    selection.formatText('italic');
                    break;
                  case 'underline':
                    selection.formatText('underline');
                    break;
                  case 'strikethrough':
                    selection.formatText('strikethrough');
                    break;
                }
              }
            });
            break;
          }

          case 'applyAlignment': {
            const alignment = data.payload;
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                const anchorNode = selection.anchor.getNode();
                let element = anchorNode.getParent();

                // Find the paragraph element
                while (element && element.getType() !== 'paragraph') {
                  element = element.getParent();
                }

                if (element && element.getType() === 'paragraph') {
                  (element as ElementNode).setFormat(alignment);
                }
              }
            });
            break;
          }
        }
      } catch (error) {
        console.error('Failed to handle message:', error);
        sendMessage('error', { message: (error as Error).message });
      }
    }

    // Listen for messages from React Native
    // React Native WebView uses document.addEventListener on Android
    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage as unknown as EventListener);

    // Handle clicks on associations
    function handleAssociationClick(event: Event) {
      const target = event.target as HTMLElement;

      // Check if the clicked element or its parent has colored text
      let textElement: HTMLElement | null = target;
      let attempts = 0;
      const maxAttempts = 3; // Check up to 3 parent levels

      while (textElement && attempts < maxAttempts) {
        const computedStyle = window.getComputedStyle(textElement);
        const color = computedStyle.color;

        // Check if this element has one of our association colors
        const hasAssociationColor = Object.values(ASSOCIATION_COLORS).some(assocColor => {
          // Convert hex to RGB for comparison
          const hexToRgb = (hex: string): string => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgb(${r}, ${g}, ${b})`;
          };
          return color === hexToRgb(assocColor);
        });

        if (hasAssociationColor && textElement.textContent) {
          const text = textElement.textContent.trim();
          const association = associationMapRef.current.get(text.toLowerCase());

          if (association) {
            // Immediately stop the event from propagating
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            // Blur the editor to prevent keyboard from showing
            const contentEditableElement = document.querySelector('.editor-input') as HTMLElement;
            if (contentEditableElement) {
              contentEditableElement.blur();
            }

            sendMessage('associationClicked', association);
            return;
          }
        }

        textElement = textElement.parentElement;
        attempts++;
      }
    }

    // Add click listener to the editor (using capture phase to intercept before editor handles it)
    const contentEditableElement = document.querySelector('.editor-input');
    if (contentEditableElement) {
      contentEditableElement.addEventListener('click', handleAssociationClick, true); // true = capture phase
    }

    // Initialize with empty content
    editor.update(() => {
      const root = $getRoot();
      if (root.isEmpty()) {
        root.append($createParagraphNode());
      }
    });

    // Listen for content changes and re-highlight associations (debounced)
    let highlightTimeout: ReturnType<typeof setTimeout> | undefined;
    editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (isLoadingRef.current) return; // Don't highlight while loading content
      if (isHighlightingRef.current) return; // Don't highlight while already highlighting

      // Only re-highlight if actual content changed, not just selection/cursor
      const hasContentChanges = dirtyElements.size > 0 || dirtyLeaves.size > 0;
      if (!hasContentChanges) return;

      // Find which paragraphs were modified
      const modifiedParagraphs = new Set<string>();

      editor.getEditorState().read(() => {
        const root = $getRoot();

        // Check dirty leaves (text nodes) and find their parent paragraphs
        dirtyLeaves.forEach((nodeKey) => {
          const allNodes = root.getAllTextNodes();
          const textNode = allNodes.find(n => n.getKey() === nodeKey);
          if (textNode) {
            let current: LexicalNode | null = textNode;
            while (current) {
              if (current.getType() === 'paragraph') {
                modifiedParagraphs.add(current.getKey());
                break;
              }
              current = current.getParent();
            }
          }
        });

        // Check dirty elements for paragraphs
        dirtyElements.forEach((_value: boolean, nodeKey: string) => {
          const children = root.getChildren();
          const element = children.find((n: LexicalNode) => n.getKey() === nodeKey);
          if (element && element.getType() === 'paragraph') {
            modifiedParagraphs.add(element.getKey());
          }
        });
      });

      clearTimeout(highlightTimeout);
      highlightTimeout = setTimeout(() => {
        if (modifiedParagraphs.size > 0) {
          highlightAssociations(modifiedParagraphs);
        }
      }, 1000); // Debounce 1000ms to avoid rapid re-highlighting
    });

    // Listen for selection changes to update format toolbar state
    editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          // Get text formatting state
          const isBold = selection.hasFormat('bold');
          const isItalic = selection.hasFormat('italic');
          const isUnderline = selection.hasFormat('underline');
          const isStrikethrough = selection.hasFormat('strikethrough');

          // Get paragraph alignment
          let alignment: 'left' | 'center' | 'right' | 'justify' = 'left';
          const anchorNode = selection.anchor.getNode();
          let element = anchorNode.getParent();

          // Find the paragraph element
          while (element && element.getType() !== 'paragraph') {
            element = element.getParent();
          }

          if (element && element.getType() === 'paragraph') {
            const format = (element as ElementNode).getFormatType();
            if (format === 'center' || format === 'right' || format === 'justify') {
              alignment = format;
            }
          }

          // Send format state to React Native
          sendMessage('formatChange', {
            isBold,
            isItalic,
            isUnderline,
            isStrikethrough,
            alignment
          });
        }
      });
    });

    // Register Enter key command for autotab
    const removeEnterCommand = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        if (!autotabRef.current) return false; // Let default behavior handle it

        // Let Lexical create the new paragraph first, then add tab
        setTimeout(() => {
          editor.update(() => {
            const newSelection = $getSelection();

            if ($isRangeSelection(newSelection) && newSelection.isCollapsed()) {
              const anchor = newSelection.anchor;
              const node = anchor.getNode();

              // The node might be the paragraph itself
              let paragraph: ElementNode | null = null;
              if (node.getType() === 'paragraph') {
                paragraph = node as ElementNode;
              } else {
                const parent = node.getParent();
                if (parent && parent.getType() === 'paragraph') {
                  paragraph = parent as ElementNode;
                }
              }

              if (paragraph) {
                const children = paragraph.getChildren();

                // If paragraph is empty or only has one empty text node
                if (children.length === 0 || (children.length === 1 && children[0].getTextContent() === '')) {
                  const tabNode = $createTextNode('\t');

                  // Clear the paragraph and add tab
                  children.forEach((child: LexicalNode) => child.remove());
                  paragraph.append(tabNode);

                  // Set cursor after the tab
                  const newSel = $createRangeSelection();
                  newSel.anchor.set(tabNode.getKey(), 1, 'text');
                  newSel.focus.set(tabNode.getKey(), 1, 'text');
                  $setSelection(newSel);
                }
              }
            }
          });
        }, 0);

        return false; // Let default Enter behavior proceed
      },
      COMMAND_PRIORITY_LOW
    );

    // Set initial spellcheck attribute
    setTimeout(() => {
      const contentEditableElement = document.querySelector('.editor-input');
      if (contentEditableElement) {
        contentEditableElement.setAttribute('spellcheck', String(spellCheckRef.current));
      }
    }, 100);

    // Notify React Native that editor is ready
    sendMessage('ready', {});

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('message', handleMessage as unknown as EventListener);
      const contentEditableElement = document.querySelector('.editor-input');
      if (contentEditableElement) {
        contentEditableElement.removeEventListener('click', handleAssociationClick, true); // true = capture phase
      }
      removeEnterCommand();
    };
  }, [editor]);

  return null;
}

function App() {
  const initialConfig = {
    namespace: 'MiniDocterEditor',
    theme: {
      paragraph: 'editor-paragraph',
      text: {
        bold: 'editor-text-bold',
        italic: 'editor-text-italic',
        underline: 'editor-text-underline',
        strikethrough: 'editor-text-strikethrough',
      }
    },
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-container">
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          placeholder={<div className="editor-placeholder">Start typing...</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <EditorPlugin />
      </div>
    </LexicalComposer>
  );
}

export default App;
