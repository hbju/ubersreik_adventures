## Epic PSY Structure

- **PSY-a — Fear & Terror.** Extended Cool Test for Fear (multi-round accumulation, −1 SL, movement restrictions, approach-triggered Broken); one-shot Terror → Broken × rating → becomes Fear; Frightening/Terrifying/Fearless talents.
- **PSY-b — Frenzy.** Entry via WP test, forced aggression, free Melee Test, +1 SB, psychology immunity, exit conditions, Fatigued on recovery; Frenzy/Battle Rage/Flagellant talents.
- **PSY-c — Hatred & Animosity.** Target-group model; Hatred (+1 SL combat, Fear/Intimidate immunity from hated, forced lethal aggression); Animosity (must attack, +1 SL social/mental, re-test each round, overridden by Fear/Terror); Prejudice as a light flag. -- DEFERRED FOR NOW
- **PSY-d — Intimidate & Leadership.** Two new actions; Intimidate (opposed test → impose psychology); Leadership (+10 Psychology to FelB+SL allies); Menacing, War Leader, Commanding Presence talents.
- **PSY-e — Broken behaviour, rally & routed-side termination.** Wire Broken's flee/cower into AI; Rally (Cool test to shed Broken); resistance talents (Iron Will, Stout-Hearted, Unshakable); flee talent; routed-side terminates the fight; re-baseline saved reports.

Now PSY-a, properly:

## PBI PSY-a — Fear & Terror

**User story:** As the simulator, I need Fear as an ongoing multi-round pressure and Terror as a devastating first-contact shock — sourced from the Frightening and Terrifying talents — so psychology-driven encounters model the tactical reality of fighting terrifying foes.

**Why now:** it's the foundation for the entire psychology epic; Frenzy, Hatred, and Intimidate all interact with the Fear/Broken state this produces. The Extended Cool Test and movement restrictions add real tactical depth that the AI and later MCTS will need to navigate.

### Tasks — Talents (`@wfrp/shared` game-data + 3g-1 schema)
- [ ] **Frightening (Rating):** exposes `causesFear: { rating }` on the combatant; rating is the SL threshold for the Extended Cool Test.
- [ ] **Terrifying (Rating):** exposes `causesTerror: { rating }` — triggers the one-shot Terror test, then transitions to Fear at the same rating.
- [ ] **Fearless:** immune to Fear entirely; Terror is downgraded to Fear (test still required, but on the Fear track — the Extended Cool Test, not the devastating one-shot).

