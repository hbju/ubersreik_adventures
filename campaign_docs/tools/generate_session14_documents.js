const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ShadingType, LevelFormat, Table, TableRow, TableCell,
  WidthType, VerticalAlign, PageOrientation
} = require('../.docx-runtime/node_modules/docx');
const fs = require('fs');
const path = require('path');

const C={red:'8B1A1A',dkRed:'5C0011',blue:'1F3864',gold:'7B5200',grey:'555555',lgrey:'888888',black:'1A1A1A',green:'2E5F2E',purple:'5C2D82',teal:'1A5F5F',warm:'6B3A00',music:'2D5F8A'};
const tr=(text,o={})=>new TextRun({text,font:o.font||'Georgia',size:o.size||22,color:o.color||C.black,bold:o.bold,italics:o.italics});
const h1=t=>new Paragraph({heading:HeadingLevel.HEADING_1,children:[tr(t,{font:'Arial',size:38,bold:true,color:C.red})]});
const h2=t=>new Paragraph({heading:HeadingLevel.HEADING_2,children:[tr(t,{font:'Arial',size:28,bold:true,color:C.dkRed})]});
const h3=t=>new Paragraph({heading:HeadingLevel.HEADING_3,children:[tr(t,{font:'Arial',size:24,bold:true,color:C.blue})]});
const body=(t,o={})=>new Paragraph({spacing:{after:150,line:300},keepNext:o.keepNext,children:[tr(t,o)]});
const box=(label,t,fill,color)=>new Paragraph({shading:{fill,type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:12,color,space:6}},indent:{left:400,right:160},spacing:{before:80,after:180,line:290},children:[tr(label+' — ',{font:'Arial',size:20,bold:true,color}),tr(t,{font:'Arial',size:20,italics:true,color})]});
const gm=t=>box('GM',t,'FFF8E1',C.gold);
const warn=t=>box('⚠',t,'FDE8E8',C.red);
const absent=t=>box('✖ SI LES PJs NE SONT PAS LÀ',t,'F3E8FD',C.purple);
const music=t=>box('♫ MUSIQUE',t,'E8EEF8',C.music);
const read=t=>new Paragraph({shading:{fill:'FDF6EE',type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:14,color:C.warm,space:8}},indent:{left:500,right:300},spacing:{before:100,after:140,line:320},children:[tr(t,{italics:true,color:'3A2010'})]});
const time=t=>new Paragraph({shading:{fill:'E0F0E0',type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:14,color:C.green,space:6}},spacing:{before:250,after:120},children:[tr('⏰ '+t,{font:'Arial',size:26,bold:true,color:C.green})]});
const q=(s,t)=>new Paragraph({indent:{left:720,right:360},spacing:{before:50,after:100},children:[tr(s+' : ',{font:'Arial',size:21,bold:true,color:C.dkRed}),tr('« '+t+' »',{size:21,italics:true})]});
const bul=(label,t)=>new Paragraph({numbering:{reference:'bullets',level:0},spacing:{after:90,line:290},children:[tr(label+(t?' — ':''),{bold:!!t}),tr(t||'')]});
const divider=()=>new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:6,color:C.red,space:1}},spacing:{before:200,after:200},children:[tr('')]});
const title=(num,name,date)=>[
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:500,after:60},children:[tr(num,{font:'Arial',size:56,bold:true,color:C.red})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:80},children:[tr(name,{font:'Arial',size:44,bold:true,color:C.dkRed})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:60},children:[tr(date,{font:'Arial',size:26,italics:true,color:C.grey})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:360},children:[tr('Guide du Maître — Warhammer Fantasy Roleplay 4e',{font:'Arial',size:20,italics:true,color:C.lgrey})]}),divider()
];

