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

// ── Session 21 helpers ─────────────────────────────────────────
const qfr = (speaker, text) => new Paragraph({
  indent: { left: 520, right: 280 }, spacing: { before: 60, after: 80, line: 260 },
  children: [
    run(`${speaker} : `, { font: "Arial", size: 20, bold: true, color: C.darkRed }),
    run(`« ${text} »`, { size: 21, italics: true }),
  ],
});

const prop = (lines) => new Paragraph({
  shading: { fill: C.greyFill, type: ShadingType.CLEAR }, border: borders,
  indent: { left: 360, right: 360 }, spacing: { before: 80, after: 140, line: 276 },
  children: lines.map((line, index) => run(line, {
    font: "Georgia", size: 22, italics: true, color: "2A2A2A", break: index === 0 ? undefined : 1,
  })),
});

const recap = [
  "La Lune Rouge a sauté, et avec elle sept innocents du voisinage. Vous avez porté Franz jusqu’au hangar des Bateliers sans vous retourner sur les cris. Il vous a payés, il est parti sur le Teufel, et Franz Lohner a cessé d’exister.",
  "Au matin, le Héraut parlait d’un grand elfe à l’épée courbe. Thucydion, tu as tendu l’épée à Kaspar sans un mot. Dans les ruines, Christoph Engel vous attendait : il vous a parlé de malepierre, vous a confié un coffret de plomb, trois amulettes et une fiole de brume grise — et vous ne lui avez rien dit de vrai.",
  "Ottokar Stiegler vous a entendus parler de la nuit de l’incendie. Kaspar, tu l’as fait taire. Ludwig, tu lui as ensuite écrit une lettre anonyme, signée « Un garde concerné », où figurait le nom du sergent Rudi Klumpenklug.",
  "Puis Reikhardt Gestaltenstark est venu au Loup et au Hobgobelin, avec quatre de ses hommes. Thucydion, tu lui as offert l’épée contre son départ, au nom du Denvater. Il a avoué le don d’Ulric. Il a ri. Il a refusé. Kaspar, tu as frappé.",
  "Kaspar, Thucydion, Silas : il vous a brisés tous les trois. Ludwig, tu as tué un de ses hommes, brisé la clavicule d’un autre, et tenu seul face au champion. Pieter, tu étais sorti chercher de l’aide en criant à l’assassin ; tu es revenu, tu as abattu les derniers hommes de main, et ensemble vous avez jeté Reikhardt à terre.",
  "Il ne s’est pas transformé. Vous n’avez aucune preuve. Le tavernier et ses clients s’approchent. Il est six heures du soir, et il vous reste trois jours avant le Sigmartag.",
];

// ─────────────────────────────────────────────────────────────
section("SESSION 21 — A NIGHT IN THE BARRACKS");
c.push(body("Marktag 15th Sigmarzeit, 18:00 → Backertag 16th, c. 23:00", { font: "Arial", size: 28, bold: true, color: C.darkRed }));
c.push(timeBox("C. 4H AT THE TABLE • FIVE PLAYERS • THREE DAYS BEFORE SIGMARTAG"));
c.push(readAloud("La caserne de la Garde est le bâtiment le plus sûr d’Ubersreik. C’est du moins ce qu’on dit."));
c.push(labelDetailTable([
  ["Opening", "The Wolf & Hobgoblin, seconds after Reikhardt falls. Barman and patrons closing in. The Watch has not been called yet."],
  ["PC state", "Ludwig 4/10, Resilience 0, Corruption 3/6, mutating • Silas 0/13, unconscious, Corruption 7/7 (AT THRESHOLD) • Kaspar 0/15, unconscious, Corruption 4/7 • Pieter 17/28, Fate 3, Corruption 7/8 • Thucydion 0/23, unconscious, FATE 0, Corruption 6/9."],
  ["Confirm at start", "Kaspar’s Fate (1 or 2 left). Who carries Engel’s coffer + tongs, the 3 lead talismans and the grey-mist vial. Everything is confiscated at intake and returned at release."],
  ["Core ruling", "Reikhardt is alive. Unless the PCs do something stupid (finish him, attack a Watchman, break out), this ends in bail, a trial postponed until after the feast days and a ruined reputation — not the gallows."],
  ["Tone", "Humiliation and claustrophobia, then a procession of visitors who each want something. The city hates them; the law is oddly lenient. The Barracks is quiet. Too quiet, underneath."],
  ["Target ending", "Backertag 16th, c. 23:00: after the Eisfange bout and/or the raid on Kessel’s Chandlery — or on Ursula walking away into the fog."],
  ["Secrets", "The Barracks is the bomb site; Rudi knows and is on night duty. Reikhardt heals overnight. Vielfrass, who arrests them, leads the Circle of Unmarred Flesh. Silvi will cancel Kaspar’s deal and propose Otto’s death."],
]));
c.push(h2("Navigation"));
c.push(body("2 Previously • 3 Pacing • 4 The Wolf & Hobgoblin • 5 Intake • 6 Pfeffer on the Sly • 7 The Long Night • 8 The Miracle • 9 Interrogations • 10 The Denvater • 11 Silvi • 12 Release • 13 The Afternoon • 14 The Night of the 16th • 15 New NPCs • 16 Music • 17 Player Props • 18 Tracking."));
c.push(warning("Custody must never be a dead end. Every scene in the cells is a visitor, a sound or a choice. And the word “digging” must never come from you: describe what they hear, nothing more."));

// ─────────────────────────────────────────────────────────────
section("2. PREVIOUSLY…");
c.push(timeBox("0:00–0:05 AT THE TABLE • READING: ABOUT 2 MINUTES"));
for (const p of recap) c.push(readAloud(p));
c.push(gm("Then settle the two confirmations (Kaspar’s Fate, kit carriers) in thirty seconds and roll straight into the tavern. No breathing room: the patrons are already moving."));

// ─────────────────────────────────────────────────────────────
section("3. RUNNING THE FOUR HOURS");
c.push(dataTable(["TABLE", "IN THE FICTION", "PRIORITY"], [
  ["0:00–0:05", "15th, 18:00", "Recap, confirmations."],
  ["0:05–0:25", "18:00–18:30", "Wolf & Hobgoblin: wait or flee; Vielfrass’s patrol; witnesses; the sword bagged."],
  ["0:25–0:45", "18:45–20:00", "Intake: confiscation, names, charges, Bandages Rau botching the dressings, Silas."],
  ["0:45–1:00", "c. 21:30", "Pfeffer on the sly. Record what they tell her."],
  ["1:00–1:25", "22:00–05:00", "The night: noises, Rudi, the Baron’s notes, Ludwig’s nightmare."],
  ["1:25–1:35", "16th, 06:00–09:00", "The miracle; Reikhardt walks past."],
  ["1:35–2:05", "07:00–10:00", "Interrogations, one by one. Kretschmer tally. Vielfrass’s pitch."],
  ["2:05–2:20", "10:00–10:45", "The Denvater."],
  ["2:20–2:40", "12:30–13:30", "Silvi: the debt, the cancelled deal, Otto."],
  ["2:40–2:55", "c. 14:00", "Release: the street, Shütteln’s note, Ursula’s offer."],
  ["2:55–3:10", "14:30–19:00", "Afternoon: healing, Elsa, Wahlund, Otto prep, Pieter’s choice."],
  ["3:10–4:00", "19:00–23:00", "The Tin Spur (Felix, Eisfange) and/or Kessel’s Chandlery."],
], [1800, 2700, 4860]));
c.push(h2("If the table runs late"));
c.push(bullet("Past 1:30 and still in the night", "Cut the remaining noises to one; hand the Baron’s notes over without the guard’s patter."));
c.push(bullet("Interrogations", "If they drag, run the remaining PCs as a single round of two questions each — but never skip the Kretschmer tally."));
c.push(bullet("Past 3:15 at release", "Choose: either the Eisfange bout or the Chandlery is played; the other happens off-screen (see the purple boxes). Ursula’s offer must be made before the session ends."));
c.push(absent("All five players are present, but they can split on the night of the 16th. The Tin Spur, Felix’s return and Ursula’s patience all run without them."));

