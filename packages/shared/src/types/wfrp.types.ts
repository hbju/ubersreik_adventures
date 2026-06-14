import type { CalendarState } from '../data/calendar';
import type { Notebook } from './notebook.types';

export interface Coordinates {
    x: number;
    y: number;
}

export interface Location {
    id: string;
    name: string;
    coords: Coordinates;
    playerDescription: string;
    gmNotes: string;
    image: string;
    music: string;
    hooks: string[];
    tag: string;
    controllingFactionId?: string; 
    influenceWeight?: number;     
}

export interface ConditionInstance {
    id: string; // condition_blinded, etc.
    roundApplied: number; // combat round when this was applied
}

export interface Combatant {
    id: string;
    sourceId: string;
    name: string;
    initiative: number | null;
    currentWounds: number;
    maxWounds: number;
    baseInitiative: number;
    baseAg: number;
    isPlayer: boolean;
    conditions: string[];
    conditionInstances?: ConditionInstance[];
}

export interface Advantages {
    playerAdvantage: number;
    enemyAdvantage: number;
}

export interface Condition {
    id: string;
    name: string;
    description: string;
    stack: number; // current number of stacks
}

export interface XP {
    current: number;
    spent: number;
}

export interface Characteristic {
    initial: number;
    advances: number;
    talents: number;
    modifier: number;
}

export interface Status {
    current: number;
    max: number;
}

export interface Skill {
    id: string;
    name: string;
    characteristic: string;
    advances: number;
    talents: number;
    modifier: number;
}

export interface SkillCharDefinition {
    id: string;
    name: string;
    characteristic: keyof Character['characteristics'];
    type: 'skill' | 'characteristic';
    classification?: 'basic' | 'advanced';
}

export interface Talent {
    id: string,
    name: string,
    description: string,
    tests: string[],
    max_ranks: number | string | keyof Character['characteristics'],
    careers?: Record<string, string | undefined>,
    racial?: string[],
    effects?: TalentEffect[]
}

export type TalentEffectKind =
    'testBonus' |
    'slBonus' |
    'damageBonus' |
    'damageReduction' |
    'initiativeBonus' |
    'attributeBonus' |
    'characteristicBonus' |
    'woundsBonus' |
    'encumbranceBonus' |
    'reverseRollOnFail' |
    'offHandPenaltyReduction' |
    'hitLocationShift' |
    'armourPointIgnore' |
    'weaponLengthImmunity' |
    'calledShotPenaltyWaiver' |
    'weaponQualityGrant' |
    'criticalRollChoice' |
    'criticalDamageMultiplier' |
    'outnumberingCount' |
    'losingAdvantageCount' |
    'advantageCostReduction' |
    'conditionLossIgnore' |
    'conditionGainReaction' |
    'fearRating' |
    'terrorRating' |
    'psychologyImmunity' |
    'autoPassFirstTest' |
    'damageCalculationModifier' |
    'advantageBonus' |
    'activation' |
    'reaction' |
    'ruleNote';

export type TalentEffectTrigger =
    'always' |
    'preRoll' |
    'postRoll' |
    'onSuccess' |
    'onHit' |
    'onDefend' |
    'onCrit' |
    'onGainCondition' |
    'onConditionLoss' |
    'initiative' |
    'economy' |
    'reaction';

export type TalentEffectWhen =
    'always' |
    'charging' |
    'whenCharge' |
    'whenDefending' |
    'defendingWithShield' |
    'weaponFast' |
    'duringMelee' |
    'duringCombatRounds' |
    'surprise' |
    'frenzied' |
    'beatBlade' |
    'disarming' |
    'touchOpponent' |
    'distracting' |
    'besideAllyWithDrilled' |
    'attackingWithTwoWeapons' |
    'fastShot' |
    'feint' |
    'extraAttack' |
    'combatInitiative' |
    'infighting' |
    'resistStunned' |
    'prone' |
    'aiming' |
    'reload' |
    'hatedGroup' |
    'resistGroup' |
    'usingBandages' |
    'fleeing' |
    'confinedSpace' |
    'specifiedEnemy' |
    'dailyFlagellation' |
    'associatedThreat' |
    'determiningDamage' |
    'largerTargetCritical' |
    'longExtremeRange' |
    'running' |
    'stepAside' |
    'removeBroken' |
    'strikingToStun' |
    'opposedStrength' |
    'blackpowderPanic' |
    'duringWar';

