import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { StyleSheet } from 'react-native';
import { LEXICAL_HTML } from './lexicalHtml';
import { Association } from '../hooks/useAssociations';

export interface SelectionInfo {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorFormatState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  alignment: 'left' | 'center' | 'right' | 'justify';
}

export interface EditorContent {
  items: EditorContentItem[];
}

export interface EditorContentItem {
  key_id: string;
  chunk: EditorParagraphChunk;
  place: string;
  chapter_id?: string;
  story_id?: string;
  composite_key?: string;
}

export interface EditorParagraphChunk {
  children: EditorTextNode[];
  direction: string;
  format?: string | number;
  indent?: number;
  type?: string;
  version?: number;
  textFormat?: number;
  textStyle?: string;
  key_id?: string | number;
}

export interface EditorTextNode {
  type: 'text';
  version: number;
  text: string;
  format: number;
  style: string;
  mode: string;
  detail: number;
}

export interface EditorContentResponse {
  blocks: EditorContentItem[];
}

interface LexicalEditorProps {
  onContentChange?: (content: EditorContentResponse) => void;
  onSave?: (content: EditorContentResponse) => void;
  onAssociationClick?: (association: Association, position: { x: number; y: number }) => void;
  onAssociationLongPress?: (association: Association) => void;
  onFormatChange?: (formatState: EditorFormatState) => void;
  onReady?: () => void;
  onTextSelected?: (selection: SelectionInfo) => void;
  onSelectionCleared?: () => void;
  backgroundColor?: string;
  textColor?: string;
  associations?: Association[];
  autotab?: boolean;
  spellcheck?: boolean;
  readOnly?: boolean;
}

export interface LexicalEditorRef {
  setContent: (content: EditorContent) => void;
  getContent: () => Promise<EditorContentResponse>;
  getHtml: () => Promise<string>;
  focus: () => void;
  applyFormat: (format: 'bold' | 'italic' | 'underline' | 'strikethrough') => void;
  applyAlignment: (alignment: 'left' | 'center' | 'right' | 'justify') => void;
  deleteSelection: () => void;
  insertText: (text: string) => void;
}

