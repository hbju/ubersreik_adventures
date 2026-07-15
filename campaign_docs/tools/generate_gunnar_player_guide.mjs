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

// Design preset: compact_reference_guide.
// Exact preset tokens: US Letter; 1 in margins; 0.492 in header/footer;
// 9360 DXA content width; 11 pt body; 6 pt after; 1.25 line spacing;
// H1 16 pt/18 pt before/10 pt after; H2 13 pt/14 pt/7 pt;
// H3 12 pt/10 pt/5 pt; list marker 0.187 in, text 0.375 in;
// table indent 120 DXA; cell margins 80/80/120/120 DXA.
// Named campaign overrides: Georgia body, Arial display type, Ubersreik red
// heading palette, and the customer_pack first-page header pattern.

const C = {
  red: "8B1A1A",
  darkRed: "5C0011",
  blue: "1F4D78",
  gold: "7B5200",
  green: "2E5F2E",
  ink: "1A1A1A",
  grey: "555555",
  lightGrey: "E8E8E8",
  blueFill: "E8EEF5",
  tanFill: "F7F0E7",
  redFill: "FBEAEA",
  greenFill: "E8F1E8",
  white: "FFFFFF",
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

const richBody = (children, options = {}) => new Paragraph({
  style: options.style || "Normal",
  alignment: options.alignment || AlignmentType.LEFT,
  keepNext: options.keepNext,
  children,
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [run(text, { font: "Arial", size: 32, bold: true, color: C.red })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [run(text, { font: "Arial", size: 26, bold: true, color: C.darkRed })],
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
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
  shading: { fill: options.fill || C.tanFill, type: ShadingType.CLEAR },
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

const quote = (speaker, text) => new Paragraph({
  indent: { left: 520, right: 280 },
  spacing: { before: 80, after: 120, line: 290 },
  children: [
    run(`${speaker} : `, { font: "Arial", size: 20, bold: true, color: C.darkRed }),
    run(`« ${text} »`, { size: 21, italics: true }),
  ],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const cellParagraph = (label, value, options = {}) => new Paragraph({
  alignment: options.alignment || AlignmentType.CENTER,
  spacing: { before: 20, after: 20, line: 260 },
  children: [
    run(label.toUpperCase(), { font: "Arial", size: 16, bold: true, color: C.grey }),
    run(value, { font: "Arial", size: 28, bold: true, color: options.color || C.darkRed, break: 1 }),
  ],
});

const statGrid = (rows) => {
  const widths = [3120, 3120, 3120];
  return new Table({
    width: { size: PAGE.content, type: WidthType.DXA },
    indent: { size: 120, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: TABLE_BORDERS,
    rows: rows.map((row, rowIndex) => new TableRow({
      cantSplit: true,
      children: row.map((item, columnIndex) => new TableCell({
        width: { size: widths[columnIndex], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: rowIndex === 0 ? C.blueFill : C.white, type: ShadingType.CLEAR },
        children: [cellParagraph(item.label, item.value, item)],
      })),
    })),
  });
};

const dataTable = (headers, rows, widths) => new Table({
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
        children: [new Paragraph({
          spacing: { before: 20, after: 20, line: 260 },
          alignment: index === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [run(header, { font: "Arial", size: 18, bold: true, color: C.blue })],
        })],
      })),
    }),
    ...rows.map((row, rowIndex) => new TableRow({
      cantSplit: true,
      children: row.map((value, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: rowIndex % 2 ? "F8F8F8" : C.white, type: ShadingType.CLEAR },
        children: [new Paragraph({
          spacing: { before: 20, after: 20, line: 270 },
          alignment: index === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [run(String(value), {
            size: 20,
            bold: index === 0 || index === 1,
            color: index === 1 ? C.darkRed : C.ink,
          })],
        })],
      })),
    })),
  ],
});

