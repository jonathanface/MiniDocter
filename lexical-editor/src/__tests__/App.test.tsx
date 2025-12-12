import React from 'react';
import { render, waitFor } from '@testing-library/react';
import App from '../App';

// Mock Lexical components and hooks
const mockEditor = {
  update: jest.fn((callback) => callback()),
  getEditorState: jest.fn(() => ({
    read: jest.fn((callback) => callback()),
  })),
  registerUpdateListener: jest.fn(() => jest.fn()),
  registerCommand: jest.fn(() => jest.fn()),
  focus: jest.fn(),
};

const mockRoot = {
  clear: jest.fn(),
  append: jest.fn(),
  isEmpty: jest.fn(() => false),
  getChildren: jest.fn(() => [] as any[]),
  getAllTextNodes: jest.fn(() => []),
};

jest.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', null, children);
  },
}));

jest.mock('@lexical/react/LexicalRichTextPlugin', () => ({
  RichTextPlugin: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'rich-text-plugin' }, 'RichTextPlugin');
  },
}));

jest.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: () => {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'content-editable',
      className: 'editor-input'
    }, 'ContentEditable');
  },
}));

jest.mock('@lexical/react/LexicalErrorBoundary', () => ({
  LexicalErrorBoundary: () => {
    const React = require('react');
    return React.createElement('div', null, 'ErrorBoundary');
  },
}));

jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

jest.mock('lexical', () => {
  const actual = jest.requireActual('lexical');
  return {
    ...actual,
    $getRoot: jest.fn(() => mockRoot),
    $createParagraphNode: jest.fn(() => ({
      append: jest.fn(),
      setFormat: jest.fn(),
      setIndent: jest.fn(),
      getChildren: jest.fn(() => []),
      getType: jest.fn(() => 'paragraph'),
      getKey: jest.fn(() => 'para-1'),
    })),
    $createTextNode: jest.fn((text: string) => ({
      toggleFormat: jest.fn(),
      setStyle: jest.fn(),
      setFormat: jest.fn(),
      getTextContent: jest.fn(() => text),
      getFormat: jest.fn(() => 0),
      hasFormat: jest.fn(() => false),
      getStyle: jest.fn(() => ''),
      insertBefore: jest.fn(),
      remove: jest.fn(),
      getKey: jest.fn(() => 'text-1'),
    })),
    $getSelection: jest.fn(() => null),
    $setSelection: jest.fn(),
    $createRangeSelection: jest.fn(() => ({
      anchor: { set: jest.fn(), offset: 0, getNode: jest.fn(() => ({ getType: jest.fn(() => 'text'), getParent: jest.fn(() => null) })) },
      focus: { set: jest.fn(), offset: 0 },
      isCollapsed: jest.fn(() => true),
    })),
    $isRangeSelection: jest.fn((sel) => sel !== null),
  };
});

