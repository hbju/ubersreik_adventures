

## Epic 1 — Combat Engine Extraction, Combatant Model & Seeded RNG

**User story:** As a developer, I need combat resolution to exist as pure, seeded, side-effect-free functions in `@wfrp/shared`, so the simulator can run fights headlessly and the live VTT can share one source of truth.

**Why first:** You confirmed the damage logic and a lot more is coupled inside the `CombatResolver` component. Nothing downstream can be simulated until resolution is callable without React.

### Tasks — Audit & model (`@wfrp/shared`)
- [ ] Audit `CombatResolver`: catalogue every resolution rule currently living in the component (damage calc, AP application at location, SL→damage, crit triggering, advantage changes). Output a checklist of what must move to shared.
- [ ] Define `Combatant` sim-state type in a new `combat/` module: projection of `Character` + transient state (position/band placeholder, `engagementIds`, action/move/reaction budget, advantage, `conditions[]`, resource snapshot).
- [ ] Define a combat **event model** — discriminated union (`AttackResolved`, `DamageDealt`, `ConditionApplied`, `CritRolled`, `ResourceSpent`, …). Engine returns events; it never mutates UI. Events carry **i18n keys + data, not localized strings**, so the runner stays locale-agnostic.

### Tasks — Engine functions (`@wfrp/shared`)
- [ ] Define an `Rng` interface; provide a seeded implementation (e.g. mulberry32) + a default `Math.random` impl. Refactor `rolld100`/`rollDice` (and callers) to accept an injected `Rng`.
- [ ] Extract the damage pipeline first (worst-coupled): `resolveDamage(state, hit, rng) → { state', events[] }` covering SL + weapon damage − TB − AP-at-location, crit-on-0-wounds trigger.
- [ ] Extract `resolveMeleeAttack(state, action, rng) → { state', events[] }` wrapping the opposed test → hit location → damage chain (using existing `mechanics.ts` utils).
- [ ] Provide backward-compat wrappers so existing callers (`DiceTray`, live `CombatResolver`) keep working during migration.

### Tasks — GM App migration
- [ ] Refactor `CombatResolver` component to delegate to the new pure functions and render the returned events — **behavior parity** with current live combat (no rules change in this PBI).
- [ ] Regression-check `InitiativeTracker` and `DiceTray` against the RNG refactor.

### Tasks — Tests
- [ ] Vitest golden tests: fixed seed → known fight outcomes; damage-pipeline edge cases (AP/TB stacking, SL boundaries, crit-on-0-wounds).
- [ ] Vitest: RNG determinism — same seed yields identical sequences and identical fight results.
- [ ] *(Optional)* Playwright: a sample attack in live GM combat resolves identically pre/post refactor.

### Acceptance criteria
- All combat resolution exists as pure, seeded, unit-tested functions in `@wfrp/shared`.
- The live GM `CombatResolver` delegates to them with no observable behavior change.
- Same seed → byte-identical fight outcome (the foundation for reproducible sims and replay).

All good — and that matches my instinct: heuristic now, MCTS as a drop-in controller later. Nice work landing PBI 1; with resolution now pure and seeded, the spatial layer has something clean to build on.

Before the tasks, here's the spatial design I'm baking in. It's the faithful reading of "abstract bands, but with real movement" — flag anything you'd rather do differently:

---

## PBI 2 — Spatial Model: Range Bands, Movement & Engagement

**User story:** As the combat engine, I need to track combatant positions, movement, and engagement on an abstract 1D battlefield, so melee closing, disengagement, reach, and ranged distance can all be resolved headlessly.

**Why now:** Resolution (PBI 1) is positionless. Nothing about closing distance, who-can-reach-whom, In-fighting, or ranged modifiers can exist until the engine knows where combatants are.