const c=[];
c.push(...title('SESSION 14','Les plaies de Magnustag','Nuit du 10 → Wellentag 13 Sigmarzeit'));
c.push(h1('Vue d’ensemble'));
c.push(body('Cette séance referme la fuite des Magnussewers, laisse deux jours à la ville pour réagir, puis rend la main aux joueurs au matin du 13. Le rythme doit passer de la panique à l’épuisement, puis de l’intime à la rumeur publique. Gunnar est le personnage invité probable : il arrive pour une expédition devenue impossible et choisit où porter sa force.'));
c.push(gm('Durée visée : 18 h–22 h 30. Ne cherchez pas à jouer chaque Endeavour heure par heure. Demandez à chaque joueur ce qu’il veut obtenir, cadrez une scène décisive, puis faites avancer la ville.'));
c.push(warn('Trois tests de Ratte Fever seulement : Thucydion, Ludwig et Silas. Ludwig et Silas sont actuellement à 0 Wound dans l’état de campagne ; une seconde descente immédiate doit paraître suicidaire, pas simplement sous-optimale.'));
c.push(h2('Questions à poser dès l’ouverture'));
c.push(bul('Preuve','Tentez-vous de prélever un trophée skaven avant de fuir ? Qui porte quoi ?'));
c.push(bul('Giordano','Ludwig et Silas ont-ils parlé à Silvi de son offre et des Bastards of the Reik ?'));
c.push(bul('Expédition','Après ce qui vient d’arriver, maintenez-vous le rendez-vous avec Gunnar ou l’annulez-vous ?'));
c.push(bul('Priorité personnelle','Pendant les deux jours de repos, quelle chose votre personnage refuse-t-il de laisser attendre ?'));

c.push(h1('1. Le dernier couloir'));
c.push(music('Darkest Dungeon — “The Warrens”, bas et sans interruption. Couper la musique lorsqu’ils atteignent enfin l’air libre.'));
c.push(read('Derrière vous, quelque chose frappe la pierre. Une fois. Deux fois. Puis vient le crissement de griffes innombrables, le souffle rauque d’une masse trop lourde pour courir et, plus près encore, le claquement sec d’ordres que vous ne comprenez pas. Devant, le conduit remonte vers une obscurité moins noire. Entre les deux : trois blessés à porter, du sang jusqu’aux chevilles, et le cadavre d’une chose dont personne, là-haut, ne voudra croire l’existence.'));
c.push(h2('Choix : fuir ou prendre une preuve'));
c.push(bul('Fuite immédiate','Le groupe conserve son avance. Un test collectif d’Athlétisme Intermédiaire (+0) suffit ; les porteurs peuvent utiliser Endurance si c’est plus logique. Un échec coûte du matériel, inflige 1 Fatigued ou sépare brièvement un porteur — pas un nouveau combat complet.'));
c.push(bul('Prélever un trophée','Un PJ effectue un test de Force Intermédiaire (+0). Chaque tentative prend un round narratif. Sur réussite : tête, patte ou arme identifiable. Sur échec : rien n’est encore détaché et les poursuivants gagnent du terrain.'));
c.push(bul('Transport','Wahlund, Anders et Mårten ne peuvent pas courir seuls. Rickard est conscient mais gravement atteint. Melina commande tant que personne ne propose mieux.'));
c.push(gm('Après chaque tentative de prélèvement, augmentez d’un cran la difficulté de la fuite : +20, +0, −10, −20. À −20, montrez le Rat Ogre ou la vermine au bout du conduit. Le message est “partez”, non “gagnez encore un combat”.'));
c.push(warn('Un combat supplémentaire doit tourner très mal. Faites sentir le nombre, les blessures et la mission de sauvetage. Les Skaven veulent récupérer leurs prisonniers et empêcher qu’une preuve atteigne la surface.'));
c.push(h3('Issues possibles'));
c.push(bul('Preuve sauvée','Silvi accepte enfin que la menace est réelle. Les Crosses ouvrent argent, caches, guetteurs et négociation avec Giordano.'));
c.push(bul('Sans preuve','Silvi croit les PJs, mais ne peut pas engager tout son réseau sur leur parole. Elle finance soins et matériel, pas encore une guerre souterraine.'));
c.push(bul('Preuve perdue en route','La scène confirme la menace tout en gardant Silvi prudente. Un Cross peut tenter de retrouver le paquet plus tard — avec un prix.'));
c.push(absent('Les poursuivants reprennent les prisonniers et déplacent la geôle. Wahlund survit mais la piste vers Rasknitt devient plus chère et plus lente.'));

