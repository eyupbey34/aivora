// Service credentials stay in Edge Function secrets and are never sent to clients.
const base = Deno.env.get('SUPABASE_URL');
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const origins = new Set(['https://aivora.tr','https://www.aivora.tr','https://eyupbey34.github.io']);
async function api(path, method='GET', body=undefined) {
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok) throw new Error('database_unavailable');
 return r.status===204?null:await r.json();
}
const rpc=(name,args={})=>api('rpc/'+name,'POST',args);
async function countRows(path) {
 const r=await fetch(base+'/rest/v1/'+path,{headers:{apikey:service,Authorization:'Bearer '+service,Prefer:'count=exact',Range:'0-0'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('database_unavailable');
 const total=Number((r.headers.get('Content-Range')||'').split('/')[1]);
 if(!Number.isFinite(total))throw new Error('count_unavailable');return total;
}
const monthStart=()=>{const now=new Date();return new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),now.getUTCHours()+3)).toISOString().slice(0,7)+'-01T00:00:00+03:00';};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const integer=x=>Number.isInteger(x)&&x>=0&&x<=1000000;
Deno.serve(async req=>{
 const origin=req.headers.get('Origin');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://aivora.tr','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'Geçersiz istek.'},405);
 if(origin&&!origins.has(origin))return json({error:'Bu adresten erişim desteklenmiyor.'},403);
 try{
  const auth=req.headers.get('Authorization');
  if(!auth?.startsWith('Bearer '))return json({error:'Önce giriş yap.'},401);
  const ur=await fetch(base+'/auth/v1/user',{headers:{Authorization:auth,apikey:Deno.env.get('SUPABASE_ANON_KEY')},signal:AbortSignal.timeout(10000)});
  if(!ur.ok)return json({error:'Oturumun sona erdi. Yeniden giriş yap.'},401);
  const actor=await ur.json();
  if(!uuid(actor.id))return json({error:'Geçersiz oturum.'},401);
  const members=await api('platform_admins?user_id=eq.'+actor.id+'&select=user_id');
  const isAdmin=members.length>0;
  const body=await req.json();
  if(body.action==='status'){
   const [access,plans,settings,used]=await Promise.all([api('account_access?user_id=eq.'+actor.id),api('platform_plans?order=monthly_limit.asc'),api('platform_settings?id=eq.true'),countRows('ai_usage_events?user_id=eq.'+actor.id+'&created_at=gte.'+encodeURIComponent(monthStart())+'&status=eq.success&select=id')]);
   const a=access[0]||{plan_id:'starter',blocked:false,limit_override:null};const p=plans.find(x=>x.id===a.plan_id);
   return json({is_admin:isAdmin,plans:plans.map(({id,name,monthly_limit})=>({id,name,monthly_limit})),billing:{payments_enabled:false},usage:{plan_id:a.plan_id,plan:p?.name||'Başlangıç',limit:a.limit_override??p?.monthly_limit??1000,used,blocked:a.blocked,chat_enabled:settings[0]?.chat_enabled??true,tracking_started_at:settings[0]?.tracking_started_at}});
  }
  if(!isAdmin)return json({error:'Bu işlem için yönetici yetkisi gerekiyor.'},403);
  const offset=Number.isInteger(body.offset)?Math.max(0,Math.min(body.offset,100000)):0;
  if(body.action==='dashboard'){
   const [metrics,plans,settings]=await Promise.all([rpc('admin_metrics'),api('platform_plans?order=monthly_limit.asc'),api('platform_settings?id=eq.true')]);
   return json({metrics,plans,settings:settings[0],server_time:new Date().toISOString()});
  }
  if(body.action==='users')return json(await rpc('admin_user_list',{p_search:String(body.search||'').slice(0,100),p_offset:offset}));
  if(body.action==='assistants'){
   const [items,controls]=await Promise.all([api('assistants?select=id,user_id,name,type,created_at&order=created_at.desc&limit=30&offset='+offset),api('assistant_controls?select=assistant_id,blocked')]);
   return json({items:items.map(x=>({...x,blocked:controls.some(y=>y.assistant_id===x.id&&y.blocked)}))});
  }
  if(body.action==='activity'){
   const [events,audit]=await Promise.all([api('ai_usage_events?select=id,user_id,assistant_id,status,error_code,input_tokens,output_tokens,estimated_cost_usd,created_at&order=created_at.desc&limit=30&offset='+offset),api('admin_audit_log?select=action,target_id,changes,created_at&order=created_at.desc&limit=20')]);
   return json({events,audit});
  }
  const target=body.target;const c=body.changes;
  if(!c||typeof c!=='object'||Array.isArray(c))return json({error:'Geçersiz form.'},400);
  if(body.action==='account'){
   if(!uuid(target)||typeof c.blocked!=='boolean'||typeof c.plan_id!=='string'||!(c.limit_override===null||integer(c.limit_override)))return json({error:'Paket ve limit bilgilerini kontrol et.'},400);
  }else if(body.action==='assistant'){
   if(!uuid(target)||typeof c.blocked!=='boolean')return json({error:'Geçersiz asistan.'},400);
  }else if(body.action==='plan'){
   if(typeof target!=='string'||typeof c.name!=='string'||!c.name.trim()||c.name.length>60||!integer(c.monthly_limit))return json({error:'Paket adı ve limiti kontrol et.'},400);
  }else if(body.action==='settings'){
   if(typeof c.chat_enabled!=='boolean'||!['input_rate','cached_rate','output_rate'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k])&&c[k]>=0&&c[k]<=1000))return json({error:'Ayarları kontrol et.'},400);
  }else return json({error:'Bilinmeyen işlem.'},400);
  // SQL validates membership again and commits changes and audit together.
  await rpc('admin_apply_change',{p_actor:actor.id,p_action:body.action,p_target:target||null,p_changes:c});
  return json({ok:true});
 }catch(error){console.error('Admin request failed',error instanceof Error?error.message:'unknown');return json({error:'İşlem tamamlanamadı. Bilgilerini kontrol edip tekrar dene.'},400);}
});
