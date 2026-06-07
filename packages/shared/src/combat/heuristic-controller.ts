import { calculateCharacteristicValue } from '../utils/skills';
import { hasQuality } from './qualities';
import type { Rng } from './rng';
import type {
    Combatant,
    CombatState,
    DecisionLogEntry,
    MeleeAttackAction,
    OpposedRollInput,
    RangedAttackAction,
} from './types';
import type {
    CombatantController,
    CombatDecision,
    DecisionContext,
    LegalDecision,
} from './turn-engine';
import { resolveWeaponUse } from './proficiency';
import { additionalEffortTestModifier } from './advantage';

export type HeuristicProfileId = 'berserker' | 'duellist' | 'skirmisher' | 'marksman' | 'brute';

export interface HeuristicProfile {
    id: HeuristicProfileId;
    label: string;
    intent: string;
    aggression: number;
    rangePreference: number;
    kite: number;
    defendWhenWounded: number;
    focusFire: number;
    threatFocus: number;
    resourceRiskThreshold: number;
    reactionAggression: number;
}

export const heuristicProfiles: Record<HeuristicProfileId, HeuristicProfile> = {
    berserker: {
        id: 'berserker',
        label: 'Berserker',
        intent: 'Closes immediately, spends aggressively, and prefers decisive melee pressure.',
        aggression: 1,
        rangePreference: 0,
        kite: 0,
        defendWhenWounded: 0.1,
        focusFire: 0.4,
        threatFocus: 0.6,
        resourceRiskThreshold: 0.15,
        reactionAggression: 1,
    },
    duellist: {
        id: 'duellist',
        label: 'Duellist',
        intent: 'Seeks clean melee exchanges, values Riposte and Defend when under pressure.',
        aggression: 0.65,
        rangePreference: 0.15,
        kite: 0.25,
        defendWhenWounded: 0.55,
        focusFire: 0.65,
        threatFocus: 0.65,
        resourceRiskThreshold: 0.35,
        reactionAggression: 0.8,
    },
    skirmisher: {
        id: 'skirmisher',
        label: 'Skirmisher',
        intent: 'Avoids being pinned, disengages when pressed, and repositions before trading.',
        aggression: 0.45,
        rangePreference: 0.55,
        kite: 0.85,
        defendWhenWounded: 0.65,
        focusFire: 0.45,
        threatFocus: 0.45,
        resourceRiskThreshold: 0.45,
        reactionAggression: 0.55,
    },
    marksman: {
        id: 'marksman',
        label: 'Marksman',
        intent: 'Keeps distance, shoots when able, reloads/aims instead of joining melee.',
        aggression: 0.5,
        rangePreference: 1,
        kite: 0.9,
        defendWhenWounded: 0.7,
        focusFire: 0.75,
        threatFocus: 0.35,
        resourceRiskThreshold: 0.4,
        reactionAggression: 0.35,
    },
    brute: {
        id: 'brute',
        label: 'Brute',
        intent: 'Uses a sensible greedy policy: attack the best target and spend when obviously useful.',
        aggression: 0.7,
        rangePreference: 0.25,
        kite: 0.2,
        defendWhenWounded: 0.35,
        focusFire: 0.5,
        threatFocus: 0.5,
        resourceRiskThreshold: 0.3,
        reactionAggression: 0.65,
    },
};

export interface HeuristicControllerOptions {
    profile?: HeuristicProfileId | HeuristicProfile;
}

export class HeuristicController implements CombatantController {
    readonly profile: HeuristicProfile;

    constructor(options: HeuristicControllerOptions = {}) {
        this.profile = typeof options.profile === 'object'
            ? options.profile
            : heuristicProfiles[options.profile ?? 'brute'];
    }

    choose(context: DecisionContext): CombatDecision | undefined {
        const legal = context.legalDecisions;
        if (legal.length === 0) return undefined;
        if (context.level === 'resolution') return this.chooseResolution(context, legal);
        return this.chooseTurn(context, legal);
    }

