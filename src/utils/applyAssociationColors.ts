import { Association } from '../hooks/useAssociations';
import { getAssociationColor } from './associationColors';

// Escape RegExp special characters
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export function applyAssociationColors(html: string, associations: Association[]): string {
  if (!associations.length) return html;

  let result = html;

  // Process each association
  associations.forEach((association) => {
    const aliases = association.aliases.length > 0
      ? association.aliases.split(',').map((alias) => alias.trim())
      : [];

    const namesToMatch = Array.from(
      new Set([association.association_name.trim(), ...aliases])
    ).sort((a, b) => b.length - a.length); // Sort by length (longest first) to avoid partial matches

    const color = getAssociationColor(association.association_type);

    namesToMatch.forEach((name) => {
      if (!name) return;

      const searchFor = association.case_sensitive ? name : name.toLowerCase();
      const flags = association.case_sensitive ? 'g' : 'gi';

      // Match whole words only, but preserve the original text
      const regex = new RegExp(`\\b(${escapeRegExp(searchFor)})\\b`, flags);

      result = result.replace(regex, (match) => {
        // Add data attributes for association info - no bold, just color
        return `<span class="association-mark" data-association-id="${association.association_id}" data-association-type="${association.association_type}" style="color: ${color};">${match}</span>`;
      });
    });
  });

  return result;
}
