import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "../.docx-runtime/node_modules/docx/dist/index.mjs";
import fs from "node:fs";
import path from "node:path";

const C = {
  red: "8B1A1A",
  darkRed: "5C0011",
  blue: "1F4D78",
  gold: "7B5200",
  green: "2E5F2E",
  purple: "5C2D82",
  teal: "1A5F5F",
  warm: "6B3A00",
  music: "2D5F8A",
  ink: "1A1A1A",
  grey: "555555",
  lightGrey: "E8E8E8",
  blueFill: "E8EEF5",
  tanFill: "FDF6EE",
  goldFill: "FFF8E1",
  redFill: "FDE8E8",
  greenFill: "E0F0E0",
  purpleFill: "F3E8FD",
  white: "FFFFFF",
  stripe: "F8F8F8",
};

const PAGE = {
  width: 12240,
  height: 15840,
  margin: 1440,
  header: 708,
  footer: 708,
  content: 9360,
};

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D6D6D6" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D6D6D6" },
};

const run = (text, options = {}) => new TextRun({
  text,
  font: options.font || "Georgia",
  size: options.size || 22,
  color: options.color || C.ink,
  bold: options.bold,
  italics: options.italics,
  smallCaps: options.smallCaps,
  break: options.break,
});

const body = (text, options = {}) => new Paragraph({
  style: options.style || "Normal",
  alignment: options.alignment || AlignmentType.LEFT,
  keepNext: options.keepNext,
  children: [run(text, options)],
});

const bodyMulti = (runs) => new Paragraph({
  style: "Normal",
  children: runs,
});

const h1 = (text) => new Paragraph({
  style: "CampaignHeading1",
  children: [run(text, { font: "Arial", size: 32, bold: true, color: C.red })],
});

const h2 = (text) => new Paragraph({
  style: "CampaignHeading2",
  children: [run(text, { font: "Arial", size: 26, bold: true, color: C.darkRed })],
});

const h3 = (text) => new Paragraph({
  style: "CampaignHeading3",
  children: [run(text, { font: "Arial", size: 24, bold: true, color: C.blue })],
});

const bullet = (label, text) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [
    run(`${label} - `, { bold: true }),
    run(text),
  ],
});

const step = (label, text) => new Paragraph({
  numbering: { reference: "steps", level: 0 },
  children: [
    run(`${label}. `, { bold: true }),
    run(text),
  ],
});

const callout = (label, text, options = {}) => new Paragraph({
  shading: { fill: options.fill || C.goldFill, type: ShadingType.CLEAR },
  border: {
    left: {
      style: BorderStyle.THICK,
      size: 12,
      color: options.color || C.gold,
      space: 7,
    },
  },
  indent: { left: 320, right: 160 },
  spacing: { before: 100, after: 160, line: 290 },
  keepNext: options.keepNext,
  children: [
    run(`${label} - `, { font: "Arial", size: 20, bold: true, color: options.color || C.gold }),
    run(text, { size: 21, italics: options.italics }),
  ],
});

const gm = (text) => callout("GM", text, { fill: C.goldFill, color: C.gold });
const warning = (text) => callout("WARNING", text, { fill: C.redFill, color: C.red });
const absent = (text) => callout("IF THE PCs AREN'T THERE", text, { fill: C.purpleFill, color: C.purple });
const music = (text) => callout("MUSIC", text, { fill: C.blueFill, color: C.music });

const readAloud = (text) => new Paragraph({
  shading: { fill: C.tanFill, type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 14, color: C.warm, space: 8 } },
  indent: { left: 420, right: 240 },
  spacing: { before: 100, after: 160, line: 320 },
  children: [run(text, { italics: true, color: "3A2010" })],
});

const timeBox = (text) => new Paragraph({
  shading: { fill: C.greenFill, type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 14, color: C.green, space: 7 } },
  spacing: { before: 180, after: 120, line: 290 },
  keepNext: true,
  children: [run(text, { font: "Arial", size: 24, bold: true, color: C.green })],
});

const quote = (speaker, text) => new Paragraph({
  indent: { left: 520, right: 280 },
  spacing: { before: 80, after: 120, line: 290 },
  children: [
    run(`${speaker}: `, { font: "Arial", size: 20, bold: true, color: C.darkRed }),
    run(`"${text}"`, { size: 21, italics: true }),
  ],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const tableCellParagraph = (text, options = {}) => new Paragraph({
  spacing: { before: 20, after: 20, line: 270 },
  alignment: options.alignment || AlignmentType.LEFT,
  children: [run(String(text), {
    font: options.font || "Georgia",
    size: options.size || 20,
    bold: options.bold,
    color: options.color || C.ink,
  })],
});

const dataTable = (headers, rows, widths, alignments = []) => new Table({
  width: { size: PAGE.content, type: WidthType.DXA },
  indent: { size: 120, type: WidthType.DXA },
  layout: TableLayoutType.FIXED,
  columnWidths: widths,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  borders: TABLE_BORDERS,
  rows: [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: headers.map((header, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: C.blueFill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [tableCellParagraph(header, {
          font: "Arial",
          size: 18,
          bold: true,
          color: C.blue,
          alignment: alignments[index] || AlignmentType.LEFT,
        })],
      })),
    }),
    ...rows.map((row, rowIndex) => new TableRow({
      cantSplit: true,
      children: row.map((value, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: rowIndex % 2 ? C.stripe : C.white, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [tableCellParagraph(value, {
          bold: index === 0,
          color: index === 0 ? C.darkRed : C.ink,
          alignment: alignments[index] || AlignmentType.LEFT,
        })],
      })),
    })),
  ],
});

