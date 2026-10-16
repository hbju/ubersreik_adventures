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

const gm = (text) => callout("MJ", text, { fill: C.goldFill, color: C.gold });
const warning = (text) => callout("ATTENTION", text, { fill: C.redFill, color: C.red });
const absent = (text) => callout("SI LES PJs NE SONT PAS LÀ", text, { fill: C.purpleFill, color: C.purple });
const music = (text) => callout("MUSIQUE", text, { fill: C.blueFill, color: C.music });

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
    run(`« ${text} »`, { size: 21, italics: true }),
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
  ["REPÈRE", "À LA TABLE"], rows, [2160, 7200],
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
  "Thucydion, vous avez suivi les gardes jusqu’à la chandellerie Kessel, au nord du Teufel. Après avoir observé l’entrepôt, vous êtes allé chercher vos compagnons. Ensemble, vous songiez à donner l’assaut lorsqu’une femme au visage balafré vous a arrêtés : vous alliez ruiner des mois d’enquête, et vous faire tuer dans un bâtiment rempli de gardes.",
  "Vous avez choisi de surveiller les lieux. Jusqu’à l’aube, vous vous êtes relayés dans les Docks. L’idole n’a pas quitté l’entrepôt. Beaucoup de gardes y ont passé la nuit ; ceux qui sortaient cachaient leurs tabards sous des vêtements civils.",
  "Au matin, vous avez reçu de Silvi les trente couronnes promises pour Félix. Vous lui avez demandé ce qui se tramait dans la ville. Ses premières réponses vous ont peu appris ; elle vous a promis des renseignements plus précis. Vous les attendez encore.",
  "Pieter, vous êtes allé seul au Temple de Sigmar. Vous avez parlé à Jacob Möhren de la mort de Jannik et de la disparition d’Ingrid. Lui aussi cherche des réponses : sur Aldric, sur Tobias et sur ce qu’Ernst Ricker sait de l’affaire. Vous avez accepté d’enquêter discrètement.",
  "Vous avez appris que Ricker loge sous le Temple et qu’il s’est brouillé avec Ursula Marbad après Magnustag. À la description de son visage, vous avez reconnu la femme des Docks. Jacob ne vous a accordé aucun accès au Temple ; il va partir dans les Montagnes Grises avec ses initiés. De retour auprès de vos compagnons, vous leur avez tout raconté.",
  "Chez les chasseurs de rats, vous avez obtenu la confirmation de Wahlund : lui, ses trois compagnons et Melina descendront avec vous contre les hommes-rats. Vous n’avez pas encore fixé de départ. Des égouts, on peut aussi atteindre les soubassements du Temple — mais Wahlund vous a prévenus que ces passages sont bien gardés.",
  "Vous voici maintenant à la Lune Rouge, au début de l’après-midi. Les clients quittent l’auberge. Franz ferme boutique pour son anniversaire. Vous avez apporté la poudre ; il vous reste à décider comment employer cette nuit, et comment en sortir."
];

section("SESSION 19 — LE DERNIER ANNIVERSAIRE");
c.push(body("Aubentag 14 Sigmarzeit • Début d’après-midi → minuit", {font:"Arial",size:28,bold:true,color:C.darkRed}));
c.push(timeBox("4 HEURES DE TABLE • CINQ JOUEURS • AUCUN INVITÉ"));
c.push(readAloud("Ce soir, Franz Lohner doit mourir. Il compte sur vous pour que ce ne soit qu’une rumeur."));
c.push(labelDetailTable([
["Départ","La Lune Rouge ferme. Les clients sont en train de partir. Le conseil de Franz n’a pas encore eu lieu."],
["Acquis","Poudre ordinaire livrée ; fuite par les cours arrière et embarcation de la Guilde préparées par Franz ; Silvi a payé 30 CO."],
["À décider","Charges magiques, guetteurs, leurre éventuel, signal de repli, allumeur, délai, protection des voisins."],
["Enjeu","Attendre assez pour prendre les quatre menaces au piège, sans sacrifier Franz ni bloquer sa fuite."],
["Paiement","Convention de campagne validée : 10 CO pour le groupe si la fuite et la fausse mort sont convaincantes ; Saif al-Janub si les quatre menaces sont détruites."],
["Secrets","Franz travaille pour Emmanuelle Nacht. S’il s’échappe avec succès, il lui recommande les PJs par leurs noms. Ils l’ignorent."],
]));
c.push(gm("Tout ce qui suit est une préparation conditionnelle. Aucun résultat de Session 19 n’est encore acquis. Conserver l’état de fin de Session 18 ; ne pas transformer les branches de ce guide en événements joués."));
c.push(h2("Navigation"));
c.push(body("2 Récapitulatif • 3 Rythme • 4 Conseil • 5 Lieux • 6 Cordelia • 7 Surveillance • 8 Attente • 9 Arrivées • 10 Réactions • 11 Détonation • 12 Profils • 13 Troisième incendie • 14 Dénouements • 15 Suivi • 16 Feuille joueurs."));
c.push(body("Sources : Red Moon Burning, livret d’aventures p. 34–35 (PDF local, 2 pages), préparation S18 et clarifications du MJ. Les procédures ajoutées sont signalées comme adaptations de table. Les horaires supposent que rien ne les dérange."));
c.push(warning("Le scénario imprimé offre 10 CO par personnage et peut faire rester Franz en ville. Ici : conserver le marché de campagne à 10 CO et la branche de départ validée. Ne pas reprendre automatiquement la fin publiée."));

section("2. LA DERNIÈRE FOIS…");
c.push(timeBox("0:00–0:10 DE TABLE • LECTURE : ENVIRON 3 MINUTES"));
for (const p of recap) c.push(readAloud(p));
c.push(gm("Adresser directement les deux passages individuels à Thucydion puis Pieter ; le reste au groupe. Ne pas ajouter les secrets de Silvi, l’identité du culte, le Pious Cup ou Nacht."));

