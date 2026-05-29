export const combatResolverRuleChecklist = [
    'Opposed-test winner selection by rounded SL, then target-number tie-breaker.',
    'Combat vs skill-mode branching, where skill mode resolves only the opposed outcome.',
    'Hit location derived from the attacker d100 roll.',
    'Damage formula: weapon damage plus SL difference plus talent damage bonus.',
    'Soak formula: subtract defender Toughness Bonus and armour points at the hit location.',
    'Equipped armour lookup with normalized location matching and AP stacking.',
    'Damage floor at zero and wound floor at zero.',
    'Critical and fumble detection from d100 roll thresholds/doubles.',
    'Critical-table/fumble-table roll generation through the same injectable RNG.',
    'Zero-wounds critical trigger emitted by the damage pipeline.',
    'Advantage gain after a damaging attacker win, emitted as an event rather than mutating UI.',
] as const;