const labelDetailTable = (rows) => dataTable(
  ["AT A GLANCE", "READY TO RUN"],
  rows,
  [2160, 7200],
  [AlignmentType.LEFT, AlignmentType.LEFT],
);

// ================================================================
// CONTENT
// ================================================================

const c = [];

// TITLE
c.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 160, after: 80 },
  children: [run("GM GUIDE - SESSION 17", {
    font: "Arial", size: 20, bold: true, color: C.gold, smallCaps: true,
  })],
}));
c.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 60, line: 520 },
  children: [run("THE HOG PIT", { font: "Arial", size: 58, bold: true, color: C.darkRed })],
}));
c.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 80, line: 320 },
  children: [run("A Dirty Night in the Schwarzehalle", { font: "Arial", size: 31, bold: true, color: C.red })],
}));
c.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 260, line: 280 },
  children: [run("Wellentag 13th Sigmarzeit — late afternoon to night", { font: "Arial", size: 22, italics: true, color: C.grey })],
}));

// ================================================================
// 1. AT A GLANCE
// ================================================================

c.push(h1("1. AT A GLANCE"));
c.push(labelDetailTable([
  ["Session scope", "Wellentag 13th, late afternoon to late night. The PCs leave the Dawihafen with Grodni's gunpowder, head to the Hog Pit, rescue (or kill) Felix Scite, and deal with the aftermath. Session ends with the night winding down."],
  ["Core tension", "Kaspar carries Otto's kill-Felix order. Silvi wants Felix alive (20 GC). The group doesn't know about Kaspar's secret mission. This is a betrayal waiting to happen — or not."],
  ["Secondary threads", "Carmello's crew tailing the PCs (Red Moon Burning security). Mercy's bounty on Kaspar (dormant unless he gives his name). Vielfrass and the Circle of Unmarred Flesh (first real contact). Pieter absent — GM plays him."],
  ["Tone", "A grimy break-in at a pig market that turns into a moral fracture. The violence is ugly and the corruption is beautiful — keep both uncomfortable."],
  ["Table time", "Scene 1 (Dawihafen exit, planning): 20-30 min. Scene 2 (the Hog Pit): 1.5-2.5 hours. Scene 3 (aftermath): 30-45 min if time allows."],
  ["Existing material", "The Hog Pit scene packet (Session 16 guide) covers the warehouse layout, floor plan, NPC stats, suspicion clock, approaches, extraction routes, and the Loge in full detail. This guide wraps that packet with opening/closing scenes, enhanced NPC descriptions, music cues, and the Kaspar contingency."],
]));
c.push(gm("Keep the Hog Pit scene packet open alongside this guide. This wrapper tells you what comes before and after, and supplements the packet with character detail and music — the packet itself is the tactical reference for the rescue."));

// ================================================================
// 2. SCENE 1 — LEAVING THE DAWIHAFEN
// ================================================================

c.push(pageBreak());
c.push(h1("2. SCENE 1 — LEAVING THE DAWIHAFEN"));
c.push(timeBox("LATE AFTERNOON — Outside the Axe & Hammer, Dawihafen"));
c.push(music("Witcher 3 — 'Merchants of Novigrad' (low tension, planning energy). Keep the volume low; this is a transition, not a set piece."));

c.push(h2("2.1 Grodni's deal"));
c.push(body("Ludwig has been weighing the deal since last session. Let him announce his decision at the table — don't rush it. If he accepts (likely), Grodni nods once, sends a dwarf to fetch the gunpowder, and says his piece."));
c.push(readAloud("Grodni watches you from behind the bar, arms crossed, expression carved from the same stone as the walls. When Ludwig speaks, the old dwarf doesn't smile. He reaches across and grips Ludwig's forearm — hard, once — then lets go. 'A favor owed to Grodni Surehammer is not a small thing, manling. But I keep my word, and I'll expect you to keep yours. The powder will be ready before you leave this hall.'"));
c.push(quote("Grodni", "You'll know when I call it in. And you won't like it. But you'll do it, because that's what the word means."));
c.push(gm("The favor is deliberately undefined — probably next campaign. For now, let the weight of it sit. Grodni is not threatening; he's stating a fact about how dwarven debts work. The powder arrives in a sturdy cask, sealed with wax. Enough for Franz's plan and then some."));
c.push(bullet("If Ludwig refuses", "Grodni shrugs. 'Then you'll buy it from the Tileans at three times the price, and I'll remember that you wasted my evening.' No hard feelings, but the relationship cools. The PCs are back to Luigi & Salvatore's inflated prices — and Carmello's crew already watches that shop."));
c.push(bullet("Thucydion", "Still barred from the Dawihafen. He waits outside, which is where he spots the tail first (see 2.2)."));

