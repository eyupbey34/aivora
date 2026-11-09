// Only explicitly configured free-tier accounts and fixed free-eligible models.
// Billing must remain disabled at the provider. No OpenAI or paid-model fallback.
const providerCooldown = new Map<string, number>();
export function freeProviders(env = (name: string) => Deno.env.get(name)) {
 const configs = [
  {id:'groq',key:env('GROQ_API_KEY'),confirmed:env('GROQ_FREE_TIER_CONFIRMED'),url:'https://api.groq.com/openai/v1/chat/completions',model:'openai/gpt-oss-120b'},
  {id:'gemini',key:env('GEMINI_API_KEY'),confirmed:env('GEMINI_FREE_TIER_CONFIRMED'),url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',model:'gemini-3.1-flash-lite'},
  {id:'openrouter',key:env('OPENROUTER_API_KEY'),confirmed:'true',url:'https://openrouter.ai/api/v1/chat/completions',model:'openrouter/free'},
  {id:'cloudflare',key:env('CLOUDFLARE_AI_API_TOKEN'),confirmed:env('CLOUDFLARE_FREE_TIER_CONFIRMED'),account:env('CLOUDFLARE_ACCOUNT_ID'),url:'',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}
 ];
 return configs.filter(p=>p.key && p.confirmed==='true' && (p.id!=='cloudflare'||/^[a-f0-9]{32}$/i.test(p.account||''))).map(p=>({...p,url:p.id==='cloudflare'?'https://api.cloudflare.com/client/v4/accounts/'+p.account+'/ai/v1/chat/completions':p.url}));
}
function normalizeReply(provider: string, raw: any) {
 if(provider==='gemini') {
  if(raw.promptFeedback?.blockReason || ['SAFETY','PROHIBITED_CONTENT','BLOCKLIST'].includes(raw.candidates?.[0]?.finishReason)) return {output:[{content:[{type:'output_text',text:'Bu isteğe yardımcı olamıyorum. Farklı bir konuda yardımcı olabilirim.'}]}],usage:{}};
  const parts=raw.candidates?.[0]?.content?.parts||[];
  return {output:parts.filter((p:any)=>!p.thought).map((p:any)=>p.functionCall?{type:'function_call',name:p.functionCall.name,arguments:JSON.stringify(p.functionCall.args||{})}:{content:typeof p.text==='string'?[{type:'output_text',text:p.text}]:[]}),usage:{input_tokens:raw.usageMetadata?.promptTokenCount,output_tokens:(raw.usageMetadata?.candidatesTokenCount||0)+(raw.usageMetadata?.thoughtsTokenCount||0),input_tokens_details:{cached_tokens:raw.usageMetadata?.cachedContentTokenCount||0}}};
 }
 const message=raw.choices?.[0]?.message||{};
 const refusal=message.refusal||(raw.choices?.[0]?.finish_reason==='content_filter'?'Bu isteğe yardımcı olamıyorum. Farklı bir konuda yardımcı olabilirim.':'');
 return {output:[{content:[{type:'output_text',text:refusal||message.content||''}]},...(refusal?[]:(message.tool_calls||[]).map((t:any)=>({type:'function_call',name:t.function?.name,arguments:t.function?.arguments})))],usage:{input_tokens:raw.usage?.prompt_tokens||0,output_tokens:raw.usage?.completion_tokens||0,input_tokens_details:{cached_tokens:raw.usage?.prompt_tokens_details?.cached_tokens||0}}};
}
export async function freeCompletion(instructions: string, messages: any[], tools: any[], providers=freeProviders(), fetcher=fetch, onDelta?: (text: string) => void) {
 const deadline=Date.now()+40000;
 let lastStatus=503;
 // Bound shared free-tier context while retaining the latest user message.
 const context=[];let chars=0;
 for(const m of [...messages].reverse()){if(context.length&&chars+m.content.length>12000)break;context.unshift(m);chars+=m.content.length;}
 for(const p of providers) {
  if(Date.now()>=deadline)break;
  if((providerCooldown.get(p.id)||0)>Date.now()){lastStatus=429;continue;}
  const headers:Record<string,string>={'Content-Type':'application/json'};
  let body:any;
  if(p.id==='gemini') {
   headers['x-goog-api-key']=p.key!;
   body={systemInstruction:{parts:[{text:instructions.slice(0,12000)}]},contents:context.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:1500},...(tools.length?{tools:[{functionDeclarations:tools.map(t=>({name:t.name,description:t.description,parameters:{type:'OBJECT',properties:Object.fromEntries(Object.keys(t.parameters.properties).map(k=>[k,{type:'STRING'}])),required:t.parameters.required}}))}]}:{})};
  }else{
   headers.Authorization='Bearer '+p.key;
   body={model:p.model,messages:[{role:'system',content:instructions.slice(0,12000)},...context],max_tokens:1500,stream:false,...(tools.length?{tools:tools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters}})),tool_choice:'auto'}:{})};
   if(p.id==='groq'){body.max_completion_tokens=body.max_tokens;delete body.max_tokens;body.reasoning_effort='low';}
   if(p.id==='openrouter'){headers['HTTP-Referer']='https://aivora.tr';headers['X-Title']='Aivora';body.provider={max_price:{prompt:0,completion:0},require_parameters:tools.length>0};}
  }
  let emitted=false;
  const streaming=!!onDelta && !tools.length && p.id==='groq';
  if(streaming){body.stream=true;body.stream_options={include_usage:true};}
  try{
   const response=await fetcher(p.url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(Math.max(1,Math.min(12000,deadline-Date.now())))});
   if(!response.ok){lastStatus=response.status;if(response.status===429){const retry=response.headers.get('retry-after');const seconds=retry&&/^\d+$/.test(retry)?Number(retry):retry?Math.max(0,(Date.parse(retry)-Date.now())/1000):60;providerCooldown.set(p.id,Date.now()+Math.min(86400000,Math.max(1000,(Number.isFinite(seconds)?seconds:60)*1000)));}continue;}
   let raw:any;
   if(streaming && response.headers.get('content-type')?.includes('text/event-stream')) {
    const reader=response.body!.getReader(), decoder=new TextDecoder();
    let buffer='',text='',usage:any={},finished=false;
    const consume=(line:string)=>{
     if(!line.startsWith('data:'))return;
     const payload=line.slice(5).trim();
     if(payload==='[DONE]'){finished=true;return;}
     if(!payload)return;
     const chunk=JSON.parse(payload);
     if(chunk.error)throw Error('provider_stream_failed');
     const delta=chunk.choices?.[0]?.delta;
     // Never expose reasoning tokens; only the public answer or refusal.
     const piece=delta?.content||delta?.refusal;
     if(typeof piece==='string'&&piece){text+=piece;emitted=true;onDelta!(piece);}
     if(chunk.choices?.[0]?.finish_reason==='content_filter'&&!text){text='Bu isteğe yardımcı olamıyorum. Farklı bir konuda yardımcı olabilirim.';emitted=true;onDelta!(text);}
     if(chunk.usage)usage=chunk.usage;
     if(chunk.x_groq?.usage)usage=chunk.x_groq.usage;
    };
    try{
     while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});let end;while((end=buffer.indexOf('\n'))!==-1){consume(buffer.slice(0,end).replace(/\r$/,''));buffer=buffer.slice(end+1);}if(buffer.length>200000)throw Error('provider_stream_invalid');if(done)break;}
     if(buffer.trim())consume(buffer);
     if(!finished)throw Error('provider_stream_incomplete');
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    raw={choices:[{message:{content:text}}],usage};
   }else raw=await response.json();
   const data=normalizeReply(p.id,raw);
   if(data.output.some((o:any)=>o.type==='function_call'||o.content?.some((c:any)=>typeof c.text==='string'&&c.text.trim())))return {ok:true,status:200,data,provider:p.id};
   lastStatus=502;
  }catch{lastStatus=502;if(emitted)break;}
 }
 return {ok:false,status:lastStatus===429?429:503,data:{output:[],usage:{},error:{code:lastStatus===429?'free_quota_exhausted':'free_provider_unavailable'}},provider:null};
}
