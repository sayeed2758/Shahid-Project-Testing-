
(function(){
"use strict";
function monthTotal(key,field,month){return EVStore.sum(key,field,x=>String(x.date||"").slice(0,7)===month)}
function dashboard(month){return {fees:monthTotal("fees","amount",month),income:monthTotal("expenses","income",month),expense:monthTotal("expenses","amount",month),students:EVStore.arr("students").length,batches:EVStore.arr("batches").length}}
window.EVFinance={monthTotal,dashboard};
})();
