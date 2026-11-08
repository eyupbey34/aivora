// OAuth callback is public; every application endpoint independently validates Supabase Auth.
const SITE='https://aivora.tr';
const enc=new TextEncoder();
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const url64=(bytes:Uint8Array)=>b64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const sha=async(s:string)=>url64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))));
const random=()=>url64(crypto.getRandomValues(new Uint8Array(32)));
const required=(name:string)=>{const v=Deno.env.get(name);if(!v)throw Error('SETUP');return v;};
const callback=()=>required('SUPABASE_URL')+'/functions/v1/aivora-gmail/oauth/callback';
const scopes=['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send'];
async function crypt(value:string,decrypt=false){
 const key=await crypto.subtle.importKey('raw',unb64(required('GMAIL_TOKEN_KEY')),{name:'AES-GCM'},false,['encrypt','decrypt']);
 if(decrypt){const data=unb64(value);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12)},key,data.slice(12)));}
 const iv=crypto.getRandomValues(new Uint8Array(12)),body=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(value)));
 const out=new Uint8Array(iv.length+body.length);out.set(iv);out.set(body,iv.length);return b64(out);
}
async function rest(table:string,method='GET',query='',body?:unknown){
 const key=required('SUPABASE_SERVICE_ROLE_KEY');
 const r=await fetch(required('SUPABASE_URL')+'/rest/v1/'+table+query,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'+(query.includes('on_conflict=')?',resolution=merge-duplicates':'')},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('DATABASE');return r.status===204?[]:await r.json();
}
async function auth(req:Request){
 const h=req.headers.get('Authorization');if(!h?.startsWith('Bearer '))throw Error('AUTH');
 const r=await fetch(required('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:required('SUPABASE_ANON_KEY'),Authorization:h},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('AUTH');const u=await r.json();if(!u.id)throw Error('AUTH');return u.id as string;
}
async function googleToken(params:Record<string,string>){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:required('GOOGLE_CLIENT_ID'),client_secret:required('GOOGLE_CLIENT_SECRET')}),signal:AbortSignal.timeout(15000)});
 const v=await r.json();if(!r.ok||!v.access_token)throw Error('RECONNECT');return v;
}
async function connection(uid:string){
 const rows=await rest('gmail_connections','GET','?user_id=eq.'+uid);if(!rows[0])throw Error('NOT_CONNECTED');
 const row=rows[0],t=JSON.parse(await crypt(row.tokens_cipher,true));
 if(t.expires_at<Date.now()+60000){
  const next=await googleToken({grant_type:'refresh_token',refresh_token:t.refresh_token});
  t.access_token=next.access_token;t.refresh_token=next.refresh_token||t.refresh_token;t.expires_at=Date.now()+next.expires_in*1000;
  await rest('gmail_connections','PATCH','?user_id=eq.'+uid,{tokens_cipher:await crypt(JSON.stringify(t)),updated_at:new Date().toISOString()});
 }
 return {row,t};
}
async function gmail(token:string,path:string,method='GET',body?:unknown){
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(r.status===401||r.status===403?'RECONNECT':'GOOGLE');return await r.json();
}
function plain(payload:any):string{
 if(payload?.mimeType==='text/plain'&&payload.body?.data){try{return new TextDecoder().decode(unb64(payload.body.data.replace(/-/g,'+').replace(/_/g,'/'))).slice(0,24000);}catch{return '';}}
 return (payload?.parts||[]).filter((p:any)=>!p.filename).map(plain).filter(Boolean).join('\n').slice(0,24000);
}
function headers(msg:any){const h=msg.payload?.headers||[];const get=(n:string)=>h.find((x:any)=>String(x.name).toLowerCase()===n.toLowerCase())?.value||'';return{id:msg.id,from:get('From'),to:get('To'),subject:get('Subject'),date:get('Date'),snippet:msg.snippet||''};}
function emailValid(s:unknown){return typeof s==='string'&&s.length<=254&&/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(s)&&!/[\r\n]/.test(s);}
function mime(r:any){const subject='=?UTF-8?B?'+b64(enc.encode(r.subject))+'?=';const content=b64(enc.encode(r.body)).match(/.{1,76}/g)?.join('\r\n')||'';return url64(enc.encode(['From: '+r.sender,'To: '+r.recipient,'Subject: '+subject,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',''+content].join('\r\n')));}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin');const cors:Record<string,string>={'Access-Control-Allow-Origin':SITE,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
 const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json'}});
 const done=(ok:boolean)=>new Response(null,{status:303,headers:{Location:SITE+'/?gmail='+(ok?'connected':'error')+'#gmail','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 const url=new URL(req.url),path=url.pathname.split('/aivora-gmail')[1]||'/';
 if(req.method==='OPTIONS')return origin&&origin!==SITE?json({error:'Origin reddedildi.'},403):new Response(null,{status:204,headers:cors});
 if(path==='/oauth/callback'){
  if(req.method!=='GET')return json({error:'Yöntem desteklenmiyor.'},405);
  try{
   const state=url.searchParams.get('state');if(!state||state.length>128)return done(false);
   // DELETE RETURNING consumes the state atomically, including access_denied responses.
   const rows=await rest('gmail_oauth_states','DELETE','?state_hash=eq.'+await sha(state)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()));
   const row=rows[0],code=url.searchParams.get('code');if(!row||!code||url.searchParams.has('error'))return done(false);
   const t=await googleToken({grant_type:'authorization_code',code,redirect_uri:callback(),code_verifier:row.verifier});
   if(!t.refresh_token||!scopes.every(s=>(t.scope||'').split(' ').includes(s)))return done(false);
   const p=await gmail(t.access_token,'profile');if(!emailValid(p.emailAddress))return done(false);
   const cipher=await crypt(JSON.stringify({access_token:t.access_token,refresh_token:t.refresh_token,expires_at:Date.now()+t.expires_in*1000}));
   await rest('gmail_connections','POST','?on_conflict=user_id',{user_id:row.user_id,email:p.emailAddress,tokens_cipher:cipher,scopes:t.scope,updated_at:new Date().toISOString()});
   return done(true);
  }catch{return done(false);}
 }
 if(origin&&origin!==SITE)return json({error:'Origin reddedildi.'},403);
 try{
  const uid=await auth(req);
  if(path==='/status'&&req.method==='GET'){
   const rows=await rest('gmail_connections','GET','?user_id=eq.'+uid+'&select=email,updated_at');
   return json({configured:!!(Deno.env.get('GOOGLE_CLIENT_ID')&&Deno.env.get('GOOGLE_CLIENT_SECRET')&&Deno.env.get('GMAIL_TOKEN_KEY')),connected:!!rows[0],email:rows[0]?.email||null});
  }
  if(path==='/connect'&&req.method==='POST'){
   required('GOOGLE_CLIENT_SECRET');required('GMAIL_TOKEN_KEY');
   await rest('gmail_oauth_states','DELETE','?or=(user_id.eq.'+uid+',expires_at.lt.'+encodeURIComponent(new Date().toISOString())+')');
   const state=random(),verifier=random();
   await rest('gmail_oauth_states','POST','',{state_hash:await sha(state),user_id:uid,verifier,expires_at:new Date(Date.now()+10*60000).toISOString()});
   const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.search=new URLSearchParams({client_id:required('GOOGLE_CLIENT_ID'),redirect_uri:callback(),response_type:'code',scope:scopes.join(' '),access_type:'offline',prompt:'consent',state,code_challenge:await sha(verifier),code_challenge_method:'S256'}).toString();
   return json({url:u.toString()});
  }
  if(path==='/disconnect'&&req.method==='POST'){
   const rows=await rest('gmail_connections','GET','?user_id=eq.'+uid);let revoked=true;
   if(rows[0]){try{const t=JSON.parse(await crypt(rows[0].tokens_cipher,true));const r=await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:t.refresh_token}),signal:AbortSignal.timeout(10000)});revoked=r.ok;}catch{revoked=false;}}
   await rest('gmail_connections','DELETE','?user_id=eq.'+uid);await rest('gmail_oauth_states','DELETE','?user_id=eq.'+uid);await rest('gmail_send_reviews','DELETE','?user_id=eq.'+uid);
   return json({disconnected:true,revoked});
  }
  if(path==='/inbox'&&req.method==='GET'){
   const {t}=await connection(uid),list=await gmail(t.access_token,'messages?maxResults=10&labelIds=INBOX');
   const messages=await Promise.all((list.messages||[]).map(async(m:any)=>headers(await gmail(t.access_token,'messages/'+m.id+'?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date'))));return json({messages});
  }
  if(path==='/message'&&req.method==='GET'){
   const id=url.searchParams.get('id');if(!id||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))return json({error:'Geçersiz ileti.'},400);
   const {t}=await connection(uid),m=await gmail(t.access_token,'messages/'+id+'?format=full');return json({...headers(m),body:plain(m.payload)||m.snippet||'',plainTextOnly:true});
  }
  if(path==='/prepare'&&req.method==='POST'){
   if(Number(req.headers.get('Content-Length')||0)>24000)return json({error:'İleti çok uzun.'},400);
   const raw=await req.text();if(raw.length>24000)return json({error:'İleti çok uzun.'},400);const b=JSON.parse(raw);
   if(!emailValid(b.to)||typeof b.subject!=='string'||!b.subject.trim()||b.subject.length>200||/[\r\n]/.test(b.subject)||typeof b.body!=='string'||!b.body.trim()||b.body.length>16000)return json({error:'Alıcı, konu ve mesaj alanlarını kontrol et.'},400);
   const {row}=await connection(uid);const recent=await rest('gmail_send_reviews','GET','?user_id=eq.'+uid+'&created_at=gt.'+encodeURIComponent(new Date(Date.now()-3600000).toISOString())+'&select=id&limit=31');if(recent.length>=30)return json({error:'Saatlik 30 hazırlama sınırına ulaşıldı.'},429);
   const rows=await rest('gmail_send_reviews','POST','',{user_id:uid,sender:row.email,recipient:b.to,subject:b.subject.trim(),body:b.body,expires_at:new Date(Date.now()+10*60000).toISOString()});
   return json({review:{id:rows[0].id,from:row.email,to:b.to,subject:b.subject.trim(),body:b.body}});
  }
  if(path==='/send'&&req.method==='POST'){
   const b=await req.json();if(b.confirm!==true||typeof b.id!=='string'||!/^[0-9a-f-]{36}$/.test(b.id))return json({error:'Gönderim onayı gerekli.'},400);
   const {row,t}=await connection(uid);
   const rows=await rest('gmail_send_reviews','PATCH','?id=eq.'+b.id+'&user_id=eq.'+uid+'&sender=eq.'+encodeURIComponent(row.email)+'&status=eq.pending&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),{status:'sending'});
   if(!rows[0])return json({error:'Bu onay kullanılmış veya süresi dolmuş. Yeni inceleme oluştur.'},409);
   try{const sent=await gmail(t.access_token,'messages/send','POST',{raw:mime(rows[0])});await rest('gmail_send_reviews','PATCH','?id=eq.'+b.id+'&user_id=eq.'+uid,{status:'sent',provider_id:sent.id});return json({sent:true});}
   catch(e){const status=(e as Error).message==='GOOGLE'||(e as Error).message==='RECONNECT'?'failed':'unknown';try{await rest('gmail_send_reviews','PATCH','?id=eq.'+b.id+'&user_id=eq.'+uid,{status});}catch{}return json({error:status==='unknown'?'Gönderim sonucu doğrulanamadı. Tekrar göndermeden önce Gmail Gönderilenler klasörünü kontrol et.':'Gmail gönderimi reddetti. Bağlantını ve izinleri kontrol et.'},502);}
  }
  return json({error:'İşlem bulunamadı.'},404);
 }catch(e){const m=(e as Error).message;const errors:Record<string,string>={AUTH:'Oturum açman gerekiyor.',SETUP:'Gmail sunucu ayarları tamamlanmamış.',NOT_CONNECTED:'Önce Gmail hesabını bağla.',RECONNECT:'Google izni yenilenmeli. Gmail hesabını yeniden bağla.'};return json({error:errors[m]||'İşlem tamamlanamadı. Lütfen yeniden dene.'},m==='AUTH'?401:m==='NOT_CONNECTED'||m==='RECONNECT'?409:500);}
});
