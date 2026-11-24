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

// ── Session 22 helpers ─────────────────────────────────────────
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
  "Vous n’avez pas fui. Quand la patrouille du caporal Vielfrass est entrée au Loup et au Hobgobelin, vous étiez encore là, au milieu du sang. On vous a menés à la caserne, on vous a pris vos armes et vos noms, et on vous a interrogés un par un. Vous avez tous dit la même chose sur un seul point : Reikhardt Gestaltenstark était un loup-garou. Lui, il avait déjà payé sa caution, et il était parti.",
  "La nuit a été mauvaise. Thucydion, Ludwig, vous en êtes venus aux mains. La capitaine Pfeffer est descendue vous voir : elle vous a confirmé que le sergent Klumpenklug avait des fréquentations douteuses, et elle a ri du reste. Thucydion, seul dans ta cellule, tu as entendu un bruit sourd et régulier, quelque part sous la prison.",
  "Au matin, le Denvater Kretschmer est venu vous dire que votre accord n’existait plus. Puis Silvi vous a proposé de payer vos cautions, si Pieter affrontait le champion comme prévu. Pieter, tu as refusé, et tu l’as couverte d’insultes. Elle est repartie sans un mot de plus.",
  "Il ne vous restait que le nom du Baron. Les gardes ont gardé toute votre bourse et vous ont ouvert la porte au coucher du soleil.",
  "Devant la caserne, un message attendait Silas et Ludwig : Elsa vous ordonnait de venir, tous les deux, sans tarder. Kaspar, tu pensais à Otto. Certains d’entre vous ont parlé de quitter la ville. Et Ursula Marbad, la répurgatrice, vous a proposé l’assaut de la chandellerie, le soir même, contre l’endroit où se cachaient Hannah Baumann et Ingrid.",
  "Il était sept heures du soir. Vous n’aviez plus un sou, plus de Denvater, plus de Silvi. Il vous restait deux jours avant le Sigmartag.",
];

// ─────────────────────────────────────────────────────────────
section("SESSION 22 — DEBTS COME DUE");
c.push(body("Backertag 16th Sigmarzeit, 19:00 → Bezahltag 17th, night", { font: "Arial", size: 28, bold: true, color: C.darkRed }));
c.push(timeBox("ONE LONG SESSION OR TWO SHORT ONES • FIVE PLAYERS • TWO DAYS BEFORE SIGMARTAG"));
c.push(readAloud("À Ubersreik, on dit que le Baron ne prête jamais. Il avance. Et ce qu’il avance, quelqu’un vient toujours le reprendre."));
c.push(labelDetailTable([
  ["Opening", "Outside the Watch Barracks, sunset. Ursula has just walked off toward the docks. The roar of the Tin Spur carries across the roofs."],
  ["PC state", "Ludwig 10/10, Fate 2, Resilience 0, Corruption 3/6, first mutation signs • Silas 6/13, Fate 2, Corruption 7/7 (AT THRESHOLD) • Kaspar 5/15, Fate 2, Corruption 4/7 • Pieter 17/28, Fate 3, Corruption 7/8 • Thucydion 1/23, FATE 0, Corruption 6/9. Money: 0 GC."],
  ["Confirm at start", "Did they really denounce Vielfrass to Pfeffer? Did Thucydion tell the others about the noise under the gaol? Who carries Engel’s lead coffer and tongs?"],
  ["Purpose", "Close the threads before the dungeon crawl: Eisfange, the Circle, Hannah and Ingrid, Elsa, Otto. Nothing new is opened."],
  ["Tone", "Every scene is a creditor. The PCs chose each of these debts; nobody forgives one."],
  ["Target ending", "Bezahltag 17th, late night: after the Stiegler house, on Wahlund’s report and the rendezvous for the expedition."],
  ["Natural cut", "If the 16th alone fills the evening, stop when Ursula pays (section 6) or when Pieter leaves the pit. The 17th then makes a full session of its own (sections 8–12)."],
  ["Secrets", "Eisfange is diminished but lethal. Silvi gives one cold fact if Pieter fights. Elsa’s price is the Stiegler house. Otto will not kill Kaspar: he will crush his right hand. Hannah’s head is worth 20 GC — exactly Giordano’s price."],
]));
c.push(h2("Navigation"));
c.push(body("2 Previously • 3 Pacing • 4 Outside the Barracks • 5 The Tin Spur • 6 Kessel’s Chandlery • 7 Elsa’s Price • 8 The Morning of the 17th • 9 Kurt Pfennig • 10 The Pious Cup • 11 Johanna’s Letter • 12 The Stiegler House • 13 Closing • 14 NPCs • 15 Music • 16 Player Props • 17 Tracking."));
c.push(warning("Do not hand out exits. No new patron, no surprise purse, no softened blow. If they leave the city, let them go: the city burns without them, and that is their ending."));

// ─────────────────────────────────────────────────────────────
section("2. PREVIOUSLY…");
c.push(timeBox("0:00–0:05 AT THE TABLE • READING: ABOUT 2 MINUTES"));
for (const p of recap) c.push(readAloud(p));
c.push(gm("Settle the three confirmations in a minute, then put the question straight to the table: the fights have begun, Ursula is walking to the docks, Elsa is waiting. Where do you go?"));

// ─────────────────────────────────────────────────────────────
section("3. PACING");
c.push(dataTable(["TABLE", "IN THE FICTION", "PRIORITY"], [
  ["0:00–0:05", "16th, 19:00", "Recap, confirmations."],
  ["0:05–0:20", "19:00–19:30", "Outside the Barracks: Rolf, the three pulls, the split."],
  ["0:20–0:50", "19:30–21:00", "Tin Spur: under-card, Felix’s return, Otto’s lodge. / Ursula’s briefing on the quay."],
  ["0:50–1:50", "21:00–22:30", "Intercut: Pieter vs Eisfange / the Chandlery raid. The Circle comes home at 22:30."],
  ["1:50–2:05", "22:30–midnight", "Silvi’s cold fact. Ursula pays. Elsa, if they go tonight."],
  ["— cut point —", "", "Stop here if it is past 2:15 at the table."],
  ["2:05–2:25", "17th, morning", "Ludwig’s face. Summons (if no bout). Elsa (if not done). Pfennig. Healing."],
  ["2:25–3:15", "17th, afternoon", "Johanna’s letter (c. 16:00). The Pious Cup (best window 17:00–18:00). Bounty and Giordano."],
  ["3:15–4:05", "17th, 20:00", "The Stiegler house."],
  ["4:05–4:15", "17th, late", "Wahlund’s report; rendezvous for the expedition."],
], [1800, 2400, 5160]));
c.push(h2("Running the split"));
c.push(bullet("Cut on the cliffhanger", "Leave Pieter as the wolf lifts its muzzle; go to the quay. Leave the raiders with a hand on the purple curtain; go back to the pit. Three or four rounds per side, never more."));
c.push(bullet("One clock for both", "The bout starts at 21:30. The Circle leaves the Tin Spur when the bout ends, or at 22:15 if there is none. They reach the Chandlery fifteen minutes later."));
c.push(bullet("If everyone goes to one place", "The other resolves by its purple box. Do not replay it later."));
c.push(absent("All five players are present, but each scene has its own absence box. The Tin Spur, Ursula’s patience, Elsa’s account and Otto’s trap all run without them."));

