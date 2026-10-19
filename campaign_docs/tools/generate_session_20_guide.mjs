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
  red: "8B1A1A", darkRed: "5C0011", blue: "1F4D78", gold: "7B5200",
  green: "2E5F2E", purple: "5C2D82", teal: "1A5F5F", warm: "6B3A00",
  music: "2D5F8A", ink: "1A1A1A", grey: "555555", white: "FFFFFF",
  stripe: "F8F8F8", blueFill: "E8EEF5", tanFill: "FDF6EE",
  goldFill: "FFF8E1", redFill: "FDE8E8", greenFill: "E0F0E0",
  purpleFill: "F3E8FD", greyFill: "F3F3F3",
};

const PAGE = { width: 12240, height: 15840, margin: 1440, header: 708, footer: 708, content: 9360 };

const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "B8B8B8" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D6D6D6" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D6D6D6" },
};

const run = (text, options = {}) => new TextRun({
  text, font: options.font || "Georgia", size: options.size || 22,
  color: options.color || C.ink, bold: options.bold, italics: options.italics,
  smallCaps: options.smallCaps, break: options.break,
});

const body = (text, options = {}) => new Paragraph({
  style: options.style || "Normal", alignment: options.alignment || AlignmentType.LEFT,
  keepNext: options.keepNext, children: [run(text, options)],
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
  children: [run(`${label} — `, { bold: true }), run(text)],
});

const step = (label, text) => new Paragraph({
  numbering: { reference: "steps", level: 0 },
  children: [run(`${label}. `, { bold: true }), run(text)],
});

const callout = (label, text, options = {}) => new Paragraph({
  shading: { fill: options.fill || C.goldFill, type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 12, color: options.color || C.gold, space: 7 } },
  indent: { left: 320, right: 160 },
  spacing: { before: 80, after: 100, line: 260 },
  children: [
    run(`${label} — `, { font: "Arial", size: 20, bold: true, color: options.color || C.gold }),
    run(text, { size: 21, italics: options.italics }),
  ],
});

const gm = (text) => callout("GM", text, { fill: C.goldFill, color: C.gold });
const warning = (text) => callout("WARNING", text, { fill: C.redFill, color: C.red });
const absent = (text) => callout("IF THE PCs ARE NOT THERE", text, { fill: C.purpleFill, color: C.purple });
const music = (text) => callout("MUSIC", text, { fill: C.blueFill, color: C.music });

const readAloud = (text) => new Paragraph({
  shading: { fill: C.tanFill, type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 14, color: C.warm, space: 8 } },
  indent: { left: 420, right: 240 }, spacing: { before: 80, after: 100, line: 264 },
  children: [run(text, { italics: true, color: "3A2010" })],
});

const timeBox = (text) => new Paragraph({
  shading: { fill: C.greenFill, type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 14, color: C.green, space: 7 } },
  spacing: { before: 120, after: 100, line: 260 }, keepNext: true,
  children: [run(text, { font: "Arial", size: 24, bold: true, color: C.green })],
});

const quote = (speaker, text) => new Paragraph({
  indent: { left: 520, right: 280 }, spacing: { before: 60, after: 80, line: 260 },
  children: [
    run(`${speaker}: `, { font: "Arial", size: 20, bold: true, color: C.darkRed }),
    run(`“${text}”`, { size: 21, italics: true }),
  ],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const cellParagraph = (text, options = {}) => new Paragraph({
  spacing: { before: 0, after: 0, line: 232 }, alignment: options.alignment || AlignmentType.LEFT,
  children: [run(String(text), {
    font: options.font || "Georgia", size: options.size || 20,
    bold: options.bold, color: options.color || C.ink,
  })],
});

const dataTable = (headers, rows, widths, alignments = []) => new Table({
  width: { size: PAGE.content, type: WidthType.DXA }, indent: { size: 120, type: WidthType.DXA },
  layout: TableLayoutType.FIXED, columnWidths: widths,
  margins: { top: 55, bottom: 55, left: 120, right: 120 }, borders,
  rows: [
    new TableRow({
      tableHeader: true, cantSplit: true,
      children: headers.map((header, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        shading: { fill: C.blueFill, type: ShadingType.CLEAR },
        margins: { top: 55, bottom: 55, left: 120, right: 120 },
        children: [cellParagraph(header, {
          font: "Arial", size: 18, bold: true, color: C.blue,
          alignment: alignments[index] || AlignmentType.LEFT,
        })],
      })),
    }),
    ...rows.map((row, rowIndex) => new TableRow({
      cantSplit: true,
      children: row.map((value, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        shading: { fill: rowIndex % 2 ? C.stripe : C.white, type: ShadingType.CLEAR },
        margins: { top: 55, bottom: 55, left: 120, right: 120 },
        children: [cellParagraph(value, {
          bold: index === 0, color: index === 0 ? C.darkRed : C.ink,
          alignment: alignments[index] || AlignmentType.LEFT,
        })],
      })),
    })),
  ],
});

const labelDetailTable = (rows) => dataTable(
  ["ITEM", "AT THE TABLE"], rows, [2160, 7200],
  [AlignmentType.LEFT, AlignmentType.LEFT],
);

const diagram = (lines) => new Paragraph({
  shading: { fill: C.greyFill, type: ShadingType.CLEAR }, border: borders,
  indent: { left: 120, right: 120 }, spacing: { before: 60, after: 100, line: 220 },
  children: lines.map((line, index) => run(line, {
    font: "Courier New", size: 17, color: C.ink, break: index === 0 ? undefined : 1,
  })),
});


const c = [];
const section = (title) => { c.push(new Paragraph({ style: "CampaignHeading1", pageBreakBefore: c.length > 0, children: [run(title, { font: "Arial", size: 30, bold: true, color: C.red })] })); };

