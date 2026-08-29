
(function(){
"use strict";
const KEY="ezee_vision_final_v1";
const defaults={students:[],batches:[],attendance:[],fees:[],expenses:[],exams:[],marks:[],enquiries:[],staff:[],todos:[],notifications:[],settings:{instituteName:"EZEE VISION CHAMPUA"}};
function uid(){return window.firebase?.auth?.currentUser?.uid || "local";}
function read(){try{return JSON.parse(localStorage.getItem(KEY+"_"+uid()))||structuredClone(defaults)}catch(e){return structuredClone(defaults)}}
let state=read();
function save(){localStorage.setItem(KEY+"_"+uid(),JSON.stringify(state));window.dispatchEvent(new CustomEvent("ezee:data-changed",{detail:state}));return state}
function id(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)}
function arr(k){if(!Array.isArray(state[k]))state[k]=[];return state[k]}
function add(k,x){x={id:id(),createdAt:new Date().toISOString(),...x};arr(k).push(x);save();return x}
function update(k,i,x){let a=arr(k),n=a.findIndex(v=>v.id===i);if(n<0)throw Error("Record not found");a[n]={...a[n],...x,updatedAt:new Date().toISOString()};save();return a[n]}
function remove(k,i){let a=arr(k),n=a.findIndex(v=>v.id===i);if(n>=0){a.splice(n,1);save();return true}return false}
function find(k,i){return arr(k).find(v=>v.id===i)}
function sum(k,field,fn){return arr(k).filter(fn||(()=>true)).reduce((t,v)=>t+(Number(v[field])||0),0)}
window.EVStore={KEY,state,get:()=>state,reload:()=>{state=read();return state},save,add,update,remove,find,arr,sum,uid,id};
})();
