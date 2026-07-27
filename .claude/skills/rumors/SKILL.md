# Rumors Skill

You are generating downtime rumors and gossip for the Ubersreik campaign, organized by faction.

## Workflow

### Phase 1: Read Current State

Read these files:
1. `campaign_docs/campaign/CAMPAIGN_STATE.md` - current situation
2. `campaign_docs/campaign/DRAMATIS_PERSONAE.md` - active NPCs
3. `campaign_docs/campaign/WEEK2_CALENDAR.md` - scheduled events
4. `campaign_docs/campaign/HANDOFF.md` - dangling threads

### Phase 2: Ask Context Questions

Before generating rumors, ask:
- How many days of downtime?
- Which date(s) should rumors reflect?
- Are there specific factions the GM wants emphasized?
- Should rumors foreshadow upcoming events or reflect past actions?
- Tone: subtle hints or obvious hooks?

**WAIT FOR GM ANSWERS.**

### Phase 3: Generate Rumors by Faction

Create rumors for each active faction, organized by:

#### Format
```markdown
## [Faction Name]

### [Rumor Title]
**Source:** [Where PCs might hear this]
**Reliability:** [True / Partial / False / Unknown]
**Content (French):** [The actual gossip in French, as NPCs would say it]
**GM Truth:** [What's actually happening behind the rumor]
```

#### Factions to Cover
- **The Street** (general gossip, tavern talk)
- **Underworld** (Lowhaven, Crosses, Resistance, thieves)
- **Watch & Law** (Wendt, Vielfrass, Geldrecht)
- **Nobility & Merchants** (Baron, Otto, Engel, Giordano)
- **Cults & Temples** (Sigmar, Shallya, Morr, hidden cults)
- **Dwarfs** (Silvi, Dawihafen, Crossed Hammers)
- **The Unseen** (Skaven, K&H bomb, Rasknitt)
- **Personal** (rumors touching each PC's storyline)

#### Rumor Types
- **Foreshadowing:** Events from WEEK2_CALENDAR.md
- **Consequences:** Fallout from recent PC actions
- **Misdirection:** False trails and red herrings
- **Opportunities:** New threads and hooks
- **Atmosphere:** Grimdark Empire life continues

### Phase 4: Deliver Output

Present rumors in a clean markdown format that can be:
- Read directly at the table
- Copy-pasted into player handouts
- Referenced during downtime phases

## Output Format

**Initial Response (Phase 2):**
```
I've read the current state. Before generating rumors, I need to know:
1. [Context question]
2. [Context question]
```

**After Answers (Phase 3-4):**
```markdown
# Rumors - [Date Range]

## The Street
[Rumors accessible to anyone]

## Underworld
[Requires Gossip or underworld contacts]

## Watch & Law
[Requires contacts in law enforcement]

... [etc for all factions]

## Personal Hooks
[Rumors specific to each PC]
```

## Guidelines

- **In French** - All rumor content should be in French (as spoken at the table)
- **Tone** - Grimdark but grounded; violence has weight, hope is scarce but present
- **Contradictions** - Some rumors should contradict each other (creates investigation opportunities)
- **Danger** - K&H doomsday clock ticks; include hints of escalation
- **NPCs Live** - Show the city moving without the PCs
- **Personal Stakes** - Include material for each PC's storyline
- **Prices** - Allies want something; reflect in rumors
- **Ubersreik Herald** - Ottokar's paper shapes reputation; consider including headlines

## Remember

- Read the state files first - rumors must fit current reality
- Not all rumors should be true
- Some should require Gossip tests (indicate difficulty)
- The doomsday clock is real - show escalation
- Each PC should find something personally relevant
- The city breathes: markets, festivals, weather, daily life
