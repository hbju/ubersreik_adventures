import { ConditionEffectEvent } from '..';
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
    defensiveBonus?: DefensiveBonusState;
    weaponLoadout?: WeaponLoadout;
    weaponAmmo?: Record<string, WeaponAmmoState>;
    ammunition?: Record<string, number>;
    aimedRangedAttack?: boolean;
    initiativeOverride?: boolean;
    removedFromEncounter?: boolean;
    cannotGenerateAdvantageUntilRound?: number;
    feintBuffs?: FeintBuff[];
    reversalActive?: boolean;
    dualWieldDefensivePenalty?: boolean;
    disarmedWeaponIds?: string[];
}

export interface FeintBuff {
    opponentId: string;
    slBonus: number;
    expiresEndOfRound: number;
}

export interface CombatTurnFlags {
    additionalActionCombatantIds: string[];
    chargedCombatantIds: string[];
    talentExtraAttackCombatantIds: string[];
    shieldsmanUsedThisTurnIds: string[];
    reactionStrikeChargerPairs: string[];
}

export interface DefensiveBonusState {
    skillId: string;
    bonus: number;
    activeUntilRound: number;
}

export interface WeaponLoadout {
    primaryWeaponId?: string;
    secondaryWeaponId?: string;
}

export interface CombatEngagement {
    aId: string;
    bId: string;
    lastAttackRound: number;
    infightingMode?: boolean;
    grappling?: boolean;
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
    ammoPolicy?: AmmoPolicy;
}

export interface AmmoPolicy {
    finiteAmmo?: boolean;
}

export interface ExtendedTestProgress {
    accumulatedSL: number;
    targetSL: number;
}

export interface WeaponAmmoState {
    loaded: boolean;
    shotsRemaining?: number;
    reloadProgress: ExtendedTestProgress | null;
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
    criticalHit?: boolean;
    fatePolicy?: ResourceSpendPolicy;
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
    hand?: 'primary' | 'secondary';
    isGrappleDamage?: boolean;
    isExtraAttack?: boolean;
    fatePolicy?: ResourceSpendPolicy;
}

export type CombatActionCost = 'action' | 'move' | 'free';

export type CombatActionKind =
    | 'attack'
    | 'move'
    | 'run'
    | 'charge'
    | 'aim'
    | 'reload'
    | 'assess'
    | 'defend'
    | 'sprint'
    | 'firstAid'
    | 'infighting'
    | 'disengageDodge'
    | 'grappleInitiate'
    | 'grappleMaintain'
    | 'grappleBreak'
    | 'attackWithBoth'
    | 'beatBlade'
    | 'disarm'
    | 'feint'
    | 'distractOpponent';

export interface CombatActionDefinition {
    kind: CombatActionKind;
    cost: CombatActionCost;
    generatesAdvantage: boolean;
}

export type ResourceSpendPolicy = 'always' | 'never' | 'stub';

export type FortuneSpendAction = 'reroll' | 'plusOneSl' | 'actFirst';

export type FateSpendAction = 'dieAnotherDay' | 'howDidThatMiss';

