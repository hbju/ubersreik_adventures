const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ShadingType, LevelFormat, PageBreak
} = require('../.docx-runtime/node_modules/docx');
const fs = require('fs');
const path = require('path');

const C = {
  red: '8B1A1A', dkRed: '5C0011', blue: '1F3864', gold: '7B5200',
  grey: '555555', lgrey: '888888', black: '1A1A1A', green: '2E5F2E',
  purple: '5C2D82', teal: '1A5F5F', warm: '6B3A00', music: '2D5F8A'
};

const tr = (text, o = {}) => new TextRun({
  text, font: o.font || 'Georgia', size: o.size || 22, color: o.color || C.black,
  bold: o.bold, italics: o.italics, break: o.break
});
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [tr(t, { font: 'Arial', size: 38, bold: true, color: C.red })] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [tr(t, { font: 'Arial', size: 28, bold: true, color: C.dkRed })] });
const h3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [tr(t, { font: 'Arial', size: 24, bold: true, color: C.blue })] });
const body = (t, o = {}) => new Paragraph({ spacing: { after: 150, line: 300 }, keepNext: o.keepNext, children: [tr(t, o)] });
const box = (label, t, fill, color, bold = true) => new Paragraph({
  shading: { fill, type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 12, color, space: 6 } },
  indent: { left: 400, right: 160 }, spacing: { before: 80, after: 180, line: 290 },
  children: [tr(label + ' — ', { font: 'Arial', size: 20, bold, color }), tr(t, { font: 'Arial', size: 20, italics: true, color })]
});
const gm = t => box('GM', t, 'FFF8E1', C.gold);
const warn = t => box('⚠', t, 'FDE8E8', C.red);
const absent = t => box('✖ SI LES PJs NE SONT PAS LÀ', t, 'F3E8FD', C.purple, false);
const music = t => box('♫ MUSIQUE', t, 'E8EEF8', C.music, false);
const read = t => new Paragraph({
  shading: { fill: 'FDF6EE', type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 14, color: C.warm, space: 8 } },
  indent: { left: 500, right: 300 }, spacing: { before: 100, after: 140, line: 320 },
  children: [tr(t, { italics: true, color: '3A2010' })]
});
const time = t => new Paragraph({
  shading: { fill: 'E0F0E0', type: ShadingType.CLEAR },
  border: { left: { style: BorderStyle.THICK, size: 14, color: C.green, space: 6 } },
  spacing: { before: 250, after: 120 }, children: [tr('⏰ ' + t, { font: 'Arial', size: 26, bold: true, color: C.green })]
});
const q = (s, t) => new Paragraph({
  indent: { left: 720, right: 360 }, spacing: { before: 50, after: 100 },
  children: [tr(s + ' : ', { font: 'Arial', size: 21, bold: true, color: C.dkRed }), tr('« ' + t + ' »', { size: 21, italics: true })]
});
const bul = (label, t) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 }, spacing: { after: 90, line: 290 },
  children: [tr(label + (t ? ' — ' : ''), { bold: !!t }), tr(t || '')]
});
const divider = () => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.red, space: 1 } }, spacing: { before: 200, after: 200 }, children: [tr('')] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const title = (num, name, date) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 500, after: 60 }, children: [tr(num, { font: 'Arial', size: 56, bold: true, color: C.red })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [tr(name, { font: 'Arial', size: 44, bold: true, color: C.dkRed })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [tr(date, { font: 'Arial', size: 26, italics: true, color: C.grey })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [tr('Guide du Maître — Warhammer Fantasy Roleplay 4e Édition', { font: 'Arial', size: 20, italics: true, color: C.lgrey })] }),
  divider()
];

const c = [];
c.push(...title('SESSION 15', 'LES PLAIES DE MAGNUSTAG', 'Nuit du 10 → Wellentag 13 Sigmarzeit'));

c.push(h1('1. VUE D’ENSEMBLE'));
c.push(body('Cette session ferme réellement Magnustag. Elle commence dans les Magnussewers, avec trois PJs épuisés qui portent les hommes qu’ils viennent d’arracher aux Skaven. Elle se poursuit par deux journées de repos relatif : blessures, maladie, dettes, rencontres personnelles et conséquences d’une ville qui n’attend personne. Enfin, Wellentag 13 rend l’initiative aux joueurs. Le Herald transforme leurs actes en récit public et deux menaces peuvent venir les chercher s’ils hésitent.'));
c.push(body('Le mouvement émotionnel doit rester net : panique dans le dernier couloir, soulagement sans triomphe au bord du Teufel, épuisement au matin, intimité pendant les Endeavours, puis retour brutal du monde extérieur. Ne jouez pas les deux jours heure par heure. Donnez à chaque PJ une scène qui compte, laissez-le choisir son Endeavour, puis faites avancer les horloges.'));
c.push(gm('Durée visée : 18 h–22 h 30. Répartition utile : fuite et retour 35–50 min ; Wahlund et Silvi 30–40 min ; scènes personnelles 90–120 min ; Endeavours et rumeurs 30 min ; reprise du 13 et une scène de réserve 45–60 min.'));
c.push(warn('Trois tests de Ratte Fever seulement : Thucydion, Ludwig et Silas. Kaspar et Pieter n’étaient pas dans les Magnussewers. Ludwig et Silas sont à 0 Wound dans l’état de campagne : une nouvelle descente immédiate est suicidaire.'));
c.push(h2('Structure de la session'));
c.push(bul('Acte I', 'Le dernier couloir : prendre une preuve ou préserver l’avance, puis sortir par le déversoir nord.'));
c.push(bul('Acte II', 'La rive du Teufel : transporter les blessés jusqu’au sud de la ville, débriefer Wahlund et décider qui voit la preuve.'));
c.push(bul('Acte III', 'Angestag et Festag : maladie, soins, Endeavours et cinq fils personnels. Gunnar entre en jeu.'));
c.push(bul('Acte IV', 'Wellentag 13 : le Herald paraît, les joueurs choisissent leurs priorités et la Semaine 2 commence.'));
c.push(h2('Questions à poser avant le premier jet'));
c.push(bul('La preuve', 'Prélevez-vous un trophée skaven avant de fuir ? Qui s’en charge et qui le porte ?'));
c.push(bul('Les blessés', 'Qui porte Wahlund, Anders et Mårten ? Qui aide Rickard quand sa jambe cède ?'));
c.push(bul('Le retour', 'Cherchez-vous d’abord la Guilde, Silvi, un médecin ou un endroit où disparaître ?'));
c.push(bul('Giordano', 'Ludwig et Silas ont-ils parlé à Silvi de son offre et des Bâtards du Reik ?'));
c.push(bul('Priorité personnelle', 'Pendant les deux jours de repos, quelle chose votre personnage refuse-t-il de laisser attendre ?'));

