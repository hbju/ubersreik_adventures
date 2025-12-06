import { ItemQualityDefinition, ParsedQuality, Weapon } from '../types/wfrp.types';

/**
 * Parse a quality string like "Blast 5" into its name and optional rating.
 * @param qualityString The raw quality string (e.g., "Blast 5", "Unbalanced", "Shield 2")
 * @returns ParsedQuality object with name and optional rating
 */
export const parseQualityString = (qualityString: string): { name: string; rating?: number } => {
  // Match patterns like "Blast 5", "Shield 2", "Reload 3", etc.
  const match = qualityString.match(/^(.+?)\s+(\d+)$/);
  
  if (match) {
    return {
      name: match[1].trim(),
      rating: parseInt(match[2], 10),
    };
  }
  
  return { name: qualityString.trim() };
};

/**
 * Get the definition for a quality or flaw by name.
 * Handles qualities with ratings (e.g., "Blast 5" will look up "Blast").
 * @param qualityString The quality string to look up (e.g., "Blast 5", "Unbalanced")
 * @returns The ItemQualityDefinition if found, undefined otherwise
 */
export const getQualityDefinition = (qualityString: string, qualitiesData: ItemQualityDefinition[]): ItemQualityDefinition | undefined => {
  const { name, rating } = parseQualityString(qualityString);
  
  // Try exact match first (case-insensitive)
  let definition = qualitiesData.find(
    q => name.toLowerCase().includes(q.id.toLowerCase())
  );
  
  // If not found, try matching without "(Rating)" suffix in the definition name
  if (!definition) {
    definition = qualitiesData.find(
      q => name.toLowerCase().includes(q.name.replace('(Rating)', '').toLowerCase())
    );
  }
  
  // Also try matching the id
  if (!definition) {
    const normalizedName = name.toLowerCase().replace(/\s+/g, '_');
    definition = qualitiesData.find(q => q.id === normalizedName);
  }

  if (definition && rating !== undefined) {
    definition = { ...definition }; // Create a shallow copy
    definition.name = definition.name.replace('(Rating)', rating.toString());
    definition.name = definition.name.replace('(Valeur)', rating.toString());
    definition.description = definition.description.replace('(Rating)', rating.toString());
    definition.description = definition.description.replace('(Valeur)', rating.toString());
  }
  
  return definition;
};

/**
 * Parse a quality string and return full information including definition.
 * @param qualityString The quality string to parse
 * @returns ParsedQuality with name, optional rating, and optional definition
 */
export const getQualityInfo = (qualityString: string, qualitiesData: ItemQualityDefinition[]): ParsedQuality => {
  const { name, rating } = parseQualityString(qualityString);
  const definition = getQualityDefinition(qualityString, qualitiesData);
  
  return {
    name,
    rating,
    definition,
  };
};

/**
 * Check if a weapon has a specific quality or flaw.
 * @param weapon The weapon to check
 * @param qualityId The quality/flaw id to check for (e.g., "unbalanced", "fast")
 * @returns true if the weapon has this quality/flaw
 */
export const weaponHasQuality = (weapon: Weapon, qualityId: string, qualitiesData: ItemQualityDefinition[]): boolean => {
  if (!weapon.qualities) return false;
  
  return weapon.qualities.some(q => {
    const { name } = parseQualityString(q);
    const definition = getQualityDefinition(q, qualitiesData);
    
    return (
      definition?.id === qualityId ||
      name.toLowerCase() === qualityId.toLowerCase()
    );
  });
};

/**
 * Get the rating value for a quality with a rating (e.g., "Blast 5" returns 5).
 * @param weapon The weapon to check
 * @param qualityId The quality id to get the rating for
 * @returns The rating number if found, undefined otherwise
 */
export const getQualityRating = (weapon: Weapon, qualityId: string, qualitiesData: ItemQualityDefinition[]): number | undefined => {
  if (!weapon.qualities) return undefined;
  
  for (const q of weapon.qualities) {
    const { name, rating } = parseQualityString(q);
    const definition = getQualityDefinition(q, qualitiesData);
    
    if (definition?.id === qualityId || name.toLowerCase() === qualityId.toLowerCase()) {
      return rating;
    }
  }
  
  return undefined;
};