// ─────────────────────────────────────────────────────────────
section("4. SCENE 1 — OUTSIDE THE BARRACKS");
c.push(timeBox("BACKERTAG 16TH, 19:00–19:30 • 15 MINUTES AT THE TABLE"));
c.push(readAloud("Le soleil est tombé derrière les toits. Sur la Marktplatz, on allume les lanternes de fête : demain, veille du Sigmartag, la ville sera pleine. De l’autre côté du fleuve monte une rumeur que vous connaissez bien — des milliers de voix, par vagues. L’Éperon d’Étain. Ursula Marbad a disparu au coin de la rue sans se retourner. Et contre le mur d’en face, les bras croisés, quelqu’un vous attend encore."));
c.push(h2("Rolf"));
c.push(readAloud("Silas, tu le reconnais avant qu’il ne lève la tête : ton frère. Rolf a le bras gauche en écharpe et le teint de quelqu’un qui dort mal. Il te sourit, vite, et le sourire ne tient pas."));
c.push(qfr("Rolf", "Elsa a envoyé un mot. Moi, elle m’envoie pour être sûre que vous savez lire."));
c.push(qfr("Rolf", "Ce soir ou demain matin. Pas après. Elle a dit : « Dis-leur que je compte les heures. »"));
c.push(qfr("Rolf (à Silas, plus bas)", "Vas-y, petit frère. Ceux qui n’y vont pas, on finit par aller les chercher. Et c’est jamais elle qui vient."));
c.push(gm("Rolf is the Lowhaven mole and suspects the gang is starting to look for one. He is frightened for himself and sincerely for Silas. He knows nothing of what Elsa wants. He also knows nothing yet about Otto’s plan for Kaspar. If Silas asks about the arm: the Cage, six days ago — « J’ai glissé. » He does not look at Kaspar."));
c.push(gm("Kaspar: Average (+20) Intuition — Rolf will not meet his eye. It is guilt (Rolf tried to shield Bella from him), not menace. Do not explain it."));
c.push(h2("The three pulls"));
c.push(dataTable(["WHERE", "WHEN", "WHAT IT COSTS TO SKIP"], [
  ["The Tin Spur", "Fights under way. Felix c. 20:30. Eisfange at 21:30 if Pieter announces himself by 21:00.", "Pieter branded a coward; Reikhardt’s charges tomorrow; Silvi shut for good."],
  ["Kessel’s Chandlery", "Ursula waits from 20:00. The window is 21:00–22:30.", "No Hannah, no Ingrid, no bounty — unless they tail Ricker tomorrow."],
  ["Elsa", "Tonight or tomorrow morning.", "Nothing on screen. Her account is settled after Sigmartag."],
], [2100, 3900, 3360]));
c.push(gm("If they talk about leaving Ubersreik, let the talk run. The gates close at the tenth bell; a barge can be had at the Boatmen’s Guild for a favour they cannot pay. Do not argue for the city. Thucydion’s player already did."));
c.push(gm("Healing before the night: Silas has his kit back. One Heal test per patient (normal rules). Nothing more is available: the Shallyan courtyard is full of burned people from the Red Moon, and a sister recognises them."));
c.push(music("Disco Elysium — “Instrument of Surrender” (Sea Power). A beaten city at dusk, something large and sad in the distance."));

// ─────────────────────────────────────────────────────────────
section("5. SCENE 2 — THE TIN SPUR");
c.push(timeBox("BACKERTAG 16TH, 19:30–22:15 • 40–50 MINUTES AT THE TABLE"));
c.push(readAloud("L’Éperon d’Étain n’a jamais été aussi plein. On s’entasse jusque sur les poutres. Les loges des nobles sont tendues de bannières au Marteau, les torches fument, et la sciure de la fosse est déjà brune par endroits. Quand vous entrez, des têtes se tournent. Un murmure court le long des gradins, plus vite que vous : « C’est eux. Ceux de la taverne. » Quelqu’un siffle. Quelqu’un applaudit. Personne ne vous fait de place."));
c.push(h2("Who is where"));
c.push(labelDetailTable([
  ["The lodges", "Karstadt with Josef Specht; von Bruner; Aschaffenberg; Emming for the Temple of Sigmar. Kretschmer’s seat is empty tonight — people notice."],
  ["The Baron’s lodge", "Otto Gault, in a new coat, with six men. He has come to be seen."],
  ["Ringside", "Corporal Vielfrass and a dozen of his “lads”, off duty, loud, buying rounds. They stay until the last bout."],
  ["The Crosses", "Silvi stands in the mouth of the fighters’ tunnel, arms folded. Old Hamm beside her."],
  ["The pit crew", "Bertold announcing; Gerd at the weapon racks; Shütteln in his box above the tunnel. Gunnar and Ekkehard share a bench and a ham."],
]));
c.push(gm("Fellowship tests with the crowd are at −10 (−20 for anyone who looks like the Herald’s “tall elf”). Vielfrass waves to Pieter and Thucydion like old friends. If Kaspar is visible, Otto sees him before Felix appears: he raises his cup an inch, smiling. He still thinks the job is done."));
c.push(h2("The under-card (colour only — one line each)"));
c.push(bullet("Klaus “Dents-de-Loup” Wenner", "Wins fast against a docker and salutes the Watch benches. Vielfrass’s lads roar."));
c.push(bullet("Greta Haldane", "Takes a Tilean duellist apart without a word. The crowd goes quiet, then stamps."));
c.push(bullet("Ekkehard", "Wrestles three sailors at once for a roast goose. He eats it in the pit."));
c.push(h2("Felix’s return (c. 20:30)"));
c.push(readAloud("Bertold lève les bras, et la salle se tait. « Pour la gloire du Marteau… et pour un homme que tout Ubersreik croyait perdu ! » Dans la bouche du tunnel, Silvi Kreutzhame s’écarte d’un pas. Felix Scite entre dans la lumière. Il est amaigri, il boite un peu, et il lève un poing. La salle se lève avec lui. Le bruit vous traverse la poitrine."));
c.push(readAloud("Kaspar. Dans la loge du Baron, Otto Gault ne s’est pas levé. Il regarde Felix. Puis, lentement, il tourne la tête et te cherche dans la foule. Il te trouve. Il ne sourit plus. Il pose sa coupe, dit un mot à l’homme à sa droite, et il sort."));
c.push(gm("That is all Otto does tonight. No threat, no message. He spends the night and the next day arranging the Stiegler house (section 12). If Kaspar is not in the hall, Otto simply leaves; he will find him through Johanna all the same."));
c.push(absent("Felix’s return happens whoever is in the hall. If no PC is there, they hear the roar from across the river at half past eight, and Kaspar knows what it means."));
c.push(h2("Pieter announces himself"));
c.push(body("Any time before 21:00, to Shütteln, Gerd or Bertold. Shütteln is delighted and does not hide it."));
c.push(qfr("Shütteln", "Maître Pieter ! On me disait que vous étiez au cachot. Ou en fuite. J’avais parié sur la fuite."));
c.push(qfr("Shütteln", "Dix couronnes si vous gagnez. Deux si vous sortez sur vos jambes. Rien si on vous sort. Et vous me laissez dire ce que je veux de vous là-haut."));
c.push(qfr("Bertold", "Ils ont frappé le champion d’Ubersreik à cinq contre un, dans une taverne, la veille du combat ! Ce soir, il n’y a plus de taverne. Ce soir, il est seul ! Le colosse… contre le chien blanc !"));
c.push(gm("The hall boos Pieter all the way down the tunnel. His friends get the same if they sit together. Bets run four to one for the hound."));
c.push(h3("Reikhardt’s condition"));
c.push(gm("Nobody sees Reikhardt tonight: the champion is “resting on the Shallyans’ orders”. Eisfange is led in by four handlers on poles. He healed fast, not fully: Kaspar’s cut from Saif al-Janub has closed into a pink seam along the left flank, visible through the white coat."));
c.push(readAloud("Le chien blanc entre dans la fosse sans laisse. Il est plus grand que dans ton souvenir, Pieter. Il ne tourne pas autour de toi comme un chien : il s’arrête, il lève le museau, il hume l’air une fois, longuement. Ses babines se retroussent. Le long de son flanc gauche, le poil repousse mal sur une cicatrice rose, toute fraîche, de la longueur d’une lame."));
c.push(labelDetailTable([
  ["Stats", "Gestaltenstark’s wolf form from Blood & Snow, starting at two-thirds of his Wounds."],
  ["The flank", "Average (+20) Perception to read the scar (automatic for anyone who saw Kaspar’s blow). A called strike there is at −20 to hit and deals +2 Damage. After the first such hit, Eisfange protects that side: he loses 1 Advantage each round he attacks."],
  ["Pit rules", "One hand weapon and a shield allowed, no missile weapons, armour allowed. Until a fighter yields or cannot rise. Eisfange does not yield."],
  ["Intent", "He wants Pieter dead and has the scent from the cells. He goes for the throat. The handlers’ poles go in only after a Critical Wound on Pieter, and they take two full rounds to pull the hound off."],
  ["Saif al-Janub", "If Pieter carries it into the pit, it is legal. Eisfange knows the blade: Pieter starts with +1 Advantage."],
  ["Yielding", "Pieter may yield at any time by throwing down his weapon. Eisfange gets one more attack before the poles arrive. 2 GC if he walks out."],
]));
c.push(warning("Pieter has 3 Fate and is at Corruption 7/8. Do not pull the wolf’s blows. The whole city is watching: nobody can step into the pit, and anything thrown from the stands is seen by a thousand people."));
c.push(h3("If the others cheat"));
c.push(dataTable(["METHOD", "TEST", "EFFECT", "IF NOTICED"], [
  ["Dose the hound before the bout (Silas)", "Stealth or Charm to reach the kennels under the stands, then Trade (Apothecary) or Heal. No money for bribes.", "Eisfange −10 to all tests; −20 on +3 SL.", "A handler finds the meat. The bout goes ahead; Shütteln pays nothing; Reikhardt knows."],
  ["A shout at the right moment", "Leadership or Intimidate, Challenging (+0).", "Pieter gains +1 Advantage, once.", "Nothing. It is a crowd."],
  ["A thrown knife or stone", "Ranged at −20 (crowd, distance, torchlight).", "Normal damage.", "Automatic on a failure, Average (+20) Perception for the benches otherwise: the hall turns on them, the Watch benches are ten yards away, purse forfeit."],
  ["Blinding powder, oil on the sand", "Sleight of Hand from the pit rail, Hard (−20).", "Eisfange loses all Advantage and his next action.", "As above."],
], [2200, 2700, 1900, 2560]));
c.push(gm("They may invent better. Rule on the same pattern: a real edge for Pieter, and a real chance that a thousand witnesses see it."));
c.push(h3("Outcomes"));
c.push(dataTable(["RESULT", "WHAT FOLLOWS"], [
  ["Pieter wins", "Eisfange is dragged out at 0 Wounds. No transformation, no proof. 10 GC, counted out by Gerd. Half the hall cheers a villain. Reikhardt files no charges: the champion does not sue the man who beat his dog. His hatred is private now."],
  ["Pieter loses or yields", "2 GC if he walks out. No charges either: the debt is paid in blood, in public. Record his Wounds and Critical Wounds: they carry into the 17th."],
  ["Pieter is caught cheating", "Purse forfeit, contract void. Silvi gives nothing. Charges follow tomorrow."],
], [2400, 6960]));
c.push(h3("Silvi’s cold fact (only if Pieter fought)"));
c.push(readAloud("Dans le tunnel, sous les gradins, Silvi Kreutzhame vous attend. Elle ne décroise pas les bras. Elle regarde Pieter comme on regarde une facture enfin réglée."));
c.push(qfr("Silvi", "Tu m’as insultée devant mes gens. Et tu es descendu dans la fosse quand même. Je paie ce que je dois."));
c.push(qfr("Silvi", "Otto Gault tient un second registre. Ce qu’il prélève sur la part du Baron, depuis des années. Son comptable s’appelle Kurt Pfennig. Il dort au-dessus de la Cage Dorée."));
c.push(qfr("Silvi", "C’est tout. Nous sommes quittes. Nous ne sommes pas amis."));
c.push(gm("She gives it to the group, looking at Kaspar. She adds nothing: no plan, no men, no Lowhaven dossier, no money. Her motive is unchanged — Otto is the lieutenant pushing to finish the Lowhavens. See section 9 for Pfennig."));
c.push(absent("If Pieter does not come: at 21:15 Bertold announces the forfeit — « Le colosse a peur du chien ! » — and the hall jeers his name. Klaus Wenner jumps in to take the bout and is mauled; his sword arm is ruined for life. Shütteln voids Pieter’s contract. Reikhardt files charges in the morning (section 8). Silvi’s door stays shut for the rest of the campaign."));
c.push(music("Felix’s entrance: Conan the Barbarian — “Anvil of Crom” (Basil Poledouris). Eisfange enters: The Grey — “Into the Fray” (Marc Streitenfeld). The bout: Princess Mononoke — “The Demon God” (Joe Hisaishi), on a loop."));