c.push(h1('2. RÉSUMÉ DE LA SESSION PRÉCÉDENTE'));
c.push(body('Texte à lire aux joueurs avant de reprendre la fuite :'));
c.push(read('Magnustag devait être un jour de fête. Il a laissé derrière lui une ville pleine de fumée, de corps et de portes arrachées. Pieter a retrouvé Jannik mort dans une ruelle de la Voie du Sorcier, son arbalète encore déchargée, tandis qu’Ingrid disparaissait avec les fanatiques. Kaspar a mené l’assaut contre la Cage Dorée, vaincu Bella Lowhaven seul et lui a tranché la gorge. Le gang du Baron tient désormais l’établissement, mais Otto sait que toute la salle a vu qui fut le véritable vainqueur.'));
c.push(read('Pendant ce temps, Thucydion, Ludwig et Silas ont suivi Melina dans les Magnussewers. Ils ont trouvé Wahlund et ses hommes dans une geôle skaven, brisés mais vivants. Ils ont tué un Rat Ogre et deux hommes-rats. Un chef skaven s’est échappé. Maintenant les tunnels résonnent de nouveaux cris, les survivants ne peuvent pas courir et la surface est encore loin.'));
c.push(gm('Le joueur invité peut contrôler Melina pendant cet opener. Dès le lendemain matin, il passe à Gunnar. Cela lui donne immédiatement une place à la table sans modifier la continuité.'));

c.push(h1('3. ACTE I — LE DERNIER COULOIR'));
c.push(music('Darkest Dungeon — “The Warrens”, bas et continu. Couper net lorsque le groupe atteint l’air libre.'));
c.push(read('Derrière vous, quelque chose frappe la pierre. Une fois. Deux fois. Puis vient le crissement de griffes innombrables, le souffle rauque d’une masse trop lourde pour courir et, plus près encore, le claquement sec d’ordres que vous ne comprenez pas. Devant, le conduit remonte vers une obscurité moins noire. Entre les deux : trois blessés à porter, du sang jusqu’aux chevilles, et le cadavre d’une chose dont personne, là-haut, ne voudra croire l’existence.'));
c.push(h2('3.1 Prendre une preuve'));
c.push(body('Silvi a demandé quelque chose qu’elle puisse poser sur une table. Le corps d’un Skaven est encombrant, souillé et presque impossible à dissimuler. Une tête, une patte, une arme ou une plaque d’armure gravée suffisent, mais chaque instant passé à découper permet aux poursuivants de se rapprocher.'));
c.push(bul('Prélèvement rapide', 'Force Intermédiaire (+0). Sur réussite, le PJ obtient un trophée reconnaissable en un round narratif. Sur +2 SL, le paquet peut être transporté sans laisser une piste de sang continue.'));
c.push(bul('Chirurgie improvisée', 'Silas peut utiliser Heal au lieu de Force, mais seulement s’il dispose d’un outil coupant et accepte de travailler dans la boue. Un échec contamine ses instruments ou déchire le trophée sans le libérer.'));
c.push(bul('Arme skaven', 'Ramasser une lame, un pistolet exotique ou un fragment de harnais ne demande pas de test. La preuve est plus facile à nier qu’un cadavre, mais Engel ou Giordano pourront l’identifier.'));
c.push(bul('Corps entier', 'Il faut deux porteurs supplémentaires. Tous les tests de fuite suivants subissent −10 et les témoins de surface réagissent immédiatement.'));
c.push(gm('Après chaque tentative ratée, augmentez la difficulté de la fuite d’un cran : +20, +0, −10, puis −20. À −20, montrez des yeux dans le tunnel ou la silhouette d’un nouveau Rat Ogre. Ne transformez pas ce choix en combat équilibré.'));
c.push(h2('3.2 Porter les survivants'));
c.push(bul('Wahlund', 'Conscient, fiévreux, capable de marcher quelques pas si on lui passe un bras autour des épaules. Il refuse d’être abandonné avant ses hommes.'));
c.push(bul('Anders', 'Bras brisé, côtes atteintes. Un porteur peut le soutenir ; sans aide, il tombe au premier obstacle.'));
c.push(bul('Mårten', 'Inconscient. Il doit être porté ou traîné sur une cape.'));
c.push(bul('Rickard', 'Conscient malgré le coup du Rat Ogre. Il aide jusqu’à ce qu’un échec de groupe ou un moment dramatique fasse céder sa jambe.'));
c.push(bul('Melina', 'Elle impose le rythme, prend le poids le plus lourd et refuse tout débat qui ne mène pas à la sortie.'));
c.push(q('Melina', 'On compte les jambes quand on voit le ciel. Maintenant, on avance.'));
c.push(h2('3.3 La fuite'));
c.push(body('Demandez un test collectif d’Athlétisme Intermédiaire (+0). Les porteurs peuvent utiliser Endurance. Chaque réussite contribue ses SL au groupe ; chaque échec crée un coût. Si le total est positif, ils atteignent le déversoir avec leur matériel. À 0 ou −1 SL, ils sortent mais paient un prix. À −2 SL ou moins, déclenchez un dernier obstacle physique, pas une bataille rangée.'));
c.push(h3('Coûts possibles sur un échec'));
c.push(bul('Quelque chose tombe', 'Une lanterne, un sac, une arme ou le trophée glisse dans l’eau. Un PJ doit choisir de le laisser ou de perdre encore du terrain.'));
c.push(bul('Le conduit cède', 'Athlétisme ou Force Difficile (−10) pour dégager un passage assez large pour Mårten. Une réussite bruyante attire les poursuivants mais ouvre la route.'));
c.push(bul('Rickard s’effondre', 'Un autre personnage doit prendre sa charge. Celui qui refuse gagne du temps, mais Wahlund s’en souviendra.'));
c.push(bul('Les griffes apparaissent', 'Une attaque unique frappe le dernier de la file, puis Melina abat la créature ou ferme une grille. Le but est de matérialiser la poursuite, non de lancer un nouveau combat complet.'));
c.push(warn('Si les joueurs se retournent pour combattre, l’opposition est croissante et sans fin. Dites clairement ce que leurs personnages comprennent : ils peuvent gagner dix secondes, pas nettoyer les Magnussewers.'));
c.push(absent('Sans décision claire ou si le groupe abandonne les prisonniers, les Skaven reprennent les blessés et déplacent la geôle avant le 13. Wahlund survit, mais son sauvetage futur coûte une journée entière sur l’horloge de la Semaine 2.'));