    private chooseResolution(context: DecisionContext, legal: LegalDecision[]): CombatDecision {
        const reason = context.reason ?? '';
        const reactions = legal.filter(decision => decision.kind === 'reaction');
        if (reactions.length > 0) {
            const chosen = this.chooseReaction(context, reactions);
            return withLog(chosen, reasonCodeForReaction(chosen, reason, this.profile), legal);
        }

        if (reason === 'qualityActivation') {
            const spend = legal.find(decision => decision.kind === 'spendAdvantage');
            const wait = legal.find(decision => decision.kind === 'wait') ?? legal[0];
            const chosen = this.profile.aggression + this.profile.reactionAggression >= 1 && spend ? spend : wait;
            return withLog(chosen, spend && chosen === spend ? 'spend.quality' : 'decline.quality', legal);
        }

        if (reason === 'shieldsmanMode') {
            const mode = this.profile.kite > this.profile.aggression ? 'push' : 'damage';
            const chosen = legal.find(decision => decision.shieldsmanMode === mode) ?? legal[0];
            return withLog(chosen, `subdecision.shieldsman.${mode}`, legal);
        }

        if (reason === 'reversalToggle') {
            const chosen = legal.find(decision => decision.reversalActive !== false) ?? legal[0];
            return withLog(chosen, 'subdecision.reversal.on', legal);
        }

        if (reason === 'infightingMode') {
            const chosen = legal.find(decision => decision.infightingMode === (this.profile.aggression > 0.6 ? 'infighting' : 'normal')) ?? legal[0];
            return withLog(chosen, `subdecision.infighting.${chosen.infightingMode ?? 'normal'}`, legal);
        }

        if (reason === 'dualWielderTarget') {
            const targetId = this.bestTargetId(context.state, context.actor, legal.flatMap(decision => decision.secondaryTargetId ? [decision.secondaryTargetId] : []));
            const chosen = legal.find(decision => decision.secondaryTargetId === targetId) ?? legal[0];
            return withLog(chosen, 'target.focusFire', legal);
        }

        return withLog(legal[0], 'competence.firstLegalResolution', legal);
    }

    private chooseReaction(context: DecisionContext, legal: LegalDecision[]): CombatDecision {
        const reason = context.reason ?? '';
        const byReaction = (reaction: string) => legal.find(decision => decision.reaction === reaction);

        if (reason.includes('would-die')) return byReaction('dieAnotherDay') ?? legal[0];
        if (reason.includes('damage-about-to-apply')) return byReaction('howDidThatMiss') ?? legal[0];
        if (reason.includes('test-failed') && consequentialTest(context)) return byReaction('fortuneReroll') ?? legal[0];
        if (reason.includes('test-rolled') && consequentialTest(context) && this.profile.resourceRiskThreshold >= 0.35) return byReaction('fortunePlusOneSl') ?? legal[0];
        if (byReaction('reactionStrike') && this.profile.reactionAggression >= 0.35) return byReaction('reactionStrike')!;
        if (byReaction('riposte') && this.profile.reactionAggression >= 0.5) return byReaction('riposte')!;
        if (byReaction('stepAside') && (this.profile.kite >= 0.6 || woundedRatio(context.actor) <= this.profile.defendWhenWounded)) return byReaction('stepAside')!;
        if (byReaction('shieldsman') && this.profile.reactionAggression >= 0.45) return byReaction('shieldsman')!;
        if (byReaction('reversal') && this.profile.reactionAggression >= 0.45) return byReaction('reversal')!;
        if (byReaction('slashExtraBleeding') && this.profile.aggression >= 0.55) return byReaction('slashExtraBleeding')!;
        return legal[0];
    }

