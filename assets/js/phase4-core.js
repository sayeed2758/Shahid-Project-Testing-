
/* EZEE VISION CHAMPUA - Phase 4 Core
   Adds reliable local/cloud CRUD helpers, reports, printing and exports.
   Existing Phase 1-3 modules remain untouched.
*/
(function(){
  "use strict";
  const P4={version:"4.0.0",key:"ezee_phase4"};
  const get=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
  const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  P4.state=get(P4.key,{students:[],batches:[],attendance:{},fees:[],expenses:[],exams:[],enquiries:[],staff:[]});
  P4.save=()=>put(P4.key,P4.state);
  P4.uid=()=>window.firebase?.auth?.currentUser?.uid||"local";
  P4.collection=(name)=>Array.isArray(P4.state[name])?P4.state[name]:(P4.state[name]={});
  P4.add=(name,obj)=>{const a=P4.collection(name);obj.id=obj.id||crypto.randomUUID();obj.createdAt=obj.createdAt||Date.now();a.push(obj);P4.save();return obj};
  P4.update=(name,id,patch)=>{const a=P4.collection(name),i=a.findIndex(x=>x.id===id);if(i<0) return null;a[i]={...a[i],...patch,updatedAt:Date.now()};P4.save();return a[i]};
  P4.remove=(name,id)=>{const a=P4.collection(name),i=a.findIndex(x=>x.id===id);if(i<0)return false;a.splice(i,1);P4.save();return true};
  P4.csv=(rows,filename)=>{
    if(!rows.length){alert("No data to export.");return}
    const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
    const csv=[keys.map(esc).join(","),...rows.map(r=>keys.map(k=>esc(r[k])).join(","))].join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  P4.print=(title,html)=>{
    const w=window.open("","_blank","width=900,height=700");
    if(!w){alert("Please allow pop-ups to print.");return}
    w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8"><style>
      @page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;padding:8px}
      h1{font-size:22px;margin:0 0 6px}.meta{font-size:12px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #777;padding:6px;text-align:left}th{font-weight:700}
      .right{text-align:right}.center{text-align:center}.total{font-weight:700}
    </style></head><body><h1>${title}</h1><div class="meta">EZEE VISION CHAMPUA</div>${html}</body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),300);
  };
  P4.reportTable=(rows,columns)=>`<table><thead><tr>${columns.map(c=>`<th>${c.label}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${r[c.key]??""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  window.EVPhase4=P4;
})();