// ─────────────────────────────────────────────────────────────
section("4. SCENE 1 — THE WOLF & HOBGOBLIN");
c.push(timeBox("MARKTAG 15TH, 18:00–18:30 • 20 MINUTES AT THE TABLE"));
c.push(readAloud("Le silence tombe sur la salle d’un coup, comme un drap. Une chope roule sous une table et finit sa course contre la botte de Reikhardt. Près de la porte, quelqu’un souffle : « C’est Gestaltenstark. » Puis un autre, plus fort : « Ils ont tué Gestaltenstark ! » Le tavernier s’avance, un gourdin à la main, sans oser approcher davantage. Dehors, un gamin court déjà vers la place en hurlant."));
c.push(gm("Reikhardt breathes — slow, deep, almost peaceful. The patrons will not touch the PCs, but they drift to the door and stay there. Nobody helps the PCs’ wounded. A serving girl presses a rag to the one-eyed henchman’s face; he is bleeding out and moaning."));
c.push(h2("The choice"));
c.push(dataTable(["IF THEY…", "WHAT HAPPENS"], [
  ["Wait", "The patrol arrives in about ten minutes. Recommended path; the rest of this guide assumes it."],
  ["Flee", "Pieter and Ludwig carrying three unconscious men across the Marktplatz at dusk: Strength and Athletics tests, a crowd, a child pointing. They are caught within the hour or become wanted men. Flight turns an affray into attempted murder: no bail, no Silvi, no Kretschmer."],
  ["Finish Reikhardt", "The “something stupid”. Murder in front of twenty witnesses. The gallows track. Let the patrons scream first, so the player hears the cost before the blow lands."],
], [2200, 7160]));
c.push(warning("No Fate point saves anyone from a rope. If they cross the line, say so plainly in the fiction and let it stand."));
c.push(h2("The patrol"));
c.push(readAloud("La porte s’ouvre sur quatre gardes aux tabards jaune et noir, gourdins levés. Derrière eux entre un caporal au sourire franc, large d’épaules, la moustache soignée — de ceux que les gamins des rues suivent en riant. Un sergent massif lui colle au pas, comme une ombre. Le caporal regarde le champion au sol, puis vous, puis le sang. Il siffle entre ses dents."));
c.push(qfr("Vielfrass", "Eh bien. Quelqu’un a enfin couché Gestaltenstark. Et pas dans l’arène."));
c.push(body("A beat later, his eyes settle on Pieter, then Thucydion. The grin widens."));
c.push(qfr("Vielfrass", "Mais je vous connais, vous deux. L’Éperon. Le Trou-aux-Cochons. Vous refusez mes combats payés, et vous venez faire ça gratis ?"));
c.push(gm("Vielfrass knows nothing about the Hog Pit fire: he fled with the idol as soon as it spread. He reads the scene as ambitious fighters removing a rival, and he is quietly amused, almost admiring. Geldrecht says nothing — but he stares at Ludwig and Silas a moment too long. He thinks he has seen them before (outside the dockside warehouse on the 13th night) and cannot place it."));
c.push(warning("If any PC mentions docks, a warehouse, the Chandlery, candles or an idol in Geldrecht’s hearing — here or at any point in custody — he places them. The Chandlery is reinforced on the night of the 16th (section 14)."));
c.push(h2("Witnesses"));
c.push(bullet("The barman", "“The one in the hood grabbed the sword off the table and struck first. Gestaltenstark hadn’t even drawn.” (Kaspar)"));
c.push(bullet("A patron", "“The big one ran out shouting murder, then he came back and laid into the champion’s men.” (Pieter)"));
c.push(bullet("The serving girl", "“The little one killed Jörg. Just like that.” (Ludwig — the dead henchman is Jörg Maurer, a carter’s son.)"));
c.push(gm("Pieter is handled as a witness: hands tied loosely, not chained, but taken in all the same. Nobody heard what was said in the alcove — the Kretschmer test (section 9) depends only on the PCs’ own words."));
c.push(h2("The sword"));
c.push(body("Vielfrass picks up Saif al-Janub, turns it in the lamplight, weighs it."));
c.push(qfr("Vielfrass", "Courbe. Jolie."));
c.push(gm("Average (+20) Perception: they see him file the thought away. He has read the Herald. He does nothing with it tonight; the sword is a lever he keeps for later. It is logged as evidence and returned at release."));
c.push(h2("Through the Marktplatz"));
c.push(readAloud("On vous traîne dehors, et les trois qui ne tiennent pas debout, on les porte sur une porte arrachée à ses gonds. La Marktplatz est pleine. Des visages, des torches, une rumeur qui enfle : « Gestaltenstark… ils ont assommé Gestaltenstark… » Une pierre siffle à votre oreille. Un crachat. Une femme qui hurle « Assassins ! » et un homme qui rit. La caserne, au bout de la place, a ses fenêtres déjà allumées."));
c.push(music("Arrival of the patrol: There Will Be Blood — “Henry Plainview” (Jonny Greenwood), dissonant strings low under the description; cut to silence the moment Vielfrass speaks. The walk across the Marktplatz: crowd noise only."));