### Tasks — Fear state (`@wfrp/shared` engine)
- [ ] **Fear as an ongoing state** on the combatant: tracks the source, the Fear Rating target, and accumulated SL toward it. A combatant can be under Fear from multiple sources simultaneously (each tracked independently).
- [ ] **Extended Cool Test** resolved once per round (during the combatant's turn or at round start — per the "start of the Round" trigger): accumulate SL toward the Fear Rating. Once SL ≥ Rating, Fear from that source ends; immune for the rest of the encounter.
- [ ] **While under Fear:** −1 SL on all Tests to affect the source of fear (wire into the `preRollModifiers` hook); cannot voluntarily move closer to the source without passing a separate **Challenging (+0) Cool Test**; if the source moves closer to the combatant, **Challenging (+0) Cool Test** or gain Broken.
- [ ] **Approach-trigger resolution:** detect when a Fear source's movement brings it closer to a feared combatant, resolve the Cool test, apply Broken on failure. Wire into movement resolution.

### Tasks — Terror state (`@wfrp/shared` engine)
- [ ] **One-shot Cool Test** on first encounter with a Terrifying source (GM-chosen difficulty — default to source rating as modifier).
- [ ] **Failure:** gain Broken conditions equal to **Terror Rating + SL below 0** (e.g., Terror 3, failed by 2 SL → 5 Broken).
- [ ] **Pass:** no immediate effect.
- [ ] **Transition:** after the Terror test (pass or fail), the source now causes **Fear at its Terror Rating** for the remainder of the encounter — enter the Extended Cool Test track.

### Tasks — Exposure detection & bookkeeping
- [ ] Exposure trigger: start of first round for all sources present, and mid-fight on first encounter with a new source (a Terrifying creature entering the fight).
- [ ] Per-encounter immunity: once a Fear Extended Test is completed (SL ≥ Rating), immune to that source. Terror's one-shot is once-only by definition. Track `{ combatantId, sourceId, type, state }` — extensible for deferred resistance talents (Stout-Hearted, Unshakable) to modify thresholds or grant re-rolls.
- [ ] Interaction gate: Fearless skips Fear entirely; Fearless vs Terror → downgrade to Fear track. Leave hooks for Hatred's "immune to Fear from hated group" (PSY-c) and Frenzy's "immune to all Psychology" (PSY-b).

### Tasks — AI awareness (heuristic controller)
- [ ] Movement policy: a feared combatant must not voluntarily approach the source (unless it passes the Cool test); the heuristic should prefer retreating or engaging other targets.
- [ ] Threat assessment: a combatant under Fear (with −1 SL) is less effective against that source — factor into target selection.
- [ ] *(Full Broken-behaviour policy deferred to PSY-e; here just ensure the AI respects the movement restriction and doesn't ignore gained Broken.)*

### Tasks — Tests / i18n
- [ ] Vitest: Frightening source triggers Extended Cool Test; SL accumulates across rounds toward Rating; while under Fear, −1 SL applies to tests against source; voluntary approach requires Cool test (fail → blocked); source approaching triggers Cool test (fail → Broken); SL ≥ Rating → Fear ends + immune; Terrifying source triggers one-shot (fail → Broken × Rating + failed SL; pass → nothing); after Terror test, source causes Fear at Terror Rating; Fearless skips Fear; Fearless vs Terror → downgraded to Fear track; multiple simultaneous Fear sources tracked independently; deterministic under seed.
- [ ] en/fr for Frightening/Terrifying/Fearless talent descriptions, Fear/Terror exposure events, Extended Cool Test progress events, approach-trigger events.

### Acceptance criteria
- Fear is an ongoing multi-round Extended Cool Test: accumulates SL toward the Fear Rating, applies −1 SL and movement restrictions while active, and triggers Broken on source approach; completion grants per-encounter immunity.
- Terror is a one-shot test: failure applies Broken × (Rating + failed SL); the source then causes Fear at its Terror Rating for the encounter.
- Fearless grants Fear immunity and downgrades Terror to Fear; interaction hooks are extensible for Frenzy/Hatred immunity (PSY-b/c).
- The heuristic AI respects movement restrictions and doesn't ignore Broken; fully deterministic under seed.

---

## PBI PSY-b — Frenzy

**User story:** As the simulator, I need Frenzy as a combat state — a Willpower-gated plunge into mindless aggression with a free attack and bonus Strength but no defence or retreat — so berserk fighters and frenzied creatures behave correctly and tilt encounter math.

**Why now:** it's the second psychology pillar, it interacts with PSY-a (frenzy ⇒ immune to all psychology), and it exercises the action economy and restricted-legal-set machinery that PSY-c/d/e and live-play will all reuse.

### Tasks — State & talents (`@wfrp/shared` types + game-data)
- [ ] Extend `CombatantPsychologyState` with a frenzy state (active flag + once-per-round free-melee-test bookkeeping); set `immuneToAllPsychology` while active (reusing PSY-a's flag).
- [ ] Author **Frenzy** (enables entering), **Battle Rage** (control / voluntary exit), **Flagellant** (involuntary trigger / fear immunity) via the 3g-1 schema — exact Battle Rage/Flagellant effects per your psychology-talent data.

### Tasks — Entry / exit (`@wfrp/shared` engine)
- [ ] New action **`frenzyEnter`** (`CombatActionKind` + `CombatDecisionKind`): legal when the actor has Frenzy, isn't frenzied, and a visible enemy exists; resolves a seeded **Willpower Test** → success enters Frenzy. Free action *(confirm)*.
- [ ] Optional **`frenzyExit`** gated by Battle Rage.
- [ ] Exit checks in the end-of-round orchestration and on-condition-change: ends when **no active enemy remains** or the actor gains **Stunned/Unconscious**; on exit, apply **1 Fatigued**.

### Tasks — While-frenzied constraints (`legalDecisions`)
- [ ] When frenzied, restrict the legal set to **full-speed movement toward, and melee attack against, the nearest visible enemy** — disallow ranged/defend/disengage/assess/aim/reload and (default) the tactical WS maneuvers.
- [ ] Force target = nearest visible enemy for both move and attack; suppress Broken-driven retreat (never flees).

### Tasks — Combat bonuses (hooks / economy)
- [ ] **Free Melee Test each round**: grant exactly one extra melee action per round to frenzied combatants (tracked via turn flags).
- [ ] **+1 Strength Bonus**: a `damageModifiers` hook contribution of +1 SB while frenzied.

### Tasks — AI (heuristic controller)
- [ ] Add a `frenzyEnter` case to `scoreDecision`: high for high-aggression profiles with a visible enemy and not yet frenzied (berserker ≈ always; duellist/brute situational; marksman/skirmisher rarely). The forced aggression itself is enforced by the legal-set restriction, so the existing scorer handles the restricted choices unchanged.

### Tasks — Tests / i18n
- [ ] Vitest: entry needs talent + WP test (fail → not frenzied; pass → frenzied, deterministic); frenzied legal set restricted to close+attack on the nearest enemy (no defend/ranged/disengage emitted); free melee test grants exactly one extra melee action per round; +1 SB applies to frenzied damage; immune to all psychology while frenzied (Fear/Terror source triggers no test); exit on no-active-enemies and on Stunned/Unconscious, applying Fatigued; Battle Rage voluntary exit if implemented.
- [ ] en/fr for `frenzyEnter`/`frenzyExit`, the Frenzy state events, and the three talents.

### Acceptance criteria
- A Frenzy-capable combatant enters via a WP test; while frenzied it may only close on and attack the nearest visible enemy, gains one free melee test per round and +1 SB, is immune to all other psychology, and never flees.
- Frenzy ends when no active enemy remains or the combatant is Stunned/Unconscious, applying 1 Fatigued; Battle Rage/Flagellant modify entry/exit per their talent data.
- The heuristic enters Frenzy in line with profile aggression; all transitions deterministic under seed.

---

## PBI PSY-d — Intimidate & Leadership

**User story:** As the simulator, I need Intimidate (frighten enemies into Fear) and Leadership (steel allies against psychology), so menace and command shape a fight as the rules intend.

**Why now:** fourth psychology pillar; Intimidate is pure reuse of PSY-a's Fear state, and Leadership introduces the psychology-test bonus that PSY-e's Rally will also lean on.

### Tasks — Intimidate (engine + game-data)
- [ ] New action **`intimidate`** (`CombatActionKind` + `CombatDecisionKind`), enemy-targeted: opposed **Intimidate (S) vs primary target's Cool** (resolved by kind).
- [ ] On success, apply **Fear (rating 1)** from the actor to up to **SB + SL** enemies — primary + nearest — by registering the actor as a Fear source through PSY-a; respects Fearless / immune-to-psychology gates.
- [ ] **Defensive substitution:** a defender afraid-of by their attacker may use Intimidate (S) as the defence skill — wire into the defence-skill resolution (`defensiveSkillFor` / opposed-defence path).
- [ ] **Menacing** talent enhancing Intimidate, per your psychology-talent data. (Command-issuing dropped.)

### Tasks — Leadership (engine + game-data)
- [ ] New action **`leadership`** as a dedicated untargeted catalogue entry with a custom dispatch: roll Leadership (Fel); on success grant **+10 to all Psychology tests** to the nearest **FelB + SL allies** **until the end of the next round**.
- [ ] New combatant state **`psychologyTestBonus`** (value + expiry round) read by the psychology test resolution; applied **before** round-start Cool tests resolve.
- [ ] **War Leader / Commanding Presence** extending reach/number/magnitude, per your talent data.

### Tasks — AI (heuristic controller)
- [ ] `scoreDecision` case for **`intimidate`**: higher when it can frighten a dangerous enemy or several at once (SB + SL ≥ 2 active targets), and against low-Cool foes; competes with a plain attack, doesn't dominate it.
- [ ] `scoreDecision` case for **`leadership`**: a support score, higher for low-aggression profiles when allies are present and under psychological threat (a Fear/Terror source on the field, or allies already Broken).
- [ ] In the defence path, prefer the Intimidate substitution when the attacker fears the defender.

### Tasks — Tests / i18n
- [ ] Vitest: Intimidate opposed win → up to SB + SL enemies gain a Fear state sourced from the actor (and then behave per PSY-a); loss → nothing; Fearless/frenzied targets unaffected; defensive Intimidate substitution fires only vs an attacker who fears the defender; Leadership success grants +10 Psychology to exactly FelB + SL allies, expiring end of next round, and measurably improves a subsequent Fear test; Menacing/War Leader/Commanding Presence per data; deterministic under seed.
- [ ] en/fr for `intimidate`/`leadership`, the Fear-from-intimidation events, the buff, and the three talents.

### Acceptance criteria
- Intimidate is an enemy-targeted opposed action that, on success, makes the actor a Fear source to up to SB + SL enemies (resolved through PSY-a), and lets a feared-of defender substitute Intimidate for Melee on defence.
- Leadership grants +10 Psychology to FelB + SL allies until the end of the next round, demonstrably improving their Fear tests.
- The heuristic intimidates dangerous/low-Cool foes and leads when allies are under pressure; all resolution is deterministic under seed.

---

## PBI PSY-e — Broken Behaviour, Rally & Routed-Side Termination

**User story:** As the simulator, I need Broken combatants to actually break — flee or cower, possibly recover, and let a shattered side rout — so fights end the way real WFRP fights end, by morale as well as by blades.

**Why now:** it closes the psychology epic, turns every Fear/Terror/Intimidate result into real behaviour, and adds the rout exit that makes encounters decisive (and re-bases your aggregates).

### Tasks — Broken behaviour (engine + heuristic)
- [ ] Replace the stub Broken override with rule-accurate handling: """You are terrified, defeated, panicked, or otherwise convinced you are going to die. On your turn, your Move and Action must be used to run away as fast as possible until you are in a good hiding place beyond the sight of any enemy; then you can use your Action on a Skill that allows you to hide more effectively. You also receive a penalty of –10 to all Tests not involving running and hiding. You cannot Test to rally from being Broken if you are Engaged with an enemy. If you are unengaged, at the end of each Round, you may attempt a Cool Test to remove a Broken Condition, with each SL removing an extra Broken Condition, and the Difficulty determined by the circumstances you currently find yourself: it is much easier to rally when hiding behind a barrel down an alleyway far from danger (Average +20) than it is when three steps from a slavering Daemon screaming for your blood (Very Hard –30).\n\nIf you spend a full Round in hiding out of line-of-sight of any enemy, you remove 1 Broken Condition. Once all Broken Conditions are removed, gain 1 Fatigued Condition."""
- [ ] Ensure the AI never takes offensive actions while forced to flee; competence-floor Fate-save still applies and doesn't fight the compulsion.

### Tasks — Rally / recovery (engine)
- [ ] End-of-turn **Cool test** (works while fleeing) that removes Broken on success *(count per your rules; default 1, more on high SL)*; **`psychologyTestBonus` from Leadership applies**.
- [ ] Flag: optional deliberate Rally action for the 1-Broken case.

### Tasks — Resistance & flee talents (game-data + hooks)
- [ ] **Iron Will / Unshakable** — reduce Broken gained / improve recovery (hook into the gain-Broken and Rally paths; reuses PSY-a's resistance gate).
- [ ] **Stout-Hearted** — bonus to Cool tests to resist Fear and remove Broken.
- [ ] **Flee!** — extra Movement while fleeing (wire into the flee movement).
- [ ] All per your psychology-talent data.

### Tasks — Rout / flee-the-field termination (engine)
- [ ] A fleeing Broken combatant past the flee threshold is marked **`removedFromEncounter`** ("fled").
- [ ] Confirm `isActive` (now single-source from the engine) excludes fled combatants so **`sideDownTermination`** counts a fully dead/unconscious/fled side as defeated — fights end by **rout**, not only kills. **Re-baseline saved reports.**

### Tasks — Precedence resolver (engine)
- [ ] Consolidate psychology precedence into one resolver: Frenzy (immune to all psychology) > Fear/Terror; Fearless (immune to Fear); apply `psychologyTestBonus`. Leave clearly-marked slots for Animosity/Hatred so deferred PSY-c drops in without scattering checks.

### Tasks — Tests / i18n
- [ ] Vitest: 2+ Broken → flees the source at full move; cornered → cowers (no offensive action emitted); 1 Broken → acts under penalty; end-of-turn recovery removes Broken and Leadership's +10 measurably helps; Iron Will/Unshakable reduce Broken; Stout-Hearted boosts resist/recovery; Flee! adds flee distance; a fully-Broken side that flees the field is removed → termination fires as a win, not a draw; precedence: frenzied ignores Fear, Fearless ignores Fear; deterministic under seed.
- [ ] en/fr for flee/cower, recovery, rout/fled events, and the talents.

### Acceptance criteria
- Broken combatants flee the Fear source (or cower if cornered); an end-of-turn Cool test (boosted by Leadership) sheds Broken; resistance/flee talents modify gain/recovery/flight per their data.
- A side fully dead, unconscious, or fled counts as defeated, so fights end by rout — measurably reducing draws (re-baseline reports).
- Psychology precedence resolves in one place; all transitions deterministic under seed.

---

