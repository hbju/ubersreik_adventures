# Session Prep Skill

You are preparing the next session of the Ubersreik WFRP campaign. This is a disciplined workflow refined over 15 sessions.

## CRITICAL RULES

1. **NEVER skip the question phase**
2. **NEVER generate the guide before the GM has answered your questions**
3. **ALWAYS wait for validation before generating the docx**

## Workflow

### Phase 1: Read State (DO THIS FIRST)

Read these files in order:
1. `campaign_docs/campaign/CAMPAIGN_STATE.md` - single source of truth
2. `campaign_docs/campaign/HANDOFF.md` - open questions from last planning session
3. `campaign_docs/campaign/DRAMATIS_PERSONAE.md` - NPC details
4. `campaign_docs/campaign/WEEK2_CALENDAR.md` - time-sensitive events and doomsday clock

### Phase 2: Ask Clarifying Questions (MANDATORY)

Based on what you read, ask 3-8 targeted questions about:
- Open questions from HANDOFF.md (resolve these first)
- Player intentions and likely paths
- NPC motivations and faction moves
- Forgotten plot hooks or scheduled events
- Consequences for absent players
- Personal material for each PC
- Tone and pacing preferences
- Any ambiguities in the current state

**STOP HERE AND WAIT FOR THE GM'S ANSWERS. DO NOT PROCEED.**

### Phase 3: Propose Timeline

After receiving answers, propose a session timeline:
- Expected scenes in chronological order
- Time blocks (Rough Night at the Three Feathers format)
- Decision points and branching paths
- Absence consequences for each major scene
- Music suggestions per scene

**STOP HERE AND WAIT FOR GM VALIDATION. DO NOT PROCEED.**

### Phase 4: Generate the Guide

Only after the GM validates the timeline:

1. Create the .mjs file in `campaign_docs/tools/`
2. Use the established docx template structure from `generate_hog_pit_rescue.mjs` as reference
3. Include all established visual elements:
   - Read-aloud boxes (brown, italic Georgia, French)
   - GM notes (gold boxes)
   - Warnings (red boxes)
   - Absence consequences (purple boxes)
   - Time blocks (green boxes)
   - Music boxes (blue boxes)
   - NPC dialogue (bold speaker + italic quote)
4. Generate the .docx in `campaign_docs/output/`
5. Run: `node campaign_docs/tools/[your-file].mjs`

### Phase 5: Update Handoff

Write to `campaign_docs/campaign/HANDOFF.md`:
- Questions left open or deferred
- Threads to follow up next session
- Player choices that need consequences
- NPC reactions to plan
- Timeline adjustments needed

## Output Format

Your responses should be structured as:

**Initial Response (Phase 1-2):**
```
I've read the campaign state. Here's where we stand:
[Brief summary of current situation]

Before I propose a timeline, I need to clarify:
1. [Question about X]
2. [Question about Y]
...
```

**After GM Answers (Phase 3):**
```
Based on your answers, here's the proposed timeline:
[Detailed session structure]

Does this structure work for you? Any adjustments needed?
```

**After Validation (Phase 4-5):**
```
Generating the guide now...
[Create and run the .mjs file]

I've updated HANDOFF.md with:
[Summary of open threads]
```

## Remember

- The GM values being asked, not assumed
- Respect player agency and absence consequences
- Tone: grimdark but human
- All player-facing text in French
- Flag forgotten threads proactively
- Never soften consequences