c.push(h1('2. Retour à la surface — nuit du 10'));
c.push(read('L’air de la nuit sent la fumée, la bière renversée et les feux de Magnustag qui meurent lentement sur les places. Derrière les toits, une dernière fusée éclate trop tard : une fleur rouge, silencieuse à cette distance. Personne ne vous acclame. Personne ne sait ce que vous portez hors de la terre.'));
c.push(h2('Wahlund : reconnaissance et limites'));
c.push(q('Wahlund','Vous avez descendu vos morts chercher les miens. Ce compte-là ne s’efface pas.'));
c.push(bul('Il révèle','Le nom de Grey Seer Rasknitt ; sa nature de chef skaven ; la poursuite commencée dans le Nordland ; les grandes lignées skaven, leurs habitudes de tunnels, leur lâcheté collective et leur cruauté organisée.'));
c.push(bul('Il ignore','Le rôle exact de Rasknitt à Ubersreik, le warpstone, la fonction du dispositif, les cibles sur la carte et le plan contre les Casernes.'));
c.push(bul('Stromfels','Il ne fait pas une confession solennelle au groupe entier. Aux sauveteurs attentifs, ses tatouages et le sanctuaire rendent le secret évident. S’il est confronté en privé, il reconnaît servir “le Seigneur des Profondeurs” et demande que ses hommes ne paient pas pour sa foi.'));
c.push(q('Wahlund','Rasknitt n’est pas venu seul. Là où il passe, les clans se tolèrent assez longtemps pour accomplir quelque chose de grand. Puis ils s’entre-dévorent. Il faut frapper avant cette seconde étape.'));

c.push(h1('3. Angestag 11 — les comptes du matin'));
c.push(time('08 h 00 — Maladie, blessures et réveil'));
c.push(bul('Ratte Fever','Thucydion, Ludwig et Silas effectuent le test d’Endurance prévu par le profil officiel. Notez secrètement les échecs et la chronologie des symptômes.'));
c.push(bul('Soins','Appliquez normalement Gut Wound, Festering Wound, repos et soins. Les valeurs de l’application sont un état de départ, pas une guérison automatique.'));
c.push(bul('Endeavours','Chaque joueur annonce un objectif. Un seul jet ou une seule scène forte suffit à déterminer ce qu’il obtient avant le 13.'));
c.push(time('10 h 00 — Gunnar frappe à la porte'));
c.push(read('Trois coups lourds font vibrer la porte. Gunnar attend sur le seuil, son paquetage déjà sanglé, l’air de quelqu’un venu tuer un monstre et découvrant qu’il arrive après la bataille. Son regard passe des bandages aux lits, puis revient aux survivants. « Alors. Vous avez commencé sans moi. »'));
c.push(q('Gunnar','Je ne demande pas si vous y retournerez. Je demande ce qu’il faut préparer pour que, la prochaine fois, nous revenions tous.'));
c.push(gm('Gunnar est le personnage invité. Donnez-lui immédiatement un choix utile : interroger Wahlund, visiter Silvi, préparer l’expédition, chercher Felix ou accepter un combat. Il n’a pas besoin d’attendre que les PJs guérissent pour exister.'));
c.push(h2('Les Bastards et l’expédition différée'));
c.push(bul('Si Silvi a été prévenue','Elle convoque Giordano. Le prix de 20 GC devient une négociation : argent, part de butin, dette future ou service. Les Crosses concluent si les PJs se portent garants.'));
c.push(bul('Si Silvi n’a pas été prévenue','Giordano n’arrive pas miraculeusement. Gunnar demande qui manque au groupe ; cela rappelle l’offre aux joueurs sans la résoudre pour eux.'));
c.push(bul('Nouvelle mission','Former une strike team pour plus tard dans la semaine : Gunnar + Bastards + Melina, avec matériel, itinéraire, objectif et signal de retraite.'));
c.push(absent('Sans décision des PJs, Gunnar et Melina préparent seuls une reconnaissance limitée. Ils reviennent avec la certitude que les Skaven déplacent leurs forces, mais sans atteindre l’atelier.'));

