import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
class Element {
 constructor(){this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.children=[];this.style={setProperty(){}};this.dataset={};this.open=false;this.clicks=0;this.attrs={};this.classes=new Set();this.classList={toggle:(v,on)=>{if(on===undefined)on=!this.classes.has(v);on?this.classes.add(v):this.classes.delete(v);},contains:v=>this.classes.has(v),add:v=>this.classes.add(v),remove:v=>this.classes.delete(v)};}
 addEventListener(type,fn){this[type]=fn;}
 setAttribute(k,v){this.attrs[k]=v;}
 removeAttribute(k){delete this.attrs[k];}
 append(...xs){this.children.push(...xs);}
 replaceChildren(...xs){this.children=xs;}
 focus(){}
 click(){this.clicks++;return this.onclick?.();}
 showModal(){this.open=true;}
 close(){this.open=false;}
}
function setup({signedIn=false,brokenClient=false}={}){
 const elements=new Map([...fs.readFileSync('index.html','utf8').matchAll(/id="([^"]+)"/g)].map(m=>['#'+m[1],new Element()]));
 elements.get('#attachmentMenu').hidden=true;
 let authChange;
 const session=signedIn?{user:{id:'11111111-1111-4111-8111-111111111111',email:'test@example.invalid'}}:null;
 const query={select(){return this;},eq(){return this;},order(){return this;},limit:async()=>({data:[]})};
 const db={from:()=>query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:cb=>authChange=cb},functions:{invoke:async()=>({data:{is_admin:false,usage:{plan:'Ücretsiz',limit:25,used:0,plan_id:'free',chat_enabled:true},ai:{ready:true},plans:[]}})}};
 const ctx={window:{supabase:{createClient:()=>{if(brokenClient)throw Error('storage unavailable');return db;}},aivoraGoogleAuth:{callbackError:()=>null},addEventListener(){}},document:{querySelector:s=>elements.get(s),querySelectorAll:()=>[],documentElement:new Element(),createElement:()=>new Element(),createTextNode:x=>x,addEventListener(){}},localStorage:{getItem(){}},sessionStorage:{getItem(){}},matchMedia:()=>({matches:true}),location:{hash:''},innerHeight:800,innerWidth:390,navigator:{},URLSearchParams,setTimeout,console};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('navigation.js','utf8'),ctx);vm.runInContext(fs.readFileSync('chat.js','utf8'),ctx);
 return {elements,ctx,change:session=>authChange('SIGNED_IN',session)};
}
for(const signedIn of [false,true]){
 const {elements:e}=setup({signedIn});await new Promise(r=>setTimeout(r,15));
 e.get('#attachPhoto').click();assert.equal(e.get('#attachmentMenu').hidden,false);assert.equal(e.get('#photoInput').clicks,0,'Plus opens choices instead of picker');e.get('#choosePhoto').click();assert.equal(e.get('#photoInput').clicks,1);assert.equal(e.get('#attachmentMenu').hidden,true);e.get('#attachPhoto').click();e.get('#chooseFile').click();assert.equal(e.get('#documentInput').clicks,1);assert.equal(e.get('#attachmentMenu').hidden,true);
 assert.equal(e.get('#attachPhoto').disabled,false);assert.equal(e.get('#send').disabled,false);
 e.get('#menu').click();assert.equal(e.get('#sidebar').classList.contains('open'),true);assert.equal(e.get('#scrim').hidden,false);
 e.get('#scrim').click();assert.equal(e.get('#sidebar').classList.contains('open'),false);
}
const {elements:e}=setup({brokenClient:true});e.get('#menu').click();assert.ok(e.get('#sidebar').classList.contains('open'),'Menu works if chat client cannot initialize');
assert.match(e.get('#notice').textContent,/Bağlantı/);
console.log('PASS: signed-in and signed-out photo chooser, enabled send/attachment controls, mobile menu/scrim, navigation survives unavailable chat client.');
const fileUi=setup({signedIn:true});await new Promise(r=>setTimeout(r,15));fileUi.elements.get('#photoInput').files=[{name:'report.csv',type:'text/csv',size:120}];await fileUi.elements.get('#photoInput').onchange();assert.equal(fileUi.elements.get('#photoPreview').hidden,false);assert.match(fileUi.elements.get('#photoName').textContent,/report.csv/);assert.equal(fileUi.elements.get('#photoThumbnail').hidden,true);fileUi.elements.get('#removePhoto').click();assert.equal(fileUi.elements.get('#photoPreview').hidden,true);console.log('PASS: signed-in document selection, filename preview and removal.');

assert.equal(fs.readFileSync('chat.js','utf8'),fs.readFileSync('chat-attachments-v4.js','utf8'));console.log('PASS: plus menu has separate image/document pickers; published script matches tested source.');