export interface CombatActionRequest {
    kind: CombatActionKind;
    actorId: string;
    targetId?: string;
    skillId?: string;
    targetNumber?: number;
    rollResult?: number;
    opponentRollResult?: number;
    opponentTargetNumber?: number;
    opponentSkillId?: string;
    infightingMode?: 'normal' | 'infighting';
    moveTarget?: number | { position: number } | { combatantId: string };
    pendingTestId?: string;
    policy?: ResourceSpendPolicy;
    secondaryTargetId?: string;
    defenderRollResult?: number;
    defenderTargetNumber?: number;
    defenderSkillId?: string;
    reversalActive?: boolean;
    ranged?: RangedAttackRequest;
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

export type RangedRangeBand = 'pointBlank' | 'short' | 'normal' | 'long' | 'extreme' | 'outOfRange';
export type CoverLevel = 'none' | 'soft' | 'medium' | 'hard';
export type RangedDefenceKind = 'shieldParry' | 'shieldBasic' | 'pointBlankDodge' | 'engagedMelee';

export interface RangedDefenceOption {
    kind: RangedDefenceKind;
    skillId: string;
    modifier: number;
    reason: 'shield2Plus' | 'pointBlank' | 'shooterEngagedWithTarget';
}

export interface RangedAttackAction {
    attackerId: string;
    defenderId: string;
    attacker: OpposedRollInput;
    defender?: OpposedRollInput;
    distance?: number;
    cover?: CoverLevel;
    shootingWhileMoving?: boolean;
    darkness?: boolean;
    aimed?: boolean;
    chosenHitLocation?: string;
    attackerSize?: CombatantSize;
    defenderSize?: CombatantSize;
    defenceKind?: RangedDefenceKind;
    generatesAdvantage?: boolean;
    grantAdvantage?: boolean;
    finiteAmmo?: boolean;
    damageModifier?: number;
    weaponRangeOverride?: number;
    skipAmmoConsumption?: boolean;
    hooks?: Partial<MeleeResolutionHooks>;
    fatePolicy?: ResourceSpendPolicy;
}

export type IntoMeleeMode = 'specific' | 'groupFriendlyFire';

export interface RangedGroupAttackAction extends Omit<RangedAttackAction, 'defenderId'> {
    candidateTargetIds: string[];
}

export interface RangedIntoMeleeAttackAction extends RangedAttackAction {
    enabled?: boolean;
    mode?: IntoMeleeMode;
}

export interface RangedAreaAttackAction extends RangedAttackAction {
    targetPoint?: number;
}

export type RangedMultiTargetResolvedEvent = CombatEventBase<'RangedMultiTargetResolved', {
    attackerId: string;
    primaryTargetId?: string;
    targetIds: string[];
    mode: 'group' | 'intoMelee' | 'blast' | 'spread' | 'thrown';
    rangeBand?: RangedRangeBand;
    rating?: number;
}>;

export type LodgedAmmunitionRecordedEvent = CombatEventBase<'LodgedAmmunitionRecorded', {
    attackerId: string;
    defenderId: string;
    weaponId?: string;
    removalTest: 'healChallenging';
}>;

export interface RangedAttackRequest extends Partial<Omit<RangedAttackAction, 'attackerId' | 'defenderId' | 'attacker'>> {
    defenderId: string;
    skillId?: string;
    targetNumber?: number;
    rollResult?: number;
    weaponId?: string;
    weaponDamage?: number;
    weaponDamageFormula?: string;
}

export interface ReloadAction {
    actorId: string;
    weaponId: string;
    skillId?: string;
    targetNumber?: number;
    rollResult?: number;
    testModifier?: number;
    hooks?: Partial<ReloadResolutionHooks>;
}

export interface ReloadHookContext {
    state: CombatState;
    actor: Combatant;
    weaponId: string;
    weaponGroup: string;
    weaponQualities: string[];
    skillId: string;
}

export interface ReloadResolutionHooks {
    reloadSlModifiers(context: ReloadHookContext): number;
}

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
    criticalHit?: boolean;
}

export interface DamageMultiplierContext extends DamageModifierContext {
    rawDamage: number;
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
    damageMultiplier(context: DamageMultiplierContext): number;
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
    trigger: 'onHit' | 'onDefend' | 'onCrit' | 'reaction' | 'postRoll' | 'economy';
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
    spendAction?: FortuneSpendAction | FateSpendAction;
}>;

export type FortuneSpendRejectedEvent = CombatEventBase<'FortuneSpendRejectedEvent', {
    combatantId: string;
    action: FortuneSpendAction;
    reason: 'insufficientFortune' | 'policyRejected' | 'missingActor' | 'testAlreadySucceeded';
}>;

export type FortuneModifierPreparedEvent = CombatEventBase<'FortuneModifierPreparedEvent', {
    combatantId: string;
    action: FortuneSpendAction;
    pendingTestId?: string;
    reroll?: boolean;
    slBonus?: number;
    actFirst?: boolean;
}>;

export type FateSpendRejectedEvent = CombatEventBase<'FateSpendRejectedEvent', {
    combatantId: string;
    action: FateSpendAction;
    reason: 'insufficientFate' | 'policyRejected' | 'missingActor' | 'notApplicable';
}>;

export type FateInterceptionEvent = CombatEventBase<'FateInterceptionEvent', {
    combatantId: string;
    action: FateSpendAction;
    intercepted: 'death' | 'damage';
    damageNegated?: number;
    removedFromEncounter?: boolean;
}>;

export type CombatActionResolvedEvent = CombatEventBase<'CombatActionResolved', {
    kind: CombatActionKind;
    actorId: string;
    targetId?: string;
    outcome: 'success' | 'failure' | 'applied' | 'partial';
    advantageGranted?: number;
    distanceMoved?: number;
    infightingMode?: boolean;
    grappling?: boolean;
    generatesAdvantage: boolean;
}>;

export type CombatActionRejectedEvent = CombatEventBase<'CombatActionRejected', {
    kind: CombatActionKind;
    actorId: string;
    reason: 'noAction' | 'noMove' | 'missingTarget' | 'missingSkill' | 'notEngaged' | 'notGrappling' | 'invalidLoadout';
}>;

export type RangedShotRejectedEvent = CombatEventBase<'RangedShotRejected', {
    attackerId: string;
    defenderId?: string;
    reason: 'engagedWithoutPistol' | 'outOfRange' | 'missingWeapon' | 'missingTarget' | 'unloaded' | 'reloading' | 'outOfAmmo' | 'weaponUnusable';
    rangeBand?: RangedRangeBand;
    distance?: number;
    weaponId?: string;
}>;