const recap = [
  "Franz gathered you for his birthday. Four enemies were coming to wish him many happy returns: a Dwarf Slayer, a ratman assassin, seven men from the Border Princes, and a spectre out of the sands of Nehekhara. You took your posts: Pieter in Franz’s room, Thucydion upstairs, Kaspar hidden in an alcove of the main hall, Ludwig in the kitchen by the fuse, Silas outside, dressed as a beggar.",
  "Thucydion, Cordelia had given you a pinch of silver powder. Thanks to it, Kaspar, Ludwig and Franz struck the spectre the moment it manifested. Tah-Ra Mentuhr is no more.",
  "Pieter, the assassin came in through Franz’s window. You never heard him. His blade found your back — but you held, and Thucydion reached you. Together, you killed him.",
  "Kaspar, the Slayer broke down the door. You faced him alone. When he fell, you could barely stand.",
  "Then Carmello’s men struck: three upstairs, four for Franz. Ludwig lit the fuse and ran to defend the innkeeper. Thucydion came down just in time to cut down the last attacker. Silas burst in from the street, and you carried Franz outside, unconscious.",
  "Behind you, the Red Moon heaved up in a roar of thunder, then collapsed into flame. One of Carmello’s men had fled just before. The others are burning with the inn.",
  "You stand in the night, covered in blood and soot. Three of you can barely stay on your feet. Franz hasn’t woken. And all around you, the city begins to scream."
];

// ─────────────────────────────────────────────────────────────
section("SESSION 20 — ASHES AND ACCOUNTS");
c.push(body("Aubentag 14th Sigmarzeit, 22:00 → Marktag 15th, late afternoon", {font:"Arial",size:28,bold:true,color:C.darkRed}));
c.push(timeBox("3H30 AT THE TABLE • FIVE PLAYERS • THIRD FIRE, FOUR DAYS BEFORE SIGMARTAG"));
c.push(readAloud("Ubersreik is burying its dead. This time, it isn’t only the poor."));
c.push(labelDetailTable([
["Opening","Outside the burning Red Moon, seconds after the blast. Franz unconscious (1 Wound). Thucydion holds Saif al-Janub."],
["PC state","Kaspar 1/15 • Pieter 1/28 • Ludwig 1/10 • Thucydion 12/23 • Silas unhurt. Corruption: Ludwig 6/6 (at threshold), Pieter 7/8, Silas 6/7, Thucydion 4/9, Kaspar 2/7."],
["Healing","GM decision: only Silas’s Heal tests and one night of rest. No priests, no free potions. The weight of their adventures must be felt — Pieter fights Eisfange tomorrow."],
["Tone","The price of their actions. Screams, then mourning. The city lives without them: guilds, bread, preachers, the Watch."],
["Target ending","Late afternoon on the 15th: the evening bells. Ludwig and Silas leave for the Poetry Circle, Pieter for Friedrich’s soirée."],
["Secrets","Franz is Emmanuelle Nacht’s agent; if he escapes, he recommends the PCs by name. The Baron backs K&H (Werner’s grain). The PCs don’t know the Barracks plan."],
]));
c.push(h2("Navigation"));
c.push(body("2 Recap • 3 Pacing • 4 The Screams • 5 The Boatmen’s Boathouse • 6 The Night • 7 A City in Mourning • 8 Silvi • 9 Engel • 10 Ricker and the Pious Cup • 11 Ursula • 12 End of Session • 13 New NPCs • 14 Music • 15 Tracking • 16 Player Handout: the Herald."));
c.push(warning("Do not soften the toll. Seven dead among the neighbours, a dozen burned. Nobody will tell the PCs it wasn’t their fault — and nobody will say it was out loud either, unless they bring it up themselves."));

// ─────────────────────────────────────────────────────────────
section("2. PREVIOUSLY…");
c.push(timeBox("0:00–0:08 AT THE TABLE • READING: ABOUT 3 MINUTES"));
for (const p of recap) c.push(readAloud(p));
c.push(gm("Address the individual paragraphs directly to Thucydion, Pieter and Kaspar. Reveal nothing about the fleeing goon beyond what the PCs saw (a man running off before the blast)."));

// ─────────────────────────────────────────────────────────────
section("3. RUNNING THE THREE AND A HALF HOURS");
c.push(dataTable(["TABLE","IN THE FICTION","PRIORITY"],[
["0:00–0:08","22:00, the 14th","Recap."],
["0:08–0:35","22:00 → midnight","The Screams: Perception, the street, the choice to help. Franz at the boathouse, payment, farewell."],
["0:35–0:45","Night","Lodging, Silas’s Heal tests, rest. Optional micro-scene."],
["0:45–1:10","Dawn → 9:00","City in mourning: processions, the Herald, rumours, Pfeffer’s announcement, Melina."],
["1:10–1:55","Late morning","Silvi: true intel, disinformation, reneging on Kaspar’s deal, Otto."],
["1:55–2:20","Noon","Engel at Cordelia’s: warpstone, four items."],
["2:20–3:20","Early afternoon","Tailing Ricker, the sermon, the Pious Cup, Ursula and her deal."],
["3:20–3:30","Late afternoon","Evening bells, final image, wrap-up."]
],[1800,2700,4860]));
c.push(h2("If the table runs late"));
c.push(bullet("Past 0:45 and still in the night","Summarise the walk to lodgings; one Heal test per wounded PC, played fast."));
c.push(bullet("Past 2:00 and still at Silvi’s","Hand over the dossier without haggling; push the private Kaspar conversation to a two-minute aside at the end of the session."));
c.push(bullet("Engel","Can be reduced to a letter and a parcel handed over by Cordelia (see section 9)."));
c.push(bullet("Ursula","Never cut her: she is the choice that structures the 16th. If time is short, Ursula comes to them rather than letting the tail run long."));
c.push(absent("All players are present. The purple boxes cover characters who skip a scene: the city, Silvi, Engel and Ursula act regardless."));