const titleBlock = () => [
  new Paragraph({
    spacing: { before: 80, after: 0 },
    children: [run("DOCUMENT JOUEUR • SESSION 15", { font: "Arial", size: 20, bold: true, color: C.gold, smallCaps: true })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 80, line: 520 },
    children: [run("GUNNAR BREDERSON", { font: "Arial", size: 62, bold: true, color: C.darkRed })],
  }),
  new Paragraph({
    spacing: { before: 0, after: 200, line: 300 },
    children: [run("Tueur de Géants • Nain • Ancien Éclaireur de Karak Azgaraz", { font: "Arial", size: 27, italics: true, color: C.grey })],
  }),
];

const c = [];
c.push(...titleBlock());
c.push(callout(
  "EN UNE PHRASE",
  "Tu es un guerrier marqué par la honte, qui cherche une mort digne sans gaspiller sa vie : une promesse tenue vaut davantage qu'une victoire facile.",
  { fill: C.tanFill, color: C.gold },
));
c.push(statGrid([
  [
    { label: "CC", value: "46" },
    { label: "Force", value: "43" },
    { label: "Endurance", value: "51" },
  ],
  [
    { label: "Force Mentale", value: "63" },
    { label: "Blessures", value: "30" },
    { label: "Mouvement", value: "3" },
  ],
]));

c.push(h1("1. TON RÔLE À LA TABLE"));
c.push(bullet("Dans le groupe", "tu es le point d'ancrage : direct, difficile à effrayer, capable de porter les blessés et d'aller au contact quand les autres hésitent."));
c.push(bullet("Dans une scène", "pose la question concrète que tout le monde évite : qui mène, où est la sortie, quelle preuve manque, et quel prix chacun accepte de payer ?"));
c.push(bullet("Dans un combat", "choisis une menace sérieuse, verrouille-la et laisse les autres respirer. Tu n'as pas besoin de voler chaque mise à mort."));
c.push(bullet("Ton moteur", "tenir ta parole, protéger ceux qui ne peuvent pas fuir, préparer la prochaine descente et rencontrer enfin un adversaire digne."));

c.push(h1("2. CE QU'EST UN SLAYER"));
c.push(body("Chez les Nains, certaines hontes ne se paient ni en or ni en excuses. Celui qui estime son honneur irrémédiablement perdu prête le Serment du Slayer devant Grimnir. Il abandonne son ancienne place, rase les côtés de son crâne, teint sa crête en orange et part chercher une mort glorieuse face à un ennemi redoutable."));
c.push(body("Un Slayer veut mourir dignement, mais il ne cherche pas à mourir stupidement. Se jeter seul dans un trou sans plan ne rachète rien. Affronter une horreur pour sauver des compagnons, tenir un passage impossible ou respecter une promesse malgré le danger : voilà une fin qui pourrait compter."));
c.push(callout(
  "À NE PAS CONFONDRE",
  "Gunnar n'est ni un berserker sans cervelle, ni un saint. Il peut battre en retraite si cela sauve la mission, mais il ne fuit jamais pour sauver seulement sa propre peau. Plus maintenant.",
  { fill: C.redFill, color: C.red },
));

c.push(pageBreak());
c.push(h1("3. AVANT LA CRÊTE ROUGE"));
c.push(body("Avant le Serment, Gunnar était Éclaireur du Karak. Il patrouillait les cols et les anciennes galeries autour de Karak Azgaraz, portait des messages entre postes isolés et dressait des cartes lorsque les éboulements ou les peaux-vertes rendaient les vieux chemins inutilisables. Il était patient avec les bêtes de bât, méticuleux avec une carte et beaucoup moins patient avec les autres Nains."));
c.push(body("Il n'était pas le meilleur combattant de sa patrouille. Il était celui qui savait toujours où se trouvait le nord, quelle corde supporterait encore un passage et combien d'heures séparaient le groupe du prochain abri. On lui confiait donc des vies sans le dire à voix haute."));