export interface TalentEffectCost {
    resource: 'advantage' | 'move' | 'action' | 'reaction';
    amount: number;
}

export interface NormalizedTalentEffect {
    kind: TalentEffectKind;
    type?: never;
    value?: number | string;
    appliesTo?: string[];
    condition?: never;
    when?: TalentEffectWhen | TalentEffectWhen[];
    trigger?: TalentEffectTrigger;
    cost?: TalentEffectCost;
    params?: Record<string, number | string | boolean | string[] | number[] | undefined>;
}

export interface LegacyTalentEffect {
    kind?: never;
    type:
    'SL_BONUS_ON_SUCCESS' |
    'SL_BONUS' |
    'WOUNDS_BONUS' |
    'ENCUMBRANCE_BONUS' |
    'TEST_BONUS' |
    'DAMAGE_BONUS' |
    'DAMAGE_REDUCTION' |
    'DAMAGE_CALCULATION_MODIFIER' |
    'DAMAGE_MULTIPLIER_ON_CRITICAL' |
    'CRITICAL_DAMAGE_TABLE_ROLL_MODIFIER' |
    'ARMOUR_PIERCING' |
    'INITIATIVE_BONUS' |
    'PASSIVE' |
    'REVERSE_ROLL_ON_FAIL' |
    'SL_DICES_UNITS' |
    'OPPONENT_ADVANTAGE_MODIFIER' |
    'CONDITIONAL' |
    'ATTRIBUTE_BONUS' |
    'CHARACTERISTIC_BONUS' |
    'FEAR_RATING' |
    'AUTO_PASS_FIRST_TEST' |
    'ADVANTAGE_BONUS' |
    'BLEEDING_CONDITION_IGNORE';
    value: number | string; // number for fixed values, string for formulas like "TB" (Toughness Bonus)
    appliesTo?: string[]; // skill names, characteristic names, or descriptors like "ranged", "melee"
    condition?: string; // optional condition for when the effect applies
}

export type TalentEffect = NormalizedTalentEffect | LegacyTalentEffect;

interface BaseItem {
    id: string;
    name: string;
    price: string; // Keep as string for display (e.g., "1 GC", "10 S")
    enc: number;
    availability: 'Common' | 'Scarce' | 'Rare' | 'Exotic' | 'Unique';
}

export interface Armor extends BaseItem {
    type: 'Soft Leather' | 'Boiled Leather' | 'Mail' | 'Plate';
    penalty: string;
    locations: string[];
    ap: number;
    qualities: string[];
}

export interface Weapon extends BaseItem {
    group: string;
    reach: string;
    damage: string;
    qualities: string[];
}

export interface Item extends BaseItem { }

export interface Currency {
    gc: number; // Gold Crowns
    ss: number; // Silver Shillings
    bp: number; // Brass Pennies
}

export interface User {
    id: string;
    username: string;
    passwordHash: string;
    characterId: string | null;
    createdAt: string;
}

// Career System Types
export interface CareerLevel {
    id: string;
    name: string;
    lvl: number;
    characteristic_advances: string[];
    talent_ids: string[];
    skills_ids: string[];
    trappings: string[];
    status: string;
}

export interface Career {
    id: string;
    name: string;
    description: string;
    class: string;
    races: string[];
    career_level: CareerLevel[];
}

export interface CareerHistoryEntry {
    careerId: string;
    careerLevelId: string;
    careerName: string;
    levelName: string;
    level: number;
    xpSpent: number;
    advancementType: 'characteristic' | 'skill' | 'talent';
    advancementId: string; // characteristic key, skill id, or talent id
    advancementName: string;
    timestamp: string;
}

