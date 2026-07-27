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

// Design preset: compact_reference_guide (same tokens as prior guides).
// US Letter; 1 in margins; 0.492 in header/footer; 9360 DXA content width;
// 11 pt body; 6 pt after; 1.25 line spacing; established GM/read-aloud/
// warning/absence/time/music callouts. Written in English per GM request.

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

const floorPlan = (lines) => new Paragraph({
  shading: { fill: "F3F3F3", type: ShadingType.CLEAR },
  border: {
    top: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8", space: 6 },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8", space: 6 },
    left: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8", space: 6 },
    right: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8", space: 6 },
  },
  indent: { left: 120, right: 120 },
  spacing: { before: 80, after: 160, line: 240 },
  children: lines.map((line, index) => run(line, {
    font: "Courier New",
    size: 17,
    color: C.ink,
    break: index === 0 ? undefined : 1,
  })),
});

const titleBlock = () => [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 80 },
    children: [run("GM GUIDE - SESSION 16 - SCENE PACKET", {
      font: "Arial", size: 20, bold: true, color: C.gold, smallCaps: true,
    })],
  }),
  new Paragraph({
    style: "CampaignTitle",
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60, line: 520 },
    children: [run("THE HOG PIT", { font: "Arial", size: 58, bold: true, color: C.darkRed })],
  }),
  new Paragraph({
    style: "CampaignSubtitle",
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80, line: 320 },
    children: [run("Rescuing Felix Scite", { font: "Arial", size: 31, bold: true, color: C.red })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 260, line: 280 },
    children: [run("Wellentag 13th Sigmarzeit - one long night", { font: "Arial", size: 22, italics: true, color: C.grey })],
  }),
];

const c = [];
c.push(...titleBlock());

c.push(h1("1. AT A GLANCE"));
c.push(labelDetailTable([
  ["Situation", "Felix Scite, former Tin Spur champion, has been drugged and held by the Lowhavens in a converted fodder warehouse against the Hog Pens of Schwarzehalle. He fights tonight - the first public bout since his capture."],
  ["The catch", "Repeated exposure to a hidden Slaanesh-adjacent icon (see 7. THE LOGE) has left Felix with a genuine, private hunger for the sensation of the pit. Rescuing him does not simply undo it."],
  ["Objective", "Reach cell G, deal with tonight's security (roughly eight guards plus a real crowd), and extract Felix through one of several exits."],
  ["Why tonight, not later", "Security will not meaningfully increase from here - tonight already carries the fight-night crowd, the full guard complement, and Corporal Vielfrass in attendance. If Felix survives, bouts simply continue on a rolling schedule."],
  ["Tone", "A dirty break-in at a pig market, not a dungeon crawl. The Lowhavens are trying to save their clan, not run a fortress. Guards can flee, bargain, or surrender."],
  ["Table time", "Briefing and casing 20-30 min; approach 20-30 min; the bout and infiltration 30-45 min; extraction and consequences 15-20 min."],
  ["If nothing is done", "Felix keeps fighting, night after night, until his mind gives out or the Lowhavens no longer need him. The rescue window doesn't close on a clock - it just gets harder to live with the wait."],
]));
c.push(gm("The rescue should be winnable without a straight fight. Good casing turns a hard door into a choice; a weak plan turns eight guards and a crowd into a foot race against discovery. Do not inflate the guard count beyond what's listed here - the crowd itself is the real complication tonight."));
c.push(music("The Witcher 3 - 'Silver for Monster Hunters' under the approach; something slow, warm, and slightly wrong (Chopin nocturne, detuned) under the bout itself - the crowd's reaction should feel more unsettling than the violence."));

c.push(h1("2. CANON AND PLACE IN THE CAMPAIGN"));
c.push(body("In the Ubersreik source material, the Hog Pens are a sprawl of open pens threading through the Schwarzehalle slum, crossed by wooden walkways above the mud, refuse, and pigs. Gart Funke unofficially controls the pen allotments and keeps the local Watch fed on pork and silence."));
c.push(body("In this campaign, the Lowhaven clan converted an old fodder warehouse against the pens' northern edge into a clandestine fighting pit. The underworld now just calls the building itself the Hog Pit. The warehouse's use isn't secret - its new purpose is. By day it takes deliveries of spoiled grain, bandages, and barrels. By night it sells wagers, blood, and silence."));
c.push(bullet("Why Felix", "The Lowhavens lost the Gilded Cage and Bella. A poster bearing a real champion's name is their fastest way to rebuild money, reputation, and muscle."));
c.push(bullet("Why tonight specifically", "Silvi's own attempt to recover Felix during the downtime failed quietly. The Lowhavens know someone is looking for him, which is exactly why they're not waiting any longer to put him in the pit."));
c.push(bullet("What the PCs can gain", "Felix alive; Silvi's gratitude and renewed backing for the sewer expedition; a compromised ledger; another blow against the Lowhavens; and, for Thucydion, unavoidable first real contact with the Circle of Unmarred Flesh."));
c.push(warning("Bella's death colors every interaction here. If Kaspar is recognized, the guards aren't looking at intruders anymore - they're looking at their kinswoman's killer. Leave them a way out regardless: they want to carry his name to Mercy more than they want to die on the spot."));