c.push(h2("2.2 Carmello's tail"));
c.push(body("One of Carmello's crew — the same man who eavesdropped at Luigi & Salvatore's — has been waiting outside the Dawihafen. He wants to know where the gunpowder goes. He's competent but not invisible."));
c.push(bullet("The tail", "A lean, olive-skinned man in a docker's coat that doesn't quite fit him. He stays two street-widths back and uses the crowd. Tilean accent if spoken to. Armed with a knife and a short sword under the coat."));
c.push(bullet("Perception check", "Challenging (-10) for the group. Thucydion, waiting outside, rolls separately at Average (+0) — he's stationary and watching faces, not walking. A success spots the man; +2 SL identifies him as the same eavesdropper from Luigi & Salvatore's."));

c.push(h3("If the PCs spot the tail"));
c.push(bullet("Confront", "He plays dumb — 'Just walking home, friend.' A Hard Intimidate (-10) or a drawn weapon makes him bolt. He's fast (Ag 42, Athletics 52). If caught: he gives up Carmello's name but not the crew's location or numbers. He knows they're here for 'the innkeeper' but doesn't know the specifics of Red Moon Burning."));
c.push(bullet("Lose him", "Average Stealth (+0) in a group, or Hard (-10) if carrying visible cargo like a powder cask. Success means Carmello's crew loses the trail. Failure means they know where the gunpowder ends up."));
c.push(bullet("Feed misinformation", "The clever play. Lead him somewhere irrelevant, let him watch a fake handoff. This requires a plan and an Average Charm or Sleight of Hand test (+0). Success gives the PCs a major advantage on the 14th — Carmello's crew wastes time watching the wrong location."));

c.push(h3("If the PCs miss the tail"));
c.push(body("He follows them to wherever the gunpowder is stashed — most likely the Red Moon Inn. This means Carmello's crew knows the powder is at the Red Moon before the 14th. It doesn't ruin Red Moon Burning, but it removes the element of surprise and adds seven armed enemies who are prepared rather than ambushed."));
c.push(warning("Don't reveal the tail's success or failure to the players unless they actively check. If they miss the Perception roll, the tail is simply never mentioned — the consequence lands on the 14th."));

c.push(h2("2.3 The stash and the plan"));
c.push(body("Before heading to the Hog Pit, the PCs need to decide two things: where the gunpowder goes, and how they approach the warehouse. Let them talk it out — this is planning time, not a scene to rush."));
c.push(bullet("Gunpowder options", "The Red Moon (Franz wants it there — convenient but now potentially watched). A Crosses safehouse (Silvi can arrange it — safer but adds a step tomorrow). Carried with them (insane, but somebody might suggest it)."));
c.push(bullet("The approach", "Refer to Section 8 of the Hog Pit scene packet. The PCs should commit to a plan before they arrive. If they don't, Felix asks for one the moment the door opens."));
c.push(gm("Thucydion and Pieter still have Vielfrass's standing invite as a front-door option. The delivery cover, the roof, and the pig chute are all viable. Don't steer them — let them plan, and let the plan's quality determine how the suspicion clock starts."));

// ================================================================
// 3. SCENE 2 — THE HOG PIT
// ================================================================

c.push(pageBreak());
c.push(h1("3. SCENE 2 — THE HOG PIT"));
c.push(timeBox("EVENING — Fight night at the Hog Pit warehouse, Schwarzehalle"));
c.push(body("Run the rescue from the existing Hog Pit scene packet (Sections 3-12). This section supplements that packet with enhanced NPC descriptions, music cues keyed to the scene's rhythm, and handling notes for Pieter's absence and Kaspar's dilemma."));

c.push(h2("3.1 Music cues"));
c.push(dataTable(
  ["MOMENT", "TRACK", "NOTES"],
  [
    ["Approach / casing the warehouse", "Witcher 3 — 'Silver for Monster Hunters'", "Tense and purposeful. The PCs are hunting, not exploring."],
    ["Inside — crowd atmosphere, the vestibule", "Darkest Dungeon — 'Town in Chaos'", "Low in the mix. The warmth of the crowd should feel slightly wrong."],
    ["The bout itself", "A detuned Chopin nocturne, then silence", "Start with something slow and beautiful. Cut to silence when the read-aloud describes the pull. Let the players sit in the quiet."],
    ["Suspicion clock 2+", "Dark Souls 3 — 'Vordt of the Boreal Valley'", "Low, building dread. The guards are closing in — play it under the GM's narration, not over the players' planning."],
    ["Combat / alarm triggered", "Witcher 3 — 'Steel for Humans'", "Fast, dirty, urgent. This is a bar fight, not a boss battle."],
    ["Chase / extraction", "Darkest Dungeon — 'Combat in the Ruins'", "Frantic. The PCs are running with a drugged man through pig pens."],
    ["The Loge (if entered)", "Complete silence", "No music at all. The absence is the point. Let the room speak for itself."],
    ["Felix is dead (if Kaspar acts)", "Silence, then Witcher 3 — 'The Fields of Ard Skellig' (grief version)", "The silence should last at least ten real seconds. Then the music comes in very quietly."],
  ],
  [2200, 3200, 3960],
));

c.push(h2("3.2 Enhanced NPC descriptions"));
c.push(body("These supplement the stat blocks in the scene packet. Read the physical description when the NPC first appears; use the mannerism throughout the scene to make them memorable."));