section("3. CONDUIRE LES QUATRE HEURES");
c.push(dataTable(["TABLE","DANS LA FICTION","PRIORITÉ"],[
["0:00–0:10","Début d’après-midi","Récapitulatif, rappeler l’emplacement des PJs."],
["0:10–0:40","Conseil de Franz","Quatre menaces, récompense, postes et signaux."],
["0:40–1:20","Après-midi","Cordelia ; travaux et guetteurs ; filature éventuelle."],
["1:20–1:35","Crépuscule → 21 h","Vérifications, anniversaire, ellipse."],
["1:35–3:30","À partir de 21 h","Arrivées, interactions, décision d’allumer, fuite."],
["3:30–4:00","Après l’affrontement → minuit","Survivants, feu, autorités, paiement, hébergement."]
],[1800,2700,4860]));
c.push(h2("Le temps avance à deux échelles"));
c.push(body("Entre deux faits nouveaux, demander si quelqu’un agit puis avancer l’horloge. Ne pas jouer quinze minutes d’attente round par round. Dès qu’une poursuite, une attaque ou une mèche impose l’urgence, passer aux rounds et tenir le décompte. Quinze minutes de fiction ne se réduisent pas à quelques rounds pour faire entrer le prochain ennemi."));
c.push(body("Un combat à 21 h peut finir bien avant 21 h 15. Les autres ennemis réagissent au bruit seulement s’ils sont déjà à portée de l’entendre ; sinon, leur horaire demeure. Après un affrontement bref, reprendre l’ellipse si les PJs sécurisent la situation."));
c.push(h2("Si la table prend du retard"));
c.push(bullet("Avant 1 h 20","Conclure les achats simples sans nouveaux obstacles. Une seule scène de filature ou d’embuscade suffit."));
c.push(bullet("Après 3 h 10","Rappeler les issues visibles, la position de Franz et les menaces encore dehors. Accélérer les résolutions déjà acquises entre PNJs, jamais décider à la place des PJs d’allumer."));
c.push(bullet("À 3 h 30","Viser le repli ou un dénouement ; si le groupe choisit de prolonger, garder un court bilan et accepter un débordement ou une reprise. Ne pas garantir artificiellement l’explosion."));
c.push(absent("Aucun joueur n’est prévu absent. Ces encadrés concernent les personnages qui quittent une scène ou négligent une tâche : les ennemis et l’incendie continuent d’agir."));
c.push(music("Conseil : ambiance de taverne douce. Courses : ambiance urbaine de The Witcher 3. Attente : retirer progressivement la musique. Intrusions : nappes discrètes de Darkest Dungeon ; mêlée : Vermintide. Après le souffle : silence."));

section("4. FRANZ MET LES CARTES SUR LA TABLE");
c.push(timeBox("DÉBUT D’APRÈS-MIDI • 30 MINUTES DE TABLE"));
c.push(readAloud("Franz referme un volet, puis pose quatre bouts de papier sur la table. Un nain. Un rat. Sept traits. Un crâne couronné. Derrière vous, un client proteste encore qu’il n’a pas fini sa bière. Franz attend que la porte se referme. « Bon. Voilà ceux qui vont me souhaiter mon anniversaire. »"));
c.push(dataTable(["MENACE","CE QUE FRANZ PEUT DIRE"],[
["Thikad Urgolsson","Un Tueur convaincu que Franz l’a dépouillé de Grudgebringer en trichant aux Doigts de Ranald. Il veut sa mort ; il est résistant et peu discret."],
["Shrinq Shaderipper","Un assassin skaven envoyé contre lui pour ses anciennes campagnes en Tilée. Grimpeur dangereux, patient, capable d’entrer par le haut."],
["Carmello Esposito et ses hommes","Sept hommes au total, au service de la Marchesa Caramanici. Armés pour tuer à distance et travailler ensemble."],
["Tah-Ra Mentuhr","Une présence néhekharienne qui veut s’emparer de son corps. L’acier ordinaire est inutile ; il faut une attaque magique."]
],[2700,6660]));
c.push(quote("Franz","Dix couronnes pour me sortir de là et laisser derrière nous une mort à laquelle on puisse croire. Si aucun de ces quatre problèmes ne survit, vous aurez aussi Saif al-Janub. Mais si vous faites sauter la maison au premier coup frappé, les autres n’auront aucune raison d’y entrer."));
c.push(body("Il présente la lame et ses qualités avant que les PJs prennent leur décision. Il veut survivre ; si tout tourne mal, il ordonne le repli plutôt que de mourir pour le bonus. Les quatre menaces comprennent toute la bande de Carmello : deux hommes échappés restent des survivants, même si leur chef meurt."));
c.push(quote("Franz","Je vous donne leurs raisons. Pas leur montre. Regardez, transmettez ce que vous voyez, et ne confondez pas un bruit sur le toit avec une tête dans un sac."));
c.push(h2("Six décisions à noter"));
c.push(body("Qui garde Franz ? Qui surveille l’étage ? Qui observe la rue et l’arrière ? Qui allume ? Quel signal signifie « sortez » ? À quel endroit les survivants se retrouvent-ils ? Affecter plusieurs tâches à une personne est possible, mais pas simultanément à deux endroits."));
c.push(body("Franz propose de rester visible par moments dans la salle, puis d’utiliser un mannequin vêtu de son manteau si les PJs le souhaitent. Un leurre peut tromper un coup d’œil ; il ne trompe pas indéfiniment le contact ou une inspection."));
c.push(absent("Sans conseil ni répartition, Franz peut vider l’auberge et préparer ses affaires. Il ne fournit pas à lui seul une surveillance parfaite, une charge magique et des signaux que personne n’a convenus."));

