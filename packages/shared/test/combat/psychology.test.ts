import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/types/wfrp.types';
import {
    applyMove,
    applyDecision,
    advanceToNextDecision,
    createCombatState,
    createCombatantFromCharacter,
    createTurnEngine,
    createSeededRng,
    expirePsychologyBonuses,
    fearPreRollModifiers,
    isActivelyAfraidOf,
    resolveMeleeAttack,
    resolveIntimidateAction,
    resolveLeadershipAction,
    resolvePsychologyExposure,
    resolvePsychologyRoundStart,
    resolveEndOfRoundBrokenRally,
    resolveEndOfTurnBrokenRally,
    resolveFleeFromFieldCheck,
    runCombatToCompletion,
    legalDecisions,
    HeuristicController,
    type CombatState,
    type Rng,
} from '../../src/combat';

describe('PSY-a Fear and Terror', () => {
    it('exposes Frightening and Terrifying ratings from talent ranks', () => {
        const frightening = combatant('frightening', 'adversary', { frightening: 3 });
        const terrifying = combatant('terrifying', 'adversary', { terrifying: 2 });

        expect(frightening.causesFear).toEqual({ rating: 3 });
        expect(terrifying.causesTerror).toEqual({ rating: 2 });
    });

    it('accumulates Extended Cool Test SL across rounds and grants source immunity', () => {
        let state = fearState(3);
        state = resolvePsychologyRoundStart(state, sequenceRng(31)).state;

        expect(state.combatants.target.psychology?.fears.source).toMatchObject({
            accumulatedSL: 1,
            rating: 3,
            status: 'active',
        });

        state = { ...state, round: 2 };
        const completed = resolvePsychologyRoundStart(state, sequenceRng(21));

        expect(completed.state.combatants.target.psychology?.fears.source).toMatchObject({
            accumulatedSL: 3,
            status: 'immune',
        });
        expect(isActivelyAfraidOf(completed.state.combatants.target, 'source')).toBe(false);
    });

    it('applies -1 SL through pre-roll modifiers against the feared source', () => {
        const state = activeFearState();
        const target = state.combatants.target;
        const source = state.combatants.source;

        expect(fearPreRollModifiers({
            state,
            action: {
                attackerId: target.id,
                defenderId: source.id,
                attacker: { skillId: 'melee_basic', targetNumber: 40 },
                defender: { skillId: 'melee_basic', targetNumber: 40 },
            },
            attacker: target,
            defender: source,
        })).toMatchObject([{ type: 'psychology', value: -10 }]);

        const attack = resolveMeleeAttack(state, {
            attackerId: target.id,
            defenderId: source.id,
            attacker: { skillId: 'melee_basic', targetNumber: 40, rollResult: 31 },
            defender: { skillId: 'melee_basic', targetNumber: 40, rollResult: 91 },
        });
        const resolved = attack.events.find(event => event.type === 'AttackResolved');
        expect(resolved?.data.attackerRoll.targetNumber).toBe(30);
    });

    it('blocks a failed voluntary approach test and permits a passed one', () => {
        const state = activeFearState();
        const failed = applyMove(state, 'target', 4, 'walk', sequenceRng(91));
        const passed = applyMove(state, 'target', 4, 'walk', sequenceRng(11));

        expect(failed.state.combatants.target.position).toBe(0);
        expect(failed.events).toContainEqual(expect.objectContaining({
            type: 'MoveRejectedEvent',
            data: expect.objectContaining({ reason: 'fearApproach' }),
        }));
        expect(passed.state.combatants.target.position).toBe(4);
    });

    it('applies Broken when a Fear source approaches and the Cool Test fails', () => {
        const state = activeFearState();
        const result = applyMove(state, 'source', 6, 'walk', sequenceRng(91));

        expect(result.state.combatants.target.conditions).toContain('condition_broken');
        expect(result.events).toContainEqual(expect.objectContaining({
            type: 'PsychologyTestResolved',
            data: expect.objectContaining({
                psychology: 'sourceApproach',
                brokenApplied: 1,
            }),
        }));
    });

    it('resolves Terror once, applies rating plus failed SL as Broken, then starts Fear', () => {
        const target = combatant('target', 'ally');
        const source = {
            ...combatant('source', 'adversary'),
            causesTerror: { rating: 3 },
        };
        const state = createCombatState([target, source], { round: 1 });
        const result = resolvePsychologyExposure(state, 'target', 'source', sequenceRng(31));

        expect(result.state.combatants.target.conditions.filter(id => id === 'condition_broken')).toHaveLength(5);
        expect(result.state.combatants.target.psychology?.terrors.source).toMatchObject({
            tested: true,
            successLevel: -2,
            brokenApplied: 5,
        });
        expect(result.state.combatants.target.psychology?.fears.source).toMatchObject({
            rating: 3,
            status: 'active',
            downgradedFromTerror: true,
        });

        const repeated = resolvePsychologyExposure(result.state, 'target', 'source', sequenceRng(100));
        expect(repeated.events).toEqual([]);
        expect(repeated.state.combatants.target.conditions.filter(id => id === 'condition_broken')).toHaveLength(5);
    });

    it('causes no immediate effect on a passed Terror Test but still transitions to Fear', () => {
        const target = combatant('target', 'ally', {}, 80);
        const source = { ...combatant('source', 'adversary'), causesTerror: { rating: 1 } };
        const result = resolvePsychologyExposure(
            createCombatState([target, source], { round: 1 }),
            'target',
            'source',
            sequenceRng(11)
        );

        expect(result.state.combatants.target.conditions).not.toContain('condition_broken');
        expect(result.state.combatants.target.psychology?.terrors.source?.successLevel).toBeGreaterThanOrEqual(0);
        expect(isActivelyAfraidOf(result.state.combatants.target, 'source')).toBe(true);
    });

    it('makes Fearless immune to Fear and downgrades Terror to the Fear track', () => {
        const fearless = combatant('target', 'ally', { fearless: 1 });
        const fearSource = { ...combatant('fear', 'adversary'), causesFear: { rating: 2 } };
        const terrorSource = { ...combatant('terror', 'adversary'), causesTerror: { rating: 3 } };
        let state = createCombatState([fearless, fearSource, terrorSource], { round: 1 });

        state = resolvePsychologyExposure(state, 'target', 'fear', sequenceRng(100)).state;
        state = resolvePsychologyExposure(state, 'target', 'terror', sequenceRng(100)).state;

        expect(state.combatants.target.psychology?.fears.fear?.status).toBe('immune');
        expect(state.combatants.target.psychology?.terrors.terror).toMatchObject({ tested: true });
        expect(state.combatants.target.psychology?.fears.terror).toMatchObject({
            status: 'active',
            downgradedFromTerror: true,
        });
        expect(state.combatants.target.conditions).not.toContain('condition_broken');
    });

    it('tracks multiple Fear sources independently', () => {
        const target = combatant('target', 'ally');
        const first = { ...combatant('first', 'adversary'), causesFear: { rating: 1 } };
        const second = { ...combatant('second', 'adversary'), causesFear: { rating: 3 } };
        const result = resolvePsychologyRoundStart(
            createCombatState([target, first, second], { round: 1 }),
            sequenceRng(31, 61)
        );

        expect(Object.keys(result.state.combatants.target.psychology?.fears ?? {})).toEqual(['first', 'second']);
        expect(result.state.combatants.target.psychology?.fears.first?.status).toBe('immune');
        expect(result.state.combatants.target.psychology?.fears.second?.status).toBe('active');
    });

    it('detects a newly inserted source before the next mid-round decision', () => {
        const target = combatant('target', 'ally');
        let engine = advanceToNextDecision(createTurnEngine(
            createCombatState([target]),
            { seed: 'mid-round-source' }
        ));
        const source = { ...combatant('source', 'adversary'), causesFear: { rating: 2 } };
        engine = {
            ...engine,
            state: {
                ...engine.state,
                combatants: { ...engine.state.combatants, source },
            },
        };

        engine = applyDecision(engine, { kind: 'endTurn', actorId: 'target' });

        expect(engine.state.combatants.target.psychology?.fears.source).toMatchObject({
            rating: 2,
            status: 'active',
        });
        expect(engine.events).toContainEqual(expect.objectContaining({
            type: 'PsychologyExposure',
            data: expect.objectContaining({ combatantId: 'target', sourceId: 'source' }),
        }));
    });

    it('is deterministic under a seeded RNG', () => {
        const first = resolvePsychologyRoundStart(fearState(4), createSeededRng('psy-a'));
        const second = resolvePsychologyRoundStart(fearState(4), createSeededRng('psy-a'));

        expect(first).toEqual(second);
    });

    it('makes the heuristic prefer movement away from an active Fear source', () => {
        const state = activeFearState();
        const actor = state.combatants.target;
        const controller = new HeuristicController();
        const decision = controller.choose({
            level: 'turn',
            engine: createTurnEngine(state, { seed: 'fear-ai' }),
            state,
            actor,
            rng: createSeededRng('fear-ai'),
            legalDecisions: [
                { kind: 'move', actorId: actor.id, mode: 'walk', target: 4 },
                { kind: 'move', actorId: actor.id, mode: 'walk', target: -4 },
                { kind: 'endTurn', actorId: actor.id },
            ],
        });

        expect(decision).toMatchObject({ kind: 'move', target: -4 });
    });

    it('makes the heuristic retreat instead of attacking while Broken', () => {
        const state = activeFearState();
        const actor = {
            ...state.combatants.target,
            conditions: ['condition_broken'],
        };
        const brokenState = {
            ...state,
            combatants: { ...state.combatants, target: actor },
        };
        const controller = new HeuristicController();
        const decision = controller.choose({
            level: 'turn',
            engine: createTurnEngine(brokenState, { seed: 'broken-ai' }),
            state: brokenState,
            actor,
            rng: createSeededRng('broken-ai'),
            legalDecisions: [
                { kind: 'meleeAttack', actorId: actor.id, targetId: 'source' },
                { kind: 'move', actorId: actor.id, mode: 'run', target: -8 },
                { kind: 'endTurn', actorId: actor.id },
            ],
        });

        expect(decision).toMatchObject({ kind: 'move', target: -8 });
    });
});