export interface CharacterDetails {
    age: string;
    height: string;
    hair: string;
    eyes: string;
    partyName: string;
    shortTermAmbition: string;
    longTermAmbition: string;
    partyShortTermAmbition: string;
    partyLongTermAmbition: string;
}

// ========================================
// Knowledge & Secrets System Types
// ========================================

/**
 * A single piece of knowledge or secret about a character
 */
export interface KnowledgeEntry {
    id: string;
    topic: string; // e.g., "Origin", "Secret Agenda", "Weakness"
    content: string; // The actual text content
    visibility: string[]; // Array of Player IDs who can see this entry (empty = GM only)
    createdAt: string; // ISO timestamp
    updatedAt: string; // ISO timestamp
}

/**
 * A relationship between two characters
 */
export interface Relationship {
    id: string;
    targetCharacterId: string;
    type: 'kin' | 'friend' | 'love' | 'ally' | 'rival' | 'enemy' | 'servant' | 'master' | 'other';
    description: string;
}

/**
 * A single motivation entry from the motivations data
 */
export interface Motivation {
    name: string;
    id: string;
    description: string;
}

/**
 * Character's lore container
 */
export interface CharacterLore {
    gmNotes: string; // Plain text, always private to GM
    background: KnowledgeEntry[]; // Structured knowledge entries
    playerNotes?: string; // Player's own notes about themselves (only for player-owned characters)
    // Dramatis Personae fields
    appearance?: string; // Text description of appearance
    voice?: string; // e.g. "Gravelly", "Soft-spoken"
    mannerisms?: string; // e.g. "Fidgets", "Spits"
    biography?: string; // Rich text / multiline biography
    ambitions?: { short: string; long: string };
    motivationKey?: string; // Matches motivation.id from motivations data
    imageUrl?: string; // Path to character portrait image
    relationships?: Relationship[];
}

export interface Character {
    id: string;
    name: string;
    species: string; // Human, Dwarf, Elf, Halfling
    class: string; // Warrior, Ranger, etc.
    currentCareerId: string;
    currentCareerLevelId: string;
    userId: string | null; // null if unassigned
    tags: string[]; // e.g., "City Watch", "Cultist", "Merchant"
    locationId: string | null; // Reference to a location
    xp: XP;
    careerHistory: CareerHistoryEntry[]; // full history of all XP spent
    unlockedCharacteristicIds: string[]; // GM-granted unlocks
    unlockedSkillIds: string[]; // GM-granted unlocks
    unlockedTalentIds: string[]; // GM-granted unlocks
    details: CharacterDetails; // Personal details
    movement: number; // Walk speed (based on species)
    characteristics: {
        ws: Characteristic;
        bs: Characteristic;
        s: Characteristic;
        t: Characteristic;
        i: Characteristic;
        ag: Characteristic;
        dex: Characteristic;
        int: Characteristic;
        wp: Characteristic;
        fel: Characteristic;
    };
    skills: Skill[];
    status: {
        wounds: Status;
        fate: Status;
        fortune: Status;
        resilience: Status;
        resolve: Status;
        corruption: Status;
    };
    conditions: Condition[];
    talents: Record<string, number>;
    inventory: {
        weapons: Record<string, number>;
        armor: Record<string, number>;
        items: Record<string, number>;
        equippedWeapons?: Record<string, boolean>;
        equippedArmor?: Record<string, boolean>;
        equippedItems?: Record<string, boolean>;
    };
    currency: Currency;
    reputations: ReputationEntry[]; // Character's standing with various factions
    lore?: CharacterLore; // Knowledge, secrets, and notes about the character
    isMinion?: boolean; // If true, opens in condensed Minion View instead of full sheet
    templateId?: string; // Reference to the CharacterTemplate this character was generated from
    actionBar?: ActionBarEntry[]; // Quick action slots (1-9, 0)
}

// ========================================
// Action Bar System Types
// ========================================

/**
 * An entry in the player's action bar for quick access to skills/weapons
 */
export interface ActionBarEntry {
    slotIndex: number;
    type: 'skill' | 'weapon' | 'characteristic';
    id: string;
    label: string;
}

// ========================================
// NPC Template System Types
// ========================================