c.push(h2("Le serment brisé"));
c.push(callout(
  "SECRET DE GUNNAR",
  "Cette histoire est connue de toi, le joueur. Gunnar ne la raconte pas. Une question indiscrète reçoit un silence. Une seconde reçoit un avertissement. Insister peut provoquer sa colère.",
  { fill: C.redFill, color: C.red },
));
c.push(body("Lors d'une expédition dans une ancienne voie minière au nord de Karak Azgaraz, Gunnar jura de garder le Passage des Trois Chaînes jusqu'au retour de ses compagnons. Une secousse avait blessé deux éclaireurs ; le reste de la patrouille cherchait une issue pendant qu'il tenait seul l'étroit accès."));
c.push(body("Le troll de pierre que les prospecteurs appelaient Mâche-Granit remonta alors des galeries basses. Gunnar entendit la chaîne céder, vit la masse approcher et comprit qu'il pouvait encore se glisser dans un conduit de sondage trop étroit pour la créature. Il avait juré de rester. Il partit tout de même."));
c.push(body("Deux de ses compagnons, revenus chercher les blessés, moururent au passage qu'il avait abandonné. Gunnar survécut. Il ne mentit pas lorsqu'il revint au Karak, ce qui ne rendit pas son choix plus supportable. Devant l'autel de Grimnir, il prononça le Serment du Slayer et effaça lui-même son ancien titre de ses cartes."));
c.push(quote("Gunnar", "Je ne dois pas ma crête à une bête. Je la dois à une parole que je n'ai pas tenue."));

c.push(h2("Mâche-Granit et le rang de Tueur de Géants"));
c.push(body("Des mois plus tard, Gunnar retrouva Mâche-Granit dans les contreforts des Montagnes Grises. Il l'affronta sur un pont de mine en ruine, planta une hache dans son œil et l'autre sous sa mâchoire. Le pont céda. Le troll s'écrasa au fond de la gorge ; Gunnar resta suspendu à une chaîne, vivant une fois encore."));
c.push(body("Tuer le troll ne répara pas le serment brisé. Cela prouva seulement qu'un Troll Slayer ne trouverait probablement pas son destin face à une proie ordinaire. Depuis, Gunnar est reconnu comme Tueur de Géants - Slayer de rang 3 - et cherche des ennemis plus grands, plus anciens ou plus monstrueux."));

c.push(pageBreak());
c.push(h1("4. COMMENT IL EST ARRIVÉ AU TIN SPUR"));
c.push(body("Gunnar suivit jusqu'à Ubersreik les rumeurs de combattants invaincus, de monstres dans les collines et d'une arène où l'on risquait davantage qu'un nez cassé. Le Tin Spur lui offrit de quoi boire, des adversaires sérieux et surtout un lieu où les nouvelles de créatures dangereuses finissaient toujours par arriver."));
c.push(body("Son combat le plus récent l'opposa à un ours dressé pour l'arène. Gunnar refusa de reculer, encaissa les griffes et tua la bête de ses deux haches. Il espérait davantage du combat. En se relevant, il donna la meilleure cuisse de l'ours à Ekkehard. L'Ogre décida qu'un Nain qui partageait ainsi la viande méritait d'être son ami. Gunnar n'a jamais corrigé cette conclusion."));

c.push(h2("Tes relations immédiates"));
c.push(bullet("Thucydion", "un Elfe fier, parfois exaspérant, mais assez courageux pour descendre là où d'autres se contentent de parler. Tu as vu ses défauts au combat et tu le respectes tout de même."));
c.push(bullet("Ekkehard", "un Ogre jovial et terrifiant. Votre amitié repose sur la viande partagée, les silences confortables et l'absence totale de subtilité."));
c.push(bullet("Le Tin Spur", "ce n'est pas ton foyer, mais c'est un bon endroit pour trouver une piste, un combat et quelqu'un qui sait quelle créature rôde hors des murs."));
c.push(bullet("Les aventuriers", "ils ont battu les Bâtards du Reik et survécu aux égouts. Ils prennent des risques réels ; cela suffit pour que tu les écoutes."));

