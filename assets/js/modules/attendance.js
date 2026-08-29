
(function(){
"use strict";
function mark(studentId,date,status,batchId,note=""){let a=EVStore.arr("attendance"),x=a.find(v=>v.studentId===studentId&&v.date===date);if(x)EVStore.update("attendance",x.id,{status,batchId,note});else EVStore.add("attendance",{studentId,date,status,batchId,note})}
function history(studentId){return EVStore.arr("attendance").filter(x=>x.studentId===studentId).sort((a,b)=>String(b.date).localeCompare(String(a.date)))}
function percentage(studentId,from,to){let a=history(studentId).filter(x=>(!from||x.date>=from)&&(!to||x.date<=to)),p=a.filter(x=>x.status==="Present").length;return a.length?Math.round(p*100/a.length):0}
windowEVAttendance={}; window.EVAttendance={mark,history,percentage};
})();