describe('PSY-d Intimidate and Leadership', () => {
    it('applies Fear 1 from Intimidate to the primary and nearest enemies on an opposed win', () => {
        const actor = combatant('actor', 'ally');
        const primary = combatant('primary', 'adversary');
        const near = { ...combatant('near', 'adversary'), position: 8 };
        const far = { ...combatant('far', 'adversary'), position: 30 };
        const state = createCombatState([actor, primary, near, far], { round: 1 });

        const result = resolveIntimidateAction(state, 'actor', 'primary', sequenceRng(), {
            rollResult: 11,
            targetNumber: 30,
            opponentRollResult: 91,
            opponentTargetNumber: 40,
        });

        expect(result.events[0]).toMatchObject({
            type: 'IntimidateTestResolved',
            data: expect.objectContaining({ outcome: 'success' }),
        });
        expect(result.state.combatants.primary.psychology?.fears.actor).toMatchObject({ rating: 1, status: 'active' });
        expect(result.state.combatants.near.psychology?.fears.actor).toMatchObject({ rating: 1, status: 'active' });
        expect(result.state.combatants.far.psychology?.fears.actor).toMatchObject({ rating: 1, status: 'active' });
    });

    it('does not apply Intimidate Fear on a loss and respects Fearless and frenzy immunity', () => {
        const actor = combatant('actor', 'ally');
        const normal = combatant('normal', 'adversary');
        const fearless = combatant('fearless', 'adversary', { fearless: 1 });
        const frenzied = {
            ...combatant('frenzied', 'adversary'),
            psychology: {
                fears: {},
                terrors: {},
                frenzy: { active: true },
                immuneToAllPsychology: true,
            },
        };
        const state = createCombatState([actor, normal, fearless, frenzied], { round: 1 });

        const loss = resolveIntimidateAction(state, 'actor', 'normal', sequenceRng(), {
            rollResult: 91,
            targetNumber: 30,
            opponentRollResult: 11,
            opponentTargetNumber: 40,
        });
        expect(loss.state.combatants.normal.psychology?.fears.actor).toBeUndefined();

        const win = resolveIntimidateAction(state, 'actor', 'normal', sequenceRng(), {
            rollResult: 11,
            targetNumber: 30,
            opponentRollResult: 91,
            opponentTargetNumber: 40,
        });
        expect(win.state.combatants.normal.psychology?.fears.actor?.status).toBe('active');
        expect(win.state.combatants.fearless.psychology?.fears.actor?.status).toBe('immune');
        expect(win.state.combatants.frenzied.psychology?.fears.actor).toBeUndefined();
    });

    it('lets a defender use Intimidate only when the attacker fears them', () => {
        const fearful = activeFearState();
        const defender = withSkillAdvances(fearful.combatants.source, 'intimidate', 30);
        const fearfulState = {
            ...fearful,
            combatants: {
                ...fearful.combatants,
                source: { ...defender, position: 1 },
            },
        };
        const engine = {
            ...createTurnEngine(fearfulState, { seed: 'defence-intimidate' }),
            state: fearfulState,
            phase: 'awaitingDecision' as const,
            activeCombatantId: 'target',
            initiativeOrder: ['target', 'source'],
            turnIndex: 0,
        };
        const substitution = applyDecision(engine, {
            kind: 'meleeAttack',
            actorId: 'target',
            targetId: 'source',
            action: {
            attackerId: 'target',
            defenderId: 'source',
            attacker: { skillId: 'melee_basic', targetNumber: 40, rollResult: 51 },
                defender: { skillId: 'melee_basic', targetNumber: 0, rollResult: 31 },
            },
        }, {
            source: {
                choose: context => context.reason === 'defenceSkill'
                    ? { kind: 'meleeAttack', actorId: 'source', defenceSkill: 'intimidate' }
                    : undefined,
            },
        });
        expect(substitution.events.find(event => event.type === 'AttackResolved')?.data.defenderRoll.skillId).toBe('intimidate');

        const calmState = {
            ...fearfulState,
            combatants: {
                ...fearfulState.combatants,
                target: { ...fearfulState.combatants.target, psychology: { fears: {}, terrors: {} } },
                source: { ...fearfulState.combatants.source, causesFear: undefined },
            },
        };
        const calmEngine = {
            ...engine,
            state: calmState,
        };
        const noSubstitution = applyDecision(calmEngine, {
            kind: 'meleeAttack',
            actorId: 'target',
            targetId: 'source',
            action: {
            attackerId: 'target',
            defenderId: 'source',
            attacker: { skillId: 'melee_basic', targetNumber: 40, rollResult: 51 },
                defender: { skillId: 'melee_basic', targetNumber: 0, rollResult: 31 },
            },
        }, {
            source: {
                choose: context => context.reason === 'defenceSkill'
                    ? { kind: 'meleeAttack', actorId: 'source', defenceSkill: 'intimidate' }
                    : undefined,
            },
        });
        expect(noSubstitution.events.find(event => event.type === 'AttackResolved')?.data.defenderRoll.skillId).not.toBe('intimidate');
    });

    it('Menacing adds SL to Intimidate', () => {
        const actor = combatant('actor', 'ally', { menacing: 2 });
        const target = combatant('target', 'adversary');
        const result = resolveIntimidateAction(createCombatState([actor, target], { round: 1 }), 'actor', 'target', sequenceRng(), {
            rollResult: 41,
            targetNumber: 30,
            opponentRollResult: 41,
            opponentTargetNumber: 40,
        });

        const event = result.events[0];
        expect(event).toMatchObject({
            type: 'IntimidateTestResolved',
            data: expect.objectContaining({
                outcome: 'success',
                actorRoll: expect.objectContaining({ roundedSuccessLevel: 1 }),
            }),
        });
        expect(result.state.combatants.target.psychology?.fears.actor?.status).toBe('active');
    });

    it('Leadership grants +10 Psychology to exactly FelB plus SL nearest allies and expires at end of next round', () => {
        const leader = combatant('leader', 'ally');
        const allies = [0, 1, 2, 3, 4].map(index => ({
            ...combatant(`ally${index}`, 'ally'),
            position: index + 1,
        }));
        const state = createCombatState([leader, ...allies], { round: 1 });

        const result = resolveLeadershipAction(state, 'leader', sequenceRng(), {
            rollResult: 21,
            targetNumber: 30,
        });

        expect(result.events[0]).toMatchObject({
            type: 'LeadershipTestResolved',
            data: expect.objectContaining({
                outcome: 'success',
                affectedAllyIds: ['ally0', 'ally1', 'ally2', 'ally3'],
                bonus: 10,
                expiresEndOfRound: 2,
            }),
        });
        expect(result.state.combatants.ally0.psychology?.psychologyTestBonus).toMatchObject({ value: 10, expiresEndOfRound: 2 });
        expect(result.state.combatants.ally3.psychology?.psychologyTestBonus).toMatchObject({ value: 10, expiresEndOfRound: 2 });
        expect(result.state.combatants.ally4.psychology?.psychologyTestBonus).toBeUndefined();

        const withEnemy = {
            ...result.state,
            round: 2,
            combatants: {
                ...result.state.combatants,
                source: { ...combatant('source', 'adversary'), causesFear: { rating: 1 } },
            },
        };
        const fear = resolvePsychologyRoundStart(withEnemy, sequenceRng(41, 41, 41, 41, 41));
        const ally0FearTest = fear.events.find(event =>
            event.type === 'PsychologyTestResolved'
            && event.data.combatantId === 'ally0'
            && event.data.psychology === 'fear'
        );
        expect(ally0FearTest?.data.targetNumber).toBe(50);

        const expired = expirePsychologyBonuses({ ...result.state, round: 2 });
        expect(expired.state.combatants.ally0.psychology?.psychologyTestBonus).toBeUndefined();
    });

    it('War Leader extends Leadership count and Commanding Presence increases the bonus magnitude', () => {
        const leader = combatant('leader', 'ally', { 'war-leader': 1, 'commanding-presence': 1 });
        const allies = [0, 1, 2, 3].map(index => ({ ...combatant(`ally${index}`, 'ally'), position: index + 1 }));
        const result = resolveLeadershipAction(createCombatState([leader, ...allies], { round: 1 }), 'leader', sequenceRng(), {
            rollResult: 31,
            targetNumber: 30,
        });

        expect(result.events[0]).toMatchObject({
            type: 'LeadershipTestResolved',
            data: expect.objectContaining({
                outcome: 'success',
                affectedAllyIds: ['ally0', 'ally1', 'ally2', 'ally3'],
                bonus: 20,
            }),
        });
        expect(result.state.combatants.ally0.psychology?.psychologyTestBonus?.value).toBe(20);
    });

    it('scores Intimidate and Leadership in the heuristic when pressure makes them useful', () => {
        const actor = combatant('actor', 'ally');
        const lowCool = combatant('lowCool', 'adversary', {}, 20);
        const intimidateState = createCombatState([actor, lowCool], { round: 1 });
        const brute = new HeuristicController();
        const intimidate = brute.choose({
            level: 'turn',
            engine: createTurnEngine(intimidateState, { seed: 'intimidate-ai' }),
            state: intimidateState,
            actor,
            rng: createSeededRng('intimidate-ai'),
            legalDecisions: [
                { kind: 'intimidate', actorId: actor.id, targetId: 'lowCool' },
                { kind: 'endTurn', actorId: actor.id },
            ],
        });
        expect(intimidate?.kind).toBe('intimidate');

        const leader = combatant('leader', 'ally');
        const ally = combatant('ally', 'ally');
        const fearSource = { ...combatant('fearSource', 'adversary'), causesFear: { rating: 2 } };
        const leadershipState = createCombatState([leader, ally, fearSource], { round: 1 });
        const support = new HeuristicController({ profile: 'marksman' });
        const leadership = support.choose({
            level: 'turn',
            engine: createTurnEngine(leadershipState, { seed: 'leadership-ai' }),
            state: leadershipState,
            actor: leader,
            rng: createSeededRng('leadership-ai'),
            legalDecisions: [
                { kind: 'leadership', actorId: leader.id },
                { kind: 'endTurn', actorId: leader.id },
            ],
        });
        expect(leadership?.kind).toBe('leadership');
    });
});

