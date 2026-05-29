import type { Armor, Character, Status, Talent, Weapon } from '../types/wfrp.types';

export type SideId = 'ally' | 'adversary';
export type AdvantagePools = Record<SideId, number>;

export interface CombatantBudget {
    actions: number;
    moves: number;
    reactions: number;
}

export interface MovementBudget {
    walk: number;
    run: number;
    remaining: number;
}

export interface CombatantResources {
    wounds: Status;
    fate?: Status;
    fortune?: Status;
    resilience?: Status;
    resolve?: Status;
}

export interface Combatant {
    id: string;
    sourceId: string;
    name: string;
    side: SideId;
    isPlayer: boolean;
    character: Character;
    currentWounds: number;
    maxWounds: number;
    position: number;
    movementBudget: MovementBudget;
    engagementIds: string[];
    budget: CombatantBudget;
    conditions: string[];
    resources: CombatantResources;
}

export interface CombatTurnFlags {
    additionalActionCombatantIds: string[];
}

export interface CombatState {
    combatants: Record<string, Combatant>;
    round: number;
    armor: Armor[];
    weapons: Weapon[];
    talents: Talent[];
    advantagePools: AdvantagePools;
    tacticalDominantSide?: SideId;
    turnFlags: CombatTurnFlags;
}

export interface UsedTalent {
    name: string;
    rank: number;
}

export interface OpposedRollInput {
    skillId: string;
    skillName?: string;
    rollResult?: number;
    targetNumber: number;
    testModifier?: number;
    successLevel?: number;
    weaponName?: string;
    weaponDamage?: number;
    usedTalents?: UsedTalent[];
}

export interface ResolvedOpposedRoll {
    skillId: string;
    skillName?: string;
    rollResult: number;
    targetNumber: number;
    successLevel: number;
    roundedSuccessLevel: number;
    weaponName?: string;
    weaponDamage?: number;
    usedTalents: UsedTalent[];
}

export interface DamageHit {
    attackerId: string;
    defenderId: string;
    skillId: string;
    slDifference: number;
    weaponDamage: number;
    attackRoll?: number;
    hitLocation?: string;
    usedTalents?: UsedTalent[];
}

export interface MeleeAttackAction {
    attackerId: string;
    defenderId: string;
    attacker: OpposedRollInput;
    defender: OpposedRollInput;
    combatMode?: boolean;
    generatesAdvantage?: boolean;
    grantAdvantage?: boolean;
}

export interface CombatEngineResult {
    state: CombatState;
    events: CombatEvent[];
}

export type CombatOutcome = 'attacker' | 'defender' | 'tie';
export type MovementMode = 'walk' | 'run' | 'charge';

export interface CombatEventBase<TType extends string, TData> {
    type: TType;
    i18nKey: string;
    data: TData;
}

export type AttackResolvedEvent = CombatEventBase<'AttackResolved', {
    attackerId: string;
    defenderId: string;
    attackerName: string;
    defenderName: string;
    attackerRoll: ResolvedOpposedRoll;
    defenderRoll: ResolvedOpposedRoll;
    outcome: CombatOutcome;
    winnerId?: string;
    slDifference: number;
    hitLocation?: string;
}>;

export type DamageDealtEvent = CombatEventBase<'DamageDealt', {
    attackerId: string;
    defenderId: string;
    defenderName: string;
    hitLocation: string;
    rawDamage: number;
    damageDealt: number;
    toughnessBonus: number;
    armourPoints: number;
    woundsBefore: number;
    woundsAfter: number;
}>;

export type ConditionAppliedEvent = CombatEventBase<'ConditionApplied', {
    targetId: string;
    conditionId: string;
    stacks: number;
}>;

export type CritRolledEvent = CombatEventBase<'CritRolled', {
    combatantId: string;
    role?: 'attacker' | 'defender' | 'target';
    trigger: 'roll' | 'zeroWounds';
    roll?: number;
    targetNumber?: number;
    critRoll: number;
    hitLocation?: string;
}>;

