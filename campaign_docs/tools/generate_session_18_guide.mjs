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
  spacing: { before: 100, after: 160, line: 290 },
  children: [
    run(`${label} — `, { font: "Arial", size: 20, bold: true, color: options.color || C.gold }),
    run(text, { size: 21, italics: options.italics }),
  ],
});

const gm = (text) => callout("GM", text, { fill: C.goldFill, color: C.gold });
const warning = (text) => callout("WARNING", text, { fill: C.redFill, color: C.red });
const absent = (text) => callout("ABSENCE CONSEQUENCE", text, { fill: C.purpleFill, color: C.purple });
const music = (text) => callout("MUSIC", text, { fill: C.blueFill, color: C.music });

const readAloud = (text) => new Paragraph({
  shading: { fill: C.tanFill, type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 14, color: C.warm, space: 8 } },
  indent: { left: 420, right: 240 }, spacing: { before: 100, after: 160, line: 320 },
  children: [run(text, { italics: true, color: "3A2010" })],
});

const timeBox = (text) => new Paragraph({
  shading: { fill: C.greenFill, type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 14, color: C.green, space: 7 } },
  spacing: { before: 180, after: 120, line: 290 }, keepNext: true,
  children: [run(text, { font: "Arial", size: 24, bold: true, color: C.green })],
});

const quote = (speaker, text) => new Paragraph({
  indent: { left: 520, right: 280 }, spacing: { before: 80, after: 120, line: 290 },
  children: [
    run(`${speaker}: `, { font: "Arial", size: 20, bold: true, color: C.darkRed }),
    run(`« ${text} »`, { size: 21, italics: true }),
  ],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const cellParagraph = (text, options = {}) => new Paragraph({
  spacing: { before: 20, after: 20, line: 270 }, alignment: options.alignment || AlignmentType.LEFT,
  children: [run(String(text), {
    font: options.font || "Georgia", size: options.size || 20,
    bold: options.bold, color: options.color || C.ink,
  })],
});

const dataTable = (headers, rows, widths, alignments = []) => new Table({
  width: { size: PAGE.content, type: WidthType.DXA }, indent: { size: 120, type: WidthType.DXA },
  layout: TableLayoutType.FIXED, columnWidths: widths,
  margins: { top: 80, bottom: 80, left: 120, right: 120 }, borders,
  rows: [
    new TableRow({
      tableHeader: true, cantSplit: true,
      children: headers.map((header, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        shading: { fill: C.blueFill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
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
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [cellParagraph(value, {
          bold: index === 0, color: index === 0 ? C.darkRed : C.ink,
          alignment: alignments[index] || AlignmentType.LEFT,
        })],
      })),
    })),
  ],
});

const labelDetailTable = (rows) => dataTable(
  ["AT A GLANCE", "READY TO RUN"], rows, [2160, 7200],
  [AlignmentType.LEFT, AlignmentType.LEFT],
);

const diagram = (lines) => new Paragraph({
  shading: { fill: C.greyFill, type: ShadingType.CLEAR }, border: borders,
  indent: { left: 120, right: 120 }, spacing: { before: 80, after: 160, line: 240 },
  children: lines.map((line, index) => run(line, {
    font: "Courier New", size: 17, color: C.ink, break: index === 0 ? undefined : 1,
  })),
});

const c = [];
c.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 },
  children: [run("GM GUIDE — SESSION 18", { font: "Arial", size: 20, bold: true, color: C.gold, smallCaps: true })],
}));
c.push(new Paragraph({
  style: "CampaignTitle", alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60, line: 520 },
  children: [run("A BIRTHDAY BEFORE THE FIRE", { font: "Arial", size: 52, bold: true, color: C.darkRed })],
}));
c.push(new Paragraph({
  style: "CampaignSubtitle", alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80, line: 320 },
  children: [run("The Circle, the Temple, and the Red Moon", { font: "Arial", size: 29, bold: true, color: C.red })],
}));
c.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 260, line: 280 },
  children: [run("Wellentag 13th night → Aubentag 14th", { font: "Arial", size: 22, italics: true, color: C.grey })],
}));

c.push(h1("1. AT A GLANCE"));
c.push(labelDetailTable([
  ["Opening", "Thucydion completes his solitary pursuit of the Circle of Unmarred Flesh and may notice Ursula Marbad watching the same hidden headquarters."],
  ["Morning weight", "The Hog Pit is gone: four confirmed dead, two missing, three neighboring homes lost or condemned, and about fifteen households displaced."],
  ["Daytime paths", "Silvi pays 30 GC and gives Kaspar a Lowhaven dossier; the PCs may question Jacob Möhren at the High Temple and earn a quiet mandate to investigate Ernst Ricker."],
  ["Main event", "Franz reveals four enemies and presents a workable plan for Red Moon Burning. The PCs must improve it, assign roles, and prepare before the inn closes."],
  ["Expected endpoint", "At the current pace, end as the Red Moon closes in late afternoon or when the first scratching sounds in the chimney at 9 PM."],
  ["Table time", "3–4 hours. All five players are expected. Do not force the complete assault into this session."],
]));
c.push(gm("The session is about pressure accumulating around a plan. Give the PCs genuine room to alter Franz's proposal. The published attack schedule remains the GM's clock, not information Franz can predict precisely."));
c.push(warning("The explosion is tomorrow's second deliberate urban fire. Even if the inn is cleared, witnesses and patterns matter. Ottokar does not yet have proof, but he has started assembling a story."));

