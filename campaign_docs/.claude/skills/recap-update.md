# Recap Update Skill

You are updating the campaign state after a completed session. This ritual keeps the files trustworthy.

## Input Expected

The GM will paste their post-session recap (raw notes about what happened).

## Workflow

### Phase 1: Read Current State

Read these files to understand the baseline:
1. `campaign_docs/campaign/CAMPAIGN_STATE.md`
2. `campaign_docs/campaign/DRAMATIS_PERSONAE.md`
3. `campaign_docs/campaign/WEEK2_CALENDAR.md`
4. The most recent player-facing recap in `campaign_docs/campaign/recaps/`

### Phase 2: Analyze the Recap

Identify:
- State changes (location, time, relationships, inventory, wounds, conditions)
- NPC changes (new NPCs, changed motivations, deaths, reveals)
- Plot threads opened or closed
- Consequences triggered
- Player choices with future impact
- **Contradictions** with existing state (flag these clearly!)

### Phase 3: Ask Clarifying Questions

Before updating anything, ask about:
- Ambiguities in the recap
- Missing details for state tracking
- Contradictions that need resolution
- NPC motivations or reactions not covered
- Time progression and calendar impact

**STOP HERE AND WAIT FOR THE GM'S ANSWERS.**

### Phase 4: Update Files

After receiving answers:

#### 1. Update CAMPAIGN_STATE.md
- Current date and time
- Party location
- Active plot threads
- Faction states
- Key items and information gained
- Wounds, conditions, corruption
- Relationships changed

#### 2. Update DRAMATIS_PERSONAE.md
- Add new NPCs encountered
- Update existing NPC entries (motivations, knowledge, status)
- Mark any NPCs as deceased or changed

#### 3. Write Player-Facing Recap
Create `campaign_docs/campaign/recaps/session_[N]_recap.md` in French:
- Narrative summary of events (player perspective)
- Key moments and decisions
- Cliffhanger or current situation
- Tone consistent with campaign (grimdark but human)

#### 4. Flag Contradictions
Create a "CONTRADICTIONS" section in your response listing:
- What was stated in recap vs. what was in state
- How it was resolved
- What needs GM attention

### Phase 5: Commit Changes

Create a git commit with the message format:
```
Post-session [N] state update
```

Include all modified files:
- CAMPAIGN_STATE.md
- DRAMATIS_PERSONAE.md
- recaps/session_[N]_recap.md
- Any other affected files

## Output Format

**Initial Response (Phase 2-3):**
```
I've analyzed the recap. Here's what I found:

Key Changes:
- [Change 1]
- [Change 2]

Potential Contradictions:
- [Issue 1]

Before updating, I need to clarify:
1. [Question]
2. [Question]
```

**After Answers (Phase 4-5):**
```
Updated files:
✓ CAMPAIGN_STATE.md - [summary of changes]
✓ DRAMATIS_PERSONAE.md - [NPCs added/updated]
✓ recaps/session_[N]_recap.md - [created French recap]

Contradictions Resolved:
- [How each was handled]

Committed with message: "Post-session [N] state update"
```

## Remember

- State files are the source of truth - handle with care
- Flag contradictions, don't silently resolve them
- Player-facing recap is narrative, not mechanics
- NPCs are people with motivations, not stat blocks
- Time matters - update the calendar
- Absence has consequences - track who wasn't there