// ─────────────────────────────────────────────────────────────
section("5. SCENE 2 — INTAKE");
c.push(timeBox("MARKTAG 15TH, 18:45–20:00 • 20 MINUTES AT THE TABLE"));
c.push(readAloud("La caserne sent la chaux, la sueur et la soupe aux choux. On vous dépouille sur une longue table de chêne : armes, mailles, bourses, et tout ce que contiennent vos poches. Un greffier aux doigts tachés d’encre note chaque objet d’une écriture lente. Au mur, derrière lui, quelqu’un a cloué le numéro spécial du Héraut. Puis un escalier, une porte bardée de fer, et un couloir de cellules à moitié enterrées, où la lumière n’arrive que par des soupiraux grands comme une main."));
c.push(h2("Confiscation"));
c.push(labelDetailTable([
  ["Engel’s kit", "The clerk weighs the lead coffer, frowns, opens it (empty), tries the tongs. The vial: “Poison?” Whoever carries it must explain. The talismans are logged as “three lead trinkets”."],
  ["Saif al-Janub", "Evidence. The clerk’s eyes go from the curved blade to the Herald on the wall, and back."],
  ["Money", "26 GC counted, sealed in a bag with their names. Returned at release."],
  ["Armour", "Everything comes off. They spend the night in shirts on damp straw."],
]));
c.push(h2("Names in the ledger"));
c.push(body("The clerk asks every name. Most are simple. Two are not."));
c.push(bullet("Ludwig — decision", "Booked as Ludwig or as “Ryan von Mounir”? As Ryan: by tomorrow the Jungfreud hear that Ryan von Mounir is held for killing a man in a tavern — Isolde is shocked, Falck stops evaluating and starts worrying. As Ludwig: his real name, the Baron’s brand on his shoulder, on a homicide file. Write down the answer."));
c.push(bullet("Thucydion", "The clerk writes “elf” next to the name and looks at the Herald again. Overnight, guards mutter as they pass: « Cinq couronnes pour l’elfe. » Nobody can prove anything. Everyone wonders."));
c.push(h2("The charges"));
c.push(dataTable(["PC", "CHARGE", "SUGGESTED BAIL"], [
  ["Ludwig", "Killing of Jörg Maurer in an affray. The heaviest charge.", "20 GC"],
  ["Kaspar", "Unprovoked armed assault on Reikhardt Gestaltenstark; the man who lost an eye barely survived the night.", "20 GC"],
  ["Thucydion", "Affray. Questioned about the Red Moon (no proof).", "5 GC"],
  ["Silas", "Affray.", "5 GC"],
  ["Pieter", "Witness — affray at worst.", "5 GC"],
], [1600, 5560, 2200]));
c.push(gm("Total 55 GC — more than they have. That is the point: someone else will pay (sections 10 and 11). Conditions of release are on the bail paper (section 17): no leaving Ubersreik before the trial, any new offence means immediate imprisonment. Optional: Ludwig and Kaspar must report to the Barracks every day at noon — which would put them at the Barracks on Sigmartag."));
c.push(h2("Two healers"));
c.push(body("Reikhardt is brought in too, on a stretcher, and laid in the end cell of the corridor, visible across from theirs. The Esteemed Company pays for a sister of Shallya: Sister Hildegund arrives within the hour with a basket of linen and herbs. The PCs get someone else."));
c.push(readAloud("Le garde qu’on vous envoie a la cinquantaine, un seau d’eau tiède, une poignée de chiffons et l’air d’un homme qu’on a réveillé pour rien. « Bertolt, » dit-il. « Les gars m’appellent Bandages. J’ai fait la campagne d’Ostermark. Enfin… les cuisines. »"));
c.push(labelDetailTable([
  ["Rau’s test", "Heal 28. One test per wounded PC. Success: heals 1 + SL Wounds and brings them round. Failure: wakes them roughly, heals nothing. Failure by 3+ SL: a filthy dressing — Average (+20) Endurance test or a Minor Infection."],
  ["Silas’s spotlight", "Once Silas is awake, he can talk Rau through it from his cell: an Average (+20) Fellowship or Heal test gives Rau +20 on his next test. Or Silas works through the bars himself: Heal at −20 (no kit, one hand through the grille)."],
  ["The night’s rest", "Damp straw and cold: the usual overnight recovery requires a Challenging (+0) Endurance test. On a failure, no Wounds are recovered from rest."],
]));
c.push(qfr("Bandages Rau", "T’es barbier, toi ? Ça se voit. T’as des mains de barbier."));
c.push(gm("If Silas helps him, Rau becomes a small friendly face in the Barracks: he brings a second blanket, a heel of bread, and talks. He is on duty on Sigmartag. Keep him for the finale."));
c.push(warning("Thucydion has no Fate left. Nothing in custody should kill him — but make sure the player feels how thin the ice is when Rau’s dressing goes wrong."));
c.push(music("The Shawshank Redemption — “Shawshank Prison (Stoic Theme)” (Thomas Newman). Then let the drip of water and the clank of keys take over."));

// ─────────────────────────────────────────────────────────────
section("6. SCENE 3 — PFEFFER ON THE SLY");
c.push(timeBox("MARKTAG 15TH, C. 21:30 • 15 MINUTES AT THE TABLE"));
c.push(readAloud("Le couloir s’est tu. Les gardes de la relève sont remontés ; seule une lanterne pend encore à son crochet. Des pas, légers, qui ne sont pas ceux d’un garde. Une femme s’arrête devant vos barreaux, enveloppée d’une cape de laine sans insigne, la capuche rabattue. Quand elle la baisse, vous reconnaissez les traits tirés de la capitaine Andrea Pfeffer. Elle a l’air de n’avoir pas dormi depuis le Magnustag."));
c.push(gm("Unofficial. She sent the jailer upstairs; nobody saw her come down. She comes out of curiosity, not to help: Ludwig and Silas told her about Rudi and the rat-men in S11 and she threw them in a cell. Now the same people have beaten the city’s champion senseless. She wants to understand. The guilds’ resignation petition is folded in her coat — she can show it, unprompted, if they ask why she can’t help."));
c.push(qfr("Pfeffer", "Je ne suis pas ici. Vous comprenez ? Personne ne m’a vue descendre."));
c.push(qfr("Pfeffer", "La dernière fois, vous m’avez parlé de Klumpenklug. Je vous ai fait jeter au cachot. … Il fréquente des gens étranges. Un homme, sur les quais, que personne ne sait nommer. Ça ne prouve rien."));
c.push(qfr("Pfeffer", "Et maintenant vous assommez le champion de la ville en pleine taverne. Pourquoi ? Dites-le-moi à moi. Pas au greffier."));
c.push(body("If they raise the review in front of the Barracks:"));
c.push(qfr("Pfeffer", "Le Conseil exige cette revue. Si je l’annule, je donne ma démission avec."));
c.push(gm("She confirms there is a file on Rudi and that his contacts are “very sketchy”. She does not name who has been following him. She cannot free them and will not be seen protecting the men the Herald hints at. She promises nothing. Write down exactly what the PCs tell her — werewolf, Kretschmer, Skaven, bomb, Rudi, K&H. Her concrete reaction for the 18th will be decided after the session."));
c.push(gm("Kretschmer test: what they tell Pfeffer here is off the record — she takes no notes. By default it does not count against them in section 10."));
c.push(body("On her way out, she passes Rudi Klumpenklug on the stairs, coming on for the night shift. She does not look at him. He watches her go, then looks down the corridor at their cell."));
c.push(music("Arrival — “On the Nature of Daylight” (Max Richter). Tired dignity, a woman who knows she is losing."));

