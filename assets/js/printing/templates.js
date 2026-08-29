
(function(){
"use strict";
const esc=EVCRUD.esc;
function receipt(f,s){return `<h2>Fee Receipt</h2><p><b>Receipt No:</b> ${esc(f.receiptNo||f.id)}</p><p><b>Student:</b> ${esc(s?.name||f.studentName)}</p><p><b>Date:</b> ${esc(f.date)}</p><p><b>Amount:</b> ₹${esc(f.amount)}</p><p><b>Mode:</b> ${esc(f.mode)}</p><hr><p>Authorized Signature: __________________</p>`}
function idCard(s){return `<div style="border:2px solid #222;padding:18px;width:330px;margin:auto"><h2>EZEE VISION CHAMPUA</h2><h3>${esc(s.name)}</h3><p>Class: ${esc(s.class)}</p><p>Batch: ${esc(s.batch)}</p><p>Mobile: ${esc(s.mobile)}</p><p>ID: ${esc(s.id)}</p></div>`}
function reportCard(s,rows){return `<h2>Student Report Card</h2><p><b>Name:</b> ${esc(s.name)}</p><table><tr><th>Exam</th><th>Marks</th><th>Max</th><th>Grade</th></tr>${rows.map(x=>`<tr><td>${esc(x.examName)}</td><td>${esc(x.marks)}</td><td>${esc(x.maxMarks)}</td><td>${esc(x.grade)}</td></tr>`).join("")}</table>`}
window.EVPrint={receipt,idCard,reportCard};
})();
