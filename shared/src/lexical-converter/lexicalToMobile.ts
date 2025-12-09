import {
  LexicalDocument,
  LexicalBlockNode,
  LexicalTextNode,
  LexicalAssociationNode,
} from "./types";
import {
  MobileDocument,
  MobileParagraph,
  MobileAssociation,
  AssociationOccurrence,
  TextFormatting,
} from "../types/MobileDocument";

// Lexical format flags (bitmask)
const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_UNDERLINE = 8;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_CODE = 16;

function parseTextFormat(format?: number): Array<'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'> {
  if (!format) return [];
  const formats: Array<'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'> = [];

  if (format & FORMAT_BOLD) formats.push('bold');
  if (format & FORMAT_ITALIC) formats.push('italic');
  if (format & FORMAT_UNDERLINE) formats.push('underline');
  if (format & FORMAT_STRIKETHROUGH) formats.push('strikethrough');
  if (format & FORMAT_CODE) formats.push('code');

  return formats;
}

function convertBlock(block: LexicalBlockNode): MobileParagraph {
  let text = "";
  const formatting: TextFormatting[] = [];
  const associationMap = new Map<string, MobileAssociation>();

  // Process all children to build text content
  for (const child of block.children) {
    const startPos = text.length;

    if (child.type === "text") {
      text += child.text;

      // Add formatting if present
      const formats = parseTextFormat(child.format);
      for (const formatType of formats) {
        formatting.push({
          start: startPos,
          end: text.length,
          type: formatType,
        });
      }
    } else if (child.type === "association-inline") {
      text += child.text;

      // Track association occurrence
      const occurrence: AssociationOccurrence = {
        start: startPos,
        end: text.length,
      };

      if (!associationMap.has(child.associationId)) {
        associationMap.set(child.associationId, {
          id: child.associationId,
          text: child.text,
          occurrences: [occurrence],
        });
      } else {
        associationMap.get(child.associationId)!.occurrences.push(occurrence);
      }
    }
  }

  // Determine paragraph type
  let type: 'paragraph' | 'heading' | 'quote' = 'paragraph';
  if (block.type === 'heading') type = 'heading';
  if (block.type === 'quote') type = 'quote';

  return {
    text,
    formatting,
    associations: Array.from(associationMap.values()),
    type,
  };
}

export function lexicalToMobile(lexicalDoc: LexicalDocument): MobileDocument {
  const paragraphs = lexicalDoc.root.children.map(convertBlock);

  return {
    paragraphs,
  };
}