// ─────────────────────────────────────────────────────────────
section("4. THE SCREAMS");
c.push(timeBox("AUBENTAG 14TH, 22:00 • 15 MINUTES AT THE TABLE"));
c.push(readAloud("The heat shoves at your backs like a hand. Tiles rain onto the cobbles. The house next door — the cooper’s, with its iron hoops hanging from the sign — has no front wall anymore: you can see its kitchen, its table laid for supper, a staircase that leads nowhere. Someone is screaming a name. Always the same one. Further off, Watch whistles, and the first bucket passing from hand to hand."));
c.push(h2("Perception test (Challenging +0), group"));
c.push(labelDetailTable([
["Success","The PCs spot a widow at her window and two stable boys watching them carry Franz. They can avoid them, pay them or threaten them."],
["Failure","They see nothing. The witnesses will say: “a tall elf with a curved sword” and “a giant carrying a dead man.” Saif al-Janub is the most recognisable object in the city tonight."],
["Failure by 3+ SL","Ottokar Stiegler is among the witnesses, notebook in hand. The description will appear in the morning Herald."],
]));
c.push(gm("If the PCs hide the blade, wrap it, or split from Thucydion, a failure only yields “people covered in soot” — like a hundred others tonight. Reward caution, not luck."));
c.push(h2("The toll: small burghers"));
c.push(body("The Red Moon stood in the heart of the city. Its neighbours were neither paupers nor nobles: shopkeeping craftsmen, people who paid their taxes and their tithes."));
c.push(dataTable(["VICTIM","WHAT THE PCs CAN SEE OR LEARN"],[
["Master Anselm Brückner, cooper","Survives, hands burned. His wife Dora and his two apprentices (Lutz, 14; Matthes, 16) died under the collapsed staircase."],
["Widow Hedwig Rosshaupt, lacemaker","Dead with her maidservant on the floor that caught fire. Her lace shop burns like tinder."],
["A night watchman","Crushed by a falling chimney while trying to force a door open."],
["A dozen burned","Among them little Jost Brückner, 9 — his is the name his aunt is screaming."],
],[3000,6360]));
c.push(body("Final toll: seven dead, a dozen burned, four houses lost. Reveal it progressively, never all at once."));
c.push(h2("The choice: help or leave"));
c.push(body("Don’t present it as a choice. Describe the child, the aunt, the bucket chain. Wait for the players to speak."));
c.push(h3("If they help"));
c.push(bullet("The cost","For each 10 minutes spent on site: a Cool test (Easy +20, then Average +0, then Challenging −10) when the Watch arrives and starts questioning. On a failure, a sergeant notes their faces and names."));
c.push(bullet("Silas — triage","Jost is badly burned. Saving him takes a Hard (−20) Heal test. On a failure, he dies in Silas’s hands. Every Heal test spent here is a bandage and an effort his friends won’t get — the party’s wounded can only be treated with later, wearier tests (−10 to the first test of the night)."));
c.push(bullet("If Jost lives","Master Brückner grips Silas’s hand and won’t let go. “I don’t know your name. I will.” The Herald will speak of an “unknown barber.” A double-edged fame."));
c.push(bullet("Franz","He stays in someone’s arms. The longer they wait, the more likely he is recognised: his false death only holds if he vanishes tonight."));
c.push(h3("If they leave"));
c.push(body("No mechanical penalty. The name follows them to the end of the alley, then drowns in the noise. In the morning they will learn whose it was (section 7)."));
c.push(quote("Jost’s aunt","Jost! JOST! Somebody! He was in the upstairs room, somebody!"));
c.push(warning("No miracle exit. If nobody goes up, a neighbour pulls Jost out later, burned over half his body; he dies within the week (announced on the 16th or later). If he is saved, he keeps his scars."));
c.push(music("Street: This War of Mine — main theme (Piotr Musiał), or Frostpunk — “The City Must Survive.” Collapsed house: Chernobyl — “Bridge of Death” (Hildur Guðnadóttir). No heroic music."));

// ─────────────────────────────────────────────────────────────
section("5. THE BOATMEN’S BOATHOUSE");
c.push(timeBox("22:30–MIDNIGHT • 10 MINUTES AT THE TABLE"));
c.push(body("Through the rear yards, the Boatmen’s Guild boathouse is only a few minutes away. No Stealth test unless they lingered: the Watch is looking at the fire, not the back yards. One possible encounter if the PCs helped for long: a two-man patrol asking “you coming from over there?” — Cool or Charm (Average +0)."));
c.push(readAloud("The boathouse smells of tar and stagnant water. A rowing boat waits, moored, a shuttered lantern at the bow. A boatman with tattooed arms asks no questions. When you lay Franz down on the planks, he coughs, spits soot, opens one eye. “I missed my birthday,” he says. Then he laughs, and it hurts."));
c.push(body("Franz pays: 10 GC for the group. He waves at Thucydion to keep the blade."));
c.push(quote("Franz","Keep it. It defended Sudenburg. It’s earned the right to serve someone who doesn’t run."));
c.push(quote("Franz","I’ve spent my life dying for other people, and tonight it was finally the right time. Thank you."));
c.push(quote("Franz","Listen. There are people, far from here, who like to know who does good work. Maybe they’ll hear about you. Maybe not. Don’t ask me who."));
c.push(gm("Do not name Nacht. If pressed, Franz smiles: “An old sellsword has friends as old as he is.” If a PC mentions Carmello’s fleeing goon, Franz darkens: “Then I’ll stay dead longer than I planned.” He still gives the sword."));
c.push(body("Saif al-Janub: sabre of Best quality (Fast). No magical properties."));
c.push(body("The boat slips away on the Teufel, lightless. Franz Lohner has died for Ubersreik."));
c.push(music("Silence during the farewell; then The Last of Us — “The Path” (Gustavo Santaolalla) as the boat pulls away."));

// ─────────────────────────────────────────────────────────────
section("6. THE NIGHT");
c.push(timeBox("MIDNIGHT → DAWN • 10 MINUTES AT THE TABLE"));
c.push(h2("Where to sleep?"));
c.push(body("The Red Moon was their base. Let the players choose. Kaspar, Ludwig and Silas can return to the Dunkelfeucht; Thucydion and Pieter need a roof."));
c.push(dataTable(["PLACE","WHAT AWAITS THEM"],[
["The Tin Spur (fighters’ dormitory)","Free thanks to Pieter’s and Thucydion’s contracts. Gerd the armourer grumbles, Greta Haldane watches in silence. Gunnar often sleeps there. In the morning Shütteln frets over Pieter: “Tomorrow we’ve got the duchess and half the lodges. Can you even stand?”"],
["The Bridge House Inn","5 s per person. Giordano Impiegato is having breakfast there and renews his offer: the Bastards of the Reik plus everything he knows about the Skaven for 20 GC. Emilia is gone."],
["The Dunkelfeucht","Baron’s territory. Optional: Rolf, arm in a sling, runs into Silas and asks a strange question (“You heard what they’re saying, about a rat among us? You’d tell me, right, if they were talking about me?”). Don’t push it."],
["The Rat Catchers’ Guild","Wahlund takes them in without a word. Günther sleeps in a locked cellar. Melina delivers the section 7 message that same night."],
],[2700,6660]));
c.push(h2("Healing and rest"));
c.push(bullet("Silas’s Heal tests","One test per patient for these wounds. Success: the patient recovers Silas’s Int Bonus + SL Wounds. −10 to the first test if he tended civilians, and if he has no clean bandages left."));
c.push(bullet("Rest","After a night in a real bed: Endurance test, recover TB + SL Wounds (minimum 1 on a success). Straw or bare floorboards: −10."));
c.push(bullet("Pieter","Even with the best results, he won’t be whole for Eisfange. That’s intended. Offer him nothing."));
c.push(bullet("Silas","He sleeps four hours. If he tried to save Jost, he keeps seeing the boy. No mechanical effect, unless the player wants a Fatigued condition in exchange for a scene."));
c.push(music("Arvo Pärt — “Spiegel im Spiegel,” very low, or nothing."));