section("5. L’AUBERGE ET LA SORTIE");
c.push(gm("Schéma de jeu repris de la préparation de campagne : positions relatives, pas plan officiel à l’échelle. Fixer les distances avant le combat ; ne pas transformer trois minutes de trajet jusqu’au bateau en un seul Mouvement."));
c.push(diagram([
"                         RUE / FACADE",
"                         A : PORTE",
"                             |",
" B : ALCOVES ----- C : SALLE / FRANZ ---- D : COMMUN",
"                       |                      |",
"                 E : CAVE                 F : CUISINE",
"                                              |",
"                                         G : COUR",
"                                              |",
"                              COUR DU TONNELIER -> HANGAR",
"",
" ETAGE : I : CHAMBRES ---- J : CHAMBRE DE FRANZ",
"           FENETRE ARRIERE     ARMOIRE / CONDUIT",
"                    ESCALIER VERS C",
]));
c.push(h2("Repères à fixer avec les joueurs"));
c.push(bullet("Charge","La poudre est déjà sur place. Les PJs choisissent sa disposition dans la cave ; le conduit d’allumage rejoint le passage de la cuisine. Il s’agit du dispositif fictionnel du scénario, sans recette technique."));
c.push(bullet("Postes","Depuis C, on voit la porte et le bas de l’escalier, pas le toit. Depuis G, on surveille la sortie et une partie de l’arrière, pas toutes les fenêtres. Un guetteur à l’étage peut écouter le conduit."));
c.push(bullet("Repli","De C, gagner F puis G ; traverser la cour coopérante, puis rejoindre le hangar à environ trois minutes à pied. Franz a obtenu une barque couverte de la Guilde des Bateliers. La traversée de G suffit à sortir de l’auberge, pas à disparaître."));
c.push(bullet("Repère tactique","Adaptation : C–F ≈ 6 m ; F–G ≈ 4 m ; porte de la chambre J–escalier ≈ 6 m. L’escalier, les portes fermées et les ennemis peuvent imposer des actions supplémentaires. Adapter au plan de la table une fois, avant l’urgence."));
c.push(h2("Améliorations concrètes"));
c.push(body("Vérifier une porte et dégager un passage ne demandent pas de jet sans difficulté réelle. Un travail délicat relève de Métier (Charpentier), une fausse piste d’un test adapté à la méthode. En cas de réussite, décrire le bénéfice précis : porte qui ferme, sortie dégagée, leurre visible. Pas de bonus universel cumulatif."));
c.push(warning("Évacuer clients et personnel ne vide pas les maisons voisines. Prévenir discrètement une famille protège des vies mais peut créer un témoin de la préparation. La poudre et les bagages abandonnés ne se téléportent pas dans la barque."));
c.push(absent("Si personne ne vérifie le repli, Franz connaît le chemin mais ignore une surveillance récente. Sans poste à l’étage, les intrus peuvent s’y installer sans être annoncés."));

section("6. UNE COURSE CHEZ CORDELIA");
c.push(timeBox("APRÈS-MIDI • 5–10 MINUTES DE TABLE HORS FILATURE"));
c.push(readAloud("Cordelia vous laisse finir. Au mot « spectre », elle pose son pilon. « Franz a toujours eu le don de recevoir des visites déplaisantes. Montrez-moi ce que vous comptez utiliser. »"));
c.push(body("Franz indique son adresse et suggère de la consulter. Pour éviter une nouvelle quête, elle accepte sur la base des liens déjà établis. Aucun jet social obligatoire ne bloque l’obtention des charges. Les PJs peuvent lui apporter leur poudre ou convenir qu’elle vienne traiter les réserves à l’auberge ; fixer qui transporte quoi et par quel chemin."));
c.push(gm("Adaptation logistique : réserver environ une heure aller, retour et intervention compris, selon le point de départ. Le traitement est accompli pendant cette fenêtre. Ne pas imposer les ingrédients ou prélèvements spéculatifs du guide précédent. Le résultat est la propriété Magical appliquée à la charge, comme dans le scénario."));
c.push(quote("Cordelia","Cela pourra atteindre ce qui n’a plus de corps. Cela ne fera pas la différence entre lui et les gens qui habitent à côté."));
c.push(h2("Si Silas vient"));
c.push(body("Elle lui confie une tâche d’assistant : examiner les contenants, préparer l’espace, noter ce qui a été traité et expliquer les précautions aux autres. Valoriser son apprentissage par une responsabilité utile. Un test de Métier (Apothicaire) seulement s’il tente quelque chose d’incertain ; un échec coûte du temps ou appelle une correction, jamais la seule solution au spectre."));
c.push(quote("Cordelia, à Silas","Vous vous rappelez ce que je vous ai montré ? Bien. Vérifiez ceux-ci. Je préfère une question maintenant à une certitude mal placée ce soir."));
c.push(body("Si Silas n’est pas là, jouer la même aide sans scène personnelle de remplacement. Cordelia reste à son travail après l’intervention ; elle ne rejoint pas automatiquement le combat. Engel n’est pas requis et son aide contre les Skavens reste en attente."));
c.push(h2("Le chemin compte"));
c.push(body("Un observateur qui voit un départ peut suivre le PJ. Une visite à une apothicaire n’explique pas à elle seule la magie ou la bombe : le témoin doit observer des contenants, entendre une explication ou voir le retour de Cordelia. Voir la page suivante."));
c.push(h2("Option courte : chandelle de Prochnow"));
c.push(body("5 pistoles ; achat sans jet si disponible et demandé normalement. Le personnage qui l’allume choisit un délai de 4 à 12 rounds. Sans elle, mèche normale : 1d10+4 rounds. Traiter cette course en quelques phrases ; pas de nouvelle intrigue."));
c.push(absent("Sans visite ni autre moyen magique établi, la poudre demeure ordinaire : le souffle ne blesse pas Tah-Ra. Les PJs peuvent encore fuir ou employer une autre attaque magique réellement disponible ; la destruction des quatre menaces devient plus difficile."));

