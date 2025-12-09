/**
 * Lexical JSON structure types
 * Simplified version focusing on what we need for mobile conversion
 */

export interface LexicalTextNode {
  type: "text";
  text: string;
  format?: number;
  version: number;
}

export interface LexicalAssociationNode {
  type: "association-inline";
  text: string;
  associationId: string;
  shortDescription: string;
  associationType: string;
  portrait: string;
  version: number;
}

export interface LexicalParagraphNode {
  type: "paragraph";
  children: (LexicalTextNode | LexicalAssociationNode)[];
  format?: string;
  indent?: number;
  version: number;
}

export interface LexicalHeadingNode {
  type: "heading";
  tag: string;
  children: (LexicalTextNode | LexicalAssociationNode)[];
  version: number;
}

export interface LexicalQuoteNode {
  type: "quote";
  children: (LexicalTextNode | LexicalAssociationNode)[];
  version: number;
}

export type LexicalBlockNode =
  | LexicalParagraphNode
  | LexicalHeadingNode
  | LexicalQuoteNode;

export interface LexicalRootNode {
  type: "root";
  children: LexicalBlockNode[];
  version: number;
}

export interface LexicalDocument {
  root: LexicalRootNode;
}