export type CharacterTemplateCategory = 'Human' | 'Dwarf' | 'Elf' | 'Halfling' | 'Creature' | 'Undead' | 'Chaos' | 'Other';

/**
 * Defines variance for a characteristic value
 */
export interface CharacteristicVariance {
    base: number;
    variance: number; // ±variance applied to base
}

/**
 * Skill definition for a template
 */
export interface TemplateSkill {
    id: string;
    advances: number;
    advancesVariance?: number; // ±variance for advances
}

/**
 * Template for generating NPCs with slight stat variations
 */
export interface CharacterTemplate {
    id: string;
    name: string;
    category: CharacterTemplateCategory;
    description?: string;
    species: string;
    careerId?: string; // Optional career reference
    careerLevelId?: string;
    movement: number;
    nameList?: string[]; // Custom name list for this template (e.g., ["Hans", "Klaus", "Wilhelm"])
    characteristics: {
        ws: CharacteristicVariance;
        bs: CharacteristicVariance;
        s: CharacteristicVariance;
        t: CharacteristicVariance;
        i: CharacteristicVariance;
        ag: CharacteristicVariance;
        dex: CharacteristicVariance;
        int: CharacteristicVariance;
        wp: CharacteristicVariance;
        fel: CharacteristicVariance;
    };
    skills: TemplateSkill[];
    talents: string[]; // Array of talent IDs
    trappings: {
        weapons: string[]; // Array of weapon IDs
        armor: string[]; // Array of armor IDs
        items: string[]; // Array of item IDs
    };
    baseWounds?: number; // If not provided, calculated from characteristics
    woundsVariance?: number; // ±variance for wounds
    isMinion: boolean; // Whether generated characters should use Minion View
    tags?: string[]; // Default tags for generated characters
}

export interface MapData {
    id: string;
    name: string;
    imagePath: string; 
    gridSize: number;  
    spawnPoint?: { x: number; y: number };
    locations: Location[];
    // Legacy support - mapImage is an alias for imagePath
    mapImage?: string;
}

// ========================================
// Map Token System Types
// ========================================

/**
 * Represents a player's token on the map
 */
export interface MapToken {
    id: string;
    characterId: string;
    characterName?: string; 
    mapId: string;
    x: number; 
    y: number;
}

/**
 * A personal pin/note created by a player on the map
 * These are only visible to the creator
 */
export interface UserMapPin {
    id: string;
    playerId: string; // Owner (user ID)
    characterId: string; // Character who created the pin
    mapId: string;
    x: number; 
    y: number;
    label: string;
    color?: string; // Optional custom color
}

/**
 * Ping event for drawing attention to a map location
 */
export interface PingEvent {
    x: number;
    y: number;
    color: string;
    userId: string;
}

/**
 * Player color assignment for visual identification
 */
export interface PlayerColor {
    odUserId: string;
    color: string;
}

export interface JournalEntry {
    id: string;
    title: string;
    content: string;
    imageData?: string; // Base64 encoded image data (data:image/...;base64,...)
    sharedWith: ('all' | string)[]; // Array of character IDs or 'all'
}

// ========================================
// Quest Journal System Types
// ========================================

export type QuestStatus = 'active' | 'completed' | 'failed';

export interface QuestObjective {
    id: string;
    text: string;
    isCompleted: boolean;
    locationId?: string; // Optional link to a discovered map location
}

export interface Quest {
    id: string;
    title: string;
    characterId: string; // Creator (character ID)
    description: string; // Rich text or multiline string
    status: QuestStatus;
    objectives: QuestObjective[];
    createdAt: number; // Timestamp
    updatedAt: number;
}

export interface MapPinState {
    playerDiscovered: string[]; // Array of character IDs who have discovered this location
}

// Faction & Reputation System Types
export type FactionCategory =
    | 'government'
    | 'noble_house'
    | 'guild'
    | 'criminal'
    | 'religious'
    | 'military'
    | 'cult'
    | 'other';

export interface Faction {
    id: string;
    name: string;
    description: string;
    category: FactionCategory;
    icon?: string;
    hq: string;
    head: string;
    defaultReputation: number; 
    color?: string;
}