export type FumbleRolledEvent = CombatEventBase<'FumbleRolled', {
    combatantId: string;
    role?: 'attacker' | 'defender';
    roll: number;
    targetNumber: number;
    fumbleRoll: number;
}>;

export type ResourceSpentEvent = CombatEventBase<'ResourceSpent', {
    combatantId: string;
    resource: keyof CombatantResources;
    amount: number;
    remaining: number;
}>;

export type AdvantageChangedEvent = CombatEventBase<'AdvantageChanged', {
    side: SideId;
    delta: number;
    poolBefore: number;
    poolAfter: number;
    total: number;
    reason: 'opposedTestWin' | 'spendActionWin' | 'spendActionLoss' | 'seed' | 'reallocation' | 'condition' | 'manual';
    sourceCombatantId?: string;
}>;

export type AdvantageSpentEvent = CombatEventBase<'AdvantageSpentEvent', {
    side: SideId;
    action: string;
    amount: number;
    poolBefore: number;
    poolAfter: number;
    actorId?: string;
}>;

export type AdvantageSpendRejectedEvent = CombatEventBase<'AdvantageSpendRejectedEvent', {
    side: SideId;
    action: string;
    cost: number;
    available: number;
    reason: 'insufficientAdvantage' | 'missingActor' | 'missingTarget' | 'alreadyUsedThisTurn' | 'invalidAmount';
}>;

export type AdvantageActionResolvedEvent = CombatEventBase<'AdvantageActionResolvedEvent', {
    side: SideId;
    action: string;
    outcome: 'win' | 'loss' | 'applied';
    actorId?: string;
    targetId?: string;
    actorRoll?: number;
    targetRoll?: number;
    actorSuccessLevel?: number;
    targetSuccessLevel?: number;
    generatesAdvantage: false;
}>;

export type AdvantageModifierPreparedEvent = CombatEventBase<'AdvantageModifierPreparedEvent', {
    side: SideId;
    action: 'additionalEffort';
    amount: number;
    modifier: number;
    pendingTestId?: string;
    actorId?: string;
    generatesAdvantage: false;
}>;

export type AdvantageReallocatedEvent = CombatEventBase<'AdvantageReallocatedEvent', {
    dominantSide?: SideId;
    suppressedSide?: SideId;
    reason: 'livingCombatants' | 'tacticalTie' | 'noDominantSide';
    transferred: boolean;
    pools: AdvantagePools;
}>;

export type MovedEvent = CombatEventBase<'MovedEvent', {
    combatantId: string;
    combatantName: string;
    mode: MovementMode;
    from: number;
    to: number;
    distance: number;
    actionSpent: boolean;
    remainingMovement: number;
}>;

export type MoveRejectedEvent = CombatEventBase<'MoveRejectedEvent', {
    combatantId: string;
    combatantName: string;
    mode: MovementMode;
    from: number;
    to: number;
    distance: number;
    reason: 'engaged' | 'noMove' | 'noAction' | 'insufficientBudget';
}>;

export type EngagedEvent = CombatEventBase<'EngagedEvent', {
    aId: string;
    bId: string;
    aName: string;
    bName: string;
    distance: number;
}>;

export type DisengagedEvent = CombatEventBase<'DisengagedEvent', {
    combatantId: string;
    combatantName: string;
    disengagedFromIds: string[];
    actionSpent: boolean;
}>;

export type CombatEvent =
    | AttackResolvedEvent
    | DamageDealtEvent
    | ConditionAppliedEvent
    | CritRolledEvent
    | FumbleRolledEvent
    | ResourceSpentEvent
    | AdvantageChangedEvent
    | AdvantageSpentEvent
    | AdvantageSpendRejectedEvent
    | AdvantageActionResolvedEvent
    | AdvantageModifierPreparedEvent
    | AdvantageReallocatedEvent
    | MovedEvent
    | MoveRejectedEvent
    | EngagedEvent
    | DisengagedEvent;