// ─────────────────────────────────────────────────────────────
section("6. SCENE 3 — KESSEL’S CHANDLERY");
c.push(timeBox("BACKERTAG 16TH, 20:00–23:00 • 50–60 MINUTES AT THE TABLE"));
c.push(readAloud("Les quais au nord du Teufel sont déserts. Toute la ville est à l’Éperon ou devant ses fourneaux. La brume monte de l’eau et colle aux lanternes. La Chandellerie Kessel est un long bâtiment de briques noircies, aux volets clos, qui sent le suif et la cire froide. Une seule fenêtre est éclairée, à l’étage. Sous l’auvent d’un entrepôt voisin, une silhouette en manteau de cuir vous regarde approcher."));
c.push(h2("Ursula’s briefing"));
c.push(qfr("Ursula", "Vous êtes venus. Bien. Je n’aurais pas attendu demain."));
c.push(qfr("Ursula", "Vielfrass est à l’Éperon avec douze de ses hommes. Ils ne partiront pas avant le dernier combat. Dedans, il reste le sergent Geldrecht et quatre autres. Geldrecht ne quitte jamais la porte du fond."));
c.push(qfr("Ursula", "Je veux trois choses. Ce qu’il y a derrière cette porte. Leurs noms, sur papier. Et Geldrecht vivant, si vous savez faire ça."));
c.push(qfr("Ursula", "Ensuite je vous dis où dort Hannah Baumann. Pas avant."));
c.push(gm("Ursula: Witch Hunter profile from the core rulebook, one pistol shot, then sword. She has watched this building for months and knows the ground floor from the street; she has never been inside the back room. She is honest about the deal. She hides that she saw Jannik die. If asked why she needs them: she has no one left — Aldric and Tobias are dead, and she has broken with Ricker."));
c.push(h2("The building"));
c.push(diagram([
  "                 QUAY / THE TEUFEL (fog)",
  "   +----------[ loading door, barred inside ]-----------+",
  "   |                                    |  VIELFRASS'S  |",
  "   |        OPEN FLOOR                  |   CABINET     |",
  "   |     chalk circle, 8 m              |  vestibule /  |",
  "   |                                    |  purple       |",
  "   |                              [door]|  curtain      |",
  "   |   tables, mismatched chairs        +---------------+",
  "   |   BAR (barrels + plank)      stair up -> dormitory |",
  "   +---[ street door, locked ]--------------------------+",
  "                 STREET (lanterns, empty)",
  "   UPSTAIRS: dormitory, 14 cots, one lit window (street side)",
]));
c.push(labelDetailTable([
  ["Street door", "Locked. Geldrecht wears the key on a cord round his neck; a second hangs behind the bar. Lock Picking Challenging (+0)."],
  ["Loading door (quay)", "Barred from inside. Strength Hard (−20) and very loud, or lift the bar with a blade through the gap: Sleight of Hand Challenging (+0)."],
  ["Upstairs window", "The lit one. Climb Average (+20) by the hoist beam. It opens on the dormitory: two men playing dice on a cot."],
  ["Front room", "A makeshift bar — a plank across barrels — a tapped keg, mismatched tables and chairs. Cloaks and Watch tabards on pegs, covered with civilian coats."],
  ["Open floor", "Bare boards, and a thick chalk circle eight metres across, scuffed by many feet. The Circle wrestles here; Vielfrass calls it an Unberogen custom."],
  ["The cabinet door", "Unlocked. No member would dare open it. Geldrecht sits on a stool beside it, polishing a breastplate that is not his."],
]));
c.push(h3("Garrison"));
c.push(dataTable(["WHO", "WHERE", "NOTES"], [
  ["Sgt. Orban Geldrecht", "By the cabinet door.", "His profile from A Heart of Glass. Fights to keep people out of the cabinet. Yields only if the statuette is threatened."],
  ["Two off-duty Watchmen", "Upstairs, dicing.", "Cultist of the Unmarred Flesh profile. Come down at the first shout, one round late."],
  ["Two hired thugs", "Front room, by the keg.", "Thug profile. Half drunk (−10). Run if both Watchmen fall."],
], [2500, 2400, 4460]));
c.push(gm("Talking their way in is possible. Pieter or Thucydion can invoke Vielfrass’s standing invitation: Charm Challenging (+0) gets them to the bar and a cup of ale. Geldrecht is courteous, proud of the Circle, and lets nobody near the door. A PC who drinks deeply gets +20 on the Endurance test in the cabinet."));
c.push(warning("Thucydion is at 1 Wound with no Fate. Any hit that gets through kills him. Say it once before the door opens, then play it straight."));
c.push(warning("Two of these men are Watchmen. Killing them, if anyone can name the PCs afterwards, means the gallows after Sigmartag. Vielfrass and Geldrecht both know their faces. Ursula’s word will not cover them: she has no warrant."));
c.push(h2("The cabinet"));
c.push(readAloud("Derrière la porte, un petit vestibule, puis un rideau de velours violet, tiré. L’air est épais : de l’encens, des épices, de la sueur, et dessous quelque chose de sucré et de tourné que vous ne savez pas nommer. Vous écartez le rideau."));
c.push(readAloud("Sur le mur du fond, un grand cadre de bois rond, large comme les bras d’un homme. On y a tendu de la chair. Des couches de chair rose, étalées les unes sur les autres, tenues par des agrafes et des crampons de fer. Elle n’est pas sèche. Elle ne saigne pas. À la lueur de votre lanterne, les plis bougent — non, ils ne bougent pas — et dans les ombres il y a des visages, la bouche ouverte."));
c.push(labelDetailTable([
  ["The icon", "Everyone who sees it: Hard (−20) Endurance or vomit and lose their next action (+20 instead for anyone who has been drinking). No Corruption from the icon alone."],
  ["The room", "Soft cushions, silver carafes and trays (empty; 3 GC of plate if they stoop to it), a reading corner with a heap of parchments and a writing desk, and a low table with something under a purple velvet cloth."],
  ["The incense", "Very Hard (−30) Perception (smell): northern — Kislev or Norsca — with something fermented in it."],
  ["The parchments", "Vielfrass’s own drawings and verse: lewd, vain, endless. Two documents stand out (props, section 16): a sheet of gold leaf kept between two boards, and a half-finished page pinned to the desk."],
  ["The ledger", "In the desk drawer: about twenty names and initials with a column of dues, several Watchmen among them. With it, a folded letter sealed with an open eye. Do not explain the seal."],
]));
c.push(h3("Under the cloth"));
c.push(readAloud("Une statuette de marbre noir, haute comme l’avant-bras. Une figure nue, homme d’un côté, femme de l’autre. Elle tient un fouet dans une main, une épée dans l’autre, et des serpents s’enroulent à ses chevilles. Vous la regardez un instant de trop. Vos yeux vous font mal. La sueur vous coule dans le dos comme une fièvre, et vous n’avez pas envie de reposer le drap."));
c.push(labelDetailTable([
  ["Lifting the cloth", "Minor Exposure for everyone who looks: Challenging (+0) Cool or gain 1 Corruption. Carrying it wrapped is safe. Engel’s lead talismans do nothing here — they answer warpstone only. The lead coffer is too small."],
  ["Silas (7/7)", "One point triggers the threshold procedure at once: Cool test, and on a failure roll the mutation on the spot."],
  ["Pieter (7/8)", "One point brings him to the threshold."],
  ["Naming it", "Nobody in the room can. The gold leaf gives five titles; the sixth line has been scraped away. Ursula knows the name and will not say it aloud: « Il y a des noms qu’on ne prononce pas dans une pièce comme celle-ci. »"],
  ["What Ursula does", "Wraps the statuette in her own coat, takes the ledger and the gold leaf, and puts her pistol to the icon’s frame before leaving. She intends to burn the frame on the quay. If the PCs want the ledger for themselves (blackmail, Pfeffer), she refuses; Opposed Charm or a copy made in haste."],
]));
c.push(gm("Geldrecht, taken alive and shown the half-finished page, breaks. He did not know what was behind the curtain: « Il nous disait que c’était nos ancêtres. Il disait que c’était Sigmar. » He will name Vielfrass and every member to Ursula. If he dies, she goes cold but keeps her word."));
c.push(h2("22:30 — the Circle comes home"));
c.push(readAloud("Des voix sur le quai. Des rires, des bottes, une chanson de caserne braillée à douze. Une clé cherche la serrure de la porte de la rue."));
c.push(gm("Vielfrass, flushed and happy, with twelve men. Anyone still inside has two rounds. The loading door on the quay is the way out; Ursula’s fog of the Teufel does the rest (Stealth Average (+20) to vanish). They pursue for one round only in the dark. If a PC is caught, he is not killed tonight: Vielfrass wants to know who sent them — play it as the opening of the next session."));
c.push(warning("Vielfrass is not to die here if you can help it: he is the victim A Heart of Glass needs. But if the PCs stay and fight thirteen men, let the dice speak."));
c.push(gm("If the raid succeeded, Vielfrass finds the cabinet stripped. By morning the Chandlery is empty and the Circle has scattered to their homes. Geldrecht, if he escaped, knows who did this."));
c.push(h2("Ursula pays"));
c.push(readAloud("Sur le quai, le cadre brûle mal, avec une fumée grasse. Ursula le regarde un moment. Puis elle se tourne vers vous, et pour la première fois elle a l’air fatiguée."));
c.push(qfr("Ursula", "Derrière le Temple de Sigmar, il y a un salon de thé. La Coupe Pieuse. L’enseigne porte une coupe et un marteau. Des vieilles dames. Personne ne les regarde."));
c.push(qfr("Ursula", "Hannah Baumann dort à l’étage. Votre amie Ingrid aussi. Elle n’est pas prisonnière. Il faut que vous le sachiez avant d’y aller."));
c.push(qfr("Ursula", "À l’heure de l’office du soir, les vieilles et le père Ricker sont au Temple. Une heure, pas plus. Il n’y a alors qu’elles deux dans la maison."));
c.push(qfr("Ursula", "C’est Hannah qui a tué Jannik Fanger. À bout portant. J’y étais."));
c.push(gm("She will not come to the Pious Cup: she will not raise a hand against another hunter, and she will not stop them either. If pressed on why she tells them: « Ricker prêche. Hannah tue les nôtres. Je n’ai pas prêté serment pour ça. »"));
c.push(absent("If the PCs do not come: Ursula waits under the awning until she hears the Circle singing on the quay. Then she leaves. She does not offer twice. The statuette stays on its table. The only road left to Hannah is to tail Ernst Ricker when he leaves the Temple of Sigmar in the late afternoon of the 17th (Stealth Challenging (+0); he checks behind him twice)."));
c.push(music("The quay and the briefing: The Name of the Rose — “Main Titles” (James Horner). Inside: Chernobyl — “Bridge of Death” (Hildur Guðnadóttir). The cabinet: Under the Skin — “Lipstick to Void” (Mica Levi). The Circle returns: Mandy — “Forging the Beast” (Jóhann Jóhannsson)."));