c.push(h1("5. COMMENT JOUER GUNNAR"));
c.push(h2("Voix et présence"));
c.push(bullet("Parle court", "une idée par phrase. Gunnar ne remplit pas le silence pour rassurer les autres."));
c.push(bullet("Humour sec", "il plaisante surtout après le danger, rarement avant. Son rire ressemble à un souffle par le nez."));
c.push(bullet("Gestes", "il vérifie les issues, soupèse les planches, compte les sacs et aiguise une hache lorsqu'une discussion tourne en rond."));
c.push(bullet("Colère", "elle n'est pas bruyante au départ. Plus Gunnar est furieux, plus il parle doucement."));
c.push(bullet("Avec les animaux", "sa patience surprend : Charme des animaux 72. Il comprend mieux une mule têtue qu'un noble hésitant."));

c.push(h2("Principes de jeu"));
c.push(bullet("Une promesse est une dette", "depuis le Passage des Trois Chaînes, Gunnar ne donne jamais sa parole à la légère. Une fois donnée, elle gouverne ses choix."));
c.push(bullet("La mort doit servir", "il accepte le danger, pas le gaspillage. Il protège une retraite, porte un blessé et exige un plan avant une expédition."));
c.push(bullet("Le courage compte plus que l'espèce", "il se méfie instinctivement des Elfes, mais les actes de Thucydion pèsent davantage que les vieux préjugés."));
c.push(bullet("La cruauté gratuite est méprisable", "Gunnar n'est pas tendre, mais torturer un faible ou tuer pour se vanter n'a rien d'un exploit."));

c.push(h2("Répliques prêtes à l'emploi"));
c.push(quote("Gunnar", "Je vous ai promis les égouts. Je ne vous ai pas promis d'y mourir bêtement aujourd'hui."));
c.push(quote("Gunnar", "Choisissez : la porte, le blessé ou la preuve. Nous n'avons que deux mains chacun."));
c.push(quote("Gunnar", "Si ton plan exige que personne n'ait peur, ce n'est pas un plan."));
c.push(quote("Gunnar", "Demande encore pourquoi j'ai prêté le Serment, et tu apprendras seulement combien de dents tu possèdes."));

c.push(pageBreak());
c.push(h1("6. LA CAMPAGNE JUSQU'ICI - AIDE AU JOUEUR"));
c.push(callout(
  "HORS PERSONNAGE",
  "Cette page t'aide à suivre la table. Gunnar ne connaît automatiquement que les faits de la section suivante ; il peut apprendre le reste en parlant aux personnages.",
  { fill: C.blueFill, color: C.blue },
));
c.push(bullet("Le début", "les aventuriers poursuivent depuis plusieurs semaines Kürbis et Honighäschen, deux bandits masqués qui ont braqué la Lune Rouge puis attaqué un convoi du Guet pour voler les feux et la poudre de Magnustag."));
c.push(bullet("La piste intérieure", "le sergent Rudi Klumpenklug travaille pour les bandits. Un dépôt mort près des docks a mené les PJs vers la Guilde des Attrapeurs de Rats et vers Günther, qui semble transporter des sacs sans comprendre à qui ils servent."));
c.push(bullet("Les hommes-rats", "Pieter a rencontré une créature à face de rat. Le groupe a ensuite découvert dans les Magnussewers un repaire organisé, un ingénieur, des monstres et une étrange machine. La capitaine Pfeffer refuse encore de croire toute l'histoire sans preuve solide."));
c.push(bullet("Le Tin Spur", "les PJs ont vaincu les Bâtards du Reik. Pieter et Thucydion ont signé des contrats d'arène. Gunnar a rencontré Thucydion pendant son entraînement et lui a promis de participer gratuitement à la prochaine expédition dans les égouts."));
c.push(bullet("Magnustag", "Kaspar a joué un rôle décisif dans la prise sanglante de la Cage Dorée et a tué Bella Lowhaven. Pendant ce temps, Pieter a retrouvé Jannik mort près de la Voie du Sorcier ; Ingrid a disparu."));
c.push(bullet("La dernière nuit", "Thucydion, Ludwig et Silas sont descendus avec Melina pour sauver Wahlund et ses hommes. Ils y sont parvenus, mais reviennent grièvement blessés, poursuivis et probablement malades. Gunnar n'était pas encore avec eux."));