c.push(h2("2.1 Silvi's briefing"));
c.push(readAloud("Silvi doesn't sit. She paces once around the table before she speaks. 'I went looking for confirmation, and what I found instead was a wall. The Temple as good as called me a hysteric spreading blasphemy. The Council leaned on Jendrick, and Jendrick leaned on our standing with three different guilds. And the dwarfs -' she stops herself, exhales. 'The dwarfs I trust just told me no. Flatly. Not frightened - dwarfs fight ratmen in their own tunnels under this city and have for longer than Ubersreik's had walls. They simply see no reason to spend themselves convincing Ungi who won't listen anyway. So. I can't hand you a war chest for the sewers tonight. But I can hand you something that matters just as much.'"));
c.push(bullet("Khazalgirt", "The dwarfs' own name for their sewer-hold beneath Ubersreik, where they fight Skaven as routine business, not revelation. Their refusal isn't fear - it's a blunt cost-benefit judgment about wasting breath on Humans."));
c.push(bullet("Who's actually pushing back", "Not named to the PCs yet - deliberately opaque even to Silvi. She only knows the pressure arrived from several directions at once, faster and more coordinated than random bad luck would explain."));
c.push(bullet("The ask", "Her own recovery attempt at the Hog Pit failed during the downtime. Felix fights again tonight. Get him out, and she pays well now, and reopens the sewer expedition once the political heat cools."));
c.push(quote("Silvi", "I don't need heroes who kick down a door. I need Felix on the other side of it, breathing, and I need it to look like nobody's business but ours."));

c.push(h2("2.2 Otto's parallel errand (played off-screen)"));
c.push(body("This scene is not run live at the table. It happens that same morning, while Kaspar is still making his way out of the Dunkelfeucht toward the Red Moon Inn - summarize it in Kaspar's personal downtime handout, not as a table scene."));
c.push(bullet("What happens", "Otto catches Kaspar alone before he reaches the Inn. Proud of him, and never one to waste a cheap shot at a rising rival, he tasks Kaspar with quietly killing Felix tonight - denying the Lowhavens their fastest route back to relevance. Cheap for Otto. A loyalty test for Kaspar."));
c.push(bullet("Framing", "Don't editorialize which way Kaspar should lean. The handout should simply state the offer and let the player decide how (or whether) to act on it once the Felix job is underway."));
c.push(warning("Kaspar now answers to two people pointing at the same building with opposite instructions, and neither knows about the other yet."));

c.push(h2("2.3 Vielfrass's standing invitation (retroactive downtime beat)"));
c.push(body("Fold this into Thucydion's and Pieter's personal downtime handouts as something that already happened, not a new scene to run live: at some point during the downtime, Corporal Tylo Vielfrass was seen lingering at the Tin Spur, friendly and charismatic as ever. He struck up conversation with both of them and extended an open invitation to 'a fight or two, when the mood takes you' - including, casually, tonight's bout at the Hog Pens."));
c.push(bullet("Why it matters now", "It gives Thucydion and Pieter a plausible, innocent-looking reason to already be known to Vielfrass before tonight, and it means either of them could walk in through the front as an invited guest rather than an intruder."));
c.push(bullet("The hook it plants", "If the rescue goes loud, Vielfrass's own invitation gives the Watch a clean pretext to detain Thucydion (and potentially Pieter) alongside anyone else caught - useful later if the Starter-Set-style arrest arc from the open questions list gets used. Not committed yet; just keep the pretext alive."));

c.push(h1("3. FINDING AND CASING THE HOG PIT"));
c.push(readAloud("You smell the Hog Pens before you see them. Rooflines drop, gutters widen, and planking slowly replaces cobblestone. Under the walkways, pink backs shift in grey mud. At the pens' northern edge stands a long, windowless warehouse, tar roof, brick walls to head height. A cart door still bears, under a coat of black paint, the word FODDER. Tonight, torchlight leaks from every seam, and the walkways outside are busier than they have any business being."));
c.push(h2("3.1 Usable leads"));
c.push(bullet("The bandage fence", "Rolls of linen stolen from the Temple of Shallya move through the Fleshmarket. An Average Gossip test (+0), or simply tailing the seller, leads to the warehouse's back yard without ever naming the Lowhavens."));
c.push(bullet("Fight tickets", "A Hard Gossip test (-10) in the right shadow; +2 SL gives tonight's start time, +4 SL gives the building itself. A ticket is cover as far as the vestibule, no further."));
c.push(bullet("Gart Funke", "Bribery or a Hard Charm test (-10). He won't sell out the Lowhavens for coin alone - he'll talk if the PCs promise his pigs, his workers, and his arrangement with the local Watch stay out of it."));
c.push(bullet("Dirk Schwengen", "The walkway tout sells the night's attendance count for 6 shillings, then just as happily sells the PCs' description back to the Lowhavens for the same price if nobody's watching him."));
c.push(bullet("The Crosses", "Silvi provides a ticket, a nightsoil cart, or a good set of lockpicks. She won't send another team in blind."));
c.push(bullet("Rolf", "If Silas or Kaspar discusses the plan anywhere near the gang, Rolf quietly warns the Lowhavens. Add two hired hands and start the suspicion clock at 1."));