c.push(h3("Mab Lowhaven — pit-mistress"));
c.push(body("Short even for a halfling, built like a barrel. Grey-streaked auburn hair pulled into a tight braid that she tugs when she's thinking. Moves through the warehouse like she owns the floorboards — because she does. Speaks in clipped sentences; never raises her voice because she's never had to. Wears a leather jerkin over a flour-dusted shirt that still smells faintly of the bakery she ran before Bella died. The keys on her belt clink with every step — the sound IS the suspicion clock for the players."));
c.push(bullet("Mannerism", "Tugs her braid before making a decision. If she stops tugging mid-pull, she's about to act."));
c.push(bullet("Playing her", "Mab is grief operating as competence. She doesn't monologue about Bella — she runs the pit with the precision of someone who can't afford to stop moving. Her anger is in what she doesn't say. When she addresses the PCs, she looks at their hands before their faces."));
c.push(quote("Mab", "Bella's dead, the Cage is gone, and you've come to take the last thing we have left. Give me one reason to let you walk out with it."));

c.push(h3("Oswin 'Spike' Lowhaven — marksman"));
c.push(body("Young, wiry, freckled. Looks like a grocer's son who found a crossbow. Barely speaks — communicates with Mab through glances and small head tilts. Chews on a leather strap when he's nervous (which is always). His hands are steady when they're on the crossbow; everywhere else they shake slightly. He's terrified of what happens if Felix escapes, and that fear makes him dangerous."));
c.push(bullet("Mannerism", "Chews his leather strap faster as tension rises. Stops chewing entirely when he's about to shoot."));
c.push(bullet("Playing him", "Oswin is a kid in over his depth. He'll kill for Mab because she's the only family structure he has left. If Mab falls, he panics — his next action is either to shoot wildly or to freeze. Roll a d10: on 1-5 he fires at whoever's closest, on 6-10 he drops the crossbow and runs for the hatch."));

c.push(h3("Bram Heller — doorman"));
c.push(body("Big, tired, human. Shaved head, broken nose healed crooked. Former docker who took the door job because it paid better than the wharf and hurt less. He doesn't care about Felix, the Lowhavens, or the principle of the thing — he cares about getting home with his teeth. Smokes a clay pipe outside every twenty minutes like clockwork. His coat smells of pig grease and cheap tobacco."));
c.push(bullet("Mannerism", "Cracks his knuckles one at a time, left hand first, when he's sizing someone up. If he stops mid-hand, he's decided you're not worth the trouble."));
c.push(bullet("Playing him", "Bram is the path of least resistance personified. Bribe him (8 shillings and a clear conscience), threaten him (any credible show of force), or just walk past him with enough confidence and he'll pretend he didn't see. He only fights if cornered with no exit. If offered a clean way out mid-combat, he takes it without hesitation."));
c.push(quote("Bram", "I get paid to stand at a door, not to die in front of one. You want in? Make it worth my night off."));

c.push(h3("Elsbeth Kranz — healer and bookkeeper"));
c.push(body("Thin, precise, mid-forties. Wire spectacles she pushes up her nose constantly. Ink-stained fingers. Speaks in the careful, measured tone of someone who learned early that being useful keeps you alive. She's not cruel — she genuinely monitors Felix's health — but she's also not going to die for him. Carries a leather satchel with sedatives, an antidote, and the fight ledger. The satchel is her bargaining chip and she knows it."));
c.push(bullet("Mannerism", "Pushes her spectacles up when she's about to lie. Doesn't push them when she's telling the truth. Observant PCs can pick up the tell with a Hard Intuition test (-10)."));
c.push(bullet("Playing her", "Elsbeth trades information for safety. If cornered: she offers the antidote, the key location, and anything from the ledger in exchange for walking out with her satchel. She will not destroy the ledger unless she truly believes she's about to die — it's her insurance against the Lowhavens as much as anyone else."));
c.push(quote("Elsbeth", "I gave him enough to sleep, not enough to kill him. Let me out and I'll tell you which bottle wakes him."));

c.push(h3("Corporal Tylo Vielfrass — in the Loge"));
c.push(body("Handsome in a way that's almost too clean for the Schwarzehalle — square jaw, groomed stubble, warm brown eyes that crinkle when he smiles. His Watch uniform is impeccable even here. He sits in the Loge's good chair like it was made for him, legs crossed, a cup of wine in hand that he never seems to drink from. His voice is low, warm, and unhurried — the voice of a man who has never been refused anything twice."));
c.push(bullet("Mannerism", "Tilts his head slightly when someone interests him — like a dog hearing a new sound. The comparison should unsettle more than it reassures."));
c.push(bullet("Playing him", "Vielfrass radiates ease. Nothing about him reads as dangerous until you notice how carefully everyone around him moves. If confronted about being here, he's unflappable — 'A man in my position has to keep an eye on public order.' He doesn't threaten; he implies consequences through warmth, which is worse. He leaves on his own terms, never in a hurry."));
c.push(quote("Vielfrass", "You'll forgive me the seat. A man in my position has to keep an eye on public order, and this is about as public as disorder gets."));

c.push(h3("Sergeant Orban Geldrecht — outside the Loge"));
c.push(body("Stands near the false panel like a shadow with shoulders. Thick-necked, clean-shaven, eyes that track movement before faces. He doesn't talk unless Vielfrass talks first. When Vielfrass smiles, Geldrecht's jaw tightens — not jealousy exactly, but the particular tension of someone watching the person they love charm everyone else in the room."));
c.push(bullet("Mannerism", "Adjusts his belt unconsciously whenever Vielfrass speaks to someone new. A nervous tic he doesn't know he has."));
c.push(bullet("Playing him", "Geldrecht is the most dangerous person in the building who will never start a fight. He watches, he remembers, and he follows Vielfrass out when Vielfrass decides to leave. If the PCs engage with Vielfrass, Geldrecht memorizes their faces. That's his contribution tonight — filing names for later."));