### Tasks — Spatial model (`@wfrp/shared` `combat/spatial`)
- [ ] Extend `Combatant` with spatial state: `position: number` (yards), `movementBudget` (per-round, derived), and confirm `engagementIds` becomes a symmetric set maintained by the engine.
- [ ] Add `getWalkRun(combatant)` deriving Walk/Run from the Movement attribute per the Movement table (Walk ≈ M×2, Run ≈ M×4 — confirm against your book); store as the per-round budget source.
- [ ] Add `distanceBetween(a, b)` and `bandFor(distance, thresholds)` → `Engaged | Short | Medium | Long`. Proposed default thresholds (tune): Engaged ≤ 1.5y, Short ≤ 6y, Medium ≤ 20y, Long > 20y.
- [ ] Add `canReach(combatant, target, { running })` / `movementToReach(...)` — answers "can X close to Y this turn with Walk or Run," for the heuristic controller (PBI 5) and movement resolution here.

### Tasks — Movement & engagement primitives (`@wfrp/shared`)
- [ ] `applyMove(state, combatantId, target, mode: 'walk' | 'run' | 'charge', rng) → { state', events[] }`: enforce budget; `run` and `charge` consume the Action (flag it); emit `MovedEvent`. Charge movement only here — its attack bonus lands in PBI 3.
- [ ] `engage(state, aId, bId) → { state', events[] }` and `disengage(state, combatantId) → { state', events[] }`: maintain the symmetric engagement graph, enforce that leaving engagement goes through Disengage (consumes Action), emit `EngagedEvent` / `DisengagedEvent`. **Defaulting Disengage to RAW (action-cost, no free attack)** pending your confirmation — Up in Arms consequences would be a flag consumed in PBI 3.
- [ ] `outnumberingFor(combatantId, state)` from the engagement graph (count of engaged enemies) — pure data feeding Up in Arms Advantage in PBI 3.

