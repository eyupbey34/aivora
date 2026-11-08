import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
const source=stripTypeScriptTypes(readFileSync('gmail-edge.ts','utf8'));
let handler,requests=[],callbackRows=[],reviews=[],connections=[],googleSends=0;
const key=Buffer.alloc(32,7).toString('base64');
const env={SUPABASE_URL:'https://unit.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-test-key',SUPABASE_ANON_KEY:'publishable-test',GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'unit-secret',GMAIL_TOKEN_KEY:key};
let encrypted;
const context=vm.createContext({URL,URLSearchParams,Request,Response,TextEncoder,TextDecoder,Uint8Array,Date,JSON,Error,AbortSignal,crypto:webcrypto,atob,btoa,Deno:{env:{get:n=>env[n]},serve:fn=>handler=fn},fetch:async(url,options={})=>{
 const u=new URL(url);requests.push({url:String(url),method:options.method||'GET'});
 if(u.pathname==='/auth/v1/user')return Response.json(options.headers.Authorization==='Bearer valid'?{id:'00000000-0000-0000-0000-000000000001'}:{error:'invalid'},{status:options.headers.Authorization==='Bearer valid'?200:401});
 if(u.pathname.startsWith('/rest/v1/')){
  const table=u.pathname.split('/').at(-1),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
  if(table==='gmail_oauth_states')return Response.json(method==='DELETE'?callbackRows.splice(0):[]);
  if(table==='gmail_connections'){
   if(method==='GET')return Response.json(connections);
   return Response.json(body?[body]:[]);
  }
  if(table==='gmail_send_reviews'){
   if(method==='POST'){const r={status:'pending',...body,id:'11111111-1111-1111-1111-111111111111'};reviews=[r];return Response.json([r]);}
   if(method==='PATCH'){
    const r=reviews.find(r=>u.searchParams.get('id')==='eq.'+r.id&&u.searchParams.get('user_id')==='eq.'+r.user_id&&(!u.searchParams.has('status')||u.searchParams.get('status')==='eq.'+r.status));
    if(r)Object.assign(r,body);return Response.json(r?[r]:[]);
   }
   return Response.json([]);
  }
 }
 if(u.host==='oauth2.googleapis.com'&&u.pathname==='/token')return Response.json({access_token:'oauth-access',refresh_token:'oauth-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'});
 if(u.host==='gmail.googleapis.com'){
  if(u.pathname.endsWith('/messages/send')){googleSends++;const raw=JSON.parse(options.body).raw;const mime=Buffer.from(raw,'base64url').toString();assert.match(mime,/To: target@example.com\r\n/);assert.match(mime,/Content-Transfer-Encoding: base64/);return Response.json({id:'sent-id'});}
  return Response.json({emailAddress:'sender@example.com'});
 }
 throw Error('Unexpected fetch');
}});
vm.runInContext(source,context);
encrypted=await vm.runInContext("crypt(JSON.stringify({access_token:'google-test',refresh_token:'refresh-test',expires_at:Date.now()+3600000}))",context);
assert(!encrypted.includes('google-test'));
assert.equal(JSON.parse(await vm.runInContext(`crypt(${JSON.stringify(encrypted)},true)`,context)).access_token,'google-test');
const call=(path,{token='valid',method='GET',body,origin='https://aivora.tr'}={})=>handler(new Request('https://unit.supabase.co/functions/v1/aivora-gmail'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}));
assert.equal((await call('/status',{token:''})).status,401);
assert.equal((await call('/status',{token:'invalid'})).status,401);
assert.equal((await call('/status',{origin:'https://evil.example'})).status,403);
assert.equal((await call('/status',{method:'OPTIONS'})).status,204);
assert.equal((await (await call('/status')).json()).connected,false);
let r=await call('/connect',{method:'POST',body:{}});const oauth=new URL((await r.json()).url);assert.equal(oauth.origin,'https://accounts.google.com');assert(oauth.searchParams.get('state').length>=43);assert.equal(oauth.searchParams.get('code_challenge_method'),'S256');assert(oauth.searchParams.get('scope').includes('gmail.readonly'));
r=await call('/oauth/callback?state=missing&code=bad',{token:'',origin:''});assert.equal(r.status,303);assert.match(r.headers.get('Location'),/gmail=error/);
callbackRows=[{user_id:'00000000-0000-0000-0000-000000000001',verifier:'unit-verifier'}];
r=await call('/oauth/callback?state=one-use&code=code',{token:'',origin:''});assert.match(r.headers.get('Location'),/gmail=connected/);
r=await call('/oauth/callback?state=one-use&code=code',{token:'',origin:''});assert.match(r.headers.get('Location'),/gmail=error/);
connections=[{user_id:'00000000-0000-0000-0000-000000000001',email:'sender@example.com',tokens_cipher:encrypted}];
r=await call('/status');const status=await r.json();assert.equal(status.connected,true);assert(!JSON.stringify(status).includes(encrypted));
r=await call('/prepare',{method:'POST',body:{to:'target@example.com\r\nBcc: victim@example.com',subject:'hello',body:'test'}});assert.equal(r.status,400);
r=await call('/prepare',{method:'POST',body:{to:'target@example.com',subject:'hello\nBcc: inject',body:'test'}});assert.equal(r.status,400);
r=await call('/prepare',{method:'POST',body:{to:'target@example.com',subject:'Merhaba',body:'Türkçe içerik'}});const review=(await r.json()).review;assert.equal(r.status,200);assert.equal(googleSends,0);
r=await call('/send',{method:'POST',body:{id:review.id}});assert.equal(r.status,400);assert.equal(googleSends,0);
reviews[0].user_id='another-owner';r=await call('/send',{method:'POST',body:{id:review.id,confirm:true}});assert.equal(r.status,409);assert.equal(googleSends,0);
reviews[0].user_id='00000000-0000-0000-0000-000000000001';r=await call('/send',{method:'POST',body:{id:review.id,confirm:true}});assert.equal(r.status,200);assert.equal(googleSends,1);
r=await call('/send',{method:'POST',body:{id:review.id,confirm:true}});assert.equal(r.status,409);assert.equal(googleSends,1);
console.log('PASS: auth, CORS, encrypted tokens, PKCE state, missing callback state, no token disclosure, header injection rejection, explicit send approval, ownership, one-time send and UTF-8 MIME. No real Google emails sent.');