section("7. CE QUE CARMELLO PEUT APPRENDRE");
c.push(timeBox("HORLOGE DE SOUPÇON • DÉPART : 0 • ADAPTATION DE CAMPAGNE"));
c.push(dataTable(["NIVEAU","PREUVE NÉCESSAIRE","RÉACTION POSSIBLE"],[
["0 — Livraison","Il sait déjà qu’une livraison de poudre a atteint Franz.","Un observateur parmi les sept surveille l’auberge."],
["1 — Préparatifs","Il voit un déplacement inhabituel de matériel ou plusieurs indices concordants.","Il suit une course ou demande un relais."],
["2 — Piège probable","Il voit les charges revenir ou apprend quelque chose de concret sur le dispositif.","À l’assaut : cinq entrent, deux restent dehors. Ils cherchent comment sortir."],
["3 — Sortie repérée","Un homme a réellement suivi le trajet des cours ou vu les préparatifs du bateau.","Un des deux couvre cet accès ; il ne connaît pas toutes les issues."],
["4 — Contre-attaque","Ils ont identifié un porteur isolé et un lieu favorable, puis transmis l’information.","Embuscade limitée ou déplacement anticipé : le groupe peut casser le calendrier."]
],[1680,3900,3780]));
c.push(body("Ne monter qu’une fois par indice distinct. La fermeture annoncée pour l’anniversaire ne révèle rien à elle seule. Une visite publique à Cordelia peut justifier une filature, pas une connaissance instantanée de la magie. Un observateur coupé de son chef ne transmet rien par télépathie."));
c.push(h2("Déceler et semer le suiveur"));
c.push(body("Valeur de campagne conservée : Discrétion du guetteur 45. Un PJ attentif oppose Perception à cette valeur ; une contre-filature ou un détour se résout selon la méthode décrite. Indices : le même manteau à deux carrefours, un arrêt quand le porteur s’arrête, une silhouette devant la boutique après la visite."));
c.push(body("S’il est découvert, il préfère nier et décrocher. Les PJs peuvent l’interroger, l’effrayer ou lui montrer une fausse piste. Une explication crédible peut réduire une fois le soupçon d’un niveau ; elle n’efface pas une sortie réellement vue. Noter séparément les lieux et faits connus."));
c.push(h2("Embuscade facultative : deux hommes, une issue visible"));
c.push(body("Le suiveur rejoint un complice après un signal plausible. Ils tentent de barrer le chemin d’un porteur isolé et de lui arracher son chargement. Décrire les positions avant les jets : cour étroite devant, passage commerçant derrière. Utiliser les profils des hommes de Carmello ; ne pas accorder une surprise automatique."));
c.push(body("Leur but est de comprendre ou saboter la préparation, pas de se battre jusqu’à la mort. Si le PJ gagne la rue passante, reçoit du renfort ou blesse sérieusement l’un d’eux, ils peuvent décrocher. Résoudre en quelques décisions ; le prix peut être du temps, une charge perdue, une blessure ou un témoin."));
c.push(warning("Il y a sept hommes au total, Carmello compris. Le guetteur et les éventuels assaillants de l’après-midi en font partie. Toute mort, blessure, capture ou fuite réduit ou modifie la bande du soir."));
c.push(absent("Sans contre-surveillance, les hommes ne sont pas automatiquement omniscients : ils obtiennent seulement ce que les déplacements exposent. Une sortie jamais empruntée devant eux reste inconnue."));

section("8. QUAND L’AUBERGE SE TAIT");
c.push(timeBox("CRÉPUSCULE → 21 H • 15 MINUTES DE TABLE"));
c.push(readAloud("Les voix des clients se sont éloignées depuis longtemps. Il reste les bruits auxquels vous ne prêtiez jamais attention : une poutre qui travaille, un volet qui frappe, l’eau contre les quais. Franz sort cinq gobelets, hésite, puis en ajoute un sixième. « Tant que nous sommes encore tous là. »"));
c.push(body("Laisser une vraie minute aux PJs pour trinquer, plaisanter ou demander ce qu’il regrettera. Franz peut évoquer une table bancale, un employé têtu ou les récits entendus derrière son comptoir. Il ne révèle pas Nacht."));
c.push(quote("Franz","J’aurais préféré une autre manière de ne pas vieillir."));
c.push(h2("Avant l’ellipse"));
c.push(body("Faire nommer les postes, les moyens de communication et la position de Franz. Distinguer allumeur principal et remplaçant. Compter les charges effectivement traitées, le matériel resté sur place et les personnes prévenues. Confirmer qui porte l’argent, la lame et les effets personnels à sauver."));
c.push(body("Si les PJs préviennent les voisins, établir qui part et qui refuse : un locataire inquiet, un commerçant qui ne veut pas quitter sa caisse. Un argument précis ou une aide pratique vaut mieux qu’un jet répété jusqu’à obtenir l’évacuation. Les refus laissent des personnes à secourir."));
c.push(h2("En arrière-plan"));
c.push(body("Ernst quitte le Temple en fin d’après-midi. Sans PJ pour l’observer, aucune découverte du Pious Cup n’a lieu. Jacob part avec ses initiés ; Silvi réserve son dossier au 15. Aucun messager ne vient lancer une intrigue personnelle pendant la préparation."));
c.push(body("Si les PJs choisissent malgré tout de partir suivre Ricker, expliquer le temps de trajet et les postes qu’ils quittent. Leurs chances d’en apprendre davantage ne suspendent pas les arrivées à l’auberge."));
c.push(music("Commencer avec une ambiance de taverne presque vide, puis couper. Garder le silence pour le toast. Réintroduire un fond sourd seulement lorsqu’un signe d’intrusion apparaît."));
c.push(absent("Sans vérification finale, conserver les positions réellement convenues ; ne pas placer rétroactivement le bon PJ au bon endroit. Les effets laissés dans l’auberge risquent d’être perdus dans sa destruction."));

