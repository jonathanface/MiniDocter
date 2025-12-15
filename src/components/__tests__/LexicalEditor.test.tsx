import React, { createRef } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { LexicalEditor, LexicalEditorRef } from '../LexicalEditor';
import { WebView } from 'react-native-webview';

// Mock WebView
jest.mock('react-native-webview', () => ({
  WebView: jest.fn((props: any) => {
    const React = require('react');
    const { View } = require('react-native');

    // Store ref for testing
    if (props.ref) {
      React.useEffect(() => {
        if (typeof props.ref === 'function') {
          props.ref({ postMessage: jest.fn() });
        } else if (props.ref && 'current' in props.ref) {
          props.ref.current = { postMessage: jest.fn() };
        }
      }, []);
    }

    return React.createElement(View, { testID: 'webview-mock' });
  }),
}));

describe('LexicalEditor', () => {
  const mockAssociations = [
    {
      association_id: 'assoc-1',
      association_name: 'Test Character',
      association_type: 'character',
      case_sensitive: false,
      aliases: 'TC',
      short_description: 'A test character',
      portrait: 'https://example.com/portrait.jpg',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render WebView component', () => {
      const { getByTestId } = render(<LexicalEditor />);
      expect(getByTestId('webview-mock')).toBeTruthy();
    });

    it('should apply custom background and text colors', () => {
      const { UNSAFE_getByType } = render(
        <LexicalEditor backgroundColor="#000000" textColor="#ffffff" />
      );

      const webView = UNSAFE_getByType(WebView as any);
      expect(webView).toBeTruthy();
      expect(webView.props.source.html).toContain('background-color: #000000');
      expect(webView.props.source.html).toContain('color: #ffffff');
    });

    it('should use default colors when not provided', () => {
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);
      expect(webView.props.source.html).toContain('background-color: #ffffff');
      expect(webView.props.source.html).toContain('color: #000000');
    });

    it('should enable JavaScript and DOM storage', () => {
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);
      expect(webView.props.javaScriptEnabled).toBe(true);
      expect(webView.props.domStorageEnabled).toBe(true);
    });
  });

  describe('Ref Methods', () => {
    it('should expose setContent method', () => {
      const ref = createRef<LexicalEditorRef>();
      render(<LexicalEditor ref={ref} />);

      expect(ref.current).toBeTruthy();
      expect(typeof ref.current?.setContent).toBe('function');
    });

    it('should expose getContent method', () => {
      const ref = createRef<LexicalEditorRef>();
      render(<LexicalEditor ref={ref} />);

      expect(ref.current).toBeTruthy();
      expect(typeof ref.current?.getContent).toBe('function');
    });

    it('should expose focus method', () => {
      const ref = createRef<LexicalEditorRef>();
      render(<LexicalEditor ref={ref} />);

      expect(ref.current).toBeTruthy();
      expect(typeof ref.current?.focus).toBe('function');
    });
  });

  describe('setContent', () => {
    it('should queue content when editor is not ready', () => {
      const ref = createRef<LexicalEditorRef>();
      const consoleLog = jest.spyOn(console, 'log');

      render(<LexicalEditor ref={ref} />);

      const content = { items: [{ key_id: '1', chunk: {} }] };
      ref.current?.setContent(content);

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] setContent called, editorReady:',
        false
      );
      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Editor not ready, queuing content'
      );
    });

    it('should send content immediately when editor is ready', async () => {
      const ref = createRef<LexicalEditorRef>();
      const consoleLog = jest.spyOn(console, 'log');

      const { UNSAFE_getByType } = render(<LexicalEditor ref={ref} />);

      // Simulate editor ready
      const webView = UNSAFE_getByType(WebView as any);
      const mockPostMessage = jest.fn();

      // Trigger ready message
      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      // Mock postMessage after ready
      if (webView.props.ref && 'current' in webView.props.ref) {
        webView.props.ref.current = { postMessage: mockPostMessage };
      }

      const content = { items: [{ key_id: '1', chunk: {} }] };
      ref.current?.setContent(content);

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] setContent called, editorReady:',
        true
      );
    });
  });

  describe('Message Handling', () => {
    it('should handle ready message', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith('[Lexical] Message received:', 'ready');
      expect(consoleLog).toHaveBeenCalledWith('[Lexical] Editor ready');
    });

    it('should handle contentChanged message', async () => {
      const onContentChange = jest.fn();
      const { UNSAFE_getByType } = render(
        <LexicalEditor onContentChange={onContentChange} />
      );

      const webView = UNSAFE_getByType(WebView as any);
      const payload = { items: [] };

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'contentChanged', payload }),
          },
        });
      });

      expect(onContentChange).toHaveBeenCalledWith(payload);
    });

    it('should handle save message', async () => {
      const onSave = jest.fn();
      const { UNSAFE_getByType } = render(<LexicalEditor onSave={onSave} />);

      const webView = UNSAFE_getByType(WebView as any);
      const payload = { items: [] };

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'save', payload }),
          },
        });
      });

      expect(onSave).toHaveBeenCalledWith(payload);
    });

    it('should handle log message', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({
              type: 'log',
              payload: { message: 'Test log' },
            }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith('[WebView]', 'Test log');
    });

    it('should handle error message', async () => {
      const consoleError = jest.spyOn(console, 'error');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({
              type: 'error',
              payload: 'Test error',
            }),
          },
        });
      });

      expect(consoleError).toHaveBeenCalledWith('[Lexical] Error:', 'Test error');
    });

    it('should handle contentResponse message', async () => {
      // Mock window object for this test
      (global as any).window = {};

      const ref = createRef<LexicalEditorRef>();
      const { UNSAFE_getByType } = render(<LexicalEditor ref={ref} />);

      const webView = UNSAFE_getByType(WebView as any);

      // Call getContent which sets up resolver
      const contentPromise = ref.current?.getContent();

      const payload = { items: [{ key_id: '1' }] };

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'contentResponse', payload }),
          },
        });
      });

      const result = await contentPromise;
      expect(result).toEqual(payload);

      // Clean up
      delete (global as any).window;
    });

    it('should handle unknown message type', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'unknown' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Unknown message type:',
        'unknown'
      );
    });

    it('should handle malformed JSON', async () => {
      const consoleError = jest.spyOn(console, 'error');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: 'invalid json',
          },
        });
      });

      expect(consoleError).toHaveBeenCalledWith(
        '[Lexical] Failed to parse message:',
        expect.any(Error),
        'invalid json'
      );
    });
  });

  describe('Associations', () => {
    it('should not send associations when editor is not ready', () => {
      const consoleLog = jest.spyOn(console, 'log');
      render(<LexicalEditor associations={mockAssociations} />);

      // Should not log sending associations
      expect(consoleLog).not.toHaveBeenCalledWith(
        '[Lexical] Sending associations to WebView:',
        expect.any(Number)
      );
    });

    it('should send associations when editor becomes ready', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(
        <LexicalEditor associations={mockAssociations} />
      );

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Sending associations on ready:',
        1
      );
    });

    it('should send associations when they change', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType, rerender } = render(
        <LexicalEditor associations={[]} />
      );

      const webView = UNSAFE_getByType(WebView as any);

      // Make editor ready
      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      // Update associations
      rerender(<LexicalEditor associations={mockAssociations} />);

      await waitFor(() => {
        expect(consoleLog).toHaveBeenCalledWith(
          '[Lexical] Sending associations to WebView:',
          1
        );
      });
    });

    it('should not send empty associations array', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor associations={[]} />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      // Should not send associations when array is empty
      expect(consoleLog).not.toHaveBeenCalledWith(
        '[Lexical] Sending associations to WebView:',
        0
      );
    });
  });

  describe('Autotab Setting', () => {
    it('should send autotab setting when editor becomes ready', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor autotab={true} />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Sending autotab setting:',
        true
      );
    });

    it('should send autotab setting when it changes', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType, rerender } = render(
        <LexicalEditor autotab={false} />
      );

      const webView = UNSAFE_getByType(WebView as any);

      // Make editor ready
      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      // Update autotab
      rerender(<LexicalEditor autotab={true} />);

      await waitFor(() => {
        expect(consoleLog).toHaveBeenCalledWith(
          '[Lexical] Sending autotab setting to WebView:',
          true
        );
      });
    });

    it('should use default autotab value of false', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Sending autotab setting:',
        false
      );
    });
  });

  describe('ReadOnly Setting', () => {
    it('should send readOnly setting when editor becomes ready', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor readOnly={true} />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Sending readOnly setting:',
        true
      );
    });

    it('should send readOnly setting when it changes', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType, rerender } = render(
        <LexicalEditor readOnly={false} />
      );

      const webView = UNSAFE_getByType(WebView as any);

      // Make editor ready
      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      // Update readOnly
      rerender(<LexicalEditor readOnly={true} />);

      await waitFor(() => {
        expect(consoleLog).toHaveBeenCalledWith(
          '[Lexical] Sending readOnly setting to WebView:',
          true
        );
      });
    });

    it('should use default readOnly value of false', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Sending readOnly setting:',
        false
      );
    });
  });

  describe('onReady Callback', () => {
    it('should call onReady when editor becomes ready', async () => {
      const onReady = jest.fn();
      const { UNSAFE_getByType } = render(<LexicalEditor onReady={onReady} />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('should not call onReady if not provided', async () => {
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      // Should not throw error when onReady is not provided
      expect(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      }).not.toThrow();
    });
  });

  describe('Association Click', () => {
    it('should call onAssociationClick when association is clicked', async () => {
      const onAssociationClick = jest.fn();
      const { UNSAFE_getByType } = render(
        <LexicalEditor onAssociationClick={onAssociationClick} />
      );

      const webView = UNSAFE_getByType(WebView as any);
      const clickedAssociation = {
        association_id: 'assoc-1',
        association_name: 'Test',
        association_type: 'character',
      };

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({
              type: 'associationClicked',
              payload: clickedAssociation,
            }),
          },
        });
      });

      expect(onAssociationClick).toHaveBeenCalledWith(clickedAssociation);
    });

    it('should not throw if onAssociationClick is not provided', async () => {
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      expect(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({
              type: 'associationClicked',
              payload: { association_id: 'test' },
            }),
          },
        });
      }).not.toThrow();
    });
  });

  describe('Spellcheck Setting', () => {
    it('should send spellcheck setting when editor becomes ready', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor spellcheck={false} />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Sending spellcheck setting:',
        false
      );
    });

    it('should send spellcheck setting when it changes', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType, rerender } = render(
        <LexicalEditor spellcheck={true} />
      );

      const webView = UNSAFE_getByType(WebView as any);

      // Make editor ready
      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      // Update spellcheck
      rerender(<LexicalEditor spellcheck={false} />);

      await waitFor(() => {
        expect(consoleLog).toHaveBeenCalledWith(
          '[Lexical] Sending spellcheck setting to WebView:',
          false
        );
      });
    });

    it('should use default spellcheck value of true', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Sending spellcheck setting:',
        true
      );
    });
  });

  describe('Pending Content', () => {
    it('should send pending content when editor becomes ready', async () => {
      const consoleLog = jest.spyOn(console, 'log');
      const ref = createRef<LexicalEditorRef>();
      const { UNSAFE_getByType } = render(<LexicalEditor ref={ref} />);

      const webView = UNSAFE_getByType(WebView as any);

      // Set content before editor is ready
      const content = { items: [{ key_id: '1' }] };
      ref.current?.setContent(content);

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Editor not ready, queuing content'
      );

      // Trigger ready
      await waitFor(() => {
        webView.props.onMessage({
          nativeEvent: {
            data: JSON.stringify({ type: 'ready' }),
          },
        });
      });

      expect(consoleLog).toHaveBeenCalledWith(
        '[Lexical] Sending pending content'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle WebView error event', () => {
      const consoleError = jest.spyOn(console, 'error');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      webView.props.onError({
        nativeEvent: { description: 'Test error' },
      });

      expect(consoleError).toHaveBeenCalledWith(
        '[WebView] Error:',
        expect.objectContaining({ description: 'Test error' })
      );
    });

    it('should handle WebView HTTP error event', () => {
      const consoleError = jest.spyOn(console, 'error');
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);

      webView.props.onHttpError({
        nativeEvent: { statusCode: 404 },
      });

      expect(consoleError).toHaveBeenCalledWith(
        '[WebView] HTTP Error:',
        expect.objectContaining({ statusCode: 404 })
      );
    });
  });

  describe('Props', () => {
    it('should handle all props being undefined', () => {
      const { UNSAFE_getByType } = render(<LexicalEditor />);

      const webView = UNSAFE_getByType(WebView as any);
      expect(webView).toBeTruthy();
    });

    it('should accept all optional props', () => {
      const props = {
        onContentChange: jest.fn(),
        onSave: jest.fn(),
        backgroundColor: '#123456',
        textColor: '#abcdef',
        associations: mockAssociations,
        autotab: true,
        spellcheck: false,
      };

      const { UNSAFE_getByType } = render(<LexicalEditor {...props} />);

      const webView = UNSAFE_getByType(WebView as any);
      expect(webView).toBeTruthy();
    });
  });
});