// ─────────────────────────────────────────────────────────────
section("7. SCENE 4 — THE LONG NIGHT");
c.push(timeBox("MARKTAG 15TH, 22:00 → BACKERTAG 16TH, 05:00 • 25 MINUTES AT THE TABLE"));
c.push(body("Run the night as a series of beats, in any order. Give each awake PC at least one."));
c.push(h2("4a. The sounds"));
c.push(dataTable(["HOUR", "WHAT THEY HEAR (READ ALOUD)", "PERCEPTION"], [
  ["c. 23:00", "Un grattement, très loin, sous le sol. Il s’arrête dès que vous retenez votre souffle.", "Challenging (+0)"],
  ["c. 01:00", "Tok… tok… tok… Un rythme lent, patient, comme une conduite qui travaille dans le froid. Il dure le temps de trois cents battements de cœur. Puis plus rien.", "Hard (−20)"],
  ["c. 02:00", "L’eau de la cruche frissonne. Une seule fois. De petits cercles naissent au centre et meurent contre la terre cuite.", "Hard (−20), only if someone is awake and looking"],
  ["c. 04:00", "Une odeur, à peine, qui monte du soupirail ou du sol : du cuivre chaud et du poil brûlé. Elle s’en va avant que vous puissiez en être sûrs.", "Challenging (+0); +20 with Acute Sense (Smell)"],
], [1300, 5560, 2500]));
c.push(gm("Never name it. If a player says “digging”, answer only with what they hear. If they ask a guard: « Des rats. La caserne en est pleine. » The smell is warpstone; Engel described the danger, so they may make the link themselves. If nobody is awake, the sounds happen anyway, unheard."));
c.push(h2("4b. Rudi on night duty"));
c.push(readAloud("La lanterne passe devant vos barreaux et s’arrête. Le garde qui la porte a un visage que vous connaissez : rond, gris de fatigue, luisant de sueur malgré le froid. Le sergent Rudi Klumpenklug vous regarde comme on regarde un chien qui pourrait mordre. Puis il presse le pas."));
c.push(gm("He remembers them from the Crooked Hammer (S7). He steers the night patrol away from the cellar stair at the end of the corridor: « Pas la peine, c’est fermé, j’ai vérifié. » Average (+20) Perception to notice him turning the other guard back; Hard (−20) to notice him flinch at each sound from below."));
c.push(qfr("Rudi", "Taisez-vous. Vous ne savez rien."));
c.push(qfr("Rudi", "C’est vous qui finirez au gibet pour la Lune Rouge. Pas moi."));
c.push(gm("If they mention K&H, the review, Kürbis or Honighäschen: he goes white, leaves, and does not walk this corridor again tonight. He will not confess — he fears K&H far more than five bruised prisoners. If they push very hard, he leaves a word at the dead drop: K&H learn the PCs are in the Barracks. It changes nothing in their plan (too late), but Honighäschen now knows their faces."));
c.push(h2("4c. The Baron’s notes (c. 23:00)"));
c.push(body("A guard they do not know — the same breed as the one who freed Ludwig and Silas in S11 — slides two folded papers through the bars without stopping. One for Ludwig (and Silas), one for Kaspar. Texts in section 17."));
c.push(gm("Otto does not yet know Felix is alive. He learns it tomorrow night at the Tin Spur. His note is a probe, not a threat — yet."));
c.push(h2("4d. Ludwig’s nightmare (c. 03:00)"));
c.push(readAloud("Tu tombes. Encore. La branche a cédé sous toi comme elle cède toujours, et le sol monte, et tu sais — tu le sais avec une certitude de bête — qu’il suffirait d’ouvrir les ailes. Tu tends les bras. Rien ne s’ouvre. Tu tombes. Tu te réveilles trempé, le crâne en feu, et tes ongles sont pleins de sang : tu t’es gratté le cuir chevelu jusqu’à la chair. Sous la peau, quelque chose pique, par dizaines de petites pointes, comme des échardes qui voudraient sortir."));
c.push(gm("No Fellowship lost on the 16th. In the morning light, a Hard (−20) Perception test lets another PC notice that his nose is more hooked and his chin sharper. Ludwig only knows that something is growing. Schedule: 17th −10 Fel, beak and feathers visible on close look; 18th −10 Fel more (−20 total), head fully an eagle’s."));
c.push(h2("4e. Silas at the threshold"));
c.push(gm("Nothing in the cell grants Corruption by default — do not invent a source. If Silas gains a point anywhere this session (the idol in section 14 is the likely one), apply the threshold procedure at once: Cool test, and on a failure roll the mutation on the spot."));
c.push(music("Under the sounds: Prisoners — “The Priest’s Basement” (Jóhann Jóhannsson), barely audible, then silence. Ludwig’s nightmare: Hellblade: Senua’s Sacrifice — “Valravn” (David García) — the raven-spirit track, with its whispering voices."));

// ─────────────────────────────────────────────────────────────
section("8. SCENE 5 — THE MIRACLE");
c.push(timeBox("BACKERTAG 16TH, 06:00–09:00 • 10 MINUTES AT THE TABLE"));
c.push(readAloud("À l’aube, une sœur de Shallya sort de la cellule du champion, une bassine entre les mains. L’eau est rose. Elle s’arrête au milieu du couloir, serre la bassine contre elle, et vous voyez ses lèvres remuer sur une prière. « Les plaies se sont refermées, » dit-elle au garde, assez fort pour que tout le couloir l’entende. « Cette nuit. Toutes. Ulric veille sur cet homme. »"));
c.push(gm("Sister Hildegund is honest and moved: she believes it is divine favour. The guards repeat it all morning — « béni d’Ulric ». If the PCs say “werewolf”, the guards laugh, and the sister is offended on the champion’s behalf."));
c.push(qfr("Sœur Hildegund", "Vous l’avez presque tué, et maintenant vous l’insultez ?"));
c.push(h2("Reikhardt walks past (mid-morning)"));
c.push(readAloud("Il passe devant vos barreaux, debout, sans un bandage, une chemise propre sur les épaules. Il ne vous regarde pas. Devant la cellule de Pieter, il s’arrête, inspire une fois, longuement, par le nez — et sourit. Puis il continue vers l’escalier."));
c.push(gm("His deposition, which the Watch believes: “They sent me a note — ‘we know your secret’ — and tried to blackmail me with lies. When I refused, the one in the hood drew. The big one is contracted at the Tin Spur, so is the elf. Upstarts.” He never mentions Ulric or the Denvater: exposing them would expose him. Pieter has just been scented: Eisfange will know him tonight."));
c.push(music("The Witch (Mark Korven) — the opening cues: wrongness dressed as piety. Or silence and the drip of the pink water."));