c.push(h1('4. ACTE II — LA RIVE DU TEUFEL'));
c.push(read('La grille cède dans un cri de métal et l’air de la nuit vous frappe au visage. Le Teufel est noir devant vous. Sur l’autre rive, Ubersreik achève de fêter Magnustag : fumée de bois, bière renversée, lanternes qui s’éteignent une à une. Une dernière fusée éclate derrière les toits, rouge et trop tardive. Personne ne vous acclame. Personne ne sait ce que vous venez de porter hors de la terre.'));
c.push(h2('4.1 Une géographie qui coûte du temps'));
c.push(body('Le groupe sort dans la partie nord des Magnussewers, près du déversoir du Teufel. La Guilde des Attrapeurs de Rats se trouve au sud du fleuve, sur Grossweg dans le Quartier des Marchands, et son entrée sécurisée donne sur les Sigmarsewers. Il n’existe pas de raccourci souterrain connu entre les deux réseaux. Il faut donc longer la rive, trouver une barque ou traverser le Pont d’Ubersreik avec les blessés.'));
c.push(bul('Le pont', 'Le trajet le plus sûr médicalement, mais le plus exposé. Un groupe couvert de sang et portant un trophée skaven attire le Guet, les noctambules et les questions.'));
c.push(bul('Une barque', 'Un test de Gossip ou Bribery Intermédiaire (+0) trouve un passeur. Avec un trophée visible, le prix double ou le passeur exige d’être aveuglé.'));
c.push(bul('Le Marteau Tordu', 'Silvi peut offrir une cache et faire transporter les blessés par les Doigts Croisés. Cela lui donne immédiatement accès à la preuve et au récit.'));
c.push(bul('La Guilde', 'Melina insiste pour y ramener d’abord les siens. Le sanctuaire de Stromfels se trouve dans la cave, près de la porte des Sigmarsewers.'));
c.push(gm('La carte mise à jour, “magnussewers_pointcrawl.svg”, montre les deux réseaux et la traversée de surface. Utilisez-la comme schéma du MJ, pas comme plan exact remis aux joueurs.'));
c.push(h2('4.2 Wahlund : dette, Rasknitt et silence'));
c.push(music('The Witcher 3 — “The Vagabond”, presque inaudible. La tension est retombée ; gardez la fatigue.'));
c.push(q('Wahlund', 'Vous avez descendu vos morts chercher les miens. Ce compte-là ne s’efface pas.'));
c.push(body('Wahlund ne prononce pas un exposé au bord du fleuve. Il donne d’abord des ordres de soins, vérifie Anders et Mårten, puis demande ce que les PJs ont vu avant la geôle. Lorsqu’il entend parler de l’ingénieur et de la discipline des créatures, il donne enfin le nom qu’il poursuit depuis des années.'));
c.push(bul('Grey Seer Rasknitt', 'Un Prophète Gris, architecte du massacre qui a détruit la cellule nordique de Wahlund. Wahlund a suivi ses traces jusqu’à Ubersreik. Rasknitt est sa cible principale, pas un allié des PJs.'));
c.push(bul('Ce qu’il sait', 'Les Skaven existent ; leurs clans coopèrent rarement sans un chef puissant ; ils utilisent des signes de piste, des esclaves, des monstres et des machines impossibles. Rasknitt fait travailler des factions qui devraient normalement s’entre-dévorer.'));
c.push(bul('Ce qu’il ignore', 'L’alliance avec Kürbis et Honighäschen, le vol de poudre noire, le rôle de Rudi, le warpstone, la fonction précise du dispositif et la cible des Casernes.'));
c.push(bul('Ce qu’il conclut', 'Si les clans tolèrent leur présence mutuelle, ils préparent quelque chose de plus important qu’un repaire. L’attaque de la geôle les forcera à déplacer ou renforcer leurs positions.'));
c.push(q('Wahlund', 'Rasknitt n’est pas venu seul. Là où il passe, les clans se supportent assez longtemps pour accomplir quelque chose de grand. Puis ils s’entre-dévorent. Il faut frapper avant cette seconde étape.'));
c.push(h3('Stromfels'));
c.push(body('Wahlund ne confesse rien devant tout le monde. Les sauveteurs qui ont vu le symbole de la vague et de l’aileron, ses tatouages ou la chapelle comprennent qu’il cache une foi proscrite. S’il est confronté en privé, il ne ment pas.'));
c.push(q('Wahlund', 'Je sers le Seigneur des Profondeurs. C’est mon péché, pas celui de mes hommes. J’ai utilisé sa faim contre des choses pires que moi. Si vous devez me vendre au Temple, attendez qu’Anders et Mårten puissent marcher.'));
c.push(gm('Il ne demande ni conversion ni absolution. Sa dette envers les PJs est réelle, mais son obsession pour Rasknitt peut l’amener à prendre des risques qu’un allié raisonnable refuserait.'));
c.push(h2('4.3 Silvi, la preuve et Giordano'));
c.push(body('Si les PJs apportent une preuve à Silvi, sa réaction est brève. Elle ne se pâme pas devant l’horreur : elle fait fermer la porte, appelle deux personnes de confiance et demande où l’objet a été trouvé. La preuve débloque ses caches, ses guetteurs, du matériel et la capacité de convaincre d’autres alliés.'));
c.push(q('Silvi', 'Je vous croyais. Maintenant je peux faire croire les autres. Ce n’est pas la même chose.'));
c.push(bul('Preuve corporelle', 'Silvi la fait conserver dans de la chaux et dissimuler. Elle ne la montre pas encore au Conseil : une panique publique aiderait les Skaven à disparaître.'));
c.push(bul('Arme ou harnais', 'Elle convoque Giordano pour authentification. Engel peut aussi confirmer la corruption magique plus tard.'));
c.push(bul('Aucune preuve', 'Elle finance les soins et garde les sorties sous surveillance, mais ne mobilise pas tout son réseau. Elle demande une seconde occasion de lui rapporter quelque chose.'));
c.push(body('Si Ludwig ou Silas mentionne l’offre de Giordano, Silvi le reçoit derrière une porte fermée. Les PJs ne participent pas au marchandage. Giordano ressort mécontent mais pas insulté ; Silvi paraît amusée. Les Doigts Croisés paient moins de 20 GC, probablement en combinant argent, part de butin et dette future. Le montant exact reste secret.'));
c.push(q('Giordano', 'Madonna Kreutzhame négocie comme si Ranald lui devait personnellement de l’argent. Nous avons néanmoins un accord.'));
c.push(bul('Accord obtenu', 'Les Bâtards du Reik peuvent rejoindre une expédition préparée. Giordano partage ses règles tactiques : ne jamais poursuivre un Skaven qui fuit seul, compter les issues, protéger les lanternes et brûler ce qu’on ne peut emporter.'));
c.push(bul('Condition', 'Les PJs doivent donner un objectif précis. “Tuer des Skaven” n’est pas un plan ; atteindre l’atelier, rapporter du warpstone ou reconnaître la sape en sont.'));