    private chooseTurn(context: DecisionContext, legal: LegalDecision[]): CombatDecision {
        const actor = context.actor;
        const useful = legal.filter(decision => decision.kind !== 'wait' && decision.kind !== 'endTurn');
        if (useful.length === 0) return withLog(legal[0], 'competence.noUsefulOption', legal);

        const spend = this.chooseAdvantageSpend(context, useful);
        if (spend) return withLog(spend, `advantage.${spend.advantageAction}`, legal);

        if (this.profile.id === 'skirmisher' && actor.engagementIds.length > 0) {
            const disengage = useful.find(decision => decision.kind === 'disengageDodge');
            if (disengage) return withLog(withRequest(disengage), 'profile.skirmisher.disengage', legal);
            const flee = useful.find(decision => decision.kind === 'spendAdvantage' && decision.advantageAction === 'fleeFromHarm');
            if (flee) return withLog(flee, 'profile.skirmisher.fleeFromHarm', legal);
        }

        if (this.profile.id === 'marksman') {
            const ranged = useful.filter(decision => decision.kind === 'rangedAttack');
            if (ranged.length > 0) return withLog(this.materializeRanged(context, ranged), 'profile.marksman.shoot', legal);
            const reload = useful.find(decision => decision.kind === 'reload');
            if (reload) return withLog(withReloadRoll(context, reload), 'profile.marksman.reload', legal);
            const move = useful.find(decision => decision.kind === 'move' && decision.mode !== 'charge');
            if (move) return withLog(move, 'profile.marksman.keepRange', legal);
        }

        if (this.profile.id === 'berserker') {
            const charge = useful.filter(decision => decision.kind === 'move' && decision.mode === 'charge');
            if (charge.length > 0) return withLog(this.materializeCharge(context, charge), 'profile.berserker.charge', legal);
            if (!useful.some(decision => decision.kind === 'meleeAttack')) {
                const bestTarget = this.bestTargetId(context.state, context.actor, candidateTargets(useful.filter(decision => decision.kind === 'move' && decision.mode !== 'charge')));
                if (bestTarget) {
                    const move = useful.filter(decision => decision.kind === 'move' && typeof decision.target === 'number').sort((a, b) => {
                        const distanceA = Math.abs((a.target as number) - context.state.combatants[bestTarget].position);
                        const distanceB = Math.abs((b.target as number) - context.state.combatants[bestTarget].position);
                        return distanceA - distanceB;
                    })[0];
                    if (move) return withLog(move, 'profile.berserker.closeIn', legal);
                }
            }
        }

        if (this.profile.id === 'duellist' && woundedRatio(actor) <= this.profile.defendWhenWounded) {
            const defend = useful.find(decision => decision.kind === 'defend');
            if (defend) return withLog(withRequest(defend), 'profile.duellist.defendWhenPressed', legal);
        }

        const melee = useful.filter(decision => decision.kind === 'meleeAttack');
        if (melee.length > 0) return withLog(this.materializeMelee(context, melee), this.profile.id === 'duellist' ? 'profile.duellist.attack' : 'action.attackBestTarget', legal);

        const ranged = useful.filter(decision => decision.kind === 'rangedAttack');
        if (ranged.length > 0) return withLog(this.materializeRanged(context, ranged), 'action.rangedBestTarget', legal);

        const action = useful.find(decision => decision.kind !== 'move' && decision.kind !== 'spendAdvantage');
        if (action) return withLog(withRequest(action), 'competence.firstUsefulOption', legal);
        
        return actor.engagementIds.filter(id => isActive(context.state.combatants[id])).length > 0 ? withLog(legal.find(decision => decision.kind === 'endTurn') ?? legal[0], 'action.endTurn', legal) : withLog(legal[0], 'competence.firstUsefulOption', legal);
    }

    private chooseAdvantageSpend(context: DecisionContext, legal: LegalDecision[]): LegalDecision | undefined {
        const pool = context.state.advantagePools[context.actor.side];
        if (pool >= 4 && this.profile.aggression >= 0.55) {
            const additional = legal.find(decision => decision.kind === 'spendAdvantage' && decision.advantageAction === 'additionalAction');
            if (additional) return additional;
        }
        if (this.profile.kite >= 0.7 && context.actor.engagementIds.length > 0) {
            const flee = legal.find(decision => decision.kind === 'spendAdvantage' && decision.advantageAction === 'fleeFromHarm');
            if (flee) return flee;
        }
        if (pool >= 2 && context.actor.budget.actions > 0 && this.profile.aggression >= 0.85) {
            return legal.find(decision => decision.kind === 'spendAdvantage' && decision.advantageAction === 'additionalEffort');
        }
        return undefined;
    }

    private materializeMelee(context: DecisionContext, legal: LegalDecision[]): CombatDecision {
        const targetId = this.bestTargetId(context.state, context.actor, candidateTargets(legal)) ?? legal[0].targetId;
        const base = legal.find(decision => decision.targetId === targetId) ?? legal[0];
        const defender = targetId ? context.state.combatants[targetId] : undefined;
        const weapon = primaryWeapon(context.state, context.actor);
        const weaponUse = weapon ? resolveWeaponUse(context.actor, weapon) : undefined;
        return {
            ...base,
            action: {
                attackerId: context.actor.id,
                defenderId: targetId!,
                attacker: rollInput(context, context.actor, weaponUse ? (weaponUse?.test.type === 'skill' ? weaponUse.test.skillId : weaponUse.test.characteristic) : 'melee_basic', weapon?.id),
                defender: rollInput(context, defender, 'melee_basic', primaryWeapon(context.state, defender)?.id),
                isCharging: context.state.turnFlags.chargedCombatantIds.includes(context.actor.id),
                grantAdvantage: additionalEffortTestModifier !== undefined
            },
        };
    }