// ─────────────────────────────────────────────────────────────
section("9. SCENE 6 — INTERROGATIONS");
c.push(timeBox("BACKERTAG 16TH, 07:00–10:00 • 30 MINUTES AT THE TABLE"));
c.push(body("Each PC is taken up alone to a whitewashed room with a table and two chairs. Sergeant Konrad Bleich asks the questions: methodical, chewing cloves, neither cruel nor kind. Vielfrass leans against the wall, arms folded, enjoying himself. Three to five minutes per PC; the others wait below and hear nothing."));
c.push(h2("Questions"));
c.push(qfr("Bleich (à tous)", "Pourquoi lui ? Pourquoi hier ?"));
c.push(qfr("Bleich (à tous)", "Votre billet disait : « Nous connaissons votre secret. » Quel secret ?"));
c.push(qfr("Bleich (à tous)", "Qui vous a envoyés ?"));
c.push(qfr("Bleich (à tous)", "Où étiez-vous avant-hier soir, quand la Lune Rouge a sauté ?"));
c.push(qfr("Bleich (Thucydion)", "Un grand elfe avec une épée courbe. Vous en connaissez beaucoup, à Ubersreik ?"));
c.push(qfr("Bleich (Ludwig)", "L’homme que vous avez tué s’appelait Jörg Maurer. Son père est charretier. Il est en bas. Il voudrait vous voir."));
c.push(qfr("Bleich (Kaspar)", "L’homme à l’œil crevé a passé la nuit entre la vie et la mort. Vous avez frappé le premier. Tout le monde le dit."));
c.push(qfr("Bleich (Pieter)", "Vous criiez à l’assassin. Puis vous êtes revenu cogner. Témoin ou complice ?"));
c.push(qfr("Bleich (Silas)", "Barbier. Et vous soigniez qui, au juste, avant-hier soir ?"));
c.push(h2("Reactions"));
c.push(dataTable(["IF A PC SAYS…", "WHAT FOLLOWS"], [
  ["Kretschmer / the Denvater", "Bleich writes it down. Word reaches the Temple of Ulric before ten. This fails the Kretschmer test (section 10). Keep a tally."],
  ["“He is a werewolf”", "Bleich writes “claims the victim is a beast”. Vielfrass laughs out loud. It goes in the file, and makes them look mad."],
  ["Skaven / rat-men", "« Encore les hommes-rats ? » The Watch remembers Ludwig and Silas’s S11 story. Mad, again."],
  ["Rudi Klumpenklug", "Bleich’s quill stops. He glances at the door. Then he goes on as if nothing was said. (Pfeffer’s file is secret even from him — but he has heard things.)"],
  ["The Red Moon", "Pressure on Thucydion, but no witness can swear to a face, and curved swords are sold in every Tilean shop. Noted in the file; no charge."],
], [2800, 6560]));
c.push(dataTable(["PC", "NAMED KRETSCHMER?", "SAID “WEREWOLF”?", "RUDI / SKAVEN / BARRACKS?"], [
  ["Kaspar", "", "", ""], ["Pieter", "", "", ""], ["Thucydion", "", "", ""], ["Ludwig", "", "", ""], ["Silas", "", "", ""],
], [1800, 2400, 2400, 2760]));
c.push(h2("Vielfrass’s pitch"));
c.push(body("To Thucydion and Pieter especially, on the way back down, a hand on the shoulder:"));
c.push(qfr("Vielfrass", "Des gars capables de coucher Gestaltenstark, on ne les laisse pas pourrir au cachot. Quand vous sortirez, venez me voir. On a toujours besoin de bras, chez nous. Et on paie mieux que l’Éperon."));
c.push(gm("The Circle’s recruitment hook. If a PC says yes, Vielfrass invites them to watch tonight’s bout “with the lads” at the Tin Spur — an alternative way into the Circle, on the very night Ursula wants to raid it. Note who accepts."));
c.push(music("Sicario — “The Beast” (Jóhann Jóhannsson), very low — or nothing but the scratch of Bleich’s quill and the clove crunching between his teeth."));

// ─────────────────────────────────────────────────────────────
section("10. SCENE 7 — THE DENVATER");
c.push(timeBox("BACKERTAG 16TH, 10:00–10:45 • 15 MINUTES AT THE TABLE"));
c.push(readAloud("Le Denvater Holst Kretschmer emplit le couloir comme une tempête emplit un col : manteau de loup, barbe grise, et autour de lui un silence que les gardes n’osent pas briser. Il passe devant vos cellules sans un regard et entre chez le champion. La porte se referme. Vous n’entendez rien — seulement, une fois, un rire bref. Celui de Reikhardt."));
c.push(body("A long while later he comes out, stops, and mutters, just loud enough:"));
c.push(qfr("Kretschmer", "Bande d’incapables."));
c.push(body("Then he turns to the bars."));
c.push(qfr("Kretschmer", "Nous ne nous sommes jamais rencontrés. Nous ne nous sommes jamais parlé. Vous ne connaissez pas mon nom, et je ne connais pas les vôtres. Est-ce clair ?"));
c.push(qfr("Kretschmer", "Notre accord n’existe plus. Il n’y aura pas de récompense. Pas pour ça."));
c.push(h3("If nobody named him to the Watch"));
c.push(qfr("Kretschmer (plus bas)", "Votre caution sera payée. Ne cherchez pas par qui. Le Temple d’Ulric n’a rien à voir avec vous — et n’aura jamais rien à voir avec vous. Et ne touchez plus à cet homme. Vous avez montré ce que vous valiez."));
c.push(h3("If someone named him"));
c.push(qfr("Kretschmer", "Vous avez prononcé mon nom devant la Garde."));
c.push(body("And he leaves. No bail."));
c.push(gm("Reikhardt has told him everything — Thucydion said the Denvater sent them. That alone ruins the quest. The bail test only concerns what the PCs said to the Watch in section 9. From now on Kretschmer avoids them: if they come to the Temple of Ulric, the door stays closed."));
c.push(warning("The reward (rare skills and talents, possible Cult initiation) is lost for good. Do not offer a way back."));
c.push(music("The Revenant — “The Revenant Main Theme” (Ryuichi Sakamoto, Alva Noto, Bryce Dessner). Cold, northern, final."));

// ─────────────────────────────────────────────────────────────
section("11. SCENE 8 — SILVI");
c.push(timeBox("BACKERTAG 16TH, 12:30–13:30 • 20 MINUTES AT THE TABLE"));
c.push(readAloud("Silvi Kreutzhame ne s’assied pas. Elle reste debout devant vos barreaux, les bras croisés, et elle vous regarde l’un après l’autre, longtemps, comme on compte des dettes."));
c.push(qfr("Silvi", "C’est fait. Vous sortez cet après-midi."));
c.push(qfr("Silvi", "Le champion de l’Éperon. La veille du combat en l’honneur de Sigmar. Dans une taverne de la Marktplatz. Vous savez combien de faveurs j’ai brûlées depuis hier soir ?"));
c.push(qfr("Silvi", "Les Croix vous ont aidés autant qu’elles le pouvaient. C’est fini. À partir de maintenant, vous êtes seuls."));
c.push(qfr("Silvi", "Vous me devez. Et vous allez me payer de la seule monnaie qui m’intéresse : ce qui creuse sous cette ville. Débarrassez-nous-en. C’est la seule raison pour laquelle je suis ici."));
c.push(gm("What she did: she leaned on Shütteln and the Esteemed Company (the Crosses run the Tin Spur fights) and on Reikhardt’s people so that nobody pushes for an immediate trial — the case goes to the Burgermeister’s court after the feast days. If Kretschmer paid the bail, she paid nothing more; if he did not, she paid it herself, and the debt is that much heavier. Despite her fury, she still believes they are useful to the city. That is all she believes."));
c.push(h2("Kaspar — the deal is off"));
c.push(body("She asks the others to step back, or simply lowers her voice."));
c.push(qfr("Silvi", "Notre petit accord. Les noms des Lowhaven pour le Baron. Oublie-le. Je ne livrerai pas tout le clan au Baron : il avalerait la ville."));
c.push(qfr("Silvi", "Ce soir, Felix remonte dans l’arène devant tout Ubersreik. Avant minuit, Otto saura que tu as échoué. Il l’a dit, ivre, devant témoins : « La tête de Scite ou la sienne. » La tienne, Kaspar."));
c.push(qfr("Silvi", "Alors je te propose autre chose. Otto ne doit pas voir le Sigmartag."));
c.push(gm("The culmination of Kaspar’s arc. Her means: Otto keeps a second ledger — money skimmed from the Baron — and his bookkeeper, Kurt Pfennig, knows where it is. With the ledger in the Baron’s hands, nobody in the gang will avenge Otto. Silvi sets no deadline, but Otto moves against Kaspar on the 17th (S22) whatever Kaspar decides. Her motive: Otto is the lieutenant pushing to finish the Lowhavens; without him the balance holds."));
c.push(h2("If they refuse her help"));
c.push(body("She shrugs and leaves. No debt — and no more Crosses. Corrupt guards arrange the release instead, for the 26 GC and a favour to be named later; it takes all day, and they walk out around 19:00, too late for the bout and with only hours for Ursula."));
c.push(music("Tinker Tailor Soldier Spy — “George Smiley” (Alberto Iglesias). Cold calculation."));