describe('PSY-e Broken behaviour, rally, and rout termination', () => {
    it('the heuristic retreats instead of attacking when Broken with 2+ stacks', () => {
        const state = activeFearState();
        const actor = {
            ...state.combatants.target,
            conditions: ['condition_broken', 'condition_broken'],
        };
        const brokenState = {
            ...state,
            combatants: { ...state.combatants, target: actor },
        };
        const controller = new HeuristicController();
        const decision = controller.choose({
            level: 'turn',
            engine: createTurnEngine(brokenState, { seed: 'broken2-ai' }),
            state: brokenState,
            actor,
            rng: createSeededRng('broken2-ai'),
            legalDecisions: [
                { kind: 'meleeAttack', actorId: actor.id, targetId: 'source' },
                { kind: 'move', actorId: actor.id, mode: 'run', target: -8 },
                { kind: 'endTurn', actorId: actor.id },
            ],
        });
        expect(decision).toMatchObject({ kind: 'move', target: -8 });
    });

    it('the heuristic cowers (endTurn, no offensive action) when Broken and cornered', () => {
        const state = activeFearState();
        const actor = {
            ...state.combatants.target,
            conditions: ['condition_broken'],
        };
        const brokenState = {
            ...state,
            combatants: { ...state.combatants, target: actor },
        };
        const controller = new HeuristicController();
        const decision = controller.choose({
            level: 'turn',
            engine: createTurnEngine(brokenState, { seed: 'cower-ai' }),
            state: brokenState,
            actor,
            rng: createSeededRng('cower-ai'),
            legalDecisions: [
                { kind: 'meleeAttack', actorId: actor.id, targetId: 'source' },
                { kind: 'endTurn', actorId: actor.id },
            ],
        });
        expect(decision?.kind).toBe('endTurn');
    });

    it('end-of-round Cool Test removes Broken stacks on success and applies Fatigued on full recovery', () => {
        const actor = combatant('actor', 'ally');
        const brokenActor = {
            ...actor,
            conditions: ['condition_broken', 'condition_broken'],
        };
        const state = createCombatState([brokenActor, combatant('enemy', 'adversary')], { round: 1 });
        const result = resolveEndOfRoundBrokenRally(state, 'actor', sequenceRng(11));

        expect(result.events.some(e => e.type === 'RallyTestResolved')).toBe(true);
        const rally = result.events.find(e => e.type === 'RallyTestResolved');
        expect(rally?.data.stacksRemoved).toBeGreaterThan(0);
    });

    it('end-of-round Cool Test fails on a bad roll and leaves Broken stacks unchanged', () => {
        const actor = combatant('actor', 'ally');
        const brokenActor = {
            ...actor,
            conditions: ['condition_broken', 'condition_broken'],
        };
        const state = createCombatState([brokenActor, combatant('enemy', 'adversary')], { round: 1 });
        const result = resolveEndOfRoundBrokenRally(state, 'actor', sequenceRng(91));

        const rally = result.events.find(e => e.type === 'RallyTestResolved');
        expect(rally?.data.stacksRemoved).toBe(0);
        expect(result.state.combatants.actor.conditions.filter(c => c === 'condition_broken')).toHaveLength(2);
    });

    it('end-of-round rally is blocked while Engaged and emits engagedBlocked event', () => {
        const actor = { ...combatant('actor', 'ally'), conditions: ['condition_broken'], engagementIds: ['enemy'] };
        const state = createCombatState([actor, combatant('enemy', 'adversary')], { round: 1 });
        const result = resolveEndOfRoundBrokenRally(state, 'actor', sequenceRng(11));

        const rally = result.events.find(e => e.type === 'RallyTestResolved');
        expect(rally?.data.engagedBlocked).toBe(true);
        expect(rally?.data.stacksRemoved).toBe(0);
        expect(result.state.combatants.actor.conditions).toContain('condition_broken');
    });

    it("Leadership's +10 psychology bonus measurably improves the rally Cool Test", () => {
        const actor = {
            ...combatant('actor', 'ally'),
            conditions: ['condition_broken'],
            psychology: {
                fears: {},
                terrors: {},
                psychologyTestBonus: { value: 10, expiresEndOfRound: 5, sourceId: 'leader' },
            },
        };
        const state = createCombatState([actor, combatant('enemy', 'adversary')], { round: 1 });
        const result = resolveEndOfRoundBrokenRally(state, 'actor', sequenceRng(42));

        const rally = result.events.find(e => e.type === 'RallyTestResolved');
        // Cool = 40; with +10 bonus target becomes 50; roll of 42 succeeds (SL ≥ 0)
        expect(rally?.data.targetNumber).toBe(50);
        expect(rally?.data.stacksRemoved).toBeGreaterThan(0);
    });

    it('Stout-Hearted triggers an extra end-of-turn Cool Test to remove Broken', () => {
        const actor = {
            ...combatant('actor', 'ally', { 'stout-hearted': 1 }),
            conditions: ['condition_broken'],
        };
        const enemy = combatant('enemy', 'adversary');
        const state = createCombatState([actor, enemy], { round: 1 });
        const result = resolveEndOfTurnBrokenRally(state, 'actor', sequenceRng(11));

        expect(result.events.find(e => e.type === 'RallyTestResolved')).toBeTruthy();
    });

    it('Flee! talent adds extra legal move destinations when Broken', () => {
        const enemy = { ...combatant('enemy', 'adversary'), position: 10 };
        const normalActor = { ...combatant('normal', 'ally'), conditions: ['condition_broken'], position: 0 };
        const fleeActor = { ...combatant('flee', 'ally', { flee: 1 }), conditions: ['condition_broken'], position: 0, id: 'flee' };

        const normalState = createCombatState([normalActor, enemy], { round: 1 });
        const fleeState = createCombatState([fleeActor, enemy], { round: 1 });

        const normalMoves = legalDecisions(normalState, normalActor).filter(d => d.kind === 'move');
        const fleeMoves = legalDecisions(fleeState, fleeActor).filter(d => d.kind === 'move');

        expect(fleeMoves.length).toBeGreaterThan(normalMoves.length);
    });

    it('a Broken unengaged combatant far from all enemies is marked as fled and excluded from sideDown', () => {
        const brokenFar = {
            ...combatant('broken', 'ally'),
            conditions: ['condition_broken'],
            position: 30,
            engagementIds: [],
        };
        const enemy = { ...combatant('enemy', 'adversary'), position: 0 };
        const state = createCombatState([brokenFar, enemy], { round: 1 });

        const result = resolveFleeFromFieldCheck(state, 'broken');

        expect(result.events.find(e => e.type === 'FleedFromField')).toBeTruthy();
        expect(result.events.find(e => e.type === 'CombatantRemovedFromEncounter')).toBeTruthy();
        const removed = result.events.find(e => e.type === 'CombatantRemovedFromEncounter');
        expect(removed?.data.reason).toBe('fled');
        expect(result.state.combatants.broken.removedFromEncounter).toBe(true);
    });

    it('flee-field does NOT fire when the combatant is too close to enemies', () => {
        const brokenClose = {
            ...combatant('broken', 'ally'),
            conditions: ['condition_broken'],
            position: 5,
            engagementIds: [],
        };
        const enemy = { ...combatant('enemy', 'adversary'), position: 0 };
        const state = createCombatState([brokenClose, enemy], { round: 1 });

        const result = resolveFleeFromFieldCheck(state, 'broken');
        expect(result.events).toHaveLength(0);
        expect(result.state.combatants.broken.removedFromEncounter).toBeFalsy();
    });

    it('a fully fled side triggers sideDownTermination as a win for the other side', () => {
        const fleeingAlly = {
            ...combatant('ally', 'ally'),
            conditions: ['condition_broken'],
            position: 50,
            engagementIds: [],
        };
        const enemy = { ...combatant('enemy', 'adversary'), position: 0 };
        const state = createCombatState([fleeingAlly, enemy], { round: 1 });

        const engine = runCombatToCompletion(
            state,
            new HeuristicController({ profile: 'berserker' }),
            { seed: 'rout-test', maxRounds: 20 }
        );

        expect(engine.outcome).toBe('adversary');
    });

    it('is deterministic under a seeded RNG', () => {
        const actor = { ...combatant('actor', 'ally'), conditions: ['condition_broken'] };
        const state = createCombatState([actor, combatant('enemy', 'adversary')], { round: 1 });
        const first = resolveEndOfRoundBrokenRally(state, 'actor', createSeededRng('psy-e-det'));
        const second = resolveEndOfRoundBrokenRally(state, 'actor', createSeededRng('psy-e-det'));
        expect(first).toEqual(second);
    });
});

