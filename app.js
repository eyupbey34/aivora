const SUPABASE_URL = "https://pdvovstitmkjkmgqfjwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_jkogisJn4fhHZAm2rYAcRA_p8VJuPuC";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const pages = {overview:"Genel Bakış",agents:"AI Asistanlar",calls:"Görüşmeler",contacts:"Müşteriler",wallet:"Bakiye & Kullanım",settings:"Ayarlar"};
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
function renderAgents(){const list=$('#agentList');$('#agentCount').textContent=`${agents.length} asistan`;$('#statAgents').textContent=agents.length;if(!agents.length){list.innerHTML='<div class="empty-state"><div class="empty-orb">✧</div><strong>Henüz asistan oluşturmadın</strong><p>İlk asistanını oluşturarak başlayabilirsin.</p><button class="btn secondary" id="emptyCreateBtn">Asistan oluştur</button></div>';$('#emptyCreateBtn').addEventListener('click',openDialog);return}list.innerHTML=agents.map(a=>`<div class="agent-item"><div class="agent-glyph">✧</div><div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.type)}${a.instructions?' · '+escapeHtml(a.instructions):''}</small></div><span class="pill muted-pill">Kayıtlı</span></div>`).join('')}
async function loadAgents(){if(!user)return;const {data,error}=await db.from('assistants').select('id,name,type,instructions,created_at').eq('user_id',user.id).order('created_at',{ascending:false});if(error){showToast('Asistanlar yüklenemedi: '+error.message);return}agents=data||[];renderAgents()}
$('#agentForm').addEventListener('submit',async e=>{e.preventDefault();if(!user)return;const name=$('#agentName').value.trim();if(!name)return;const button=$('#saveAgentBtn');button.disabled=true;try{const {error}=await db.from('assistants').insert({user_id:user.id,name,type:$('#agentType').value,instructions:$('#agentGoal').value.trim()});if(error)throw error;await loadAgents();dialog.close();e.target.reset();showToast('Asistan Supabase’e kaydedildi.')}catch(err){showToast('Kayıt başarısız: '+err.message)}finally{button.disabled=false}});
function renderBalance(){$('#statBalance').textContent=money(demoBalance);$('#walletBalance').textContent=money(demoBalance)}
$('#addDemoBalance').addEventListener('click',()=>{if(!user)return;demoBalance+=100;localStorage.setItem('aivora_demo_balance_'+user.id,String(demoBalance));renderBalance();showToast('100 ₺ demo bakiye eklendi.')});
function authMessage(message){$('#authMessage').textContent=message}
function authBusy(value){$('#loginBtn').disabled=value;$('#signupBtn').disabled=value}
$('#authForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return authMessage('Supabase kütüphanesi yüklenemedi.');authBusy(true);authMessage('Giriş yapılıyor...');try{const {error}=await db.auth.signInWithPassword({email:$('#authEmail').value.trim(),password:$('#authPassword').value});if(error)throw error;authMessage('')}catch(err){authMessage(err.message)}finally{authBusy(false)}});
$('#signupBtn').addEventListener('click',async()=>{if(!$('#authForm').reportValidity())return;if(!db)return authMessage('Supabase kütüphanesi yüklenemedi.');authBusy(true);authMessage('Hesap oluşturuluyor...');try{const {data,error}=await db.auth.signUp({email:$('#authEmail').value.trim(),password:$('#authPassword').value,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;authMessage(data.session?'Hesabın oluşturuldu.':'E-postana gelen doğrulama bağlantısını aç, ardından giriş yap.')}catch(err){authMessage(err.message)}finally{authBusy(false)}});
$('#logoutBtn').addEventListener('click',async()=>{if(!db)return;const {error}=await db.auth.signOut();if(error)showToast(error.message)});
async function applySession(session){const nextUser=session?.user||null;if(nextUser?.id===user?.id)return;user=nextUser;agents=[];renderAgents();$('#authOverlay').hidden=!!user;$('#accountEmail').textContent=user?.email||'Giriş yapılmadı';demoBalance=user?Number(localStorage.getItem('aivora_demo_balance_'+user.id)||0):0;renderBalance();if(user)await loadAgents()}
async function init(){if(!db){authMessage('Supabase yüklenemedi. İnternet bağlantını kontrol et.');return}const {data,error}=await db.auth.getSession();if(error)authMessage(error.message);await applySession(data?.session);db.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>applySession(session),0)})}
renderAgents();renderBalance();init();
const AIVORA_AI_URL =
  `${SUPABASE_URL}/functions/v1/aivora-ai-`;

async function askAivora(message) {
  if (!db) throw new Error("Supabase bağlantısı yok");

  const { data, error } = await db.functions.invoke(
    "aivora-ai-",
    { body: { message } }
  );

  if (error) throw error;
  return data.reply;
}
const chatButton = document.createElement("button");
chatButton.textContent = "💬 Aivora AI";
chatButton.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9998;padding:14px 20px;border:0;border-radius:30px;background:#7547ed;color:white;font-weight:bold;cursor:pointer";
document.body.appendChild(chatButton);

const chatDialog = document.querySelector("#aivoraChat");
chatButton.addEventListener("click", () => chatDialog?.showModal());
document.querySelector("#closeChat")?.addEventListener("click", () => chatDialog?.close());

document.querySelector("#chatForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.querySelector("#chatInput");
  const messages = document.querySelector("#chatMessages");
  const message = input.value.trim();
  if (!message || !db || !user) return;
  input.value = "";
  const addMessage = (who, value) => {
    const p = document.createElement("p");
    p.textContent = who + ": " + value;
    messages.appendChild(p);
    messages.scrollTop = messages.scrollHeight;
  };
  addMessage("Sen", message);
  try {
    const { data, error } = await db.functions.invoke("aivora-ai-", {
      body: { message }
    });
    if (error) throw error;
    addMessage("Aivora", data?.reply || "Yanıt alınamadı.");
  } catch (error) {
    addMessage("Sistem", "Bağlantı hatası: " + error.message);
  }
});
