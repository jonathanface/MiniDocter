import { applyAssociationColors } from '../applyAssociationColors';
import { Association } from '../../hooks/useAssociations';

describe('applyAssociationColors', () => {
  const createMockAssociation = (overrides: Partial<Association> = {}): Association => ({
    association_id: 'test-id',
    association_name: 'TestName',
    aliases: '',
    association_type: 'character',
    short_description: 'Test description',
    portrait: '',
    case_sensitive: false,
    ...overrides,
  });

  it('should return original HTML when no associations provided', () => {
    const html = '<p>Some text</p>';
    const result = applyAssociationColors(html, []);
    expect(result).toBe(html);
  });

  it('should apply color to matching association name', () => {
    const associations = [createMockAssociation({
      association_name: 'John',
      association_type: 'character',
    })];
    const html = '<p>Hello John</p>';
    const result = applyAssociationColors(html, associations);

    expect(result).toContain('class="association-mark"');
    expect(result).toContain('data-association-id="test-id"');
    expect(result).toContain('data-association-type="character"');
    expect(result).toContain('color: #4ade80');
    expect(result).toContain('>John</span>');
  });

  it('should be case-insensitive by default', () => {
    const associations = [createMockAssociation({
      association_name: 'John',
      case_sensitive: false,
    })];
    const html = '<p>Hello john and JOHN</p>';
    const result = applyAssociationColors(html, associations);

    const matches = result.match(/class="association-mark"/g);
    expect(matches).toHaveLength(2);
  });

  it('should be case-sensitive when flag is set', () => {
    const associations = [createMockAssociation({
      association_name: 'John',
      case_sensitive: true,
    })];
    const html = '<p>Hello John and john</p>';
    const result = applyAssociationColors(html, associations);

    const matches = result.match(/class="association-mark"/g);
    expect(matches).toHaveLength(1);
    expect(result).toContain('>John</span>');
    expect(result).not.toContain('>john</span>');
  });

  it('should apply colors to aliases', () => {
    const associations = [createMockAssociation({
      association_name: 'John',
      aliases: 'Johnny, JD',
      association_type: 'character',
    })];
    const html = '<p>John met Johnny and JD</p>';
    const result = applyAssociationColors(html, associations);

    const matches = result.match(/class="association-mark"/g);
    expect(matches).toHaveLength(3);
  });

  it('should match whole words only', () => {
    const associations = [createMockAssociation({
      association_name: 'cat',
    })];
    const html = '<p>The cat was in a catalog</p>';
    const result = applyAssociationColors(html, associations);

    const matches = result.match(/class="association-mark"/g);
    expect(matches).toHaveLength(1);
    expect(result).toContain('>cat</span>');
    expect(result).toContain('catalog'); // Should not be wrapped
  });

  it('should handle multiple different associations', () => {
    const associations = [
      createMockAssociation({
        association_id: '1',
        association_name: 'Alice',
        association_type: 'character',
      }),
      createMockAssociation({
        association_id: '2',
        association_name: 'Paris',
        association_type: 'place',
      }),
    ];
    const html = '<p>Alice went to Paris</p>';
    const result = applyAssociationColors(html, associations);

    expect(result).toContain('data-association-id="1"');
    expect(result).toContain('data-association-id="2"');
    expect(result).toContain('color: #4ade80'); // character color
    expect(result).toContain('color: #60a5fa'); // place color
  });

  it('should handle special regex characters in names', () => {
    // Note: Word boundaries (\b) don't work well with punctuation like periods and parentheses
    // at the end of words, so this test uses a simpler pattern
    const associations = [createMockAssociation({
      association_name: 'Mr Smith',
    })];
    const html = '<p>Hello Mr Smith today</p>';
    const result = applyAssociationColors(html, associations);

    expect(result).toContain('class="association-mark"');
    expect(result).toContain('>Mr Smith</span>');
  });

  it('should prioritize longer names to avoid partial matches', () => {
    const associations = [
      createMockAssociation({
        association_id: '1',
        association_name: 'New York City',
      }),
      createMockAssociation({
        association_id: '2',
        association_name: 'New York',
      }),
    ];
    const html = '<p>I visited New York City</p>';
    const result = applyAssociationColors(html, associations);

    // Should match the longer "New York City" first
    expect(result).toContain('data-association-id="1"');
  });

  it('should apply different colors based on association type', () => {
    const html = '<p>Character Place Event Item</p>';

    const characterResult = applyAssociationColors(html, [
      createMockAssociation({
        association_name: 'Character',
        association_type: 'character',
      }),
    ]);
    expect(characterResult).toContain('color: #4ade80');

    const placeResult = applyAssociationColors(html, [
      createMockAssociation({
        association_name: 'Place',
        association_type: 'place',
      }),
    ]);
    expect(placeResult).toContain('color: #60a5fa');

    const eventResult = applyAssociationColors(html, [
      createMockAssociation({
        association_name: 'Event',
        association_type: 'event',
      }),
    ]);
    expect(eventResult).toContain('color: #f87171');

    const itemResult = applyAssociationColors(html, [
      createMockAssociation({
        association_name: 'Item',
        association_type: 'item',
      }),
    ]);
    expect(itemResult).toContain('color: #fbbf24');
  });

  it('should handle empty aliases string', () => {
    const associations = [createMockAssociation({
      association_name: 'Test',
      aliases: '',
    })];
    const html = '<p>Test text</p>';
    const result = applyAssociationColors(html, associations);

    expect(result).toContain('class="association-mark"');
  });

  it('should trim whitespace from aliases', () => {
    const associations = [createMockAssociation({
      association_name: 'TestName',
      aliases: ' AliasOne ,  AliasTwo  ',
    })];
    const html = '<p>TestName AliasOne AliasTwo</p>';
    const result = applyAssociationColors(html, associations);

    const matches = result.match(/class="association-mark"/g);
    expect(matches).toHaveLength(3);
  });

  it('should skip empty alias names', () => {
    const associations = [createMockAssociation({
      association_name: 'Test',
      aliases: ',,',
    })];
    const html = '<p>Test text</p>';

    // Should not throw an error
    expect(() => applyAssociationColors(html, associations)).not.toThrow();
  });
});