section("9. LES ARRIVÉES — HORLOGE DU MJ");
c.push(timeBox("21 H • SHRINQ ENTRE ; LE FROID COMMENCE"));
c.push(readAloud("Un frottement descend quelque part dans la maçonnerie. Il cesse. Dans la salle, un gobelet perle de froid sous vos doigts."));
c.push(body("Ne donner le bruit du conduit qu’à portée d’écoute. Shrinq descend par la cheminée et cherche l’armoire de Franz pour attendre une occasion. Un guetteur au bon endroit oppose Perception à sa Discrétion 71, valeur de campagne. Une entrée barrée le force à chercher une alternative ; elle ne le fait pas apparaître dans l’armoire."));
c.push(body("Tah-Ra commence à se manifester. Décrire le froid sans rendre immédiatement le spectre visible à tous. À 21 h 15, Seconde Vue permet de le discerner et des attaques magiques peuvent le toucher, conformément au scénario."));
c.push(timeBox("21 H 15 • THIKAD À LA PORTE"));
c.push(quote("Thikad","Lohner ! Tu peux fermer ta porte. Tu ne peux pas fermer ta dette !"));
c.push(body("Il exige Franz, ivre et furieux. Une conversation peut le retenir ; promettre un duel peut le faire entrer si les PJs en respectent les conditions. Une insulte, un tir ou une fuite visible peut précipiter l’attaque. Il n’attend pas quinze minutes sous une pluie de projectiles parce qu’un horaire l’exige."));
c.push(timeBox("VERS 21 H 30 • LES ENTRÉES SE CROISENT"));
c.push(body("Sans perturbation, Carmello tente la fenêtre arrière à l’étage. Soupçon 0–1 : les sept survivants disponibles entrent ; à partir de 2 : cinq entrent et deux restent dehors, ajuster aux pertes. Thikad force la porte si la discussion n’a rien changé. Shrinq descend vers le bruit ; les intrus peuvent se croiser dans l’escalier."));
c.push(readAloud("Le bois cède devant. À l’étage, une vitre éclate. Entre les tables, le froid prend un visage — et vous comprenez que celui-là n’avait pas besoin de porte."));
c.push(body("Tah-Ra se manifeste pleinement et cherche Franz. Donner aux PJs ce que leurs positions permettent de percevoir, puis demander leurs actions. Ne pas annoncer « les quatre sont entrés » sans moyen de le savoir."));
c.push(h2("Si le plan est perturbé"));
c.push(body("Une détonation anticipée fait renoncer les arrivants encore dehors à pénétrer dans les flammes. Une alarme ou un combat visible peut faire déplacer Carmello, faire attendre Shrinq ou pousser Thikad à entrer plus tôt. La pleine manifestation de Tah-Ra reste liée à son propre processus ; un vacarme n’est pas une téléportation."));
c.push(absent("Si l’auberge est abandonnée, les intrus la fouillent selon leurs accès. Sans Franz, Tah-Ra n’accomplit pas son objectif ; Carmello et Shrinq peuvent relever des traces ou repartir. Aucun ennemi ne reste docilement dans une maison manifestement piégée."));

section("10. QUATRE ENNEMIS, QUATRE INTENTIONS");
c.push(dataTable(["ENNEMI","CE QU’IL CHERCHE","CE QUI LE FAIT CHANGER"],[
["Thikad","Confronter et tuer Franz pour sa honte.","Un duel accepté le fixe ; quelqu’un qui lui vole sa vengeance attire sa colère. Le feu ne le rend pas raisonnable, mais il n’est pas immobilisé."],
["Shrinq","Tuer sa cible, si possible en conservant une preuve.","Privilégie le dos, une séparation et une retraite verticale. Un piège découvert lui fait chercher une autre occasion."],
["Carmello","Tuer ou maîtriser Franz ; garder des témoins utiles sous contrôle.","Coordonne les tirs et les accès. Si le piège est évident, replie ses hommes et cherche la véritable sortie."],
["Tah-Ra","Posséder Franz vivant pour atteindre les Grudgebringers.","Traverse les obstacles matériels. S’oppose à ceux qui tueraient son hôte ; se dérobe aux attaques magiques."]
],[1700,3300,4360]));
c.push(h2("Interactions à exploiter"));
c.push(bullet("Escalier","Carmello ne s’attend pas à un Skaven. Si leurs routes se croisent, hésitation, menace ou coup de feu peuvent ouvrir une fenêtre d’action. Ce n’est pas une alliance automatique contre les PJs."));
c.push(bullet("Vengeance","Thikad peut barrer le passage à celui qui tente de lui ravir Franz. Une provocation crédible l’oriente ; un test social peut être nécessaire, pas une commande mentale."));
c.push(bullet("Hôte vivant","Tah-Ra veut atteindre Franz ; si un assassin menace immédiatement sa vie, le spectre peut frapper l’assassin. Il ne protège pas pour autant les PJs."));
c.push(bullet("Piège révélé","Le cri « de la poudre ! » peut hâter une retraite s’il est entendu et cru. Un ennemi qui fuit reste une menace survivante ; le bonus n’est pas gagné simplement parce qu’il quitte la carte."));
c.push(h2("Possession : procédure de campagne explicite"));
c.push(gm("Le profil imprimé donne l’objectif de possession sans procédure détaillée ici. Arbitrage pour cette séance, distinct d’une règle officielle : Tah-Ra doit être pleinement manifesté et au contact de Franz. Il consacre son Action à un test opposé de FM (59 contre la FM du profil de Franz utilisé à la table). Il lui faut gagner lors de deux de ses tours consécutifs ; une opposition perdue, la séparation ou une blessure magique remet ce progrès à zéro."));
c.push(body("Premier succès : voix doublée, gestes qui résistent ; annoncer aux témoins que quelque chose tente de le prendre. Deuxième succès : Franz devient l’hôte, reste vivant et cherche à quitter les lieux sous le contrôle du spectre. Une charge magique peut blesser l’entité, mais l’explosion blesse aussi Franz. Pas d’exorcisme gratuit ni de recommandation à Nacht par un Franz possédé."));
c.push(warning("Une reddition, une capture ou un accord sont des issues possibles. Pour le bonus promis, une menace capturée mais vivante n’est pas détruite. Franz peut renégocier après coup ; ne pas changer silencieusement le marché."));
c.push(music("Laisser monter Vermintide quand les accès se rompent. Baisser la musique pour une négociation avec Thikad ou les premiers signes de possession : les informations doivent rester audibles."));