c.push(h2("1.1 Table timeline"));
c.push(dataTable(
  ["TABLE", "IN-GAME", "SCENE", "TARGET"],
  [
    ["0:00–0:35", "13th, late night", "Circle headquarters", "Location + Ursula glimpse"],
    ["0:35–0:50", "Near midnight", "Reunion", "Share only what was learned"],
    ["0:50–1:25", "14th, morning", "Aftermath + Silvi", "Human cost, payment, dossier"],
    ["1:25–2:15", "Late morning", "High Temple", "Jacob's information gate"],
    ["2:15–3:00", "Early afternoon", "Franz's council", "Threats, plan, assignments"],
    ["3:00–3:45", "Afternoon", "Preparations", "Two strong advantages at most"],
    ["3:45–4:00", "Late day / 9 PM", "Closing image", "Doors close or attack begins"],
  ],
  [1380, 1740, 2760, 3480],
));

c.push(pageBreak());
c.push(h1("2. WELLENTAG NIGHT — THE UNMARRED FLESH"));
c.push(timeBox("LATE NIGHT — THUCYDION ALONE — 30 TO 35 MINUTES"));
c.push(readAloud("Les hommes ne prennent pas le chemin des tavernes. Ils longent les quais, passent deux entrepôts encore éclairés, puis s'engagent dans une ruelle où même les rats semblent éviter les flaques. Au bout se dresse une ancienne chandellerie : briques noircies, fenêtres murées au rez-de-chaussée, palan rouillé au-dessus d'une porte de chargement. L'un des gardes frappe trois fois, attend, puis deux fois. La porte s'ouvre juste assez pour laisser passer les hommes et ce qu'ils transportent sous la toile."));
c.push(body("The hidden headquarters is Kessel's Chandlery, a disused soap-and-candle warehouse on the eastern docks. Its ordinary name is useful camouflage; nothing on the facade names the Circle."));

c.push(h2("2.1 What patient surveillance reveals"));
c.push(bullet("No test", "The address, main loading door, two upper windows, and the three-then-two knock."));
c.push(bullet("Average Perception (+20)", "A second entrance opens into the cooper's yard behind the chandlery. Several visitors carry Watch boots or belts under civilian cloaks."));
c.push(bullet("+2 SL", "The covered object is moved with reverence rather than ordinary care. Geldrecht is inside; Vielfrass is not currently visible."));
c.push(bullet("+3 SL", "A lone woman in a weather-dark cloak is watching from a loft opposite: Ursula Marbad."));
c.push(bullet("Failure", "Thucydion still finds the headquarters, but a sentry notices movement. The Circle gains a description of a tall, pale watcher."));

c.push(h2("2.2 Thucydion and Ursula"));
c.push(body("Resolve their awareness independently. Thucydion uses Perception; Ursula uses Perception 58. Each opposes the other's Stealth. Ursula does not know who he is and never initiates contact."));
c.push(dataTable(
  ["RESULT", "WHAT HAPPENS"],
  [
    ["Neither sees the other", "Thucydion records the headquarters; Ursula remains an unseen parallel investigator."],
    ["Thucydion sees Ursula", "He notices a disciplined watcher with a weathered pistol at her belt. She leaves before he can close safely."],
    ["Ursula sees Thucydion", "She marks his face and elven features, then withdraws. At the Temple tomorrow, she recognizes him immediately."],
    ["Both see each other", "A long moment across the alley. Neither knows the other's allegiance. Ursula breaks contact first."],
  ],
  [2460, 6900],
));
c.push(readAloud("Une silhouette se détache un instant dans la lucarne d'en face. Une femme, immobile, le col relevé contre la nuit. Sous son manteau, la crosse d'un vieux pistolet porte des marques de rouille. Son regard balaie la chandellerie — puis s'arrête, peut-être, dans votre direction."));

c.push(h2("2.3 If Thucydion attempts entry"));
c.push(step("Cross the yard", "Hard Stealth (−20). Failure raises the alarm quietly: two guards close the exits and search rather than shouting."));
c.push(step("Choose an entrance", "Roof: Difficult Athletics (−10), then Average Pick Lock (+20). Cooper's yard: opposed Stealth against Perception 45. Main door requires the knock and a convincing reason."));
c.push(step("Take one fact", "On success, choose one: the covered idol is guarded constantly; names of three Watch members; a ledger referencing private gatherings; or a locked chamber prepared for initiations."));
c.push(step("Get out", "Another Hard Stealth (−20), eased to Challenging (+0) if he created a diversion before entry."));
c.push(warning("Do not reveal Slaanesh, explain the idol, or turn this into the Circle's decisive confrontation. A failed escape can produce wounds, pursuit, or arrest, but Geldrecht wants the intruder identified more than killed."));
c.push(absent("If Thucydion's player is unexpectedly absent, narrate a minimal success: he locates Kessel's Chandlery but does not see Ursula and does not attempt entry."));
c.push(music("Dishonored — 'Streets of Dunwall', or sparse dockside ambience with distant rigging and little melody."));

c.push(h2("2.4 Reunion and the midnight cut"));
c.push(body("The others return to the Red Moon while smoke still hangs above Wandiene. Allow Thucydion to report, let the group decide whether this becomes tomorrow's priority, then cut to sleep. Franz refuses to discuss explosives while exhausted staff and ordinary guests are still present."));
c.push(quote("Franz", "Demain, portes fermées, rideaux tirés, et personne qui ne sache garder sa langue. Ce soir, vous dormez."));