// ─────────────────────────────────────────────────────────────
section("7. A CITY IN MOURNING");
c.push(timeBox("MARKTAG 15TH, DAWN → 9:00 • 25 MINUTES AT THE TABLE"));
c.push(readAloud("The smoke didn’t leave with the night. It hangs over the roofs, grey, and every breath tastes of wet wood. On the road to Morr’s Garden, a cart passes at a walk, pulled by a donkey: four bodies under a sheet, four pairs of feet sticking out. Behind it, a woman in black walks without crying. The shops are open, because people still have to eat. But nobody is calling out the price of bread."));
c.push(h2("What the city is saying"));
c.push(body("Feed these in as the PCs move around. None depends on them; several concern them."));
c.push(dataTable(["WHERE","WHAT’S HAPPENING"],[
["Morr’s Garden","Three funeral processions this morning. The gravediggers have been digging since dawn: the Hog Pit, the Wandiene Rookery, and now the Brückners. An exhausted priest of Morr: “Three fires in a week. We had no room left for the poor, and now we have to find some for the others.”"],
["Coopers’ Street","The coopers’ guild drapes its door in black for Dora Brückner and the apprentices. A petition is circulating: the guilds demand the Council remove Captain Pfeffer."],
["Temple of Shallya","The courtyard is full of burned people lying on straw. The priestesses are short of linen. Célestine Hoch collects alms in the street."],
["Strohmann Markt","Bread has doubled in three days. Bakers blame the millers, who blame “a buyer who takes all the grain at the quay, in bulk, and pays in cash.” Nobody knows who."],
["Sprichstumpf","Anton Grimski harangues: “Their pumps only put out fires in the Altmarkt! It took burghers burning before anyone remembered we had buckets!”"],
["Red Moon ruins","A Watch cordon. Onlookers. They say the innkeeper died inside “with his enemies” — rumour has already made him romantic."],
["Everywhere","Watch posters: 5 GC reward for any information on “the arsonist.” If Perception failed: mention of an elf with a curved sword."],
],[2160,7200]));
c.push(gm("The grain: Werner is buying it to feed K&H and the Skaven. Silvi will mention it (section 8). An attentive player can link Werner, Günther and the sack from the dead drop. Don’t underline it."));
c.push(h2("The Herald — special edition"));
c.push(body("A crier sells Ottokar’s sheet. Hand out the player handout (section 16). Adapt the last paragraph to last night’s Perception test and Silas’s possible help."));
c.push(h2("The Watch announcement"));
c.push(readAloud("On the square, a Watch sergeant unrolls a parchment, flanked by four armoured men who look like they spent the night hauling buckets. “By order of Captain Andrea Pfeffer! On Sigmar’s Day, Konigstag the eighteenth, the Watch of Ubersreik will be reviewed before its Barracks, in the presence of the Captain, for the blessing of its arms and the safety of the city! Citizens are invited to attend!” Someone in the crowd shouts: “She should bless our buckets instead!” Bitter laughter."));
c.push(warning("This is the most important clue of the session: the exact date and place where Pfeffer will be exposed. The PCs know she is the likely target. Don’t make the link for them. If nobody reacts, remind them with a poster on the Pious Cup’s door at the end of the session."));
c.push(h2("Melina"));
c.push(body("Melina finds them at their lodging, or on their way. She looks drawn."));
c.push(quote("Melina","Wahlund wants to go down by Bezahltag dawn at the latest. The lads hear digging under the Altmarkt. Things are moving. Getting closer to something. We won’t go without you, but we won’t wait for Sigmartag."));
c.push(body("Fix the rendezvous with them: place and time. Note it. Anders has his arm in a splint but can hold a torch; Mårten walks; Rickard limps; Wahlund is gaunt but determined. Gunnar will come."));
c.push(absent("If nobody sets a rendezvous: Melina repeats the ultimatum. If the PCs aren’t at the Guild at dawn on the 17th, the expedition leaves without them (a future consequence, not before)."));
c.push(music("Dead Can Dance — “The Host of Seraphim,” or Allegri — Miserere (as a procession chant). Market: Pentiment (Alkemie) or Kingdom Come: Deliverance (Jan Valta)."));