c.push(h3("Gart Funke — if consulted"));
c.push(body("Squat, weathered, smells permanently of pig. Missing two fingers on his left hand (pig bite, years ago). Speaks slowly and deliberately, as if every word costs him something. He's survived the Schwarzehalle by being useful to everyone and loyal to no one — a pig farmer's neutrality. He'll help if the price is right and the pigs aren't involved."));
c.push(bullet("Mannerism", "Wipes his hands on his apron before speaking, even when they're clean. A ritual, not hygiene."));
c.push(quote("Gart Funke", "Everyone in my pens feeds something. The pigs, the families, the Watch. Just tell me which one you're planning to starve."));

c.push(pageBreak());
c.push(h2("3.3 Pieter as NPC (player absent)"));
c.push(body("Pieter's player is missing. The GM plays him (or hands him to a willing player). Keep him present but not decisive — an absent player should never have their character make a defining choice."));
c.push(bullet("In the approach", "Pieter follows the group's plan. He's good muscle and a credible front-door option (Vielfrass's invite). If the group splits, he goes with the majority."));
c.push(bullet("In the Loge", "Don't send Pieter into the Loge unless the group explicitly sends him there. Spare the absent player a Corruption test they didn't choose."));
c.push(bullet("If Felix is rescued alive", "Pieter is the one Felix gravitates toward — shared Tin Spur fighter identity, the Eisfange bout looming. Plant this quietly for when the player returns: Felix says something to Pieter that only another fighter would hear."));
c.push(bullet("In combat", "Pieter fights competently but doesn't take dramatic risks. He covers the extraction rather than leading the charge. Use his fine plate bracers (S15 graveyard endeavor) — they're the best armor in the group."));
c.push(bullet("If Kaspar kills Felix", "Pieter reacts with shock but not initiative. He doesn't start the confrontation — he follows whoever speaks first. This protects the absent player from being dragged into a PvP moment they weren't at the table for."));
c.push(absent("Pieter was present for the rescue but played no decisive role. Whatever the outcome — Felix alive or dead — his reaction surfaces next session when the player is back. If Felix is alive, Felix has said something to Pieter about the Eisfange fight that the player gets to learn about. If Felix is dead, Pieter watched it happen and hasn't spoken about it yet."));

c.push(h2("3.4 Kaspar's bounty (Mercy, 20 GC)"));
c.push(body("The bounty exists but Kaspar's face isn't widely known among the Lowhaven warehouse crew. The bounty is a name, not a portrait."));
c.push(bullet("If Kaspar gives his name", "Mab or Oswin recognize it. The atmosphere shifts — this isn't just an intruder, this is the man who slit Bella's throat. The guards stop thinking about Felix and start thinking about revenge. Suspicion jumps to 3 immediately, and any negotiation becomes a Hard test (-10) at minimum."));
c.push(bullet("If Kaspar stays anonymous", "Nobody connects him to Bella's killer tonight. The bounty stays dormant until a runner or witness carries his description to Mercy — which only happens if the rescue goes loud and someone escapes to talk."));
c.push(bullet("If a guard escapes and later identifies Kaspar", "Mercy confirms his identity by the next day. The bounty goes active. This is a consequence that lands after the session, not during it."));
c.push(gm("Don't force the recognition. Kaspar's player should feel the tension of being in Lowhaven territory without the GM engineering a gotcha. If he's careful, he stays hidden. If he's reckless, the name surfaces naturally."));

// ================================================================
// 4. KASPAR KILLS FELIX — THE CONTINGENCY
// ================================================================

c.push(pageBreak());
c.push(h1("4. KASPAR KILLS FELIX — THE CONTINGENCY"));
c.push(warning("This section exists because the table read suggests Kaspar's player will act on Otto's order. If he doesn't, skip to Section 5 — the aftermath plays out much more simply with Felix alive."));

c.push(h2("4.1 How it happens"));
c.push(body("Kaspar's window is narrow: after cell G is opened and before Felix reaches safety. The most likely moment is during the extraction — Felix is drugged, weakened, and dependent on whoever's guiding him. A knife in the dark, a shove into the pens, a quiet word that it was 'too late.' Felix has halved Wounds, 2 Fatigued, and 1 Poisoned — he cannot defend himself against an armed, healthy PC."));
c.push(bullet("If Kaspar acts openly", "This is an execution, not a fight. Let that land. Felix looks at whoever's closest — probably Pieter — and doesn't have time to speak. The other PCs witness it. Do not soften this with mechanics; describe the act and let the silence do the work."));
c.push(bullet("If Kaspar acts covertly", "Harder to pull off with the group present. He'd need to be alone with Felix — possible if the group splits during extraction (one team clears the route, one carries Felix). An Opposed Stealth vs Perception test against each nearby PC. Success means Felix 'didn't make it' — the truth surfaces later, if at all."));
c.push(bullet("If the group tries to stop him", "Run this as a tense standoff, not a PvP combat. The real drama is the conversation. Kaspar has to justify himself to people who just risked their lives for a rescue he sabotaged. Don't roll initiative unless a player explicitly swings — and even then, give one more chance to talk."));
c.push(gm("Do not editorialize. Kaspar's player has agency. If he kills Felix, that's a valid character choice with consequences — not a mistake to be prevented. Your job is to make the consequences real, not to steer the decision."));