c.push(h2("Les cinq personnages joueurs"));
c.push(dataTable(
  ["Personnage", "Repère", "Ce qui t'aide à le jouer"],
  [
    ["Kaspar", "Force du gang", "Brutal, célèbre depuis la Cage Dorée, habitué à imposer une décision."],
    ["Pieter", "Combattant du Tin Spur", "Franc et tenace ; il doit affronter le fameux Eisfange le 16."],
    ["Thucydion", "Elfe et chasseur", "Ton contact. Fier, courageux, humilié récemment à l'entraînement."],
    ["Ludwig", "Parleur et poète", "Ingénieux, mêlé à la politique de la ville ; très affaibli après les égouts."],
    ["Silas", "Barbier-chirurgien", "Le soigneur du groupe ; gravement blessé et atteint d'une plaie infectée."],
  ],
  [1900, 2300, 5160],
));
c.push(callout(
  "POUR TOI QUI AS JOUÉ JANNIK",
  "Jannik a été abattu à bout portant. Pieter a retrouvé son corps, son arbalète encore déchargée. Gunnar ne le connaissait pas, mais tu peux laisser cette nouvelle influencer la manière dont tu regardes Ingrid, les fanatiques et la prudence du groupe.",
  { fill: C.redFill, color: C.red },
));

c.push(h1("7. CE QUE GUNNAR SAIT EN ARRIVANT"));
c.push(bullet("Les PJs", "Thucydion et ses compagnons savent se battre. Ils ont vaincu les Bâtards du Reik et ne cherchent pas seulement à raconter leurs exploits."));
c.push(bullet("La mission", "des créatures organisées occupent les Magnussewers. Thucydion t'a demandé de participer à une expédition et tu as donné ta parole."));
c.push(bullet("Le rendez-vous", "tu dois les rejoindre le matin du 11. À ton arrivée, tu découvres qu'ils sont descendus sans toi pendant la nuit pour sauver des prisonniers."));
c.push(bullet("La suite", "ta promesse n'est pas annulée. Une nouvelle descente exige un objectif, une route, du matériel, une preuve à rapporter et un signal de retraite."));
c.push(bullet("Tes limites", "tu ignores encore qui commande les hommes-rats, ce qu'ils construisent et ce que les bandits masqués préparent."));

c.push(pageBreak());
c.push(h1("8. FICHE MÉCANIQUE EXPRESS"));
c.push(dataTable(
  ["Compétence", "Score", "Usage fréquent"],
  [
    ["Mêlée (Base)", "54", "Attaquer ou défendre avec une hache."],
    ["Esquive", "50", "Éviter un coup quand parer n'est pas idéal."],
    ["Endurance", "61", "Résister au poison, à la maladie, à l'épuisement."],
    ["Calme", "71", "Résister à la peur, garder la tête froide."],
    ["Intimidation", "51", "Faire céder sans charme ; +1 SL grâce à Menaçant."],
    ["Charme des animaux", "72", "Calmer, guider ou comprendre un animal."],
    ["Pistage", "43", "Suivre une piste en ville ou sous terre."],
    ["Cartographie", "41", "Lire, corriger ou produire une carte."],
    ["Signes secrets (Ranger)", "40", "Reconnaître les marques de piste et de danger."],
    ["Perception", "39", "Repérer embuscades, passages et détails suspects."],
  ],
  [2800, 1200, 5360],
));