c.push(pageBreak());
c.push(h1('5. ACTE III — ANGESTAG 11, LES COMPTES DU MATIN'));
c.push(time('08 h 00 — Blessures, maladie et réveil'));
c.push(body('Laissez chaque joueur décrire où son personnage a dormi et qui a veillé sur lui. Puis résolvez les conséquences physiques avant toute nouvelle mission. Le lendemain de Magnustag ne ressemble pas à un repos : cloches funèbres, marteaux sur les portes brisées, odeur de cendre et rumeurs qui circulent plus vite que les charrettes.'));
c.push(bul('Ratte Fever', 'Thucydion, Ludwig et Silas effectuent le test d’Endurance du profil officiel. Notez les échecs secrètement et datez le début possible des symptômes.'));
c.push(bul('Festering Wound de Silas', 'Elle exige un vrai médecin. Un simple test de Heal stabilise, mais ne remplace pas la consultation à la Guilde des Médecins.'));
c.push(bul('Gut Wound', 'Appliquez les restrictions normalement. Les chiffres de l’application sont un point de départ, pas une guérison automatique.'));
c.push(bul('Endeavours', 'Chaque PJ en choisit un. Cadrez une seule scène ou un seul jet déterminant ; le reste est raconté en montage.'));
c.push(time('10 h 00 — Gunnar honore son rendez-vous'));
c.push(read('Trois coups lourds font vibrer la porte. Gunnar attend sur le seuil, son paquetage déjà sanglé, l’air de quelqu’un venu tuer un monstre et découvrant qu’il arrive après la bataille. Son regard passe des bandages aux lits, puis revient aux survivants. « Alors. Vous avez commencé sans moi. »'));
c.push(q('Gunnar', 'Je ne demande pas si vous y retournerez. Je demande ce qu’il faut préparer pour que, la prochaine fois, nous revenions tous.'));
c.push(body('À partir de cette scène, Gunnar est confié au joueur invité. Donnez-lui les informations de l’annexe et laissez-le choisir où porter sa force. Il peut accompagner un PJ blessé, parler à Wahlund, négocier avec Silvi, chercher Felix ou organiser le matériel de l’expédition. Il n’est pas obligé de suivre le groupe comme un garde du corps.'));
c.push(h2('5.1 L’expédition différée'));
c.push(bul('État des PJs', 'Ludwig et Silas ne sont pas en état de redescendre. Gunnar le dit sans détour et Melina refuse de perdre les sauveteurs de Wahlund le lendemain du sauvetage.'));
c.push(bul('Équipe possible', 'Gunnar, Melina et les Bâtards du Reik, renforcés par les PJs disponibles. Wahlund fournit itinéraires et signes ; Silvi finance matériel et caches.'));
c.push(bul('Préparation', 'Objectif unique, itinéraire d’entrée, sortie secondaire, signal de retraite, deux lanternes protégées, cordes, chaux, planches et moyen de transporter une preuve.'));
c.push(bul('Effet du délai', 'Le Clawleader échappé a donné l’alerte. Chaque jour sans reconnaissance ajoute une barricade, une fausse piste ou une patrouille, mais peut aussi laisser une trace du déplacement skaven.'));
c.push(absent('Si les PJs ne décident rien avant le 13, Gunnar et Melina font une reconnaissance limitée. Ils confirment que les Skaven déplacent du matériel vers l’est des Magnussewers, sans atteindre l’atelier ni comprendre la destination.'));

c.push(h1('6. LES CINQ FILS PERSONNELS'));
c.push(body('Ces scènes sont proposées, pas imposées. Demandez d’abord ce que chaque joueur veut accomplir. Placez ensuite la scène personnelle sur le chemin de son objectif ou utilisez-la comme le prix d’une aide. Un PJ peut accompagner un autre ; Gunnar est particulièrement utile pour donner du relief à une scène qui manquerait de participants.'));

c.push(h2('6.1 Silas — Doktor Theodosia Grat'));
c.push(music('Darkest Dungeon — “The Hamlet”, très bas. Aucun thème sinistre : Grat doit sembler être une chance.'));
c.push(read('La Guilde des Médecins ne sent ni l’encens ni la charogne : seulement le savon, l’alcool clair et le papier neuf. Les murs du rez-de-chaussée sont de pierre, les portes épaisses, les instruments rangés avec une précision presque agressive. Doktor Grat regarde la plaie de Silas longtemps, puis relève les yeux avec le sourire d’une collègue qui vient enfin de trouver quelque chose d’intéressant.'));
c.push(q('Grat', 'Vous avez fait du bon travail dans de mauvaises conditions. Maintenant, laissez quelqu’un de mieux équipé vous sauver de votre propre courage.'));
c.push(body('Grat est brillante, chaleureuse et réellement compétente. Elle ne joue pas la folle ni la séductrice inquiétante. Elle parle à Silas comme à un confrère malgré son statut de barber-surgeon, lui demande pourquoi il a choisi ce métier et s’intéresse sincèrement aux décisions prises dans les égouts.'));
c.push(bul('Le traitement', 'Elle nettoie et traite correctement la Festering Wound. Accordez le bénéfice mécanique approprié d’un traitement professionnel et retirez toute pénalité narrative liée à des soins improvisés.'));
c.push(bul('Le secret professionnel', 'Elle sait que Silas pratique parfois des actes réservés aux médecins licenciés. Au lieu de le dénoncer pour la prime de la Guilde, elle admire son audace. Cette indulgence crée une dette implicite.'));
c.push(bul('Le livre', 'Elle lui prête un manuel annoté sur les fièvres traumatiques. Ses propres notes sont précises, intelligentes et parfois étrangement enthousiastes devant les cas atypiques.'));
c.push(bul('Le placard', 'Perception Difficile (−10) : odeur douceâtre derrière une porte, serrure trop robuste pour du linge, ou petite mouche en plein cabinet impeccable. Le test ne révèle pas un sanctuaire de Nurgle.'));
c.push(q('Grat', 'Revenez demain. Je veux vérifier la chaleur de la plaie et vous donner quelque chose contre la douleur. Vous pourrez me dire ce que vous pensez du chapitre six.'));
c.push(h3('Festag 12 — le rendez-vous de suivi'));
c.push(body('Grat propose une injection comme antalgique et fortifiant. Il s’agit de Bronze Fever. Ne retirez pas le choix à Silas : elle explique le geste, montre une fiole propre et accepte un refus sans changer de visage. Si Silas accepte, notez secrètement l’exposition et laissez les symptômes futurs contredire le livre prêté.'));
c.push(gm('L’horreur fonctionne parce que le premier traitement est excellent. Grat doit devenir une mentore possible, peut-être une attirance, avant de devenir une menace.'));

