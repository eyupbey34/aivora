const SUPABASE_URL = "https://pdvovstitmkjkmgqfjwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_jkogisJn4fhHZAm2rYAcRA_p8VJuPuC";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const pages = {overview:"Genel Bakış",agents:"AI Asistanlar",calls:"Görüşmeler",contacts:"Müşteriler",wallet:"AI Kullanımı",settings:"Ayarlar"};
const isRecoveryLink = new URLSearchParams(location.hash.slice(1)).get("type") === "recovery";
const db = window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
let user = null, agents = [], demoBalance = 0;
const money = n => n.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺";
function showToast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
function navigate(page){$$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));$$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#crumb').textContent=pages[page]||'Genel Bakış';$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
$$('.nav-link').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
$('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('.notice-close').addEventListener('click',()=>$('.notice').remove());
const dialog=$('#agentDialog');
function openDialog(){if(!user){showToast('Önce giriş yap.');return}dialog.showModal();$('#agentName').focus()}
$('#newAgentBtn').addEventListener('click',openDialog);
$('#closeDialog').addEventListener('click',()=>dialog.close());
$('#cancelDialog').addEventListener('click',()=>dialog.close());
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderAgents(){const list=$('#agentList');$('#agentCount').textContent=`${agents.length} asistan`;$('#statAgents').textContent=agents.length;if(!agents.length){list.innerHTML='<div class="empty-state"><div class="empty-orb">✧</div><strong>Henüz asistan oluşturmadın</strong><p>İlk asistanını oluşturarak başlayabilirsin.</p><button class="btn secondary" id="emptyCreateBtn">Asistan oluştur</button></div>';$('#emptyCreateBtn').addEventListener('click',openDialog);return}list.innerHTML=agents.map(a=>`<button type="button" class="agent-item agent-open" data-agent-id="${escapeHtml(a.id)}" aria-label="${escapeHtml(a.name)} ile sohbet aç"><div class="agent-glyph">✧</div><div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.type)}${a.instructions?' · '+escapeHtml(a.instructions):''}</small></div><span class="pill muted-pill">Sohbet aç →</span></button>`).join('');list.querySelectorAll('[data-agent-id]').forEach(b=>b.addEventListener('click',()=>openAgentChat(b.dataset.agentId)))}
async function loadAgents(){if(!user)return;const {data,error}=await db.from('assistants').select('id,name,type,instructions,created_at').eq('user_id',user.id).order('created_at',{ascending:false});if(error){showToast('Asistanlar yüklenemedi: '+error.message);return}agents=data||[];renderAgents()}
$('#agentForm').addEventListener('submit',async e=>{e.preventDefault();if(!user)return;const name=$('#agentName').value.trim();if(!name)return;const button=$('#saveAgentBtn');button.disabled=true;try{const {error}=await db.from('assistants').insert({user_id:user.id,name,type:$('#agentType').value,instructions:$('#agentGoal').value.trim()});if(error)throw error;await loadAgents();dialog.close();e.target.reset();showToast('Asistan Supabase’e kaydedildi.')}catch(err){showToast('Kayıt başarısız: '+err.message)}finally{button.disabled=false}});
function renderBalance(){$('#statBalance').textContent=money(demoBalance);$('#walletBalance').textContent=money(demoBalance)}
$('#addDemoBalance').addEventListener('click',()=>{if(!user)return;demoBalance+=100;localStorage.setItem('aivora_demo_balance_'+user.id,String(demoBalance));renderBalance();showToast('100 ₺ demo bakiye eklendi.')});
function authMessage(message){$('#authMessage').textContent=message}
function authBusy(value){$('#loginBtn').disabled=value;$('#signupBtn').disabled=value}
$('#authForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return authMessage('Supabase kütüphanesi yüklenemedi.');authBusy(true);authMessage('Giriş yapılıyor...');try{const {error}=await db.auth.signInWithPassword({email:$('#authEmail').value.trim(),password:$('#authPassword').value});if(error)throw error;authMessage('')}catch(err){authMessage(authError(err))}finally{authBusy(false)}});
$('#signupBtn').addEventListener('click',async()=>{if(!$('#authForm').reportValidity())return;if(!db)return authMessage('Supabase kütüphanesi yüklenemedi.');authBusy(true);authMessage('Hesap oluşturuluyor...');try{const {data,error}=await db.auth.signUp({email:$('#authEmail').value.trim(),password:$('#authPassword').value,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;authMessage(data.session?'Hesabın oluşturuldu.':'E-postana gelen doğrulama bağlantısını aç, ardından giriş yap.')}catch(err){authMessage(authError(err))}finally{authBusy(false)}});
$('#logoutBtn').addEventListener('click',async()=>{if(!db)return;const {error}=await db.auth.signOut();if(error)showToast(error.message)});
async function applySession(session){const nextUser=session?.user||null;if(nextUser?.id===user?.id && $("#authOverlay").hidden===!!nextUser)return;user=nextUser;agents=[];renderAgents();$('#authOverlay').hidden=!!user||!window.aivoraAuthRequested;$('#accountEmail').textContent=user?.email||'Giriş yapılmadı';demoBalance=user?Number(localStorage.getItem('aivora_demo_balance_'+user.id)||0):0;renderBalance();if(user)await loadAgents()}
async function init(){if(!db){authMessage('Supabase yüklenemedi. İnternet bağlantını kontrol et.');return}const {data,error}=await db.auth.getSession();if(error)authMessage(error.message);await applySession(data?.session);db.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>applySession(session),0)})}
renderAgents();renderBalance();init();

// Sohbet: OpenAI anahtarı yalnızca Supabase Edge Function secrets içinde tutulur.
let selectedAgent=null;
let chatHistory=[];
let conversationId=null;
let chatGeneration=0;
const chatDialog=$('#aivoraChat');
function appendChat(role,content){const el=document.createElement('p');el.style.cssText='padding:10px 12px;border-radius:12px;margin:8px 0;background:'+(role==='user'?'#47318d':'#1f2941')+';white-space:pre-wrap;overflow-wrap:anywhere';el.textContent=(role==='user'?'Sen: ':'Aivora: ')+content;$('#chatMessages').append(el);$('#chatMessages').scrollTop=$('#chatMessages').scrollHeight;return el}
function openAgentChat(id){selectedAgent=agents.find(a=>String(a.id)===String(id));if(!selectedAgent)return;chatGeneration++;$('#chatInput').disabled=false;$('#chatForm button[type=submit]').disabled=false;chatHistory=[];conversationId=null;$('#chatAgentTitle').textContent='✨ '+selectedAgent.name;$('#chatMessages').replaceChildren();appendChat('assistant','Merhaba! Mesajını yazabilirsin. Sana nasıl yardımcı olabilirim?');chatDialog.showModal();$('#chatInput').focus()}
$('#closeChat').addEventListener('click',()=>chatDialog.close());
$('#chatForm').addEventListener('submit',async e=>{e.preventDefault();if(!selectedAgent||!user)return;const input=$('#chatInput');const message=input.value.trim();if(!message)return;const chatEpoch=chatGeneration;input.value='';appendChat('user',message);const pending=appendChat('assistant','Yanıt bekleniyor...');input.disabled=true;const btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;try{const {data,error}=await db.functions.invoke('aivora-ai-',{body:{agentId:selectedAgent.id,conversationId,proposeActions:true,messages:[...chatHistory.slice(-20),{role:'user',content:message}]}});if(error)throw error;if(chatEpoch!==chatGeneration)return;if(!data?.reply)throw Error(data?.error||'Sunucudan yanıt gelmedi.');conversationId=data.conversationId||conversationId;if(data.historySaved===false)showToast('Yanıt geldi ancak geçmiş kaydedilemedi.');pending.textContent='Aivora: '+data.reply;chatHistory.push({role:'user',content:message},{role:'assistant',content:data.reply});if(data.proposedActions?.length)window.dispatchEvent(new CustomEvent('aivora:actions',{detail:data.proposedActions}))}catch(err){if(chatEpoch!==chatGeneration)return;let message='Yanıt alınamadı. Lütfen tekrar dene.';try{const body=await err.context?.json();if(body?.error)message=body.error}catch{}pending.textContent='Aivora: '+message;}finally{if(chatEpoch===chatGeneration){btn.disabled=false;input.disabled=false;input.focus();}window.dispatchEvent(new Event("aivora:usage"));window.dispatchEvent(new Event("aivora:conversation"))}});
function authError(err){const m=err?.message||'Beklenmeyen bir hata oluştu.';if(/invalid login credentials/i.test(m))return 'E-posta veya şifre yanlış. Bilgilerini kontrol et.';if(/email not confirmed/i.test(m))return 'Giriş için e-postana gelen doğrulama bağlantısını aç.';if(/already registered/i.test(m))return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';if(/rate limit|too many/i.test(m))return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';if(/fetch|network/i.test(m))return 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.';return m;}

// Hesap kurtarma: bağlantı e-postayla gider, yeni şifre yalnızca kullanıcı tarafından girilir.
const forgotButton = document.createElement('button');
forgotButton.type = 'button';
forgotButton.className = 'auth-secondary';
forgotButton.textContent = 'Şifremi unuttum';
$('#signupBtn').after(forgotButton);
$('#authMessage').setAttribute('role', 'status');
forgotButton.addEventListener('click', async () => {
  const email = $('#authEmail');
  if (!email.reportValidity() || !db) return;
  forgotButton.disabled = true;
  authBusy(true);
  try {
    const { error } = await db.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname });
    if (error) throw error;
    authMessage('Hesabın kayıtlıysa şifre yenileme bağlantısı e-postana gönderildi. Spam klasörünü de kontrol et.');
  } catch (error) { authMessage(authError(error)); }
  finally { forgotButton.disabled = false; authBusy(false); }
});
const passwordDialog = document.createElement('dialog');
passwordDialog.className = 'modal';
passwordDialog.setAttribute('aria-labelledby', 'passwordTitle');
passwordDialog.innerHTML = '<h2 id="passwordTitle">Şifreni yenile</h2><p>Yeni şifreni aşağıya yaz.</p><form id="passwordForm"><label for="newPassword">Yeni şifre (en az 6 karakter)</label><input id="newPassword" type="password" autocomplete="new-password" minlength="6" required><label for="confirmPassword">Yeni şifre tekrar</label><input id="confirmPassword" type="password" autocomplete="new-password" minlength="6" required><p id="passwordMessage" role="status"></p><div class="modal-actions"><button type="button" class="btn secondary" id="cancelPassword">Vazgeç</button><button type="submit" class="btn primary" id="savePassword">Şifreyi kaydet</button></div></form>';
document.body.append(passwordDialog);
function showPasswordDialog() {
  if (!passwordDialog.open) { $('#passwordForm').reset(); $('#passwordMessage').textContent = ''; passwordDialog.showModal(); $('#newPassword').focus(); }
}
$('#cancelPassword').addEventListener('click', () => passwordDialog.close());
$('#passwordForm').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('#newPassword').value !== $('#confirmPassword').value) { $('#passwordMessage').textContent = 'Şifreler eşleşmiyor.'; return; }
  $('#savePassword').disabled = true;
  $('#cancelPassword').disabled = true;
  try {
    if (!db) throw Error('Bağlantı kurulamadı.');
    const { error } = await db.auth.updateUser({ password: $('#newPassword').value });
    if (error) throw error;
    $('#passwordForm').reset();
    passwordDialog.close();
    showToast('Şifren güncellendi.');
  } catch (error) { $('#passwordMessage').textContent = authError(error); }
  finally { $('#savePassword').disabled = false; $('#cancelPassword').disabled = false; }
});
if (db) {
  db.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setTimeout(showPasswordDialog, 0); });
  if (isRecoveryLink) db.auth.getSession().then(({ data, error }) => { if (!error && data.session) showPasswordDialog(); else authMessage('Yenileme bağlantısı geçersiz veya süresi dolmuş. Yeni bağlantı iste.'); });
}
const passwordSettingsButton = document.createElement('button');
passwordSettingsButton.type = 'button';
passwordSettingsButton.className = 'btn secondary';
passwordSettingsButton.textContent = 'Şifremi değiştir';
passwordSettingsButton.addEventListener('click', () => { if (user) showPasswordDialog(); });
$('#page-settings').append(passwordSettingsButton);
$('#chatInput').maxLength = 4000;
