import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
const actor='dd6d2eec-ecb0-4306-98bf-04011b652592';
const agent='12345678-1234-1234-1234-123456789abc';
const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Content-Range':'0-0/0'}});
function load(file,fetcher){let handler;const context={Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://test.supabase.co':'test-key'},serve:h=>handler=h},fetch:fetcher,Request,Response,AbortSignal,URLSearchParams,console:{error(){}}};vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync(file,'utf8')),context);return handler;}
const request=body=>new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test-token',Origin:'https://aivora.tr','Content-Type':'application/json'},body:JSON.stringify(body)});
let admin=false,mutations=0;
const adminHandler=load('admin-edge.ts',async(url,options={})=>{
 if(url.endsWith('/auth/v1/user'))return reply({id:actor});
 const path=url.split('/rest/v1/')[1];
 if(path.startsWith('platform_admins'))return reply(admin?[{user_id:actor}]:[]);
 if(path.startsWith('account_access'))return reply([]);
 if(path.startsWith('platform_plans'))return reply([{id:'starter',name:'Başlangıç',monthly_limit:1000}]);
 if(path.startsWith('platform_settings'))return reply([{chat_enabled:true}]);
 if(path.startsWith('ai_usage_events'))return reply([]);
 if(path==='rpc/admin_metrics')return reply({users:2});
 if(path==='rpc/admin_apply_change'){mutations++;return reply(true);}
 throw Error('Unexpected route '+path);
});
assert.equal((await adminHandler(new Request('https://test',{method:'POST'}))).status,401);
assert.equal((await adminHandler(request({action:'dashboard'}))).status,403);
assert.equal((await adminHandler(request({action:'settings',changes:{chat_enabled:false}}))).status,403);
assert.equal(mutations,0);
const status=await (await adminHandler(request({action:'status'}))).json();assert.equal(status.is_admin,false);assert.equal(status.usage.limit,1000);
admin=true;
assert.equal((await adminHandler(request({action:'dashboard'}))).status,200);
assert.equal((await adminHandler(request({action:'account',target:actor,changes:{plan_id:'starter',limit_override:-1,blocked:false}}))).status,400);
assert.equal(mutations,0);
assert.equal((await adminHandler(request({action:'account',target:actor,changes:{plan_id:'starter',limit_override:2000,blocked:false}}))).status,200);
assert.equal(mutations,1);
let quota=true,own=true,provider=true,providerCalls=0,completed=[], threadOwner=true, saved=0, proposal=false;
const thread='22222222-2222-2222-2222-222222222222';
const chatHandler=load('chat-edge.ts',async(url,options={})=>{
 if(url.endsWith('/auth/v1/user'))return reply({id:actor});
 if(url.includes('/rest/v1/assistants?'))return reply(own?[{name:'Test',type:'Destek',instructions:'Test'}]:[]);
 if(url.includes('/rest/v1/business_knowledge?'))return reply([{title:'Saatler',content:'Hafta içi 10:00-18:00'}]);
 if(url.includes('/rest/v1/business_profile?'))return reply([]);
 if(url.includes('/rest/v1/business_conversations?'))return reply(threadOwner?[{id:thread}]:[]);
 if(url.includes('/rest/v1/business_messages?'))return reply([{role:'assistant',content:'Önceki yanıt'},{role:'user',content:'Önceki soru'}]);
 if(url.endsWith('/rpc/save_ai_exchange')){saved++;return reply(thread);}
 if(url.endsWith('/rpc/reserve_ai_request'))return reply(quota?{ok:true,request_id:agent}:{ok:false,code:'quota_exceeded',message:'Limit doldu.'});
 if(url.endsWith('/rpc/finish_ai_request')){completed.push(JSON.parse(options.body));return reply(true);}
 if(url==='https://api.openai.com/v1/responses'){providerCalls++;const payload=JSON.parse(options.body);assert.match(payload.instructions,/Hafta içi 10:00-18:00/);assert.match(payload.instructions,/işlem yaptığını söyleme/);return provider?reply({output:proposal?[{type:'function_call',name:'propose_task',arguments:JSON.stringify({title:'Test takip',due_at:'',notes:''})}]:[{content:[{type:'output_text',text:'Merhaba!'}]}],usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:10}}}):reply({error:{code:'credit_balance_exhausted'}},429);}
 throw Error('Unexpected chat route '+url);
});
assert.equal((await chatHandler(new Request('https://test',{method:'POST'}))).status,401);
assert.equal((await chatHandler(request({messages:[]}))).status,400);
own=false;assert.equal((await chatHandler(request({agentId:agent,message:'Merhaba'}))).status,404);own=true;
quota=false;assert.equal((await chatHandler(request({agentId:agent,message:'Merhaba'}))).status,429);assert.equal(providerCalls,0);quota=true;
const success=await chatHandler(request({agentId:agent,message:'Merhaba'}));assert.equal(success.status,200);const successBody=await success.json();assert.equal(successBody.reply,'Merhaba!');assert.equal(successBody.conversationId,thread);assert.equal(successBody.historySaved,true);assert.equal(saved,1);assert.equal(completed.at(-1).p_status,'success');assert.equal(completed.at(-1).p_cached,10);
threadOwner=false;const callsBefore=providerCalls;assert.equal((await chatHandler(request({agentId:agent,conversationId:thread,message:'Devam'}))).status,404);assert.equal(providerCalls,callsBefore);threadOwner=true;
assert.equal((await chatHandler(request({agentId:agent,conversationId:'invalid',message:'Devam'}))).status,400);
assert.equal((await chatHandler(request({agentId:agent,conversationId:thread,message:'Devam'}))).status,200);
provider=false;assert.equal((await chatHandler(request({agentId:agent,message:'Merhaba'}))).status,429);assert.equal(completed.at(-1).p_status,'error');
provider=true;proposal=true;const proposed=await chatHandler(request({agentId:agent,message:'Takip görevi öner',proposeActions:true}));assert.equal(proposed.status,200);const proposedBody=await proposed.json();assert.equal(proposedBody.proposedActions[0].type,'task');assert.match(proposedBody.reply,/Henüz kaydedilmedi/);
console.log('PASS: approval-only action proposals, knowledge context, persisted conversations, conversation ownership, admin authorization, validation, ownership, quota rejection, chat success and error usage recording');
