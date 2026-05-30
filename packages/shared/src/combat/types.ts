import type { Armor, Character, ConditionInstance, Status, Talent, Weapon } from '../types/wfrp.types';

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
    conditionInstances?: ConditionInstance[];
    resources: CombatantResources;
}

export interface CombatTurnFlags {
    additionalActionCombatantIds: string[];
    chargedCombatantIds: string[];
}

export interface CombatEngagement {
    aId: string;
    bId: string;
    lastAttackRound: number;
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
    engagements: Record<string, CombatEngagement>;
}

export interface UsedTalent {
    name: string;
    rank: number;
}

export interface OpposedRollInput {
    skillId: string;
    skillName?: string;
    weaponId?: string;
    rollResult?: number;
    targetNumber: number;
    testModifier?: number;
    successLevel?: number;
    weaponName?: string;
    weaponDamage?: number;
    weaponDamageFormula?: string;
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
    weaponId?: string;
    weaponDamageFormula?: string;
    usedTalents: UsedTalent[];
}

export interface DamageHit {
    attackerId: string;
    defenderId: string;
    skillId: string;
    slDifference: number;
    weaponDamage: number;
    attackRoll?: number;
    defenderSuccessLevel?: number;
    hitLocation?: string;
    usedTalents?: UsedTalent[];
    disableMinimumWound?: boolean;
    hooks?: Partial<MeleeResolutionHooks>;
    sl?: number;
    isCharging?: boolean;
}

export interface MeleeAttackAction {
    attackerId: string;
    defenderId: string;
    attacker: OpposedRollInput;
    defender: OpposedRollInput;
    combatMode?: boolean;
    generatesAdvantage?: boolean;
    grantAdvantage?: boolean;
    isCharging?: boolean;
    chosenHitLocation?: string;
    attackerSize?: CombatantSize;
    defenderSize?: CombatantSize;
    disableMinimumWound?: boolean;
    hooks?: Partial<MeleeResolutionHooks>;
}

export interface CombatEngineResult {
    state: CombatState;
    events: CombatEvent[];
}

export type CombatOutcome = 'attacker' | 'defender' | 'tie';
export type MovementMode = 'walk' | 'run' | 'charge';
export type CombatantSize = 'tiny' | 'little' | 'small' | 'average' | 'large' | 'enormous' | 'monstrous';
export type ModifierPhase = 'preRollModifiers' | 'slModifiers' | 'damageModifiers' | 'apModifiers';
export type ModifierSourceType =
    | 'condition'
    | 'outnumbering'
    | 'weaponLength'
    | 'size'
    | 'charging'
    | 'range'
    | 'cover'
    | 'group'
    | 'advantage'
    | 'talent'
    | 'quality'
    | 'manual';

export interface ModifierSource {
    id: string;
    type: ModifierSourceType;
    phase: ModifierPhase;
    label?: string;
    value: number;
    combatantId?: string;
}

export interface ModifierTotal {
    sources: ModifierSource[];
    uncappedBonus: number;
    uncappedPenalty: number;
    cappedBonus: number;
    cappedPenalty: number;
    total: number;
}

export interface MeleeHookContext {
    state: CombatState;
    action: MeleeAttackAction;
    attacker: Combatant;
    defender: Combatant;
}

export interface SlModifierContext extends MeleeHookContext {
    attackerRoll: ResolvedOpposedRoll;
    defenderRoll?: ResolvedOpposedRoll;
}

export interface DamageModifierContext extends SlModifierContext {
    hitLocation: string;
    weaponDamage: number;
    attackerSuccessLevel: number;
    defenderSuccessLevel?: number;
}

export interface ApModifierContext extends DamageModifierContext {
    armourPoints: number;
}

export interface OnHitContext extends ApModifierContext {
    damageDealt: number;
    woundsBefore: number;
    woundsAfter: number;
}

export interface OnHitEffectResult extends CombatEngineResult {
    suppressNormalDamage?: boolean;
}

export interface CritResolverContext extends OnHitContext {
    trigger: 'roll' | 'zeroWounds' | 'unconsciousAuto' | 'fumbleInjury';
    combatantId: string;
    role?: 'attacker' | 'defender' | 'target';
    roll?: number;
    targetNumber?: number;
    woundsBeyondZero?: number;
}