c.push(h1('4. Les cinq fils personnels'));
c.push(h2('Silas — Doktor Theodosia Grat'));
c.push(read('Le cabinet de la doctoresse Grat ne sent ni l’encens ni la charogne : seulement le savon, l’alcool clair et le papier neuf. Tout y est propre avec une précision presque agressive. Elle regarde la plaie de Silas longtemps, puis sourit comme une collègue enfin intéressante.'));
c.push(q('Grat','Vous avez fait du bon travail dans de mauvaises conditions. Maintenant, laissez quelqu’un de mieux équipé vous sauver de votre propre courage.'));
c.push(bul('Ce qu’elle fait','Elle traite réellement la Festering Wound avec compétence, parle à Silas en confrère et lui prête un ouvrage médical annoté.'));
c.push(bul('Le piège','L’injection de Bronze Fever vient au rendez-vous de suivi, présentée comme un antalgique ou fortifiant. Ne la forcez pas si Silas refuse. Son charme vient de sa compétence réelle.'));
c.push(gm('La chapelle de Nurgle reste dans un placard fermé. Un test de Perception Difficile (−10) peut relever une odeur douceâtre ou une serrure trop robuste, pas révéler toute la vérité.'));
c.push(h2('Thucydion — Christoph Engel'));
c.push(q('Engel','Les fanatiques ? De la vermine verticale. Vous, en revanche, avez vu quelque chose sous ma ville. Recommencez depuis le début. Sans embellir.'));
c.push(bul('Déclencheur','Engel devient attentif lorsque Thucydion décrit l’ingénieur, la machine et la carte. Sans le mot warpstone, il reconnaît une technologie magique corrompue possible, non sa fonction.'));
c.push(bul('Offre','Connaissances, questions précises à poser, signes magiques à relever et une méthode pour conserver un fragment sans le toucher. Pas de soldats.'));
c.push(bul('Prix','Engel veut être informé avant que le Conseil ou le Temple ne transforme l’affaire en panique publique.'));
c.push(h2('Ludwig — Elsa et la troisième loyauté'));
c.push(q('Elsa','Tu as distribué leurs mots. Maintenant je veux savoir qui les écrit, qui les paie, et ce qu’ils cherchent vraiment.'));
c.push(bul('Débrief','Elsa attend noms, lieux et impressions. Elle sait reconnaître une omission, mais préfère exploiter Ludwig plutôt que le punir immédiatement.'));
c.push(bul('Préparation du 15','Isolde demandera qui a volé la poudre. Ludwig connaît déjà la réponse générale : K&H. Il doit décider quelle vérité vendre à qui.'));
c.push(h2('Pieter — Jannik et Ingrid'));
c.push(bul('Première apparition','Ingrid est aperçue au bord du rassemblement autour du corps ou du cortège. Elle croise le regard de Pieter puis disparaît derrière des pénitents.'));
c.push(bul('Seconde apparition maximum','Une silhouette à la Pious Cup, une main sur une porte, puis plus rien. Elle ne se laisse pas rattraper pendant le downtime.'));
c.push(bul('Funérailles','Le Temple et Ricker utilisent la mort de Jannik pour nourrir le récit du Sorcier meurtrier, sans connaître toute la vérité.'));
c.push(h2('Kaspar — le prix de la victoire'));
c.push(bul('Otto','Félicite Kaspar devant les autres, puis lui rappelle en privé que la Cage était l’opération d’Otto. Sa chaleur publique et sa froideur privée doivent diverger.'));
c.push(bul('Rolf','Kaspar sait qu’il semblait surpris et qu’il a protégé Bella. Les rumeurs de taupe circulent, mais personne ne prononce encore son nom devant Silas.'));
c.push(bul('Johanna','Elle a entendu parler de la Cage. Sa question n’est pas “as-tu gagné ?” mais “qu’est-ce que tu es devenu ?”'));

c.push(h1('5. Festag 12 — la ville choisit ses vérités'));
c.push(time('Matin — Les Endeavours se concluent'));
c.push(body('Résolvez les soins, acquisitions, recherches et contacts. Faites payer le temps : un PJ qui poursuit Ingrid ne peut pas simultanément négocier l’équipement de l’expédition. Gunnar peut couvrir un besoin, pas tous.'));
c.push(time('Après-midi — Les rumeurs se figent'));
c.push(h2('Rumeurs de rue — 1d6'));
c.push(bul('1','La Garde a laissé la Cage tomber parce qu’elle avait reçu l’ordre de ne pas intervenir.'));
c.push(bul('2','Le héros Jannik a été abattu par un sorcier ; le Temple saura lequel.'));
c.push(bul('3','Des gobelins vivent maintenant sous les maisons de la Morgenseite.'));
c.push(bul('4','Le grand combattant de la Cage était payé par les Karstadt.'));
c.push(bul('5','Les feux de Magnustag ont brûlé vert dans certains quartiers.'));
c.push(bul('6','Pfeffer prépare des arrestations massives pour sauver sa réputation.'));
c.push(h2('Rumeurs de l’ombre — 1d6'));
c.push(bul('1','Mercy Lowhaven paie pour le nom de celui qui a tranché la gorge de Bella.'));
c.push(bul('2','Il y a une taupe chez le Baron ; Otto promet une mort lente.'));
c.push(bul('3','Werner achète quais, barques et silence pendant que tous regardent la Cage.'));
c.push(bul('4','Felix Scite combattra bientôt dans un entrepôt sans fenêtres.'));
c.push(bul('5','Des Tileans cherchent vingt couronnes pour aller tuer des hommes-rats.'));
c.push(bul('6','Les égouts du nord ont changé de voix depuis Magnustag.'));
c.push(h2('Rumeurs des temples et salons — 1d6'));
c.push(bul('1','Von Dabernick écrit à Altdorf : Ubersreik serait devenue ingouvernable.'));
c.push(bul('2','Les pamphlets étaient trop bien distribués pour être spontanés.'));
c.push(bul('3','Christoph Engel enterre vivants ceux qui prient trop fort devant sa tour.'));
c.push(bul('4','Le culte d’Ulric veut faire disparaître un champion avant Sigmartag.'));
c.push(bul('5','Le Herald publiera des noms que la Garde aurait préféré oublier.'));
c.push(bul('6','Les Karstadt offriront bientôt leur protection à de nouveaux héros populaires.'));

