import { BridgeExtension } from '@10play/tentap-editor';
import TextAlign from '@tiptap/extension-text-align';

// Define the alignment state we want to expose
type TextAlignEditorState = {
  currentAlignment: string | null;
};

// Define the methods we want on the editor instance
type TextAlignEditorInstance = {
  setTextAlign: (alignment: 'left' | 'center' | 'right' | 'justify') => void;
  unsetTextAlign: () => void;
};

// Extend the module types to include our custom properties
declare module '@10play/tentap-editor' {
  interface BridgeState extends TextAlignEditorState {}
  interface EditorBridge extends TextAlignEditorInstance {}
}

// Define message types for actions
export enum TextAlignActionType {
  SetAlign = 'set-text-align',
  UnsetAlign = 'unset-text-align',
}

type TextAlignMessage =
  | {
      type: TextAlignActionType.SetAlign;
      payload: 'left' | 'center' | 'right' | 'justify';
    }
  | {
      type: TextAlignActionType.UnsetAlign;
      payload?: undefined;
    };

// Create the bridge
export const TextAlignBridge = new BridgeExtension<
  TextAlignEditorState,
  TextAlignEditorInstance,
  TextAlignMessage
>({
  tiptapExtension: TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right', 'justify'],
    defaultAlignment: 'left',
  }),
  onBridgeMessage: (editor, message) => {
    if (message.type === TextAlignActionType.SetAlign) {
      editor.chain().focus().setTextAlign(message.payload).run();
    } else if (message.type === TextAlignActionType.UnsetAlign) {
      editor.chain().focus().unsetTextAlign().run();
    }
    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => ({
    setTextAlign: (alignment) =>
      sendBridgeMessage({
        type: TextAlignActionType.SetAlign,
        payload: alignment,
      }),
    unsetTextAlign: () =>
      sendBridgeMessage({ type: TextAlignActionType.UnsetAlign }),
  }),
  extendEditorState: (editor) => {
    // Determine current alignment by checking paragraph attributes
    const { textAlign } = editor.getAttributes('paragraph');
    return {
      currentAlignment: textAlign || 'left',
    };
  },
});