c.push(h2('6.2 Thucydion — Christoph Engel'));
c.push(music('The Witcher 3 — “The Tower of Mice”, sans montée dramatique.'));
c.push(body('Cordelia fait passer Thucydion par le tunnel reliant sa boutique à la tour. Elle est encore secouée par l’assaut des zélotes et ne répond pas aux questions sur les corps ensevelis. Engel reçoit l’elfe dans une pièce grise, trop haute, où les ombres semblent éviter les murs.'));
c.push(q('Engel', 'Les fanatiques ? De la vermine verticale. Vous, en revanche, avez vu quelque chose sous ma ville. Recommencez depuis le début. Sans embellir.'));
c.push(bul('Ce qui l’ennuie', 'Rudi, les querelles de gangs et même K&H lui paraissent être des affaires humaines ordinaires.'));
c.push(bul('Ce qui l’éveille', 'La machine, l’ingénieur, les lueurs vertes, une poudre ou pierre qui altère la magie, et la carte marquée. À ce moment, il cesse de feindre l’indifférence.'));
c.push(bul('Ce qu’il peut conclure', 'Technologie magique corrompue, probablement alimentée par une matière instable. Sans échantillon ni description plus précise, il ne peut nommer le warpstone avec certitude ni deviner la cible.'));
c.push(bul('Ce qu’il offre', 'Une boîte doublée de plomb et de cire pour transporter un fragment, des signes à relever autour de la machine et la promesse d’analyser une preuve. Pas de soldats.'));
c.push(bul('Son prix', 'Être averti avant le Conseil et les Temples. Il ne veut ni panique ni prêtres fouillant sa tour sous prétexte de sauver la ville.'));
c.push(q('Engel', 'Si vous voyez une pierre qui éclaire sans flamme, ne la touchez pas. Si vous l’avez déjà touchée, ne mentez surtout pas au médecin qui vous enterrera.'));
c.push(gm('Engel devient le troisième pilier d’aide : Silvi fournit réseaux et argent ; Wahlund connaît les tunnels et Rasknitt ; Engel comprend la magie. Aucun des trois ne résout le problème seul.'));

c.push(h2('6.3 Ludwig — Elsa et la troisième loyauté'));
c.push(body('Elsa convoque Ludwig sans urgence visible. Elle a reçu de bons rapports sur les pamphlets distribués au Strohmann Markt et sait qu’il s’est rapproché d’Anton Grimski. Sa satisfaction ne ressemble pas à une récompense : c’est la décision d’investir davantage dans un outil qui fonctionne.'));
c.push(q('Elsa', 'Tu as distribué leurs mots. Maintenant je veux savoir qui les écrit, qui les paie et ce qu’ils cherchent vraiment.'));
c.push(bul('Ce qu’elle demande', 'Noms présents, attitudes, lieux de rencontre, intérêt d’Isolde pour Ryan et rôle possible de Grimski. Elle veut des impressions autant que des faits.'));
c.push(bul('Ce qu’elle sait déjà', 'Les pamphlets servent les Jungfreud. Elle ne sait pas qui dirige réellement le réseau ni ce que Falck prépare.'));
c.push(bul('L’omission', 'Un test opposé de Cool ou Charm contre Intuition peut masquer un détail. Sur échec, Elsa repère la retenue mais ne punit pas Ludwig : elle lui donne davantage de corde.'));
c.push(bul('Ordre maintenu', 'Retourner au Cercle de Poésie le Marktag 15 sous l’identité de Ryan von Mounir, gagner la confiance d’Isolde et rapporter tout nouveau travail.'));
c.push(q('Elsa', 'Les gens comme Isolde ne confient pas un secret. Ils confient un problème et regardent quelle partie de toi il écrase. Laisse-la choisir le problème.'));
c.push(gm('Isolde demandera le 15 qui a volé la poudre noire. Ludwig connaît déjà la réponse générale : K&H. Ne donnez pas cette mission pendant le downtime ; préparez seulement le dilemme.'));

c.push(h2('6.4 Pieter — Jannik, Ingrid et le récit du Temple'));
c.push(music('Silence pendant le corps ou les funérailles. N’ajoutez la musique qu’après la disparition d’Ingrid.'));
c.push(body('La mort de Jannik ne reste pas privée. Il était devenu le héros qui avait sauvé Heske, et Ottokar comme le Temple comprennent la puissance de cette histoire. Ricker transforme progressivement le meurtre en preuve de la cruauté du Sorcier Gris, sans dire qu’Hannah a tiré.'));
c.push(read('On a lavé le sang du visage de Jannik, mais pas celui de sa chemise. Quelqu’un a posé son arbalète près de lui, corde détendue, comme si l’arme avait simplement oublié de le défendre. Autour du corps, les gens racontent déjà des versions différentes de sa mort. Dans chacune, Jannik devient plus courageux et la vérité plus petite.'));
c.push(bul('Témoigner', 'Pieter peut insister sur les faits : tir à bout portant, arbalète non chargée, aucune preuve directe contre Engel. Ricker ne le contredit pas frontalement ; il transforme le doute en insinuation.'));
c.push(bul('Première apparition', 'Ingrid se tient au bord du rassemblement, amaigrie et vêtue plus sobrement. Elle croise le regard de Pieter, recule derrière deux pénitents et disparaît.'));
c.push(bul('Poursuite', 'Athlétisme ou Perception permet de ne pas la perdre immédiatement, mais elle utilise la foule et une sortie préparée. Une réussite donne un signe : elle se cache à proximité de la Pious Cup.'));
c.push(bul('Seconde apparition maximum', 'Une main sur une porte, un profil derrière une vitre, puis plus rien. Ingrid refuse encore la confrontation.'));
c.push(q('Ricker', 'Je ne vous demande pas d’accuser qui que ce soit. Je vous demande seulement qui, dans cette rue, avait le pouvoir de faire taire un homme pour toujours.'));
c.push(gm('Ingrid est radicalisée par la culpabilité et la peur, pas lavée du cerveau. Elle sait ce qu’Hannah a fait à Jannik. Admettre la vérité signifierait reconnaître qu’elle a choisi de rester avec sa meurtrière.'));