c.push(h2("4.2 Immediate fallout"));
c.push(bullet("The group", "The betrayal fractures trust at the worst possible time — the sewer expedition, Red Moon Burning, and the doomsday clock all depend on this group staying together. Individual PCs react according to their nature: Ludwig might see the ruthless logic, Silas might be horrified, Thucydion might be coldly furious that the mission was sabotaged."));
c.push(bullet("The Lowhaven guards", "Mab doesn't mourn Felix — he was merchandise. But a dead captive is useless merchandise. She might actually let the PCs leave faster now: nothing left worth fighting over, and a dead body is evidence she doesn't want found in her warehouse. Oswin is confused. Bram doesn't care. Elsbeth starts calculating her exit."));
c.push(bullet("Felix's body", "Leaving it in the warehouse lets the Lowhavens dispose of it quietly — no questions. Taking it is evidence and a burden. Hiding it somewhere in the Schwarzehalle buys time before anyone knows he's dead, but the Crosses will find out."));

c.push(h2("4.3 Silvi's Ranaldian response"));
c.push(body("Silvi doesn't rage. She calculates. Her reaction unfolds in layers — play them across the aftermath scene, not all at once."));

c.push(h3("Layer 1 — Cold reception"));
c.push(body("The PCs return to the Crooked Hammer or a Crosses safehouse. Silvi listens. She asks one question: 'Who?' Not 'why' — she already suspects Otto. Her face doesn't change. Old Hamm pours drinks for everyone except Kaspar."));
c.push(quote("Silvi", "I asked for one man, alive. You brought me a body and five excuses. I'll pay for the effort — half — because you did walk into that building. But the next time I ask for something breathing, I expect it to breathe."));

c.push(h3("Layer 2 — The deal"));
c.push(body("She withholds full payment. Not punishment — leverage. She pays 10 GC instead of 20, framing it as generosity: 'You broke into the building, you dealt with the guards, you spent your evening on my business. That's worth something. The other half was for Felix.'"));
c.push(bullet("If the PCs push back", "She's immovable. 'You didn't deliver. I don't pay for what I didn't get. You're welcome to find another patron who's more generous with failures.'"));
c.push(bullet("The ledger", "If the PCs recovered the fight ledger, she values it separately — it's intelligence on the Lowhavens and the Circle. She'll pay a bonus for it (5 GC) and make a point of thanking whoever brought it, not Kaspar."));

c.push(h3("Layer 3 — The real move"));
c.push(body("Silvi now knows Otto wanted Felix dead. That's intelligence about the Baron's strategy against the Lowhavens. She files it. She doesn't share this deduction with the PCs — she uses it when the time comes. This is a Ranaldian priestess working: every setback becomes a card in a different hand."));
c.push(bullet("Practical effect", "Silvi starts building a picture of the Baron's gang's internal politics. She already knew Otto is ambitious; now she knows he's willing to spend the PCs as tools against the Lowhavens. That makes him predictable — and predictable enemies are useful enemies."));

c.push(h3("Layer 4 — The wedge"));
c.push(body("Silvi makes a quiet, pointed distinction between Kaspar and the rest of the group. She doesn't burn the alliance — she can't afford to, with the sewer expedition coming — but she shifts the terms."));
c.push(quote("Silvi", "Your friend made a choice. The rest of you didn't. I remember who brought me what."));
c.push(bullet("Future dealings", "Silvi communicates through the other PCs from now on. Kaspar isn't banned from the Crooked Hammer, but he's no longer trusted with the details. He becomes someone she watches, not someone she confides in."));
c.push(bullet("The sewer expedition", "Still on. Silvi is pragmatic above all — the Skaven threat is bigger than one dead man. But she'll assign a Crosses observer to the expedition, officially 'for support,' practically to watch Kaspar."));

c.push(h3("Layer 5 — If the group hides Felix's death"));
c.push(body("The Crosses find out within 24 hours. The betrayal of trust is worse than the death. Payment drops to zero, the sewer expedition funding is frozen, and the relationship requires real amends — not coin, but something that costs the group standing or safety."));
c.push(warning("Do not let the group successfully hide Felix's death from Silvi long-term. The Crosses have eyes in the Schwarzehalle, and Silvi already tried to rescue Felix once — she knows what to look for. A short-term cover (tonight) is possible; a permanent one is not."));

// ================================================================
// 5. SCENE 3 — AFTERMATH
// ================================================================

c.push(pageBreak());
c.push(h1("5. SCENE 3 — AFTERMATH"));
c.push(timeBox("LATE NIGHT — The Crooked Hammer or a Crosses safehouse"));
c.push(music("Witcher 3 — 'The Fields of Ard Skellig' (calm version, low volume). The night is winding down. Let the players decompress."));