c.push(pageBreak());
c.push(h1("3. AUBENTAG MORNING — WHAT THE FIRE COST"));
c.push(timeBox("MORNING — WANDIENE AND THE CROOKED HAMMER — 30 TO 40 MINUTES"));
c.push(readAloud("Au matin, la fumée a pris l'odeur des couvertures mouillées et du bois froid. De la Fosse, il ne reste qu'une carcasse de poutres noires. Trois maisons voisines portent une croix de craie sur leur porte : trop fragiles pour qu'on y rentre. Devant la Bonne Épouse, des familles comptent ce qu'elles ont sauvé dans des paniers. Quatre corps ont été retrouvés. Deux personnes manquent encore."));
c.push(bullet("Confirmed toll", "Hog Pit destroyed; three neighboring homes burned or condemned; around fifteen households displaced; four confirmed civilian deaths and two missing."));
c.push(bullet("What is not known", "Nobody has publicly identified Kaspar as the fire-setter. Survivors describe several armed people, panic, and a hooded man fighting at the rear."));
c.push(bullet("The Good Wife", "Helga organizes blankets and food. Silas can treat smoke inhalation. Help is accepted without creating a compulsory relief mission."));
c.push(bullet("Ottokar", "He collects names, descriptions, and the history of other recent fires. He is curious, not accusatory. A PC lie becomes useful material if later contradicted."));
c.push(bullet("Mercy's response", "Lowhaven mourners keep away from the Watch and quietly question survivors. Oswin has heard Kaspar's name but has not connected it to the disguised killer."));
c.push(gm("Let the consequences exist in front of the players, then respect their choice to help, investigate, donate, or walk on. Do not use anonymous NPC omniscience to accuse them."));

c.push(h2("3.1 Personal pressure"));
c.push(bullet("Kaspar", "A survivor recalls the build and voice of the hooded man near the rear exit. Recognition is possible later, not automatic now."));
c.push(bullet("Pieter", "A witness remembers Oswin pulling Mab clear. This confirms both survived and gives Pieter a reason to believe his friendly conversation mattered."));
c.push(bullet("Silas", "An Average Heal (+20) test meaningfully helps three victims and earns Helga's trust; failure still provides labor and comfort."));
c.push(bullet("Ludwig", "Grimski asks who profits when poor districts burn. His instinct is to turn the scene into agitation."));
c.push(bullet("Thucydion", "His solitary discovery competes for attention with a visible disaster. Let him decide how urgently he pushes the Circle thread."));
c.push(music("Darkest Dungeon — 'The Hamlet', kept low beneath conversation."));

c.push(h2("3.2 Silvi pays and warns"));
c.push(readAloud("Silvi pose la bourse sur la table sans cérémonie. Elle sonne lourdement : trente couronnes, comme promis. Puis elle garde la main sur une seconde liasse, ficelée de rouge. « Ceci est pour Kaspar. Des noms, des liens de sang, des commerces. Certains dirigent. D'autres ne sont que des cousins à qui Mercy a confié un couteau. Ne confondez pas les deux. »"));
c.push(bullet("Payment", "30 GC, paid now. No deduction for the fire: Silvi bought Felix alive, and that is what the PCs delivered."));
c.push(bullet("Felix", "Hidden and recovering. He remains concealed until the Tin Spur match on the 16th."));
c.push(bullet("The dossier", "Give Kaspar Handout B at the end of this guide. Silvi's certainty varies by entry."));
c.push(quote("Silvi", "Mercy a perdu une nièce, une arène et beaucoup d'hommes. Ce n'est pas le moment où elle devient faible. C'est le moment où elle cesse de compter le prix."));

c.push(pageBreak());
c.push(h1("4. THE LOWHAVEN BRANCH — GM REFERENCE"));
c.push(body("The Ubersreik branch is an extended family business. Mercy's authority comes from competence and patronage, not motherhood. Her two children are away learning under other Lowhaven branches and have no active role in Ubersreik."));
c.push(diagram([
  "OLD NAN CLEMENCY LOWHAVEN (dead)",
  "|",
  "+-- MERCY LOWHAVEN (Ubersreik matriarch; widow)",
  "|   +-- Hope Lowhaven (with the Altdorf branch; absent)",
  "|   +-- Fortune Lowhaven (with the Nuln branch; absent)",
  "|",
  "+-- Larkspur Lowhaven (Mercy's late elder sister)",
  "|   +-- Bella Lowhaven (dead)",
  "|   +-- Mab Lowhaven (vice and pit operations)",
  "|   +-- Oswin 'Spike' Lowhaven (security and marksmen)",
  "|",
  "+-- Tobin Lowhaven + Pippa Shufflepig (Mercy's younger brother and wife)",
  "    +-- Pip 'Shufflepig' Shufflepig (warehouses; favorite, inept nephew)",
  "",
  "DISTANT HOUSEHOLDS: Prosperity, Sunny, Cora 'Crumbs', Merry, Tolly, Juniper",
]));

c.push(h2("4.1 Mercy's current lieutenants"));
c.push(dataTable(
  ["NAME", "PORTFOLIO", "CURRENT POSITION"],
  [
    ["Mab Lowhaven", "Vice, wagers, recruitment", "Hog Pit lost; furious, practical, rebuilding contacts"],
    ["Oswin 'Spike'", "Armed security, shooters", "Escaped; may eventually connect Pieter's words to Kaspar"],
    ["Prosperity Lowhaven", "Law, debts, blackmail", "Keeps distance from violence; protects records and contracts"],
    ["Sunny Lowhaven", "Confidence schemes, noble access", "Mobile and socially useful; avoids clan colors"],
    ["Cora 'Crumbs' Lowhaven", "Money, supplies, safehouses", "Runs household logistics above Satrioli's"],
    ["Pip 'Shufflepig'", "Dock warehouse and stolen goods", "Mercy's favorite nephew; boasts, misfiles, hires badly"],
    ["Helmut Gris", "Human intermediary and butcher", "Defector from the Baron; handles threats requiring reach"],
  ],
  [2100, 2700, 4560],
));

c.push(h2("4.2 Junior relatives and fronts"));
c.push(bullet("Merry Lowhaven", "Fast-talking courier, loyal to Mab; knows routes, not strategy."));
c.push(bullet("Tolman 'Tolly' Lowhaven", "Young collector desperate to prove himself; likely to escalate when frightened."));
c.push(bullet("Juniper Lowhaven", "Bookkeeper's assistant under Prosperity; observant and treated as harmless."));
c.push(bullet("Martin Violetta", "Former Gilded Cage manager, alive and broken. Knows accounts but no longer commands anyone."));
c.push(bullet("Gino, Carla, and Furio Satrioli", "Operate the legitimate sausage shop. They profit from the arrangement but are not blood relatives or strategic officers."));
c.push(bullet("Reliability", "Silvi is certain about Mercy, Mab, Oswin, Prosperity, Pip, and Helmut. Sunny and Cora are strong assessments. Junior roles may have shifted after the two recent disasters."));