section("11. ALLUMER, TENIR, SORTIR");
c.push(timeBox("PASSER AUX ROUNDS DÈS QUE LA MÈCHE EST ALLUMÉE"));
c.push(h2("Procédure du scénario"));
c.push(bullet("Mèche ordinaire","Tirer secrètement 1d10+4 rounds à l’allumage. Un test simple de Perception Accessible (+20), qui prend une Action, permet d’en estimer le délai."));
c.push(bullet("Chandelle","Si acquise, l’allumeur choisit un délai de 4 à 12 rounds. Noter le chiffre et le moment d’allumage."));
c.push(bullet("Convention de décompte","Adaptation : réduire le compteur à la fin de chaque round complet suivant celui de l’allumage ; à zéro, résoudre l’explosion. Annoncer cette convention avant la décision."));
c.push(bullet("Explosion","Toute personne encore dans l’auberge subit 1d10+15 Dégâts et 5 états En flammes. Appliquer les règles de dégâts et d’états de la table ; pas de mort automatique des PNJs. Le traitement de Cordelia donne Magical à l’explosion et lui permet d’atteindre Tah-Ra."));
c.push(body("Résoudre la position réelle de chacun au moment du souffle. Ne pas lancer un test d’esquive universel qui annulerait la règle du scénario. Un ennemi ayant quitté l’auberge n’est pas inclus dans ces dégâts ; les dangers extérieurs sont traités selon son emplacement."));
c.push(h2("Feuille de suivi"));
c.push(dataTable(["À INSCRIRE","VALEUR / ÉTAT"],[
["Allumage / délai initial / restant","________________________"],
["Franz / accompagnateur / issue","________________________"],
["Thikad / Shrinq / Tah-Ra / possession","________________________"],
["Carmello : dedans / dehors / hors combat","________________________"]
],[4200,5160]));
c.push(h2("Obstacles qui comptent"));
c.push(body("Un ennemi dans la cuisine, une porte barrée ou un allié tombé imposent une décision réelle : dégager, contourner, porter, abandonner. Décrire ce qui bloque avant les jets. Ne pas ajouter un obstacle aléatoire à chaque round si les préparatifs ont dégagé la sortie."));
c.push(body("Ne pas convertir le passage jusqu’au bateau en une distance fictivement instantanée : il faut d’abord sortir du volume de l’auberge avant le souffle, puis traverser les cours et parcourir le reste du trajet. Les hommes extérieurs de Carmello peuvent agir sur ce second temps."));
c.push(warning("Saif al-Janub n’a pas le trait Magical dans le profil publié. Fine 4 et Unbreakable n’en font pas une solution contre Tah-Ra. Vérifier les attaques réellement magiques disponibles avant de les autoriser contre lui."));
c.push(absent("Sans allumeur présent, le dispositif ne se déclenche pas tout seul. Si le personnage désigné tombe, quelqu’un doit réellement le remplacer ou trouver une autre issue."));

section("12. PROFILS ET ARBITRAGES RAPIDES");
c.push(body("Profils vérifiés sur Red Moon Burning, p. 34–35. Ordre : M / CC / CT / F / E / I / Ag / Dex / Int / FM / Soc / B. Les valeurs de Discrétion des guetteurs viennent de la préparation de campagne, pas des encadrés imprimés.",{size:20}));
c.push(h2("Thikad Urgolsson"));
c.push(body("3 / 56 / 39 / 36 / 52 / 31 / 28 / 38 / 36 / 67 / 24 / 19",{font:"Courier New",size:20}));
c.push(body("Résistance à l’alcool 67 ; Calme 77 ; Esquive 43. Traits publiés : Bounce (rune de saut sur sa boucle), Weapon +7. Tenir compte de sa mobilité inhabituelle ; un meuble n’est pas une prison."));
c.push(h2("Shrinq Shaderipper"));
c.push(body("6 / 66 / 57 / 39 / 38 / 63 / 61 / 36 / 46 / 45 / 19 / 13",{font:"Courier New",size:20}));
c.push(body("Armour 2 ; Champion ; Ranged +6 (20) ; Tracker ; Wallcrawler ; Weapon +7. Discrétion 71 : valeur d’adaptation conservée du guide S18. Soc 19, corrigée d’après le PDF, et non 29."));
c.push(h2("Bande de Carmello — sept humains au total"));
c.push(body("4 / 41 / 45 / 32 / 38 / 34 / 28 / 36 / 27 / 36 / 29 / 12",{font:"Courier New",size:20}));
c.push(body("Intimidation 42 ; Armour (Light 2) ; Ranged +8 (50) ; Weapon +7. Guetteur : Discrétion 45, valeur de campagne. Utiliser ce profil aussi pour Carmello ; pas de huitième homme ajouté."));
c.push(h2("Tah-Ra Mentuhr"));
c.push(body("6 / 44 / — / 33 / 32 / 19 / 35 / 27 / 28 / 59 / 19 / 14",{font:"Courier New",size:20}));
c.push(body("Chill Grasp ; Dark Vision ; Ethereal ; Fear ; Magical ; Painless ; Weapon +9. Conserver les intitulés anglais pour retrouver les traits. Le profil ne chiffre pas Fear : convention de cette séance, Peur 2, puis employer les règles habituelles de Peur. Possession : adaptation explicitée en section 10."));
c.push(h2("Franz et les règles communes"));
c.push(body("Franz : utiliser son profil du Guide d’Ubersreik, p. 28 ; ne pas lui donner une immunité narrative. Les traits, avantages, critiques, poursuites et états suivent les règles WFRP4 utilisées par le groupe. Les +7/+9 ci-dessus sont les dégâts des traits d’arme, pas des bonus à ajouter une deuxième fois à la Force."));
c.push(h2("Saif al-Janub"));
c.push(body("Groupe Basic ; 20 CO ; Enc. 1 ; Exotic ; allonge Medium ; dégâts BF+5 ; Defensive, Fine 4, Unbreakable. Lame reçue par Franz après la défense de Sudenburg en 2498 CI ; aucun trait Magical."));
c.push(gm("Avant le combat : relever les Blessures et états actuels des PJs. Ni la nuit de veille ni la visite chez Cordelia n’effacent automatiquement la blessure de Silas ou la Corruption de Ludwig et Pieter."));