c.push(h2("5.1 If Felix is alive"));
c.push(body("The clean outcome. Felix is delivered to Silvi or taken to the Tin Spur. Silvi pays the full 20 GC (or negotiate up to 30 if the mission was exceptionally clean — no alarm, no witnesses, the ledger recovered)."));
c.push(quote("Silvi", "I asked for a man, and you brought me one. That's rarer than you'd think in this city."));
c.push(bullet("Felix's state", "Grateful, quiet, and wrong in a way nobody can name yet. He deflects questions about how the fights felt. He thanks the group simply — no speeches — and asks to be taken somewhere with a door he can lock from the inside. He'll sleep for twelve hours."));
c.push(bullet("Felix and Pieter", "If Felix is alive, he says something quietly to Pieter before they part: 'The Eisfange bout — I've seen him move. He doesn't fight like a dog. He fights like something wearing a dog.' Plant this for the player's return — it connects to the Gestaltenstark secret."));
c.push(bullet("Felix and Thucydion", "Felix nods to Thucydion with the particular recognition of someone who's been in the pit. No words needed. If Thucydion asks about the bouts, Felix shakes his head once: 'Not tonight.'"));
c.push(bullet("Silvi's next move", "She confirms the sewer expedition is back on, promises equipment and funding within two days, and thanks the group. She also asks — carefully — whether they encountered anything unusual in the warehouse. She's fishing for the Circle without naming it. If the PCs mention Vielfrass, the Loge, or the icon, her expression hardens: 'That's a different kind of problem.'"));
c.push(gm("Felix's wrongness is a slow-burn thread, not a one-scene reveal. Don't force it tonight. The hint to Pieter about Eisfange is the most important plant — it gives the player something to chew on when they return and connects two threads the group hasn't linked yet."));

c.push(h2("5.2 If Felix is dead (Kaspar acted)"));
c.push(body("Run the Silvi reaction from Section 4.3. After the payment scene, the group is left to regroup."));
c.push(bullet("The fracture", "Don't resolve the group tension tonight. Let it sit. The PCs have Red Moon Burning tomorrow and the sewer expedition after that — they need each other whether they trust each other or not. That pressure is the drama."));
c.push(bullet("Kaspar alone", "If Kaspar reports to Otto (in his head or via a message), Otto is satisfied: cheap, clean, one more blow to the Lowhavens. He doesn't congratulate — he notes. Kaspar passed the loyalty test, which means Otto will use him again. And again."));
c.push(bullet("The group's question", "Somebody will ask: 'Why?' Kaspar can tell the truth (Otto's order), lie (Felix was too far gone, self-defense, he tried to run), or say nothing. Each has different consequences for party trust. Don't force it — let the conversation happen naturally."));

c.push(h2("5.3 Franz and Red Moon Burning"));
c.push(body("If time allows, a brief check-in with Franz at the Red Moon. He's nervous but focused — his birthday is tomorrow, and he intends to die."));
c.push(bullet("The gunpowder", "If the dwarven cask is at the Red Moon (or wherever it was stashed), Franz is satisfied. He starts planning placement — where in the cellar, how much under which support beam. The PCs don't need to help with this tonight; it's color, not a scene."));
c.push(bullet("If Carmello's crew followed the PCs", "Franz needs to know. If warned, he adjusts: moves the powder, changes the timeline, or sets a watch. If not warned, Carmello's crew arrives at the Red Moon on the 14th knowing more than they should."));
c.push(bullet("Franz's mood", "Quieter than usual. He's not melancholy — he's precise. Tomorrow he burns twenty years of his life to buy a clean start. He won't say this out loud, but the way he handles the inn's furniture — straightening a chair, wiping a counter — tells the players this place meant something."));
c.push(quote("Franz", "Get some sleep. Tomorrow's a long day, and I'll need you sober for the hard parts."));
c.push(gm("Don't run Red Moon Burning tonight. This is a teaser — a mood cue and a logistical checkpoint. Save the full mission for Session 18. If the players start planning the 14th in detail, let them — it's good prep — but don't launch the scene."));

// ================================================================
// 6. LANDING IMAGES
// ================================================================

c.push(h1("6. LANDING IMAGES — END OF SESSION"));
c.push(body("Choose one depending on the outcome. End on this image, then stop. No epilogue, no preview. Let the players sit with it."));

c.push(h3("If Felix is alive and the rescue was clean"));
c.push(readAloud("Felix sits on the edge of a cot in the safehouse, a borrowed blanket around his shoulders, a cup of water he hasn't touched. He looks at the door — a real door, with a lock he can reach — and something in his face loosens for the first time tonight. He doesn't smile. He just breathes, slowly, like he's remembering how."));

c.push(h3("If Felix is alive but the rescue was loud"));
c.push(readAloud("Somewhere in the Schwarzehalle, a halfling runner reaches a door and knocks three times. Inside, Mercy Lowhaven is still awake. She listens. Then she stands, and reaches for her coat. The night isn't over for everyone."));

c.push(h3("If Felix is dead — Kaspar acted"));
c.push(readAloud("The walk back is quiet. Nobody speaks. The city's night sounds fill the space where conversation should be — a drunk singing in the Dunkelfeucht, a dog barking at nothing, the creak of a sign in the wind. Kaspar walks two steps behind the rest, and nobody turns to close the gap."));

c.push(h3("If the rescue failed"));
c.push(readAloud("Before dawn, a cart leaves the Hog Pit warehouse by the back gate. Felix is inside, sedated, wrapped in a hog blanket. Mab drives. She doesn't look back. By the time the sun rises, the warehouse is empty, the pens are just pens, and the only trace that anything happened is a bloodstain on the sawdust that the pigs will eat before noon."));