export interface CritHookContext extends CritResolverContext {
    resultRoll?: number;
    locationRoll?: number;
}

export interface MeleeResolutionHooks {
    preRollModifiers(context: MeleeHookContext): ModifierSource[];
    slModifiers(context: SlModifierContext): number;
    damageModifiers(context: DamageModifierContext): number;
    apModifiers(context: ApModifierContext): number;
    onHitEffects(context: OnHitContext): OnHitEffectResult | CombatEvent[];
    critTriggerExtensions(context: CritResolverContext): boolean;
    critIgnoreConditions(context: CritResolverContext): boolean;
    critApModifiers(context: CritHookContext): number;
    onCritEffects(context: CritHookContext): OnHitEffectResult | CombatEvent[];
    fumbleTriggers(context: SlModifierContext): boolean;
    critResolver(context: CritResolverContext): OnHitEffectResult | CombatEvent[];
}

export interface QualityActivation {
    trigger: 'onHit' | 'onDefend' | 'onCrit';
    cost?: { resource: 'advantage'; amount: number };
    effect: string;
    gate?: string;
    policy?: 'always' | 'never';
}

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
    modifiers?: ModifierTotal;
    defenderCanCrit?: boolean;
    defenderAvoidsOnly?: boolean;
    collapsed?: 'none' | 'surprised' | 'unconscious';
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
    minimumOneWoundApplied: boolean;
    woundsBeyondZero: number;
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
    trigger: 'roll' | 'zeroWounds' | 'unconsciousAuto' | 'fumbleInjury';
    roll?: number;
    targetNumber?: number;
    critRoll: number;
    hitLocation?: string;
    woundsBeyondZero?: number;
}>;

export type CriticalWoundResolvedEvent = CombatEventBase<'CriticalWoundResolved', {
    combatantId: string;
    location: string;
    tableRoll: number;
    modifiedRoll: number;
    modifier: number;
    name: string;
    wounds: number | 'death';
    trivial: boolean;
}>;

export type CriticalEffectAppliedEvent = CombatEventBase<'CriticalEffectApplied', {
    combatantId: string;
    effect: string;
    conditionId?: string;
    amount?: number;
    location?: string;
}>;

export type InjuryRecordedEvent = CombatEventBase<'InjuryRecorded', {
    combatantId: string;
    injuryType: string;
    severity: string;
    location: string;
    penalty?: number;
    movementHalved?: boolean;
}>;

export type CombatantDiedEvent = CombatEventBase<'CombatantDied', {
    combatantId: string;
    reason: 'criticalWound' | 'accumulatedCriticals' | 'coupDeGrace' | 'suddenDeath';
}>;

export type QualityEffectAppliedEvent = CombatEventBase<'QualityEffectApplied', {
    combatantId: string;
    targetId?: string;
    qualityId: string;
    effect: string;
    amount?: number;
    activation?: QualityActivation;
}>;

export type FumbleRolledEvent = CombatEventBase<'FumbleRolled', {
    combatantId: string;
    role?: 'attacker' | 'defender';
    roll: number;
    targetNumber: number;
    fumbleRoll: number;
}>;

export type FumbleResolvedEvent = CombatEventBase<'FumbleResolved', {
    combatantId: string;
    role?: 'attacker' | 'defender';
    roll: number;
    effect: string;
    description: string;
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

export type MeleeHookPhaseEvent = CombatEventBase<'MeleeHookPhase', {
    phase: keyof MeleeResolutionHooks;
    sources?: number;
    modifier?: number;
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
    | CriticalWoundResolvedEvent
    | CriticalEffectAppliedEvent
    | InjuryRecordedEvent
    | CombatantDiedEvent
    | QualityEffectAppliedEvent
    | FumbleRolledEvent
    | FumbleResolvedEvent
    | ResourceSpentEvent
    | AdvantageChangedEvent
    | AdvantageSpentEvent
    | AdvantageSpendRejectedEvent
    | AdvantageActionResolvedEvent
    | AdvantageModifierPreparedEvent
    | AdvantageReallocatedEvent
    | MeleeHookPhaseEvent
    | MovedEvent
    | MoveRejectedEvent
    | EngagedEvent
    | DisengagedEvent;
