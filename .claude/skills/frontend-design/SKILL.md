---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building or reshaping UI for the Ubersreik Adventures WFRP4e virtual tabletop — GM app, player app, the fight/replay viewer, character and stat blocks, condition/initiative trackers, and printable handouts. Use this whenever building a new screen, component, or view, or restyling an existing one, even if the request doesn't say "design" — and especially before reaching for a sepia-parchment-and-blackletter default.
---

# Frontend Design — Ubersreik Adventures (WFRP VTT)

Approach this as the design lead at a small studio that has been hired to give one grimdark virtual tabletop a visual identity that could not be mistaken for any other fantasy product. The client has rejected anything that feels like generic-fantasy or a templated dashboard, and is paying for a deliberate point of view: opinionated choices about palette, typography, and layout that belong to *this* game — the Reikland, Ubersreik, the mud-and-candlelight Empire — and one real aesthetic risk you can justify.

But hold one thing above everything else: **this is an application, not a poster.** People sit in front of it for three-hour sessions, reading wounds, advantage, initiative order, dice results, and a combat board, often while talking and rolling actual dice. Atmosphere that costs legibility is a bug. The whole craft of this skill is marrying a genuinely grim, specific mood to a tool that stays fast and readable under candlelight at 11pm.

## Ground it in the Old World, specifically

Generic fantasy is the enemy. The Old World has a precise texture: a decaying, bureaucratic, Holy-Roman-Empire-with-rot-underneath. Its real artifacts are where distinctive choices live — Imperial citizen's papers and travel writs, guild ledgers and apothecary labels, witch-hunter broadsheets, wax-sealed writs, woodcut illustrations, heraldry and guild marks, illuminated marginalia scrawled by a bored scribe, tax rolls. Reach into *that* world, not into "tavern menu fantasy."

If a brief leaves the subject vague, pin it: name the exact surface (e.g. "the GM's live combat board," "a player's character papers," "a printable broadsheet handout"), who's reading it, and its single job, and state your choice. Use anything in memory about this project — the parchment/broadsheet handouts already built, the EN/FR bilingual requirement, the Ubersreik campaign's tone — as a hint, and build with the brief's real content (real stat blocks, real conditions, real combatants), never lorem ipsum.

## The load-bearing principle: atmosphere in the frame, clarity in the data

Split every screen into two registers and treat them differently:

- **The frame / chrome** — mastheads, panel headers, section dividers, empty states, handouts, the launch and setup screens. This is where the Old World gets to be loud: parchment grounds, blackletter logotypes, heraldry, wax seals, woodcut motifs, ink-and-vellum texture.
- **The live data** — stat values, wound/advantage counters, the initiative track, dice and test results, condition pips, the combat board itself. This stays **crisp, high-contrast, and quiet**: a near-black working surface so numbers pop, tabular figures, generous hit-targets, no texture behind anything you have to read at a glance.

A flickering candle behind the wounds counter, a parchment texture under a column of skill values, a drop-shadowed blackletter label on a button — these are the failure mode. Spend the atmosphere in the frame; keep the data clean. This single discipline is what separates a themed tool that's a joy to run from a costume that fights its user.

## Design principles

**The table is the thesis, not a hero.** A landing page opens with its most characteristic image; an application opens with the work. The combat board, the character papers, the initiative order — these *are* the centerpiece, and the most characteristic design move is making the most-used surface unmistakably of-this-world while instantly legible. Don't bolt a decorative hero onto a tool.

**Typography carries the personality — and most of the risk.** Set at least three roles, chosen for this game, not your usual stack:
- *Display, used with hard restraint:* a blackletter/Fraktur or a sharp engraved Old-World serif. Reserve true blackletter for the logotype/masthead and **printed handouts** — it is near-illegible at UI sizes and instantly cliché if it spreads to section heads or buttons. For in-app headers, a high-contrast serif with weight and a Germanic, engraved feel usually reads better than Fraktur.
- *Body:* a warm but screen-tuned face that holds up at 13–15px across a long session. Prioritise legibility over flavour here.
- *Data/utility:* a clean, slightly condensed face for stat blocks, dice, and initiative. **Use tabular figures (`font-variant-numeric: tabular-nums`) everywhere numbers stack into columns** — wounds, characteristics, initiative — so they align as values change.
- *Bilingual caveat:* this app is EN/FR (and the world is German-flavoured — Übersreik has the umlaut). Verify every chosen face carries full diacritics (é à ç ô) and French guillemets « »; many decorative blackletter webfonts ship broken or absent accented glyphs. Test with real French strings before committing.

**Color: grim and specific, not sepia monochrome.** The lazy WFRP palette is a single sepia wash. Escape it by anchoring on a warm near-black working surface and introducing a *cold* counterpoint so the result reads grim, not cozy. A defensible starting palette for this project (adapt and extend per surface):
- `#211E1A` — iron / warm near-black: the working background for board and data, so values pop.
- `#3A3F44` — gunmetal slate: the cold counterpoint; secondary surfaces and panels.
- `#E7DEC9` — tallow parchment: diegetic chrome and handouts only, *not* the main working background (too low-contrast for dense data).
- `#C9A24B` — candle amber / muted Sigmarite gold: accents, active states, highlights — sparingly.
- `#7A2520` — dried oxblood: wounds, criticals, danger.
- `#5C7363` — corroded verdigris: cold structural/status accent that breaks the warm monochrome.
- `#BFB6A3` — bone: secondary labels and muted text on the dark surface.