c.push(h2("3.2 An hour of watching"));
c.push(body("Average Perception (+0). Each PC who describes a different vantage can learn a fact - pool the group's SL rather than re-rolling the same observation."));
c.push(bullet("0 SL", "Two deliveries use the back door; the cart door stays shut; a fight crowd is already gathering along the walkways out front."));
c.push(bullet("+1 SL", "The doorman steps out alone to smoke every twenty minutes. An alarm wire runs from the back door to a bell in the vestibule."));
c.push(bullet("+2 SL", "A roof hatch opens from the inside to vent smoke. The crossbowman leaves the gallery for a few minutes at the guard changeover."));
c.push(bullet("+3 SL", "Felix's key hangs from the pit-mistress's belt. A healer brings a cup to his cell roughly every two hours."));
c.push(bullet("+4 SL", "A low chute lets buckets and piglets pass between the storeroom and the eastern pen. A dwarf can slip through it; a human or elf needs a Hard Athletics test (-10)."));

c.push(pageBreak());
c.push(h1("4. THE PLACE"));
c.push(h2("4.1 GM's schematic"));
c.push(floorPlan([
  "                         N - SCAVENGERS' ALLEY",
  "             [I BACK YARD]---[H STORAGE]---[G FELIX'S CELL]",
  "                    |               |              |",
  "WEST [A GATE]--[B VESTIBULE]--[C PIT HALL]--[D SERVICE] EAST",
  "                                      |               |",
  "                               [E STAIRS]        PIG CHUTE",
  "                                      |               |",
  "                             [F MEZZANINE]      OUTER PENS",
  "                                      |",
  "                            [L THE LOGE] (hidden, false panel)",
  "                         S - HOG PIT WALKWAYS",
]));
c.push(gm("Useful scale: the building runs about 30 by 18 yards. The central pit is 8 by 6 yards; the mezzanine sits 3 yards up. Use the plan for sightlines and exit choices, not square-by-square counting."));

c.push(dataTable(
  ["ZONE", "FUNCTION", "DETAILS AND ACCESS"],
  [
    ["A", "Cart door", "Two leaves, barred from inside; halfling-height peephole. Very Hard Strength test (-30) to force, or opened from B."],
    ["B", "Vestibule", "Wagering table, coat pegs, alarm bell, second door. The doorman controls tickets, deliveries, and faces."],
    ["C", "Pit hall", "Sand and sawdust, a moveable barrier, dismantled stands against the wall. Two lanterns; sour beer and washed-away blood."],
    ["D", "Service", "Buckets, water, bedding, harness. A door to the pens and a low chute to the outside."],
    ["E", "Stairs", "Narrow, steep, no risers. One fighter can hold it alone; the handrail gives on a Hard Strength test (-10)."],
    ["F", "Mezzanine", "Shooting gallery, betting desk, roof hatch. Sightlines on B, C, and E - not on G."],
    ["G", "Felix's cell", "A former salting room. Heavy door, good lock, wall ring, a pallet and a bucket. No window."],
    ["H", "Storage", "Grain sacks, small casks, medicine, the fight ledger, and a loose panel toward I."],
    ["I", "Back yard", "A cart, stacked planks, a gate onto the alley. The bell wire runs under the south leaf."],
    ["L", "The Loge", "Hidden viewing room behind the mezzanine, reached through a false panel behind the betting desk. Built quietly for Vielfrass. Holds the Unmarred Flesh icon (see 7). No exterior access."],
  ],
  [720, 2080, 6560],
  [AlignmentType.CENTER, AlignmentType.LEFT, AlignmentType.LEFT],
));

c.push(h2("4.2 Mood and clues"));
c.push(bullet("Sound", "The crowd's noise covers a whisper or a working lock, but not a broken door, a gunshot, or the bell."));
c.push(bullet("Smell", "Ammonia, grease, wet sawdust. A keen-nosed PC picks out the bitter tang of sedative near G."));
c.push(bullet("Light", "By day, roof gaps are enough. Tonight, B and C are lit for the crowd; D, G, H, and L sit in shadow."));
c.push(bullet("Fire", "Tar roofing, straw, and grain dust make any fire catastrophic. After two rounds of open flame in H or D, treat the zone as Ablaze."));
c.push(bullet("Bystanders", "Two hog-keepers work outside and flee at the first shout. They are neither Lowhavens nor fighters."));
c.push(warning("A fire frees Felix faster than it saves him - smoke in G, panicked pigs, blocked alleys, and perfect evidence for Mercy to paint the PCs as killers of the poor."));