c.push(h2('6.5 Kaspar — le prix de la victoire'));
c.push(body('Kaspar est devenu un nom dans le Dunkelfeucht : le troll, la Cage, Bella. Otto exploite cette renommée devant les hommes et la craint en privé. La scène doit lui offrir de la gloire tout en montrant que cette gloire appartient à un système qui le dévorera s’il cesse d’être utile.'));
c.push(h3('Otto en public'));
c.push(q('Otto', 'Regardez-le bien. Quinze hommes pour prendre la Cage, et lui, il a choisi la plus dangereuse de la salle. Voilà ce qu’on appelle finir le travail.'));
c.push(body('Otto offre à boire, laisse les hommes raconter le duel et ne corrige pas les exagérations. Il observe surtout qui regarde Kaspar avec admiration.'));
c.push(h3('Otto en privé'));
c.push(q('Otto', 'C’était mon opération. Mes hommes. Mon signal. Ta victoire nous sert tant que tu te souviens à qui appartient la Cage.'));
c.push(bul('Rolf', 'Kaspar se souvient que Rolf paraissait surpris par l’assaut et qu’il a tenté de protéger Bella. Des rumeurs de taupe circulent, mais personne ne prononce encore son nom devant Silas.'));
c.push(bul('Johanna', 'Elle a entendu parler de la Cage. Elle ne demande pas si Kaspar a gagné, mais ce qu’il est devenu. Pieter l’a aidée lorsque Kaspar était absent ; cette gratitude complique encore leur relation.'));
c.push(bul('La prime', 'Ne la faites pas surgir pendant le downtime. Elle entre en jeu le 13 ou plus tard, quand Mercy a obtenu assez de témoignages pour acheter un nom.'));
c.push(q('Johanna', 'Quand on parle de toi maintenant, les gens baissent la voix. Tu voulais vraiment devenir ce genre d’homme, ou tu as simplement oublié de t’arrêter ?'));

c.push(h1('7. FESTAG 12 — LA VILLE CHOISIT SES VÉRITÉS'));
c.push(time('Matin — Les Endeavours se concluent'));
c.push(body('Résolvez soins, acquisitions, recherches et contacts. Le temps doit avoir un prix : un PJ qui poursuit Ingrid ne négocie pas simultanément l’équipement de l’expédition. Gunnar peut couvrir un besoin ou accompagner une personne, pas régler cinq problèmes.'));
c.push(h2('7.1 Résolutions rapides d’Endeavour'));
c.push(bul('Income ou travail', 'Une scène courte montre le coût social : employeur inquiet des rumeurs, clientèle attirée par la célébrité ou confrère qui exige une faveur.'));
c.push(bul('Research', 'Donnez une information utile et une question nouvelle. Une recherche sur les égouts confirme la séparation des réseaux ; une recherche sur la poudre rapproche les joueurs du convoi volé.'));
c.push(bul('Training', 'Le formateur exige une preuve d’engagement ou promet une vraie leçon après la crise. Thucydion peut retourner au Tin Spur, mais son humiliation par Klaus est encore fraîche.'));
c.push(bul('Banking ou acquisition', 'Les prix montent à l’approche de Sigmartag. Les achats inhabituels de poudre, plomb, lampes ou cordes peuvent être remarqués par le Guet ou Werner.'));
c.push(bul('Contacts', 'Le PJ obtient une rumeur fiable parmi deux fausses, ou un rendez-vous qui occupera une partie du 13.'));
c.push(time('Après-midi — Les rumeurs se figent'));
c.push(h2('7.2 Rumeurs de rue — 1d6'));
c.push(bul('1', 'Le Guet a laissé tomber la Cage Dorée parce qu’il avait reçu l’ordre de ne pas intervenir.'));
c.push(bul('2', 'Jannik Fanger a été abattu par un sorcier ; le Temple sait lequel mais craint de prononcer son nom.'));
c.push(bul('3', 'Des gobelins vivent maintenant sous les maisons de la Morgenseite.'));
c.push(bul('4', 'Le grand combattant de la Cage travaillait pour les Karstadt.'));
c.push(bul('5', 'Certains feux de Magnustag ont brûlé vert. Ceux qui les ont regardés trop longtemps rêvent de rats.'));
c.push(bul('6', 'Pfeffer prépare des arrestations massives pour sauver sa réputation avant Sigmartag.'));
c.push(h2('7.3 Rumeurs de l’ombre — 1d6'));
c.push(bul('1', 'Mercy Lowhaven paiera pour le nom de celui qui a tranché la gorge de Bella.'));
c.push(bul('2', 'Il y a une taupe chez le Baron ; Otto promet une mort lente lorsque Werner l’aura trouvée.'));
c.push(bul('3', 'Werner achète quais, barques et silence pendant que tout le monde regarde la Cage.'));
c.push(bul('4', 'Felix Scite combattra bientôt dans un entrepôt sans fenêtres.'));
c.push(bul('5', 'Des Tiléens ont accepté de descendre tuer des hommes-rats pour un prix que personne ne connaît.'));
c.push(bul('6', 'Les égouts du nord ont changé de voix depuis Magnustag ; les vieux conduits résonnent comme des marteaux.'));
c.push(h2('7.4 Rumeurs des temples et salons — 1d6'));
c.push(bul('1', 'Von Dabernick écrit à Altdorf qu’Ubersreik est devenue ingouvernable.'));
c.push(bul('2', 'Les pamphlets étaient trop bien distribués pour être spontanés.'));
c.push(bul('3', 'Christoph Engel enterre vivants ceux qui prient trop fort devant sa tour.'));
c.push(bul('4', 'Le culte d’Ulric veut faire disparaître un champion avant Sigmartag.'));
c.push(bul('5', 'Le Herald publiera des noms que le Guet aurait préféré oublier.'));
c.push(bul('6', 'Les Karstadt cherchent de nouveaux héros populaires à placer sous leur protection.'));