// ─────────────────────────────────────────────────────────────
section("12. SCENE 9 — RELEASE");
c.push(timeBox("BACKERTAG 16TH, C. 14:00 • 15 MINUTES AT THE TABLE"));
c.push(readAloud("On vous rend vos affaires sur la même table de chêne, dans le même ordre, sous la même écriture lente : armes, mailles, bourses, un coffret de plomb, une fiole, et une épée courbe que le greffier pousse vers vous du bout des doigts. Dehors, le soleil de l’après-midi vous fait plisser les yeux. Une femme crache à vos pieds. Un gamin montre l’elfe du doigt et s’enfuit en riant."));
c.push(body("Each PC signs the bail paper (section 17). Everything confiscated is returned, Saif al-Janub and Engel’s kit included."));
c.push(h2("Reputation"));
c.push(labelDetailTable([
  ["Common folk", "−10 to Fellowship tests with strangers for the rest of the campaign; −20 near the Marktplatz and the Wolf & Hobgoblin."],
  ["Tin Spur crowd", "Split: “tavern assassins” for some, “the men who dropped Gestaltenstark” for others. Bets on Pieter tonight are wild."],
  ["The Watch", "Every guard knows their faces. Any trouble now is a cell, not a warning."],
]));
c.push(h2("Shütteln’s runner"));
c.push(body("A boy in the Esteemed Company’s colours is waiting with a sealed note for Pieter (section 17): the bout stands. Already Bertold is crying it across the Marktplatz:"));
c.push(qfr("Bertold", "Ce soir à l’Éperon d’Étain ! Le colosse qui a jeté Gestaltenstark à terre contre Eisfange, le chien blanc ! Pour la gloire du Marteau !"));
c.push(gm("For the public, Eisfange has nothing to do with Reikhardt. Cancelling would only feed the PCs’ accusations. Commercially the brawl is a gift: the house will be packed."));
c.push(h2("Ursula"));
c.push(readAloud("Au coin de la rue, une silhouette se détache d’un porche : une femme en manteau de cuir usé, le visage barré de vieilles cicatrices. Ursula Marbad. Elle ne vous salue pas."));
c.push(qfr("Ursula", "Vielfrass. C’est lui qui vous a arrêtés. Vous savez ce qu’il est ?"));
c.push(qfr("Ursula", "Ce soir, Vielfrass et la moitié de ses hommes seront à l’Éperon, pour le retour de Felix et le combat du chien blanc. La Chandellerie Kessel sera presque vide. Je veux l’idole. Je veux leurs noms."));
c.push(qfr("Ursula", "En échange : le nom de celui qui a tué Jannik Fanger. L’endroit où dort Ingrid. Et l’heure où la maison est vide."));
c.push(gm("She hides that she watched Jannik die. Her payment, after the raid: Hannah Baumann killed Jannik; Hannah and Ingrid hide at the Pious Cup, a tea room behind the Temple of Sigmar (sign: a cup and a hammer); Ingrid’s room is upstairs; the house is empty at the hour of the evening service. If the PCs refuse, she waits: no assault tonight. The offer stays open, but the window — the Circle away at the Tin Spur — closes at midnight."));
c.push(music("The street: Dishonored — “Main Theme” (Daniel Licht). Under Ursula: Children of Men — “Fragments of a Prayer” (John Tavener)."));

// ─────────────────────────────────────────────────────────────
section("13. SCENE 10 — THE AFTERNOON");
c.push(timeBox("BACKERTAG 16TH, 14:30–19:00 • 15 MINUTES AT THE TABLE"));
c.push(dataTable(["OPTION", "WHAT IT GIVES"], [
  ["Rest and real care", "Silas with his kit: normal Heal tests. The Shallyan courtyard is overwhelmed with fire victims; no help there."],
  ["Pieter’s choice", "Fight Eisfange tonight, or forfeit (section 14)."],
  ["Elsa (Ludwig, Silas)", "The debrief at last. She is furious about the Circle no-show and the arrest, and wants something for the Baron: Poetry Circle intel, Jungfreud names, anything. Her threat about the brand is not idle."],
  ["Kaspar and Otto", "Scouting the Gilded Cage, finding Kurt Pfennig, thinking. Or drinking."],
  ["The Rat Catchers’ Guild", "Wahlund fixes the expedition: dawn on the 17th, at the Guild sewergate. Gunnar, Melina, Anders, Mårten and Rickard ready."],
  ["Ursula’s raid", "Prepare, scout the Chandlery by daylight, buy what was lost."],
], [2600, 6760]));
c.push(absent("Elsa — if Ludwig and Silas do not go to her today, Ludwig’s standing with the Baron drops a notch, and her next message comes with muscle (S22)."));
c.push(absent("Wahlund — if no PC goes to the Guild by nightfall, the expedition leaves at dawn on the 17th without them. Fair warning: as they walk out of the Barracks, a rat catcher in the crowd (Fritz Vogelman) catches someone’s eye and touches two fingers to his cap."));
c.push(gm("Off-screen today: Cordelia tells Engel about the silver powder she gave Thucydion. Engel now knows the PCs lied to him at the ruins. Not played unless they seek him."));
c.push(music("Pentiment — original soundtrack (Alkemie): any of the town cues. Medieval, warm, slightly out of place — which is the point."));

