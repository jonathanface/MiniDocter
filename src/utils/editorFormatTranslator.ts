/**
 * Translator between Lexical JSON format and Tiptap JSON format
 *
 * Lexical format: uses bit flags for text formatting (bold=1, italic=2, strikethrough=4, underline=8)
 * Tiptap format: uses marks array with type objects
 */

// Lexical types
export interface LexicalTextNode {
  text: string;
  type: 'text';
  format?: number;
  style?: string;
  [key: string]: any;
}

export interface LexicalParagraph {
  type: string;
  key_id: string;
  children: LexicalTextNode[];
  direction?: string;
  format?: string; // alignment: "left", "center", "right", "justify"
  indent?: number;
  version?: number;
  [key: string]: any;
}

// Tiptap types
export interface TiptapMark {
  type: 'bold' | 'italic' | 'strike' | 'underline';
  attrs?: Record<string, any>;
}

export interface TiptapTextNode {
  type: 'text';
  text: string;
  marks?: TiptapMark[];
}

export interface TiptapParagraph {
  type: 'paragraph';
  attrs?: {
    textAlign?: string;
    [key: string]: any;
  };
  content?: TiptapTextNode[];
}

export interface TiptapDocument {
  type: 'doc';
  content: TiptapParagraph[];
}

// Format bit flags for Lexical
const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;

/**
 * Convert Lexical text node format (bit flags) to Tiptap marks
 */
function lexicalFormatToTiptapMarks(format?: number): TiptapMark[] {
  if (!format) return [];

  const marks: TiptapMark[] = [];

  if (format & FORMAT_BOLD) {
    marks.push({ type: 'bold' });
  }
  if (format & FORMAT_ITALIC) {
    marks.push({ type: 'italic' });
  }
  if (format & FORMAT_STRIKETHROUGH) {
    marks.push({ type: 'strike' });
  }
  if (format & FORMAT_UNDERLINE) {
    marks.push({ type: 'underline' });
  }

  return marks;
}

/**
 * Convert Tiptap marks to Lexical format (bit flags)
 */
function tiptapMarksToLexicalFormat(marks?: TiptapMark[]): number {
  if (!marks || marks.length === 0) return 0;

  let format = 0;

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        format |= FORMAT_BOLD;
        break;
      case 'italic':
        format |= FORMAT_ITALIC;
        break;
      case 'strike':
        format |= FORMAT_STRIKETHROUGH;
        break;
      case 'underline':
        format |= FORMAT_UNDERLINE;
        break;
    }
  }

  return format;
}

/**
 * Convert Lexical paragraph to Tiptap paragraph
 */
export function lexicalToTiptapParagraph(lexicalPara: LexicalParagraph): TiptapParagraph {
  const content: TiptapTextNode[] = lexicalPara.children.map((child) => {
    const marks = lexicalFormatToTiptapMarks(child.format);
    const node: TiptapTextNode = {
      type: 'text',
      text: child.text || '',  // Ensure text is always a string, not undefined
    };
    if (marks.length > 0) {
      node.marks = marks;
    }
    return node;
  });

  const tiptapPara: TiptapParagraph = {
    type: 'paragraph',
  };

  // Always include content, even if empty - TenTap requires it
  if (content.length > 0) {
    tiptapPara.content = content;
  } else {
    // Empty paragraph needs at least one empty text node
    tiptapPara.content = [{ type: 'text', text: '' }];
  }

  if (lexicalPara.format && lexicalPara.format !== 'left') {
    tiptapPara.attrs = {
      textAlign: lexicalPara.format,
    };
  }

  return tiptapPara;
}

/**
 * Convert array of Lexical paragraphs to Tiptap document
 */
export function lexicalToTiptapDocument(paragraphs: LexicalParagraph[]): TiptapDocument {
  return {
    type: 'doc',
    content: paragraphs.map(lexicalToTiptapParagraph),
  };
}

/**
 * Convert single Lexical paragraph to Tiptap JSON string
 */
export function lexicalToTiptapJSON(paragraph: LexicalParagraph): string {
  const tiptapDoc = lexicalToTiptapDocument([paragraph]);
  return JSON.stringify(tiptapDoc);
}

/**
 * Convert Tiptap paragraph to Lexical paragraph
 */
export function tiptapToLexicalParagraph(
  tiptapPara: TiptapParagraph,
  key_id: string
): LexicalParagraph {
  const children: LexicalTextNode[] = (tiptapPara.content || []).map((node) => {
    const format = tiptapMarksToLexicalFormat(node.marks);
    return {
      text: node.text || '',  // Ensure text is always a string
      type: 'text',
      format: format || undefined,
    };
  });

  // Handle empty paragraphs
  if (children.length === 0) {
    children.push({
      text: '',
      type: 'text',
    });
  }

  return {
    type: 'paragraph',
    key_id,
    children,
    format: tiptapPara.attrs?.textAlign || 'left',
    indent: 0,
  };
}

/**
 * Convert Tiptap document to array of Lexical paragraphs
 */
export function tiptapDocumentToLexical(
  doc: TiptapDocument,
  startingKeyId: string = '1'
): LexicalParagraph[] {
  return doc.content.map((para, index) => {
    const key_id = `${startingKeyId}_${index}`;
    return tiptapToLexicalParagraph(para, key_id);
  });
}

/**
 * Convert Tiptap JSON string to array of Lexical paragraphs
 */
export function tiptapJSONToLexical(
  json: string,
  startingKeyId: string = '1'
): LexicalParagraph[] {
  const doc = JSON.parse(json) as TiptapDocument;
  return tiptapDocumentToLexical(doc, startingKeyId);
}