c.push(pageBreak());
c.push(h1('8. ACTE IV — WELLENTAG 13, LE MONDE REVIENT FRAPPER'));
c.push(music('Silence pendant la lecture du Herald, puis The Witcher 3 — “The Vagabond” pour la reprise en ville.'));
c.push(read('Au matin, les feuilles humides du nouvel Ubersreik Herald collent aux pavés. On les lit aux fenêtres, aux comptoirs, sous les porches. Votre victoire, vos échecs et vos morts ont déjà quitté vos mains : ils appartiennent désormais à la ville. Quelqu’un a encerclé le nom de Jannik à l’encre noire. Quelqu’un d’autre a craché sur l’article consacré à la Cage.'));
c.push(body('Remettez le Herald #2 avant tout résumé oral. Laissez les joueurs lire, commenter et contester. Puis demandez à chacun : « Quel problème allez-vous empêcher de s’aggraver aujourd’hui ? » N’annoncez pas le calendrier entier jusqu’au 18. La Semaine 2 doit sembler ouverte, même si toutes ses forces avancent vers les Casernes.'));
c.push(h2('8.1 Réponses probables aux initiatives des joueurs'));
c.push(bul('Ils vont au Guet', 'Utilisez la scène Wendt ci-dessous. Pfeffer écoute différemment s’ils apportent une preuve, le nom de Rasknitt ou un témoignage cohérent sur Rudi.'));
c.push(bul('Ils cherchent Ingrid', 'Une piste mène à la Pious Cup, mais le groupe de Hannah se disperse avant leur arrivée. Ils gagnent un témoin, un objet oublié ou l’assurance qu’Ingrid était là.'));
c.push(bul('Ils cherchent Felix', 'Les rumeurs pointent vers le Hog Pit, fortifié depuis la mort de Bella. Gunnar a une raison immédiate de participer.'));
c.push(bul('Ils préparent les égouts', 'Silvi révèle l’accord avec Giordano sans donner le prix. Wahlund propose deux routes et Engel demande un échantillon. Faites choisir un objectif avant l’équipement.'));
c.push(bul('Ils reviennent au gang', 'La prime Lowhaven et les soupçons de taupe arrivent ensemble. Utilisez la seconde scène de réserve.'));
c.push(bul('Ils ne savent pas', 'Faites livrer un message discret de Wendt ou laissez un indicateur Lowhaven questionner quelqu’un à la Lune Rouge. Un seul incendie à la fois.'));
c.push(gm('Les deux scènes suivantes sont réutilisables plus tard dans la semaine. Si les joueurs choisissent autre chose le 13, gardez-les intactes et déclenchez-les quand le fil correspondant est touché.'));

c.push(h1('9. SCÈNE DE RÉSERVE A — LE DOSSIER WENDT'));
c.push(body('Déclencheur : les PJs vont au Guet, cherchent Rudi, parlent publiquement des Skaven ou montrent une preuve crédible. Wendt les approche sans uniforme complet, dans une cour latérale ou à la sortie des Casernes. Il ne veut pas que Rudi sache que la surveillance est officielle.'));
c.push(read('Wendt referme la porte derrière vous et pose un dossier mince sur une caisse. Trois feuilles seulement, chacune couverte d’une écriture serrée. Sur la première, le nom de Rudi. Sur la seconde, une heure et un quai. Sur la troisième, le dessin maladroit d’un homme portant un sac trop lourd pour lui.'));
c.push(q('Wendt', 'La capitaine ne vous croit pas encore. Moi, je crois que Rudi ment. Ce n’est pas pareil, mais c’est un début.'));
c.push(bul('Ce qu’il a vu', 'Rudi a rencontré un homme nerveux près des docks. L’homme correspond à Günther Burkharrt, même si Wendt ne connaît pas encore son nom. Il transportait un sac ou venait d’en remettre un.'));
c.push(bul('Ce qu’il sait', 'Rudi consulte les affectations de Pfeffer et les itinéraires cérémoniels plus souvent que son poste ne l’exige. Il a menti sur ses déplacements de Magnustag.'));
c.push(bul('Ce qu’il ignore', 'Günther est un intermédiaire inconscient ; Werner fournit le grain ; K&H et les Skaven coopèrent ; les Casernes sont la cible.'));
c.push(bul('Ce qu’il demande', 'Identifier le contact sans l’effrayer et apporter une preuve matérielle. Il peut obtenir une audience privée avec Pfeffer si les PJs lui donnent quelque chose de solide.'));
c.push(q('Wendt', 'Si vous aviez raison depuis le début, chaque jour où nous avons ri de vous a coûté quelque chose. Aidez-moi à savoir quoi, avant que la capitaine doive l’apprendre devant toute la ville.'));
c.push(h2('Issues'));
c.push(bul('Ils nomment Günther', 'Wendt veut l’arrêter. Les PJs peuvent le convaincre de surveiller plutôt que de briser la piste. Un test de Leadership ou Charm Intermédiaire (+0) suffit avec un argument crédible.'));
c.push(bul('Ils montrent la preuve skaven', 'Wendt pâlit, puis organise une audience avec Pfeffer le jour même. La capitaine ne s’excuse pas, mais elle écoute.'));
c.push(bul('Ils accusent sans preuve', 'Wendt garde le dossier et refuse une arrestation. Il donne toutefois l’heure de la prochaine surveillance de Rudi.'));
c.push(absent('Sans intervention avant le 15, Wendt identifie Günther seul et tente de le suivre. Günther le repère ou est averti ; la piste se refroidit et Rudi devient plus instable.'));

c.push(h1('10. SCÈNE DE RÉSERVE B — LE PRIX DE BELLA'));
c.push(body('Déclencheur : Kaspar retourne dans le Dunkelfeucht, les PJs cherchent Felix, parlent aux Lowhaven ou restent trop longtemps à la Lune Rouge. Mercy ne connaît pas encore avec certitude le nom du meurtrier. Elle paie d’abord pour l’information, pas pour une exécution. Deux indicateurs questionnent les témoins de la Cage.'));
c.push(read('L’homme au comptoir ne boit pas. Il fait tourner une pièce entre ses doigts et pose toujours la même question avec des mots différents : qui était assez près de Bella pour voir sa gorge s’ouvrir ? Quand son regard rencontre le vôtre, la pièce cesse de tourner.'));
c.push(bul('Les indicateurs', 'Un humain des docks et une Halfling vêtue de deuil. Ils ne provoquent pas de combat. Ils achètent des noms, des descriptions et des contradictions.'));
c.push(bul('Le prix actuel', '1 GC pour un témoignage crédible, 5 GC pour un nom confirmé. La récompense pour la tête de Kaspar viendra seulement lorsque Mercy sera certaine.'));
c.push(bul('La complication Rolf', 'Rolf cherche discrètement à détourner les questions de Kaspar, mais son empressement peut renforcer les soupçons de taupe. Kaspar peut le voir intervenir ; Silas ne surprend que les conséquences, sauf s’il surveille son frère.'));
c.push(bul('Le choix de Kaspar', 'Intimider les enquêteurs les convainc qu’il a quelque chose à cacher. Les acheter gagne du temps. Leur fournir un faux nom crée une victime future et une dette morale.'));
c.push(q('L’indicatrice Lowhaven', 'Mercy ne demande pas vengeance. Pas encore. Elle demande la vérité. Les gens intelligents savent que la vérité coûte moins cher avant les funérailles.'));
c.push(h2('Issues'));
c.push(bul('Kaspar se révèle', 'La prime de sang devient active dès le lendemain. Otto veut exploiter la guerre ; Johanna comprend que le danger touche désormais tous ceux qui approchent Kaspar.'));
c.push(bul('Le groupe protège le secret', 'La Lowhaven repart avec une description incomplète. La scène reviendra plus tard avec un témoin de la Cage.'));
c.push(bul('Rolf est exposé', 'Ne confirmez pas immédiatement sa trahison. Otto ordonne une enquête interne et Silas reçoit enfin une raison concrète de questionner son frère.'));
c.push(absent('Sans action des PJs, un survivant de la Cage vend le nom de Kaspar avant Marktag 15. La prime devient publique dans l’ombre et les Lowhaven relient ses proches à des cibles possibles.'));