// ─────────────────────────────────────────────────────────────
section("8. SILVI — SETTLING ACCOUNTS");
c.push(timeBox("LATE MORNING • THE CROOKED HAMMER • 45 MINUTES AT THE TABLE"));
c.push(readAloud("The Crooked Hammer hasn’t opened its shutters. Old Hamm lets you in by the side door, looks you up and down — the soot, the bandages — and says nothing. Silvi sits by the cold hearth, a bundle of papers on her knees. In a corner, Hieronymus shuffles a deck of cards without ever looking at his hands. “Sit down before you fall down,” says Silvi. “You smell of smoke. The whole city smells of smoke.”"));
c.push(gm("Silvi’s goals, in order: (1) earn their trust with three verifiable truths; (2) slip in two false leads meant for the Baron; (3) go back on her deal with Kaspar and turn him against Otto. She mentions the Red Moon only once, drily: “Three fires. I won’t ask which ones.”"));
c.push(h2("A. What’s true"));
c.push(dataTable(["INTEL","WHAT SHE SAYS","CHECK"],[
["Werner’s grain","“Werner the Eel is buying grain by the cartload at the quay. More than the whole gang could eat in a year. I don’t know who for. It worries me more than it should.”","Dockers, millers, Günther (the sack!)."],
["Lowhaven debts","“The Hog Pit was their golden goose. Prosperity is negotiating a delay with Signora Bettina Albertini, a Tilean moneylender on the Marktplatz. They have money for a week, maybe two.”","Albertini herself, her clerk, or Juniper (Prosperity’s assistant)."],
["The guilds vs Pfeffer","“The guilds want her head and the Council is starting to listen. If she falls, her replacement will be a Council man.”","The petition, Coopers’ Street."],
],[1900,4960,2500]));
c.push(h2("B. What’s false — for the Baron"));
c.push(body("Silvi never says “pass this on.” She talks in front of Ludwig (Elsa’s man) and Kaspar (Otto’s man), and lets things happen."));
c.push(h3("1. The relief from Altdorf"));
c.push(quote("Silvi","Mercy has called her daughter home. Hope Lowhaven is coming from the Altdorf branch on the barge Margarethe, Bezahltag at noon. With “cooks.” The Halflings aren’t finished."));
c.push(labelDetailTable([
["The truth","Hope really is coming on the Margarethe — with a lawyer and two servants. No fighters."],
["Intended effect","The Baron holds men on the docks on the 17th and delays his final push: 48 hours gained for the Lowhavens."],
["Check","The Boatmen’s Guild (Franz’s friends) knows the passenger list. A PC who asks learns it easily: the threat is hollow."],
["Risk","If the PCs reveal it to Elsa or Otto, Silvi loses face and trust drops. If the Baron attacks the barge, civilians die."],
]));
c.push(h3("2. The Lowhaven dossier, doctored"));
c.push(body("She finally hands over the dossier: names, roles, family ties (see DRAMATIS PERSONAE). All accurate, except two points."));
c.push(bullet("The lie","Pip Shufflepig’s warehouse, south quay of the Teufel, is presented as “the clan’s strongbox.” In reality: ordinary stock, badly counted."));
c.push(bullet("The omission","Cora’s safe house above Satrioli’s — the real strongbox — isn’t in it."));
c.push(bullet("The trap","If the Baron’s men hit the warehouse, Silvi will have the Watch tipped off: they’ll run into a patrol. The Baron loses men for nothing."));
c.push(warning("Silvi is no saint. Pip and his dockers are exposed, and she knows it. If a PC reproaches her: “Pip is a fool. Better a wounded fool than a dead clan and a Baron who rules alone.”"));
c.push(absent("If Ludwig passes nothing to Elsa: the false relief still reaches the Baron through Hieronymus, who plays cards with Otto’s bookkeeper — but only on the 17th. Same if Kaspar says nothing to Otto."));
c.push(h2("C. Kaspar’s deal"));
c.push(body("Silvi asks to speak to Kaspar alone. If he refuses, she says it in front of everyone."));
c.push(quote("Silvi","I won’t give you a Lowhaven lieutenant. It would finish them, and a Baron without a rival is worse than anything you can imagine. Felix comes out tomorrow, as planned."));
c.push(body("Let Kaspar react. Then:"));
c.push(quote("Silvi","But your problem isn’t Felix. It’s Otto. At the Cage, in front of six witnesses, he said: “The kid brings me Scite’s head, or his own.” He was drunk, but he said it."));
c.push(quote("Silvi","Otto keeps two ledgers. The one the Baron sees, and the other. The Cage brings in more than he says. Hieronymus played cards with his bookkeeper. Ask him."));
c.push(labelDetailTable([
["True / false","Otto’s line: half true (he said it drunk, not quite meaning it). The second ledger: true, kept in Otto’s office at the Gilded Cage. The bookkeeper: Kurt Pfennig."],
["Hieronymus","Confirms, but only if paid (1 GC) — and he takes obvious pleasure in seeing Ludwig in the room. “Ryan von Mounir. Still in debt to someone?”"],
["Kaspar’s ways out","(a) Expose Otto to the Baron, through Elsa or Werner, proof in hand; (b) kill Otto before Felix reappears; (c) flee. Silvi hopes for (b) without saying so."],
["What Silvi gains","Otto is the lieutenant most bent on finishing the Lowhavens. Without him the Baron loses his hammer — and Kaspar, who owes the Crosses everything, can take his place."],
["Deadline","Otto learns of Kaspar’s failure only on the 16th, when Felix reappears in public — unless someone tells him sooner."],
]));
c.push(gm("If Kaspar asks outright, “You want me to kill him?”, Silvi answers: “I want you to stay alive. I’m telling you what I know. The rest is your business.” She will never say “kill him.”"));
c.push(h2("Ludwig and Silvi"));
c.push(body("Silvi hasn’t forgotten the word “coward.” One line, only one: “You called me a coward, Ryan. Look at what I’m giving you. Cowards don’t take this kind of risk.” Then she moves on."));
c.push(music("Disco Elysium — “Whirling-In-Rags, 8AM” (British Sea Power) in the background; Sherlock Holmes (2009) — “Discombobulate” (Hans Zimmer) for the Kaspar conversation, very low."));

// ─────────────────────────────────────────────────────────────
section("9. ENGEL — WARPSTONE");
c.push(timeBox("NOON • CORDELIA’S APOTHECARY • 25 MINUTES AT THE TABLE"));
c.push(body("A street kid brings Thucydion (or the group) a note: “Cordelia has your order. Come at noon.” She takes them into the back room. A man in a grey coat waits, hood down. Christoph Engel has only a few minutes."));
c.push(readAloud("He doesn’t sit. On the table, among the mortars and jars, he has set down a grey box no bigger than a jewel case — and yet Cordelia struggled to carry it. “What you saw beneath the city,” he says, “has a name. I’d rather it didn’t.”"));
c.push(h2("What he explains"));
c.push(quote("Engel","It’s called warpstone. A green stone that glows in the dark and rots everything it touches — flesh, metal, mind. The ratmen feed on it, trade with it, fight with it."));
c.push(quote("Engel","Blackpowder laced with warpstone doesn’t destroy a building. It erases it, along with everything living around it. If your rats have put it in those stolen fireworks, there aren’t enough buckets in the whole city."));
c.push(gm("Engel doesn’t know the target. If the PCs mention Pfeffer’s review at the Barracks on Sigmar’s Day, he goes silent for a long moment: “A full square. A feast day. I couldn’t have chosen better.” He cannot go to Pfeffer: a wizard who announces a bombing on the eve of Sigmartag ends up on a pyre, not in a guardroom."));
c.push(h2("What he gives"));
c.push(dataTable(["ITEM","EFFECT"],[
["The lead coffer and its engraved tongs","Lets them carry a warpstone fragment or a piece of the device with no Corruption risk. “Bring me a piece. I’ll know where it came from.”"],
["Three lead talismans (grey ward)","The wearer ignores ONE Corruption gain caused by warpstone, then the talisman crumbles. Three talismans for five PCs: let the group choose. Ludwig is at 6/6."],
["A vial of grey mist (single use)","Unstoppered, it fills a corridor with fog for about 20 yards for 1d10 rounds. Skaven can neither see nor smell inside it: no sight- or smell-based Perception test to spot anyone within. The escape tool they’ve always lacked."],
],[3000,6360]));
c.push(quote("Engel","I can’t go down with you. I’ve been watched since the business at the tower. But if you come back up with what they’re building, I’ll know how to unmake it."));
c.push(absent("If Thucydion doesn’t go, or nobody comes: Cordelia hands them the parcel that evening with a letter from Engel giving the explanation in three lines. Same items, but they lose Engel’s reaction to Pfeffer’s review."));
c.push(warning("Corruption: remember that Ludwig triggers the threshold procedure on his next gain. Don’t tell him outright; let him feel it through Engel’s insistence: “Whoever has the least steady hands should wear this one.”"));
c.push(music("Hollow Knight — “Soul Sanctum” (Christopher Larkin), or Arcanum (Ben Houge’s string quartet), or Return of the Obra Dinn (Lucas Pope)."));

