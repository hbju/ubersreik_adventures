// ============================================================
// UBERSREIK GM GUIDE TEMPLATE — established visual language
// Usage: copy this file, replace the CONTENT section, then:
//   npm install docx   (once per machine)
//   node your_guide.js
// Output lands in ./output/
// ============================================================
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ShadingType, PageBreak, LevelFormat
} = require('docx');
const fs = require('fs');

// Palette
const C = {
  red:"8B1A1A", dkRed:"5C0011", blue:"1F3864", gold:"7B5200",
  grey:"555555", lgrey:"888888", black:"1A1A1A", green:"2E5F2E",
  purple:"5C2D82", teal:"1A5F5F", warm:"6B3A00", music:"2D5F8A"
};

// ---- Helpers (the established visual language) ----
const h1=t=>new Paragraph({heading:HeadingLevel.HEADING_1,spacing:{before:480,after:200},children:[new TextRun({text:t,font:"Arial",size:38,bold:true,color:C.red})]});
const h2=t=>new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:360,after:140},children:[new TextRun({text:t,font:"Arial",size:28,bold:true,color:C.dkRed})]});
const h3=t=>new Paragraph({heading:HeadingLevel.HEADING_3,spacing:{before:240,after:100},children:[new TextRun({text:t,font:"Arial",size:24,bold:true,color:C.blue})]});
const body=(t,o={})=>new Paragraph({spacing:{after:150,line:300},children:[new TextRun({text:t,font:"Georgia",size:22,color:C.black,...o})]});
const sp=()=>new Paragraph({spacing:{after:80},children:[new TextRun("")]});

// Gold box: GM secrets & mechanics
const gmNote=t=>new Paragraph({shading:{fill:"FFF8E1",type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:12,color:C.gold,space:6}},indent:{left:400},spacing:{before:80,after:200},children:[new TextRun({text:"GM \u2014 "+t,font:"Arial",size:20,italics:true,color:C.gold})]});

// Brown box: read-aloud atmospheric text (French, italic Georgia)
const readAloud=t=>new Paragraph({shading:{fill:"FDF6EE",type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:14,color:C.warm,space:8}},indent:{left:500,right:300},spacing:{before:100,after:100,line:320},children:[new TextRun({text:t,font:"Georgia",size:22,color:"3A2010",italics:true})]});

// Red box: critical warnings
const warn=t=>new Paragraph({shading:{fill:"FDE8E8",type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:12,color:C.red,space:6}},indent:{left:400},spacing:{before:80,after:200},children:[new TextRun({text:"\u26a0 "+t,font:"Arial",size:20,bold:true,color:C.dkRed})]});

// Purple box: consequences if PCs are absent
const ifAbsent=t=>new Paragraph({shading:{fill:"F3E8FD",type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:12,color:C.purple,space:6}},indent:{left:400},spacing:{before:80,after:200},children:[new TextRun({text:"\u2716 SI LES PJs NE SONT PAS L\u00c0 \u2014 "+t,font:"Arial",size:20,italics:true,color:C.purple})]});

// Green block: timeline entries (Rough Night format)
const timeBlock=t=>new Paragraph({shading:{fill:"E0F0E0",type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:14,color:C.green,space:6}},spacing:{before:280,after:140},children:[new TextRun({text:"\u23f0 "+t,font:"Arial",size:26,bold:true,color:C.green})]});

// Blue box: music suggestions
const musicBox=t=>new Paragraph({shading:{fill:"E8EEF8",type:ShadingType.CLEAR},border:{left:{style:BorderStyle.THICK,size:12,color:C.music,space:6}},indent:{left:400},spacing:{before:80,after:180},children:[new TextRun({text:"\u266b MUSIQUE \u2014 "+t,font:"Arial",size:20,italics:true,color:C.music})]});

// Teal plot tag for timeline entries: [Festival] text...
const plotTag=(name,t)=>new Paragraph({indent:{left:400},spacing:{after:100},children:[new TextRun({text:"["+name+"] ",font:"Arial",size:20,bold:true,color:C.teal}),new TextRun({text:t,font:"Georgia",size:22,color:C.black})]});

// NPC dialogue: bold red speaker + italic quote
const q=(s,t)=>new Paragraph({indent:{left:720,right:360},spacing:{before:60,after:100},children:[...(s?[new TextRun({text:s+" : ",font:"Arial",size:21,bold:true,color:C.dkRed})]:[] ),new TextRun({text:`\u201c${t}\u201d`,font:"Georgia",size:21,italics:true,color:C.black})]});

const bul=(l,t)=>new Paragraph({numbering:{reference:"bullets",level:0},spacing:{after:100},children:[...(l?[new TextRun({text:l+" \u2014 ",font:"Georgia",size:22,bold:true,color:C.black})]:[] ),new TextRun({text:t||l,font:"Georgia",size:22,color:C.black})]});
const divider=()=>new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:6,color:C.red,space:1}},spacing:{before:280,after:280},children:[new TextRun("")]});
const titlePage=(num,title,date)=>[
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:600,after:80},children:[new TextRun({text:num,font:"Arial",size:56,bold:true,color:C.red})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:80,after:100},children:[new TextRun({text:title,font:"Arial",size:44,bold:true,color:C.dkRed})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:100,after:80},children:[new TextRun({text:date,font:"Arial",size:26,italics:true,color:C.grey})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:80,after:600},children:[new TextRun({text:"Guide du Ma\u00eetre \u2014 Warhammer Fantasy Roleplay 4e \u00c9dition",font:"Arial",size:20,italics:true,color:C.lgrey})]}),
  divider()
];

// ============================================================
// CONTENT — replace everything below
// ============================================================
const c = [];
c.push(...titlePage("SESSION XX","TITRE DE LA SESSION","Date en jeu"));
c.push(h1("1. EXEMPLE"));
c.push(body("Texte de corps."));
c.push(readAloud("Texte \u00e0 lire \u00e0 haute voix."));
c.push(gmNote("Secret de MJ."));
c.push(musicBox("Suggestion musicale."));
c.push(q("PNJ","R\u00e9plique."));

// ============================================================
// BUILD — do not modify
// ============================================================
const doc = new Document({
  numbering:{config:[{reference:"bullets",levels:[{level:0,format:LevelFormat.BULLET,text:"\u2022",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}}]}]},
  styles:{
    default:{document:{run:{font:"Georgia",size:22}}},
    paragraphStyles:[
      {id:"Heading1",name:"Heading 1",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:38,bold:true,font:"Arial",color:C.red},paragraph:{spacing:{before:480,after:200},outlineLevel:0}},
      {id:"Heading2",name:"Heading 2",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:28,bold:true,font:"Arial",color:C.dkRed},paragraph:{spacing:{before:360,after:140},outlineLevel:1}},
      {id:"Heading3",name:"Heading 3",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:24,bold:true,font:"Arial",color:C.blue},paragraph:{spacing:{before:240,after:100},outlineLevel:2}}
    ]
  },
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children:c}]
});

if(!fs.existsSync("./output")) fs.mkdirSync("./output");
Packer.toBuffer(doc).then(buf=>{
  fs.writeFileSync("./output/guide.docx",buf);
  console.log("Done: ./output/guide.docx \u2014 "+c.length+" paragraphs");
});