    private materializeCharge(context: DecisionContext, legal: LegalDecision[]): CombatDecision {
        const targetId = this.bestTargetId(context.state, context.actor, candidateTargets(legal)) ?? legal[0].targetId;
        const base = legal.find(decision => decision.targetId === targetId) ?? legal[0];
        const defender = targetId ? context.state.combatants[targetId] : undefined;
        const weapon = primaryWeapon(context.state, context.actor);
        const weaponUse = weapon ? resolveWeaponUse(context.actor, weapon) : undefined;
        return {
            ...base,
            action: {
            attackerId: context.actor.id,
            defenderId: targetId!,
            attacker: rollInput(context, context.actor, weaponUse ? (weaponUse?.test.type === 'skill' ? weaponUse.test.skillId : weaponUse.test.characteristic) : 'melee_basic', weapon?.id),
                defender: rollInput(context, defender, 'melee_basic', primaryWeapon(context.state, defender)?.id),
                isCharging: true,
            },
        };
    }

    private materializeRanged(context: DecisionContext, legal: LegalDecision[]): CombatDecision {
        const targetId = this.bestTargetId(context.state, context.actor, candidateTargets(legal)) ?? legal[0].targetId;
        const base = legal.find(decision => decision.targetId === targetId) ?? legal[0];
        const weapon = primaryWeapon(context.state, context.actor);
        const action: RangedAttackAction = {
            attackerId: context.actor.id,
            defenderId: targetId!,
            attacker: rollInput(context, context.actor, rangedSkillId(weapon), weapon?.id),
            cover: targetId ? context.state.combatants[targetId]?.cover ?? 'none' : 'none',
            grantAdvantage: additionalEffortTestModifier !== undefined
        };
        return { ...base, action };
    }

    private bestTargetId(state: CombatState, actor: Combatant, candidateIds: string[]): string | undefined {
        const candidates = [...new Set(candidateIds)].map(id => state.combatants[id]).filter((combatant): combatant is Combatant => !!combatant);
        if (candidates.length === 0) return undefined;
        return candidates
            .map(target => ({
                target,
                score: targetScore(state, actor, target, this.profile),
            }))
            .sort((a, b) => b.score - a.score || a.target.id.localeCompare(b.target.id))[0].target.id;
    }
}

export function heuristicControllerFor(profile: HeuristicProfileId | HeuristicProfile = 'brute'): HeuristicController {
    return new HeuristicController({ profile });
}

function withLog<TDecision extends CombatDecision>(decision: TDecision, reasonCode: string, legal: LegalDecision[]): TDecision {
    return {
        ...decision,
        decisionLog: {
            chosen: decisionLabel(decision),
            reasonCode,
            rejectedAlternatives: legal.map(decisionLabel).filter(label => label !== decisionLabel(decision)),
        },
    };
}

function reasonCodeForReaction(decision: CombatDecision, reason: string, profile: HeuristicProfile): string {
    if (reason.includes('would-die')) return 'resource.fateAvoidDeath';
    if (reason.includes('damage-about-to-apply')) return 'resource.fateAvoidDamage';
    if (decision.reaction === 'riposte') return 'reaction.riposte.freeDamage';
    if (decision.reaction === 'reactionStrike') return 'reaction.reactionStrike.preemptCharge';
    if (decision.reaction === 'stepAside') return profile.kite >= 0.6 ? 'reaction.stepAside.kite' : 'reaction.stepAside.defensive';
    if (decision.reaction === 'fortuneReroll') return 'resource.fortuneReroll';
    if (decision.reaction === 'fortunePlusOneSl') return 'resource.fortunePlusOneSl';
    return `reaction.${decision.reaction ?? 'firstLegal'}`;
}

function withRequest(decision: LegalDecision): LegalDecision {
    return decision.request ? decision : { ...decision, request: { kind: decision.kind as any, actorId: decision.actorId, targetId: decision.targetId } };
}

