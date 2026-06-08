

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

---

## PBI 5b — Reaction Window & Interrupts

**User story:** As the engine, I need eligible combatants offered their reactive options at defined trigger points, so Ripostes, Reaction Strikes, Step Asides, and Fate/Fortune interceptions resolve correctly mid-action.

**Why now:** 5a gave us the loop and the `choose` protocol; reactions are the off-turn decision points that complete combat correctness — especially the survivability interceptions the sim depends on.

### Tasks — Trigger points & offer mechanism (`@wfrp/shared`)
- [ ] Define the reaction triggers in resolution: attacked-in-melee (the defence anchor), charged, test-rolled, test-failed, won-Dodge-defence, won-defensive-Melee, scored-a-defensive-crit, damage-about-to-apply, would-die.
- [ ] At each trigger, enumerate the *eligible* reactions for the relevant combatant (gated by talent/resource/weapon/state) and route through `controller.choose` (reusing 5a). Offer in **initiative order** when multiple combatants/reactions are eligible; reactions are forkable decision nodes drawing any randomness from the seeded RNG.

### Tasks — Wire the reactions (effects exist in 3f/3g; 5b connects triggers)
- [ ] **Riposte:** Fast-weapon melee defence → deal damage to the attacker (the defender-damage path).
- [ ] **Reaction Strike:** on being Charged → Initiative test → free attack *before* the charge attack resolves (once per charger).
- [ ] **Step Aside:** on winning a Dodge → move 2 yards + disengage, no free attack (updates position/engagement).
- [ ] **Reactive Advantage-spend exceptions:** Shieldsman (shield defence), Reversal (won defensive Melee), Slash's extra Bleeding (defensive crit) — spend from the pool reactively per the confirmed exception.
- [ ] **Fate interceptions:** How Did That Miss? (negate incoming damage) and Die Another Day (negate death) via the 3f hooks; both available against reaction-dealt damage too.
- [ ] **Fortune interceptions:** Reroll (failed test) and +1 SL (any test) via the 3f reroll hook; fire on any test by that combatant, on or off turn.

### Tasks — Loop prevention & edge rules
- [ ] Attack-triggered reactions fire only off deliberate Attack/Charge actions, never off reaction damage; interceptions apply to any damage/death; hard recursion-depth cap as a safety net.
- [ ] Additional Effort (Advantage) is *not* offered on a reactive defence; the reactive-spend talents/qualities are.