// ─────────────────────────────────────────────────────────────
section("10. RICKER AND THE PIOUS CUP");
c.push(timeBox("EARLY AFTERNOON • 35 MINUTES AT THE TABLE"));
c.push(body("Pieter leads; the others will probably follow. Ricker leaves the Temple earlier than expected: at the start of the afternoon, by a side door onto the Sigmarplatz, alone, in a preacher’s grey robe."));
c.push(h2("The tail"));
c.push(bullet("Test","Shadowing opposed by Ricker’s Perception (40). One test per leg: three legs (the square, Morr’s Garden, the alley)."));
c.push(bullet("Pieter","A wounded giant blends in poorly: −10, unless he melts into a funeral procession (reward the idea)."));
c.push(bullet("Two failures","Ricker knows he’s followed. He doesn’t run: he preaches louder, surrounded by the faithful, and walks into the Pious Cup by the front door, smiling."));
c.push(h2("The sermon"));
c.push(body("At Morr’s Garden, Ricker stops at Dora Brückner’s fresh grave. About thirty people."));
c.push(readAloud("He doesn’t raise his voice. He doesn’t need to. “Three fires in a week. First the poor, and you said nothing. Then the underworld, and you said: that’s their business. And now an honest woman of the coopers’ guild lies in the earth. Sigmar does not punish at random, brothers. He punishes the city that tolerates, a few streets from His Temple, the tower of a grey sorcerer.” An old woman makes the sign of the hammer. A man spits on the ground and says: “Engel.”"));
c.push(gm("The PCs’ fires feed the zealots’ propaganda against Engel. If a PC contradicts him publicly, the crowd turns on them (Hard −20 Charm to avoid being shoved about). Ricker is polite, sorry, merciless."));
c.push(h2("The Pious Cup"));
c.push(readAloud("A tea room two streets behind the Temple. Lace curtains, pots of geraniums, a painted sign: a cup and a hammer. Through the window you see old women in black serving infusions to the faithful. Ricker goes in. The bell tinkles."));
c.push(body("Pieter, and only he, glimpses a figure at an upstairs window: braided hair, a thinner face. Ingrid. Their eyes meet for a second. The curtain falls."));
c.push(warning("Ingrid shows herself to Pieter only in flashes. Don’t resolve this thread today. If the PCs go in now, Hannah and Ingrid leave by the back yard before they reach the stairs."));
c.push(h3("If they go in right away"));
c.push(bullet("The room","Six old women, four faithful, Ricker. No visible weapons. Any violence is a public scandal two streets from the Temple."));
c.push(bullet("Ricker","“Looking for someone, my son? Here we pray for the victims of the fires. You smell of smoke, by the way.” He has recognised them for what they are."));
c.push(bullet("Consequence","If they force their way upstairs: Ricker cries assault; the Temple will lodge a complaint; the Watch, already on alert, is looking for men who “smell of smoke.”"));
c.push(music("Sicario — “The Beast” (Jóhann Jóhannsson) for the tail; Prisoners (Jóhann Jóhannsson) as an alternative; total silence in the tea room, only the bell."));

// ─────────────────────────────────────────────────────────────
section("11. URSULA — THE DEAL");
c.push(timeBox("EARLY → MID AFTERNOON • 25 MINUTES AT THE TABLE"));
c.push(body("Ursula Marbad has been following them since the sermon. She shows herself when they hesitate outside the Pious Cup: sitting on the rim of a fountain, rusty pistol at her side."));
c.push(gm("New reading of Ursula (player feedback): not a suspicious lone investigator, but a cold manipulator. She knows exactly what she wants and what they’re worth. She doesn’t lie; she chooses what she says and when."));
c.push(readAloud("“A giant following a priest through a graveyard,” she says without turning round. “I saw you before he did.” She stands. Up close, the scar drags her mouth downward, as if she were always about to say something unpleasant. “You’re looking for the girl. I know where she sleeps, with whom, and why she doesn’t go out anymore. I also know how your friend Jannik died. And who killed him.”"));
c.push(h2("Her offer"));
c.push(quote("Ursula","You give me the Circle. I give you the Cup, the girl, and the name."));
c.push(quote("Ursula","Kessel’s Chandlery. Tomorrow night, after the fight at the Tin Spur, Vielfrass and his men will be celebrating their champion’s win or drowning his loss. They’ll be drunk, and they’ll be there. I have a mandate. You have swords. Nobody will see me fight the Watch. Nobody will look at you — you’re already arsonists."));
c.push(labelDetailTable([
["What she brings","The Chandlery’s layout (two entrances, a quay, a cellar where the idol rests), their numbers (8 to 12), and her witch hunter’s mandate to cover the affair afterwards."],
["What she wants","Vielfrass dead or captured, the idol destroyed in front of her, and no trace of her in the fight."],
["What she pays","Afterwards: the name of Jannik’s killer (Hannah Baumann), the location of Ingrid’s room, the hour the Cup is empty of the faithful."],
["What she hides","She was there when Jannik died and did nothing. She will never volunteer it."],
["Down payment","Pieter can demand proof: Charm or Intimidate opposed by her Cool (55). Success: she lets slip the name, “Baumann,” and nothing more."],
]));
c.push(quote("Ursula","I’m not asking you to trust me. I’m asking you to do the arithmetic."));
c.push(h2("The choices"));
c.push(bullet("Accept","The 16th becomes: Pieter vs Eisfange, Felix’s reappearance, Kaspar’s deadline, then the Chandlery assault that night. Dawn on the 17th: the expedition. The 18th: the Barracks. Spell it out if the players hesitate — it’s their week."));
c.push(bullet("Refuse","Ursula shrugs: “Then I’ll find other swords, and you’ll look for the girl on your own.” She won’t speak to them again until after the 18th."));
c.push(bullet("Negotiate","She’ll shift by one day at most. Not the evening of the 17th: “On Sigmar’s eve they’ll be at the Temple, like good believers.”"));
c.push(warning("Tight calendar: if the assault happens on the night of the 16th, the PCs go into the sewers on the 17th carrying that night’s wounds. Don’t spare them; it’s the price of saying yes to everything."));
c.push(music("The Witch (Mark Korven), or There Will Be Blood — “Open Spaces” (Jonny Greenwood), or The Name of the Rose (James Horner)."));