c.push(pageBreak());
c.push(h1("5. LATE MORNING — THE HIGH TEMPLE OF SIGMAR"));
c.push(timeBox("LATE MORNING — THE TEMPLE — 45 TO 55 MINUTES"));
c.push(readAloud("Le Haut Temple peut contenir des centaines de fidèles, et ce matin il semble décidé à le prouver. Des soldats d'Altdorf occupent les premiers bancs. Dans une nef latérale, de jeunes initiés serrent des couvertures, de la corde et des marteaux de guerre sur des sacs de marche. Un prêtre aux épaules larges corrige leur chargement d'un mot sec, puis vient vers vous. « Jacob Möhren. Le père Emming est occupé. Si vous êtes venus le déranger, commencez par me convaincre que votre affaire vaut mieux que la sienne. »"));
c.push(body("Jacob is preparing initiates for an expedition into the Grey Mountains foothills. It will end badly later, but today it mainly explains his urgency and Emming's unavailability."));

c.push(h2("5.1 Jacob Möhren"));
c.push(bullet("Manner", "Blunt, disciplined, suspicious of spectacle. He respects exact facts, duty, and people who accept risk without boasting."));
c.push(bullet("Immediate boundary", "Emming is unavailable. Rank, threats, and name-dropping do not change this."));
c.push(bullet("Private concern", "Jacob believes Ernst Ricker knows what happened during the attack on Engel's tower and is withholding information."));
c.push(bullet("What unlocks him", "A PC must connect their inquiry to a person who disappeared or died during the Sorcerer's Way attack. Jannik and Ingrid are the clearest route."));

c.push(h2("5.2 The information gate"));
c.push(dataTable(
  ["PC APPROACH", "JACOB'S RESPONSE"],
  [
    ["Vague questions about zealots", "Public answer only: the Temple condemns unsanctioned violence and knows nothing of their whereabouts."],
    ["Jannik, Ingrid, or another missing attacker", "Unlock a Challenging Charm (+0) test. Pieter's Watch testimony grants +10."],
    ["Precise facts from Sorcerer's Way", "Jacob listens. On success, he speaks privately and may ask for help."],
    ["Mention Skaven", "Cooperation ends. He calls it blasphemous hysteria; persistence brings temple guards."],
    ["Demand Emming", "Flat refusal. A successful Etiquette (Cultists) test only keeps the conversation civil."],
  ],
  [3120, 6240],
));

c.push(h2("5.3 What Jacob gives on success"));
c.push(bullet("Ernst's location", "Ernst Ricker has private rooms in the temple basement and is currently present somewhere below."));
c.push(bullet("His interest", "Ernst was intensely interested in the zealots and their accusations against Engel."));
c.push(bullet("Ursula", "Witch Hunter Ursula Marbad helped Ernst last week. They have since fallen out and are no longer on good terms."));
c.push(bullet("The dead and missing", "Aldric's body was recovered. Tobias remains missing. The Temple suspects more people took part than it can account for."));
c.push(bullet("Quiet commission", "If the PCs say they seek someone missing in the attack, Jacob asks them to learn what Ernst knows. No money; he offers selected records, discreet access, and future goodwill."));
c.push(quote("Jacob", "Ricker a une chambre sous ce temple et des réponses qu'il ne donne pas. Je ne peux pas l'accuser sur des soupçons. Vous, en revanche, vous pouvez poser des questions que je ne peux pas poser."));
c.push(quote("Jacob", "Marbad l'a aidé la semaine dernière. Maintenant, ils ne supportent plus de se trouver dans la même pièce. Je doute qu'une querelle de théologie explique tout."));

c.push(h2("5.4 Ursula crosses the scene"));
c.push(body("Ursula may be consulting a burial record, leaving a side chapel, or returning a key. If she saw Thucydion last night, recognition is immediate: a pause, a hand near the rusty pistol, then a controlled withdrawal. She still does not approach."));
c.push(bullet("Follow Ursula", "Opposed Shadowing. Success learns she is staying near the Pious Cup; failure lets her reverse the pursuit and learn where the PCs return."));
c.push(bullet("Let her go", "Thucydion now has the first solid link between the Circle watcher and Ernst's former ally."));
c.push(bullet("Confront her", "She answers only that she follows corruption where priests refuse to look. A threat or attempt to detain her ends peacefully only with a successful Cool test."));

c.push(h2("5.5 Reaching Ernst"));
c.push(bullet("Wait", "Ernst leaves the basement shortly after noon. This costs one preparation opportunity but permits a public conversation."));
c.push(bullet("Jacob's access", "With +2 SL or excellent roleplay, Jacob lets one or two PCs consult a record room below, creating a chance encounter without authorizing a search."));
c.push(bullet("Trespass", "Hard Stealth (−20) past temple servants. Discovery costs Jacob's goodwill and makes Ernst immediately defensive."));
c.push(bullet("Ernst's posture", "He is controlled, mournful, and certain Engel murdered righteous citizens. He does not admit Ingrid or Hannah are at the Pious Cup."));
c.push(warning("If any PC mentions Skaven before Jacob has delivered the useful information, close the gate. If they mention Skaven afterward, he retracts access and ends the commission, but what he already said remains learned."));
c.push(absent("Without Pieter, the direct Jannik/Ingrid connection is weaker: another PC must provide his Watch testimony or a specific name. Without Thucydion, Ursula does not recognize anyone from the previous night's surveillance."));
c.push(music("Pillars of Eternity — 'Temple of Woedica', or restrained choral ambience without triumph."));