function fearState(rating: number): CombatState {
    return createCombatState([
        combatant('target', 'ally'),
        { ...combatant('source', 'adversary'), causesFear: { rating } },
    ], { round: 1 });
}

function activeFearState(): CombatState {
    const state = fearState(3);
    return {
        ...state,
        combatants: {
            ...state.combatants,
            target: {
                ...state.combatants.target,
                position: 0,
                psychology: {
                    fears: {
                        source: {
                            sourceId: 'source',
                            rating: 3,
                            accumulatedSL: 0,
                            status: 'active',
                        },
                    },
                    terrors: {},
                },
            },
            source: { ...state.combatants.source, position: 10 },
        },
    };
}

function sequenceRng(...rolls: number[]): Rng {
    let index = 0;
    return {
        next: () => {
            const roll = rolls[Math.min(index++, rolls.length - 1)] ?? 50;
            return (roll - 1) / 100;
        },
    };
}

function combatant(
    id: string,
    side: 'ally' | 'adversary',
    talents: Record<string, number> = {},
    willpower = 40
) {
    return createCombatantFromCharacter(character(id, talents, willpower), {
        id,
        side,
        position: side === 'ally' ? 0 : 10,
    });
}

function character(id: string, talents: Record<string, number>, willpower: number): Character {
    const characteristic = (initial: number) => ({ initial, advances: 0, talents: 0, modifier: 0 });
    return {
        id,
        name: id,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: '',
        currentCareerLevelId: '',
        userId: id === 'target' ? 'player' : null,
        tags: [],
        locationId: null,
        xp: { current: 0, spent: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        details: {
            age: '', height: '', hair: '', eyes: '', partyName: '',
            shortTermAmbition: '', longTermAmbition: '',
            partyShortTermAmbition: '', partyLongTermAmbition: '',
        },
        movement: 4,
        characteristics: {
            ws: characteristic(40), bs: characteristic(30), s: characteristic(30),
            t: characteristic(30), i: characteristic(30), ag: characteristic(30),
            dex: characteristic(30), int: characteristic(30), wp: characteristic(willpower),
            fel: characteristic(30),
        },
        skills: [
            { id: 'cool', name: 'Cool', characteristic: 'wp', advances: 0, talents: 0, modifier: 0 },
            { id: 'intimidate', name: 'Intimidate', characteristic: 's', advances: 0, talents: 0, modifier: 0 },
            { id: 'leadership', name: 'Leadership', characteristic: 'fel', advances: 0, talents: 0, modifier: 0 },
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 0, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: 10, max: 10 },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents,
        inventory: {
            weapons: {},
            armor: {},
            items: {},
            equippedWeapons: {},
            equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function withSkillAdvances<T extends ReturnType<typeof combatant>>(combatant: T, skillId: string, advances: number): T {
    return {
        ...combatant,
        character: {
            ...combatant.character,
            skills: combatant.character.skills.map(skill => skill.id === skillId ? { ...skill, advances } : skill),
        },
    };
}