c.push(h2("Armes et protection"));
c.push(bullet("Deux haches", "Mêlée (Base) 54. Dégâts 9 + SL par coup : Bonus de Force 4 + hache 4 + Frappe Puissante 1."));
c.push(bullet("Sans armure", "0 PA. Tes 30 Blessures sont impressionnantes, mais les Critiques restent dangereux."));
c.push(bullet("Mouvement 3", "marche 6 yards, course 12 yards. Une charge donne +10 au premier test de Mêlée et apporte 1 Avantage au groupe."));
c.push(bullet("Argent", "2 pistoles d'argent et 4 sous de cuivre. Gunnar voyage léger."));

c.push(h2("Comment résoudre un test"));
c.push(step("Lance", "1d100 sous la Compétence ou la Caractéristique indiquée."));
c.push(step("Calcule", "les SL : dizaine du score modifié moins dizaine du résultat."));
c.push(step("En opposition", "les deux camps lancent ; le plus grand nombre de SL l'emporte."));
c.push(step("En mêlée", "si tu gagnes, les dégâts valent 9 + la différence finale de SL, avant Endurance et armure de la cible."));

c.push(h2("Tes talents décisifs"));
c.push(bullet("Slayer", "si le Bonus d'Endurance de l'ennemi dépasse ton Bonus de Force 4, utilise le sien à la place pour calculer tes dégâts. Sur un Critique contre une cible plus grande, les dégâts de mêlée sont multipliés selon l'écart de Taille."));
c.push(bullet("Deux Armes", "si la première hache touche, la seconde peut frapper avec les chiffres du dé inversés et -20 pour la main secondaire. Jusqu'à ton prochain tour, tes défenses subissent -10 ; tu ne gagnes de l'Avantage que si les deux coups touchent."));
c.push(bullet("Renversement", "quand tu remportes une opposition de Mêlée, tu peux renoncer aux dégâts pour voler 1 Avantage au camp adverse et l'ajouter au tien."));
c.push(bullet("Implacable", "tu ignores la perte de Blessures causée par une Condition Hémorragie."));
c.push(bullet("Résistance à la magie", "réduis de 2 les SL de tout sort qui t'affecte."));
c.push(bullet("Acharné", "Fuir le danger ne coûte qu'un Avantage au lieu de deux ; utile pour te replacer ou protéger une retraite."));

c.push(callout(
  "RESSOURCES",
  "Résolution 2/2 : dépense 1 point pour retirer une Condition, ignorer brièvement les pénalités d'un Critique ou résister à la Psychologie. Résilience 2/2 : ressource permanente, à garder pour un moment essentiel. Destin 0, Fortune 0 : Gunnar n'a aucun filet narratif contre la mort.",
  { fill: C.redFill, color: C.red },
));

c.push(pageBreak());
c.push(h1("9. AIDE-MÉMOIRE POUR LA SESSION"));
c.push(h2("Ton tour de combat par défaut"));
c.push(step("Place-toi", "entre la menace principale et un allié fragile. Charge si tu peux atteindre la cible sans abandonner quelqu'un."));
c.push(step("Frappe", "une seule hache à 54 est le choix fiable. Annonce 9 + SL de dégâts, ou applique Slayer si l'ennemi est plus endurant que toi."));
c.push(step("Double", "utilise Deux Armes seulement si deux touches peuvent vraiment changer la scène et si tu acceptes -10 en défense."));
c.push(step("Défends", "Mêlée 54 pour parer, Esquive 50 pour éviter. Dépense la Résolution avant qu'une Condition ne ruine ton prochain tour."));
c.push(step("Partage", "l'Avantage appartient au groupe. Demande avant d'en dépenser beaucoup, surtout pour une action supplémentaire."));