### Tasks — Tests / i18n
- [ ] Vitest: Riposte fires only with a Fast weapon and damages the attacker; Reaction Strike precedes the charge, gated on the Initiative test and once-per-charger; Step Aside repositions + disengages on a Dodge win; How Did That Miss? negates damage (incl. against Riposte damage) and decrements Fate; Die Another Day negates a lethal result; Fortune reroll/+1 SL on both an off-turn defence and an on-turn attack; Shieldsman/Reversal/Slash spend pool Advantage *reactively*; Additional Effort *not* offered on a defence; **loop prevention** (Riposte damage doesn't trigger a counter-Riposte; attacker may still Fate-save it; depth cap holds); deterministic initiative-order offers when multiple are eligible; whole-fight determinism preserved.
- [ ] en/fr keys for reaction/interception events.

### Acceptance criteria
- Every v1 reaction fires at the correct trigger through the shared protocol, gated by resources/eligibility; interceptions negate damage/death correctly; loop prevention and the edge interactions behave per the confirmed rules.
- Reaction offers are deterministic and forkable; same seed + same decisions → identical fight.

---

## PBI 5c — Heuristic Controller & Behavior Profiles

**User story:** As the simulator, I need a heuristic controller that makes reasonable, profile-driven, deterministic decisions at every decision point, so automated fights play plausibly and the Monte-Carlo runner has a default brain.

**Why now:** 5a/5b expose every choice through `choose`; swapping the Manual/stub answers for competent heuristics is the last thing between us and automated sims.

### Tasks — Controller skeleton (`@wfrp/shared`)
- [ ] `HeuristicController` implementing `choose(decisionContext)` for all three decision kinds (turn-level, resolution-level, reaction), pure over `(state, profile, seededRng)`.
- [ ] Profile model as data (weights/thresholds); load the five profiles.
- [ ] Structured decision logging: `{ chosen, reasonCode, rejectedAlternatives }` attached to the event stream (locale-agnostic, renderable later).

### Tasks — Policy modules (composable, profile-weighted)
- [ ] **Competence floor** (shared by all profiles): always make a defence choice when attacked, never pass/waste an Action with a useful option available, never pick a dominated option, spend Fate to avoid death unless the risk threshold says otherwise.
- [ ] **Target selection:** focus-fire / threat / nearest, profile-weighted.
- [ ] **Action selection** over `legalDecisions`: profile priority ordering (Berserker → Charge/all-out; Duellist → attack but Defend when pressed; Skirmisher → disengage/kite when Engaged; Marksman → shoot, reposition to keep range; Brute → sensible greedy).
- [ ] **Movement/positioning:** close vs hold vs kite by profile, loadout (melee/ranged), and range band.
- [ ] **Defence-skill choice:** parry / dodge / shield by profile + available loadout.
- [ ] **Advantage-spend policy:** Additional Effort on a likely-decisive test, Batter/Trick to set up, Additional Action when the pool is flush, Flee from Harm to escape — aggression-weighted.
- [ ] **Resource policy:** Fate-to-avoid-death and Fortune reroll/+1 SL on consequential tests, per the risk threshold.
- [ ] **Reaction policy:** fire free reactions (Riposte, Reaction Strike) when beneficial; Step Aside per positioning need; reactive spends per profile.
- [ ] **Sub-decision policies:** In-fighting mode, Dual Wielder second target, Shieldsman mode, Trip/Slash spend, Reversal toggle, group/AoE target pick.

### Tasks — Profiles
- [ ] Define Berserker / Duellist / Skirmisher / Marksman / Brute as parameter sets; document each profile's intended behaviour.

### Tasks — Tests / i18n
- [ ] Vitest: each profile produces its characteristic play (Berserker charges + all-out; Skirmisher disengages/kites when Engaged; Marksman keeps range; Duellist defends/ripostes); the **competence floor** holds across all profiles (always defends, never wastes a turn, Fate-saves at death); deterministic given seed (same seed + profiles → identical decisions); focus-fire targeting; resource policy fires at the right thresholds; logging captures chosen + reason + alternatives; a Heuristic-driven fight runs to termination unaided.
- [ ] Decision reason-codes registered with en/fr labels for later rendering.

### Acceptance criteria
- `HeuristicController` answers every decision point with reasonable, profile-distinct, deterministic, logged decisions; the five profiles play recognizably differently above a shared competence floor.
- It drives a full fight to termination unaided and is the default controller for Epic 6; the Manual controller remains for override.
- Same seed + profiles → identical fight.

---

## Epic 6 — Monte-Carlo Runner

Three sub-PBIs, dependency-ordered:

- **6a — Encounter Config + Deterministic Single-Fight Runner + Replay:** the config model, run one fight from `(config, seed)` to a compact outcome, regenerate a full replay on demand. *The foundation.*
- **6b — Batch Runner + Web Worker + Progress:** master-seed → per-iteration seeds, run N fights off-thread, stream progress, collect raw outcomes. *Depends on 6a.*
- **6c — Metric Aggregation:** raw outcomes → the full metric suite (rates + CIs, distributions/percentiles, per-combatant survival/wounds/deaths, resource spend, TPK). *Depends on 6b.*

## PBI 6a — Encounter Config, Single-Fight Runner & Replay

**User story:** As the simulator, I need to run one fully-specified fight deterministically from a config and a seed — and regenerate its full replay on demand — so the batch runner and the replay viewer both have a single reliable primitive.

**Why first:** the batch (6b) is just "6a in a loop with derived seeds," and the replay viewer (Epic 7) is "6a's replay." Both stand on this.

### Tasks — Config model (`@wfrp/shared`)
- [ ] Define `EncounterConfig`: the two sides and their combatants (built from `Character` / `CharacterTemplate`), per-combatant **profile** (with the auto-pick fallback), initial-Advantage inputs (surprise / terrain / threat / manoeuvrability; outnumbering auto-computed), per-combatant cover flag, and toggles (Sudden Death, shooting-into-melee, max-round cap, `tacticalDominantSide`).
- [ ] Validate a config (legal builds, ≥1 combatant per side, resolvable profiles) with clear errors.

### Tasks — Single-fight runner
- [ ] `runFight(config, seed) → FightOutcome`: build `CombatState` from the config, seed the RNG, instantiate controllers (default Heuristic-by-profile; **controller is pluggable** so MCTS/Manual can slot in), run the 5a loop to termination, return a **compact** outcome.
- [ ] `FightOutcome`: winner/draw, rounds, and per-combatant `{ survived, finalWounds, died, critsDealt/Taken, conditionsInflicted, fate/fortuneSpent, advantageGenerated }` + side resource totals — small enough to keep N of them in memory.

### Tasks — Replay
- [ ] `replayFight(config, seed) → FightReplay`: re-run the identical seed capturing the **full event stream** for step-through, guaranteed to match `runFight`'s outcome.

### Tasks — Tests / i18n
- [ ] Vitest: `(config, seed)` → identical `FightOutcome` on repeat; `replayFight` reproduces the same outcome and a complete event log; outcome fields correctly reflect a hand-checked fight; controller injection (swap Heuristic for a scripted controller) works; config validation rejects bad builds; a few representative encounters (1v1, 3v2, ranged-vs-melee) terminate validly.
- [ ] en/fr keys for outcome/summary fields and config-validation errors.

### Acceptance criteria
- One fight runs deterministically from a config + seed to a compact outcome; its full replay regenerates on demand and matches; controllers are pluggable.
- Same `(config, seed)` → identical outcome and identical replay.

---

## PBI 6b — Batch Runner, Web Worker & Progress

**User story:** As the simulator, I need to run N fights off the main thread with live progress and cancellation, deterministically and pool-ready, so thousands of iterations don't freeze the UI and always reproduce.

**Why now:** 6a gives a deterministic single fight; this is "6a across a derived-seed range, off-thread."

### Tasks — Pure batch logic (`@wfrp/shared`)
- [ ] `deriveFightSeed(masterSeed, index)` — deterministic, well-distributed, **per-index** (not a stream).
- [ ] `runBatch(config, masterSeed, range, { onProgress, isCancelled }) → BatchResult`: iterate the index range, derive each seed, call 6a's `runFight`, collect the compact `FightOutcome` + its seed/index; throttle `onProgress`; honour `isCancelled` (stop cleanly, return partial); wrap each fight so a throw is captured as `{index, seed, error}` and the batch continues.
- [ ] `BatchResult`: `outcomes[]` (each with its seed/index), `failures[]`, `completedCount`, `masterSeed`, config reference.
- [ ] Express iteration as a **range** `[a, b)` so a future worker-pool can shard it with no change in results.

### Tasks — Worker host & main-thread handle (gm-app sandbox)
- [ ] A Web Worker that imports `runBatch`, runs `[0, N)`, posts throttled progress (count + running win-rate) and the final `BatchResult`, and responds to a cancel message.
- [ ] A main-thread `BatchRunnerHandle`: `start(config, masterSeed, N)` spawns the worker; exposes `onProgress` / `onComplete` / `onError` / `cancel()`.

### Tasks — Tests / i18n
- [ ] Vitest (no worker needed — test `runBatch` directly): same `(config, masterSeed, N)` → identical `outcomes`; seeds deterministic and distinct per index; cancellation returns partial; a deliberately-throwing fight is captured with its seed and the batch continues; running win-rate matches the final tally; **range-sharding** (`[0,N)` vs `[0,k)+[k,N)` merged) yields identical results — the pool-readiness proof.
- [ ] A light integration check that the worker host streams progress and returns a `BatchResult` for a small N.
- [ ] en/fr keys for progress and batch-failure events.

### Acceptance criteria
- N fights run off-thread with throttled progress and clean cancellation; results are deterministic and order-independent (pool-ready); failing fights are captured with replayable seeds without aborting the batch.
- The compact outcomes + seeds feed 6c (aggregation) and 6a (replay).

---

## PBI 6c — Metric Aggregation

**User story:** As the simulator, I need the batch outcomes aggregated into a rigorous report — rates with CIs, distributions, per-combatant breakdowns, and wipe/death risk — so I can make trustworthy balance and build decisions.

**Why now:** 6b delivers raw `FightOutcome`s; this is the interpretation layer, and the last engine-side piece before the UI.

### Tasks — Outcome & rounds (`@wfrp/shared`)
- [ ] Win / loss / draw rate per side with **Wilson** CIs; report `completedCount`, `failures`, and a sufficient-N flag (CI half-width threshold).
- [ ] Rounds distribution: mean, median, percentiles (p10/25/50/75/90), min/max, and a binned histogram.

### Tasks — Per-combatant breakdown
- [ ] Survival rate (CI) and death rate; final wounds **among survivors** (mean/median/percentiles); crits dealt/taken and conditions inflicted; **Fate spent** (avg + % of fights Fate was burned — the key "had to burn Fate to live" danger signal), Fortune spent, Advantage generated; damage dealt/taken where tracked.

### Tasks — Risk & decisiveness
- [ ] Per-side **party-defeated %**, **P(≥1 death)**, **P(all dead)** with CIs (the player-side TPK headline).
- [ ] Decisiveness: avg survivors on the winning side; rounds split by outcome (do wins resolve faster than losses?).

### Tasks — Comparison & significance
- [ ] `compareReports(a, b)`: deltas in win-rate / party-defeated / survival, each with a **two-proportion significance test** (significant at 95%? CI overlap) — powering build-optimization and balance A/Bs.

### Tasks — Tests / i18n
- [ ] Vitest against **hand-computed fixtures**: win-rate + Wilson CI on a known sample; percentiles/histogram on a known distribution; per-combatant rates; party-defeated/death metrics; Fate-burn %; CI correctness at the extremes (all-wins, all-losses) and small N; `compareReports` flagging significance on clearly-different vs. clearly-same samples; determinism (same `BatchResult` → same report); failures correctly excluded from rates.
- [ ] en/fr keys/labels for every metric, ready for Epic 7 rendering.

### Acceptance criteria
- The report exposes the full suite — rates + CIs, rounds/wounds distributions, per-combatant survival/wounds/deaths/resources, and wipe/death risk — all validated against hand-checked fixtures and computed deterministically.
- `compareReports` correctly flags significant differences; every metric carries an i18n key.

---

## PBI 7a — Fight Lab Shell + Encounter/Build Configurator

**User story:** As the GM, I need a sandbox section where I can assemble an encounter from templates, library characters, or my live party, tweak any combatant freely, and save it — without ever touching the campaign — so I can set up the question the simulator answers.

**Why first:** every other Epic 7 panel (run, dashboard, replay, compare) operates on the `EncounterConfig` this produces; nothing runs until you can build one.

### Tasks — Fight Lab shell (gm-app)
- [ ] New GM-only **"Fight Lab"** top-level section + nav entry (alongside Character / Map / Calendar), isolated from live play.
- [ ] Shell layout: a scenario-library sidebar + main workspace, with the configurator (7a) and seams/placeholders for run + dashboard (7b), replay (7c), and compare (7d).

### Tasks — Sandbox persistence (gm-app main + IPC)
- [ ] Dedicated sandbox store at `fight-lab.json` in userData, **separate from `campaign-state.json`**; IPC get/save.
- [ ] Scenario model (named `EncounterConfig` + slot for a cached report); CRUD via the library sidebar (save / load / duplicate / delete); scenarios stored as **self-contained snapshots**.

### Tasks — Combatant sourcing (level c)
- [ ] Source pickers reusing `CharacterRoster` / `TemplateManager`: from the `CharacterTemplate` library, the `Character` library, and a **read-only pull from current campaign state** (party + selected NPCs).
- [ ] On add, deep-clone the source into an editable **sandbox combatant** decoupled from its origin.

### Tasks — Ephemeral combatant editor
- [ ] Edit the sandbox clone — characteristics, skills, status (wounds / Fate / Fortune / Resilience), equipped weapons/armour/items, talents, and the behaviour **profile** (with auto-pick fallback) — reusing `CharacterSheet` in an editable sandbox mode; never writes back to campaign/templates.
- [ ] Inline **proficiency warnings** via the appendix resolver: flag unskilled weapons (Qualities lost) and unusable ranged weapons, so confusing sim results are caught at setup.

### Tasks — Encounter config builder
- [ ] Two sides (Ally / Adversary) with add/remove rosters.
- [ ] Initial-Advantage inputs (surprise side, terrain, threat, manoeuvrability; outnumbering auto from rosters), per-combatant cover, starting positions (per-side distance on the 1D track + optional offsets), toggles (Sudden Death, shooting-into-melee, max-round cap, `tacticalDominantSide`), batch params (N, master seed with randomize/lock).
- [ ] Live validation via 6a's config validator with inline errors.

### Tasks — i18n / Tests
- [ ] en/fr for all Fight Lab strings.
- [ ] Vitest: the builder emits a config that passes 6a validation; sandbox edits don't mutate the source template/character; scenario save/load round-trips a self-contained config; proficiency warnings fire correctly.
- [ ] Playwright: assemble an encounter (library + campaign pull), tweak a combatant, save and reload it; assert no write to `campaign-state.json`.

### Acceptance criteria
- A GM-only Fight Lab exists, isolated from live play; you can assemble an encounter from templates, library characters, and a read-only campaign pull, tweak any combatant ephemerally (including profile), set advantage/cover/positions/toggles/N/seed, and get a valid `EncounterConfig`.
- Scenarios save/load as self-contained snapshots in the sandbox store; no sandbox action ever mutates the live campaign.

---

## PBI 7b — Run Controls, Live Progress & Results Dashboard

**User story:** As the GM, I need to run a scenario, watch live progress, and read a statistically clear dashboard, so I can judge whether an encounter is balanced or deadly.

**Why now:** 7a produces the config; this turns it into answers — the core configure→run→read loop.

### Tasks — Run controls & progress (gm-app)
- [ ] Run / cancel / re-run wired to `BatchRunnerHandle` (6b): `start(config, masterSeed, N)`; state machine idle → running → complete / cancelled / error; Run disabled while running, Cancel shown.
- [ ] Live progress: bar (done / N), running win-rate, elapsed + ETA; throttled per 6b.
- [ ] Worker runs 6c aggregation as its final step → returns `{ report, BatchResult }`; main thread retains the `BatchResult` for the session.
- [ ] Cancellation → aggregate the completed subset into a **partial report**, badged as partial (wider CIs).

### Tasks — Results dashboard (render 6c report)
- [ ] Headline: win / loss / draw per side with **CIs** and the **sufficient-N flag** (warn + suggest a higher N when inconclusive).
- [ ] Risk headline: party-defeated %, P(≥1 death), P(all dead), with CIs.
- [ ] Rounds: histogram + mean/median/percentiles.
- [ ] Per-combatant table (sortable): survival/death rate, survivor wounds (mean/median/percentiles), crits dealt/taken, conditions, **Fate spent (+ % of fights Fate was burned)**, Fortune spent, Advantage generated — inline mini-bars plus a couple of headline charts (recharts/chart.js).
- [ ] Decisiveness: avg survivors on the winning side, rounds split by outcome. Empty / loading / error states.

### Tasks — Failures & persistence
- [ ] Failing-seeds panel from `BatchResult.failures` (`{index, seed, error}`); each row → one-click **replay handoff** to 7c (seam/stub until 7c lands).
- [ ] On completion, cache `{report, masterSeed, N, failures}` into the current scenario (sandbox store); restore it when the scenario is loaded.

### Tasks — i18n / Tests
- [ ] en/fr for run/progress/dashboard labels (reuse 6c's metric keys).
- [ ] Vitest: run→progress→complete drives the handle correctly; cancel yields a partial report flagged as such; the report-cache round-trips with the scenario; the failure handoff passes the right index/seed.
- [ ] Playwright: run a saved scenario end-to-end, watch progress, read the dashboard incl. CIs and the sufficient-N warning; click a failure → assert the correct seed is handed off.

### Acceptance criteria
- From a saved scenario you can run N fights off-thread, watch live progress (running win-rate + ETA), cancel to a flagged partial result, and read a dashboard with win/risk rates + CIs, rounds/wounds distributions, and a per-combatant breakdown.
- Failing fights are listed and one click hands the exact seed to the replay viewer; the report caches with the scenario and restores on reload.

---