c.push(pageBreak());
c.push(h1("6. EARLY AFTERNOON — FRANZ'S BIRTHDAY COUNCIL"));
c.push(timeBox("EARLY AFTERNOON — SHUTTERS CLOSED — 40 TO 50 MINUTES"));
c.push(readAloud("Franz ferme lui-même les volets, pose une cruche au milieu de la table et ne sert personne. Sur quatre morceaux de papier, il a dessiné un nain, un rat, sept traits verticaux et un crâne coiffé d'une couronne. « Voici ceux qui veulent ma mort. À partir de cet après-midi, l'auberge sera vide. Ce soir, ils entreront. Nous ferons en sorte qu'ils n'en ressortent pas — et que moi non plus, du moins aux yeux d'Ubersreik. »"));
c.push(gm("Give the players Handout A now. Franz knows identities, motives, and broad capabilities. He does not know their exact arrival times or entry points, though his guesses are sensible."));

c.push(h2("6.1 The four threats"));
c.push(dataTable(
  ["THREAT", "WHAT FRANZ TELLS THEM", "TACTICAL TRUTH"],
  [
    ["Thikad Urgolsson", "A Slayer who believes Franz cheated him of Grudgebringer", "Very tough; front door; can leap with a rune buckle"],
    ["Shrinq Shaderipper", "A Skaven assassin from the Tilean campaigns", "Chimney entry; hides in Franz's wardrobe; superb climber"],
    ["Carmello's crew", "Seven Border Princes thugs serving Marchesa Caramanici", "Missile weapons; rear upstairs window; two may remain outside"],
    ["Tah-Ra Mentuhr", "A Nehekharan wraith seeking to possess Franz", "Ethereal; only Magical attacks harm it; manifests in taproom"],
  ],
  [2040, 3960, 3360],
));

c.push(h2("6.2 Franz's starting plan"));
c.push(step("Clear the inn", "Close publicly in late afternoon for private prayers to Shallya. Ilse, Gunter, serving lads, guests, and lodgers leave."));
c.push(step("Prepare the charge", "Powder goes into the beer cellar beneath the taproom and against the stair supports. A fuse runs to the kitchen passage."));
c.push(step("Use Franz as bait", "He remains visible in the taproom while PCs watch the roof, front lane, upper rear window, and escape path."));
c.push(step("Let the threats converge", "Do not light the fuse for the first arrival unless the PCs decide one target is enough."));
c.push(step("Escape", "Leave through the kitchen yard, cross a cooperating yard, and reach the Boatmen's Guild boathouse three minutes away."));
c.push(step("Disappear", "A covered Guild skiff takes Franz and any fugitives downriver while the city believes he died."));

c.push(h2("6.3 Red Moon schematic"));
c.push(diagram([
  "                         FRONT LANE",
  "                  [A FRONT DOOR / THIKAD]",
  "                           |",
  "   [C CURTAINED BOOTHS]--[B TAPROOM / FRANZ]--[D COMMON ROOM]",
  "                           |                       |",
  "                     [E CELLAR CHARGE]       [F KITCHEN]--FUSE",
  "                                                   |",
  "                                            [G REAR YARD]",
  "                                                   |",
  "                                      COOPER'S YARD → BOATHOUSE",
  "",
  "   UPPER FLOOR: [H GUEST ROOMS]--[I FRANZ'S ROOM / WARDROBE]",
  "                       |                 |",
  "                REAR WINDOW / CREW     CHIMNEY / SHRINQ",
]));
c.push(bullet("Charge", "Enough powder remains. Explosion: everyone within the inn suffers 1d10+15 Damage and 5 Ablaze Conditions."));
c.push(bullet("Ordinary fuse", "Burns for 1d10+4 rounds. An Average Perception (+20) test after lighting estimates the duration."));
c.push(bullet("Timekeeper candle", "Prochnow sells it for 5 shillings. The lighter chooses a 4–12 round delay."));
c.push(bullet("Magical charge", "Cordelia can alter the explosives so the blast gains the Magical trait and can harm Tah-Ra."));
c.push(bullet("Reward", "10 GC for a convincing escape and false death. Franz may raise it if execution is exceptional. Saif al-Janub is added only if all four threats are destroyed."));
c.push(warning("Franz is confident, not omniscient. Nearby buildings are occupied. A badly placed charge, blocked escape, premature blast, or uncontrolled fire can create another civilian disaster."));

c.push(h2("6.4 Decisions to settle at the table"));
c.push(bullet("Who stays with Franz?", "Someone must keep the bait alive and mobile."));
c.push(bullet("Who lights the fuse?", "That PC must know the retreat route and make the final timing decision."));
c.push(bullet("Who watches above?", "Shrinq and Carmello's entry both threaten the upper floor."));
c.push(bullet("Who watches outside?", "Carmello already suspects something involving powder. Lone spotters are vulnerable."));
c.push(bullet("How will they harm Tah-Ra?", "This is the core preparation problem. Franz knows ordinary steel will pass through it."));
c.push(bullet("What triggers the blast?", "All four inside; Franz reaching the kitchen; a shouted phrase; or a time deadline."));
c.push(quote("Franz", "Un plan qui dépend de tout le monde au bon endroit au bon moment est une prière. Donnez-moi un plan qui survive à une erreur."));
c.push(music("Use subdued Red Moon tavern ambience during discussion. Fade it out entirely when Franz names the wraith."));

c.push(pageBreak());
c.push(h1("7. AFTERNOON PREPARATIONS"));
c.push(timeBox("AFTERNOON — SPLIT OR STAY TOGETHER — 40 TO 50 MINUTES"));
c.push(body("At the current pace, allow two substantial preparations before the Red Moon closes. A split party can attempt more, but every small group is easier for Carmello's watcher to identify."));

