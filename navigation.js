
'use strict';
(() => {
 const menu=document.querySelector('#menu'),sidebar=document.querySelector('#sidebar'),scrim=document.querySelector('#scrim');
 if(!menu||!sidebar||!scrim)return;
 function setOpen(open){sidebar.classList.toggle('open',open);scrim.hidden=!open;menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Yan menüyü kapat':'Yan menüyü aç');}
 menu.onclick=()=>setOpen(!sidebar.classList.contains('open'));
 scrim.onclick=()=>setOpen(false);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false);});
 sidebar.addEventListener('click',event=>{if(event.target.closest('button,a'))setOpen(false);});
 window.addEventListener('resize',()=>{if(innerWidth>700)setOpen(false);});
 window.aivoraMenu={setOpen};
})();