c.push(h1("5. SECURITY TONIGHT"));
c.push(h2("5.1 The house crew"));
c.push(bullet("Mab Lowhaven, pit-mistress", "In C or F; carries the ring of keys to G, a whistle at her neck. She protects the business before her pride."));
c.push(bullet("Oswin 'Spike' Lowhaven, marksman", "On F; loaded crossbow, a second weapon at the desk. He aims for lanterns, legs, and whoever's carrying Felix."));
c.push(bullet("Bram Heller, human doorman", "In B; opens A, inspects deliveries, steps out alone to smoke. He runs if Mab falls and an exit is open."));
c.push(bullet("Elsbeth Kranz, healer and bookkeeper", "Between H and G; carries the sedative and a partial antidote. Not a fanatic - she surrenders if isolated."));
c.push(bullet("Two hired hands (fight-night only)", "Crowd control at A and along the walkways outside. Muscle, not loyalists - they fold fast if the crowd itself turns against a scene, and faster still if paid to look elsewhere."));
c.push(gm("That's six named guards plus roughly two dozen bettors and onlookers who are not combatants but are witnesses. The crowd is the real obstacle tonight, not the headcount - a fight in the open pit hall happens in front of everyone. These six are the minimum in the restricted areas (H, D, G, F, L); they do not stand still, and a credible diversion always pulls at least one of them."));

c.push(h2("5.2 Physical obstacles"));
c.push(dataTable(
  ["OBSTACLE", "TEST", "FAILURE OR NOISE"],
  [
    ["Back door I", "Hard Pick Lock (-10)", "The bell wire is spotted on a Hard Perception test (-10). Left live, a failure raises suspicion by 2."],
    ["Roof hatch F", "Easy Climb (+20), then Average Pick Lock (+0)", "A failed Climb costs time; a failed lock alerts Oswin if he's on the gallery."],
    ["Pig chute D", "Dwarf: Average Athletics (+0). Human/Elf: Hard Athletics (-10)", "The PC gets stuck, gains 1 Entangled, and needs another test or must back out."],
    ["Door to G", "Key, Hard Pick Lock (-10), or Very Hard Strength (-30)", "Forcing it opens the door but jumps suspicion straight to 3."],
    ["Walkways", "Agility (+0) if running or fighting", "A 2-yard fall into the mud: resolve the fall normally, then 1 Entangled."],
    ["False panel to L", "Perception (Hard, -10) to find it; Pick Lock (+0) once found", "A failed search wastes a round; a failed lock is heard by whoever's in the Loge."],
  ],
  [2000, 3040, 4320],
));

c.push(h2("5.3 Suspicion clock (restricted zones only)"));
c.push(body("The crowd itself starts at ease - nobody blinks at strangers in B or C tonight. This clock only tracks the guarded interior (D, G, H, F, L). Start at 0, or 1 if Rolf tipped the Lowhavens off. Advance one step on a loud failure, a seen-through lie, or a guard visibly vanishing. One excellent idea or a sustained bluff can knock it back a single step, once."));
c.push(timeBox("0 - ROUTINE: Bram at the vestibule, Oswin on the gallery, Mab moving between C and F, Elsbeth at storage."));
c.push(timeBox("1 - SUSPICION: Oswin loads his second crossbow; Mab drifts toward B; interior doors start getting closed."));
c.push(timeBox("2 - LOCKDOWN: Mab keeps the keys on her; Elsbeth moves to G; Bram bars A; anyone new gets searched."));
c.push(timeBox("3 - ALARM: the bell rings; next round Mab heads for G and Oswin hunts an angle. One guard tries to slip out through I."));
c.push(timeBox("4 - LOWHAVEN EXTRACTION: Felix is dragged toward D and the pens. This becomes a chase; a runner carries the PCs' description straight to Mercy."));

c.push(pageBreak());
c.push(h1("6. THE BOUT ITSELF"));
c.push(readAloud("The barrier drops. Felix and a debt-bound docker circle each other under lantern light, and it is nothing like the fights you've seen before. No armor, next to nothing worn at all. The blows land soft, almost caresses, skin sliding against skin, and where you expect blood there is only a strange, unbroken grace - as if pain itself had been rewritten as pleasure. The crowd along the rail has gone utterly still, halflings and dockers alike, mouths slightly open, drawn forward without meaning to lean. You feel it too, that pull, before you can decide not to."));
c.push(bullet("What's really happening", "The Loge's influence bleeds gently into the pit. The bout is genuinely bloodless and genuinely choreographed - but the pleasure the crowd (and the PCs) feel watching it is not a metaphor. It's real, mild corruption, delivered as fascination rather than horror."));
c.push(bullet("Witnessing", "Any PC who watches a bout meaningfully (more than a passing glance) tests for a Minor Corruption exposure. Play it as seduction, not dread - describe the specific, sensory pull (warmth, the closeness of bodies, a held breath) rather than naming the source."));
c.push(bullet("Participating", "A PC who actually fights in the pit tonight (see the negotiated-bout option in 8.2) tests for a Moderate Corruption exposure instead, for the same reason at much closer range."));
c.push(warning("Do not play this as body horror or as comedy. The unease should come from how good it looks, not how wrong - the players should feel faintly guilty for wanting to keep watching."));
c.push(gm("Felix fights competently but distantly, like someone half-listening to their own body. If asked, he'll later say only that it 'didn't feel like losing.' That's the hook for 10.3 and his personal thread with Pieter."));

