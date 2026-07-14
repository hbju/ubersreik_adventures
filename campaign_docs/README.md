# Ubersreik Campaign — Claude Code Project

Co-GM workspace for the WFRP 4e Ubersreik campaign. See `CLAUDE.md` for how Claude should behave here.

## Folder structure
```
ubersreik-campaign/
├── CLAUDE.md                    ← Claude Code reads this automatically; the Co-GM contract
├── README.md                    ← this file
├── campaign/
│   ├── CAMPAIGN_STATE.md        ← single source of truth; update after every real session
│   ├── DRAMATIS_PERSONAE.md     ← every NPC, current status
│   ├── WEEK2_CALENDAR.md        ← the doomsday clock, day by day
│   └── HANDOFF.md               ← open questions from the previous planning conversation
├── sessions/                    ← put the generated .docx guides here
├── tools/
│   └── generate_guide_template.js  ← the established docx visual language
└── output/                      ← generated guides land here
```

## Files YOU need to add manually
1. Any scenario PDFs you want Claude to reference (Blood & Snow, A Heart of Glass...)

## First conversation opener (copy-paste into Claude Code)
> Read CLAUDE.md, then campaign/CAMPAIGN_STATE.md, campaign/DRAMATIS_PERSONAE.md, campaign/WEEK2_CALENDAR.md and campaign/HANDOFF.md. Then ask me the open questions from HANDOFF.md so we can plan Session 14.