### Tasks — Reach & In-fighting state (`@wfrp/shared`)
- [ ] Read weapon **Reach** from existing `weapons_*.json`; expose `reachOf(combatant)`.
- [ ] `reachOrder(engagement)` → strike-order hint (greater Reach strikes first on the engagement's first round) and `isInfighting(engagement)` → boolean flag (enemy closed inside your reach). **Data and flags only** — the test penalties/timing effects are applied in PBI 3.

### Tasks — Tests
- [ ] Vitest: Walk/Run derivation across Movement values; distance → band mapping at threshold boundaries; `canReach` with Walk vs Run.
- [ ] Vitest: `engage`/`disengage` keep the graph symmetric; outnumbering counts correctly with 1-to-N and N-to-N; Run/Charge correctly flag the Action as spent.
- [ ] Vitest: seeded determinism preserved through movement (same seed → same positions/engagement).

### Tasks — i18n / Live app
- [ ] Register en/fr keys for the new movement/engagement events (events carry keys + data, not localized strings — per PBI 1).
- [ ] No live GM UI work this PBI — the spatial layer is pure engine; the sandbox consumes it in PBI 7. (Noting explicitly so it doesn't get scoped in by accident.)

### Acceptance criteria
- Combatants have positions; distance, positional band, Walk/Run, and "can I reach" are pure, unit-tested functions.
- Engagement is a symmetric N-to-N graph; outnumbering is queryable; Disengage and Run/Charge correctly consume the Action.
- Reach order and In-fighting are exposed as flags, with no rules effects applied yet.
- Same seed → identical spatial outcomes.

---

# Epic 3 — Combat Rules Engine (recap)

**What it is:** the complete WFRP4e combat *rules layer* for the fight simulator — a pure, seeded, headless engine in `@wfrp/shared`. No UI, no AI, no turn loop yet (those are Epics 5+). Everything takes state in and returns `{ state, events }` out, so the same code drives both the simulator and live play.

## Architecture in one breath

- **Pure + seeded:** all randomness goes through an injectable RNG; same seed → identical outcome.
- **Hook phases:** resolution exposes `preRollModifiers / slModifiers / damageModifiers / apModifiers / onHitEffects / critResolver` (3c) and crit hooks `critTriggerExtensions / critIgnoreConditions / critApModifiers / onCritEffects` (3d). Qualities (3e) and talents (3g) plug into these — they never edit the core.
- **Events carry i18n keys + data, never localized strings** (the runner stays locale-agnostic).
- **Decisions are deferred:** anything optional (spend Advantage, fire a talent, pick a target/mode) is exposed with a *stub policy*; the real choices come from the controller in Epic 5.

## What each sub-PBI implemented

- **3a — Group Advantage (Up in Arms).** Two shared side pools (Ally/Adversary), not per-combatant. Gain on *initiated* opposed wins; the spend table (Batter, Trick, Additional Effort, Flee from Harm, Additional Action); initial seeding (highest modifier per category); end-of-round reallocation by living-combatant count.
- **3b — Conditions Effects.** In-combat effects of all 12 Conditions: penalty aggregation (same-type stacks, different-type → highest only, Prone never stacks), attacker bonuses, Stunned→Advantage, end-of-round damage (Ablaze/Bleeding/Poisoned incl. bleed-out death), removal timers + Fatigued chains, and capability gates (who can act/move).
- **3c — Core Melee Resolution.** The spine: opposed Melee test → hit location → damage → wounds, the composable difficulty system (cap −30/+60 then sum), outnumbering/Weapon Length/Size/Charging modifiers, fumbles (Oops table), crit *detection*, initiative + surprise, attack-driven engagement with decay.
- **3d — Critical Wounds, Injuries & Death.** Crit roll + the four Up in Arms tables (encoded as data + an interpreter), in-combat injury effects (recovery economy recorded, not simulated), and death (instant table results + accumulated crits > TB + coup-de-grâce + Sudden Death toggle).
- **3e — Weapon Qualities & Flaws.** Each quality/flaw wired to a hook (Damaging, Penetrating, Undamaging, Shield, Pummel, Entangle, Distract, Trip, Slash, Impale, Impenetrable, Weakpoints, Partial, Defensive, Fast/Slow, Dangerous…), the shared **activation interface**, and armour AP layering. (Ranged-only and gear-degradation qualities deferred.)
- **3f — Special Actions & Resources.** In-fighting, two-path Disengage (Flee from Harm / Use Dodge), Grappling, two-weapon (−20 off-hand), Assess / Defend / Sprint / First Aid, and the full Fate & Fortune economy (reroll, +1 SL, Act First; Die Another Day, How Did That Miss?).
- **3g-1 — Talent Schema & Passive/Calc Effects.** Normalized effect schema (closed `kind` enum, `trigger`/`cost`/`params`/enumerated `when`), the condition-predicate evaluator, the centralized tied-test +1 SL/rank rule, and all passive/calculation combat talents.
- **3g-2 — Activated & Action Talents.** Shieldsman, Beat Blade, Disarm, Distract (talent), Feint, Reversal, and the full Dual Wielder dependent-dice sequence.

## House rules an agent must not break

- **No passive +10 × Advantage** — Advantage is spend-only.
- **Advantage only to the initiator** of a won opposed test; defenders never gain by winning.
- **Melee defence deals no counter-damage** — only a Crit or a talent (Riposte/Shieldsman/Reversal) hurts the attacker.
- **Gaining a Condition does NOT drop all Advantage** (core rule replaced by Group Advantage).
- **Crit roll** = `d100 + 10×beyond − (20 if 0 < beyond < TB)`, floored at 01.
- **Up in Arms injuries only;** multi-day recovery, permanent penalties, and disease are recorded, never simulated.
- Walk = M×2, Run = M×4. No facing (flank/rear modifiers unused).

## Deferred out of Epic 3

- Reaction talents (Riposte, Reaction Strike, Step Aside, Furious Assault, Fast Shot) → **Epic 5** (need the reaction window / action economy).
- Ranged talents and qualities → **Epic 4**.
- Psychology (Frenzy, Fear/Terror, Intimidate/Leadership, Broken-removal talents) → **v2**.

---

## Epic: Ranged Combat

Three sub-PBIs, dependency-ordered. 4a is the spine; 4b and 4c hang off it.

- **4a — Ranged Resolution Core:** shot legality, range bands, the opposed/unopposed determination, the full ranged modifier stack, damage/location/crit/fumble + misfire, the hit-or-nothing Advantage rule, Aim, and the pure-modifier ranged talents/qualities. *Depends on 3a/3c/3d/3e and PBI 2.*
- **4b — Ammunition, Reloading & Rate of Fire:** loaded/unloaded state, Reload (Rating) Extended Test, single-load vs Repeater (Rating), Gunner / Rapid Reload. *Depends on 4a.*
- **4c — Multi-target, Thrown & Situational:** Shooting into a Group (+ optional into-Melee toggle), Blast/Spread AoE over the 1D field, thrown weapons, Impale lodged ammo. *Depends on 4a.*

(Fast Shot's fire-before-Initiative ordering stays queued for PBI 5; the shot itself resolves in 4a.)

## PBI 4a — Ranged Resolution Core

**User story:** As the engine, I need ranged attacks resolved end-to-end — including the cases where they become opposed — so shooting is as rules-correct and seeded as melee.

**Why first:** Everything ranged composes the single-shot resolution; 4b and 4c can't exist without it.

### Tasks — Shot setup & legality (`@wfrp/shared`)
- [ ] Block firing while Engaged unless the weapon has the Pistol quality.
- [ ] Range band from distance (PBI 2) vs weapon Range: PB(R/10)/Short(R/2)/Normal(R)/Long(2R)/Extreme(3R); beyond 3R → out of range (illegal shot).
- [ ] `rangedDefenceOptions(target, context)`: returns Shield(2)+ → Melee(Parry)/Melee(Basic)−20; Point Blank → Dodge; shooter Engaged with target → any Melee Skill; otherwise none (unopposed).

### Tasks — Resolution (reusing 3c/3d)
- [ ] Unopposed path: Ranged Test vs difficulty; success = hit, SL = margin.
- [ ] Opposed path: higher SL wins; shooter wins → hit; target wins → shot negated, **no counter-damage**; only the shooter gains Advantage, only on a win.
- [ ] Fill 3c's empty ranged modifier sources: range band, size, cover (config flag none/soft/medium/hard), shooting while moving (−10), Aim (+20 if aimed last action), darkness — through the existing capping/cancelling engine.
- [ ] Damage = fixed weapon Damage + SL; hit location by reversed roll; apply via 3c (TB + AP).
- [ ] Advantage: hit → +1 shooter side; miss → nothing.
- [ ] Crits: doubles-on-success → 3d. Fumbles: failed + double → Oops; **blackpowder even-double → misfire** (full Damage to Primary Arm, units die as SL, weapon destroyed).
- [ ] Aim action: sets an aimed flag granting +20 to the next ranged test.

### Tasks — Pure-modifier ranged talents & qualities
- [ ] Accurate (+10 to fire), accurate-shot (+level Damage), sure-shot (ignore AP = level), sniper (no Long penalty, half Extreme), sharpshooter (ignore size penalties), dead-eye-shot (pick hit location). All via the schema/hooks from 3g-1/3e.

### Tasks — Tests / i18n
- [ ] Vitest: band thresholds at boundaries (R/10, R/2, R, 2R, 3R, out-of-range); each opposed trigger (Shield 2+, Point Blank Dodge, Engaged → Melee) and the unopposed default; target-wins → negation with no counter-damage; modifier stack + capping for a ranged shot; hit→+1 / miss→nothing; ranged crit on a double; blackpowder misfire; Aim +20; each pure-modifier talent/quality.
- [ ] en/fr keys for ranged events.

### Acceptance criteria
- A ranged shot resolves by seed through both the unopposed and all three opposed paths, with correct band-derived difficulty and the full modifier stack.
- The Engaged/Pistol restriction, hit-or-nothing Advantage, ranged crits, and the blackpowder misfire all fire correctly.
- The ranged talents/qualities listed apply through the existing hooks; nothing relies on melee-only assumptions.
- Same seed → identical shot outcomes.

---

## PBI 4b — Ammunition, Reloading & Rate of Fire

**User story:** As the engine, I need ranged weapons to track loaded state and resolve reloading as an Extended Test, so weapon tempo (a bow vs. a slow arquebus vs. a repeater) actually shapes the fight.

**Why now:** 4a fires shots but assumes the weapon is ready; tempo is a real balance lever the sim needs, and it can't exist until single-shot resolution does.

### Tasks — Ammo state & Extended Test (`@wfrp/shared`)
- [ ] Add per-weapon-instance ammo state: `loaded: boolean` for single-load weapons, `shotsRemaining` for Repeater, and a `reloadProgress { accumulatedSL, targetSL } | null`.
- [ ] Build a generic **Extended Test** helper (accumulate SL across actions toward a target; reset on interruption) — reload is its first consumer.
- [ ] Firing consumes the loaded shot (or decrements Repeater); the Attack action requires a loaded weapon and is blocked mid-reload.

### Tasks — Reload mechanics
- [ ] **Reload (Rating) flaw:** an unloaded weapon requires an Extended Ranged Test (appropriate Weapon Group, a plain skill test — not the attack pipeline) scoring (Rating) SL to become loaded; interruption (per the decision above) resets progress to 0.
- [ ] **Repeater (Rating):** fire up to Rating shots without reloading; when empty, run the normal reload procedure.
- [ ] Weapons without the Reload flaw: ready each round (no state tracking), per the decision above.
- [ ] Expose a **reload-test modifier hook** for talents to target.
### 4b addendum — Reload Interrupt Guard
- [ ] Add a **centralized interrupt guard** run after each resolution/engine step: for any combatant currently mid-reload who is the subject of an interrupting event (and it isn't a reload-continuation), call `interruptReload` once per step (idempotent if several land at once).
- [ ] Enumerate the **interrupting event set**: `DefenceParticipated` (as defender), `DamageDealt` (as target), `Moved` (as subject), `ActionTaken` where action ≠ continue-reload, and end-of-round `ConditionDamage`/`ConditionApplied` (as subject). Exclude the reload-continuation event.
- [ ] Make `interruptReload` internal — called only by the guard, no direct call sites.

### Tasks — Reload talents (via 3g-1 schema)
- [ ] **Gunner:** +SL (per rank, per your data) to reload Extended Tests, gated to blackpowder/engineering weapons.
- [ ] **Rapid Reload:** +SL (per rank) to reload tests, plus its secondary effect (a reload counting as Assess → Advantage) wired through 3f's Assess and 3a.

### Tasks — Optional finite ammo
- [ ] Optional per-combatant ammunition count (config, default unlimited); firing decrements it; empty → can't fire until resupplied (out of scope to model resupply in a single fight).

### Tasks — Tests / i18n
- [ ] Vitest: Extended Test accumulation and interruption-reset; Reload (Rating) takes the expected number of actions at a given SL; firing blocked while unloaded/mid-reload; Repeater fires N then forces a reload; fire-each-round for non-Reload weapons; Gunner/Rapid Reload modify the reload test (and Rapid Reload's Assess grants Advantage); optional finite-ammo depletion; attacked-and-defends resets even on a *winning* Dodge; Ablaze/Bleeding end-of-round damage resets; Distract/Shieldsman push resets; choosing a non-reload action resets; continuing the reload progresses; two interrupts in one step → single reset.
- [ ] en/fr keys for reload/ammo events.

### Acceptance criteria
- Loaded state is tracked per weapon; reloading resolves as an interruptible Extended Test to (Rating) SL; Repeater and fire-each-round weapons behave correctly.
- Gunner and Rapid Reload modify reload tempo through the talent system, not special cases.
- Firing is correctly gated on ammo/loaded state; optional finite ammo works when enabled.
- Same seed → identical reload/ammo outcomes.
- reload resets from every interrupting source through the one guard, and `resolveMeleeAttack`/`resolveRangedAttack` plus the 3b round loop interrupt reloads without any of them knowing reloading exists.

---

## PBI 4c — Multi-target, Thrown & Situational

**User story:** As the engine, I need group shots, area weapons, and thrown weapons resolved over the 1D field, so crowd fire, blast weapons, and thrown attacks play correctly — closing the ranged epic.

**Why now:** single-shot resolution (4a) and ammo/reload (4b) exist; everything here composes single-shot resolution into multi-target or area effects.

Three small decisions, defaulted:
- **Blast on a miss = no effect** (no scatter modelled in v1). Confirm.
- **Spread:** one to-hit applies to all caught targets, and "the next closest creatures" includes allies (friendly fire), matching the text's "creatures." Confirm, or restrict to non-allies.
- Shooting into Melee stays a **toggle, default off** (already agreed).

### Tasks — Shooting into a Group
- [ ] When the caller targets a *group* (a candidate set, not a single combatant), apply the count bonus (+20 for 3–6, +40 for 7–12, +60 for 13+) and, on a hit, pick the struck member via seeded RNG.

### Tasks — Shooting into Melee (optional, toggle)
- [ ] Targeting a specific melee-engaged combatant: −20; if the penalised roll fails *but would have succeeded without the −20*, hit a random other combatant in that melee (seeded). "Don't care about friendly fire" variant → resolve as Shooting into a Group.

### Tasks — Blast (Rating)
- [ ] On a hit, every Character within Rating yards of the target point (1D distance, **friend and foe**) takes **SL + Weapon Damage** plus any Conditions the weapon inflicts — each with its own hit location and AP, reusing 4a's per-hit application. Miss → no effect.

### Tasks — Spread (Rating)
- [ ] Point Blank → single target, **+Rating Damage**. Short–Long → primary + the next (Rating) closest visible creatures, chained so no two are more than Rating yards apart (over 1D positions), one to-hit applied to all. Extreme → as Short–Long but **−Rating Damage**.

### Tasks — Thrown & Impale ammo
- [ ] Thrown weapons resolve as ranged with SB-derived range (reuse 4a); no reload state.
- [ ] Ranged **Impale** crit → record lodged ammunition (Challenging Heal to remove); record-only, no in-combat effect.

### Tasks — Tests / i18n
- [ ] Vitest: group bonus tiers + seeded hit selection; into-melee toggle (penalised hit, would-have-hit → random ally, clean miss) + friendly-fire-as-group variant; Blast radius selection over 1D incl. friendly fire and per-target location/AP; Spread per band (PB +dmg single, Short–Long chain with spacing, Extreme −dmg); thrown SB-range shot; Impale lodged ammo recorded.
- [ ] en/fr keys for multi-target/thrown events.

### Acceptance criteria
- Group, into-melee, Blast, Spread, and thrown all resolve by seed over the 1D field, reusing 4a; Blast/Spread hit the correct target sets with correct damage modifiers and friendly fire; Impale lodged ammo is recorded.
- Same seed → identical multi-target outcomes.

---

## Appendix to Epics 3 & 4 — Weapon Proficiency & Group Skills

**User story:** As the engine, I need weapon-group proficiency to determine the test skill and whether Qualities apply, so an untrained wielder is correctly penalised and ineligible weapons can't be used.

**Why now:** 3c and 4a both pick a skill to test and 3e applies Qualities unconditionally — all three currently assume proficiency. This is the missing gate.

### Tasks — Proficiency resolver (`@wfrp/shared`)
- [ ] `resolveWeaponUse(combatant, weapon) → { test: SkillRef | Characteristic, qualitiesActive: boolean, extraFlaws: Flaw[], usable: boolean }`, reading `weapon.group` + the character's skills.
- [ ] **Melee:** advances in `Melee(group)` → that skill, Qualities on. No advances → test **WS**, Qualities **off**, Flaws still apply. Flail unskilled → also add the **Dangerous** flaw. Always `usable: true` (melee never hard-blocks).
- [ ] **Parry:** any one-handed weapon with the Defensive quality may be used with `Melee (Parry)`; flag it so 3f opposes **without the −20 off-hand penalty**.
- [ ] **Ranged:** has the specialty → that skill, Qualities on. Otherwise the fallback matrix: Crossbow/Throwing → test **BS**, Qualities off, Flaws kept; Engineering weapon via `Ranged(Blackpowder)` → Qualities off; Blackpowder/Explosive via `Ranged(Engineering)` → **full use**. No specialty and no fallback → `usable: false`.
- [ ] **Cavalry (unmounted, v1):** two-handed Cavalry weapons gain **Two-Handed**; single-handed allowed with no special effect (mounted rules → v2).

### Tasks — Integration amendments
- [ ] **3c:** melee to-hit uses `resolveWeaponUse().test` instead of a generic Melee skill.
- [ ] **4a:** ranged shot picks the test the same way and **hard-blocks** when `usable: false` (alongside the existing out-of-range / Engaged-without-Pistol checks).
- [ ] **3e:** gate the quality registry on `qualitiesActive` (Flaws and `extraFlaws` always apply); the Improvised end-to-end test should still pass since its profile is flaw-only.
- [ ] **3f:** honour the Parry off-hand exemption.

### Tasks — Tests / i18n
- [ ] Vitest: skilled melee → group skill + Qualities; unskilled melee → WS, no Qualities, Flaws kept; Flail unskilled → Dangerous added; Parry opposes with no −20; ranged with specialty → full; crossbow/throwing without specialty → BS, no Qualities, Flaws kept; engineering-via-blackpowder → no Qualities; blackpowder/explosive-via-engineering → full; non-fallback ranged without specialty → shot blocked; two-handed Cavalry unmounted → Two-Handed.
- [ ] en/fr keys for proficiency / weapon-unusable events.

### Acceptance criteria
- The test skill (or WS/BS fallback) and Quality activation are correct for every melee and ranged weapon given the wielder's training; ineligible ranged weapons are blocked; Flails and Parry weapons behave per their special rules.
- Same seed → identical outcomes.

---

## PBI 5a — Turn Engine Core

**User story:** As the simulator, I need a steppable round/turn loop that drives combatants through correct action economy and round structure to a terminal state, so a fight can run end-to-end by any controller.

**Why first:** It's the orchestrator everything else plugs into; with a scripted controller it makes the whole engine runnable and testable for the first time.

### Tasks — Loop & action economy (`@wfrp/shared`)
- [ ] Steppable loop: combat setup (surprise determination via 3c, initial Advantage seeding via 3a) → rounds → per-combatant turns in initiative order → end-of-round → repeat. Expose **advance-to-next-decision** / **apply-decision** plus a run-to-completion wrapper.
- [ ] Action economy per turn: one Move + one Action + free actions, either order; Run/Charge/Sprint consume the Action; **Additional Action** (4 Advantage) grants one extra; **Furious Assault** adds an attack for Advantage/Move. Budget tracker enforced.
- [ ] Initiative ordering (Ag + d10, tie-breaks) with the dynamic overrides: **Act First** (Fortune), **Fast weapon** and **Fast Shot** (act out of sequence), **Slow** (strike last).

### Tasks — End-of-round orchestration
- [ ] Wire every deferred "loop invocation" in the correct sequence: start-of-round effects → turns → end-of-round condition damage (Ablaze/Bleeding/Poisoned via 3b, incl. unconscious bleed-out/poison death rolls) → Advantage reallocation (3a) → engagement decay (3c) → accumulated death check (3d) → condition removal timers/tests and Surprised expiry. **Sequence matters — test the order.**

### Tasks — Controller interface & legal decisions
- [ ] `CombatantController` interface (`choose(decisionContext)`); `legalDecisions(state, combatant)` enumerating legal options under all gates — condition capabilities (Stunned/Surprised/etc.), engagement (no ranged while Engaged sans Pistol), reload/loaded state, weapon proficiency (the appendix), available Advantage for the your-turn spend actions, and the action/move budget.
- [ ] A **Manual/Scripted controller** so the loop runs and tests end-to-end without the heuristic AI (5c).
- [ ] Determinism plumbing: controllers receive full state; any controller randomness draws from the seeded RNG; state is immutable/cloneable so it's **forkable** for future MCTS.

### Tasks — Termination
- [ ] End when one side is fully incapacitated (dead/unconscious); max-round cap (default ~50) → **draw**. (Routed/fled is a no-op until psychology lands.)

### Tasks — Tests / i18n
- [ ] Vitest: a scripted 1v1 and 2v2 run to completion deterministically by seed; initiative order + tie-breaks + Act First/Fast/Slow/Fast Shot; action-economy limits (Run consumes Action, Additional Action/Furious Assault grant extras, budget can't be exceeded); `legalDecisions` respects every gate; **end-of-round sequence** fires in order; termination on side-down and the max-round draw; stepwise pause/resume and a fork-and-diverge smoke test.
- [ ] en/fr keys for round/turn/termination events.

### Acceptance criteria
- A combat runs both stepwise and to completion, deterministically by seed, via a scripted controller — correct round structure, action economy, initiative with overrides, full ordered end-of-round orchestration, and termination/cap.
- `legalDecisions` enumerates exactly the legal options under all gates; state is forkable for MCTS.
- Same seed + same scripted decisions → identical fight.