// ─────────────────────────────────────────────────────────────
section("14. SCENE 11 — THE NIGHT OF THE 16TH");
c.push(timeBox("BACKERTAG 16TH, 19:00–23:00 • 50 MINUTES AT THE TABLE"));
c.push(body("Two events: the Tin Spur’s Sigmar night (19:00–21:00) and Ursula’s raid (c. 21:00–23:00). The party may split. Pieter can fight at eight and join the raid after — if he can still stand."));
c.push(h2("14a. The Tin Spur"));
c.push(readAloud("L’Éperon d’Étain n’a jamais été aussi plein. On s’entasse jusque sur les poutres. Les loges des nobles sont tendues de bannières de Sigmar, et dans la fosse, sous les torches, Bertold lève les bras : « Pour la gloire du Marteau ! » Puis il baisse la voix, et la foule avec lui. « …et pour le retour d’un homme que tout Ubersreik croyait perdu. » Felix Scite entre dans la lumière."));
c.push(gm("Felix’s return is Silvi’s triumph. Average (+20) Perception: a man in the crowd leaves the moment Felix appears — running to Otto. Vielfrass is in the stands with his men; he sees whoever is there. A PC who accepted his invitation sits with “the lads” — more exposure to the Circle."));
c.push(h3("Pieter vs Eisfange"));
c.push(readAloud("Le chien blanc entre dans la fosse sans laisse. Il est plus grand que dans votre souvenir. Il ne tourne pas autour de toi comme un chien, Pieter : il s’arrête, il lève le museau, il hume l’air une fois — longuement — et ses babines se retroussent sur un sourire que tu as déjà vu ce matin."));
c.push(labelDetailTable([
  ["Stats", "Use Gestaltenstark’s wolf form from Blood & Snow, fully healed."],
  ["Pit rules", "Until a fighter yields or the pit master calls it. Eisfange does not yield. The handlers’ poles go in only after a Critical Wound on Pieter — or when you judge the crowd has seen enough."],
  ["Intent", "Eisfange wants to kill him. Make it felt: he goes for the throat, not the points."],
  ["If Pieter wins", "Eisfange is dragged away by the handlers at 0 Wounds. No transformation. Pieter’s fame soars; so does Reikhardt’s hatred."],
]));
c.push(warning("Pieter has 3 Fate and is at Corruption 7/8. Do not pull the wolf’s blows. This is the bout his cursed challenge earned him."));
c.push(absent("If Pieter forfeits: Bertold announces it — « Le colosse a peur du chien ! » — and the hall jeers. Shütteln voids his contract and demands the 2 GC advance. Klaus “Dents-de-Loup” Wenner leaps in to take his place and is mauled: his sword arm is ruined for life. The crowd cheers anyway."));
c.push(music("Felix’s entrance: Gladiator — “The Might of Rome” (Hans Zimmer & Lisa Gerrard). The bout: Mad Max: Fury Road — “Brothers in Arms” (Junkie XL)."));
c.push(h2("14b. Kessel’s Chandlery"));
c.push(readAloud("Les quais au nord du Teufel sont déserts. La brume monte de l’eau et colle aux lanternes. La Chandellerie Kessel est un long bâtiment de briques noircies, aux volets clos, qui sent le suif et la cire. Une seule fenêtre est éclairée, à l’étage."));
c.push(dataTable(["CONDITION", "GARRISON"], [
  ["Tonight, Circle at the Tin Spur", "Sgt. Geldrecht + 4: two off-duty Watchmen in civilian clothes, two hired thugs. Geldrecht guards the idol and will not leave it."],
  ["If Geldrecht placed them (section 4)", "+4 more men, and a lookout on the roof."],
  ["If a PC accepted Vielfrass’s invitation and is missing from the Tin Spur", "Vielfrass notices the empty seat. Nothing happens tonight — but he remembers."],
], [3600, 5760]));
c.push(gm("Ursula: use the Witch Hunter profile from the core rulebook. She wants the idol and the ledger, and Geldrecht alive — he can name Vielfrass. If the PCs kill Geldrecht, she turns cold but keeps her word. She will shoot any cultist running with the idol."));
c.push(warning("Vielfrass is NOT at the Chandlery: keep him for A Heart of Glass. Killing off-duty Watchmen, if identified, revokes their bail on the spot. Four days after their arrest, that would mean the gallows."));
c.push(h3("The idol"));
c.push(readAloud("Au fond de l’entrepôt, derrière un rideau de velours lie-de-vin, une statue de pierre blanche, haute comme un enfant, se dresse sur un autel couvert de cire fondue. Elle n’a ni sexe ni âge. Sa peau de pierre est lisse, sans un défaut, sans une cicatrice, et son visage sourit — d’un sourire si doux, si plein de promesses, que vous avez du mal à détourner les yeux. Autour d’elle, posés en couronne, de petits miroirs sont tous tournés vers elle."));
c.push(labelDetailTable([
  ["Corruption", "Anyone who looks at it: Challenging (+0) Cool test or gain 1 Corruption. Covering it before looking (cloak, curtain) avoids the test. Engel’s lead talismans do not help — they work against warpstone only."],
  ["Silas", "7/7: one point triggers the threshold procedure. Cool test, mutation rolled on the spot on a failure."],
  ["Pieter", "7/8: one point away."],
  ["Evidence", "A ledger: about twenty names and initials, a column of dues, several Watchmen among them. A folded letter sealed with an open eye (the Seven Veils / Unblinking Eye link — do not explain it)."],
]));
c.push(absent("If the PCs refuse or do not come: Ursula waits. No assault tonight. The Circle stays untouched, the idol stays on its altar, and what Ursula knows about Hannah, Ingrid and the Pious Cup stays with her."));
c.push(music("The approach: Annihilation — “The Alien” (Ben Salisbury & Geoff Barrow). When the curtain is drawn: Eyes Wide Shut — “Masked Ball” (Jocelyn Pook) — reversed liturgy for a beautiful wrongness. The fight: Bloodborne — “Cleric Beast” (Ryan Amon)."));
c.push(h2("End of session"));
c.push(body("End on whichever image lands last: Pieter in the pit with the wolf’s blood or his own; Ursula pocketing the ledger and naming Hannah Baumann; or an empty fog-bound quay where Ursula turns her back and walks away. Remind the table: dawn on the 17th, the expedition. Otto knows. Two days."));

// ─────────────────────────────────────────────────────────────
section("15. NEW NPCs");
c.push(dataTable(["NPC", "WHO THEY ARE"], [
  ["Bertolt “Bandages” Rau", "Watchman, fifties, “served in the Ostermark campaign — the kitchens”. Heal 28. Kind enough, useless. On duty on Sigmartag."],
  ["Sister Hildegund", "Shallyan sister paid by the Esteemed Company to tend Reikhardt. Honest, devout; announces the “miracle”."],
  ["Sgt. Konrad Bleich", "The Watch’s interrogator. Methodical, chews cloves, neither cruel nor kind. Has heard rumours about Rudi."],
  ["Jörg Maurer ✝", "The henchman Ludwig killed. A carter’s son. His father waits in the Barracks hall."],
  ["The bribed guard", "Unnamed, forgettable by design. Carries the Baron’s notes."],
], [2800, 6560]));