c.push(h1("7. THE LOGE AND VIELFRASS"));
c.push(body("Behind the mezzanine, through a false panel hidden behind the betting desk, sits a small private chamber built quietly for Corporal Tylo Vielfrass. Nothing about it screams warning - a good chair, dim light, and set into the far wall, a mosaic of countless small mirror shards arranged by skin tone rather than pattern, so that from a few feet away it simply looks like flesh, endlessly layered and impossibly smooth. It is unsettling exactly because it isn't grotesque."));
c.push(bullet("Vielfrass tonight", "He's here in person, in the Loge, watching Felix's bout with obvious, quiet satisfaction. Sergeant Geldrecht waits just outside, ostensibly on watch, actually watching Vielfrass."));
c.push(bullet("Corruption exposure", "A PC who enters the Loge or lingers within a few feet of the icon tests for a Moderate Corruption exposure, regardless of whether they fought or merely watched from the pit. This is the most dangerous few feet in the building, socially and spiritually both."));
c.push(bullet("If Vielfrass is confronted or spotted", "He does not panic. He's a Watch corporal in a building he has every reason to claim he's merely 'monitoring.' He'll talk his way past a confrontation far more easily than the PCs expect - keep him slippery, not stupid."));
c.push(bullet("Keep it subtle", "This is the party's first real, on-screen contact with the Circle of Unmarred Flesh. Do not name Slaanesh, do not explain the icon. Let discomfort do the work."));
c.push(quote("Vielfrass", "You'll forgive me the seat. A man in my position has to keep an eye on public order, and this is about as public as disorder gets."));

c.push(h1("8. APPROACHES"));
c.push(h2("8.1 As spectators or bettors"));
c.push(body("With a real fight and a real crowd tonight, simply buying or bluffing a ticket at the front gate is easier than it would ever be on a quiet night. Average Charm or Entertain (+0); Thucydion or Pieter can lean on Vielfrass's own standing invitation for a further +10. This gets the party into B and C freely - the restricted zones (D, G, H, F, L) still require one of the approaches below or straightforward suspicion-clock risk."));
c.push(h2("8.2 The negotiated bout"));
c.push(body("Gunnar - or any PC willing - can offer a single voluntary bout, witnessed, with Felix's immediate release as the price. The Lowhavens have every reason to accept: a fresh, willing fighter saves their night without any of the risk of an armed break-in. This satisfies the crowd, gives Mab a face-saving story, and is the cleanest path to a quiet extraction - at the cost of a Moderate Corruption test for whoever fights (see 6)."));
c.push(h2("8.3 The delivery cover"));
c.push(body("The party arrives at I with a cart of refuse or bandages. A grimy coat and one of Silvi's delivery chits give +20 to the first Charm, Bribery, or Trade test. Bram inspects the cargo; Elsbeth comes to sign for it, pulling two guards toward the back."));
c.push(bullet("Advantage", "Direct access to H and easy reach of G."));
c.push(bullet("Risk", "The bell wire; the cart gets searched at suspicion 1 or higher."));

c.push(h2("8.4 The roof"));
c.push(body("Easy Climb (+20) from stacked planking at I; Hard Stealth (-10) on the tar; Average Pick Lock (+0) on the hatch. This route comes down behind Oswin on F."));
c.push(bullet("Advantage", "Take the marksman and the bell out of the equation before anyone else moves."));
c.push(bullet("Risk", "A 4-yard fall on the alley side; the hatch creaks if it isn't oiled first."));

c.push(h2("8.5 The pig chute"));
c.push(body("A service passage links D to the eastern pen. Average Animal Care (+0) calms the animals; otherwise an Average Endurance test (+0) avoids 1 Fatigued from the mud and fumes. It comes out behind the buckets, out of sight of C if the inner door stays shut."));
c.push(bullet("Advantage", "No exterior lock, and it's ten yards from G."));
c.push(bullet("Risk", "One person at a time; getting Felix out this way needs a Hard Athletics test (-10)."));

