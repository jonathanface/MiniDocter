import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { BridgeExtension } from '@10play/tentap-editor';

// Custom Tiptap Mark for clickable associations
const AssociationMark = Mark.create({
  name: 'association',

  addAttributes() {
    return {
      associationId: {
        default: null,
        parseHTML: element => element.getAttribute('data-association-id'),
        renderHTML: attributes => {
          if (!attributes.associationId) {
            return {};
          }
          return {
            'data-association-id': attributes.associationId,
          };
        },
      },
      associationType: {
        default: null,
        parseHTML: element => element.getAttribute('data-association-type'),
        renderHTML: attributes => {
          if (!attributes.associationType) {
            return {};
          }
          return {
            'data-association-type': attributes.associationType,
          };
        },
      },
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) {
            return {};
          }
          return {
            style: attributes.style,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-association-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'association-mark' }), 0];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('associationClick'),
        props: {
          handleClickOn: (view, pos, node, nodePos, event) => {
            // Check if the click is on an association mark
            const { doc } = view.state;

            // Get marks at the clicked position
            const $pos = doc.resolve(pos);
            const marks = $pos.marks();

            const associationMark = marks.find(mark => mark.type.name === 'association');

            if (associationMark && associationMark.attrs.associationId) {
              // Send message to React Native
              if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
                (window as any).ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'association-click',
                  payload: {
                    associationId: associationMark.attrs.associationId,
                    associationType: associationMark.attrs.associationType,
                  },
                }));
              }
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

type AssociationEditorState = {
  hasAssociations: boolean;
};

type AssociationEditorInstance = {};

// Extend the module types
declare module '@10play/tentap-editor' {
  interface BridgeState extends AssociationEditorState {}
  interface EditorBridge extends AssociationEditorInstance {}
}

export enum AssociationEditorActionType {
  AssociationClick = 'association-click',
}

type AssociationMessage = {
  type: AssociationEditorActionType.AssociationClick;
  payload: {
    associationId: string;
    associationType: string;
  };
};

// Global callback for association clicks
let associationClickCallback: ((associationId: string, associationType: string) => void) | null = null;

export const setAssociationClickHandler = (callback: (associationId: string, associationType: string) => void) => {
  associationClickCallback = callback;
};

// Modify the AssociationMark to call the callback directly
const AssociationMarkWithCallback = Mark.create({
  name: 'association',

  addAttributes() {
    return {
      associationId: {
        default: null,
        parseHTML: element => element.getAttribute('data-association-id'),
        renderHTML: attributes => {
          if (!attributes.associationId) {
            return {};
          }
          return {
            'data-association-id': attributes.associationId,
          };
        },
      },
      associationType: {
        default: null,
        parseHTML: element => element.getAttribute('data-association-type'),
        renderHTML: attributes => {
          if (!attributes.associationType) {
            return {};
          }
          return {
            'data-association-type': attributes.associationType,
          };
        },
      },
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) {
            return {};
          }
          return {
            style: attributes.style,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-association-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'association-mark' }), 0];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('associationClick'),
        props: {
          handleClickOn: (view, pos, node, nodePos, event) => {
            // Check if the click is on an association mark
            const { doc } = view.state;

            // Get marks at the clicked position
            const $pos = doc.resolve(pos);
            const marks = $pos.marks();

            const associationMark = marks.find(mark => mark.type.name === 'association');

            if (associationMark && associationMark.attrs.associationId) {
              // Call the callback if set
              if (associationClickCallback) {
                associationClickCallback(
                  associationMark.attrs.associationId,
                  associationMark.attrs.associationType
                );
              }

              // Also send message to React Native WebView (backup method)
              if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
                (window as any).ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'association-click',
                  payload: {
                    associationId: associationMark.attrs.associationId,
                    associationType: associationMark.attrs.associationType,
                  },
                }));
              }
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

export const AssociationBridge = new BridgeExtension<
  AssociationEditorState,
  AssociationEditorInstance,
  AssociationMessage
>({
  tiptapExtension: AssociationMarkWithCallback,
  onBridgeMessage: (editor, { type, payload }) => {
    // Handle messages from React Native if needed
    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => {
    return {};
  },
  extendEditorState: (editor) => {
    return {
      hasAssociations: editor.isActive('association'),
    };
  },
});