// ─────────────────────────────────────────────────────────────
section("7. FLOATING SCENE — ELSA’S PRICE");
c.push(timeBox("NIGHT OF THE 16TH OR MORNING OF THE 17TH • 15 MINUTES AT THE TABLE"));
c.push(body("Ludwig and Silas only. The same back room as the branding (S7). The brazier is lit. Two men at the door. Nobody else is admitted."));
c.push(readAloud("Elsa Gruber coud. Elle ne lève pas les yeux quand vous entrez. L’aiguille passe, ressort, tire le fil. Sur la table, à côté de la bobine, il y a le fer. Il est posé dans les braises, et il a la couleur d’une cerise."));
c.push(qfr("Elsa", "Vous voilà. Je commençais à le faire chauffer pour rien."));
c.push(qfr("Elsa", "Un soir. Je vous demandais un soir chez des poètes. Et vous, vous passiez la nuit au cachot, à dire le nom du Baron à des gardes pour sauver vos peaux."));
c.push(qfr("Elsa", "Ce nom-là n’est pas à vous. Vous l’avez emprunté. Vous allez le rendre."));
c.push(body("She lets the silence run, then puts the needle down."));
c.push(qfr("Elsa", "Demain soir, Otto règle un compte. Maison Stiegler, à la huitième cloche. Vous y serez tous les deux, avec ses hommes. Vous tiendrez celui qu’on vous dira de tenir."));
c.push(qfr("Elsa", "Vous savez très bien qui."));
c.push(qfr("Elsa", "Si l’un de vous manque, s’il lâche, s’il prévient — je n’enlèverai pas la marque, Ludwig. J’enlèverai le barbier."));
c.push(gm("That is the whole price. She does not ask about the Poetry Circle again; she has written it off. She lends them to Otto to learn one thing: whether they belong to the Baron or to their friends. She does not know or care what Otto intends beyond “an example”."));
c.push(labelDetailTable([
  ["Do they warn Kaspar?", "Their choice, and the heart of the scene. Elsa has no way of knowing tonight. She will know afterwards, from how the evening goes."],
  ["Ludwig’s face — tonight", "Not visible. Elsa notices only that he keeps scratching."],
  ["Ludwig’s face — the 17th", "Opposed test: his Stealth or Entertain (Acting), with hood and scarf, against her Perception. If she sees: « Montre. … Cache ça. » She says nothing more. Her decision comes after Sigmartag: a mutant wearing the Baron’s brand is a thing to be burned out."],
  ["If they refuse to her face", "She nods to the men at the door. Silas is held and Ludwig is made to choose which of Silas’s fingers pays. Then the order stands."],
]));
c.push(absent("If Ludwig and Silas never come: nothing happens before Sigmartag. No muscle, no second note. They are simply not at the Stiegler house, and Kaspar has two fewer friends inside it. Elsa settles the account in the epilogue."));
c.push(music("Road to Perdition — “Rock Island, 1931” (Thomas Newman), very low. Or only the needle through the cloth."));