// ─────────────────────────────────────────────────────────────
section("16. MUSIC — SUMMARY");
c.push(dataTable(["SCENE", "TRACK", "SOURCE"], [
  ["Patrol arrives", "“Henry Plainview” — Jonny Greenwood", "There Will Be Blood (film)"],
  ["Intake", "“Shawshank Prison (Stoic Theme)” — Thomas Newman", "The Shawshank Redemption (film)"],
  ["Pfeffer", "“On the Nature of Daylight” — Max Richter", "Arrival (film)"],
  ["The sounds", "“The Priest’s Basement” — Jóhann Jóhannsson", "Prisoners (film)"],
  ["Ludwig’s nightmare", "“Valravn” — David García", "Hellblade: Senua’s Sacrifice (game)"],
  ["The miracle", "Opening cues — Mark Korven", "The Witch (film)"],
  ["Interrogations", "“The Beast” — Jóhann Jóhannsson", "Sicario (film)"],
  ["The Denvater", "“The Revenant Main Theme” — Sakamoto, Alva Noto, Dessner", "The Revenant (film)"],
  ["Silvi", "“George Smiley” — Alberto Iglesias", "Tinker Tailor Soldier Spy (film)"],
  ["Release", "“Main Theme” — Daniel Licht", "Dishonored (game)"],
  ["Ursula", "“Fragments of a Prayer” — John Tavener", "Children of Men (film)"],
  ["Afternoon", "Town cues — Alkemie", "Pentiment (game)"],
  ["Felix’s return", "“The Might of Rome” — Hans Zimmer & Lisa Gerrard", "Gladiator (film)"],
  ["Eisfange", "“Brothers in Arms” — Junkie XL", "Mad Max: Fury Road (film)"],
  ["Chandlery approach", "“The Alien” — Ben Salisbury & Geoff Barrow", "Annihilation (film)"],
  ["The idol", "“Masked Ball” — Jocelyn Pook", "Eyes Wide Shut (film)"],
  ["Chandlery fight", "“Cleric Beast” — Ryan Amon", "Bloodborne (game)"],
], [2200, 4160, 3000]));
c.push(gm("Silence remains a tool: the walk across the Marktplatz, the drip in the cell, the moment the sister holds the pink basin."));

// ─────────────────────────────────────────────────────────────
section("17. PLAYER PROPS");
c.push(h3("Note to Ludwig (and Silas) — slid through the bars, c. 23:00"));
c.push(prop([
  "Le Cercle t’attendait hier soir. Le Baron aussi.",
  "Toi et ton barbier, dès que vous sortirez de là — tu sais où.",
  "Une marque, ça s’enlève facilement, Ludwig. Avec la peau qui la porte.",
  "— E.",
]));
c.push(h3("Note to Kaspar — same hand that slid the first"));
c.push(prop([
  "Paraît que tu t’es fait pincer.",
  "J’espère que t’as fini ton petit travail avant.",
  "— O.",
]));
c.push(h3("Bail paper — one per PC, signed at release"));
c.push(prop([
  "GARDE DE LA VILLE D’UBERSREIK — ACTE DE CAUTION",
  "Le nommé ______________ est remis en liberté sous caution, dans l’attente de son jugement par la cour du Burgermeister, après les fêtes de Sigmar.",
  "Il lui est interdit de quitter la ville et ses faubourgs.",
  "Toute nouvelle infraction entraînera son incarcération immédiate.",
  "Chef d’accusation : ______________     Caution versée : ____ couronnes d’or, par un tiers.",
  "[Option : Le susnommé se présentera chaque jour à la caserne, à la cloche de midi.]",
  "Sceau de la Garde — Sgt. K. Bleich",
]));
c.push(h3("Note to Pieter — handed over by a runner at the Barracks door"));
c.push(prop([
  "Maître Pieter,",
  "La Compagnie Estimée ne mêle pas ses affaires aux querelles de taverne. Le combat de ce soir est maintenu.",
  "Toute la ville voudra voir l’homme qui a jeté Gestaltenstark à terre face à Eisfange. Je compte sur vous à la septième cloche.",
  "Un forfait annulerait votre contrat et vous obligerait à rembourser l’avance.",
  "— W. Shütteln, pour la Compagnie Estimée",
]));

// ─────────────────────────────────────────────────────────────
section("18. TRACKING — NOTE DURING PLAY");
c.push(dataTable(["TOPIC", "RECORD"], [
  ["Confirmations", "Kaspar’s Fate; carriers of the coffer, talismans, vial."],
  ["Wolf & Hobgoblin", "Waited or fled? Anything said near Geldrecht (docks, warehouse, idol)?"],
  ["Ledger name", "Ludwig booked as Ludwig or Ryan von Mounir?"],
  ["Wounds", "Rau’s results, Silas’s help, overnight Endurance, any infection."],
  ["Pfeffer", "Exactly what they told her: werewolf, Kretschmer, Skaven, bomb, Rudi, K&H, the review."],
  ["The sounds", "Who heard which, and whether anyone said “digging” or “warpstone”."],
  ["Rudi", "Confronted? K&H named? Did he go to the dead drop?"],
  ["Kretschmer tally", "Who named him to the Watch → bail paid or not."],
  ["Vielfrass’s offer", "Who accepted; who went to the Tin Spur with “the lads”."],
  ["Silvi", "Help accepted? Kaspar’s answer about Otto. Bail paid by whom."],
  ["Eisfange", "Fought or forfeited; outcome; Pieter’s Wounds, crits, Fate."],
  ["Chandlery", "Raid made? Geldrecht alive? Idol taken/destroyed? Ledger and the eye-sealed letter? Corruption gained (Silas, Pieter)? Ursula’s payment given?"],
  ["Elsa / Wahlund", "Elsa visited? Expedition rendezvous fixed for dawn on the 17th?"],
  ["Ludwig", "Fellowship still intact on the 16th; who noticed the nose and chin."],
], [2520, 6840]));
c.push(h2("Deadlines don’t go away"));
c.push(bullet("Bezahltag 17th", "Wahlund’s expedition at dawn. Otto moves on Kaspar. Ludwig −10 Fel, beak and feathers visible. Rudi at breaking point. The barge Margarethe at noon (Silvi’s old disinformation thread, still undelivered)."));
c.push(bullet("Sigmartag 18th", "Pfeffer’s review in front of the Barracks — K&H and the Skaven detonate it unless stopped. Ludwig’s eagle head complete. Possible Herald issue that morning (Ottokar has had two days to dig)."));
c.push(bullet("Dormant", "Günther with Wahlund; Grodni’s favour; Mercy’s bounty on Kaspar; Oswin; Doktor Grat; Giordano’s 20 GC; the fled Carmello goon; Engel now knowing they lied; Nacht via Franz; Johanna."));

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
    run("Session 21 — A Night in the Barracks — ", { font: "Arial", size: 16, color: C.grey }),
    new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.grey }),
  ],
})] });

const doc = new Document({
  creator: "Ubersreik Campaign",
  title: "Session 21 — A Night in the Barracks",
  description: "GM guide: custody in the Barracks, the visitors, release, Eisfange and Kessel’s Chandlery.",
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
const outputPath = path.join(outputDir, "Session 21 - A Night in the Barracks.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generated ${outputPath} (${c.length} blocks, ${buffer.length} bytes)`);