c.push(h2("8.6 Frontal assault"));
c.push(body("With six house guards and a crowd of witnesses, a straight breach is loud in every sense - but it can work, especially with Gunnar. It should force a real decision, not just a fight scene."));
c.push(step("First round", "Bram holds B; Oswin fires from F; Mab grabs the keys and heads for E or G; Elsbeth locks G from inside."));
c.push(step("Second round", "Mab blows her whistle; Oswin targets whoever's closest to G; Bram tries to put an intruder Prone in C."));
c.push(step("Third round", "The nearest guard bolts as a runner. If he gets out, the bounty and the retaliation escalate even if Felix is saved."));
c.push(warning("Don't send a wave of Lowhaven reinforcements mid-fight tonight. Reinforcements are a consequence that lands after the scene, not during it - but a public brawl in front of two dozen witnesses has its own immediate cost regardless."));

c.push(pageBreak());
c.push(h1("9. FELIX AND OPPOSITION PROFILES"));
c.push(h2("9.1 Felix Scite"));
c.push(readAloud("Felix sits against the wall, wrists bound loosely in front of him, sweat still cooling on his skin from the bout. His face is bruised but his eyes track the lock before he looks up at whoever's come through the door. He doesn't ask who sent you. He asks: 'How many doors between here and outside?' Then, quieter, almost to himself: 'It didn't feel like losing.'"));
c.push(body("Felix has been kept sedated, not tortured for sport. He's bruised, dehydrated, and refuses to be treated as merchandise - but there's something new under the exhaustion, a private unease he hasn't named yet even to himself."));
c.push(bullet("Condition", "Use an appropriate Protagonist profile for Felix; halve his current Wounds and apply 2 Fatigued and 1 Poisoned. No armor, no weapon."));
c.push(bullet("First aid", "An Easy Heal test (+20) removes 1 Fatigued. Elsbeth's antidote clears Poisoned after an Average Endurance test (+0), but Felix stays Fatigued until real rest."));
c.push(bullet("Will", "He'll accept help, not being carried like baggage, so long as he can stand. If he recovers a weapon, he covers a retreat rather than chasing his captors."));
c.push(bullet("What he knows", "The house crew's routine; Mab holds the keys; two Watch seats have stood reserved for weeks; Silvi already tried once."));
c.push(bullet("What he won't say yet", "That some part of him is already dreading how ordinary the world outside is going to feel. Play this as a held silence, not a confession - it surfaces later, on his own terms."));
c.push(quote("Felix", "I'll walk out on my own feet. If I go down, you can argue about my dignity while you're dragging me."));

c.push(h2("9.2 Quick WFRP 4e profiles"));
c.push(h3("Mab Lowhaven - halfling pit-mistress"));
c.push(body("M 3 | WS 48 | BS 35 | S 30 | T 38 | I 42 | Ag 43 | Dex 35 | Int 36 | WP 44 | Fel 38 | W 13", { font: "Courier New", size: 19 }));
c.push(bullet("Skills", "Melee (Basic) 58, Dodge 53, Leadership 48, Intimidate 52, Perception 52."));
c.push(bullet("Trappings", "Short sword +7, cudgel +6, leather jerkin (AP 1 body/arms), whistle and keys."));
c.push(bullet("Tactics", "Strike to Stun where possible; spends actions to advance the alarm; falls back with the keys rather than dying."));

c.push(h3("Oswin 'Spike' Lowhaven - halfling marksman"));
c.push(body("M 3 | WS 32 | BS 50 | S 25 | T 32 | I 46 | Ag 44 | Dex 40 | Int 30 | WP 36 | Fel 28 | W 10", { font: "Courier New", size: 19 }));
c.push(bullet("Skills", "Ranged (Crossbow) 60, Perception 56, Stealth 54, Dodge 49."));
c.push(bullet("Trappings", "Crossbow +9 (Reload 1), a second loaded crossbow on F, dagger +5, leather AP 1 body."));
c.push(bullet("Tactics", "Fires from behind the gallery rail; targets lanterns or whoever opens G; flees through the hatch if engaged directly."));

c.push(h3("Bram Heller - human doorman"));
c.push(body("M 4 | WS 46 | BS 28 | S 40 | T 42 | I 32 | Ag 31 | Dex 30 | Int 25 | WP 37 | Fel 25 | W 15", { font: "Courier New", size: 19 }));
c.push(bullet("Skills", "Melee (Brawling) 55, Melee (Basic) 56, Athletics 50, Endurance 52, Intimidate 55."));
c.push(bullet("Trappings", "Cudgel +8, mail shirt AP 2 body, leather AP 1 arms."));
c.push(bullet("Tactics", "Grapples and shoves toward the pit; holds B as long as he isn't alone; surrenders if Mab falls and he's offered a clear exit."));

c.push(h3("Elsbeth Kranz - healer and bookkeeper"));
c.push(body("M 4 | WS 34 | BS 38 | S 30 | T 35 | I 44 | Ag 36 | Dex 45 | Int 46 | WP 38 | Fel 42 | W 11", { font: "Courier New", size: 19 }));
c.push(bullet("Skills", "Heal 56, Perception 54, Intuition 48, Sleight of Hand 49, Melee (Basic) 44."));
c.push(bullet("Trappings", "Knife +6, sling +6, leather AP 1 body, two sedative doses and one antidote dose."));
c.push(bullet("Tactics", "Threatens to destroy the ledger, not Felix. Cornered, she trades antidote, key, and information for a clean way out."));
c.push(gm("None of these four need to die for the PCs to win. Guards test Cool when one of their own falls, when Gunnar smashes through a barrier, or when Felix is freed. Bram and Elsbeth break first."));