// ─────────────────────────────────────────────────────────────
section("8. THE MORNING OF THE 17TH");
c.push(timeBox("BEZAHLTAG 17TH, DAWN–NOON • 20 MINUTES AT THE TABLE"));
c.push(h2("Ludwig’s face"));
c.push(readAloud("Ludwig. Tu te réveilles avec un goût de sang dans la bouche. Sous tes doigts, l’arête de ton nez est dure, lisse, et elle n’était pas là hier. Le long de tes tempes, la peau s’est fendue en une dizaine de petites pointes sombres : des tuyaux de plume, encore pris dans leur gaine. Dans l’eau du seau, quand tu te penches, tes yeux ont une couleur de miel. Tu vois très bien. Tu vois chaque brin de paille de l’autre côté de la pièce."));
c.push(labelDetailTable([
  ["Today", "−10 Fellowship. Acute Sense (Sight) from now. Not yet Fear."],
  ["Hiding it", "Hood, scarf, hat: fine at a distance and in bad light. Face to face, or if someone has reason to look: Opposed Stealth vs Perception. In daylight at arm’s length, −10."],
  ["If seen by strangers", "A scream, a pointed finger, “mutant”. A mob forms in three rounds near the Marktplatz or the Temple. In the Dunkelfeucht people look away and remember."],
  ["Tomorrow", "A further −10 Fellowship (−20 in all), Fear 2, the head of an eagle. No hood hides it."],
]));
c.push(h2("The summons (only if Pieter did not fight)"));
c.push(body("A Watch runner finds them wherever they slept — the Dunkelfeucht keeps no secrets from a man with a writ — and serves all five. Prop in section 16."));
c.push(gm("Reikhardt Gestaltenstark has laid a complaint for assault, attempted murder and defamation. Hearing before the Burgermeister’s court in a week. It changes nothing before Sigmartag, and everything after. If Pieter fought, no runner comes."));
c.push(h2("Rest and healing"));
c.push(gm("Normal overnight recovery for those who slept. Silas may treat each PC once more today. Any wounded PC who spends the morning resting instead of acting recovers as for a full day’s rest; note who does."));
c.push(h2("The city, seen in passing"));
c.push(bullet("The Margarethe", "A Nuln barge ties up at noon. Thirty passengers come down the plank, most of them Halflings, none of them smiling, all with long bundles. Dockers step out of their way. Colour only: the Lowhaven reinforcements have landed."));
c.push(bullet("The Rat Catchers’ Guild", "Shuttered. Fritz Vogelman at the door: « Le maître est en bas depuis l’aube. Revenez ce soir. »"));
c.push(bullet("The Barracks", "Carpenters are raising a platform in front of the gate for tomorrow’s review. Bunting in the Watch’s yellow and black."));
c.push(bullet("The Herald", "No new issue. Ottokar’s shop is lit late; he is saving it for after the feast."));
c.push(h2("If they go looking (one exchange each, no new scene)"));
c.push(dataTable(["WHO", "WHAT THEY FIND"], [
  ["Engel", "The tower door stays shut. A note is pushed under it: « Cordelia m’a parlé de la poudre d’argent. Ne revenez que pour me dire la vérité. — C.E. » If they do tell it, he listens and gives nothing more: he has already given what he had."],
  ["Giordano (Bridge House Inn)", "Still 20 GC, in advance. « Les Bâtards ne descendent pas à crédit, signori. »"],
  ["Gunnar (Tin Spur)", "His word stands. « Dis-moi l’heure. »"],
  ["Friedrich von Happe", "Charming, cool. Two no-shows: the Eye has lost interest. If they bring the eye-sealed letter from the Chandlery, he reads it, smiles, and asks where they found it. Then he remembers their faces."],
  ["Isolde Blucher / the Circle", "The servant says Lady Blucher is not receiving Herr von Mounir."],
  ["Pfeffer", "Not receiving. Wendt takes a message, and takes it seriously if it names a place under the Barracks. Record exactly what is said."],
], [2600, 6760]));
c.push(music("Ludwig’s waking: Black Swan — “Nina’s Dream” (Clint Mansell). The city: no music; bells and hammers on the platform."));

// ─────────────────────────────────────────────────────────────
section("9. OPTIONAL — KURT PFENNIG");
c.push(timeBox("BEZAHLTAG 17TH, ANY TIME • 15 MINUTES AT THE TABLE • ONLY IF SILVI SPOKE"));
c.push(gm("Kurt Pfennig, fifty, ink on his cuffs, keeps the Baron’s books for the Gilded Cage and Otto’s other book besides. He lodges in a garret above the Cage. He is frightened of Otto, more frightened of the Baron, and has dreamed for two years of someone making the choice for him."));
c.push(labelDetailTable([
  ["Getting to him", "By day the Cage is Otto’s house: six men on the floor. Kaspar can walk in unchallenged until Otto’s order goes round at dusk. After 19:00 Otto’s best men are at the Stiegler house and only two remain."],
  ["Making him talk", "Intimidate or Charm, Challenging (+0); +20 if Kaspar promises the Baron will hear he cooperated. He does not hand the ledger over: he says where it is."],
  ["The ledger", "A thin black account book under a loose stair-tread in his garret. Four years of skimming, in Pfennig’s hand, with Otto’s mark against each sum."],
  ["A copy", "Ludwig can copy three damning pages in an hour (Art (Writing) or Read/Write, Average (+20))."],
]));
c.push(gm("What it is worth at the Stiegler house is in section 12. What it is worth afterwards — to Elsa, to Werner, to the Baron — is for the epilogue."));

// ─────────────────────────────────────────────────────────────
section("10. SCENE 4 — THE PIOUS CUP");
c.push(timeBox("BEZAHLTAG 17TH, BEST WINDOW 17:00–18:00 • 40–50 MINUTES AT THE TABLE"));
c.push(readAloud("Derrière le Temple de Sigmar, la rue est étroite et propre. Des géraniums aux fenêtres. Une enseigne peinte se balance au-dessus d’une porte basse : une coupe, et un marteau posé en travers. Par la vitre, vous voyez des nappes blanches, des tasses retournées sur leurs soucoupes, un chat qui dort sur une chaise. La cloche du Temple sonne l’office du soir."));
c.push(h2("The house"));
c.push(labelDetailTable([
  ["Ground floor", "Tea room, six tables. Kitchen behind, with a door to a small yard and the Temple’s back wall."],
  ["Upstairs", "Three rooms. Frau Krämer’s; a shared room with two cots (Hannah, Ingrid); a store room turned into a chapel, with a hammer on the wall and a list of names pinned beneath it — Engel’s is first, Cordelia’s is fourth, Thucydion’s description is ninth."],
  ["Who is here", "During the office: Hannah and Ingrid only. At any other hour: also Frau Ottilie Krämer and three old ladies knitting, and from late afternoon Father Ernst Ricker."],
  ["If they come at another hour", "The old ladies do not fight. They scream, they stand in doorways, and one runs for the Temple guard: six templars in five minutes. Ricker preaches at the PCs and must be struck to be silenced. Striking a priest of Sigmar is a hanging matter on any day; on the eve of Sigmartag the crowd will do it for the court."],
]));
c.push(h2("Ingrid first"));
c.push(readAloud("Elle est assise dans l’escalier, une arbalète en travers des genoux. Elle a maigri. Elle porte un marteau de fer-blanc au cou, par-dessus sa vieille veste de chasseuse. Quand elle te voit, Pieter, elle ne lève pas l’arme. Elle ferme les yeux une seconde."));
c.push(qfr("Ingrid", "Pieter. Je savais que ce serait toi. J’espérais que ce serait toi."));
c.push(qfr("Ingrid", "J’ai vu la rue s’ouvrir. J’ai vu un homme lever la main derrière sa fenêtre, et la terre avaler Aldric vivant. Tu as trouvé son bras. Moi, j’ai entendu le reste."));
c.push(qfr("Ingrid", "Jannik voulait partir. Il disait qu’il irait tout raconter : à la Garde, au sorcier, à qui voudrait l’entendre. Hannah a dit qu’il nous ferait tous brûler. Elle a tiré. C’est ce qu’elle m’a dit. C’est ce que j’ai besoin de croire."));
c.push(qfr("Ingrid", "On a chassé des primes ensemble, toi et moi. Dis-moi laquelle a rendu cette ville meilleure."));
c.push(qfr("Ingrid", "Va-t’en. Dis que la maison était vide. Ou reste, et aide-nous. Tu as vu ce qu’il y a sous cette ville. Tu sais que nous avons raison d’avoir peur."));
c.push(gm("She is not a prisoner and not a fool. She watched Jannik die and did nothing; if Hannah was wrong, then Ingrid let a friend be murdered. Believing Hannah is the only way she can live with it. She will not shoot Pieter. She will stand in the doorway."));
c.push(h3("Reaching her"));
c.push(dataTable(["WHAT PIETER SAYS OR SHOWS", "EFFECT"], [
  ["Jannik’s crossbow was unloaded. He was shot point-blank, from the front, by someone he let come close.", "The one fact she does not have. +20, and she asks Hannah the question aloud."],
  ["Ursula was there and says the same.", "+10. « Ursula a quitté Ricker. Elle dirait n’importe quoi. » But she heard it."],
  ["The Skaven are real and Hannah hunts apothecaries.", "+10."],
  ["Threats, the bounty, “you’re coming with us”.", "−20. She cocks the crossbow."],
  ["Kaspar or Thucydion speak for him.", "−10. She knows what they are."],
], [5200, 4160]));
c.push(gm("Resolve as Opposed Charm (Pieter) vs Cool (Ingrid: 45), once, after the talk has been played. Pieter wins: she lowers the crossbow, steps out of the doorway and takes no part. She does not turn on Hannah. Ingrid wins: she fights beside Hannah to drive them out, striking to stun where Pieter is concerned and to wound otherwise."));
c.push(gm("If Pieter is the one persuaded — leave them, or help them — take it seriously. Hannah accepts a truce on one condition: the elf leaves the house now. What Pieter then owes the others is theirs to settle."));
c.push(h2("Hannah Baumann"));
c.push(readAloud("Elle est debout au fond de la chapelle, dos au mur, un pistolet dans la main droite. La gauche pend, raide : elle n’a jamais tout à fait guéri. Ses cheveux ont blanchi par mèches. Elle vous regarde entrer un par un, et quand elle voit l’elfe, quelque chose s’éclaire dans son visage, quelque chose comme de la joie."));
c.push(qfr("Hannah", "Toi. Sigmar est bon. Il me rend ce qu’il m’a pris."));
c.push(qfr("Hannah", "J’ai tenu par les doigts au bord d’une fosse pendant que mes frères étouffaient sous moi. Vous croyez que j’ai peur de cinq vauriens et d’une prime ?"));
c.push(qfr("Hannah (à Ingrid, si on l’interroge sur Jannik)", "Il allait nous vendre. Je t’ai sauvée. Je recommencerais."));
c.push(labelDetailTable([
  ["Stats", "Witch Hunter profile. One pistol shot (she will not have time to reload), then sword. Left arm weak: no off-hand, no shield."],
  ["First shot", "At Thucydion, always. At 1 Wound and no Fate, a hit kills him. The player must know this before he walks up the stairs."],
  ["She does not surrender", "At 0 Wounds she can be bound. Unconscious or dead, she is worth the same."],
  ["The room", "Narrow: two attackers at a time through the door. The window gives on the yard — she will jump at a third of her Wounds (Athletics; Falling 3 yards)."],
]));
c.push(warning("No softening on the pistol. If Thucydion goes up first, roll in the open."));
c.push(h2("The bounty"));
c.push(gm("20 GC for Hannah Baumann, dead or alive, payable today where the bounty was posted. Carrying a body or a bound woman from behind the Temple of Sigmar to the paymaster at the hour the office lets out is its own scene: Stealth for the group, or a cart, or a very good lie. Ricker comes home at 18:00 to an open door."));
c.push(gm("20 GC is Giordano’s price to the coin. If they pay him tonight, the Bastards of the Reik — Leif, Gaenefys, Giordano and their swords — join the expedition, and Giordano’s account of the Skaven opens the next session."));
c.push(h2("Outcomes"));
c.push(dataTable(["OUTCOME", "WHAT FOLLOWS"], [
  ["Hannah taken or killed, Ingrid stood aside", "Bounty paid. Ingrid leaves the city tonight, alone. She tells Pieter where to write, or does not, according to how he spoke to her."],
  ["Hannah taken or killed, Ingrid fought", "Bounty paid. Ingrid, if alive, goes back to Ricker. She will be in the crowd on Sigmartag."],
  ["They walk away", "No bounty, no Bastards. Hannah’s list stays on the wall. Jacob’s inquiry is unanswered."],
  ["Hannah escapes through the window", "She reaches the Temple. By nightfall Ricker is preaching against “the sorcerer’s hired knives”, with descriptions."],
], [3600, 5760]));
c.push(absent("If they never come: Hannah and Ingrid stay where they are. No bounty: the expedition goes down with Wahlund’s handful and Gunnar, and without Mårten. Pieter does not see Ingrid again before Sigmartag — only, perhaps, a face in the crowd in front of the Barracks."));
c.push(music("The street and the tea room: The Village — “The Gravel Road” (James Newton Howard, violin Hilary Hahn). Ingrid and Pieter: The Last of Us — “All Gone (The Outside)” (Gustavo Santaolalla). Hannah: Kingdom of Heaven — “Crusaders” (Harry Gregson-Williams), then nothing but breathing."));

