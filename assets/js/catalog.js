const CLASSES=["6","7","8","9","10"];
const SUBJECTS=[
  {id:"sst",name:"SST",icon:"🌍"},
  {id:"science",name:"SCIENCE",icon:"🔬"},
  {id:"math",name:"MATH",icon:"🧮"},
  {id:"english",name:"ENGLISH",icon:"📚"}
];
const SECTIONS=[
  {id:"detailed",name:"Detailed Notes",icon:"📖",protected:true},
  {id:"short",name:"Short Notes",icon:"📝",protected:true},
  {id:"worksheet",name:"Worksheet",icon:"📄",protected:false}
];

// Phase 16–20 intentionally ships with an empty local catalog.
// PDFs are now uploaded only from the Admin Panel to Firebase Storage.
const DEMO_CATALOG={};

function emptyCatalog(){
  const o={};
  for(const c of CLASSES){
    o[c]={};
    for(const s of SUBJECTS){
      o[c][s.id]={};
      for(const sec of SECTIONS)o[c][s.id][sec.id]=[];
    }
  }
  return o;
}

function normalizeCatalog(raw){
  const o=emptyCatalog();
  for(const c of CLASSES){
    for(const s of SUBJECTS){
      for(const sec of SECTIONS){
        const v=raw?.[c]?.[s.id]?.[sec.id];
        o[c][s.id][sec.id]=Array.isArray(v)?v.filter(x=>x&&x.id&&x.filePath):[];
      }
    }
  }
  return o;
}

function flattenCatalog(catalog){
  const out=[];
  for(const c of CLASSES)for(const s of SUBJECTS)for(const sec of SECTIONS){
    for(const it of(catalog?.[c]?.[s.id]?.[sec.id]||[])){
      out.push({...it,classId:c,subjectId:s.id,sectionId:sec.id});
    }
  }
  return out;
}

window.EVCatalog={CLASSES,SUBJECTS,SECTIONS,DEMO_CATALOG,emptyCatalog,normalizeCatalog,flattenCatalog};