// ─────────────────────────────────────────────────────────────
section("12. END OF SESSION — THE EVENING BELLS");
c.push(timeBox("LATE AFTERNOON • 10 MINUTES AT THE TABLE"));
c.push(readAloud("The Temple bells ring for vespers. One by one the others answer, down to the little chapels of the Dunkelfeucht. On the door of the Pious Cup, someone has pasted the Watch notice: the review, before the Barracks, on Sigmar’s Day. The paste is still wet. Ludwig, Silas: the Poetry Circle awaits you, with its candles and its verses. Pieter: Friedrich von Happe promised to tell you about ghosts. The rest of you… the night is yours. Three days remain."));
c.push(gm("Cut here. Next session opens with the two evenings in parallel. At the Circle, guests will talk about the fires: “The poor burning, well, one expects it — but guild masters, really!” — Frau Kellner above all. Let Ludwig and Silas take it."));
c.push(music("Arvo Pärt — “Fratres,” or Max Richter — “On the Nature of Daylight.”"));

// ─────────────────────────────────────────────────────────────
section("13. NEW NPCs");
c.push(dataTable(["NPC","PROFILE AND TONE"],[
["Master Anselm Brückner","Cooper, fifty, burned hands. Lost his wife and apprentices. Doesn’t shout, doesn’t cry in public. Wants to know who. If Silas saved Jost: a life debt, a modest ally in the coopers’ guild."],
["Jost Brückner","Nine, Anselm’s nephew. Lives or dies on Silas’s test."],
["Hedwig Rosshaupt ✝","Widowed lacemaker, the Red Moon’s neighbour. Died with her maidservant."],
["Signora Bettina Albertini","Tilean moneylender on the Marktplatz. Polite, precise, pitiless. Has the Lowhavens by the throat this week. Knows Giordano."],
["Kurt Pfennig","Otto’s bookkeeper at the Gilded Cage. Plays cards badly, drinks well, talks too much. Keeps the second ledger."],
["Hope Lowhaven","Mercy’s daughter, Altdorf branch. Arrives Bezahltag at noon on the Margarethe with a lawyer and two servants. No escort."],
["Ricker (reminder)","Polite, sorry, merciless. Perception 40. Never loses his temper."],
["Ursula (new reading)","Cold, calculating. Cool 55. Uses the PCs and makes no secret of it. Trades everything, gives nothing."],
],[2700,6660]));

// ─────────────────────────────────────────────────────────────
section("14. MUSIC — OPTIONS PER SCENE");
c.push(body("Several sources per scene, to range beyond the usual three games. Pick one track per line."));
c.push(dataTable(["SCENE","OPTIONS"],[
["The Screams (street on fire)","This War of Mine — main theme (Piotr Musiał) • Frostpunk — “The City Must Survive” • Chernobyl — “Bridge of Death” (Hildur Guðnadóttir)"],
["Franz’s farewell","Silence, then The Last of Us — “The Path” (Gustavo Santaolalla)"],
["The night","Arvo Pärt — “Spiegel im Spiegel” • nothing"],
["Morning mourning","Dead Can Dance — “The Host of Seraphim” • Allegri — Miserere • Hildur Guðnadóttir — Chernobyl, quiet tracks"],
["Market, rumours","Pentiment (Alkemie) • Kingdom Come: Deliverance (Jan Valta)"],
["Silvi","Disco Elysium — “Whirling-In-Rags, 8AM” (British Sea Power) • Sherlock Holmes (2009) — “Discombobulate” (Hans Zimmer)"],
["Engel","Hollow Knight — “Soul Sanctum” (Christopher Larkin) • Arcanum (Ben Houge) • Return of the Obra Dinn (Lucas Pope)"],
["Tailing Ricker","Sicario — “The Beast” (Jóhann Jóhannsson) • Prisoners (Jóhann Jóhannsson)"],
["Ursula","The Witch (Mark Korven) • There Will Be Blood — “Open Spaces” (Jonny Greenwood) • The Name of the Rose (James Horner)"],
["Final image","Arvo Pärt — “Fratres” • Max Richter — “On the Nature of Daylight”"],
],[2400,6960]));

