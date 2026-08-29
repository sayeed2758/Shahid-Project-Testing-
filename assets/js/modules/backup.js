
(function(){
"use strict";
function download(){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(EVStore.get(),null,2)],{type:"application/json"}));a.download="ezee-vision-backup-"+new Date().toISOString().slice(0,10)+".json";a.click()}
function restore(file){let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);EVStore.state=x;EVStore.save();location.reload()}catch(e){alert("Invalid backup file.")}};r.readAsText(file)}
window.EVBackup={download,restore};
})();