c.push(h1('6. Wellentag 13 — le monde revient frapper'));
c.push(music('Silence pendant la lecture du Herald, puis Witcher 3 — “The Vagabond” pour la reprise en ville.'));
c.push(read('Au matin, les feuilles humides du nouvel Ubersreik Herald collent aux pavés. On les lit aux fenêtres, aux comptoirs, sous les porches. Votre victoire, vos échecs et vos morts ont déjà quitté vos mains : ils appartiennent désormais à la ville.'));
c.push(bul('Distribuer','Remettez le Herald #2 aux joueurs avant tout résumé oral. Laissez-les découvrir ce que la ville croit.'));
c.push(bul('Faire choisir','Après les réactions, demandez : “Quel problème allez-vous empêcher de s’aggraver aujourd’hui ?”'));
c.push(bul('Pression','La prime Lowhaven circule ; Wendt possède un début de dossier ; les Skaven déplacent leur dispositif ; Ricker gagne une audience.'));
c.push(gm('Ne révélez pas le programme complet jusqu’au 18. Les joueurs doivent sentir plusieurs incendies, puis construire eux-mêmes le chemin qui mène aux Casernes.'));

c.push(h1('Annexe — Gunnar pour le joueur invité'));
c.push(body('Gunnar Brederson est un Slayer nain qui a vaincu un ours sans trouver sa mort. Il respecte Thucydion malgré son elfité, connaît Ekkehard et a promis de rejoindre l’expédition gratuitement. Son moteur de jeu : une promesse faite est une dette sacrée ; un danger prouvé doit être affronté avec préparation, pas nié.'));
c.push(bul('Voix','Phrases courtes, humour sec, aucune plainte sur ses blessures.'));
c.push(bul('Priorités','Protéger les incapables de fuir ; obtenir des faits ; préparer une vraie descente ; chercher un adversaire digne.'));
c.push(bul('Liberté du joueur','Il peut pousser Felix, le Hog Pit, les combats, Silvi, Wahlund ou la préparation skaven. Il n’est pas un garde du corps silencieux.'));
c.push(bul('Limite','Il ne connaît ni le plan de K&H, ni Rasknitt, ni le secret d’Eisfange.'));
c.push(q('Gunnar','Je vous ai promis les égouts. Je ne vous ai pas promis d’y mourir bêtement aujourd’hui.'));

const styles={
  default:{document:{run:{font:'Georgia',size:22}}},
  paragraphStyles:[
    {id:'Normal',name:'Normal',run:{font:'Georgia',size:22,color:C.black},paragraph:{spacing:{after:120,line:300}}},
    {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:38,bold:true,font:'Arial',color:C.red},paragraph:{spacing:{before:480,after:200},outlineLevel:0}},
    {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:28,bold:true,font:'Arial',color:C.dkRed},paragraph:{spacing:{before:360,after:140},outlineLevel:1}},
    {id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:24,bold:true,font:'Arial',color:C.blue},paragraph:{spacing:{before:240,after:100},outlineLevel:2}}
  ]
};
const numbering={config:[{reference:'bullets',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360},spacing:{after:80,line:290}},run:{font:'Georgia',size:22}}}]}]};
const guide=new Document({numbering,styles,sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134},pageNumberStart:1}},children:c}]});