c.push(h1("10. EXTRACTION"));
c.push(h2("10.1 Exits"));
c.push(dataTable(
  ["EXIT", "FOR FELIX", "CONSEQUENCE"],
  [
    ["A - street", "Easy, with support", "Most visible; the hog-keepers and Dirk can describe the group afterward."],
    ["I - yard", "Best option", "A cart is available; risk from the runner and the bell wire."],
    ["D - pens", "Hard Athletics (-10)", "A chase across the walkways; mud and stench make Stealth impossible."],
    ["F - roof", "Impossible without rope and help", "Excellent for an infiltrator, terrible for the captive."],
  ],
  [1740, 2520, 5100],
));

c.push(h2("10.2 Chase through the Hog Pens"));
c.push(body("Use three obstacles, then resolve it. The PCs choose who breaks trail, who supports Felix, and who slows the pursuit. One success out of every two attempts is enough to get clear; three failures produce a final confrontation on a walkway platform, not automatic recapture."));
c.push(step("Greasy planking", "Average Agility (+0). A failure imposes Prone or drops a one-handed item."));
c.push(step("The pig gate", "Hard Strength or Animal Care (-10). A failure releases the animals and briefly separates the last PC from the group."));
c.push(step("The nightsoil cart", "Average Drive or Athletics (+0). A success provides a vehicle; a failure means finishing on foot in front of witnesses."));
c.push(bullet("Gunnar", "Can auto-succeed one Strength obstacle if he agrees to take rear-guard and eat one free attack from a pursuer."));
c.push(bullet("Felix", "Can cancel one failure by whoever's supporting him, once - then takes an extra Fatigued and can't do it again."));
c.push(bullet("Silvi", "A Crosses safehouse sits ten minutes off. She heals and scatters the group, but wants to know immediately whether the ledger was taken."));

c.push(h1("11. OUTCOMES AND CONSEQUENCES"));
c.push(h2("11.1 Clean rescue"));
c.push(bullet("Felix", "Returns to the Tin Spur to recover; could become a guest NPC or a witness against the Lowhavens. He owes the PCs a debt, not obedience - and he's not telling them everything yet (see 11.5)."));
c.push(bullet("Silvi", "Acknowledges the PCs succeeded where her own people failed. She provides a safehouse, care, and one concrete favor before the week is out - and confirms the sewer expedition is back on."));
c.push(bullet("Lowhavens", "Lose their poster and tonight's takings. Mercy starts hunting for who tipped the PCs off before ordering open retaliation."));
c.push(bullet("The Circle", "Vielfrass takes a personal interest in whoever cost his Circle an evening. Geldrecht follows his interest without open hostility - yet."));

c.push(h2("11.2 Loud rescue"));
c.push(bullet("Bounty", "If Kaspar is seen or named, Mercy confirms his identity by the next day regardless. Otherwise a bounty forms on the group, or on 'Silvi's people.'"));
c.push(bullet("The Watch", "The local post arrives too late and protects Funke's arrangement first. Proof of the kidnapping, or Wendt's file, can turn that reaction around."));
c.push(bullet("Vielfrass's pretext", "If he was seen and the scene went loud, he has a clean, plausible reason to have Thucydion (and possibly Pieter) detained afterward for 'consorting with an illegal enterprise' - hold this in reserve for the arrest-arc discussion, don't spend it automatically."));
c.push(bullet("Rolf", "A second Lowhaven failure traced back to a leak puts him in danger. Otto hears that a mole still knew the plan; Silas may finally start connecting the dots to his own brother."));
c.push(bullet("The city", "Ottokar can frame this as a champion's rescue or a fresh gang war, depending on who reaches him first."));

c.push(h2("11.3 Negotiated deal"));
c.push(body("The Lowhavens won't sell Felix for an ordinary purse - he's their comeback. They will take a deal that saves face and still guarantees them money."));
c.push(bullet("Gunnar as the poster", "A single voluntary bout, public terms, Felix released before the doors open. Gunnar's call; Silvi wants witnesses."));
c.push(bullet("Another champion", "Pieter or Thucydion could offer a bout, but their Tin Spur contracts make that explosive with Wilhelm Shutteln if it ever surfaces."));
c.push(bullet("A shared target", "Handing over one of the Baron's operations, a stash, or a name is worth more than coin to the Lowhavens - it just moves the violence onto someone else, with a future cost."));
c.push(bullet("Bella", "Her killer's real name buys Felix immediately. A false name buys time and creates a future victim."));

