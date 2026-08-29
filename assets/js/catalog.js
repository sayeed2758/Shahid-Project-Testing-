export const CLASS_IDS = ["6","7","8","9","10"];
export const SUBJECTS = [
  {id:"sst",name:"SST",icon:"🌍"},
  {id:"science",name:"SCIENCE",icon:"🔬"},
  {id:"math",name:"MATH",icon:"📐"},
  {id:"english",name:"ENGLISH",icon:"📖"}
];
export const SECTIONS = [
  {id:"detailed",name:"Detailed Notes",icon:"📘",protected:true},
  {id:"short",name:"Short Notes",icon:"📝",protected:true},
  {id:"worksheet",name:"Worksheet",icon:"📄",protected:false}
];

const demos = {
  "6": {science:["Food Components","Sorting Materials","The Living Organisms"],sst:["History Basics","The Earth","Our Government"],math:["Knowing Numbers","Whole Numbers","Basic Geometry"],english:["Reading Skills","Grammar Basics","Writing Skills"]},
  "7": {science:["Nutrition in Plants","Heat","Motion and Time"],sst:["Medieval History","Environment","Civics Basics"],math:["Integers","Fractions and Decimals","Lines and Angles"],english:["Grammar Practice","Reading Comprehension","Creative Writing"]},
  "8": {science:["Crop Production","Force and Pressure","Light"],sst:["Resources","Indian Constitution","Modern History"],math:["Rational Numbers","Linear Equations","Mensuration"],english:["Tenses","Comprehension","Composition"]},
  "9": {science:["Matter in Our Surroundings","Atoms and Molecules","Motion"],sst:["India and Contemporary World","Democratic Politics","Economics"],math:["Number Systems","Polynomials","Coordinate Geometry"],english:["Beehive","Moments","Grammar & Writing"]},
  "10": {science:["Chemical Reactions","Life Processes","Light"],sst:["Nationalism in India","Power Sharing","Development"],math:["Real Numbers","Polynomials","Trigonometry"],english:["First Flight","Footprints Without Feet","Grammar & Writing"]}
};

function makeDemo(){
  const root={};
  for(const c of CLASS_IDS){root[c]={}; for(const s of SUBJECTS){root[c][s.id]={}; for(const sec of SECTIONS){root[c][s.id][sec.id]={}; const chapters=demos[c][s.id]; chapters.forEach((chapter,i)=>{const id=`${s.id}-${i+1}`; root[c][s.id][sec.id][id]={id,title:chapter,type:sec.id,chapter:chapter,order:i+1,filePath:"",published:false,description:sec.protected?"Demo entry — PDF will appear here after publishing the material.":"Demo worksheet entry — publish a PDF in Firebase Storage to enable download."};});}}}
  return root;
}
export const DEMO_CATALOG = makeDemo();

export function normalizeCatalog(raw){
  const source = raw && typeof raw === "object" ? raw : {};
  const merged = structuredClone(DEMO_CATALOG);
  for(const c of CLASS_IDS){
    if(!source[c]) continue;
    for(const s of Object.keys(source[c])){
      merged[c] ||= {}; merged[c][s] ||= {};
      for(const sec of Object.keys(source[c][s]||{})) merged[c][s][sec]=source[c][s][sec];
    }
  }
  return merged;
}

export function flattenCatalog(catalog){
  const out=[];
  for(const c of CLASS_IDS) for(const s of SUBJECTS) for(const sec of SECTIONS){
    const items = catalog?.[c]?.[s.id]?.[sec.id] || {};
    Object.values(items).forEach(item=>out.push({classId:c,subjectId:s.id,subjectName:s.name,sectionId:sec.id,sectionName:sec.name,...item}));
  }
  return out.sort((a,b)=>(a.order||0)-(b.order||0));
}
