# Handoff — Ubersreik Adventures VTT: Live-play infrastructure Epic (kickoff)

**Purpose of next session:** collect Milou's answers to the open kickoff questions below, then spec the Live-play infrastructure Epic one PBI per turn, starting with **LP-a**.

---

## Pointers (don't re-derive — read these)

- **Full prior transcript:** `/mnt/transcripts/2026-06-17-08-29-42-wfrp-vtt-engine-psychology.txt` (engine work, Psychology epic, all earlier PBI text + code). Read incrementally; it's large.
- **Transcript catalog:** `journal.txt` in the same directory.
- **Prior output artifacts** (reference, don't reproduce): `/mnt/user-data/outputs/fight_sim_v2_backlog.md`, `epic3_recap.md`, `pbi3_test_battery.md`. Note: the patched `turn-engine.ts` / `heuristic-controller.ts` in outputs are **superseded** — Milou has since re-implemented on top of them (PSY-a/b/d + the defence-skill refactor).
- Project recaps live in the repo under `docs/epics/`.

## Project orientation (brief)

Solo dev (Milou, technical, fast-moving) building **"Ubersreik Adventures,"** a WFRP4e (Warhammer Fantasy Roleplay 4e) desktop VTT. Monorepo: `@wfrp/shared` (pure, headless, seeded rules engine + types), `@wfrp/gm-app` (hosts the Socket.io server), `@wfrp/player-app` (thin clients). Stack: Electron 33, React 18, TS 5.4 strict, Vite, Socket.io 4.8, Tailwind, Vitest, Playwright, react-i18next (EN/FR).

**Engine design properties that matter here:** steppable + forkable immutable state (MCTS-ready), **seeded per-index RNG that is order-independent**, events carry i18n keys (not strings), abstract 1D spatial model (positions in yards). Controllers plug in via a pull/enumeration protocol; `runCombatToCompletion` resolves a per-combatant controller through a **`ControllerResolver`** `(actorId) => CombatantController | undefined` (this was just generalised in the defence-skill refactor — see "Just closed").

**Working conventions (honour these):**
- **One PBI per turn.** PBI format: *User story / Why now / Tasks (grouped, touching shared → GM → player + message-contract + Vitest + Playwright + en/fr i18n) / Acceptance criteria.*
- Concise responses; **flag assumptions and defaults inline**; ask kickoff questions before a big epic.
- Milou implements each PBI via an AI coding agent (Copilot), then reports back.
- Maintain `docs/epics/` recaps.

## Roadmap (where this epic sits)

Decided order: Worker-pool (done) → **Psychology** → **Live-play infrastructure (← current)** → **flat Monte Carlo controller** → MCTS → 2D battlefield, with a golden-fight regression corpus to land first. Key reframing: *"NPC automation" is just controller-swapping* — once live-play infra exists with a pluggable controller, automation = choosing which controller (Manual → Heuristic → flat-MC → MCTS) drives a combatant. **Live-play is being built first specifically so the eventual flat-MC can be A/B'd against human play on the identical engine/encounter.**

## Just closed (this session)

- **Defence-skill ownership refactor — DONE by Milou himself.** The defender now chooses its own defence skill (Melee / Dodge / Intimidate) via its *own* controller through a resolution-level sub-decision, instead of the attacker's controller guessing it. This generalised controller plumbing to the `ControllerResolver` and (intended) also fixed the latent wrong-owner bug in reaction / Fate-interception windows. Full design is in the transcript tail; **no action needed.**

## Outstanding loose end (don't lose this)

- **PSY-e is NOT implemented.** Milou confirmed: PSY-a (Fear/Terror), PSY-b (Frenzy), PSY-d (Intimidate/Leadership) are in; **PSY-c is deferred** (group-targeted psychology — Hatred/Animosity/Prejudice); **PSY-e remains TODO** — Broken behaviour, Rally, and **routed-side termination** (`removedFromEncounter`/"fled" so `sideDownTermination` fires by rout). PSY-e is the expected fix for the chronic *"too many draws"* smell. We jumped to live-play at Milou's direction; circle back to PSY-e afterward (or whenever he chooses).

---

## CURRENT EPIC: Live-play infrastructure (LP-a … LP-e)

Goal: a `RemotePlayerController` for the PCs that drops into the same `ControllerResolver` the heuristic uses, so PCs are driven by humans over the socket while NPCs run on the Heuristic — same engine, same encounter, swappable controllers.

### THE architecture decision — needs Milou's call (gating)

`applyDecision` and the batch loop are **synchronous**; a human over a socket is not. Worse, one `applyDecision` can solicit *other* PCs mid-resolution (reaction windows, Fate interception, the new defence-skill choice), some contingent on dice rolled partway through — so decisions can't all be pre-fetched. Three bridges were presented:

- **(a) Async-ify** — `choose` returns `Promise`, add async `applyDecision`. Clean protocol but threads `await` through every internal `thread*`/`chooseResolution` and creates a second resolution path that can drift from the batch one.
- **(b) Generators** — turn resolution as `function*` that yields a decision-request and resumes on `.next(decision)`. Most correct suspension, most invasive to `applyDecision`.
- **(c) Replay-to-resume — RECOMMENDED.** Leave `applyDecision` and the batch loop **byte-for-byte unchanged**. The live orchestrator runs `applyDecision` with a resolver whose remote controllers **throw a typed `NeedDecision(requestId, context)`** the first time asked for a not-yet-known decision. Orchestrator catches it → emits `REQUEST_DECISION` → awaits `DECISION_RESPONSE` → caches by `requestId` → **re-runs `applyDecision` from the same pre-state**, which (pure + seeded) reproduces the identical path and advances one decision further before the next throw. N remote decisions/turn = N replays; the human is the bottleneck so CPU cost is noise; engine internals never change. Reuses the determinism built for MCTS; less new code than (a).

**GATING QUESTION for Milou (decides (c) vs fallback (b)):** does full re-execution of `applyDecision` from a given pre-state with the same decisions produce **byte-identical** results — same rolls, same event order — with **no `Date.now()`, no stray `Math.random()`, and no rng draw whose value depends on insertion/iteration order** anywhere in the resolution path? **If yes → (c). If any hidden nondeterminism → (b).** Everything below assumes (c) pending his answer.

**Parallel psychology note:** his "parallel-independent" decisions slot in as a **round-start fan-out phase** (the fear-state set is knowable at round start → request all simultaneously, feed them in). In-turn reactions/Fate stay serial under (c) — fine, since they can't fire before the triggering attack is rolled. Needs a quick "yes that's what I meant" or correction.

### Open scope confirmations (defaults stated; Milou to rubber-stamp or amend)

1. **Player visibility** — *default:* stream a read-only shared board to every connected player each committed engine step (watch the whole fight via the 7c viz) + targeted `REQUEST_DECISION` on top. *Alt:* activate-on-turn. Leaning shared board (WFRP combat is open info).
2. **Player input fidelity (v1)** — *default:* render `legalDecisions` as a palette grouped by action kind, with target/param pickers, layered on the 7c board. No drag-drop, no free-form movement beyond picking a legal destination.
3. **Controller assignment & GM override** — *default:* per-combatant assignment at encounter setup; PCs → their player's `RemotePlayerController`, NPCs → Heuristic (later swappable to flat-MC/MCTS); GM can seize any combatant (GM-Manual) or reassign mid-fight.
4. **Timeout behaviour** — *default:* on decision timeout, control falls to GM-Manual; optional per-encounter "auto-resolve timeouts via Heuristic" toggle; timeout length GM-configurable, **off by default** (wait indefinitely).
5. **Coexistence data flow** — *default:* engine encounter is *seeded from* the current party/encounter (import combatants, characteristics, positions) but does **not** write back to character sheets in v1 (GM applies wounds/conditions by hand, as in the Fight Lab today). Import-in, no writeback.
6. **State durability (v1)** — *default:* authoritative engine state in-memory in the GM process for the fight's duration; "reconnection" = a *player* dropping/rejoining a still-running GM (re-send their pending `decisionContext`); no mid-fight persistence or GM-crash recovery (rides the Supabase migration later).

### Planned sub-PBI breakdown (under (c))

- **LP-a** — decision message contract (`REQUEST_DECISION` / `DECISION_RESPONSE`, correlation ids) + `RemotePlayerController` + the `NeedDecision`/replay orchestration primitive (shared).
- **LP-b** — GM engine orchestration: the step loop, controller assignment, round-start psychology fan-out, timeout → GM-Manual.
- **LP-c** — player Fight screen: 7c board reuse + the legal-decision input palette. *(Frontend — see suggested skills.)*
- **LP-d** — coexistence seeding from the live encounter + player reconnection.
- **LP-e** — a headless `ScriptedRemoteController` + Vitest harness driving a full mixed PC/NPC encounter deterministically (also what later enables A/B of flat-MC against recorded human decisions).

**Open structural question:** is the 5-PBI shape right, or fold LP-e's harness into LP-a?

---

## Immediate next action for the fresh agent

1. Greet briefly; you're continuing the live-play epic kickoff.
2. Get Milou's answers to: the **determinism gating question** (→ (c) or (b)), the **parallel-psychology** confirmation, **scope items 1–6**, and the **5-PBI-shape** question. He may answer compactly ("defaults except 4; determinism confirmed"). Don't re-explain unless asked.
3. Then spec **LP-a** in the standard PBI format, one PBI per turn. If (c) is confirmed, LP-a includes the `NeedDecision`/replay primitive; if (b), LP-a instead carries the generator refactor of turn resolution.

## Suggested skills

- **`frontend-design`** (`/mnt/skills/public/frontend-design/SKILL.md`) — invoke when LP-c (the player Fight screen + legal-decision input palette) gets specced or implemented; it covers this environment's design tokens/styling constraints for new React UI.
- No other public skill is needed for the planning/engine PBIs (specs are plain Markdown; engine changes are TS patches reviewed inline). Ignore docx/pptx/xlsx/pdf here.

## Sensitive info

None present in this conversation (no keys, credentials, or PII to redact).
