const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const pages = {overview:"Genel Bakış",agents:"AI Asistanlar",calls:"Görüşmeler",contacts:"Müşteriler",wallet:"Bakiye & Kullanım",settings:"Ayarlar"};
let agents = JSON.parse(localStorage.getItem("aivora_agents") || "[]");
let demoBalance = Number(localStorage.getItem("aivora_balance") || 0);
const money = n => n.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺";
function showToast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)}
function navigate(page){$$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));$$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#crumb").textContent=pages[page]||"Genel Bakış";$("#sidebar").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"})}
$$(".nav-link").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
$("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$(".notice-close").addEventListener("click",()=>$(".notice").remove());
const dialog=$("#agentDialog");
function openDialog(){dialog.showModal();$("#agentName").focus()}
$("#newAgentBtn").addEventListener("click",openDialog);
$("#emptyCreateBtn").addEventListener("click",openDialog);
$("#closeDialog").addEventListener("click",()=>dialog.close());
$("#cancelDialog").addEventListener("click",()=>dialog.close());
$("#agentForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#agentName").value.trim();if(!name)return;agents.push({id:Date.now(),name,type:$("#agentType").value,goal:$("#agentGoal").value.trim()});localStorage.setItem("aivora_agents",JSON.stringify(agents));renderAgents();dialog.close();e.target.reset();showToast("Demo asistan oluşturuldu.")});
function renderAgents(){const list=$("#agentList");$("#agentCount").textContent=`${agents.length} asistan`;$("#statAgents").textContent=agents.length;if(!agents.length){list.innerHTML=`<div class="empty-state"><div class="empty-orb">✧</div><strong>Henüz asistan oluşturmadın</strong><p>İlk asistanını oluşturarak başlayabilirsin.</p><button class="btn secondary" id="emptyCreateBtn">Asistan oluştur</button></div>`;$("#emptyCreateBtn").addEventListener("click",openDialog);return}list.innerHTML=agents.map(a=>`<div class="agent-item"><div class="agent-glyph">✧</div><div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.type)}${a.goal?" · "+escapeHtml(a.goal):""}</small></div><span class="pill muted-pill">Demo</span></div>`).join("")}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderBalance(){$("#statBalance").textContent=money(demoBalance);$("#walletBalance").textContent=money(demoBalance)}
$("#addDemoBalance").addEventListener("click",()=>{demoBalance+=100;localStorage.setItem("aivora_balance",String(demoBalance));renderBalance();showToast("100 ₺ demo bakiye eklendi.")});
renderAgents();renderBalance();