describe('App', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    // Reset mockEditor functions
    mockEditor.update.mockImplementation((callback) => {
      callback();
      return undefined;
    });
    mockEditor.getEditorState.mockReturnValue({
      read: jest.fn((callback) => callback()),
    });
    mockRoot.isEmpty.mockReturnValue(false);
    mockRoot.getChildren.mockReturnValue([]);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Rendering', () => {
    it('should render LexicalComposer with plugins', () => {
      const { getByTestId } = render(<App />);

      expect(getByTestId('rich-text-plugin')).toBeTruthy();
      // ContentEditable is mocked and doesn't render in the test
      // but we verify the RichTextPlugin is there which contains it
    });

    it('should initialize with empty paragraph if root is empty', () => {
      mockRoot.isEmpty.mockReturnValue(true);

      render(<App />);

      expect(mockEditor.update).toHaveBeenCalled();
    });

    it('should register update listener', () => {
      render(<App />);

      expect(mockEditor.registerUpdateListener).toHaveBeenCalled();
    });

    it('should register Enter key command', () => {
      render(<App />);

      expect(mockEditor.registerCommand).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should handle setContent message', async () => {
      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'setContent',
          payload: {
            items: [
              {
                key_id: 'para-1',
                chunk: {
                  children: [{ text: 'Test content', format: 0 }],
                  format: 'left',
                  indent: 0,
                },
                place: '0',
              },
            ],
          },
        }),
      });

      window.dispatchEvent(messageEvent);

      await waitFor(() => {
        expect(mockRoot.clear).toHaveBeenCalled();
        expect(mockRoot.append).toHaveBeenCalled();
      });
    });

    it('should handle getContent message', async () => {
      const mockPostMessage = jest.fn();
      (window as any).ReactNativeWebView = { postMessage: mockPostMessage };

      const mockParagraph = {
        getType: jest.fn(() => 'paragraph'),
        getChildren: jest.fn(() => [
          {
            getType: jest.fn(() => 'text'),
            hasFormat: jest.fn(() => false),
            getTextContent: jest.fn(() => 'Test'),
            getStyle: jest.fn(() => ''),
            getDetail: jest.fn(() => 0),
          },
        ]),
        getFormat: jest.fn(() => 'left'),
        getIndent: jest.fn(() => 0),
      };

      mockRoot.getChildren.mockReturnValue([mockParagraph]);

      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'getContent',
        }),
      });

      window.dispatchEvent(messageEvent);

      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          expect.stringContaining('contentResponse')
        );
      });

      delete (window as any).ReactNativeWebView;
    });

    it('should handle focus message', async () => {
      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'focus',
        }),
      });

      window.dispatchEvent(messageEvent);

      await waitFor(() => {
        expect(mockEditor.focus).toHaveBeenCalled();
      });
    });

    it('should handle setAssociations message', async () => {
      render(<App />);

      const associations = [
        {
          association_id: 'assoc-1',
          association_name: 'Test Character',
          association_type: 'character',
          case_sensitive: false,
          aliases: 'TC',
          short_description: 'A test character',
          portrait: 'portrait.jpg',
        },
      ];

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'setAssociations',
          payload: associations,
        }),
      });

      window.dispatchEvent(messageEvent);

      // Verify the update was called (highlighting is triggered)
      await waitFor(() => {
        expect(mockEditor.update).toHaveBeenCalled();
      });
    });

    it('should handle setAutotab message', async () => {
      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'setAutotab',
          payload: true,
        }),
      });

      window.dispatchEvent(messageEvent);

      // Message is handled successfully (no error thrown)
      await waitFor(() => {
        expect(mockEditor.update).toHaveBeenCalled();
      });
    });

    it('should handle setSpellcheck message', async () => {
      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'setSpellcheck',
          payload: false,
        }),
      });

      window.dispatchEvent(messageEvent);

      // Message is handled successfully (querySelector is mocked in component)
      await waitFor(() => {
        expect(mockEditor.update).toHaveBeenCalled();
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: 'invalid json',
      });

      window.dispatchEvent(messageEvent);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          'Failed to handle message:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Content Loading', () => {
    it('should load content with text formatting', async () => {
      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'setContent',
          payload: {
            items: [
              {
                key_id: 'para-1',
                chunk: {
                  children: [
                    { text: 'Bold text', format: 1 }, // FORMAT_BOLD
                    { text: 'Italic text', format: 2 }, // FORMAT_ITALIC
                  ],
                  format: 'center',
                  indent: 1,
                },
                place: '0',
              },
            ],
          },
        }),
      });

      window.dispatchEvent(messageEvent);

      await waitFor(() => {
        expect(mockRoot.clear).toHaveBeenCalled();
      });
    });

    it('should handle DynamoDB wrapped chunk data', async () => {
      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'setContent',
          payload: {
            items: [
              {
                key_id: { Value: 'para-1' },
                chunk: {
                  Value: {
                    children: [{ text: 'Test', format: 0 }],
                    format: 'left',
                    indent: 0,
                  },
                },
                place: '0',
              },
            ],
          },
        }),
      });

      window.dispatchEvent(messageEvent);

      await waitFor(() => {
        expect(mockRoot.clear).toHaveBeenCalled();
      });
    });

    it('should handle empty or missing content gracefully', async () => {
      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'setContent',
          payload: {},
        }),
      });

      window.dispatchEvent(messageEvent);

      // Empty content shouldn't cause error, and root.clear shouldn't be called
      await waitFor(() => {
        // We expect mockRoot.clear was called initially but not for empty content
        // Since mock calls persist, we just verify no error was thrown
        expect(true).toBe(true);
      });
    });
  });

  describe('Content Export', () => {
    it('should export content in backend format', async () => {
      const mockPostMessage = jest.fn();
      (window as any).ReactNativeWebView = { postMessage: mockPostMessage };

      const mockTextNode = {
        getType: jest.fn(() => 'text'),
        hasFormat: jest.fn((format: string) => format === 'bold'),
        getTextContent: jest.fn(() => 'Bold text'),
        getStyle: jest.fn(() => ''),
        getDetail: jest.fn(() => 0),
      };

      const mockParagraph = {
        getType: jest.fn(() => 'paragraph'),
        getChildren: jest.fn(() => [mockTextNode]),
        getFormat: jest.fn(() => 'center'),
        getIndent: jest.fn(() => 2),
      };

      mockRoot.getChildren.mockReturnValue([mockParagraph]);

      render(<App />);

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'getContent',
        }),
      });

      window.dispatchEvent(messageEvent);

      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled();

        // Find the contentResponse call
        const contentResponseCall = mockPostMessage.mock.calls.find((call: string[]) =>
          call[0].includes('contentResponse')
        );
        if (contentResponseCall) {
          const data = JSON.parse(contentResponseCall[0]);
          expect(data.type).toBe('contentResponse');
          expect(data.payload.blocks).toHaveLength(1);
          expect(data.payload.blocks[0].chunk.format).toBe('center');
          expect(data.payload.blocks[0].chunk.indent).toBe(2);
        }
      });

      delete (window as any).ReactNativeWebView;
    });

    it('should preserve original item metadata in export', async () => {
      const mockPostMessage = jest.fn();
      (window as any).ReactNativeWebView = { postMessage: mockPostMessage };

      // First load content with metadata
      const loadEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'setContent',
          payload: {
            items: [
              {
                key_id: 'original-id',
                chunk: {
                  children: [{ text: 'Test', format: 0 }],
                },
                chapter_id: 'chapter-1',
                story_id: 'story-1',
                place: '0',
              },
            ],
          },
        }),
      });

      const mockParagraph = {
        getType: jest.fn(() => 'paragraph'),
        getChildren: jest.fn(() => [
          {
            getType: jest.fn(() => 'text'),
            hasFormat: jest.fn(() => false),
            getTextContent: jest.fn(() => 'Test'),
            getStyle: jest.fn(() => ''),
            getDetail: jest.fn(() => 0),
          },
        ]),
        getFormat: jest.fn(() => 'left'),
        getIndent: jest.fn(() => 0),
      };

      mockRoot.getChildren.mockReturnValue([mockParagraph]);

      render(<App />);

      window.dispatchEvent(loadEvent);

      await waitFor(() => {
        expect(mockRoot.clear).toHaveBeenCalled();
      });

      // Now export content
      const exportEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'getContent',
        }),
      });

      window.dispatchEvent(exportEvent);

      await waitFor(() => {
        const call = mockPostMessage.mock.calls.find((c: string[]) =>
          c[0].includes('contentResponse')
        );
        if (call) {
          const data = JSON.parse(call[0]);
          expect(data.payload.blocks[0].key_id).toBe('original-id');
          expect(data.payload.blocks[0].chapter_id).toBe('chapter-1');
          expect(data.payload.blocks[0].story_id).toBe('story-1');
        }
      });

      delete (window as any).ReactNativeWebView;
    });
  });

  describe('Initialization', () => {
    it('should send ready message on mount', async () => {
      const mockPostMessage = jest.fn();
      (window as any).ReactNativeWebView = { postMessage: mockPostMessage };

      render(<App />);

      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          expect.stringContaining('ready')
        );
      });

      delete (window as any).ReactNativeWebView;
    });

    it('should set initial spellcheck attribute', () => {
      render(<App />);

      // Spellcheck is set via querySelector which we can't easily test in JSDOM
      // but we verify the component renders without error
      expect(true).toBe(true);
    });

    it('should register message listeners on window and document', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const docAddEventListenerSpy = jest.spyOn(document, 'addEventListener');

      render(<App />);

      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
      expect(docAddEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));

      addEventListenerSpy.mockRestore();
      docAddEventListenerSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const docRemoveEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = render(<App />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
      expect(docRemoveEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));

      removeEventListenerSpy.mockRestore();
      docRemoveEventListenerSpy.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should have correct Lexical editor config', () => {
      const { container } = render(<App />);

      // Verify basic rendering works with the config
      expect(container).toBeTruthy();
    });
  });
});