export type RangedMisfireEvent = CombatEventBase<'RangedMisfire', {
    attackerId: string;
    weaponId?: string;
    roll: number;
    unitsDie: number;
    hitLocation: 'Primary Arm';
    weaponDestroyed: true;
}>;

export type AmmoStateChangedEvent = CombatEventBase<'AmmoStateChanged', {
    combatantId: string;
    weaponId: string;
    loaded: boolean;
    shotsRemaining?: number;
    reloadProgress: ExtendedTestProgress | null;
    ammunitionRemaining?: number;
    reason: 'fired' | 'reloadStarted' | 'reloadProgress' | 'reloaded' | 'interrupted';
}>;

export type ReloadTestResolvedEvent = CombatEventBase<'ReloadTestResolved', {
    combatantId: string;
    weaponId: string;
    skillId: string;
    roll: number;
    targetNumber: number;
    successLevel: number;
    slModifier: number;
    accumulatedSL: number;
    targetSL: number;
    completed: boolean;
}>;

export type BlowToBackAttackEvent = CombatEventBase<'BlowToBackAttackEvent', {
    attackerId: string;
    defenderId: string;
    freeAttack: true;
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

export type CombatantRemovedFromEncounterEvent = CombatEventBase<'CombatantRemovedFromEncounter', {
    combatantId: string;
    reason: 'dieAnotherDay';
}>;

export type TalentEffectAppliedEvent = CombatEventBase<'TalentEffectApplied', {
    combatantId: string;
    targetId?: string;
    talentId: string;
    effect: string;
    trigger?: QualityActivation['trigger'];
    amount?: number;
    primaryRoll?: number;
    secondaryRoll?: number;
    primaryHit?: boolean;
    secondaryHit?: boolean;
    policy?: 'always' | 'never';
    deferred?: boolean;
}>;

export type TalentActivationRejectedEvent = CombatEventBase<'TalentActivationRejected', {
    combatantId: string;
    targetId?: string;
    talentId: string;
    reason: 'missingTalent' | 'policyRejected' | 'insufficientAdvantage' | 'invalidTrigger' | 'missingTarget' | 'invalidLoadout';
}>;

export type TalentReactionRegisteredEvent = CombatEventBase<'TalentReactionRegistered', {
    combatantId: string;
    talentId: string;
    window: 'winningDefence' | 'charged' | 'postRoll' | 'extraAttack';
    policy: 'always' | 'never';
}>;

export type ReactionTrigger =
    | 'attacked-in-melee'
    | 'charged'
    | 'test-rolled'
    | 'test-failed'
    | 'won-Dodge-defence'
    | 'won-defensive-Melee'
    | 'scored-a-defensive-crit'
    | 'damage-about-to-apply'
    | 'would-die';

export type ReactionKind =
    | 'riposte'
    | 'reactionStrike'
    | 'stepAside'
    | 'shieldsman'
    | 'reversal'
    | 'slashExtraBleeding'
    | 'howDidThatMiss'
    | 'dieAnotherDay'
    | 'fortuneReroll'
    | 'fortunePlusOneSl';

export type ReactionOfferedEvent = CombatEventBase<'ReactionOffered', {
    trigger: ReactionTrigger;
    actorId: string;
    targetId?: string;
    reaction: ReactionKind;
    initiativeIndex?: number;
}>;

export type ReactionResolvedEvent = CombatEventBase<'ReactionResolved', {
    trigger: ReactionTrigger;
    actorId: string;
    targetId?: string;
    reaction: ReactionKind;
    chosen: boolean;
    depth: number;
}>;

export type AdvantageGainBlockedEvent = CombatEventBase<'AdvantageGainBlocked', {
    combatantId: string;
    side: SideId;
    reason: 'cannotGenerateAdvantage';
}>;

export type CombatEvent =
    | AttackResolvedEvent
    | DamageDealtEvent
    | ConditionAppliedEvent
    | ConditionEffectEvent
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
    | DisengagedEvent
    | FortuneSpendRejectedEvent
    | FortuneModifierPreparedEvent
    | FateSpendRejectedEvent
    | FateInterceptionEvent
    | CombatActionResolvedEvent
    | CombatActionRejectedEvent
    | RangedShotRejectedEvent
    | RangedMisfireEvent
    | AmmoStateChangedEvent
    | ReloadTestResolvedEvent
    | RangedMultiTargetResolvedEvent
    | LodgedAmmunitionRecordedEvent
    | BlowToBackAttackEvent
    | CombatantRemovedFromEncounterEvent
    | TalentEffectAppliedEvent
    | TalentActivationRejectedEvent
    | TalentReactionRegisteredEvent
    | ReactionOfferedEvent
    | ReactionResolvedEvent
    | AdvantageGainBlockedEvent;
