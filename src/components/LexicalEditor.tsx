import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { WebView } from 'react-native-webview';
import { StyleSheet } from 'react-native';
import { LEXICAL_HTML } from './lexicalHtml';
import { Association } from '../hooks/useAssociations';

interface LexicalEditorProps {
  onContentChange?: (content: any) => void;
  onSave?: (content: any) => void;
  onAssociationClick?: (association: Association) => void;
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
  focus: () => void;
}

export const LexicalEditor = forwardRef<LexicalEditorRef, LexicalEditorProps>(
  ({ onContentChange, onSave, onAssociationClick, onReady, backgroundColor = '#ffffff', textColor = '#000000', associations = [], autotab = false, spellcheck = true, readOnly = false }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const editorReadyRef = useRef(false);
    const pendingContentRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      setContent: (content: any) => {
        console.log('[Lexical] setContent called, editorReady:', editorReadyRef.current);
        if (editorReadyRef.current && webViewRef.current) {
          const message = JSON.stringify({ type: 'setContent', payload: content });
          console.log('[Lexical] Sending setContent message immediately');
          webViewRef.current.postMessage(message);
        } else {
          console.log('[Lexical] Editor not ready, queuing content');
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
      focus: () => {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'focus' })
        );
      },
    }));

    // Send associations to WebView when they change
    React.useEffect(() => {
      if (editorReadyRef.current && webViewRef.current && associations.length > 0) {
        console.log('[Lexical] Sending associations to WebView:', associations.length);
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'setAssociations', payload: associations })
        );
      }
    }, [associations]);

    // Send autotab setting to WebView when it changes
    React.useEffect(() => {
      if (editorReadyRef.current && webViewRef.current) {
        console.log('[Lexical] Sending autotab setting to WebView:', autotab);
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'setAutotab', payload: autotab })
        );
      }
    }, [autotab]);

    // Send spellcheck setting to WebView when it changes
    React.useEffect(() => {
      if (editorReadyRef.current && webViewRef.current) {
        console.log('[Lexical] Sending spellcheck setting to WebView:', spellcheck);
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'setSpellcheck', payload: spellcheck })
        );
      }
    }, [spellcheck]);

    // Send readOnly setting to WebView when it changes
    React.useEffect(() => {
      if (editorReadyRef.current && webViewRef.current) {
        console.log('[Lexical] Sending readOnly setting to WebView:', readOnly);
        webViewRef.current.postMessage(
          JSON.stringify({ type: 'setReadOnly', payload: readOnly })
        );
      }
    }, [readOnly]);

    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        console.log('[Lexical] Message received:', data.type);

        switch (data.type) {
          case 'log':
            console.log('[WebView]', data.payload.message);
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
          case 'ready':
            console.log('[Lexical] Editor ready');
            editorReadyRef.current = true;
            // Send pending content if any
            if (pendingContentRef.current && webViewRef.current) {
              console.log('[Lexical] Sending pending content');
              const message = JSON.stringify({ type: 'setContent', payload: pendingContentRef.current });
              webViewRef.current.postMessage(message);
              pendingContentRef.current = null;
            }
            // Send associations when editor becomes ready
            if (associations.length > 0 && webViewRef.current) {
              console.log('[Lexical] Sending associations on ready:', associations.length);
              webViewRef.current.postMessage(
                JSON.stringify({ type: 'setAssociations', payload: associations })
              );
            }
            // Send autotab setting when editor becomes ready
            if (webViewRef.current) {
              console.log('[Lexical] Sending autotab setting:', autotab);
              webViewRef.current.postMessage(
                JSON.stringify({ type: 'setAutotab', payload: autotab })
              );
            }
            // Send spellcheck setting when editor becomes ready
            if (webViewRef.current) {
              console.log('[Lexical] Sending spellcheck setting:', spellcheck);
              webViewRef.current.postMessage(
                JSON.stringify({ type: 'setSpellcheck', payload: spellcheck })
              );
            }
            // Send readOnly setting when editor becomes ready
            if (webViewRef.current) {
              console.log('[Lexical] Sending readOnly setting:', readOnly);
              webViewRef.current.postMessage(
                JSON.stringify({ type: 'setReadOnly', payload: readOnly })
              );
            }
            // Notify parent component that editor is ready
            onReady?.();
            break;
          case 'associationClicked':
            console.log('[Lexical] Association clicked:', data.payload);
            onAssociationClick?.(data.payload);
            break;
          case 'error':
            console.error('[Lexical] Error:', data.payload);
            break;
          default:
            console.log('[Lexical] Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('[Lexical] Failed to parse message:', error, event.nativeEvent.data);
      }
    };

    // Inject custom styles into the bundled HTML
    const editorHTML = LEXICAL_HTML.replace(
      '<body>',
      `<body style="background-color: ${backgroundColor}; color: ${textColor};">`
    );

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