// ─────────────────────────────────────────────────────────────
section("11. JOHANNA’S LETTER");
c.push(timeBox("BEZAHLTAG 17TH, C. 16:00 • 5 MINUTES AT THE TABLE"));
c.push(readAloud("Kaspar. Un gamin te tire par la manche. Tu le connais de vue : le petit-fils de la vieille servante des Stiegler. Il te tend un papier plié en quatre, et il part en courant avant que tu aies pu lui poser une question. L’écriture est celle de Johanna. Elle tremble."));
c.push(body("Hand over the prop (section 16). Deliver it before the Pious Cup if you can: Kaspar should carry it through the afternoon."));
c.push(gm("Johanna wrote it at noon with Otto reading over her shoulder. Her lip is split; two of his men have been in the house since dawn. Her father was given his drug at breakfast and has not made sense since. Everything in the letter is true except the word “alone”."));
c.push(gm("Average (+20) Intuition on the letter: she never calls him “mon Kaspar”. Challenging (+0): the ink changes halfway through the last line, as though she stopped and was made to go on."));
c.push(music("None."));

// ─────────────────────────────────────────────────────────────
section("12. SCENE 5 — THE STIEGLER HOUSE");
c.push(timeBox("BEZAHLTAG 17TH, 20:00 • 45–50 MINUTES AT THE TABLE"));
c.push(warning("Before anything else: KASPAR’S ARMOUR COMES OFF. The servant takes his cloak at the door; the men take the rest the moment they step out. Mail coat, coif, bracers, gauntlets, weapons, the lead talisman. He faces Otto in his shirt."));
c.push(h2("The street"));
c.push(readAloud("La rue des Stiegler est une rue de marchands : des façades à pignons, des volets peints, une fontaine. Ce soir, elle est calme. Un charretier répare une roue sous une lanterne. Deux hommes fument sur un banc. Un troisième dort contre la fontaine, le chapeau sur les yeux."));
c.push(gm("A dozen of Otto’s men hold the street and the back lane. For Kaspar, or anyone following: Challenging (+0) Perception — the wheel is not broken, the sleeper’s hand is on a cudgel, and there are too many men for one quiet street. Kaspar knows the carter by name. Followers who fail are noticed: two men drift in behind them."));
c.push(h2("The door"));
c.push(readAloud("C’est la vieille Betke qui t’ouvre. Elle t’a connu gamin, Kaspar ; elle te donnait des pommes. Ce soir elle ne te regarde pas. Elle dit : « Mademoiselle vous attend au salon », d’une voix trop haute, et ses mains tremblent sur le loquet. Elle prend ton manteau. Elle le tient serré contre elle, comme pour t’empêcher de le reprendre."));
c.push(h2("The hall"));
c.push(gm("Average (+20) Perception, in the hall: mud on the stair carpet, far too much for one household. Eleven cups on the sideboard. A floorboard creaks overhead and stops. Behind the dining-room door, someone is holding his breath. There are two dozen men in the house. If he turns round, the front door has closed and the carter is standing in front of it."));
c.push(h2("The drawing room"));
c.push(readAloud("Otto Gault est assis à la table des Stiegler. Il mange. Un poulet entier, du pain blanc, le vin de la maison. Il a noué une serviette brodée à son cou. En face de lui, le père de Johanna sourit à son assiette vide et parle, d’une voix douce, de comètes, d’un cheval qu’il a eu, de la couleur du mercredi. Otto lui répond poliment, entre deux bouchées. Johanna est debout près de la cheminée. Elle a la lèvre fendue. Elle te regarde, et elle secoue la tête, à peine."));
c.push(qfr("Otto", "Kaspar. Entre. Tu as mangé ? Non, ne t’assieds pas."));
c.push(h2("The men"));
c.push(readAloud("Les portes s’ouvrent. Celle de la salle à manger, celle du couloir, celle de l’office. Ils entrent sans se presser, et tu les connais tous."));
c.push(dataTable(["WHO", "WHAT KASPAR REMEMBERS (READ ALOUD)"], [
  ["Dieter « Deux-Doigts » Hass", "C’est lui qui t’a appris à tenir un couteau. Il te salue du menton."],
  ["Uwe et Karl Brandt", "Les frères. Il y a sept jours, ils étaient à ta gauche dans l’escalier de la Cage."],
  ["Le vieux Henning", "Il t’a donné ton premier travail : surveiller une porte, une nuit entière, pour un sou."],
  ["Matthes le Rouge", "Tu lui as prêté trois pistoles cet hiver, pour enterrer sa fille. Il ne te les a jamais rendues."],
  ["Jochen « Sourire »", "Seize ans. Depuis la Cage, il raconte ton duel avec Bella à qui veut l’entendre. Il regarde ses bottes."],
  ["Rolf Vane", "Près de la porte, le bras en écharpe. Il n’est là que pour faire nombre, et il le sait."],
], [3000, 6360]));
c.push(gm("If Ludwig and Silas obeyed Elsa, they come in with the others. Otto points: « Le poète, le bras gauche. Le barbier, tu regardes. On aura besoin de toi après. » Rolf sees his brother and looks away. Kaspar is stripped now: armour, weapons, talisman, piled on the Stieglers’ sofa."));
c.push(h2("Otto’s speech — the clock"));
c.push(body("Six beats. Each is a moment where someone can act. If nothing has changed by the sixth, the hand is crushed."));
c.push(step("One", "« Je t’avais demandé une chose. Une seule. Et hier soir, j’ai vu Scite saluer la foule. »"));
c.push(step("Two", "« On me dit que tu es sorti du trou en criant le nom du Baron. Tu sais ce que ça m’a fait ? Rien. Le Baron a le dos large. »"));
c.push(step("Three", "« Tu es doué. C’est ça, l’ennui. Bella Lowhaven, la Cage, l’arène… Les gars te regardent. Alors ce soir, ils regardent. »"));
c.push(step("Four", "« Je ne vais pas te tuer. Un mort, on le pleure et on l’oublie. Toi, je veux qu’on te croise tous les jours. »"));
c.push(step("Five", "« Tenez-le. La droite. Sur la table. » (He moves the chicken aside and wipes the cloth with his napkin.)"));
c.push(step("Six", "He picks up the hammer he is named for."));
c.push(readAloud("Le père de Johanna rit doucement, pour lui-même. Dans la rue, une cloche sonne le quart. Personne dans la pièce ne te regarde en face, Kaspar. Sauf Otto."));
c.push(warning("If the sixth beat comes, do it. Kaspar’s right hand is destroyed: every bone, beyond surgery. Treat it as a lost hand that is still attached — no weapon, no fine work, no two-handed grip; a shield can be strapped to the forearm. No Fate point undoes a maiming. Describe the sound, Johanna’s face, and the door closing. Nothing else."));
c.push(h2("Levers"));
c.push(dataTable(["LEVER", "HOW", "RESULT"], [
  ["Silas: “let me do it”", "Charm vs Otto’s Cool (50): a surgeon breaks it cleaner, and the hand never works again — he swears it. Then Heal Challenging (+0) to break what will mend.", "Two fingers and the wrist. −20 with that hand for a month, then whole. Otto finds out in a month. Elsa is told Silas obeyed."],
  ["Ludwig lets go", "Kaspar: Opposed Strength vs Dieter, +20.", "Kaspar is loose in a room of twenty-four men. One round. The window gives on the street."],
  ["The ledger, in hand, with a copy elsewhere", "Shown or read aloud in front of the men. No test.", "Otto goes grey. He has Kaspar beaten (to 0 Wounds, no maiming) to save face and walks out. He will kill them all after the feast if he can."],
  ["The ledger, bluffed", "Opposed Charm or Intimidate vs Otto’s Cool, −10. Naming Kurt Pfennig gives +20.", "Success: Otto stops at beat five and sends two men to the Cage. Fifteen minutes. Failure: he laughs and skips to six."],
  ["A forged order from the Baron or Elsa", "Ludwig, prepared in advance: Art (Writing) Hard (−20).", "Otto reads it twice and sends a runner to check. Twenty minutes; then he knows, and it is worse for Ludwig than for Kaspar."],
  ["The Watch", "Before 19:30, to Wendt or a sergeant: armed men holding a burgher’s family on the eve of Sigmartag. Charm Challenging (+0), −10 for who they are.", "Eight Watchmen and whistles at beat four. The gang leaves by the back lane. Hand saved. Everyone in the Dunkelfeucht knows who called the Watch."],
  ["Mercy Lowhaven", "Sell her Kaspar’s whereabouts through Satrioli’s. She pays the 20 GC.", "At beat five the Margarethe’s fighters hit the street. Three sides, two dozen dead, Johanna and her father in the middle. Kaspar may crawl out — or leave in a Lowhaven sack."],
  ["Fire, noise, a diversion", "Their usual method.", "The street men run to it. Inside, Otto does not turn his head. He goes straight to beat five. A fire here is a fourth fire, in a house with Johanna in it."],
  ["Johanna", "Reached during the afternoon (the house is watched: Stealth Hard (−20)).", "She cannot unsend the letter. She can leave the scullery door unbarred. One way in that the street men do not watch."],
  ["Force", "Five battered people against thirty-six.", "They lose. Otto maims Kaspar in front of his friends and has the rest thrown into the street."],
], [2300, 3700, 3360]));
c.push(gm("Otto: use a gang boss or champion-grade thug profile, WS 55, Cool 50, his two-handed hammer. He does not need to fight tonight and will not, unless someone reaches him. His men: Thug profile. None of them wants this. None of them will stop it."));
c.push(gm("If Pieter beat Eisfange last night, the men know it: +10 to any Intimidate he makes in this house."));
c.push(h2("After"));
c.push(readAloud("Otto repose le marteau sur la nappe. Il s’essuie les mains. Puis il se tourne vers la cheminée, et sa voix change : elle devient presque douce."));
c.push(qfr("Otto", "Mademoiselle Stiegler. Vous avez fait ce qu’il fallait. Votre père ne manquera de rien, j’y veillerai personnellement."));
c.push(qfr("Otto", "Demain, c’est jour de fête. Je vous emmène voir la revue. Une femme comme vous mérite mieux qu’un homme à qui il manque une main."));
c.push(qfr("Johanna", "J’ai fait ce que vous demandiez. Sortez de chez moi."));
c.push(readAloud("Il rit, sans méchanceté, comme on rit d’un enfant. Il prend son manteau. Sur le seuil, il dit : « Je repasserai. » Les hommes sortent derrière lui, un par un. Le petit Jochen est le dernier. Il s’arrête, il ouvre la bouche, et il ne trouve rien."));
c.push(gm("Johanna will not go with Otto, tomorrow or ever, and he will come back. That is for after the campaign. Tonight she tends Kaspar herself if he lets her, and she does not ask him to forgive her. Her father asks who the gentleman was."));
c.push(gm("Silas, afterwards: Heal stops the bleeding and the fever. It does not give the hand back. If he was in the room and only watched, give the player a moment with that."));
c.push(absent("If Kaspar does not come (or has left the city): Otto waits until the ninth bell. Then he has the father dosed, cup after cup, until the old man stops answering to his name; he will not come back from it. The men are sent out of the room. The door closes. Betke stands in the hall with her apron over her face. In the morning Johanna opens the shop as usual, and does not speak. Kaspar learns it from the grandson, or from Ottokar — her brother — who knows exactly whom to blame."));
c.push(music("Silence from the street to the drawing room: only the old man talking. When the doors open: Road to Perdition — “Ghosts” (Thomas Newman). After Otto leaves: The Assassination of Jesse James — “Song for Bob” (Nick Cave & Warren Ellis)."));

