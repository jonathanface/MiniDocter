import {
  LexicalDocument,
  LexicalBlockNode,
  LexicalTextNode,
  LexicalAssociationNode,
} from "./types";
import {
  MobileDocument,
  MobileParagraph,
  TextFormatting,
} from "../types/MobileDocument";

// Lexical format flags (bitmask)
const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

interface TextSegment {
  start: number;
  end: number;
  format: number;
  associationId?: string;
}

function calculateFormatBitmask(formats: TextFormatting[], position: number): number {
  let bitmask = 0;

  for (const fmt of formats) {
    if (position >= fmt.start && position < fmt.end) {
      switch (fmt.type) {
        case 'bold':
          bitmask |= FORMAT_BOLD;
          break;
        case 'italic':
          bitmask |= FORMAT_ITALIC;
          break;
        case 'underline':
          bitmask |= FORMAT_UNDERLINE;
          break;
        case 'strikethrough':
          bitmask |= FORMAT_STRIKETHROUGH;
          break;
        case 'code':
          bitmask |= FORMAT_CODE;
          break;
      }
    }
  }

  return bitmask;
}

function convertParagraph(para: MobileParagraph): LexicalBlockNode {
  const children: (LexicalTextNode | LexicalAssociationNode)[] = [];

  // Build segments map: position -> { format, associationId? }
  const segments: TextSegment[] = [];

  // First, handle associations
  for (const assoc of para.associations) {
    for (const occ of assoc.occurrences) {
      segments.push({
        start: occ.start,
        end: occ.end,
        format: 0,
        associationId: assoc.id,
      });
    }
  }

  // Sort segments by start position
  segments.sort((a, b) => a.start - b.start);

  let currentPos = 0;

  for (const segment of segments) {
    // Add any text before this segment
    if (currentPos < segment.start) {
      const text = para.text.substring(currentPos, segment.start);
      const format = calculateFormatBitmask(para.formatting, currentPos);

      children.push({
        type: "text",
        text,
        format: format || undefined,
        version: 1,
      });
    }

    // Add the association node (associations don't carry text formatting in Lexical)
    const assocData = para.associations.find(a => a.id === segment.associationId);
    if (assocData) {
      children.push({
        type: "association-inline",
        text: para.text.substring(segment.start, segment.end),
        associationId: assocData.id,
        shortDescription: "", // We don't have this in mobile format
        associationType: "", // We don't have this in mobile format
        portrait: "", // We don't have this in mobile format
        version: 1,
      });
    }

    currentPos = segment.end;
  }

  // Add any remaining text
  if (currentPos < para.text.length) {
    const text = para.text.substring(currentPos);
    const format = calculateFormatBitmask(para.formatting, currentPos);

    children.push({
      type: "text",
      text,
      format: format || undefined,
      version: 1,
    });
  }

  // Create the appropriate block node
  if (para.type === 'heading') {
    return {
      type: "heading",
      tag: "h1",
      children,
      version: 1,
    };
  } else if (para.type === 'quote') {
    return {
      type: "quote",
      children,
      version: 1,
    };
  } else {
    return {
      type: "paragraph",
      children,
      version: 1,
    };
  }
}

export function mobileToLexical(mobileDoc: MobileDocument): LexicalDocument {
  const children = mobileDoc.paragraphs.map(convertParagraph);

  return {
    root: {
      type: "root",
      children,
      version: 1,
    },
  };
}