c.push(h2("7.1 Preparation menu"));
c.push(dataTable(
  ["PREPARATION", "TEST / COST", "ADVANTAGE"],
  [
    ["Cordelia: Magical powder", "Explain the wraith; Average Charm (+20) or trust", "The entire blast gains Magical; Tah-Ra can be destroyed"],
    ["Prochnow's candle", "5 shillings; no test if approached honestly", "Choose 4–12 rounds rather than roll the fuse"],
    ["Counter-surveillance", "Opposed Perception/Stealth vs watcher 45", "Discover Carmello's suspicion and identify an outside attacker"],
    ["Prepare the building", "Trade (Carpenter), Evaluate, or Intuition", "One PC gains +20 on escape or blast-timing test"],
    ["False escape route", "Average Outdoor Survival or Trade (+20)", "One of Carmello's outside men watches the wrong alley"],
    ["Disguised Franz", "Average Entertain (Acting) or disguise", "Decoy can hold one enemy's attention for a round"],
    ["Continue Temple lead", "Wait for Ernst or follow Ursula", "Advance Ingrid/zealot thread; lose a Red Moon advantage"],
    ["Lowhaven protection", "Gossip or underworld contact", "Learn one hunter's description and shield Kaspar tonight"],
  ],
  [2340, 2820, 4200],
));

c.push(h2("7.2 Cordelia and the wraith"));
c.push(readAloud("Cordelia écoute sans vous interrompre, puis regarde la quantité de poudre comme on regarderait un patient déjà mort. « Je peux faire en sorte que l'explosion touche ce qui n'a plus de corps. Je ne peux pas faire en sorte qu'elle distingue un spectre d'un voisin. »"));
c.push(bullet("What she needs", "Ten minutes alone with each powder cache, powdered silver from her stock, and one drop of blood from someone who has seen the wraith or from Franz."));
c.push(bullet("What she warns", "The alteration does not reduce fire or structural damage. Magical fire may leave an obvious residue to trained investigators."));
c.push(bullet("Engel", "She does not involve him. His attention remains on the Skaven device and the political aftermath of the zealot attack."));

c.push(h2("7.3 Carmello's suspicion clock"));
c.push(dataTable(
  ["CLOCK", "STATE"],
  [
    ["0 — Powder only", "Crew knows suspicious powder reached Franz. One watcher observes the inn."],
    ["1 — Pattern", "Watcher sees PCs repeatedly enter, staff leave early, or materials move."],
    ["2 — Trap suspected", "At 9:30, five crew enter upstairs; two remain outside on escape routes."],
    ["3 — Route found", "One outside thug positions near the cooper's yard or boathouse approach."],
    ["4 — Counter-ambush", "The crew attacks an isolated spotter before entering. The published convergence breaks."],
  ],
  [2040, 7320],
));
c.push(gm("Start at 0. Advance for visible preparations or failed counter-surveillance. Reduce once for a good false story or decoy. Carmello's crew does not know the full plan unless the PCs expose it."));

c.push(h2("7.4 Closing montage"));
c.push(readAloud("À la fin de l'après-midi, Ilse pousse le dernier client dehors avec des excuses qu'elle ne pense pas. Gunter emporte sa marmite. Les garçons de salle descendent la rue sans se retourner. Franz place une petite image de Shallya derrière le comptoir, tourne le panneau sur FERMÉ et verrouille la porte. Pendant quelques secondes, la Lune Rouge est parfaitement silencieuse."));
c.push(body("Recommended session ending: show one watcher slipping into an alley after the doors close. If the session moved quickly, jump to 9 PM and end on scratching inside the chimney while frost begins forming around the taproom's mugs."));
c.push(music("For the closing image, use silence first; then a low Vermintide-style Skaven pulse as the chimney begins to scratch."));

c.push(pageBreak());
c.push(h1("8. THE ATTACK — FAST-TABLE CONTINGENCY"));
c.push(body("Use this only if Session 18 reaches the attack. Otherwise it is the launch page for Session 19."));
c.push(timeBox("9:00 PM — SHRINQ ENTERS; TAH-RA BEGINS TO MANIFEST"));
c.push(bullet("Shrinq", "Climbs down the chimney and hides in Franz's wardrobe. A prepared roof watcher opposes his Stealth 71 with Perception."));
c.push(bullet("Tah-Ra", "A chill gathers in the taproom. Second Sight reveals it now; Magical attacks can affect it before full manifestation."));
c.push(timeBox("9:15 PM — THIKAD CALLS FROM THE FRONT"));
c.push(bullet("Thikad", "Drunk, furious, and loud. He demands Franz come out. If ignored, he begins breaking the front door at 9:30."));
c.push(timeBox("9:30 PM — CARMELLO'S CREW MOVES"));
c.push(bullet("Published entry", "Seven thugs break through the rear upstairs window. Shrinq descends to observe and encounters them on the stairs. Tah-Ra fully manifests and causes Fear."));
c.push(bullet("Campaign modification", "At suspicion 2+, only five enter. Two stay outside. At 3+, one covers the real escape route. At 4, they attack an isolated PC first."));
c.push(bullet("Fuse", "Once lit: 1d10+4 rounds, or the chosen 4–12 rounds with Prochnow's candle."));
c.push(bullet("Survivors", "Any enemy surviving the explosion flees and remains at large. Franz's false death can still succeed."));

