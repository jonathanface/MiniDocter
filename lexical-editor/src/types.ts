// Type definitions for Lexical Editor

export interface Association {
  association_id: string;
  association_name: string;
  association_type: 'character' | 'place' | 'event' | 'item';
  aliases?: string;
  case_sensitive?: boolean;
}

export interface TextNodeData {
  type: 'text';
  version: number;
  text: string;
  format: number;
  style: string;
  mode: string;
  detail: number;
}

export interface ParagraphChunk {
  children: TextNodeData[];
  direction: string;
  format?: string | number;
  indent?: number;
  type?: string;
  version?: number;
  textFormat?: number;
  textStyle?: string;
  key_id?: string | number;
}

export interface DynamoDBValue<T> {
  Value: T;
}

export interface BackendItem {
  key_id: string | DynamoDBValue<string>;
  chunk: string | ParagraphChunk | DynamoDBValue<string | ParagraphChunk>;
  place: string;
  chapter_id?: string | DynamoDBValue<string>;
  story_id?: string | DynamoDBValue<string>;
  composite_key?: string | DynamoDBValue<string>;
}

export interface BackendData {
  items: BackendItem[];
}

export interface ExportedBlock {
  key_id: string;
  chunk: ParagraphChunk;
  place: string;
  chapter_id?: string;
  story_id?: string;
  composite_key?: string;
}

export interface MessagePayload {
  type: string;
  payload?: unknown;
}

export interface SelectionInfo {
  paragraphKey: string;
  anchorOffset: number;
  focusOffset: number;
  isCollapsed: boolean;
}

export interface SearchPattern {
  regex: RegExp;
  color: string;
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}