export const LexicalEditor = forwardRef<LexicalEditorRef, LexicalEditorProps>(
  ({ onContentChange, onSave, onAssociationClick, onAssociationLongPress, onFormatChange, onReady, onTextSelected, onSelectionCleared, backgroundColor = '#ffffff', textColor = '#000000', associations = [], autotab = false, spellcheck = true, readOnly = false }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const editorReadyRef = useRef(false);
    const pendingContentRef = useRef<EditorContent | null>(null);

    useImperativeHandle(ref, () => ({
      setContent: (content: EditorContent) => {
        if (editorReadyRef.current && webViewRef.current) {
          const message = JSON.stringify({ type: 'setContent', payload: content });
          webViewRef.current.postMessage(message);
        } else {
          pendingContentRef.current = content;
        }
      },
      getContent: (): Promise<EditorContentResponse> => {
        return new Promise((resolve) => {
          // Store resolver temporarily
          (window as unknown as { __contentResolver: (value: EditorContentResponse) => void }).__contentResolver = resolve;
          webViewRef.current?.postMessage(
            JSON.stringify({ type: 'getContent' })
          );
        });
      },
      getHtml: (): Promise<string> => {
        return new Promise((resolve) => {
          // Store resolver temporarily
          (window as unknown as { __htmlResolver: (value: string) => void }).__htmlResolver = resolve;
          webViewRef.current?.postMessage(
            JSON.stringify({ type: 'getHtml' })
          );
        });
      },
      focus: () => {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'focus' })
        );
      },
      applyFormat: (format: 'bold' | 'italic' | 'underline' | 'strikethrough') => {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'applyFormat', payload: format })
        );
      },
      applyAlignment: (alignment: 'left' | 'center' | 'right' | 'justify') => {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'applyAlignment', payload: alignment })
        );
      },
      deleteSelection: () => {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'deleteSelection' })
        );
      },
      insertText: (text: string) => {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'insertText', payload: text })
        );
      },
    }));

    // Send associations to WebView when they change
    React.useEffect(() => {
      if (editorReadyRef.current && webViewRef.current && associations.length > 0) {
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'setAssociations', payload: associations })
        );
      }
    }, [associations]);

    // Send autotab setting to WebView when it changes
    React.useEffect(() => {
      if (editorReadyRef.current && webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'setAutotab', payload: autotab })
        );
      }
    }, [autotab]);

    // Send spellcheck setting to WebView when it changes
    React.useEffect(() => {
      if (editorReadyRef.current && webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'setSpellcheck', payload: spellcheck })
        );
      }
    }, [spellcheck]);

    // Send readOnly setting to WebView when it changes
    React.useEffect(() => {
      if (editorReadyRef.current && webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'setReadOnly', payload: readOnly })
        );
      }
    }, [readOnly]);

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        switch (data.type) {
          case 'log':
            // WebView log messages - silently ignore in production
            break;
          case 'contentChanged':
            onContentChange?.(data.payload as EditorContentResponse);
            break;
          case 'save':
            onSave?.(data.payload as EditorContentResponse);
            break;
          case 'contentResponse': {
            const win = window as unknown as { __contentResolver?: (value: EditorContentResponse) => void };
            if (win.__contentResolver) {
              win.__contentResolver(data.payload as EditorContentResponse);
              delete win.__contentResolver;
            }
            break;
          }
          case 'htmlResponse': {
            const win = window as unknown as { __htmlResolver?: (value: string) => void };
            if (win.__htmlResolver) {
              win.__htmlResolver(data.payload as string);
              delete win.__htmlResolver;
            }
            break;
          }
          case 'ready':
            editorReadyRef.current = true;
            // Send pending content if any
            if (pendingContentRef.current && webViewRef.current) {
              const message = JSON.stringify({ type: 'setContent', payload: pendingContentRef.current });
              webViewRef.current.postMessage(message);
              pendingContentRef.current = null;
            }
            // Send associations when editor becomes ready
            if (associations.length > 0 && webViewRef.current) {
              webViewRef.current.postMessage(
                JSON.stringify({ type: 'setAssociations', payload: associations })
              );
            }
            // Send autotab setting when editor becomes ready
            if (webViewRef.current) {
              webViewRef.current.postMessage(
                JSON.stringify({ type: 'setAutotab', payload: autotab })
              );
            }
            // Send spellcheck setting when editor becomes ready
            if (webViewRef.current) {
              webViewRef.current.postMessage(
                JSON.stringify({ type: 'setSpellcheck', payload: spellcheck })
              );
            }
            // Send readOnly setting when editor becomes ready
            if (webViewRef.current) {
              webViewRef.current.postMessage(
                JSON.stringify({ type: 'setReadOnly', payload: readOnly })
              );
            }
            // Notify parent component that editor is ready
            onReady?.();
            break;
          case 'associationClicked':
            onAssociationClick?.(data.payload.association, data.payload.position);
            break;
          case 'associationLongPressed':
            onAssociationLongPress?.(data.payload);
            break;
          case 'formatChange':
            onFormatChange?.(data.payload);
            break;
          case 'requestFocus':
            webViewRef.current?.requestFocus?.();
            break;
          case 'textSelected':
            onTextSelected?.(data.payload);
            break;
          case 'selectionCleared':
            onSelectionCleared?.();
            break;
          case 'error':
            console.error('[Lexical] Error:', data.payload);
            break;
          default:
            // Unknown message type - ignore
            break;
        }
      } catch (error) {
        console.error('[Lexical] Failed to parse message:', error);
      }
    };

    // Inject custom styles into the bundled HTML
    // Set background on both body and html to ensure it extends when scrolling
    const editorHTML = LEXICAL_HTML
      .replace('<html', `<html style="background-color: ${backgroundColor};"`)
      .replace('<body>', `<body style="background-color: ${backgroundColor}; color: ${textColor};">`);

    return (
      <WebView
        ref={webViewRef}
        source={{ html: editorHTML }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[WebView] Error:', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[WebView] HTTP Error:', nativeEvent);
        }}
      />
    );
  }
);

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#f0f0f0', // Visible background for debugging
  },
});