function cell(text,fill,width,bold=false,color=C.black){return new TableCell({width:{size:width,type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,shading:fill?{fill,type:ShadingType.CLEAR}:undefined,margins:{top:70,bottom:70,left:100,right:100},children:[new Paragraph({spacing:{after:0,line:240},children:[tr(text,{font:'Arial',size:16,bold,color})]})]});}
const rows=[
 ['10–12','SKAVEN','Clawleader échappé ; déplacement des forces','L’atelier et la sape avancent','Preuve + reconnaissance','7B211A'],
 ['11–13','LOWHAVEN','Bella morte ; Felix captif','Prime sur Kaspar, Hog Pit fortifié','Felix / taupe Rolf','7B211A'],
 ['11–13','WATCH','Wendt suit Rudi','Petit dossier crédible','Approche avec preuve','31547A'],
 ['11–15','ZEALOTS','Jannik mort ; Ingrid cachée','Ricker légitime la peur d’Engel','Pieter / vérité du meurtre','765A18'],
 ['11–15','RÉSISTANCE','Pamphlets diffusés','Isolde cherche la poudre','Choix de Ludwig','5C2D82'],
 ['11–16','TIN SPUR','Eisfange = Reikhardt','Le combat devient une affiche','Pieter / Kretschmer','315447'],
 ['11–17','CROSSES','Silvi attend une preuve','Négociation des Bastards','Garantie des PJs','1A5F5F'],
 ['14','RED MOON','Mission de Franz maintenue','Anciennes dettes reviennent','Scénario à adapter','6B3A00'],
 ['18','K&H','Humilier Pfeffer, ruiner la Garde','Explosion des Casernes','Exposer / détourner / arrêter','8B1A1A']
];
const trackerChildren=[
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:70},children:[tr('SEMAINE 2 — TABLEAU DES MENACES',{font:'Arial',size:34,bold:true,color:C.dkRed})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:120},children:[tr('Du 10 au 18 Sigmarzeit • cocher/annoter après chaque scène',{font:'Arial',size:17,italics:true,color:C.grey})]}),
 new Table({width:{size:13600,type:WidthType.DXA},columnWidths:[900,1750,3150,3150,3100,1550],rows:[
   new TableRow({tableHeader:true,children:[cell('DATE','E8D9BC',900,true,C.dkRed),cell('MENACE','E8D9BC',1750,true,C.dkRed),cell('ÉTAT','E8D9BC',3150,true,C.dkRed),cell('MOUVEMENT SANS LES PJs','E8D9BC',3150,true,C.dkRed),cell('LEVIER DES PJs','E8D9BC',3100,true,C.dkRed),cell('NIVEAU','E8D9BC',1550,true,C.dkRed)]}),
   ...rows.map((r,i)=>new TableRow({children:[cell(r[0],i%2?'F7F2E8':null,900,true),cell(r[1],i%2?'F7F2E8':null,1750,true,r[5]),cell(r[2],i%2?'F7F2E8':null,3150),cell(r[3],i%2?'F7F2E8':null,3150),cell(r[4],i%2?'F7F2E8':null,3100),cell('□ □ □',i%2?'F7F2E8':null,1550,true,r[5])] }))
 ]}),
 new Paragraph({spacing:{before:100,after:40},children:[tr('RÈGLE DE PRESSION',{font:'Arial',size:18,bold:true,color:C.red}),tr('  Chaque journée où une menace n’est ni observée ni contrariée, cochez une case. À trois cases, déclenchez une conséquence visible avant le prochain choix des joueurs.',{font:'Arial',size:17})]}),
 new Paragraph({children:[tr('ALLIÉS À PRIX',{font:'Arial',size:18,bold:true,color:C.teal}),tr('  Silvi : preuve • Wahlund : dette et secret • Engel : information • Bastards : garantie + accord financier • Gunnar : promesse et objectif digne.',{font:'Arial',size:17})]})
];
const tracker=new Document({styles,sections:[{properties:{page:{size:{width:15840,height:12240,orientation:PageOrientation.LANDSCAPE},margin:{top:540,right:600,bottom:540,left:600}}},children:trackerChildren}]});

const out=path.resolve(__dirname,'..','output');
fs.mkdirSync(out,{recursive:true});
Promise.all([
 Packer.toBuffer(guide).then(b=>fs.writeFileSync(path.join(out,'session_14_guide.docx'),b)),
 Packer.toBuffer(tracker).then(b=>fs.writeFileSync(path.join(out,'week2_threat_tracker.docx'),b))
]).then(()=>console.log('Generated Session 14 guide and Week 2 threat tracker.'));
