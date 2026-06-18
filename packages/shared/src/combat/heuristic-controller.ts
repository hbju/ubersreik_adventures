import { calculateCharacteristicBonus, calculateCharacteristicValue, skillTarget } from '../utils/skills';
import { hasQuality } from './qualities';
import { REACH_ENGAGEMENT_DISTANCE, type WeaponReach } from './spatial';
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
import { activeFearStates, isActivelyAfraidOf, isFrenzied } from './psychology';
import { additionalEffortTestModifier } from './advantage';

/**
 * Scored-policy heuristic.
 *
 * Every legal turn decision is passed through `scoreDecision`, which returns a
 * profile-weighted utility; the controller picks the argmax (deterministic
 * tiebreak on the decision label). Profiles are pure weight vectors that *tune*
 * the shared evaluation rather than *select* which hardcoded branch fires, so
 * every profile considers every legal decision kind.
 *
 * Hard overrides sit on top of scoring: fear-respecting movement filter, the
 * Broken retreat, and "augmenting" advantage spends (which precede the turn's
 * main action and so are chosen in a priority step, not the argmax).
 *
 * `scoreDecision` is intentionally the seed of the flat-MC / MCTS leaf
 * evaluation policy — keep it pure over (state, actor, decision, profile).
 */
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

        if (reason === 'defenceSkill') {
            const intimidate = legal.find(decision => decision.defenceSkill === 'intimidate');
            if (intimidate && skillTarget(context.actor, 'intimidate') >= skillTarget(context.actor, 'melee_basic')) {
                return withLog(intimidate, 'defence.intimidate', legal);
            }
            const dodge = legal.find(decision => decision.defenceSkill === 'dodge');
            if (dodge && this.profile.kite >= 0.6) return withLog(dodge, 'defence.dodge', legal);
            return withLog(legal.find(decision => decision.defenceSkill?.startsWith('melee')) ?? legal[0], 'defence.melee', legal);
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
        const broadlyUseful = legal.filter(decision => decision.kind !== 'wait' && decision.kind !== 'endTurn');
        const fearRespecting = broadlyUseful.filter(decision => !approachesFearedSource(context.state, actor, decision));
        const useful = fearRespecting.length > 0 ? fearRespecting : broadlyUseful;
        if (useful.length === 0) return withLog(legal[0], 'competence.noUsefulOption', legal);

        // Hard override: a Broken combatant flees/cowers and does not act tactically.
        if (actor.conditions.includes('condition_broken') && !isFrenzied(actor)) {
            const retreat = bestRetreatDecision(context.state, actor, useful);
            if (retreat) return withLog(retreat, 'psychology.broken.retreat', legal);
            return withLog(legal.find(decision => decision.kind === 'endTurn') ?? legal[0], 'psychology.broken.noRetreat', legal);
        }

        // Augmenting advantage spends precede the main action (they grant extra
        // actions/bonuses), so they are chosen in a priority step rather than the argmax.
        const augment = this.chooseAugmentSpend(context, useful);
        if (augment) return withLog(augment, augment.advantageAction ? `advantage.${augment.advantageAction}` : 'advantage.spend', legal);

        // Unified scoring across every remaining legal decision.
        const scored = useful
            .map(decision => ({ decision, ...this.scoreDecision(context, decision) }))
            .sort((a, b) => b.score - a.score || decisionLabel(a.decision).localeCompare(decisionLabel(b.decision)));
        const best = scored[0];

        // Nothing is worth doing: end the turn rather than waste it on a negative-value action.
        if (!best || best.score <= 0) {
            const endTurn = legal.find(decision => decision.kind === 'endTurn');
            return withLog(endTurn ?? useful[0], endTurn ? 'action.endTurn' : 'competence.firstUsefulOption', legal);
        }

        return withLog(this.materialize(context, best.decision), best.reason, legal);
    }

    /**
     * Profile-weighted utility for a single legal decision. All decision kinds are
     * scored so every profile considers every option; preconditions that make an
     * action pointless return a negative score (so it loses to ending the turn).
     */
    private scoreDecision(context: DecisionContext, decision: LegalDecision): { score: number; reason: string } {
        const { state, actor } = context;
        const p = this.profile;
        const engaged = actor.engagementIds.some(id => isActive(state.combatants[id]));
        // Kiters do not want to stand and trade blows while pinned.
        const engagedMelee = engaged ? 1 - 0.6 * p.kite : 1;
        const tScore = (candidate: LegalDecision) => {
            const target = candidate.targetId ? state.combatants[candidate.targetId] : undefined;
            return target ? targetScore(state, actor, target, p) : 0;
        };

        switch (decision.kind) {
            case 'frenzyEnter':
                return {
                    score: 300 * p.aggression - 120 * p.rangePreference,
                    reason: 'psychology.frenzy.enter',
                };
            case 'frenzyExit':
                return {
                    score: 20 * (1 - p.aggression),
                    reason: 'psychology.frenzy.exit',
                };
            case 'intimidate': {
                const target = decision.targetId ? state.combatants[decision.targetId] : undefined;
                if (!target || isActivelyAfraidOf(target, actor.id) || isFrenzied(target)) return { score: -1, reason: 'psychology.intimidate' };
                const cool = skillTarget(target, 'cool');
                const lowCool = Math.max(0, 60 - cool);
                const affectedPotential = Math.min(enemyCount(state, actor), Math.max(1, calculateCharacteristicBonus(actor.character.characteristics.s)));
                return {
                    score: (42 + lowCool + affectedPotential * 16 + targetThreat(target) * 0.25) * (0.35 + p.threatFocus) * (0.4 + p.aggression),
                    reason: 'psychology.intimidate',
                };
            }
            case 'leadership': {
                const allies = allyCount(state, actor);
                if (allies === 0) return { score: -1, reason: 'psychology.leadership' };
                const pressure = psychologicalPressure(state, actor);
                const supportBias = 1 - (p.aggression * 0.55);
                return {
                    score: pressure > 0 ? (36 + allies * 14 + pressure * 38) * supportBias : 10 * supportBias,
                    reason: 'psychology.leadership',
                };
            }
            case 'meleeAttack':
                return { score: (120 * (0.5 + p.aggression) + tScore(decision)) * engagedMelee, reason: 'action.attackBestTarget' };
            case 'attackWithBoth':
                return { score: (120 * (0.5 + p.aggression) + tScore(decision) + 12 * p.aggression) * engagedMelee, reason: 'action.dualWield' };
            case 'rangedAttack':
                return { score: 110 * (0.4 + p.rangePreference) + tScore(decision), reason: 'action.rangedBestTarget' };
            case 'move':
                return { score: this.scoreMove(context, decision), reason: decision.mode === 'charge' ? 'profile.charge' : 'move.reposition' };
            case 'defend': {
                if (!engaged) return { score: 6 * p.defendWhenWounded, reason: 'action.defend' };
                const wr = woundedRatio(actor);
                if (wr <= p.defendWhenWounded) return { score: 190 + 60 * (1 - wr), reason: 'defence.whenPressed' };
                return { score: 45 * p.defendWhenWounded * (0.5 + (1 - wr)), reason: 'action.defend' };
            }
            case 'disengageDodge': {
                if (actor.engagementIds.length === 0) return { score: -1, reason: 'action.disengage' };
                const wr = woundedRatio(actor);
                const want = Math.max(p.kite, wr <= p.defendWhenWounded ? 0.9 : 0);
                return { score: want >= 0.6 ? 150 * want : 55 * want, reason: 'profile.disengage' };
            }
            case 'aim':
                return { score: actor.aimedRangedAttack ? -1 : 28 * p.rangePreference, reason: 'action.aim' };
            case 'reload':
                return { score: 95 * (0.3 + p.rangePreference), reason: 'action.reload' };
            case 'firstAid': {
                const ally = mostWoundedAlly(state, actor);
                if (!ally) return { score: -1, reason: 'action.firstAid' };
                return { score: 70 * (1 - woundedRatio(ally)) * (1 - 0.5 * p.aggression), reason: 'support.firstAid' };
            }
            case 'assess':
                return { score: 8 + 8 * p.threatFocus, reason: 'action.assess' };
            case 'infighting':
                return { score: engaged ? 22 * p.aggression * engagedMelee : -1, reason: 'action.infighting' };
            case 'feint':
                return { score: engaged ? 38 * p.threatFocus * (1 - 0.6 * p.aggression) : -1, reason: 'action.feint' };
            case 'disarm':
            case 'beatBlade':
            case 'distractOpponent':
                return { score: engaged ? 30 * p.threatFocus * (1 - 0.6 * p.aggression) : -1, reason: `action.${decision.kind}` };
            case 'grappleInitiate':
                return { score: 14 * p.aggression - 12, reason: 'action.grapple' };
            case 'grappleMaintain':
                return { score: 42 * p.aggression, reason: 'action.grappleMaintain' };
            case 'grappleBreak':
                return { score: 42 * Math.max(p.kite, 1 - woundedRatio(actor)), reason: 'action.grappleBreak' };
            case 'spendAdvantage':
                // Augmenting spends are handled in chooseAugmentSpend; only the
                // "leave combat" spend competes with the main action here.
                return decision.advantageAction === 'fleeFromHarm' && engaged && p.kite >= 0.6
                    ? { score: 120 * p.kite, reason: 'advantage.fleeFromHarm' }
                    : { score: -1, reason: 'advantage.deferred' };
            case 'shieldsman':
                return { score: engaged ? 26 * p.reactionAggression : -1, reason: 'action.shieldsman' };
            case 'reversal':
                return { score: 24 * p.reactionAggression, reason: 'action.reversal' };
            case 'sprint':
                return { score: -1, reason: 'action.sprint' };
            case 'endTurn':
            case 'wait':
                return { score: 0, reason: decision.kind === 'wait' ? 'action.wait' : 'action.endTurn' };
            default:
                return { score: 1, reason: 'competence.firstUsefulOption' };
        }
    }

    private scoreMove(context: DecisionContext, decision: LegalDecision): number {
        const { state, actor } = context;
        const p = this.profile;
        if (decision.mode === 'charge') {
            const target = decision.targetId ? state.combatants[decision.targetId] : undefined;
            return 115 * (0.5 + p.aggression) + (target ? targetScore(state, actor, target, p) : 0);
        }
        const resultPos = typeof decision.target === 'number'
            ? decision.target
            : decision.target && 'combatantId' in decision.target
                ? state.combatants[decision.target.combatantId]?.position
                : undefined;
        if (resultPos === undefined) return -1;
        const enemies = Object.values(state.combatants).filter(combatant => combatant.side !== actor.side && isActive(combatant));
        if (enemies.length === 0) return 0;
        const bestId = this.bestTargetId(state, actor, enemies.map(enemy => enemy.id));
        const best = bestId ? state.combatants[bestId] : enemies[0];
        const reach = reachOf(state, actor);
        const distBefore = Math.abs(actor.position - best.position);
        const distAfter = Math.abs(resultPos - best.position);
        const closing = distBefore - distAfter;
        const nearestBefore = Math.min(...enemies.map(enemy => Math.abs(actor.position - enemy.position)));
        const nearestAfter = Math.min(...enemies.map(enemy => Math.abs(resultPos - enemy.position)));
        const fearRetreatValue = activeFearStates(actor).reduce((total, fear) => {
            const source = state.combatants[fear.sourceId];
            if (!source) return total;
            const before = Math.abs(actor.position - source.position);
            const after = Math.abs(resultPos - source.position);
            return total + Math.max(0, after - before) * 20;
        }, 0);
        // Aggressors reward closing (and a bump for entering reach); kiters reward opening distance.
        const closeValue = closing * (1 - p.rangePreference) * (0.6 + p.aggression) * 2.5;
        const reachBonus = distAfter <= reach && distBefore > reach && p.aggression >= 0.4 ? 60 : 0;
        const retreatValue = (nearestAfter - nearestBefore) * p.kite * 2;
        return 5 + closeValue + reachBonus + retreatValue + fearRetreatValue;
    }

    /**
     * Augmenting advantage spends taken *before* the turn's main action. Pool
     * depletion bounds repetition; turn-flag guards prevent re-spending one-shot
     * tempo boosts. `fleeFromHarm` is deliberately excluded here (scored instead).
     */
    private chooseAugmentSpend(context: DecisionContext, legal: LegalDecision[]): LegalDecision | undefined {
        const { state, actor } = context;
        const p = this.profile;
        const pool = state.advantagePools[actor.side];
        const engaged = actor.engagementIds.length > 0;
        const find = (action: string) => legal.find(decision => decision.kind === 'spendAdvantage' && decision.advantageAction === action);

        if (pool >= 4 && p.aggression >= 0.55 && !state.turnFlags.additionalActionCombatantIds.includes(actor.id)) {
            const additional = find('additionalAction');
            if (additional) return additional;
        }
        if (pool >= 1 && p.aggression >= 0.7 && actor.budget.moves > 0 && !state.turnFlags.talentExtraAttackCombatantIds.includes(actor.id)) {
            const furious = find('furiousAssault');
            if (furious) return furious;
        }
        if (pool >= 2 && actor.budget.actions > 0 && p.aggression >= 0.85) {
            const effort = find('additionalEffort');
            if (effort) return effort;
        }
        if (pool >= 1 && engaged && p.aggression >= 0.6) {
            const batter = find('batter');
            if (batter) return batter;
        }
        if (pool >= 2 && engaged && p.threatFocus >= 0.6) {
            const trick = find('trick');
            if (trick) return trick;
        }
        return undefined;
    }

    private materialize(context: DecisionContext, decision: LegalDecision): CombatDecision {
        switch (decision.kind) {
            case 'meleeAttack':
                return this.materializeMelee(context, [decision]);
            case 'rangedAttack':
                return this.materializeRanged(context, [decision]);
            case 'reload':
                return withReloadRoll(context, decision);
            case 'intimidate':
                return withIntimidateRoll(context, decision);
            case 'leadership':
                return withLeadershipRoll(context, decision);
            case 'move':
                return decision.mode === 'charge' ? this.materializeCharge(context, [decision]) : decision;
            case 'assess':
            case 'defend':
            case 'aim':
            case 'sprint':
            case 'firstAid':
            case 'infighting':
            case 'disengageDodge':
            case 'grappleInitiate':
            case 'grappleMaintain':
            case 'grappleBreak':
            case 'attackWithBoth':
            case 'beatBlade':
            case 'disarm':
            case 'feint':
            case 'distractOpponent':
                return withRequest(decision);
            default:
                // spendAdvantage, shieldsman, reversal, endTurn, wait — dispatched as-is.
                return decision;
        }
    }

    private materializeMelee(context: DecisionContext, legal: LegalDecision[]): CombatDecision {
        const targetId = this.bestTargetId(context.state, context.actor, candidateTargets(legal)) ?? legal[0].targetId;
        const base = legal.find(decision => decision.targetId === targetId) ?? legal[0];
        const weapon = primaryWeapon(context.state, context.actor);
        const weaponUse = weapon ? resolveWeaponUse(context.actor, weapon) : undefined;
        return {
            ...base,
            action: {
                attackerId: context.actor.id,
                defenderId: targetId!,
                attacker: rollInput(context, context.actor, weaponUse ? (weaponUse?.test.type === 'skill' ? weaponUse.test.skillId : weaponUse.test.characteristic) : 'melee_basic', weapon?.id),
                defender: { skillId: 'melee_basic', targetNumber: 0 },
                isCharging: context.state.turnFlags.chargedCombatantIds.includes(context.actor.id),
                grantAdvantage: additionalEffortTestModifier !== undefined
            },
        };
    }

    private materializeCharge(context: DecisionContext, legal: LegalDecision[]): CombatDecision {
        const targetId = this.bestTargetId(context.state, context.actor, candidateTargets(legal)) ?? legal[0].targetId;
        const base = legal.find(decision => decision.targetId === targetId) ?? legal[0];
        const weapon = primaryWeapon(context.state, context.actor);
        const weaponUse = weapon ? resolveWeaponUse(context.actor, weapon) : undefined;
        return {
            ...base,
            action: {
            attackerId: context.actor.id,
            defenderId: targetId!,
            attacker: rollInput(context, context.actor, weaponUse ? (weaponUse?.test.type === 'skill' ? weaponUse.test.skillId : weaponUse.test.characteristic) : 'melee_basic', weapon?.id),
                defender: { skillId: 'melee_basic', targetNumber: 0 },
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

function withIntimidateRoll(context: DecisionContext, decision: LegalDecision): LegalDecision {
    const target = decision.targetId ? context.state.combatants[decision.targetId] : undefined;
    return {
        ...decision,
        rollResult: d100(context.rng),
        targetNumber: skillTarget(context.actor, 'intimidate'),
        request: {
            kind: 'intimidate',
            actorId: decision.actorId,
            targetId: decision.targetId,
            opponentRollResult: d100(context.rng),
            opponentTargetNumber: target ? skillTarget(target, 'cool') : 0,
        },
    };
}

function withLeadershipRoll(context: DecisionContext, decision: LegalDecision): LegalDecision {
    return {
        ...decision,
        rollResult: d100(context.rng),
        targetNumber: skillTarget(context.actor, 'leadership'),
        request: {
            kind: 'leadership',
            actorId: decision.actorId,
        },
    };
}

function rollInput(context: DecisionContext, combatant: Combatant | undefined, skillId: string, weaponId?: string): OpposedRollInput {
    return {
        skillId,
        targetNumber: combatant ? skillTarget(combatant, skillId) : 0,
        rollResult: d100(context.rng),
        weaponId,
    };
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
        + (state.tacticalDominantSide === target.side ? 5 : 0)
        - (isActivelyAfraidOf(actor, target.id) ? 35 : 0);
}

function enemyCount(state: CombatState, actor: Combatant): number {
    return Object.values(state.combatants).filter(combatant => combatant.side !== actor.side && isActive(combatant)).length;
}

function allyCount(state: CombatState, actor: Combatant): number {
    return Object.values(state.combatants).filter(combatant => combatant.id !== actor.id && combatant.side === actor.side && isActive(combatant)).length;
}

function psychologicalPressure(state: CombatState, actor: Combatant): number {
    const allies = Object.values(state.combatants).filter(combatant => combatant.side === actor.side && isActive(combatant));
    const enemies = Object.values(state.combatants).filter(combatant => combatant.side !== actor.side && isActive(combatant));
    const fearSources = enemies.filter(enemy => !!enemy.causesFear?.rating || !!enemy.causesTerror?.rating).length;
    const alreadyAfraid = allies.reduce((total, ally) => total + activeFearStates(ally).length, 0);
    const broken = allies.filter(ally => ally.conditions.includes('condition_broken')).length;
    return fearSources + alreadyAfraid + broken;
}

function approachesFearedSource(state: CombatState, actor: Combatant, decision: LegalDecision): boolean {
    if (decision.kind !== 'move') return false;
    const destination = typeof decision.target === 'number'
        ? decision.target
        : decision.target && 'combatantId' in decision.target
            ? state.combatants[decision.target.combatantId]?.position
            : undefined;
    if (destination === undefined) return false;
    return activeFearStates(actor).some(fear => {
        const source = state.combatants[fear.sourceId];
        return source && Math.abs(destination - source.position) < Math.abs(actor.position - source.position);
    });
}

function bestRetreatDecision(
    state: CombatState,
    actor: Combatant,
    legal: LegalDecision[]
): LegalDecision | undefined {
    const enemies = Object.values(state.combatants).filter(combatant =>
        combatant.side !== actor.side && isActive(combatant)
    );
    return legal
        .filter(decision => decision.kind === 'move' && typeof decision.target === 'number')
        .map(decision => ({
            decision,
            distance: enemies.length > 0
                ? Math.min(...enemies.map(enemy => Math.abs((decision.target as number) - enemy.position)))
                : 0,
        }))
        .sort((a, b) => b.distance - a.distance)[0]?.decision;
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

function mostWoundedAlly(state: CombatState, actor: Combatant): Combatant | undefined {
    return Object.values(state.combatants)
        .filter(combatant => combatant.side === actor.side && combatant.id !== actor.id && isActive(combatant) && woundedRatio(combatant) < 0.5)
        .sort((a, b) => woundedRatio(a) - woundedRatio(b))[0];
}

function reachOf(state: CombatState, actor: Combatant): number {
    const weapon = state.weapons.find(candidate => candidate.id === (actor.weaponLoadout?.primaryWeaponId ?? ''));
    return REACH_ENGAGEMENT_DISTANCE[(weapon?.reach as WeaponReach) ?? 'Short'];
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
