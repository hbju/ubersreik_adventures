/**
 * Helper script to add effects to talents.json
 * This defines the effects mapping for common talents
 */

export const talentEffectsMapping: Record<string, any[]> = {
  // Combat Talents
  "accurate-shot": [
    { type: "DAMAGE_BONUS", value: 1, appliesTo: ["ranged"] }
  ],
  "acute-sense": [
    { type: "TEST_BONUS", value: 10, appliesTo: ["Perception"] }
  ],
  "ambidextrous": [
    { type: "PASSIVE", value: "Reduce off-hand penalty", appliesTo: ["secondary hand"] }
  ],
  "combat-aware": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Perception"], condition: "during melee" }
  ],
  "combat-master": [
    { type: "PASSIVE", value: "Count as additional person when outnumbered", appliesTo: ["combat"] }
  ],
  "combat-reflexes": [
    { type: "INITIATIVE_BONUS", value: 10 }
  ],
  "careful-strike": [
    { type: "PASSIVE", value: "Modify hit location", appliesTo: ["melee", "ranged"] }
  ],
  "crack-the-whip": [
    { type: "PASSIVE", value: "+1 Movement when animal fleeing/running", appliesTo: ["Drive", "Ride"] }
  ],
  
  // Defensive Talents
  "hardy": [
    { type: "WOUNDS_BONUS", value: "TB" }
  ],
  "lightning-reflexes": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Dodge"] }
  ],
  "resilient": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Endurance"] }
  ],
  "resistance": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Resistance"] }
  ],
  
  // Ranged Talents
  "marksman": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Ranged"] }
  ],
  "rapid-reload": [
    { type: "PASSIVE", value: "Reload as Free Action", appliesTo: ["ranged"] }
  ],
  "sharpshooter": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Ranged"], condition: "aiming" }
  ],
  "sure-shot": [
    { type: "PASSIVE", value: "Ignore penalties for range", appliesTo: ["ranged"] }
  ],
  
  // Melee Talents
  "beat-blade": [
    { type: "PASSIVE", value: "Remove opponent Advantage", appliesTo: ["Melee"] }
  ],
  "strike-mighty-blow": [
    { type: "DAMAGE_BONUS", value: 1, appliesTo: ["melee"] }
  ],
  "strike-to-injure": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Melee"] }
  ],
  "strike-to-stun": [
    { type: "PASSIVE", value: "Stun opponent on hit", appliesTo: ["Melee"] }
  ],
  "warrior-born": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Melee"] }
  ],
  
  // Movement Talents
  "cat-fall": [
    { type: "PASSIVE", value: "Reduce falling distance", appliesTo: ["Athletics"] }
  ],
  "fleet-footed": [
    { type: "PASSIVE", value: "+1 Movement" }
  ],
  "nimble-fingered": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Sleight of Hand", "Pick Lock"] }
  ],
  "scale-sheer-surface": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Climb"] }
  ],
  "sprint": [
    { type: "PASSIVE", value: "Double movement when running", appliesTo: ["Athletics"] }
  ],
  
  // Social Talents
  "attractive": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Charm"], condition: "target attracted" }
  ],
  "blather": [
    { type: "PASSIVE", value: "Stun with fast talking", appliesTo: ["Charm"] }
  ],
  "briber": [
    { type: "PASSIVE", value: "Reduce bribe cost by 10%", appliesTo: ["Bribery"] }
  ],
  "cat-tongued": [
    { type: "PASSIVE", value: "Opponents can't detect lies with Intuition", appliesTo: ["Charm"] }
  ],
  "commanding-presence": [
    { type: "PASSIVE", value: "Lower Status can't resist Leadership", appliesTo: ["Leadership"] }
  ],
  "dealmaker": [
    { type: "PASSIVE", value: "Extra 10% haggle bonus", appliesTo: ["Haggle"] }
  ],
  "etiquette": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Charm", "Gossip"], condition: "appropriate social class" }
  ],
  
  // Knowledge Talents
  "bookish": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Research"] }
  ],
  "linguistics": [
    { type: "PASSIVE", value: "Learn languages faster", appliesTo: ["Language"] }
  ],
  "numismatics": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Evaluate"], condition: "coins and currency" }
  ],
  "read-write": [
    { type: "PASSIVE", value: "Can read and write", appliesTo: ["Language"] }
  ],
  "savant": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Lore"] }
  ],
  
  // Magic Talents
  "aethyric-attunement": [
    { type: "PASSIVE", value: "No Miscast on double successful Channel", appliesTo: ["Channelling"] }
  ],
  "arcane-magic": [
    { type: "PASSIVE", value: "Can cast spells from chosen Lore", appliesTo: ["magic"] }
  ],
  "fast-hands": [
    { type: "PASSIVE", value: "Cast as Free Action", appliesTo: ["Channelling"] }
  ],
  "instinctive-diction": [
    { type: "PASSIVE", value: "May substitute SL for Ingredient", appliesTo: ["Language (Magick)"] }
  ],
  "magical-sense": [
    { type: "PASSIVE", value: "Detect magic", appliesTo: ["Intuition"] }
  ],
  "petty-magic": [
    { type: "PASSIVE", value: "Can cast Petty spells", appliesTo: ["magic"] }
  ],
  
  // Stealth Talents
  "alley-cat": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Stealth (Urban)"] }
  ],
  "beneath-notice": [
    { type: "PASSIVE", value: "Higher Status ignore you", appliesTo: ["Stealth"] }
  ],
  "criminal": [
    { type: "PASSIVE", value: "Illegal income bonus", appliesTo: ["criminal activities"] }
  ],
  "shadow": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Stealth"] }
  ],
  
  // Crafting Talents
  "artistic": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Art"] }
  ],
  "craftsman": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Trade"] }
  ],
  "tinker": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Trade"], condition: "repairs" }
  ],
  
  // Animal Talents
  "animal-affinity": [
    { type: "PASSIVE", value: "Wild animals calm around you", appliesTo: ["Charm Animal"] }
  ],
  "animal-husbandry": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Animal Handling"] }
  ],
  
  // Survival Talents
  "break-and-enter": [
    { type: "DAMAGE_BONUS", value: 1, appliesTo: ["inanimate objects"] }
  ],
  "field-dressing": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Heal"], condition: "in the field" }
  ],
  "fisherman": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Trade (Fisher)"] }
  ],
  "hunter-gatherer": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Outdoor Survival"], condition: "foraging" }
  ],
  "seasoned-traveler": [
    { type: "PASSIVE", value: "Extra benefits when traveling", appliesTo: ["Navigation"] }
  ],
  "strider": [
    { type: "PASSIVE", value: "Ignore terrain penalties", appliesTo: ["Athletics"] }
  ],
  
  // Special Talents
  "luck": [
    { type: "PASSIVE", value: "Reroll any Test", appliesTo: ["all"] }
  ],
  "coolheaded": [
    { type: "PASSIVE", value: "+5 starting Willpower", appliesTo: ["WP"] }
  ],
  "savvy": [
    { type: "PASSIVE", value: "+5 starting Intelligence", appliesTo: ["Int"] }
  ],
  "suave": [
    { type: "PASSIVE", value: "+5 starting Fellowship", appliesTo: ["Fel"] }
  ],
  "very-resilient": [
    { type: "PASSIVE", value: "+5 starting Toughness", appliesTo: ["T"] }
  ],
  "very-strong": [
    { type: "PASSIVE", value: "+5 starting Strength", appliesTo: ["S"] }
  ],
  
  // Dwarf Talents
  "magic-resistance": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Resistance (Magic)"] }
  ],
  "night-vision": [
    { type: "PASSIVE", value: "See in darkness", appliesTo: ["Perception"] }
  ],
  
  // Other Combat Talents
  "berserk-charge": [
    { type: "DAMAGE_BONUS", value: 1, appliesTo: ["melee"], condition: "charging" }
  ],
  "dual-wielder": [
    { type: "PASSIVE", value: "Attack with both weapons", appliesTo: ["Melee"] }
  ],
  "in-fighter": [
    { type: "PASSIVE", value: "Negate opponent's Advantage", appliesTo: ["Melee"] }
  ],
  "menacing": [
    { type: "SL_BONUS_ON_SUCCESS", value: 1, appliesTo: ["Intimidate"] }
  ],
  "reversal": [
    { type: "PASSIVE", value: "Reverse fumble to success", appliesTo: ["Melee"] }
  ],
  "riposte": [
    { type: "PASSIVE", value: "Attack after successful parry", appliesTo: ["Melee"] }
  ]
};