c.push(h2("11.4 Failure without ending the campaign"));
c.push(body("If the PCs are driven off, the Lowhavens move Felix within two hours. A partial success should still leave a thread: a torn ledger page, a marked cart wheel, a hauler's name, a direction toward the docks. The attempt cost time, blood, and quiet, but the thread stays playable."));
c.push(absent("Wellentag 13th, later that night: Felix is moved to a second location before dawn, fed just enough sedative to keep him docile. Bouts continue on the same rolling schedule wherever he ends up - the danger doesn't pause because the PCs weren't there, it just becomes harder to find him again."));

c.push(h2("11.5 What Felix doesn't say"));
c.push(body("Whatever the outcome, once safe, Felix stays quietly grateful and quietly wrong in a way nobody can quite name yet. He'll deflect questions about how the fights felt. This is a long personal thread, not a one-scene reveal - let it surface later, likely through Pieter."));

c.push(pageBreak());
c.push(h1("12. PERSONAL HOOKS AND GM AIDS"));
c.push(h2("12.1 A hook for each PC"));
c.push(bullet("Kaspar", "Otto's contract to kill Felix sits on him the whole scene, unresolved until he acts (or doesn't). A guard at the Cage might recognize his build - avoiding that recognition takes restraint, a disguise, or another PC's help; force alone confirms the suspicion."));
c.push(bullet("Pieter", "Felix knows the weight of a fight turned into spectacle - firsthand, now, in a way he can't fully explain. He'll warn Pieter off the Eisfange bout without asking him to back out, and something in how he says it doesn't sit right."));
c.push(bullet("Thucydion", "Direct, personal contact with Vielfrass for the first time - not distant reputation, an actual conversation and an actual room. The ledger (if taken) ties Vielfrass and Geldrecht to tonight's bout - not proof of a cult, just the first door toward the Circle of Unmarred Flesh."));
c.push(bullet("Ludwig", "Stays dormant this session by design - Elsa's debrief and the Unblinking Eye thread can wait. If he's present, a single ambient detail is enough: Rolf-mole rumors are still spreading quietly in the Dunkelfeucht."));
c.push(bullet("Silas", "Also mostly dormant - but any leak traced to Rolf during the Lowhaven fallout is a live wire he can start to notice, even if he isn't ready to pull on it yet."));
c.push(bullet("Gunnar", "Can be a battering ram, a rear-guard, or the willing bout that solves everything cleanly. Don't reduce him to a combat bonus - his word and his read on cruelty should carry real weight in how the scene resolves."));

c.push(h2("12.2 Ready lines"));
c.push(quote("Mab", "Bella's dead, the Cage is gone, and you've come to take the last thing we have left. Give me one reason to let you walk out with it."));
c.push(quote("Elsbeth", "I gave him enough to sleep, not enough to kill him. Let me out and I'll tell you which bottle wakes him."));
c.push(quote("Gart Funke", "Everyone in my pens feeds something. The pigs, the families, the Watch. Just tell me which one you're planning to starve."));
c.push(quote("Gunnar", "Six guards, four exits, one man to carry. Finally, a conversation with honest numbers."));
c.push(quote("Felix", "I'll thank you properly once we can't smell the pigs anymore."));
c.push(quote("Vielfrass", "You'll forgive me the seat. A man in my position has to keep an eye on public order, and this is about as public as disorder gets."));

c.push(h2("12.3 Launch checklist"));
c.push(bullet("Date", "Wellentag 13th, evening - fight-night security and crowd from the start, no build-up."));
c.push(bullet("Suspicion", "0 in the restricted zones, or 1 if Rolf tipped the Lowhavens off."));
c.push(bullet("Positions", "Bram B; Mab C/F; Oswin F; Elsbeth H/G; Felix G; Vielfrass and Geldrecht in/near L."));
c.push(bullet("Keys", "Mab. Antidote and ledger: H or Elsbeth's satchel."));
c.push(bullet("Ask early", "Get the extraction plan before the first test. If they don't have one, Felix asks for it the moment the door opens."));
c.push(bullet("Corruption", "Minor for witnessing a bout meaningfully; Moderate for fighting one or entering the Loge."));
c.push(bullet("Cost", "Decide who sees the PCs, whether a runner escapes, and what gets left behind to carry Felix."));
c.push(gm("End on one precise image: Felix sets his old belt down on a Tin Spur table; Mercy receives Kaspar's name; Rolf learns a survivor saw his face; or Vielfrass notices a name torn out of his ledger. One image is enough."));

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
      run("The Hog Pit - Rescuing Felix Scite - ", { font: "Arial", size: 16, color: C.grey }),
      new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.grey }),
    ],
  })],
});

const doc = new Document({
  creator: "Ubersreik Campaign",
  title: "Session 16 - The Hog Pit - Rescuing Felix Scite",
  description: "GM guide for the Felix Scite rescue at the Hog Pit, Session 16.",
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
const outputPath = path.join(outputDir, "Session 16 - The Hog Pit - Rescuing Felix Scite.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generated ${outputPath} (${c.length} blocks)`);