c.push(h1('11. FIN DE SESSION ET PRÉPARATION'));
c.push(body('La meilleure fin dépend du choix des joueurs. Terminez sur une porte qui s’ouvre vers la Semaine 2 : Pfeffer posant enfin les yeux sur une preuve, Gunnar déroulant la carte des deux réseaux, Ingrid disparaissant derrière la Pious Cup, ou l’indicatrice Lowhaven rangeant la pièce après avoir entendu le nom de Kaspar. Ne résumez pas toutes les menaces. Donnez une conséquence, puis laissez le silence.'));
c.push(h2('11.1 Horloges à avancer après la partie'));
c.push(bul('Skaven', 'Le Clawleader prévient l’atelier. Les défenses se déplacent et la sape des Casernes continue.'));
c.push(bul('K&H', 'Les charges et la poudre sont préparées sans que Wahlund connaisse leur rôle. Kürbis et Honighäschen restent invisibles.'));
c.push(bul('Guet', 'Le dossier Wendt gagne une pièce par jour. Une preuve des PJs change l’attitude de Pfeffer, pas son orgueil.'));
c.push(bul('Lowhaven', 'La recherche du meurtrier de Bella se resserre. Le Hog Pit devient vital et Felix reste captif.'));
c.push(bul('Zélotes', 'Ricker gagne un public ; Ingrid reste avec Hannah par culpabilité ; aucune nouvelle attaque ouverte n’est lancée.'));
c.push(bul('Résistance', 'Isolde prépare la mission du 15 concernant la poudre noire. Elsa attend que Ludwig rapporte ce qui lui sera demandé.'));
c.push(h2('11.2 Checklist matérielle'));
c.push(bul('À imprimer', 'Herald #2, tableau des menaces de la Semaine 2 et, pour le MJ seulement, la carte complète des égouts.'));
c.push(bul('À noter', 'Résultats secrets de Ratte Fever, état exact des blessures, choix d’Endeavour, exposition éventuelle de Silas à Bronze Fever.'));
c.push(bul('À décider en jeu', 'Nature de la preuve, objectif de la prochaine expédition, réaction de Pfeffer et moment où le nom de Kaspar atteint Mercy.'));
c.push(bul('Musique', 'The Warrens ; The Vagabond ; The Hamlet ; The Tower of Mice ; prévoir du silence pour Jannik et l’après-fuite.'));

c.push(pageBreak());
c.push(h1('ANNEXE — GUNNAR POUR LE JOUEUR INVITÉ'));
c.push(body('Gunnar Brederman est un Slayer nain de rang 3. Il a vaincu l’ours du Tin Spur sans trouver sa mort et porte encore les traces du combat. Il respecte Thucydion malgré son elfité, est l’ami improbable de l’Ogre Ekkehard et a promis de rejoindre gratuitement l’expédition des PJs. Il arrive trop tard pour le premier sauvetage, mais considère sa promesse toujours valable.'));
c.push(h2('Ce que Gunnar sait'));
c.push(bul('Les PJs', 'Ils ont combattu les Bâtards du Reik et survécu. Thucydion a du courage mais doit travailler sa garde gauche.'));
c.push(bul('La mission', 'Des créatures organisées tiennent les Magnussewers. Wahlund et ses hommes viennent d’en être sauvés. Une prochaine descente doit être préparée.'));
c.push(bul('Les alliés', 'Melina est compétente ; Silvi paie ; les Bâtards peuvent être engagés ; Wahlund connaît les tunnels.'));
c.push(bul('Ses limites', 'Il ne connaît ni Rasknitt, ni le plan de K&H, ni le warpstone, ni le secret d’Eisfange.'));
c.push(h2('Comment le jouer'));
c.push(bul('Voix', 'Phrases courtes, humour sec, aucune plainte sur ses blessures. Il pose des questions concrètes quand les autres parlent en cercles.'));
c.push(bul('Priorités', 'Tenir une promesse ; protéger ceux qui ne peuvent fuir ; obtenir des faits ; préparer une vraie descente ; trouver un adversaire digne.'));
c.push(bul('Liberté', 'Il peut pousser le sauvetage de Felix, le Hog Pit, Silvi, Wahlund, les Bâtards, le Tin Spur ou la préparation skaven.'));
c.push(bul('Friction', 'Il méprise la cruauté gratuite et la vantardise, mais respecte une décision assumée. Il n’est pas moraliste : il demande seulement qui paiera le prix annoncé.'));
c.push(q('Gunnar', 'Je vous ai promis les égouts. Je ne vous ai pas promis d’y mourir bêtement aujourd’hui.'));

const styles = {
  default: { document: { run: { font: 'Georgia', size: 22 } } },
  paragraphStyles: [
    { id: 'Normal', name: 'Normal', run: { font: 'Georgia', size: 22, color: C.black }, paragraph: { spacing: { after: 120, line: 300 } } },
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 38, bold: true, font: 'Arial', color: C.red }, paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: 'Arial', color: C.dkRed }, paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 1 } },
    { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: 'Arial', color: C.blue }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 2 } }
  ]
};
const numbering = { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 }, spacing: { after: 80, line: 290 } }, run: { font: 'Georgia', size: 22 } } }] }] };
const doc = new Document({
  numbering, styles,
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, pageNumberStart: 1 } }, children: c }]
});

const out = path.resolve(__dirname, '..', 'output');
fs.mkdirSync(out, { recursive: true });
Packer.toBuffer(doc).then(buffer => {
  const target = path.join(out, 'session_15_guide.docx');
  fs.writeFileSync(target, buffer);
  console.log(`Generated ${target} — ${c.length} paragraphs`);
});