// ─────────────────────────────────────────────────────────────
section("15. TRACKING — NOTE DURING PLAY");
c.push(dataTable(["TOPIC","RECORD"],[
["Witnesses","Perception result; was Ottokar there? Elf with a curved sword in the Herald?"],
["Jost Brückner","Did Silas treat him? Does he live? Silas named or anonymous?"],
["Franz","Left by boat; 10 GC received; Saif al-Janub confirmed to Thucydion. Recommendation to Nacht made (GM secret)."],
["Lodging","Where each PC sleeps; who met Giordano, Rolf or Shütteln."],
["Wounds","Heal and Endurance results; Pieter’s Wounds going into Eisfange."],
["Expedition","Rendezvous place and time with Wahlund, Melina and Gunnar."],
["Silvi","Dossier handed over; false leads passed to whom (Elsa, Otto, nobody); Kaspar’s reaction; Hieronymus paid?"],
["Engel","Who got the three talismans; who carries the vial and the coffer; did Engel hear about the review?"],
["Ricker / Ingrid","Tail successful? Sermon contradicted? Ingrid glimpsed by Pieter? Entry into the Pious Cup?"],
["Ursula","Deal accepted, refused, shifted? Down payment (Baumann’s name) obtained?"],
["Pfeffer’s announcement","Did the PCs make the link with the Barracks?"],
],[2520,6840]));
c.push(h2("Deadlines don’t go away"));
c.push(bullet("Marktag 15th evening","Poetry Circle (Ludwig, Silas: Isolde, Falck, comments on the fires) and Friedrich’s soirée (Pieter). The Elsa debrief: after the Circle at the earliest."));
c.push(bullet("Backertag 16th","Pieter vs Eisfange (Gestaltenstark — Kretschmer’s thread). Felix’s public return; Otto learns of Kaspar’s failure. Chandlery assault if Ursula’s deal is accepted."));
c.push(bullet("Bezahltag 17th","Expedition at dawn. The barge Margarethe at noon (Hope Lowhaven). Rudi at breaking point."));
c.push(bullet("Sigmartag 18th","Watch review in front of the Barracks. K&H and the Skaven strike unless stopped."));
c.push(bullet("Dormant threads","Günther with Wahlund; Grodni’s favour; the dockers’ ghost bounty (10 GC); Doktor Grat; Mercy’s bounty on Kaspar; Oswin."));

// ─────────────────────────────────────────────────────────────
section("16. PLAYER HANDOUT — THE UBERSREIK HERALD");
c.push(body("Hand to the players on the morning of the 15th. Adapt the last paragraphs to the night’s events.",{font:"Arial",size:20,italics:true}));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, children: [run("THE UBERSREIK HERALD", { font: "Georgia", size: 44, bold: true, color: C.ink, smallCaps: true })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 160 }, children: [run("Special Edition • Marktag 15th Sigmarzeit • Two pennies", { font: "Georgia", size: 20, italics: true, color: C.grey })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 160 }, children: [run("THE FIRE THAT DEVOURS UBERSREIK", { font: "Georgia", size: 34, bold: true, color: C.darkRed })] }));
c.push(body("Three fires in less than a week. Heske Glazer’s shop. The Hog Pit and the hovels of the Wandiene Rookery, where four souls perished and two are still missing. And last night the Red Moon, in the very heart of our city, snuffed out like a candle."));
c.push(body("This time the fire did not spare honest folk. Dora Brückner, wife of the master cooper, and two young apprentices of the guild perished beneath the ruins of their home. The widow Rosshaupt, a respected lacemaker, died with her maidservant. A night watchman was crushed going to their aid. Seven dead. A dozen burned, tended by the sisters of Shallya on the bare straw of their courtyard."));
c.push(body("The innkeeper Franz Lohner, a former mercenary, is said to have perished in the flames of his establishment. Neighbours claim to have heard shouts and the sounds of fighting before the explosion. A settling of scores? The madness of an arsonist? The Watch promises five crowns to whoever can shed light on it."));
c.push(body("The Herald asks the question all Ubersreik is asking: where was Captain Pfeffer? Last night the guilds demanded her resignation. The Council, it is said, is listening."));
c.push(body("[IF PERCEPTION FAILED] Several witnesses report seeing, shortly after the explosion, “a tall elf bearing a curved sword” and a man of uncommon size carrying a body into the alleys. The Herald invites these persons to come forward.", {italics:true}));
c.push(body("[IF SILAS SAVED JOST] Amid the disaster, a barber whose name no one knows pulled little Jost Brückner, nine years old, from the flames. “I don’t know his name,” said the master cooper. “I will.”", {italics:true}));
c.push(body("— O. S.", {alignment: AlignmentType.RIGHT, italics:true}));
const styles = {
  default: { document: { run: { font: "Georgia", size: 22, color: C.ink }, paragraph: { spacing: { after: 80, line: 264 } } } },
  paragraphStyles: [
    { id: "Normal", name: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Georgia", size: 22, color: C.ink },
      paragraph: { spacing: { before: 0, after: 80, line: 264 } } },
    { id: "CampaignTitle", name: "Campaign Title", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 52, bold: true, color: C.darkRed },
      paragraph: { spacing: { before: 0, after: 60, line: 520 } } },
    { id: "CampaignSubtitle", name: "Campaign Subtitle", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 29, bold: true, color: C.red },
      paragraph: { spacing: { before: 0, after: 80, line: 320 } } },
    { id: "CampaignHeading1", name: "Campaign Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 32, bold: true, color: C.red },
      paragraph: { spacing: { before: 0, after: 140, line: 280 }, outlineLevel: 0, keepNext: true } },
    { id: "CampaignHeading2", name: "Campaign Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 26, bold: true, color: C.darkRed },
      paragraph: { spacing: { before: 160, after: 80, line: 270 }, outlineLevel: 1, keepNext: true } },
    { id: "CampaignHeading3", name: "Campaign Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 24, bold: true, color: C.blue },
      paragraph: { spacing: { before: 140, after: 70, line: 260 }, outlineLevel: 2, keepNext: true } },
  ],
};

const numbering = { config: [
  { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 60, line: 264 } }, run: { font: "Georgia", size: 22, color: C.ink } } }] },
  { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 60, line: 264 } }, run: { font: "Georgia", size: 22, color: C.darkRed, bold: true } } }] },
] };

const header = new Header({ children: [new Paragraph({
  alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 },
  children: [run("WARHAMMER FANTASY ROLEPLAY — UBERSREIK", { font: "Arial", size: 16, color: C.grey, smallCaps: true })],
})] });

const footer = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
  children: [
    run("Session 20 — Ashes and Accounts — ", { font: "Arial", size: 16, color: C.grey }),
    new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.grey }),
  ],
})] });

const doc = new Document({
  creator: "Ubersreik Campaign",
  title: "Session 20 — Ashes and Accounts",
  description: "GM guide: Franz’s escape, a city in mourning, Silvi, Engel, Ricker and Ursula.",
  styles, numbering,
  sections: [{
    headers: { default: header }, footers: { default: footer },
    properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: {
      top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin,
      header: PAGE.header, footer: PAGE.footer,
    } } },
    children: c,
  }],
});

const outputDir = path.resolve("campaign_docs", "output");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "Session 20 - Ashes and Accounts.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generated ${outputPath} (${c.length} blocks, ${buffer.length} bytes)`);