section("13. UN TROISIÈME INCENDIE");
c.push(timeBox("APRÈS LE SOUFFLE • CONSÉQUENCES CONDITIONNELLES"));
c.push(readAloud("La lumière arrive avant que vous compreniez le bruit. Puis les voix reviennent : quelqu’un appelle un nom, une porte claque, un seau tombe. Sur les pavés, des gens regardent les fenêtres d’à côté."));
c.push(body("Employer ce texte seulement si la détonation a lieu. Ne fixer aucun nouveau bilan de morts avant de savoir qui était là, qui a été prévenu et ce que les PJs ont fait. Les pertes de la Fosse restent celles déjà établies."));
c.push(dataTable(["SITUATION OBSERVÉE","ÉVOLUTION","CHOIX IMMÉDIAT"],[
["Feu contenu","Auberge perdue, habitants proches dehors ; brandons encore dangereux.","Aider la chaîne de seaux, secourir un blessé ou protéger le départ."],
["Façade voisine menacée","Volets ou auvent prennent ; habitants encore présents.","Prévenir, ouvrir une issue, évacuer ; temps consacré face aux poursuivants."],
["Feu propagé","Une maison est atteinte, fumée dans l’escalier ; rues encombrées.","Sauvetage urgent, guide dans la fumée, blessés à traiter."],
["Aucune explosion","Tirs, cris ou traces d’effraction peuvent tout de même alerter.","Expliquer les morts ou partir ; pas de troisième incendie automatique."]
],[2340,3510,3510]));
c.push(h2("Horloge de réponse — repères d’adaptation"));
c.push(body("T+0–5 minutes : voisins aux fenêtres, premières aides et cris d’alerte. T+5–15 : une patrouille appelée arrive si les accès le permettent ; elle ouvre un passage et cherche les responsables présents. T+15–30 : renforts, relevé des noms et premiers témoignages ; Ottokar peut parvenir sur place après avoir été averti. Ajuster à une alerte donnée plus tôt, aux rues bloquées et à la proximité établie ; personne ne sait tout à T+0."));
c.push(body("Si un feu extérieur visible est laissé sans réponse pendant ces fenêtres, faire progresser le danger là où il a une prise. Une évacuation ou une action efficace peut l’arrêter. Pas de jet abstrait qui incendie une maison sans lien avec les lieux décrits."));
c.push(quote("Un sergent de patrouille","Qui a fait vider cette auberge ? Et qui l’a vue vide ?"));
c.push(quote("Ottokar","On me dit que Franz avait annoncé sa fermeture. Quand avez-vous compris qu’il y avait autre chose ?"));
c.push(h2("Ce que les témoins peuvent établir"));
c.push(body("Distinguer achat de poudre, avertissement des voisins, allumage et vue de Franz vivant après le souffle. Un témoin d’un seul fait ne prouve pas les autres. Ottokar recoupe, peut rechercher un entretien ou orienter son article ; une accusation publique dépend des éléments obtenus."));
c.push(absent("Si les PJs partent sans secourir les voisins, les secours locaux agissent avec leurs moyens ; le danger peut empirer. S’ils restent, ils deviennent plus faciles à identifier et risquent de retarder leur départ. Aucun choix n’efface automatiquement les témoins."));

section("14. CE QU’IL RESTE À MINUIT");
c.push(dataTable(["FRANZ","FAUSSE MORT / MENACES","CONSÉQUENCE"],[
["Échappé, libre","Mort crédible ; quatre menaces détruites","10 CO + lame. Départ discret ; recommandation secrète à Nacht."],
["Échappé, libre","Mort crédible ; au moins un ennemi vivant","10 CO ; pas de lame selon le marché. Inscrire les survivants et ce qu’ils savent. Recommandation à Nacht."],
["Échappé, libre","Survie exposée à un témoin fiable","Départ possible ; couverture compromise. 10 CO non automatiquement acquis : règlement à discuter selon ce qui a été accompli. Recommandation à Nacht si départ réussi."],
["Vivant, bloqué ou capturé","Auberge détruite ou non","Pas de faux succès. Localiser le captif, ravisseur et pistes. Sauvetage éventuel à préparer."],
["Vivant, possédé","Tah-Ra contrôle son départ","La présence physique de Franz dans la barque n’est pas une évasion réussie. Pas de recommandation automatique."],
["Mort","Mort certaine ou corps introuvable","Pas de paiement par miracle. Distinguer ce que les PJs savent et ce que la ville croit."]
],[1800,3120,4440]));
c.push(h2("La scène du bateau"));
c.push(readAloud("Sous la bâche, Franz garde les yeux tournés vers la ville. Il ouvre la bouche, puis la referme. Enfin, il pose une main sur le bord de la barque. « J’espère qu’ils se souviendront surtout des bonnes soirées. »"));
c.push(body("Seulement si Franz est vivant, libre et au bateau. Régler les récompenses. Les PJs peuvent débarquer à proximité pour rester à Ubersreik : fixer où et comment ils reviennent."));
c.push(gm("CANON CONFIRMÉ PAR LE MJ : Franz est un agent d’Emmanuelle Nacht ; ce lien explique une partie de ses renseignements. Si son départ réussit, il lui transmet les noms des membres du groupe et les recommande pour des travaux ultérieurs. Cette démarche reste hors scène et inconnue des PJs. Une éventuelle convocation aura lieu plus tard, sans intervention salvatrice de Nacht ce soir."));
c.push(h2("Un toit pour la suite"));
c.push(body("Si la Lune Rouge est perdue : demander refuge au Marteau Tordu, payer une autre auberge ou négocier avec les Bateliers. L’accueil dépend de leur explication et de leurs poursuivants."));
c.push(h2("Chaque survivant emporte quelque chose"));
c.push(body("Thikad : une vengeance intacte et peut-être un témoin de la fuite. Shrinq : une cible vivante ou une mort seulement supposée. Carmello : des visages, un lieu ou un itinéraire selon ses observations. Tah-Ra : un hôte possible ou une piste, sans destruction par un souffle ordinaire. Noter la connaissance réelle, pas seulement « vivant »."));
c.push(music("Silence pour les secours ; ambiance sombre de The Witcher 3 pour le départ. Pas de triomphe sur des maisons en feu."));