// ─────────────────────────────────────────────────────────────
section("13. CLOSING — WAHLUND COMES UP");
c.push(timeBox("BEZAHLTAG 17TH, LATE • 10 MINUTES AT THE TABLE"));
c.push(readAloud("À la Guilde des Ratiers, la grille de l’égout est ouverte. Ils remontent un par un, noirs de vase jusqu’aux épaules. Melina. Rickard. Anders, le bras encore en attelle. Puis Wahlund, qui porte Mårten sur son dos comme un sac. Il le pose sur la table de la salle commune. Le jeune homme respire. Sa jambe ne ressemble plus à une jambe."));
c.push(qfr("Wahlund", "Ils creusent. Plus vite qu’avant. Des galeries neuves, étayées de frais, qui partent du repaire vers le sud, sous la vieille ville. On n’a pas pu les suivre : ils ont doublé les sentinelles."));
c.push(qfr("Wahlund", "Mårten ne descendra pas demain. Moi, si. Avant le jour. Avec vous ou sans vous."));
c.push(qfr("Melina", "Vous avez des têtes à faire peur. Dormez. On frappe à votre porte à la quatrième cloche."));
c.push(gm("Rendezvous: the Guild sewergate, before first light on Sigmartag. Wahlund, Anders, Rickard, Melina; Gunnar if someone told him the hour; the Bastards of the Reik if Giordano was paid. Mårten is out. Günther is still locked in the Guild’s cellar; Wahlund has not decided."));
c.push(gm("End the session on the count: who is going down, with which wounds, with how many hands. Then: the bells of the eve of Sigmartag."));
c.push(music("Return of the Obra Dinn — “Soldiers of the Sea” (Lucas Pope)."));