c.push(h2("Hors combat, tu peux toujours..."));
c.push(bullet("Préparer", "choisir la route, compter les lampes, tester une corde, marquer la retraite et dessiner une carte."));
c.push(bullet("Observer", "chercher les traces, odeurs, courants d'air, marques de griffes et signes de passage."));
c.push(bullet("Porter", "prendre un blessé, du matériel ou une porte sur ton dos ; Costaud et Dos Solide sont faits pour cela."));
c.push(bullet("Interroger", "poser des questions courtes, puis utiliser Intimidation si les détours continuent."));
c.push(bullet("Accompagner", "suivre un PJ dans sa scène personnelle. Gunnar n'est pas obligé d'attendre qu'une nouvelle expédition commence."));

c.push(h2("Tes premières minutes"));
c.push(callout(
  "ENTRÉE EN SCÈNE",
  "À 10 h le 11, Gunnar frappe à la porte, paquetage sanglé. Les survivants des égouts sont blessés, épuisés et surpris de le voir. Tu comprends immédiatement qu'ils ont commencé sans toi.",
  { fill: C.greenFill, color: C.green },
));
c.push(quote("Gunnar", "Alors. Vous avez commencé sans moi."));
c.push(quote("Gunnar", "Je ne demande pas si vous y retournerez. Je demande ce qu'il faut préparer pour que, la prochaine fois, nous revenions tous."));

c.push(h2("Si tu ne sais pas quoi choisir"));
c.push(bullet("Wahlund", "demande-lui une carte, les habitudes des créatures et l'objectif qui justifie une nouvelle descente."));
c.push(bullet("Silvi", "demande ce qu'elle finance, quelle preuve elle exige et qui peut rejoindre l'équipe."));
c.push(bullet("Felix", "un ancien champion du Tin Spur a disparu ; le chercher te donne une raison immédiate d'agir en ville."));
c.push(bullet("Le groupe", "accompagne un blessé, aide à obtenir du matériel ou force les aventuriers à décider ce qui ne peut plus attendre."));

c.push(callout(
  "LA BOUSSOLE DE GUNNAR",
  "Tiens ta parole. Ne gaspille pas une vie. Choisis l'ennemi le plus dangereux. Ramène les autres à la surface. Et si une mort digne se présente enfin, ne détourne pas les yeux.",
  { fill: C.tanFill, color: C.gold, italics: true },
));

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
      id: "Title",
      name: "Title",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 62, bold: true, color: C.darkRed },
      paragraph: { spacing: { before: 0, after: 80, line: 520 } },
    },
    {
      id: "Subtitle",
      name: "Subtitle",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 27, italics: true, color: C.grey },
      paragraph: { spacing: { before: 0, after: 200, line: 300 } },
    },
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 32, bold: true, color: C.red },
      paragraph: { spacing: { before: 360, after: 200, line: 300 }, outlineLevel: 0, keepNext: true },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "Arial", size: 26, bold: true, color: C.darkRed },
      paragraph: { spacing: { before: 280, after: 140, line: 290 }, outlineLevel: 1, keepNext: true },
    },
    {
      id: "Heading3",
      name: "Heading 3",
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
    children: [run("WARHAMMER FANTASY ROLEPLAY • UBERSREIK", { font: "Arial", size: 16, color: C.grey, smallCaps: true })],
  })],
});

const footer = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [
      run("Gunnar Brederson • Guide joueur • ", { font: "Arial", size: 16, color: C.grey }),
      new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.grey }),
    ],
  })],
});

const doc = new Document({
  creator: "Ubersreik Campaign",
  title: "Gunnar Brederson - Guide joueur - Session 15",
  description: "Guide sans spoilers pour le joueur invité incarnant Gunnar Brederson.",
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

const outputDir = path.resolve("campaign_docs", "player_handouts");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "Gunnar Brederson - Guide joueur - Session 15.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generated ${outputPath} (${c.length} blocks)`);