// ================================================================
// 7. LAUNCH CHECKLIST
// ================================================================

c.push(pageBreak());
c.push(h1("7. LAUNCH CHECKLIST"));
c.push(body("Verify before Session 17 begins:"));
c.push(bullet("Scene packet", "The Hog Pit scene packet (Session 16 guide) is printed or open alongside this guide."));
c.push(bullet("Pieter", "Decide who plays him — GM or a willing player at the table."));
c.push(bullet("Grodni", "Opening scene. Ludwig's answer. Have Grodni's lines ready."));
c.push(bullet("Carmello's tail", "Perception check as they leave the Dawihafen. Know where the gunpowder ends up if the tail succeeds."));
c.push(bullet("Kaspar's kill order", "Don't remind Kaspar's player. He knows. Let it surface naturally."));
c.push(bullet("Silvi's reaction", "Have the layered response ready (Section 4.3) in case Felix dies. If Felix lives, Section 5.1."));
c.push(bullet("Music playlist", "Queued: Merchants of Novigrad → Silver for Monster Hunters → Chopin/silence → Vordt → Steel for Humans → Combat in the Ruins → Fields of Ard Skellig. Plus total silence for the Loge."));
c.push(bullet("NPC cheat sheet", "Mab (braid tug), Oswin (leather chewing), Bram (knuckle cracking), Elsbeth (spectacles push = lying), Vielfrass (head tilt), Geldrecht (belt adjust), Funke (apron wipe)."));
c.push(bullet("Suspicion clock", "Starts at 0 (or 1 if Rolf tipped them off — decide before the session based on how much Kaspar shared with the gang)."));
c.push(bullet("Corruption tests", "Minor for watching a bout. Moderate for fighting or entering the Loge."));
c.push(bullet("Mercy's bounty", "Dormant unless Kaspar gives his name or a runner escapes to identify him."));
c.push(bullet("End of session", "Landing image chosen. One image. Then silence."));

// ================================================================
// DOCUMENT BUILD
// ================================================================

const styles = {
  default: {
    document: {
      run: { font: "Georgia", size: 22, color: C.ink },
      paragraph: { spacing: { after: 120, line: 300 } },
    },
  },
  paragraphStyles: [
    {
      id: "Normal",
      name: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Georgia", size: 22, color: C.ink },
      paragraph: { spacing: { before: 0, after: 120, line: 300 } },
    },
    {
      id: "CampaignTitle",
      name: "Campaign Title",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 58, bold: true, color: C.darkRed },
      paragraph: { spacing: { before: 0, after: 60, line: 520 } },
    },
    {
      id: "CampaignSubtitle",
      name: "Campaign Subtitle",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 31, bold: true, color: C.red },
      paragraph: { spacing: { before: 0, after: 80, line: 320 } },
    },
    {
      id: "CampaignHeading1",
      name: "Campaign Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 32, bold: true, color: C.red },
      paragraph: { spacing: { before: 360, after: 200, line: 300 }, outlineLevel: 0, keepNext: true },
    },
    {
      id: "CampaignHeading2",
      name: "Campaign Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 26, bold: true, color: C.darkRed },
      paragraph: { spacing: { before: 280, after: 140, line: 290 }, outlineLevel: 1, keepNext: true },
    },
    {
      id: "CampaignHeading3",
      name: "Campaign Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 24, bold: true, color: C.blue },
      paragraph: { spacing: { before: 200, after: 100, line: 290 }, outlineLevel: 2, keepNext: true },
    },
  ],
};

const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: {
            indent: { left: 540, hanging: 270 },
            spacing: { after: 80, line: 300 },
          },
          run: { font: "Georgia", size: 22, color: C.ink },
        },
      }],
    },
    {
      reference: "steps",
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: {
            indent: { left: 540, hanging: 270 },
            spacing: { after: 80, line: 300 },
          },
          run: { font: "Georgia", size: 22, color: C.darkRed, bold: true },
        },
      }],
    },
  ],
};

const header = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 0, after: 0 },
    children: [run("WARHAMMER FANTASY ROLEPLAY - UBERSREIK", {
      font: "Arial", size: 16, color: C.grey, smallCaps: true,
    })],
  })],
});

const footer = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [
      run("Session 17 - The Hog Pit - ", { font: "Arial", size: 16, color: C.grey }),
      new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.grey }),
    ],
  })],
});

const doc = new Document({
  creator: "Ubersreik Campaign",
  title: "Session 17 - The Hog Pit",
  description: "GM guide for Session 17 — wrapper around the Hog Pit scene packet with opening, aftermath, and contingencies.",
  styles,
  numbering,
  sections: [{
    headers: { default: header },
    footers: { default: footer },
    properties: {
      page: {
        size: { width: PAGE.width, height: PAGE.height },
        margin: {
          top: PAGE.margin,
          right: PAGE.margin,
          bottom: PAGE.margin,
          left: PAGE.margin,
          header: PAGE.header,
          footer: PAGE.footer,
        },
      },
    },
    children: c,
  }],
});

const outputDir = path.resolve("campaign_docs", "output");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "Session 17 - The Hog Pit.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generated ${outputPath} (${c.length} blocks)`);