c.push(h2("8.1 Quick profiles from Red Moon Burning"));
c.push(h3("Thikad Urgolsson — Dwarf Slayer"));
c.push(body("M 3 | WS 56 | BS 39 | S 36 | T 52 | I 31 | Ag 28 | Dex 38 | Int 36 | WP 67 | Fel 24 | W 19", { font: "Courier New", size: 18 }));
c.push(bullet("Skills", "Consume Alcohol 67, Cool 77, Dodge 43. Traits: Bounce (Rune of Leaping belt buckle), Weapon +7."));
c.push(h3("Shrinq Shaderipper — Skaven Assassin"));
c.push(body("M 6 | WS 66 | BS 57 | S 39 | T 38 | I 63 | Ag 61 | Dex 36 | Int 46 | WP 45 | Fel 29 | W 13", { font: "Courier New", size: 18 }));
c.push(bullet("Traits", "Armour 2, Champion, Ranged +6 (20), Tracker, Wallcrawler, Weapon +7."));
c.push(h3("Carmello's Crew — seven human thugs"));
c.push(body("M 4 | WS 41 | BS 45 | S 32 | T 38 | I 34 | Ag 28 | Dex 36 | Int 27 | WP 36 | Fel 29 | W 12", { font: "Courier New", size: 18 }));
c.push(bullet("Skills and traits", "Intimidate 42; Armour (Light 2), Ranged +8 (50), Weapon +7."));
c.push(h3("Tah-Ra Mentuhr — Nehekharan Wraith"));
c.push(body("M 6 | WS 44 | BS — | S 33 | T 32 | I 19 | Ag 35 | Dex 27 | Int 28 | WP 59 | Fel 19 | W 14", { font: "Courier New", size: 18 }));
c.push(bullet("Traits", "Chill Grasp, Dark Vision, Ethereal, Fear, Magical, Painless, Weapon +9."));
c.push(h3("Saif al-Janub"));
c.push(body("Basic weapon | 20 GC | Enc 1 | Exotic | Reach Medium | Damage +SB+5 | Defensive, Fine 4, Unbreakable", { font: "Courier New", size: 18 }));

c.push(pageBreak());
c.push(h1("9. PERSONAL HOOKS, ABSENCES, AND LAUNCH CHECKLIST"));
c.push(h2("9.1 One hook per PC"));
c.push(bullet("Kaspar", "Silvi's dossier gives him useful targets while the aftermath puts a witness near his trail. Otto still expects Felix dead before the 16th."));
c.push(bullet("Pieter", "His connection to Jannik and Ingrid is the cleanest way through Jacob's defenses. Ursula and Ernst both threaten to pull that search in different directions."));
c.push(bullet("Thucydion", "Owns the Circle opener and can become the link between Ursula's dockside surveillance and her Temple presence."));
c.push(bullet("Ludwig", "Can shape Franz's public cover story. Ottokar and Grimski make careless claims about fire politically dangerous."));
c.push(bullet("Silas", "Can give the aftermath its human center and is the most natural PC to understand Cordelia's warning about magically altered powder."));

c.push(h2("9.2 Unexpected absences"));
c.push(absent("Thucydion absent: he locates Kessel's Chandlery but does not spot Ursula. Pieter absent: another PC must cite his Watch testimony or a specific missing person to unlock Jacob. Any PC absent during preparation secures the Boatmen's route or supervises the evacuation. A PC absent when the attack begins waits at the boathouse and suffers no automatic combat, Corruption, or injury."));

c.push(h2("9.3 Session launch checklist"));
c.push(bullet("Date", "Begin Wellentag 13th late night; roll into Aubentag 14th after the Circle scene."));
c.push(bullet("Circle", "Kessel's Chandlery located; Ursula may be seen; no Slaanesh reveal."));
c.push(bullet("Fire", "Four dead, two missing, three homes lost/condemned, fifteen households displaced."));
c.push(bullet("Money", "Silvi pays 30 GC during the morning."));
c.push(bullet("Lowhavens", "Give Handout B to Kaspar. Oswin has not yet identified him."));
c.push(bullet("Temple", "Emming unavailable; Jacob is the gate; Skaven talk closes it; Ernst is below."));
c.push(bullet("Franz", "Boatmen arranged. Magical powder and timed fuse still unresolved."));
c.push(bullet("Carmello", "Suspicion starts at 0: the crew knows powder was delivered, not why."));
c.push(bullet("End", "Prefer doors closing; if fast, end with Shrinq in the chimney and Tah-Ra's frost."));

c.push(pageBreak());
c.push(h1("HANDOUT A — LE PLAN DE FRANZ"));
c.push(body("À remettre aux joueurs pendant le conseil d'Aubentag. Les heures d'arrivée exactes restent secrètes."));
c.push(h2("Ceux qui viennent"));
c.push(dataTable(
  ["ENNEMI", "CE QUE FRANZ SAIT"],
  [
    ["Thikad Urgolsson", "Un Tueur nain. Il croit que Franz lui a volé la lame Grudgebringer lors d'une partie truquée."],
    ["Shrinq Shaderipper", "Un assassin skaven. Rapide, silencieux, capable de grimper là où personne ne devrait pouvoir passer."],
    ["Les sept de Carmello", "Des tueurs des Principautés Frontalières. Arbalètes, discipline et goût pour les attaques lentes."],
    ["Tah-Ra Mentuhr", "Un spectre de Nehekhara qui veut posséder Franz. Les armes ordinaires ne peuvent pas le blesser."],
  ],
  [2580, 6780],
));
c.push(h2("Le plan de départ"));
c.push(step("Vider la Lune Rouge", "Fermeture en fin d'après-midi pour l'anniversaire de Franz et ses prières privées à Shallya."));
c.push(step("Charger la cave", "La poudre sera placée sous la salle commune et contre l'escalier."));
c.push(step("Garder Franz visible", "Il servira d'appât jusqu'à ce que les ennemis soient entrés."));
c.push(step("Surveiller", "Il faut couvrir la cheminée, la porte d'entrée, la fenêtre arrière de l'étage et la route de fuite."));
c.push(step("Allumer", "Le signal et la personne chargée de la mèche restent à décider."));
c.push(step("Fuir", "Passage par la cuisine, la cour arrière, la cour du tonnelier, puis le hangar de la Guilde des Bateliers."));
c.push(step("Disparaître", "Une barque couverte emmènera Franz sur le Teufel. Ubersreik devra croire qu'il est mort."));
c.push(h2("Ce qui manque"));
c.push(bullet("Le spectre", "Trouver comment rendre l'explosion capable de blesser Tah-Ra."));
c.push(bullet("La mèche", "La durée d'une mèche ordinaire est imprécise."));
c.push(bullet("La surveillance", "Quelqu'un a peut-être remarqué la livraison de poudre."));
c.push(bullet("Les rôles", "Qui reste avec Franz ? Qui surveille l'étage ? Qui allume ? Qui protège la fuite ?"));
c.push(quote("Franz", "Vous pouvez changer tout ce plan. Mais à la fin, je dois sembler mort et vous devez être assez vivants pour raconter que je le suis."));

