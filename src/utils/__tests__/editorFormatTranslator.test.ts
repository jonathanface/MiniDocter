import {
  lexicalToTiptapParagraph,
  lexicalToTiptapDocument,
  lexicalToTiptapJSON,
  tiptapToLexicalParagraph,
  tiptapDocumentToLexical,
  tiptapJSONToLexical,
  LexicalParagraph,
  LexicalTextNode,
  TiptapParagraph,
  TiptapDocument,
  TiptapMark,
} from '../editorFormatTranslator';

describe('editorFormatTranslator', () => {
  describe('lexicalToTiptapParagraph', () => {
    it('should convert plain text paragraph', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'Hello world', type: 'text' },
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result).toEqual({
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello world' },
        ],
      });
    });

    it('should convert bold text (format=1)', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'Bold text', type: 'text', format: 1 },
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Bold text',
          marks: [{ type: 'bold' }],
        },
      ]);
    });

    it('should convert italic text (format=2)', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'Italic text', type: 'text', format: 2 },
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content?.[0].marks).toEqual([{ type: 'italic' }]);
    });

    it('should convert strikethrough text (format=4)', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'Strike text', type: 'text', format: 4 },
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content?.[0].marks).toEqual([{ type: 'strike' }]);
    });

    it('should convert underline text (format=8)', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'Underline text', type: 'text', format: 8 },
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content?.[0].marks).toEqual([{ type: 'underline' }]);
    });

    it('should convert combined formats (bold+italic=3)', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'Bold italic', type: 'text', format: 3 },
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content?.[0].marks).toEqual([
        { type: 'bold' },
        { type: 'italic' },
      ]);
    });

    it('should convert all formats combined (15)', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'All formats', type: 'text', format: 15 },
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content?.[0].marks).toEqual([
        { type: 'bold' },
        { type: 'italic' },
        { type: 'strike' },
        { type: 'underline' },
      ]);
    });

    it('should handle empty paragraph', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content).toEqual([
        { type: 'text', text: '' },
      ]);
    });

    it('should handle paragraph with alignment', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [{ text: 'Centered', type: 'text' }],
        format: 'center',
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.attrs).toEqual({ textAlign: 'center' });
    });

    it('should not include attrs for left alignment', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [{ text: 'Left', type: 'text' }],
        format: 'left',
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.attrs).toBeUndefined();
    });

    it('should handle multiple text nodes', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'Plain ', type: 'text' },
          { text: 'bold', type: 'text', format: 1 },
          { text: ' text', type: 'text' },
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content).toHaveLength(3);
      expect(result.content?.[0]).toEqual({ type: 'text', text: 'Plain ' });
      expect(result.content?.[1]).toEqual({
        type: 'text',
        text: 'bold',
        marks: [{ type: 'bold' }],
      });
      expect(result.content?.[2]).toEqual({ type: 'text', text: ' text' });
    });

    it('should handle undefined text in child nodes', () => {
      const lexicalPara: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { type: 'text' } as LexicalTextNode, // text is undefined
        ],
      };

      const result = lexicalToTiptapParagraph(lexicalPara);

      expect(result.content?.[0]).toEqual({
        type: 'text',
        text: '',
      });
    });
  });

  describe('lexicalToTiptapDocument', () => {
    it('should convert multiple paragraphs', () => {
      const paragraphs: LexicalParagraph[] = [
        {
          type: 'paragraph',
          key_id: '1',
          children: [{ text: 'First', type: 'text' }],
        },
        {
          type: 'paragraph',
          key_id: '2',
          children: [{ text: 'Second', type: 'text' }],
        },
      ];

      const result = lexicalToTiptapDocument(paragraphs);

      expect(result.type).toBe('doc');
      expect(result.content).toHaveLength(2);
      expect(result.content[0].content?.[0].text).toBe('First');
      expect(result.content[1].content?.[0].text).toBe('Second');
    });

    it('should handle empty array', () => {
      const result = lexicalToTiptapDocument([]);

      expect(result).toEqual({
        type: 'doc',
        content: [],
      });
    });
  });

  describe('lexicalToTiptapJSON', () => {
    it('should convert to JSON string', () => {
      const paragraph: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [{ text: 'Test', type: 'text', format: 1 }],
      };

      const result = lexicalToTiptapJSON(paragraph);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe('doc');
      expect(parsed.content).toHaveLength(1);
      expect(parsed.content[0].content[0].text).toBe('Test');
      expect(parsed.content[0].content[0].marks).toEqual([{ type: 'bold' }]);
    });
  });

  describe('tiptapToLexicalParagraph', () => {
    it('should convert plain text paragraph', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello world' },
        ],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, 'test-1');

      expect(result).toEqual({
        type: 'paragraph',
        key_id: 'test-1',
        children: [
          { text: 'Hello world', type: 'text', format: undefined },
        ],
        format: 'left',
        indent: 0,
      });
    });

    it('should convert bold text to format=1', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Bold',
            marks: [{ type: 'bold' }],
          },
        ],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children[0].format).toBe(1);
    });

    it('should convert italic text to format=2', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Italic',
            marks: [{ type: 'italic' }],
          },
        ],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children[0].format).toBe(2);
    });

    it('should convert strike text to format=4', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Strike',
            marks: [{ type: 'strike' }],
          },
        ],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children[0].format).toBe(4);
    });

    it('should convert underline text to format=8', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Underline',
            marks: [{ type: 'underline' }],
          },
        ],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children[0].format).toBe(8);
    });

    it('should convert combined marks (bold+italic=3)', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Bold italic',
            marks: [{ type: 'bold' }, { type: 'italic' }],
          },
        ],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children[0].format).toBe(3);
    });

    it('should convert all marks (format=15)', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'All',
            marks: [
              { type: 'bold' },
              { type: 'italic' },
              { type: 'strike' },
              { type: 'underline' },
            ],
          },
        ],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children[0].format).toBe(15);
    });

    it('should handle empty paragraph', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children).toEqual([
        { text: '', type: 'text' },
      ]);
    });

    it('should handle paragraph with textAlign', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Centered' }],
        attrs: { textAlign: 'center' },
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.format).toBe('center');
    });

    it('should handle paragraph without content property', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children).toEqual([
        { text: '', type: 'text' },
      ]);
    });

    it('should handle undefined text in Tiptap nodes', () => {
      const tiptapPara: TiptapParagraph = {
        type: 'paragraph',
        content: [
          { type: 'text' } as any, // text is undefined
        ],
      };

      const result = tiptapToLexicalParagraph(tiptapPara, '1');

      expect(result.children[0].text).toBe('');
      expect(result.children[0].type).toBe('text');
    });
  });

  describe('tiptapDocumentToLexical', () => {
    it('should convert document with multiple paragraphs', () => {
      const doc: TiptapDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second' }],
          },
        ],
      };

      const result = tiptapDocumentToLexical(doc, '1');

      expect(result).toHaveLength(2);
      expect(result[0].key_id).toBe('1_0');
      expect(result[1].key_id).toBe('1_1');
      expect(result[0].children[0].text).toBe('First');
      expect(result[1].children[0].text).toBe('Second');
    });

    it('should use default starting key_id', () => {
      const doc: TiptapDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Test' }],
          },
        ],
      };

      const result = tiptapDocumentToLexical(doc);

      expect(result[0].key_id).toBe('1_0');
    });

    it('should handle empty document', () => {
      const doc: TiptapDocument = {
        type: 'doc',
        content: [],
      };

      const result = tiptapDocumentToLexical(doc);

      expect(result).toEqual([]);
    });
  });

  describe('tiptapJSONToLexical', () => {
    it('should parse JSON and convert to Lexical', () => {
      const json = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Test',
                marks: [{ type: 'bold' }],
              },
            ],
          },
        ],
      });

      const result = tiptapJSONToLexical(json, 'test');

      expect(result).toHaveLength(1);
      expect(result[0].key_id).toBe('test_0');
      expect(result[0].children[0].text).toBe('Test');
      expect(result[0].children[0].format).toBe(1);
    });

    it('should use default starting key_id', () => {
      const json = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Test' }],
          },
        ],
      });

      const result = tiptapJSONToLexical(json);

      expect(result[0].key_id).toBe('1_0');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data through Lexical -> Tiptap -> Lexical', () => {
      const original: LexicalParagraph = {
        type: 'paragraph',
        key_id: '1',
        children: [
          { text: 'Plain ', type: 'text' },
          { text: 'bold', type: 'text', format: 1 },
          { text: ' and ', type: 'text' },
          { text: 'italic', type: 'text', format: 2 },
        ],
        format: 'center',
      };

      const tiptap = lexicalToTiptapParagraph(original);
      const backToLexical = tiptapToLexicalParagraph(tiptap, '1');

      expect(backToLexical.children[0].text).toBe('Plain ');
      expect(backToLexical.children[1].text).toBe('bold');
      expect(backToLexical.children[1].format).toBe(1);
      expect(backToLexical.children[2].text).toBe(' and ');
      expect(backToLexical.children[3].text).toBe('italic');
      expect(backToLexical.children[3].format).toBe(2);
      expect(backToLexical.format).toBe('center');
    });

    it('should maintain data through Tiptap -> Lexical -> Tiptap', () => {
      const original: TiptapParagraph = {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bold ', marks: [{ type: 'bold' }] },
          { type: 'text', text: 'and italic', marks: [{ type: 'italic' }] },
        ],
        attrs: { textAlign: 'right' },
      };

      const lexical = tiptapToLexicalParagraph(original, '1');
      const backToTiptap = lexicalToTiptapParagraph(lexical);

      expect(backToTiptap.content?.[0].text).toBe('Bold ');
      expect(backToTiptap.content?.[0].marks).toEqual([{ type: 'bold' }]);
      expect(backToTiptap.content?.[1].text).toBe('and italic');
      expect(backToTiptap.content?.[1].marks).toEqual([{ type: 'italic' }]);
      expect(backToTiptap.attrs?.textAlign).toBe('right');
    });
  });
});
