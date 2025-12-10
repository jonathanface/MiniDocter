/**
 * Mobile-friendly document format
 * Converted from/to Lexical JSON for use in mobile apps
 */

export interface AssociationOccurrence {
  start: number;
  end: number;
}

export interface MobileAssociation {
  id: string;
  text: string;
  occurrences: AssociationOccurrence[];
}

export interface TextFormatting {
  start: number;
  end: number;
  type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code';
}

export interface MobileParagraph {
  text: string;
  formatting: TextFormatting[];
  associations: MobileAssociation[];
  type?: 'paragraph' | 'heading' | 'quote';
}

export interface MobileDocument {
  paragraphs: MobileParagraph[];
}