// ─────────────────────────────────────────────────────────────
section("14. NPCs — NEW OR CHANGED");
c.push(dataTable(["NPC", "WHO THEY ARE"], [
  ["Rolf Vane", "Silas’s brother, Lowhaven mole, arm in a sling since the Cage. Elsa’s messenger; one of Otto’s men at the Stiegler house."],
  ["Kurt Pfennig", "Otto’s bookkeeper. Garret above the Gilded Cage. Knows where the second ledger is."],
  ["Frau Betke", "The Stieglers’ old servant. Knew Kaspar as a boy. Her grandson carries the letter."],
  ["Herr Stiegler", "Johanna’s father. Marked by the Seven Veils; drugged into a waking dream by Otto for the evening."],
  ["Otto’s men", "Dieter “Deux-Doigts” Hass, Uwe and Karl Brandt, old Henning, Matthes le Rouge, Jochen “Sourire”. Prep names: every one of them a memory of Kaspar’s."],
  ["Frau Ottilie Krämer", "Keeps the Pious Cup. Devout, kind to strays, certain that Hannah is a saint."],
  ["Geldrecht", "Did not know what was behind the curtain. Breaks if shown Vielfrass’s page."],
  ["Eisfange", "At two-thirds Wounds, with a fresh scar on the left flank from Saif al-Janub."],
], [2800, 6560]));

// ─────────────────────────────────────────────────────────────
section("15. MUSIC — SUMMARY");
c.push(dataTable(["SCENE", "TRACK", "SOURCE"], [
  ["Outside the Barracks", "“Instrument of Surrender” — Sea Power", "Disco Elysium (game)"],
  ["Felix’s return", "“Anvil of Crom” — Basil Poledouris", "Conan the Barbarian (film)"],
  ["Eisfange enters", "“Into the Fray” — Marc Streitenfeld", "The Grey (film)"],
  ["The bout", "“The Demon God” — Joe Hisaishi", "Princess Mononoke (film)"],
  ["The quay, Ursula", "“Main Titles” — James Horner", "The Name of the Rose (film)"],
  ["Inside the Chandlery", "“Bridge of Death” — Hildur Guðnadóttir", "Chernobyl (series)"],
  ["The cabinet", "“Lipstick to Void” — Mica Levi", "Under the Skin (film)"],
  ["The Circle returns", "“Forging the Beast” — Jóhann Jóhannsson", "Mandy (film)"],
  ["Elsa", "“Rock Island, 1931” — Thomas Newman", "Road to Perdition (film)"],
  ["Ludwig’s waking", "“Nina’s Dream” — Clint Mansell", "Black Swan (film)"],
  ["The Pious Cup", "“The Gravel Road” — James Newton Howard", "The Village (film)"],
  ["Ingrid and Pieter", "“All Gone (The Outside)” — Gustavo Santaolalla", "The Last of Us (game)"],
  ["Hannah", "“Crusaders” — Harry Gregson-Williams", "Kingdom of Heaven (film)"],
  ["The men step out", "“Ghosts” — Thomas Newman", "Road to Perdition (film)"],
  ["After Otto", "“Song for Bob” — Nick Cave & Warren Ellis", "The Assassination of Jesse James (film)"],
  ["Wahlund comes up", "“Soldiers of the Sea” — Lucas Pope", "Return of the Obra Dinn (game)"],
], [2200, 4160, 3000]));
c.push(gm("Silence: Johanna’s letter; the Stiegler house from the street to the moment the doors open; the stairs of the Pious Cup once the pistol is level."));

// ─────────────────────────────────────────────────────────────
section("16. PLAYER PROPS");
c.push(h3("The gold leaf — Vielfrass’s cabinet, kept between two boards"));
c.push(prop([
  "Prince du Plaisir,",
  "Celle qui a Soif,",
  "notre Tentateur,",
  "Loesh le Serpent,",
  "Shornaal l’Orgueilleux,",
  "[la sixième ligne a été grattée jusqu’à la feuille]",
]));
c.push(h3("The half-finished page — pinned to Vielfrass’s writing desk"));
c.push(prop([
  "Heske Glazer. Elle sait quelque chose. Toujours à me suivre, à m’épier. Sa boutique a brûlé et on la cache, mais je la trouverai.",
  "Peut-être connaît-elle la vérité. Notre vérité. Je crains qu’elle ne nous démasque.",
  "Je sais que vous m’avez commandé de ne nous mêler que de recrutement et de subversion. Mais Glazer sera notre perte si elle reste en vie.",
  "Je peux convaincre Orban de le faire. J’inventerai un mensonge ; je n’aurai même pas à y réfléchir. Le pauvre brûle tant d’amour pour moi qu’il ferait n’importe quoi.",
  "Lui et les autres imbéciles n’ont toujours pas la moindre idée de notre véritable but.",
  "Je la tuerai avant qu’elle ne me",
]));
c.push(h3("Summons — served on the morning of the 17th, only if Pieter did not fight"));
c.push(prop([
  "COUR DU BURGERMEISTER D’UBERSREIK — CITATION À COMPARAÎTRE",
  "Sur plainte du sieur Reikhardt Gestaltenstark, champion de la Compagnie Estimée,",
  "le nommé ______________ est cité à comparaître devant la cour, le Marktag 22 Sigmarzeit, à la troisième cloche,",
  "pour y répondre des chefs de coups et blessures, tentative de meurtre, et diffamation publique.",
  "Il lui est interdit de quitter la ville et ses faubourgs. Tout défaut vaudra aveu.",
  "Fait à la caserne de la Garde, le 17 Sigmarzeit. — Sgt. K. Bleich",
]));
c.push(h3("Johanna’s letter — carried by Betke’s grandson, c. 16:00"));
c.push(prop([
  "Kaspar,",
  "Il faut que tu viennes ce soir. À la maison, à la huitième cloche.",
  "Des hommes sont venus pour mon père. Il leur doit plus que je ne croyais, et à des gens que tu connais. Ils reviendront cette nuit. Je n’ai personne d’autre.",
  "Viens seul. Je t’en prie. S’ils voient du monde avec toi, ils s’en prendront à lui.",
  "Mon Kaspar, pardonne-moi de te demander cela.",
  "J.",
]));

// ─────────────────────────────────────────────────────────────
section("17. TRACKING — NOTE DURING PLAY");
c.push(dataTable(["TOPIC", "RECORD"], [
  ["Confirmations", "Vielfrass denounced to Pfeffer? Noise under the gaol shared? Carrier of the coffer and tongs."],
  ["The split", "Who went to the Tin Spur, who to the Chandlery, who to Elsa, and when."],
  ["Eisfange", "Fought, forfeited or cheated; outcome; Pieter’s Wounds, Critical Wounds, Fate; purse. Did he carry Saif al-Janub?"],
  ["Silvi", "Ledger and Pfennig given? To whom did she speak?"],
  ["Otto at the Tin Spur", "Did he see Kaspar in the hall?"],
  ["Chandlery", "Way in. Geldrecht alive? Watchmen killed, and by whom? Who saw the statuette; Corruption gained; Silas’s threshold. Who holds the ledger and the eye-sealed letter. Out before 22:30? Anyone recognised?"],
  ["Ursula", "Paid? What she told them about Jannik."],
  ["Elsa", "Did they go, when; did she see Ludwig’s face; did they warn Kaspar."],
  ["Summons", "Served or not."],
  ["Pfennig", "Ledger found? Copy made? Who knows."],
  ["Pious Cup", "Hour of the visit. Ingrid’s test and what Pieter said. Hannah taken, killed, escaped or left. Thucydion alive? Bounty paid; Giordano paid."],
  ["Stiegler house", "Did Kaspar go; who followed; which lever; at which beat. THE HAND. Johanna and her father. What Ludwig and Silas did, and what Elsa will hear."],
  ["Expedition roster", "Who goes down at first light, in what state."],
], [2520, 6840]));
c.push(h2("Deadlines don’t go away"));
c.push(bullet("Sigmartag 18th, before first light", "The expedition (dedicated dungeon-crawl session)."));
c.push(bullet("Sigmartag 18th", "Pfeffer’s review in front of the Barracks — K&H and the Skaven detonate it unless stopped. Ludwig’s eagle head complete. Otto has promised Johanna the review."));
c.push(bullet("After the feast", "Elsa’s account with Ludwig and Silas. Reikhardt’s hearing, if summoned (Marktag 22nd). Otto and the ledger. The Herald’s last issue."));
c.push(bullet("Dormant", "Günther in the Guild cellar; Grodni’s favour; Mercy’s bounty and the Margarethe fighters; Doktor Grat; the fled Carmello goon; Engel; Nacht via Franz; Vielfrass, alive, for A Heart of Glass."));

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
    run("Session 22 — Debts Come Due — ", { font: "Arial", size: 16, color: C.grey }),
    new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.grey }),
  ],
})] });

const doc = new Document({
  creator: "Ubersreik Campaign",
  title: "Session 22 — Debts Come Due",
  description: "GM guide: the Tin Spur, Kessel’s Chandlery, Elsa’s price, the Pious Cup and the Stiegler house.",
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
const outputPath = path.join(outputDir, "Session 22 - Debts Come Due.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generated ${outputPath} (${c.length} blocks, ${buffer.length} bytes)`);