function withReloadRoll(context: DecisionContext, decision: LegalDecision): LegalDecision {
    const action = decision.action && 'weaponId' in decision.action ? decision.action : { actorId: decision.actorId, weaponId: decision.weaponId! };
    return { ...decision, action: { ...action, rollResult: d100(context.rng), targetNumber: skillTarget(context.actor, 'ranged_blackpowder') } };
}

function rollInput(context: DecisionContext, combatant: Combatant | undefined, skillId: string, weaponId?: string): OpposedRollInput {
    return {
        skillId,
        targetNumber: combatant ? skillTarget(combatant, skillId) : 0,
        rollResult: d100(context.rng),
        weaponId,
    };
}

function skillTarget(combatant: Combatant, skillId: string): number {
    const skill = combatant.character.skills.find(candidate => candidate.id === skillId || candidate.name.toLowerCase() === skillId.toLowerCase());
    if (skill) {
        return calculateCharacteristicValue(combatant.character.characteristics[skill.characteristic as keyof typeof combatant.character.characteristics]) + skill.advances + skill.talents + skill.modifier;
    }
    const key = skillId.includes('ranged') ? 'bs' : skillId === 'dodge' ? 'ag' : 'ws';
    return calculateCharacteristicValue(combatant.character.characteristics[key]);
}

function d100(rng: Rng): number {
    return Math.floor(rng.next() * 100) + 1;
}

function candidateTargets(legal: LegalDecision[]): string[] {
    return legal.flatMap(decision => decision.targetId ? [decision.targetId] : decision.targetIds ?? []);
}

function targetScore(state: CombatState, actor: Combatant, target: Combatant, profile: HeuristicProfile): number {
    const distance = Math.abs(actor.position - target.position);
    const wounded = 1 - woundedRatio(target);
    const threat = targetThreat(target);
    const nearest = Math.max(0, 30 - distance) / 30;
    return wounded * profile.focusFire * 60
        + threat * profile.threatFocus
        + nearest * (1 - profile.rangePreference) * 30
        + (target.currentWounds <= 3 ? 25 : 0)
        + (actor.engagementIds.includes(target.id) ? 15 : 0)
        + (state.tacticalDominantSide === target.side ? 5 : 0);
}

function targetThreat(target: Combatant): number {
    const ws = calculateCharacteristicValue(target.character.characteristics.ws);
    const bs = calculateCharacteristicValue(target.character.characteristics.bs);
    const strength = calculateCharacteristicValue(target.character.characteristics.s);
    return Math.max(ws, bs) + strength / 2 + target.currentWounds;
}

function woundedRatio(combatant: Combatant): number {
    return combatant.maxWounds > 0 ? combatant.currentWounds / combatant.maxWounds : 0;
}

function primaryWeapon(state: CombatState, combatant: Combatant | undefined) {
    if (!combatant) return undefined;
    const weaponId = combatant.weaponLoadout?.primaryWeaponId
        ?? Object.entries(combatant.character.inventory.equippedWeapons || {}).find(([, equipped]) => equipped)?.[0];
    return weaponId ? state.weapons.find(weapon => weapon.id === weaponId) : undefined;
}

function rangedSkillId(weapon: ReturnType<typeof primaryWeapon>): string {
    if (!weapon) return 'ranged_bow';
    if (hasQuality(weapon, 'blackpowder') || weapon.group.toLowerCase().includes('blackpowder')) return 'ranged_blackpowder';
    if (weapon.group.toLowerCase().includes('crossbow')) return 'ranged_crossbow';
    if (weapon.group.toLowerCase().includes('throw')) return 'ranged_throwing';
    return 'ranged_bow';
}

function consequentialTest(context: DecisionContext): boolean {
    const actor = context.actor;
    return woundedRatio(actor) <= 0.5 || (actor.resources.fortune?.current ?? 0) > 1 || context.reason?.includes('defence') === true;
}

function decisionLabel(decision: CombatDecision): string {
    const parts: string[] = [decision.kind];
    if (decision.advantageAction) parts.push(decision.advantageAction);
    if (decision.reaction) parts.push(decision.reaction);
    if (decision.targetId) parts.push(`target:${decision.targetId}`);
    if (decision.mode) parts.push(decision.mode);
    return parts.join(':');
}

function isActive(combatant: Combatant | undefined): boolean {
    return !!combatant && combatant.currentWounds > 0 && !combatant.removedFromEncounter && !(combatant as any).dead && !combatant.conditions.includes('condition_unconscious');
}
