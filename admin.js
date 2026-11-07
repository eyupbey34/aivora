'use strict';
(() => {
 const el=s=>document.querySelector(s);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=n=>Number(n||0).toLocaleString('tr-TR');
 const usd=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:6}).format(Number(n||0));
 const date=x=>x?new Date(x).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'—';
 const state={actor:null,admin:false,plans:[],settings:null,tab:'summary',offset:0,total:0,search:'',users:[],agents:[],busy:false};
 let generation=0;
 pages.admin='Yönetim Paneli';
 const root=el('#page-admin');
 root.innerHTML=`<div class="admin-hero"><div><p class="eyebrow">AIVORA YÖNETİMİ</p><h1>Yönetim merkezi</h1><p class="muted">Üyeler, AI erişimi ve kullanım tek yerde.</p></div><div class="admin-hero-actions"><span class="pill">Yönetici</span><button class="btn secondary" id="adminRefresh">↻ Yenile</button></div></div><p id="adminMessage" class="admin-message" role="status"></p><div id="adminMetrics" class="admin-metrics"></div><nav class="admin-tabs" aria-label="Yönetim bölümleri">${[['summary','Özet'],['users','Kullanıcılar'],['assistants','Asistanlar'],['activity','Kullanım ve hatalar'],['plans','Paketler'],['settings','Sistem']].map(([id,title])=>`<button type="button" data-admin-tab="${id}" aria-pressed="${id==='summary'}">${title}</button>`).join('')}</nav><div id="adminBody"></div><p class="fine-print" id="adminTracking"></p>`;
 const modal=document.createElement('dialog');modal.id='adminEditDialog';modal.className='modal';modal.setAttribute('aria-labelledby','adminEditTitle');document.body.append(modal);
 const usage=document.createElement('article');usage.className='panel';usage.id='liveUsage';usage.hidden=true;el('#page-wallet').prepend(usage);
 async function call(action,extra={}) {
  if(!db)throw Error('Bağlantı kurulamadı.');
  const {data,error}=await db.functions.invoke('aivora-admin',{body:{action,...extra}});
  if(error){let message='Yönetim servisine ulaşılamadı.';try{const b=await error.context?.json();if(b?.error)message=b.error;}catch{}throw Error(message);}
  if(data?.error)throw Error(data.error);return data;
 }
 const message=(text,bad=false)=>{el('#adminMessage').textContent=text;el('#adminMessage').classList.toggle('error',bad);};
 function usageCard(u){usage.hidden=false;usage.innerHTML=`<div class="panel-title"><div><p class="eyebrow">GERÇEK AI KULLANIMI</p><h2>${esc(u.plan)} paketi</h2></div><span class="pill ${u.blocked||!u.chat_enabled?'warning':''}">${u.blocked?'AI erişimi durduruldu':!u.chat_enabled?'Bakımda':'Aktif'}</span></div><strong class="usage-value">${number(u.used)} / ${number(u.limit)} mesaj</strong><progress max="${Math.max(1,u.limit)}" value="${Math.min(u.used,u.limit)}"></progress><p class="muted">Aylık haklar Türkiye saatine göre ay başında yenilenir. Başarısız istekler mesaj hakkından düşmez.</p>`;}
 async function sessionChanged(session){
  const id=session?.user?.id||null;if(id===state.actor)return;
  const epoch=++generation;state.actor=id;state.admin=false;state.users=[];state.agents=[];state.offset=0;state.search='';state.tab='summary';
  el('#adminNav').hidden=true;usage.hidden=true;el('#adminMetrics').replaceChildren();el('#adminBody').replaceChildren();modal.close();
  if(el('#page-admin').classList.contains('active'))navigate('overview');
  if(!id)return;
  try{const d=await call('status');if(epoch!==generation)return;state.admin=d.is_admin;el('#adminNav').hidden=!d.is_admin;usageCard(d.usage);
   if(d.is_admin){await refresh();if(epoch===generation&&location.hash==='#admin')navigate('admin');}
  }catch(e){if(epoch===generation)showToast(e.message);}
 }
 async function refresh(){
  if(!state.admin)return;const epoch=generation;message('Güncel veriler yükleniyor…');el('#adminRefresh').disabled=true;
  try{const d=await call('dashboard');if(epoch!==generation)return;state.plans=d.plans;state.settings=d.settings;
   const m=d.metrics;el('#adminMetrics').innerHTML=[['Kullanıcı',m.users,'Toplam kayıt'],['AI asistanı',m.assistants,'Oluşturulan asistanlar'],['Başarılı mesaj',m.month_messages,'Bu ay'],['Token kullanımı',m.month_tokens,'Bu ay · giriş + çıkış'],['Tahmini API maliyeti',usd(m.month_cost),'Bu ay · USD'],['Hatalı istek',m.day_errors,'Son 24 saat']].map(([label,value,note])=>`<article class="stat-card"><div class="stat-head">${label}</div><strong>${typeof value==='number'?number(value):esc(value)}</strong><small>${note}</small></article>`).join('');
   el('#adminTracking').textContent='Takip başlangıcı: '+date(d.settings.tracking_started_at)+'. Önceki kullanım dahil değildir. Maliyetler kayıt anındaki birim fiyatlarla tahmin edilir; OpenAI faturası değildir.';
   state.daily=m.daily;message('Son güncelleme: '+date(d.server_time));await renderTab();
  }catch(e){if(epoch===generation)message(e.message,true);}finally{el('#adminRefresh').disabled=false;}
 }
 function tabs(){root.querySelectorAll('[data-admin-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adminTab===state.tab)));}
 const table=(headers,rows,empty)=>`<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="admin-empty">${empty}</td></tr>`}</tbody></table></div>`;
 const pager=(hasNext)=>`<div class="admin-pager"><button class="btn secondary" data-page-step="-1" ${state.offset===0?'disabled':''}>← Önceki</button><span>Sayfa ${Math.floor(state.offset/30)+1}${state.tab==='users'?' · '+number(state.total)+' kullanıcı':''}</span><button class="btn secondary" data-page-step="1" ${!hasNext?'disabled':''}>Sonraki →</button></div>`;
 async function renderTab(){
  if(!state.admin)return;tabs();const epoch=generation;const tab=state.tab;const body=el('#adminBody');body.innerHTML='<div class="panel admin-empty" role="status">Yükleniyor…</div>';
  try{
   if(tab==='summary'){
    const max=Math.max(1,...(state.daily||[]).map(d=>Number(d.messages)));body.innerHTML=`<article class="panel"><div class="panel-title"><div><h2>Son 7 gün</h2><p class="muted">Başarılı AI mesajları · Türkiye saati</p></div><span class="pill ${state.settings.chat_enabled?'':'warning'}">${state.settings.chat_enabled?'AI sohbeti açık':'AI sohbeti bakımda'}</span></div>${state.daily?.length?`<div class="admin-chart">${state.daily.map(d=>`<div class="admin-chart-row"><time>${esc(d.day)}</time><div class="admin-chart-track"><div style="width:${Number(d.messages)/max*100}%"></div></div><strong>${number(d.messages)}</strong></div>`).join('')}</div>`:'<div class="admin-empty">Henüz kayıtlı kullanım yok. İlk sohbetten sonra veriler burada görünür.</div>'}</article><div class="content-grid"><article class="panel"><h2>Erişim yönetimi</h2><p class="muted">Kullanıcılar bölümünden paket, aylık hak ve AI erişimini düzenle. Bu ayarı değiştirmek kullanıcının hesabını veya verilerini silmez.</p><button class="btn secondary" data-jump="users">Kullanıcıları yönet →</button></article><article class="panel"><h2>Güvenlik ve gizlilik</h2><p class="muted">Yönetim yetkisi her istekte sunucuda doğrulanır. Kullanım kaydında mesaj içerikleri tutulmaz. Yönetim değişiklikleri işlem günlüğüne yazılır.</p><button class="btn secondary" data-jump="activity">İşlem günlüğü →</button></article></div>`;
   }else if(tab==='users'){
    const d=await call('users',{search:state.search,offset:state.offset});if(epoch!==generation||tab!==state.tab)return;state.users=d.users;state.total=Number(d.total);
    body.innerHTML=`<form id="adminSearch" class="admin-search"><label for="adminSearchInput">E-posta ile ara</label><div><input id="adminSearchInput" type="search" maxlength="100" value="${esc(state.search)}" placeholder="E-posta adresi"><button class="btn secondary">Ara</button></div></form><article class="panel">${table(['Kullanıcı','Paket / bu ay','AI erişimi','İşlem'],d.users.map(u=>`<tr><td><strong>${esc(u.email)}</strong><small>${u.is_admin?'Yönetici · ':''}${u.confirmed?'Doğrulanmış':'E-posta doğrulaması bekleniyor'}</small><small>Son giriş: ${date(u.last_sign_in_at)}</small></td><td>${esc(state.plans.find(p=>p.id===u.plan_id)?.name||u.plan_id)}<small>${number(u.month_messages)} / ${number(u.limit_override??state.plans.find(p=>p.id===u.plan_id)?.monthly_limit)} mesaj · ${number(u.assistant_count)} asistan</small></td><td><span class="pill ${u.blocked?'warning':''}">${u.blocked?'Durduruldu':'Açık'}</span></td><td><button class="btn secondary" data-edit-user="${esc(u.id)}">Düzenle</button></td></tr>`),'Kullanıcı bulunamadı.')}${pager(state.offset+30<state.total)}</article>`;
   }else if(tab==='assistants'){
    const d=await call('assistants',{offset:state.offset});if(epoch!==generation||tab!==state.tab)return;state.agents=d.items;
    body.innerHTML=`<article class="panel">${table(['Asistan','Sahip','AI erişimi','İşlem'],d.items.map(a=>`<tr><td><strong>${esc(a.name)}</strong><small>${esc(a.type)} · ${date(a.created_at)}</small></td><td><code title="${esc(a.user_id)}">${esc(a.user_id)}</code></td><td><span class="pill ${a.blocked?'warning':''}">${a.blocked?'Durduruldu':'Açık'}</span></td><td><button class="btn secondary" data-edit-agent="${esc(a.id)}">${a.blocked?'Erişimi aç':'Durdur'}</button></td></tr>`),'Henüz asistan bulunmuyor.')}${pager(d.items.length===30)}</article>`;
   }else if(tab==='activity'){
    const d=await call('activity',{offset:state.offset});if(epoch!==generation||tab!==state.tab)return;
    body.innerHTML=`<article class="panel"><h2>AI istekleri</h2><p class="muted">Bu kullanım günlüğünde mesaj içeriği tutulmaz. Sohbet dökümleri kullanıcıların kendi Gelen Kutusu’nda saklanır. İşleniyor durumu 2 dakikadan eskiyse istek tamamlanamamış olabilir.</p>${table(['Zaman / kullanıcı','Durum','Token','Tahmini USD'],d.events.map(e=>`<tr><td>${date(e.created_at)}<small>${esc(e.user_id)}</small></td><td><span class="pill ${e.status==='error'?'warning':''}">${({success:'Başarılı',error:'Hata',pending:'İşleniyor'})[e.status]}</span><small>${esc(e.error_code||'')}</small></td><td>${number(e.input_tokens)} giriş<small>${number(e.output_tokens)} çıkış</small></td><td>${usd(e.estimated_cost_usd)}</td></tr>`),'Henüz AI istek kaydı yok.')}${pager(d.events.length===30)}</article><article class="panel"><h2>Son yönetim işlemleri</h2>${table(['Zaman','İşlem','Hedef'],d.audit.map(a=>`<tr><td>${date(a.created_at)}</td><td>${esc(({account:'Kullanıcı güncellendi',assistant:'Asistan erişimi',plan:'Paket güncellendi',settings:'Sistem ayarı'})[a.action]||a.action)}</td><td><code>${esc(a.target_id||'Platform')}</code></td></tr>`),'Henüz yönetim işlemi yok.')}</article>`;
   }else if(tab==='plans'){
    body.innerHTML=`<div class="admin-plan-grid">${state.plans.map(p=>`<form class="panel admin-plan-form" data-plan-id="${esc(p.id)}"><span class="pill">${esc(p.id)}</span><label>Paket adı<input name="name" required maxlength="60" value="${esc(p.name)}"></label><label>Aylık mesaj hakkı<input name="monthly_limit" type="number" min="0" max="1000000" step="1" required value="${p.monthly_limit}"></label><p class="fine-print">Bu paketteki, özel limiti olmayan kullanıcılar için geçerlidir. Ödeme veya abonelik tahsilatı başlatmaz.</p><button class="btn primary">Paketi kaydet</button></form>`).join('')}</div>`;
   }else if(tab==='settings'){
    const s=state.settings;body.innerHTML=`<form id="adminSettings" class="panel admin-settings"><h2>Platform ayarları</h2><label class="admin-switch"><input name="chat_enabled" type="checkbox" ${s.chat_enabled?'checked':''}> AI sohbeti açık</label><p class="muted">Kapattığında yeni AI istekleri durur. Başlamış yanıtlar tamamlanabilir.</p><h2>API maliyet hesabı</h2><p class="muted">gpt-4.1-mini · 1 milyon token başına USD. Bu alanlar yalnızca yeni kullanım kayıtlarının tahminini etkiler.</p>${[['input_rate','Giriş'],['cached_rate','Önbellekli giriş'],['output_rate','Çıkış']].map(([key,label])=>`<label>${label}<input name="${key}" type="number" min="0" max="1000" step="0.0001" required value="${s[key]}"></label>`).join('')}<p class="fine-print">Başlangıç fiyatları: giriş $0,40, önbellek $0,10, çıkış $1,60 / milyon token. Vergi ve diğer servis ücretleri dahil değildir. Sağlayıcının güncel fiyatını esas al.</p><button class="btn primary">Ayarları kaydet</button></form>`;
   }
  }catch(e){if(epoch===generation&&tab===state.tab){body.innerHTML='<div class="panel admin-empty">Veriler yüklenemedi. Yenile düğmesiyle tekrar dene.</div>';message(e.message,true);}}
 }
 function switchTab(tab){state.tab=tab;state.offset=0;renderTab();}
 root.addEventListener('click',e=>{
  const tab=e.target.closest('[data-admin-tab],[data-jump]');if(tab){switchTab(tab.dataset.adminTab||tab.dataset.jump);return;}
  const step=e.target.closest('[data-page-step]');if(step){state.offset=Math.max(0,state.offset+Number(step.dataset.pageStep)*30);renderTab();return;}
  const u=e.target.closest('[data-edit-user]');if(u){editUser(state.users.find(x=>x.id===u.dataset.editUser));return;}
  const a=e.target.closest('[data-edit-agent]');if(a){editAgent(state.agents.find(x=>x.id===a.dataset.editAgent));}
 });
 function editUser(u){if(!u)return;modal.innerHTML=`<h2 id="adminEditTitle">Kullanıcıyı düzenle</h2><p class="muted">${esc(u.email)}</p><form id="adminUserEdit"><label for="adminPlan">Paket</label><select id="adminPlan" name="plan_id">${state.plans.map(p=>`<option value="${esc(p.id)}" ${p.id===u.plan_id?'selected':''}>${esc(p.name)} · ${number(p.monthly_limit)} mesaj</option>`).join('')}</select><label for="adminOverride">Özel aylık limit (boşsa paket limiti)</label><input id="adminOverride" name="limit_override" type="number" min="0" max="1000000" step="1" value="${u.limit_override??''}"><label class="admin-switch"><input name="blocked" type="checkbox" ${u.blocked?'checked':''} ${u.is_admin?'disabled':''}> AI erişimini durdur</label><p class="fine-print">Giriş ve kayıtlar korunur. Yalnızca yeni AI mesajları engellenir. Yönetici hesabı durdurulamaz.</p><p id="adminEditError" role="status"></p><div class="modal-actions"><button class="btn secondary" type="button" data-close-admin>Vazgeç</button><button class="btn primary">Kaydet</button></div></form>`;modal.showModal();el('#adminUserEdit').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const v=String(f.get('limit_override'));saveChange('account',u.id,{plan_id:f.get('plan_id'),limit_override:v===''?null:Number(v),blocked:f.has('blocked')},e.target,true);});}
 function editAgent(a){if(!a)return;modal.innerHTML=`<h2 id="adminEditTitle">${a.blocked?'AI erişimini aç':'AI erişimini durdur'}</h2><p>${esc(a.name)}</p><p class="muted">Asistan kaydı silinmez. Yeni sohbet istekleri ${a.blocked?'yeniden kabul edilir':'engellenir'}.</p><p id="adminEditError" role="status"></p><div class="modal-actions"><button type="button" class="btn secondary" data-close-admin>Vazgeç</button><button type="button" id="adminAgentConfirm" class="btn primary">Onayla</button></div>`;modal.showModal();el('#adminAgentConfirm').onclick=()=>saveChange('assistant',a.id,{blocked:!a.blocked},modal,true);}
 modal.addEventListener('click',e=>{if(e.target.closest('[data-close-admin]'))modal.close();});
 async function saveChange(action,target,changes,form,close=false){
  if(state.busy)return;state.busy=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{await call(action,{target,changes});if(close)modal.close();showToast('Değişiklik kaydedildi.');await refresh();const me=await call('status');usageCard(me.usage);}catch(e){if(close)el('#adminEditError').textContent=e.message;else message(e.message,true);}finally{state.busy=false;buttons.forEach(b=>b.disabled=false);}
 }
 root.addEventListener('submit',e=>{
  if(e.target.id==='adminSearch'){e.preventDefault();state.search=el('#adminSearchInput').value.trim();state.offset=0;renderTab();}
  if(e.target.matches('.admin-plan-form')){e.preventDefault();const f=new FormData(e.target);saveChange('plan',e.target.dataset.planId,{name:String(f.get('name')).trim(),monthly_limit:Number(f.get('monthly_limit'))},e.target);}
  if(e.target.id==='adminSettings'){e.preventDefault();const f=new FormData(e.target);saveChange('settings',null,{chat_enabled:f.has('chat_enabled'),input_rate:Number(f.get('input_rate')),cached_rate:Number(f.get('cached_rate')),output_rate:Number(f.get('output_rate'))},e.target);}
 });
 el('#adminRefresh').addEventListener('click',refresh);
 el('#adminNav').addEventListener('click',()=>{if(state.admin){history.replaceState(null,'','#admin');navigate('admin');refresh();}});
 window.addEventListener('aivora:usage',async()=>{const epoch=generation;if(state.actor){try{const d=await call('status');if(epoch===generation)usageCard(d.usage);}catch{}}});
 if(db){db.auth.getSession().then(({data})=>sessionChanged(data.session));db.auth.onAuthStateChange((event,session)=>{setTimeout(()=>sessionChanged(session),0);});}
})();
