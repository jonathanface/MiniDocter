import { getAssociationColor, ASSOCIATION_COLORS } from '../associationColors';

describe('associationColors', () => {
  describe('ASSOCIATION_COLORS', () => {
    it('should have correct color values', () => {
      expect(ASSOCIATION_COLORS.character).toBe('#4ade80');
      expect(ASSOCIATION_COLORS.place).toBe('#60a5fa');
      expect(ASSOCIATION_COLORS.event).toBe('#f87171');
      expect(ASSOCIATION_COLORS.item).toBe('#fbbf24');
    });
  });

  describe('getAssociationColor', () => {
    it('should return correct color for character type', () => {
      expect(getAssociationColor('character')).toBe('#4ade80');
    });

    it('should return correct color for place type', () => {
      expect(getAssociationColor('place')).toBe('#60a5fa');
    });

    it('should return correct color for event type', () => {
      expect(getAssociationColor('event')).toBe('#f87171');
    });

    it('should return correct color for item type', () => {
      expect(getAssociationColor('item')).toBe('#fbbf24');
    });

    it('should return white (#ffffff) for unknown type', () => {
      expect(getAssociationColor('unknown')).toBe('#ffffff');
    });

    it('should return white for empty string', () => {
      expect(getAssociationColor('')).toBe('#ffffff');
    });
  });
});
