import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { WebView } from 'react-native-webview';
import { StyleSheet } from 'react-native';
import { LEXICAL_HTML } from './lexicalHtml';
import { Association } from '../hooks/useAssociations';

interface LexicalEditorProps {
  onContentChange?: (content: any) => void;
  onSave?: (content: any) => void;
  onAssociationClick?: (association: Association) => void;
  onFormatChange?: (formatState: any) => void;
  onReady?: () => void;
  backgroundColor?: string;
  textColor?: string;
  associations?: Association[];
  autotab?: boolean;
  spellcheck?: boolean;
  readOnly?: boolean;
}

export interface LexicalEditorRef {
  setContent: (content: any) => void;
  getContent: () => Promise<any>;
  getHtml: () => Promise<string>;
  focus: () => void;
  applyFormat: (format: 'bold' | 'italic' | 'underline' | 'strikethrough') => void;
  applyAlignment: (alignment: 'left' | 'center' | 'right' | 'justify') => void;
}

export const LexicalEditor = forwardRef<LexicalEditorRef, LexicalEditorProps>(
  ({ onContentChange, onSave, onAssociationClick, onFormatChange, onReady, backgroundColor = '#ffffff', textColor = '#000000', associations = [], autotab = false, spellcheck = true, readOnly = false }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const editorReadyRef = useRef(false);
    const pendingContentRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      setContent: (content: any) => {
        if (editorReadyRef.current && webViewRef.current) {
          const message = JSON.stringify({ type: 'setContent', payload: content });
          webViewRef.current.postMessage(message);
        } else {
          pendingContentRef.current = content;
        }
      },
      getContent: (): Promise<any> => {
        return new Promise((resolve) => {
          // Store resolver temporarily
          (window as any).__contentResolver = resolve;
          webViewRef.current?.postMessage(
            JSON.stringify({ type: 'getContent' })
          );
        });
      },
      getHtml: (): Promise<string> => {
        return new Promise((resolve) => {
          // Store resolver temporarily
          (window as any).__htmlResolver = resolve;
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

    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        switch (data.type) {
          case 'log':
            // WebView log messages - silently ignore in production
            break;
          case 'contentChanged':
            onContentChange?.(data.payload);
            break;
          case 'save':
            onSave?.(data.payload);
            break;
          case 'contentResponse':
            if ((window as any).__contentResolver) {
              (window as any).__contentResolver(data.payload);
              delete (window as any).__contentResolver;
            }
            break;
          case 'htmlResponse':
            if ((window as any).__htmlResolver) {
              (window as any).__htmlResolver(data.payload);
              delete (window as any).__htmlResolver;
            }
            break;
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
            onAssociationClick?.(data.payload);
            break;
          case 'formatChange':
            onFormatChange?.(data.payload);
            break;
          case 'requestFocus':
            webViewRef.current?.requestFocus?.();
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