c.push(pageBreak());
c.push(h1("HANDOUT B — LE SANG DES LOWHAVEN"));
c.push(body("Notes réunies par Silvi. À remettre à Kaspar. Un trait plein indique un lien confirmé ; les rôles des parents éloignés restent parfois des estimations."));
c.push(diagram([
  "CLEMENCY LOWHAVEN (ancienne matriarche, morte)",
  "|",
  "+-- MERCY LOWHAVEN — dirige la branche d'Ubersreik",
  "|   +-- Hope — en apprentissage auprès de la branche d'Altdorf",
  "|   +-- Fortune — en apprentissage auprès de la branche de Nuln",
  "|",
  "+-- Larkspur (sœur de Mercy, morte)",
  "|   +-- Bella — morte à la Cage Dorée",
  "|   +-- Mab — paris, combats clandestins, recrutement",
  "|   +-- Oswin « Spike » — sécurité et tireurs",
  "|",
  "+-- Tobin (frère de Mercy) + Pippa Shufflepig",
  "    +-- Pip « Shufflepig » — entrepôts des Docks ; favori de Mercy",
]));
c.push(h2("Les lieutenants"));
c.push(dataTable(
  ["NOM", "RÔLE", "NOTE DE SILVI"],
  [
    ["Mab Lowhaven", "Vice et combats", "Compétente. A survécu à la Fosse."],
    ["Oswin « Spike »", "Sécurité", "Excellent tireur. A parlé avec Pieter."],
    ["Prosperity Lowhaven", "Droit et dettes", "Dangereux avec un contrat, rarement avec une lame."],
    ["Sunny Lowhaven", "Escroqueries", "Fréquente les riches sous de faux noms."],
    ["Cora « Crumbs »", "Argent et refuges", "Probablement au-dessus de Satrioli."],
    ["Pip « Shufflepig »", "Entrepôts", "Neveu favori de Mercy. Inepte, vaniteux, protégé."],
    ["Helmut Gris", "Intermédiaire humain", "Ancien du Baron. Boucher au propre comme au figuré."],
  ],
  [2250, 2310, 4800],
));
c.push(h2("Parents secondaires et façades"));
c.push(bullet("Merry Lowhaven", "Messagère de Mab."));
c.push(bullet("Tolman « Tolly » Lowhaven", "Collecteur jeune et nerveux."));
c.push(bullet("Juniper Lowhaven", "Assistante aux comptes de Prosperity."));
c.push(bullet("Martin Violetta", "Ancien gérant de la Cage ; vivant, brisé, désormais peu fiable."));
c.push(bullet("Les Satrioli", "Façade commerciale. Alliés intéressés, pas parents."));
c.push(quote("Silvi", "Dans cette famille, un cousin inutile reste un cousin. C'est ce qui rend Shufflepig plus dangereux qu'il en a l'air."));

const styles = {
  default: { document: { run: { font: "Georgia", size: 22, color: C.ink }, paragraph: { spacing: { after: 120, line: 300 } } } },
  paragraphStyles: [
    { id: "Normal", name: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Georgia", size: 22, color: C.ink },
      paragraph: { spacing: { before: 0, after: 120, line: 300 } } },
    { id: "CampaignTitle", name: "Campaign Title", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 52, bold: true, color: C.darkRed },
      paragraph: { spacing: { before: 0, after: 60, line: 520 } } },
    { id: "CampaignSubtitle", name: "Campaign Subtitle", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 29, bold: true, color: C.red },
      paragraph: { spacing: { before: 0, after: 80, line: 320 } } },
    { id: "CampaignHeading1", name: "Campaign Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 32, bold: true, color: C.red },
      paragraph: { spacing: { before: 360, after: 200, line: 300 }, outlineLevel: 0, keepNext: true } },
    { id: "CampaignHeading2", name: "Campaign Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 26, bold: true, color: C.darkRed },
      paragraph: { spacing: { before: 280, after: 140, line: 290 }, outlineLevel: 1, keepNext: true } },
    { id: "CampaignHeading3", name: "Campaign Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: "Arial", size: 24, bold: true, color: C.blue },
      paragraph: { spacing: { before: 200, after: 100, line: 290 }, outlineLevel: 2, keepNext: true } },
  ],
};

const numbering = { config: [
  { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 80, line: 300 } }, run: { font: "Georgia", size: 22, color: C.ink } } }] },
  { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 80, line: 300 } }, run: { font: "Georgia", size: 22, color: C.darkRed, bold: true } } }] },
] };

const header = new Header({ children: [new Paragraph({
  alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 },
  children: [run("WARHAMMER FANTASY ROLEPLAY — UBERSREIK", { font: "Arial", size: 16, color: C.grey, smallCaps: true })],
})] });

const footer = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
  children: [
    run("Session 18 — A Birthday Before the Fire — ", { font: "Arial", size: 16, color: C.grey }),
    new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.grey }),
  ],
})] });

const doc = new Document({
  creator: "Ubersreik Campaign",
  title: "Session 18 — A Birthday Before the Fire",
  description: "GM guide for Session 18: the Circle headquarters, High Temple investigation, and Red Moon Burning preparations.",
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
const outputPath = path.join(outputDir, "Session 18 - A Birthday Before the Fire.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generated ${outputPath} (${c.length} blocks, ${buffer.length} bytes)`);
