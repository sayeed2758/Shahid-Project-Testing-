
(function(){
"use strict";
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function table(rows,cols){return `<table><thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(typeof c.value==="function"?c.value(r):r[c.key])}</td>`).join("")}<td><button data-edit="${esc(r.id)}">Edit</button><button data-delete="${esc(r.id)}">Delete</button></td></tr>`).join("")}</tbody></table>`}
function bindTable(root, cfg, render){root.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{if(confirm("Delete this record?")){EVStore.remove(cfg.key,b.dataset.delete);render()}});root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>cfg.edit?.(EVStore.find(cfg.key,b.dataset.edit)))}
function csv(rows,name){if(!rows.length)return alert("No records to export.");let keys=[...new Set(rows.flatMap(x=>Object.keys(x)))];let e=v=>`"${String(v??"").replaceAll('"','""')}"`;let s=[keys.map(e).join(","),...rows.map(r=>keys.map(k=>e(r[k])).join(","))].join("\n");let a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+s],{type:"text/csv"}));a.download=name;a.click()}
function print(title,body){let w=window.open("","_blank","width=1000,height=800");if(!w)return alert("Allow pop-ups for printing.");w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial;color:#111}h1{margin:0 0 4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:6px;font-size:11px}th{background:#eee}.head{margin-bottom:15px}</style></head><body><h1>${esc(title)}</h1><div class="head">EZEE VISION CHAMPUA</div>${body}</body></html>`);w.document.close();setTimeout(()=>w.print(),300)}
window.EVCRUD={esc,table,bindTable,csv,print};
})();