section("15. FIN DE SÉANCE — CE QU’IL FAUT NOTER");
c.push(dataTable(["SUIVI","À REMPLIR APRÈS LE JEU"],[
["Franz","Vivant / libre / lieu / départ réussi / témoins de sa survie."],
["Quatre menaces","Sort de Thikad, Shrinq, Tah-Ra ; identité et nombre des hommes de Carmello restants."],
["Ville","Auberge ; bâtiments voisins ; évacués, blessés, morts et disparus effectivement établis."],
["Autorités et presse","Qui a vu quoi ? Noms relevés ? Accusation, poursuite ou simple enquête ?"],
["Ressources","Paiement reçu, lame remise, affaires perdues, dépenses, Blessures et états."],
["Repos","Lieu où les PJs terminent ; heure ; accompagnateurs et personnes poursuivies."],
["Nacht — secret","Départ réussi de Franz ? Recommandation à effectuer ou effectuée hors scène ? Aucune connaissance PJ automatique."]
],[2520,6840]));
c.push(h2("Les échéances ne disparaissent pas"));
c.push(bullet("Marktag 15","Poetry Circle, Isolde, Falck et compte rendu à Elsa. Silvi prévoit son nouveau dossier ; rien du document de brainstorming ne devient vrai sans décision du MJ."));
c.push(bullet("Backertag 16","Pieter contre Eisfange ; retour public de Félix et fin du délai de Kaspar."));
c.push(bullet("Expédition","Wahlund, ses trois hommes, Melina et Gunnar restent engagés. Aucun rendez-vous précis ; ne pas les faire partir pour un rendez-vous imaginaire manqué."));
c.push(bullet("Sigmartag 18","Attentat contre la caserne toujours prévu si rien ne l’empêche. Les PJs n’en connaissent pas automatiquement le plan."));
c.push(bullet("Temple","Ricker quitte le Temple en fin d’après-midi. Aucune filature jouée : aucun progrès automatique sur Ingrid ou le Pious Cup."));
c.push(h2("Décisions différées"));
c.push(body("Dossier de Silvi à finaliser lors de la prochaine préparation ; conséquences d’une éventuelle publicité autour du troisième feu ; réactions d’Otto et de Mercy seulement selon les informations qui leur parviennent ; forme et date d’une future convocation de Nacht."));
c.push(warning("Ne pas réécrire la soirée comme une réussite prévue d’avance. Si la ville croit Franz mort alors qu’un ennemi l’a vu fuir, conserver les deux niveaux de connaissance."));
c.push(body("Document de travail associé : campaign_docs/campaign/brainstorming/silvi_intel_15_noncanon.md. Il ne s’agit ni d’un dossier reçu par les PJs ni d’une liste de faits à intégrer à l’état de campagne.",{size:20}));

section("16. FEUILLE JOUEURS — LE PLAN DE FRANZ");
c.push(body("À donner après le conseil. Cette page seule peut être imprimée pour les joueurs.",{font:"Arial",size:20,italics:true}));
c.push(readAloud("Vous devez faire croire qu’un aubergiste est mort, tandis que ceux qui veulent sa peau entrent chez lui. La poudre est prête à être employée. Le reste dépend de vos choix."));
c.push(h2("Ce que Franz vous a expliqué"));
c.push(body("Un Tueur veut sa vengeance ; un assassin homme-rat cherche sa tête ; sept hommes servent une ennemie des Principautés Frontalières ; un spectre veut s’emparer de son corps. Franz ignore quand chacun agira. Une explosion trop précoce avertira ceux qui ne sont pas encore entrés."));
c.push(body("Le spectre exige une attaque magique. Cordelia peut aider. La sortie prévue passe par la cuisine et les cours arrière jusqu’à une embarcation des Bateliers. Les maisons voisines ne sont pas nécessairement vides."));
c.push(body("Marché : 10 couronnes pour une fuite et une fausse mort convaincantes ; Saif al-Janub si les quatre menaces sont détruites."));
c.push(dataTable(["RESPONSABILITÉ","VOTRE DÉCISION"],[
["Auprès de Franz","______________________________"],
["Étage / accès en hauteur","______________________________"],
["Rue / arrière / surveillance","______________________________"],
["Allumeur / remplaçant","______________________________"],
["Signal de repli","______________________________"],
["Délai choisi si chandelle","______________________________"],
["Voisins prévenus / passage dégagé","______________________________"],
["Point de rendez-vous si séparés","______________________________"]
],[4200,5160]));
c.push(quote("Franz","Si vous changez le plan, dites-le à celui qui tient la mèche."));
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
    run("Session 19 — Le Dernier Anniversaire — ", { font: "Arial", size: 16, color: C.grey }),
    new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: C.grey }),
  ],
})] });

const doc = new Document({
  creator: "Ubersreik Campaign",
  title: "Session 19 — Le Dernier Anniversaire",
  description: "Guide MJ en français : anniversaire de Franz, convergence des ennemis et conséquences.",
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
const outputPath = path.join(outputDir, "Session 19 - Le Dernier Anniversaire.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generated ${outputPath} (${c.length} blocks, ${buffer.length} bytes)`);