Don't fall into pure-black + blood-red "dark fantasy," either — that's a different default. The Old World is grey, brown, verdigris, candle, and *occasionally* blood, under a sky that hasn't been blue in a while.

**Structure should encode play, not decorate.** Borrow structural devices from the world's real artifacts only where they carry true information: a character sheet laid out as Imperial citizen's papers, conditions stamped like afflictions on a writ, the initiative order shown as a marching column. Resist ornamental numbering (01 / 02 / 03) unless the content genuinely is a sequence — a turn order or a multi-phase action actually is one; a list of stats is not.

**Motion should have weight.** A die settling, a wound registering, the initiative marker advancing, the fight replay stepping forward — these can carry heft and consequence. Avoid bouncy, cute, or scattered effects; one orchestrated, weighty moment (the resolution of an attack; a critical landing) lands harder than ambient sparkle. Never animate the data you have to read, and always respect `prefers-reduced-motion`.

## Calibration: the WFRP defaults to avoid

When an axis is left free, don't spend that freedom on the genre clichés. Right now, themed-fantasy UI clusters around: (1) **sepia parchment + blackletter headers + a woodcut + drop shadows** — the "fantasy tavern menu"; (2) **generic medieval** with no specific world (could be any D&D-adjacent product); (3) **pure black + blood-red** "dark fantasy edginess"; (4) **over-textured grounds** (heavy paper/grime behind everything) that wreck legibility and tank performance in a dense combat view. All can be momentarily appropriate, but they appear regardless of subject. Where the brief pins a direction, follow it exactly. Where it doesn't, push toward the *specific* Old World — Reikland heraldry, Imperial bureaucracy, guild marks, Ubersreik itself — and toward choices that read as this campaign, not generic grimdark.

## Process: brainstorm, critique, build, critique again

Work in two passes; do most of it in your head and only show the user once you're confident it'll land.

First, draft a compact token system for the brief:
- **Color:** 4–6 named hex values (extend or override the project palette above for this surface).
- **Type:** the faces for the 2–3 roles, with the EN/FR diacritic check noted.
- **Layout:** a one-sentence concept plus an ASCII wireframe — and for an app surface, account for density and state (what does this look like with eight combatants and three conditions each?).
- **Signature:** the one element this surface is remembered by, embodying the world appropriately (and, for live tools, cheaply — it must survive being on screen for hours).

Then review the plan against the brief before writing code: work through what you'd produce for any similar WFRP screen, and if any part matches that generic default rather than a choice for *this* brief, revise it and say what you changed and why. Only then write the code, deriving every colour and type decision from the revised plan.

When coding (React 18 + TypeScript + Tailwind, Electron desktop): watch CSS selector specificity — type-based selectors (`.panel`) and element/utility selectors fighting over padding/margins between sections is a common self-cancelling bug. Keep texture and shadow off the hot, frequently-re-rendered surfaces (the board, the data) for performance.

## Restraint and self-critique

Spend your boldness in one place — let the signature be the one memorable thing and keep everything around it disciplined; cut decoration that doesn't serve play. Channel Chanel: before shipping, look again and remove one accessory (usually a texture, a shadow, or a second decorative face). Build to a quiet quality floor: visible keyboard focus, `prefers-reduced-motion` respected, legibility verified at real UI sizes and at low contrast (candlelight conditions are the use case, not a metaphor), and — since this is Electron desktop, not a marketing page — readable and usable at a small window as well as full-screen. Take screenshots and critique your own work as you go; a picture is worth a thousand tokens. Jot down what you've tried so later passes don't repeat it.

## Surfaces, and how loud each gets

A rough dial from most-disciplined to most-atmospheric:
- **Live play tools** (combat board / 7c replay viewer, initiative track, dice & test results, wound/advantage/condition trackers): maximum clarity, minimum chrome. Crisp data on the dark surface; the world shows only in the frame.
- **Character & stat blocks:** balance — diegetic framing (Imperial papers) around crisply legible values with tabular figures.
- **Setup, launch, and dashboard screens:** more room for atmosphere; these aren't read under time pressure.
- **Printable / shareable handouts** (broadsheets, writs, player handouts): go fully diegetic — this is where blackletter, parchment grounds, woodcuts, and wax seals belong without restraint, because no one is tracking initiative off them.

## Writing in the VTT — two voices

Words are design material here, in two distinct registers; keep them separate.

- **Frame copy** (panel titles, empty states, section labels, flavour) may speak in the world's voice. An empty encounter list: *"No foes abroad. Yet."* A blank GM note: *"The margin awaits your hand."* Tuned, brief, never purple.
- **Functional copy** (buttons, controls, errors, validation) stays plain, active, and consistent, exactly as in any good interface. A control names what happens — **"Apply wound," "Roll defence," "End turn"** — not "Submit," and keeps that name through the whole flow (the button that says "Apply wound" produces a result that says "Wound applied"). Errors don't apologise and aren't so in-character that they stop telling the user what went wrong or how to fix it — explain the failure in the interface's voice, plainly. Use sentence case, plain verbs, tabular discipline in numbers; let each element do exactly one job.

Name things by what the GM and players control and recognise — wounds, conditions, advantage, initiative — never by how the engine is built (no "controller," "decision context," or "resolver" leaking into the UI). The vocabulary of the interface is the signposting for someone running a fight at speed; cohesion is how they learn their way around.