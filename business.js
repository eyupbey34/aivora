'use strict';
(() => {
 const el=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],esc=escapeHtml;
 const state={uid:null,epoch:0,rows:[],page:'',offset:0,total:0,search:'',archive:false,filter:'',selected:null,profile:null};
 const titles={appointments:'Randevular',knowledge:'Bilgi Bankası',tasks:'Takip Görevleri',drafts:'İçerik & Kampanyalar',integrations:'Bağlantılar',reports:'Raporlar'};
 const icons={appointments:'◷',knowledge:'◈',tasks:'✓',drafts:'↗',integrations:'⌘',reports:'▥'};
 const date=x=>x?new Date(x).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'}):'—';
 const n=x=>Number(x||0).toLocaleString('tr-TR');
 const localTime=x=>x?new Date(new Date(x).getTime()+10800000).toISOString().slice(0,16):'';
 const tableNames={contacts:'business_contacts',appointments:'business_appointments',knowledge:'business_knowledge',tasks:'business_tasks',drafts:'business_drafts',calls:'business_conversations'};
 const stages={new:'Yeni talep',qualified:'Görüşülüyor',customer:'Müşteri',closed:'Kapandı'};
 const statuses={scheduled:'Planlandı',completed:'Tamamlandı',cancelled:'İptal',open:'Açık',closed:'Kapalı',draft:'Taslak',approved:'Onaylandı',archived:'Arşiv',done:'Tamamlandı'};
 const channels={email:'E-posta',social:'Sosyal medya',ads:'Reklam',campaign:'Arama kampanyası'};
 const nav=el('.nav');
 Object.entries(titles).forEach(([id,title])=>{pages[id]=title;const b=document.createElement('button');b.className='nav-link';b.dataset.page=id;b.innerHTML=`<span>${icons[id]}</span>${title}`;nav.insertBefore(b,el('#adminNav'));b.addEventListener('click',()=>navigate(id));const sec=document.createElement('section');sec.className='page';sec.id='page-'+id;el('.main footer').before(sec);});
 pages.calls='Gelen Kutusu';el('[data-page=calls]').innerHTML='<span>◉</span> Gelen Kutusu';
 const originalNavigate=navigate;
 navigate=function(page){originalNavigate(page);if(state.uid){state.offset=0;state.search='';state.filter='';state.archive=false;state.selected=null;state.page=page;loadPage(page);}};
 const edit=document.createElement('dialog');edit.id='businessDialog';edit.className='modal business-modal';edit.setAttribute('aria-labelledby','businessDialogTitle');document.body.append(edit);
 const panelEmpty=(title,text)=>`<div class="panel empty-state business-empty"><div class="empty-orb">✧</div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
 const heading=(title,desc,action='')=>`<div class="page-heading"><div><p class="eyebrow">AIVORA ÇALIŞMA ALANI</p><h1>${title}</h1><p class="muted">${desc}</p></div>${action}</div>`;
 const addButton=label=>`<button class="btn primary" data-create>＋ ${label}</button>`;
 function assertResult(r){if(r.error)throw r.error;return r.data;}
 function owner(table){return db.from(table).select('*',{count:'exact'}).eq('user_id',state.uid);}
 const cleanError=e=>/Bu saat aralığında/.test(e.message)?'Bu saat aralığında başka bir randevu var. Farklı bir saat seç.':/foreign key/i.test(e.message)?'Bağlantılı kayıt bulunamadı. Sayfayı yenile.':/row-level security|permission/i.test(e.message)?'Bu işlem için yetkin yok. Oturumunu kontrol et.':/check constraint/i.test(e.message)?'Alanları kontrol et. Tarih, uzunluk veya değer sınırı aşıldı.':'İşlem tamamlanamadı. Bağlantını kontrol edip yeniden dene.';
 async function loadPage(page){
  if(!state.uid)return;
  if(page==='overview'){await overview();return;}
  if(page==='agents'){agentTools();return;}
  if(page==='settings'){await businessProfile();return;}
  if(page==='integrations'){renderConnectors();return;}
  if(page==='reports'){await reports();return;}
  const table=tableNames[page];if(!table)return;
  const epoch=state.epoch,root=el('#page-'+page),seq=(root.dataset.load=String(Number(root.dataset.load||0)+1));
  const descriptions={contacts:'Kişiler, satış aşamaları ve notlar hesabında saklanır.',appointments:'Türkiye saatiyle randevularını planla. Çakışan saatlere kayıt yapılamaz.',knowledge:'Aktif bilgilerin tüm AI asistanlarının yanıtlarına eklenir. En yeni 10 kayıt, en fazla 18.000 karakter kullanılır.',tasks:'Geri dönüşleri, yapılacak işleri ve son tarihleri takip et.',drafts:'E-posta, sosyal medya, reklam ve arama kampanyası taslaklarını hazırla. Bu bölüm dışarıya gönderim yapmaz.',calls:'Web AI sohbetlerin ve mesaj geçmişin. Telefon ve WhatsApp kayıtları bağlantı sonrasında eklenebilir.'};
  const labels={contacts:'Müşteri ekle',appointments:'Randevu oluştur',knowledge:'Bilgi ekle',tasks:'Görev oluştur',drafts:'Taslak oluştur'};
  root.innerHTML=heading(pages[page],descriptions[page],labels[page]?addButton(labels[page]):'<button class="btn secondary" data-inbox-new>＋ Yeni sohbet</button>')+'<div class="suite-data-status" role="status">Kayıtlar yükleniyor…</div>';
  try{
   let q=owner(table);
   if(page==='contacts')q=q.eq('archived',state.archive);
   if(page==='knowledge')q=q.eq('active',!state.archive);
   if(page==='tasks')q=q.eq('status',state.archive?'archived':state.filter||'open');
   if(page==='drafts'){q=q.eq('status',state.archive?'archived':state.filter||'draft');}
   if(page==='appointments'&&state.filter)q=q.eq('status',state.filter);
   if(page==='calls'&&state.filter)q=q.eq('status',state.filter);
   if(state.search)q=q.ilike(['contacts','agents'].includes(page)?'name':'title','%'+state.search.replace(/[\\%_]/g,'')+'%');
   const result=await q.order(page==='appointments'?'starts_at':page==='calls'?'updated_at':'created_at',{ascending:page==='appointments'}).range(state.offset,state.offset+29);
   const rows=assertResult(result)||[];
   if(epoch!==state.epoch||root.dataset.load!==seq)return;
   state.rows=rows;state.total=result.count||0;
   const options=page==='appointments'?{scheduled:'Planlanan',completed:'Tamamlanan',cancelled:'İptal edilen'}:page==='drafts'?{draft:'Taslaklar',approved:'Onaylananlar'}:page==='tasks'?{open:'Açık görevler',done:'Tamamlananlar'}:page==='calls'?{open:'Açık görüşmeler',closed:'Kapalı görüşmeler'}:null;
   root.querySelector('.suite-data-status').outerHTML=`<div class="business-toolbar"><label class="sr-only" for="businessSearch">Kayıtlarda ara</label><input class="business-search" id="businessSearch" type="search" maxlength="80" placeholder="${page==='contacts'?'İsim':'Başlık'} ile ara" value="${esc(state.search)}"><button class="btn secondary" data-search>Ara</button>${options?`<select aria-label="Durum filtresi" id="businessFilter">${['appointments','calls'].includes(page)?'<option value="">Tüm durumlar</option>':''}${Object.entries(options).map(([v,l])=>`<option value="${v}" ${state.filter===v?'selected':''}>${l}</option>`).join('')}</select>`:''}${['contacts','knowledge','tasks','drafts'].includes(page)?`<button class="btn secondary" data-archive-view>${state.archive?'Aktif kayıtlar':'Arşivi göster'}</button>`:''}${page==='contacts'?'<button class="btn secondary" data-csv>Bu sayfayı CSV indir</button>':''}</div><p class="business-count">${n(state.total)} kayıt${state.archive?' · Arşiv':''}</p><div id="businessRows"></div><div class="business-pager"><button class="btn secondary" data-step="-1" ${!state.offset?'disabled':''}>← Önceki</button><span>Sayfa ${state.offset/30+1}</span><button class="btn secondary" data-step="1" ${state.offset+30>=state.total?'disabled':''}>Sonraki →</button></div>`;
   const target=root.querySelector('#businessRows');
   if(!rows.length){target.innerHTML=panelEmpty('Kayıt bulunamadı',state.search?'Aramanı veya filtrelerini değiştir.':'İlk kaydını oluşturarak başlayabilirsin.');return;}
   if(page==='contacts')target.innerHTML=`<div class="business-table-wrap"><table class="business-table"><thead><tr><th scope="col">Müşteri</th><th scope="col">İletişim</th><th scope="col">Aşama</th><th scope="col">İşlem</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.company)}</small></td><td>${esc(r.email||'—')}<small>${esc(r.phone||'—')}</small></td><td><span class="business-status">${stages[r.stage]}</span></td><td><button class="btn secondary" data-edit="${r.id}">Düzenle</button></td></tr>`).join('')}</tbody></table></div>`;
   if(page==='appointments')target.innerHTML=`<div class="business-grid">${rows.map(r=>`<article class="business-card"><div class="business-meta"><span class="business-status">${statuses[r.status]}</span><time>${date(r.starts_at)} → ${new Date(r.ends_at).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'})}</time></div><h3>${esc(r.title)}</h3><p>${esc(r.notes)}</p><div class="card-actions"><button class="btn secondary" data-edit="${r.id}">Düzenle</button><button class="btn secondary" data-ics="${r.id}">Takvime indir</button></div></article>`).join('')}</div>`;
   if(page==='knowledge')target.innerHTML=`<div class="business-grid">${rows.map(r=>`<article class="business-card"><div class="business-meta"><span class="business-status">${r.active?'AI yanıtlarında kullanılır':'Arşivde'}</span></div><h3>${esc(r.title)}</h3><p>${esc(r.content.slice(0,280))}${r.content.length>280?'…':''}</p><div class="card-actions"><button class="btn secondary" data-edit="${r.id}">Düzenle</button><button class="btn secondary" data-archive="${r.id}">${r.active?'Arşivle':'Geri al'}</button></div></article>`).join('')}</div>`;
   if(page==='tasks')target.innerHTML=`<div class="panel">${rows.map(r=>`<div class="task-row ${r.status==='done'?'done':''}"><input type="checkbox" aria-label="${esc(r.title)} görevini tamamla" data-task="${r.id}" ${r.status==='done'?'checked':''} ${state.archive?'disabled':''}><div><strong>${esc(r.title)}</strong><small>${r.due_at?'Son tarih: '+date(r.due_at):'Son tarih yok'}</small></div><button class="btn secondary" data-edit="${r.id}">Düzenle</button></div>`).join('')}</div>`;
   if(page==='drafts')target.innerHTML=`<div class="business-grid">${rows.map(r=>`<article class="business-card"><div class="business-meta"><span class="business-status">${channels[r.channel]}</span><span>${statuses[r.status]}</span></div><h3>${esc(r.title)}</h3><p>${esc(r.content.slice(0,350))}${r.content.length>350?'…':''}</p><div class="card-actions"><button class="btn secondary" data-edit="${r.id}">Aç ve düzenle</button><button class="btn secondary" data-copy="${r.id}">Kopyala</button></div></article>`).join('')}</div>`;
   if(page==='calls'){target.innerHTML=`<div class="inbox-layout"><div class="inbox-list">${rows.map(r=>`<button class="thread-button" data-thread="${r.id}"><strong>${esc(r.title)}</strong><small>${date(r.updated_at)} · ${statuses[r.status]}</small></button>`).join('')}</div><article class="business-card" id="threadDetail"><h3>Bir görüşme seç</h3><p>Mesajlarını okumak veya açık görüşmeye devam etmek için soldaki kayda dokun.</p></article></div>`;if(state.selected&&rows.some(r=>r.id===state.selected))await openThread(state.selected);}
  }catch(e){if(epoch===state.epoch&&root.dataset.load===seq){const status=root.querySelector('.suite-data-status');if(status)status.innerHTML=`${esc(cleanError(e))} <button class="btn secondary" data-retry>Yeniden dene</button>`;}}
 }
 function inputField(id,label,value='',type='text',max=160,required=false){return `<label for="bf-${id}">${label}</label><input id="bf-${id}" name="${id}" type="${type}" value="${esc(value??'')}" ${max?`maxlength="${max}"`:''} ${required?'required':''}>`;}
 function area(id,label,value='',max=4000){return `<label for="bf-${id}">${label}</label><textarea id="bf-${id}" name="${id}" rows="4" maxlength="${max}">${esc(value)}</textarea>`;}
 function selectField(id,label,options,value){return `<label for="bf-${id}">${label}</label><select id="bf-${id}" name="${id}">${Object.entries(options).map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select>`;}
 async function editor(page,row=null,initial={}){
  const epoch=state.epoch,r=row||initial,table=tableNames[page];let fields='';
  if(page==='contacts')fields=inputField('name','Ad soyad',r.name,'text',100,true)+inputField('email','E-posta',r.email,'email',254)+inputField('phone','Telefon',r.phone,'tel',40)+inputField('company','Şirket',r.company,'text',100)+selectField('stage','Satış aşaması',stages,r.stage||'new')+area('notes','Notlar',r.notes||'')+ (row?selectField('archived','Kayıt durumu',{'false':'Aktif','true':'Arşiv'},String(r.archived)):'');
  if(page==='knowledge')fields=inputField('title','Bilgi başlığı',r.title,'text',120,true)+area('content','İşletme bilgisi / sık sorulan soru',r.content||'',6000)+selectField('active','AI yanıtlarında kullan',{'true':'Aktif','false':'Arşiv'},String(r.active??true));
  if(page==='tasks')fields=inputField('title','Görev',r.title,'text',200,true)+inputField('due_at','Son tarih (Türkiye saati)',localTime(r.due_at),'datetime-local',null)+area('notes','Notlar',r.notes||'')+selectField('status','Durum',{open:'Açık',done:'Tamamlandı',archived:'Arşiv'},r.status||'open');
  if(page==='drafts')fields=inputField('title','Taslak başlığı',r.title,'text',160,true)+selectField('channel','Kanal',channels,r.channel||'email')+area('content','İçerik',r.content||'',8000)+'<button class="btn secondary" type="button" id="draftAI">✦ Asistanla taslak hazırla</button>'+selectField('status','İnceleme durumu',{draft:'Taslak',approved:'Onaylandı',archived:'Arşiv'},r.status||'draft')+'<p class="fine-print">Onaylama yalnızca taslağın durumunu değiştirir. E-posta, gönderi, reklam veya arama başlatılmaz.</p>';
  if(page==='appointments'){
   let contacts=[];try{contacts=assertResult(await owner('business_contacts').eq('archived',false).order('name').limit(500))||[];}catch(e){showToast(cleanError(e));return;}
   if(epoch!==state.epoch)return;
   const options={'':'Müşteri seç (isteğe bağlı)',...Object.fromEntries(contacts.map(c=>[c.id,c.name]))};
   if(r.contact_id&&!options[r.contact_id])options[r.contact_id]='Kayıtlı müşteri (arşivde)';
   fields=inputField('title','Randevu başlığı',r.title,'text',160,true)+selectField('contact_id','Müşteri',options,r.contact_id||'')+inputField('starts_at','Başlangıç (Türkiye saati)',localTime(r.starts_at),'datetime-local',null,true)+inputField('ends_at','Bitiş (Türkiye saati)',localTime(r.ends_at),'datetime-local',null,true)+selectField('status','Durum',{scheduled:'Planlandı',completed:'Tamamlandı',cancelled:'İptal'},r.status||'scheduled')+area('notes','Notlar',r.notes||'',2000);
  }
  edit.innerHTML=`<h2 id="businessDialogTitle">${row?'Kaydı düzenle':pages[page]+' · Yeni kayıt'}</h2><form class="business-form" id="businessForm">${fields}<p id="businessFormError" class="business-error" role="status"></p><div class="modal-actions"><button type="button" class="btn secondary" data-close-business>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></form>`;
  edit.showModal();edit.querySelector('input,textarea,select')?.focus();
  const ai=el('#draftAI');if(ai)ai.onclick=generateDraft;
  el('#businessForm').onsubmit=async e=>{
   e.preventDefault();const form=e.target,values=Object.fromEntries(new FormData(form));
   Object.keys(values).forEach(k=>values[k]=values[k].trim());
   if(page==='contacts'&&row)values.archived=values.archived==='true';
   if(page==='knowledge'){values.active=values.active==='true';if(!values.content){el('#businessFormError').textContent='Bilgi içeriğini yaz.';return;}}
   if(page==='drafts'&&!values.content){el('#businessFormError').textContent='Taslak içeriğini yaz.';return;}
   if(page==='appointments'){
    values.contact_id=values.contact_id||null;
    values.starts_at=new Date(values.starts_at+':00+03:00').toISOString();values.ends_at=new Date(values.ends_at+':00+03:00').toISOString();
    if(new Date(values.ends_at)<=new Date(values.starts_at)||new Date(values.ends_at)-new Date(values.starts_at)>86400000){el('#businessFormError').textContent='Bitiş başlangıçtan sonra olmalı; randevu en fazla 24 saat sürebilir.';return;}
   }
   if(page==='tasks')values.due_at=values.due_at?new Date(values.due_at+':00+03:00').toISOString():null;
   if(Object.entries(values).some(([k,v])=>['name','title'].includes(k)&&!v)){el('#businessFormError').textContent='Başlık veya ad boş bırakılamaz.';return;}
   await saveForm(table,row,values,form,page,epoch);
  };
 }
 async function saveForm(table,row,values,form,page,epoch){
  const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);el('#businessFormError').textContent='Kaydediliyor…';
  try{
   const q=row?db.from(table).update(values).eq('id',row.id).eq('user_id',state.uid):db.from(table).insert({...values,user_id:state.uid});
   const saved=assertResult(await q.select());if(!saved?.length)throw Error('Save did not affect a row');
   if(epoch!==state.epoch)return;edit.close();showToast('Kayıt hesabına kaydedildi.');await loadPage(page);
  }catch(e){if(epoch===state.epoch)el('#businessFormError').textContent=cleanError(e);}finally{buttons.forEach(b=>b.disabled=false);}
 }
 async function changeRow(table,id,changes){const result=await db.from(table).update(changes).eq('id',id).eq('user_id',state.uid).select();if(!assertResult(result)?.length)throw Error('Record unavailable');}
 async function generateDraft(){
  const title=el('#bf-title').value.trim(),channel=el('#bf-channel').value;
  if(!title){el('#businessFormError').textContent='Önce bir taslak başlığı yaz.';return;}
  if(!agents.length){el('#businessFormError').textContent='Önce AI Asistanlar bölümünden bir asistan oluştur.';return;}
  const epoch=state.epoch,button=el('#draftAI');button.disabled=true;el('#businessFormError').textContent='Asistan taslağı hazırlıyor… (mesaj hakkından düşer)';
  try{const prompt=`${channels[channel]} için Türkçe bir içerik taslağı hazırla. Konu: ${title}. ${el('#bf-content').value?'Ek bilgi: '+el('#bf-content').value.slice(0,1800):''} Yalnızca taslak metnini ver. Bilinmeyen fiyatları, kampanya indirimlerini veya iletişim bilgilerini uydurma. Hiçbir dış işlem yapma.`;
   const result=await db.functions.invoke('aivora-ai-',{body:{agentId:agents[0].id,messages:[{role:'user',content:prompt}]}});
   if(result.error){let msg='AI taslağı hazırlanamadı.';try{msg=(await result.error.context.json()).error||msg;}catch{}throw Error(msg);}
   if(!result.data?.reply)throw Error('Yanıt alınamadı.');
   if(epoch!==state.epoch||!edit.open)return;el('#bf-content').value=result.data.reply;el('#businessFormError').textContent='Taslak hazır. Kontrol edip kaydedebilirsin.';
   window.dispatchEvent(new Event('aivora:usage'));
  }catch(e){if(epoch===state.epoch&&edit.open)el('#businessFormError').textContent=e.message;}finally{button.disabled=false;}
 }
 async function openThread(id){
  const epoch=state.epoch,row=state.rows.find(r=>r.id===id),detail=el('#threadDetail');if(!row||!detail)return;state.selected=id;
  all('[data-thread]').forEach(b=>b.classList.toggle('selected',b.dataset.thread===id));detail.innerHTML='<p role="status">Mesajlar yükleniyor…</p>';
  try{const result=await owner('business_messages').eq('conversation_id',id).order('ordinal',{ascending:false}).limit(100);const messages=(assertResult(result)||[]).reverse();if(epoch!==state.epoch||id!==state.selected)return;
   detail.innerHTML=`<div class="business-meta"><span class="business-status">Web AI</span><span>${statuses[row.status]}</span></div><h3>${esc(row.title)}</h3><p class="fine-print">${messages.length===100?'Son 100 mesaj gösteriliyor.':'Sohbet geçmişi hesabında saklanır.'}</p><div class="thread-messages">${messages.map(m=>`<div class="thread-message ${m.role==='user'?'user':''}"><small>${m.role==='user'?'Sen':'Aivora'}</small>${esc(m.content)}</div>`).join('')}</div><div class="card-actions">${row.status==='open'?'<button class="btn primary" data-resume>Sohbete devam et</button>':''}<button class="btn secondary" data-close-thread>${row.status==='open'?'Görüşmeyi kapat':'Yeniden aç'}</button><button class="btn secondary" data-transcript>Dökümü indir</button></div>`;
   const resume=detail.querySelector('[data-resume]');if(resume)resume.onclick=()=>{
    if(!agents.some(a=>a.id===row.assistant_id)){showToast('Asistan yüklenemedi. Sayfayı yenile.');return;}
    openAgentChat(row.assistant_id);conversationId=id;chatHistory=messages.slice(-20).map(m=>({role:m.role,content:m.content}));el('#chatMessages').replaceChildren();messages.forEach(m=>appendChat(m.role,m.content));
   };
   detail.querySelector('[data-close-thread]').onclick=async e=>{e.target.disabled=true;try{await changeRow('business_conversations',id,{status:row.status==='open'?'closed':'open'});await loadPage('calls');}catch(error){showToast(cleanError(error));e.target.disabled=false;}};
   detail.querySelector('[data-transcript]').onclick=()=>download('aivora-sohbet.txt',row.title+'\n'+messages.map(m=>(m.role==='user'?'Sen: ':'Aivora: ')+m.content).join('\n\n'),'text/plain;charset=utf-8');
  }catch(e){if(epoch===state.epoch&&id===state.selected)detail.innerHTML=`<p class="business-error">${cleanError(e)}</p>`;}
 }
 const connectors=[
  {id:'web',icon:'✧',name:'Web AI',live:true,description:'Asistanlarınla web sohbeti, bilgi bankası ve kullanım takibi.',steps:['AI Asistanlar bölümünde asistanını oluştur.','İşletme profilini ve bilgi bankasını doldur.','Web sohbetinde gerçek yanıtla test et.']},
  {id:'phone',icon:'◉',name:'Telefon',description:'Gelen / giden aramalar, numara, kayıt ve devir.',steps:['Bir telefon / SIP sağlayıcı hesabı ve kullanılacak numara gerekir.','Canlı ses sağlayıcısı, ses modeli ve çağrı webhookları bağlanmalıdır.','Çağrı kuralları, kayıt tercihleri ve insan devri numarasıyla test yapılır.']},
  {id:'whatsapp',icon:'◌',name:'WhatsApp Business',description:'Müşteri mesajları, medya ve ekip devri.',steps:['İşletmeye ait Meta Business hesabı ve WhatsApp numarası gerekir.','Cloud API yetkileri ve doğrulanan webhook sunucuda yapılandırılır.','Mesaj şablonları, onaylar ve canlı numara testi tamamlanır.']},
  {id:'email',icon:'✉',name:'Gmail / E-posta',description:'Gmail hesabını panelden bağla; iletileri oku ve inceleyerek gönder.',steps:['İşletme e-posta hesabı ve OAuth uygulaması gerekir.','Yalnızca gereken posta yetkileriyle güvenli hesap bağlantısı yapılır.','Gönderimden önce alıcı ve içerik onayı eklenir. Gmail bölümündeki ayrı onay ekranıyla gönderim yapılır.']},
  {id:'calendar',icon:'◷',name:'Google / Outlook Takvim',description:'Harici takvimle müsaitlik ve eşitleme.',steps:['İşletme takvim hesabı ve OAuth bağlantısı gerekir.','Takvim yetkileri ile çift yönlü eşitleme ve çakışma kuralları tanımlanır.','Şimdilik panelde randevu oluşturup .ics dosyasını takvimine aktarabilirsin.']},
  {id:'social',icon:'↗',name:'Sosyal Medya & Reklam',description:'Instagram, Facebook, LinkedIn, Google ve Meta.',steps:['İşletme sayfaları ve reklam hesapları bağlanmalıdır.','Yayın / reklam yetkileri ve bütçe kuralları açıkça belirlenir.','Şimdilik taslak oluşturma ve inceleme aktiftir; yayın veya reklam harcaması yapılmaz.']},
  {id:'payment',icon:'◇',name:'Ödeme',description:'Abonelik, tahsilat ve gerçek bakiye.',steps:['İşletmeye ait ödeme kuruluşu / sanal POS hesabı gerekir.','Paket bedelleri, fatura ve işletme bilgileri tanımlanır.','İmzalı webhooklarla tahsilat doğrulanır. Şu an ücret alınmaz.']},
  {id:'reports',icon:'▥',name:'Slack / Telegram Raporu',description:'Zamanlı gün sonu raporları.',steps:['Hedef çalışma alanı veya bot hesabı gerekir.','Rapor alıcıları ve saatleri belirlenir.','Şimdilik Raporlar bölümünden gerçek sayılarını görüntüleyip indirebilirsin.']},
  {id:'crm',icon:'♙',name:'CRM & İş Akışları',description:'Harici CRM, webhook ve API bağlantıları.',steps:['Kullandığın CRM sistemi ve gerekli API yetkileri belirlenir.','Veri alanları ile kayıt oluşturma / güncelleme kuralları eşleştirilir.','Şimdilik Aivora müşteri yönetimi ve CSV dışa aktarma kullanılabilir.']}
 ];
 function renderConnectors(){el('#page-integrations').innerHTML=heading('Bağlantı merkezi','Web AI hazır. Dış kanallar için gereken hesap ve bağlantıları burada takip et.')+`<div class="business-note">Bu sayfa mevcut bağlantı durumunu gösterir. Telefon, WhatsApp, reklam ve ödeme kanalları için sağlayıcı bağlantısı gerekir. Gmail hesabını aşağıdaki Gmail yönetimi düğmesiyle bağlayabilirsin. Buraya API anahtarı veya şifre yazma.</div><div class="connector-grid">${connectors.map(c=>`<article class="business-card"><div class="connector-icon">${c.icon}</div><div class="business-meta"><span class="business-status">${c.live?'Aktif':'Bağlı değil'}</span></div><h3>${c.name}</h3><p>${c.description}</p><button class="btn secondary" data-connector="${c.id}">${c.live?'Kullanım adımları':'Kurulum gereksinimleri'} →</button></article>`).join('')}</div>`;}
 function connectorGuide(id){const c=connectors.find(c=>c.id===id);if(!c)return;edit.innerHTML=`<h2 id="businessDialogTitle">${c.name}</h2><div class="connector-guide"><span class="business-status">${c.live?'Aktif':'Bağlı değil'}</span><ol>${c.steps.map(s=>`<li>${s}</li>`).join('')}</ol><div class="business-note">${c.live?'Asistanın web üzerinden yanıt vermeye hazır.':'Bu bir kurulum açıklamasıdır. Bağlantı oluşturmaz, numara satın almaz ve ücret başlatmaz.'}</div></div><div class="modal-actions"><button class="btn secondary" data-close-business>Kapat</button></div>`;edit.showModal();}
 async function businessProfile(){const root=el('#page-settings');let section=el('#businessProfile');if(!section){section=document.createElement('article');section.id='businessProfile';section.className='panel';root.prepend(section);}const epoch=state.epoch;section.innerHTML='<p>İşletme profili yükleniyor…</p>';
  try{const data=assertResult(await db.from('business_profile').select('*').eq('user_id',state.uid).maybeSingle())||{};if(epoch!==state.epoch)return;state.profile=data;
   section.innerHTML=`<h2>İşletme profili</h2><p class="muted">Bilgilerin asistan yanıtlarına eklenir. Dış hesaplara bağlantı oluşturmaz.</p><form class="business-form" id="profileForm">${inputField('business_name','İşletme adı',data.business_name||'Aivora','text',100,true)}${area('description','İşletmeni, hizmetlerini ve kurallarını anlat',data.description||'',3000)}${area('hours','Çalışma saatleri ve tatil bilgisi',data.hours||'',1000)}${inputField('language','Tercih edilen yanıt dili',data.language||'Türkçe','text',60,true)}${inputField('tone','Asistanın üslubu',data.tone||'Samimi ve profesyonel','text',200,true)}<p id="profileError" class="business-error" role="status"></p><div class="modal-actions"><button class="btn primary">Profili kaydet</button></div></form>`;
   el('#profileForm').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const values=Object.fromEntries(new FormData(e.target));Object.keys(values).forEach(k=>values[k]=values[k].trim());assertResult(await db.from('business_profile').upsert({...values,user_id:state.uid},{onConflict:'user_id'}).select());if(epoch===state.epoch)el('#profileError').textContent='İşletme profili kaydedildi.';}catch(e){if(epoch===state.epoch)el('#profileError').textContent=cleanError(e);}finally{b.disabled=false;}};
  }catch(e){if(epoch===state.epoch)section.innerHTML=`<p class="business-error">${cleanError(e)}</p>`;}
 }
 function agentTools(){let box=el('#agentManagement');if(!box){box=document.createElement('article');box.className='panel';box.id='agentManagement';el('#page-agents').append(box);}box.innerHTML=`<h2>Görev ve yönergeler</h2><p class="muted">Bilgi bankası tüm asistanlara uygulanır. Her asistanın görevini ayrıca düzenleyebilirsin.</p><div id="agentManagementRows">${agents.map(a=>`<div class="agent-management"><strong>${esc(a.name)}</strong><button class="btn secondary" data-edit-assistant="${a.id}">Görevi düzenle</button></div>`).join('')||'<p class="fine-print">İlk asistanını oluşturduğunda burada görünecek.</p>'}</div><div class="agent-tools"><button class="btn secondary" data-suite-go="knowledge">Bilgi bankasına git →</button><button class="btn secondary" data-suite-go="integrations">Kanalları incele →</button></div>`;}
 function assistantEditor(id){const a=agents.find(x=>x.id===id);if(!a)return;edit.innerHTML=`<h2 id="businessDialogTitle">Asistan görevini düzenle</h2><form class="business-form" id="assistantEdit">${inputField('name','Asistan adı',a.name,'text',40,true)}${selectField('type','Asistan türü',{'Telefon asistanı':'Telefon asistanı','WhatsApp asistanı':'WhatsApp asistanı','Müşteri destek asistanı':'Müşteri destek asistanı'},a.type)}${area('instructions','Görev ve yönergeler',a.instructions||'',4000)}<p class="fine-print">Tür seçimi telefon veya WhatsApp bağlantısını etkinleştirmez.</p><p id="businessFormError" class="business-error" role="status"></p><div class="modal-actions"><button type="button" class="btn secondary" data-close-business>Vazgeç</button><button class="btn primary">Kaydet</button></div></form>`;edit.showModal();el('#assistantEdit').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button[type=submit],button:not([type])');b.disabled=true;try{const v=Object.fromEntries(new FormData(e.target));assertResult(await db.from('assistants').update(v).eq('id',id).eq('user_id',state.uid).select());await loadAgents();agentTools();edit.close();showToast('Asistan güncellendi.');}catch(e){el('#businessFormError').textContent=cleanError(e);}finally{b.disabled=false;}};}
 async function count(table,filter){let q=db.from(table).select('*',{count:'exact',head:true}).eq('user_id',state.uid);if(filter)q=filter(q);const r=await q;if(r.error)throw r.error;return r.count||0;}
 async function getStats(){const [contacts,appointments,tasks,conversations,messages,knowledge]=await Promise.all([count('business_contacts',q=>q.eq('archived',false)),count('business_appointments',q=>q.eq('status','scheduled').gte('starts_at',new Date().toISOString())),count('business_tasks',q=>q.eq('status','open')),count('business_conversations'),count('business_messages',q=>q.eq('role','assistant')),count('business_knowledge',q=>q.eq('active',true))]);return{contacts,appointments,tasks,conversations,messages,knowledge};}
 async function overview(){const epoch=state.epoch;try{const s=await getStats();if(epoch!==state.epoch)return;el('#statConversations').textContent=n(s.conversations);el('#statCustomers').textContent=n(s.contacts);el('#statAppointments').textContent=n(s.appointments);el('#overviewActivity').innerHTML=`<h2>İşletmen, bir bakışta</h2><div class="report-stats report-overview"><div><strong>${n(s.tasks)}</strong><small>Açık görev</small></div><div><strong>${n(s.knowledge)}</strong><small>Aktif bilgi</small></div></div><div class="business-inline-actions"><button class="btn secondary" data-suite-go="tasks">Takip işlerini aç →</button><button class="btn secondary" data-suite-go="reports">Raporları gör →</button></div>`;}catch(e){if(epoch===state.epoch)el('#overviewActivity').innerHTML=`<p class="business-error">${cleanError(e)}</p><button class="btn secondary" data-suite-go="overview">Yeniden dene</button>`;}}
 async function reports(){const root=el('#page-reports'),epoch=state.epoch;root.innerHTML=heading('Raporlar','Çalışma alanındaki gerçek kayıtlar. Harici kanallar henüz bağlı değil.')+'<div role="status">Rapor hazırlanıyor…</div>';
  try{const s=await getStats();if(epoch!==state.epoch)return;const stamp=date(new Date());root.innerHTML=heading('Raporlar','Çalışma alanındaki gerçek kayıtlar. Harici kanallar henüz bağlı değil.','<button class="btn secondary" data-export-report>Raporu indir</button>')+`<p class="suite-data-status">Hazırlanma: ${stamp} · Tüm zamanlar</p><div class="report-stats">${[['Müşteri',s.contacts],['Yaklaşan randevu',s.appointments],['Açık görev',s.tasks],['Web görüşmesi',s.conversations],['Kayıtlı AI yanıtı',s.messages],['Aktif bilgi',s.knowledge]].map(([l,v])=>`<article class="business-card"><small>${l}</small><strong>${n(v)}</strong></article>`).join('')}</div><article class="panel"><h2>Kanal durumu</h2><div class="report-line"><span>Web AI</span><i style="width:60%"></i><strong>Aktif</strong></div><div class="report-line"><span>Telefon</span><strong>Bağlı değil</strong></div><div class="report-line"><span>WhatsApp</span><strong>Bağlı değil</strong></div><p class="fine-print">Bu rapor panel kayıtlarını sayar. Telefon dakika kullanımı, gelir veya WhatsApp mesajı içermez. Mesaj hakkı için Kullanım bölümünü aç.</p></article><button class="btn secondary" data-suite-go="wallet">Mesaj hakkını gör →</button>`;root.querySelector('[data-export-report]').onclick=()=>download('aivora-rapor.json',JSON.stringify({prepared_at:new Date().toISOString(),scope:'all_time',...s,phone_connected:false,whatsapp_connected:false},null,2),'application/json');}catch(e){if(epoch===state.epoch)root.innerHTML=heading('Raporlar','')+panelEmpty('Rapor yüklenemedi',cleanError(e))+'<button class="btn secondary" data-suite-go="reports">Yeniden dene</button>';}}
 function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function csvCell(v){let s=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function exportContacts(){const headers=['Ad soyad','E-posta','Telefon','Şirket','Aşama','Notlar'];const values=state.rows.map(r=>[r.name,r.email,r.phone,r.company,stages[r.stage],r.notes]);download('aivora-musteriler-sayfa-'+(state.offset/30+1)+'.csv','\uFEFF'+[headers,...values].map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');}
 function calendarFile(r){const d=x=>new Date(x).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const text=x=>String(x||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');download('aivora-randevu.ics',['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Aivora//Randevu//TR','BEGIN:VEVENT','UID:'+r.id+'@aivora.tr','DTSTAMP:'+d(new Date()),'DTSTART:'+d(r.starts_at),'DTEND:'+d(r.ends_at),'SUMMARY:'+text(r.title),'DESCRIPTION:'+text(r.notes),'STATUS:'+(r.status==='cancelled'?'CANCELLED':'CONFIRMED'),'END:VEVENT','END:VCALENDAR',''].join('\r\n'),'text/calendar;charset=utf-8');}
 async function copyText(text){try{await navigator.clipboard.writeText(text);showToast('İçerik kopyalandı.');}catch{edit.innerHTML='<h2 id="businessDialogTitle">Metni kopyala</h2><p class="muted">Metni seçip telefonunun kopyalama menüsünü kullan.</p><textarea readonly rows="12" class="business-field" style="width:100%"></textarea><div class="modal-actions"><button class="btn secondary" data-close-business>Kapat</button></div>';edit.querySelector('textarea').value=text;edit.showModal();edit.querySelector('textarea').select();}}
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-close-business')){edit.close();return;}
  if(b.dataset.suiteGo){navigate(b.dataset.suiteGo);return;}
  if(b.dataset.connector){connectorGuide(b.dataset.connector);return;}
  if(b.dataset.editAssistant){assistantEditor(b.dataset.editAssistant);return;}
  const page=b.closest('.page')?.id.replace('page-','');if(!tableNames[page])return;
  if(b.hasAttribute('data-create')){editor(page);return;}
  if(b.hasAttribute('data-inbox-new')){navigate('agents');return;}
  if(b.hasAttribute('data-retry')){loadPage(page);return;}
  if(b.hasAttribute('data-search')){state.search=el('#businessSearch').value.trim();state.offset=0;loadPage(page);return;}
  if(b.hasAttribute('data-archive-view')){state.archive=!state.archive;state.offset=0;loadPage(page);return;}
  if(b.dataset.step){state.offset=Math.max(0,state.offset+30*Number(b.dataset.step));loadPage(page);return;}
  if(b.hasAttribute('data-csv')){exportContacts();return;}
  if(b.dataset.thread){await openThread(b.dataset.thread);return;}
  const id=b.dataset.edit||b.dataset.archive||b.dataset.ics||b.dataset.copy,row=state.rows.find(r=>r.id===id);if(!row)return;
  if(b.dataset.edit){editor(page,row);return;}
  if(b.dataset.ics){calendarFile(row);return;}
  if(b.dataset.copy){copyText(row.content);return;}
  if(b.dataset.archive){b.disabled=true;try{await changeRow(tableNames[page],id,{active:!row.active});await loadPage(page);}catch(error){showToast(cleanError(error));b.disabled=false;}}
 });
 document.addEventListener('change',async e=>{
  if(e.target.id==='businessFilter'){state.filter=e.target.value;state.offset=0;loadPage(state.page);}
  if(e.target.matches('[data-task]')){const b=e.target;b.disabled=true;try{await changeRow('business_tasks',b.dataset.task,{status:b.checked?'done':'open'});await loadPage('tasks');}catch(error){b.checked=!b.checked;b.disabled=false;showToast(cleanError(error));}}
 });
 document.addEventListener('keydown',e=>{if(e.target.id==='businessSearch'&&e.key==='Enter'){e.preventDefault();state.search=e.target.value.trim();state.offset=0;loadPage(state.page);}});
 window.addEventListener('aivora:actions',event=>{
  if(!state.uid||!Array.isArray(event.detail))return;
  for(const proposal of event.detail.slice(0,1)){
   const page={appointment:'appointments',contact:'contacts',task:'tasks'}[proposal.type];if(!page||!proposal.values||typeof proposal.values!=='object')continue;
   const allowed=proposal.type==='appointment'?['title','starts_at','ends_at','notes']:proposal.type==='contact'?['name','email','phone','company','notes']:['title','due_at','notes'];
   const values=Object.fromEntries(allowed.map(k=>[k,typeof proposal.values[k]==='string'?proposal.values[k].slice(0,4000):'']));
   const card=document.createElement('article');card.className='business-card proposal-card';
   const h=document.createElement('h3');h.textContent='Onay bekleyen '+({appointment:'randevu',contact:'müşteri',task:'görev'})[proposal.type];
   const p=document.createElement('p');p.textContent=values.title||values.name;
   const note=document.createElement('p');note.className='fine-print';note.textContent='Henüz kaydedilmedi. Bilgileri kontrol etmen gerekir.';
   const button=document.createElement('button');button.type='button';button.className='btn primary';button.textContent='İncele ve kaydet';button.onclick=()=>{chatDialog.close();navigate(page);editor(page,null,values);};
   card.append(h,p,note,button);el('#chatMessages').append(card);
  }
 });
 // Public site interactions do not call AI or collect visitor contact details.
 const demos={assistant:{title:'İşletme bilgin, yanıtın temeli.',lines:[['İşletme bilgisi','Çalışma saatleri & hizmetler'],['Bilgi bankası','Kendi metinlerini ekle'],['Asistan görevi','Sen tanımla, test et']]},inbox:{title:'Her konuşma bıraktığın yerde.',lines:[['Görüşme geçmişi','Hesabında saklanır'],['Mesaj dökümü','Oku, indir, devam et'],['Erişim','Yalnızca kendi kayıtların']]},plan:{title:'Konuşmadan sonraki adım.',lines:[['Müşteri kaydı','Notlar & satış aşaması'],['Randevu','Saat çakışması kontrolü'],['Takip görevi','Açık → Tamamlandı']]}};
 function showDemo(id){const d=demos[id];all('[data-demo]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.demo===id)));el('#demo-panel').setAttribute('aria-labelledby','demo-tab-'+id);el('#demo-panel').innerHTML=`<h3 class="demo-heading">${d.title}</h3>${d.lines.map(([k,v])=>`<div class="demo-line"><span>${k}</span><strong>${v}</strong></div>`).join('')}<p class="demo-note">Ürün akışını açıklayan örnek görünüm. Kişisel veya gerçek müşteri verisi içermez.</p>`;}
 all('[data-demo]').forEach(b=>{b.onclick=()=>showDemo(b.dataset.demo);b.onkeydown=e=>{const ids=Object.keys(demos),i=ids.indexOf(b.dataset.demo);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;showDemo(ids[next]);el('#demo-tab-'+ids[next]).focus();}};});showDemo('assistant');
 const scenarioTexts={service:'Önerilen başlangıç: hizmetlerini bilgi bankasına ekle → destek asistanını test et → randevu ve takip görevlerini oluştur.',property:'Önerilen başlangıç: portföy bilgilerini ekle → müşteri taleplerini kaydet → görüşme randevularını ve geri dönüşleri takip et.',shop:'Önerilen başlangıç: ürün ve teslimat bilgilerini ekle → soruları asistanla test et → müşteri notlarını ve içerik taslaklarını düzenle.'};
 function showScenario(id){all('[data-scenario]').forEach(b=>{b.classList.toggle('selected',b.dataset.scenario===id);b.setAttribute('aria-pressed',String(b.dataset.scenario===id));});el('#scenarioResult').textContent=scenarioTexts[id];}all('[data-scenario]').forEach(b=>b.onclick=()=>showScenario(b.dataset.scenario));showScenario('service');
 const back=document.createElement('button');back.type='button';back.className='auth-secondary auth-back';back.textContent='← Ana sayfaya dön';el('.auth-card').append(back);back.onclick=()=>{window.aivoraAuthRequested=false;el('#authOverlay').hidden=true;};
 const openAuth=()=>{if(state.uid){document.body.classList.add('workspace-visible');navigate('overview');}else{window.aivoraAuthRequested=true;el('#authOverlay').hidden=false;el('#authEmail').focus();}};all('[data-auth]').forEach(b=>b.onclick=openAuth);
 const home=document.createElement('button');home.className='workspace-home';home.textContent='Ana sayfa ↗';el('.topbar').append(home);home.onclick=()=>{document.body.classList.remove('workspace-visible');history.replaceState(null,'',location.pathname+'#home');window.scrollTo({top:0,behavior:'smooth'});};
 const chatInfo=document.createElement('p');chatInfo.className='fine-print';chatInfo.textContent='Web AI sohbeti · Mesajların hesabındaki Gelen Kutusu’na kaydedilir. Yanıt için AI sağlayıcısıyla işlenir.';el('#chatAgentTitle').after(chatInfo);
 const voice=document.createElement('button');voice.type='button';voice.id='businessVoiceToggle';voice.textContent='◖ Yanıtı sesli dinle';el('#closeChat').before(voice);voice.onclick=()=>{if(!('speechSynthesis'in window)){showToast('Tarayıcın sesli okumayı desteklemiyor.');return;}if(speechSynthesis.speaking){speechSynthesis.cancel();return;}const text=[...el('#chatMessages').querySelectorAll('p')].filter(p=>p.textContent.startsWith('Aivora: ')).at(-1)?.textContent.replace(/^Aivora: /,'');if(!text)return;const u=new SpeechSynthesisUtterance(text);u.lang='tr-TR';u.rate=1;u.onerror=()=>showToast('Sesli okuma başlatılamadı.');speechSynthesis.speak(u);};el('#aivoraChat').addEventListener('close',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();});
 const originalLoadAgents=loadAgents;loadAgents=async function(){await originalLoadAgents();if(state.uid&&el('#page-agents').classList.contains('active'))agentTools();};
 let signedInOnce=false;
 async function sessionChange(session){const id=session?.user?.id||null;if(id===state.uid&&signedInOnce)return;signedInOnce=true;state.uid=id;state.epoch++;chatGeneration++;chatDialog.close();el('#chatMessages').replaceChildren();state.rows=[];state.selected=null;edit.close();all('[id^=page-]').filter(p=>titles[p.id.slice(5)]||tableNames[p.id.slice(5)]).forEach(p=>p.replaceChildren());if(id){window.aivoraAuthRequested=false;el('#authOverlay').hidden=true;document.body.classList.add('workspace-visible');const active=el('.page.active')?.id.slice(5)||'overview';state.page=active;await loadPage(active);}else{document.body.classList.remove('workspace-visible');el('#authOverlay').hidden=!window.aivoraAuthRequested;}}
 if(db){db.auth.getSession().then(({data})=>sessionChange(data.session));db.auth.onAuthStateChange((_e,s)=>setTimeout(()=>sessionChange(s),0));}
 window.addEventListener('aivora:conversation',()=>{if(state.page==='calls'&&state.uid)loadPage('calls');});
})();