export type KnowledgeLevel = 'unknown' | 'rumored' | 'known';

export interface ReputationEntry {
    factionId: string;
    value: number; // -100 to 100
    knowledgeLevel: KnowledgeLevel;
    notes?: string; // Optional GM notes about this relationship
}

/**
 * GM-assigned faction territory data for a location.
 * Stored separately from static map data so it persists independently.
 */
export interface LocationTerritory {
    controllingFactionId: string;
    influenceWeight: number; // 1-5
}

export interface CampaignState {
    characters: Character[];
    users: User[];
    journal: JournalEntry[];
    quests: Quest[]; // Party-wide quest journal
    mapPinStates: Record<string, MapPinState>; // locationId -> MapPinState
    factions: Faction[]; // Global list of factions
    shopInventory?: ShopInventoryState; // Shop inventory state
    customShopDefinitions?: ShopDefinition[]; // Custom shop definitions created/edited by GM
    tokens: MapToken[]; // Player tokens on the map
    userPins: UserMapPin[]; // Personal pins created by players
    playerColors: Record<string, string>; // userId -> assigned color hex
    characterTemplates: CharacterTemplate[]; // NPC character templates
    maps: Record<string, MapData>; // All available maps indexed by id
    activeMapId: string; // Currently active map
    calendar?: CalendarState; // Imperial Calendar state
    locationTerritories?: Record<string, LocationTerritory>; // locationId -> territory data
    playerNotebooks?: Record<string, Notebook>; // userId -> Notebook (private player notes)
    version: string;
    lastModified: string;
}

// Item Quality/Flaw Types
export type ItemQualityType = 'quality' | 'flaw';

export interface ItemQualityDefinition {
    id: string;
    name: string;
    type: ItemQualityType;
    equipment: string; // 'weapon' | 'armor' | 'item' | 'any'
    description: string;
}

// Parsed quality with optional rating (e.g., "Blast 5" -> { name: "Blast", rating: 5 })
export interface ParsedQuality {
    name: string;
    rating?: number;
    definition?: ItemQualityDefinition;
}

// ========================================
// Shop System Types
// ========================================

export type ItemAvailability = 'Common' | 'Scarce' | 'Rare' | 'Exotic';

export type ItemModification = 'standard' | 'quality' | 'flawed';

/**
 * Definition of a shop that can generate inventory
 */
export interface ShopDefinition {
    id: string;
    name: string;
    locationId: string; // Reference to the map location
    category: 'weapon' | 'armor' | 'general' | 'apothecary' | 'tavern' | 'specialty';
    baseStock: string[]; // Array of item IDs that this shop can potentially stock
}

/**
 * A specific item instance in a shop's inventory
 */
export interface ShopInventoryItem {
    instanceId: string; // Unique ID for this specific item instance
    baseItemId: string; // Reference to the base item (weapon, armor, or item)
    baseItemType: 'weapon' | 'armor' | 'item'; // Type of the base item
    nameOverride?: string; // e.g., "Unbalanced Dagger" or "Fine Sword"
    modification: ItemModification; // Whether standard, quality, or flawed
    qualities: string[]; // Applied quality IDs (e.g., ["durable", "fine"])
    flaws: string[]; // Applied flaw IDs (e.g., ["shoddy", "ugly"])
    basePrice: number; // Price in brass pennies (calculated based on modifiers)
    displayPrice: string; // Original display price for reference
    quantity: number; // How many of this item are available
    isIdentified: boolean; // If false, shows generic name/price to players
}

/**
 * Current state of a shop's inventory
 */
export interface ShopState {
    shopId: string;
    lastRestockDate: string; // ISO date string
    inventory: ShopInventoryItem[];
    playerAccess: string[]; // Array of character IDs who can access this shop
}

/**
 * Complete shop inventory state across all shops
 */
export interface ShopInventoryState {
    shops: Record<string, ShopState>; // shopId -> ShopState
    lastGlobalRestock: string; // ISO date string of last "Restock Day" action
}
