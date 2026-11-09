/* One request only: never retry a generation after a connection interruption. */
(() => {
 'use strict';
 async function readReply(response,onDelta=()=>{}) {
  if(!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
   const data=await response.json();
   if(!response.ok || !data?.reply)throw Error(data?.error||'Yanıt alınamadı.');
   return data;
  }
  const reader=response.body.getReader(), decoder=new TextDecoder();
  let buffer='',result=null;
  function event(frame){
   const lines=frame.split('\n');
   const type=lines.find(l=>l.startsWith('event:'))?.slice(6).trim();
   const payload=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
   if(!payload)return;
   const data=JSON.parse(payload);
   if(type==='error')throw Error(data.error||'Yanıt tamamlanamadı.');
   if(type==='delta' && typeof data.text==='string')onDelta(data.text);
   if(type==='done')result=data;
  }
  try {
   while(true){
    const {value,done}=await reader.read();
    buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
    buffer=buffer.replace(/\r\n/g,'\n');
    let end;while((end=buffer.indexOf('\n\n'))!==-1){event(buffer.slice(0,end));buffer=buffer.slice(end+2);}
    if(buffer.length>200000)throw Error('Yanıt akışı okunamadı.');
    if(done)break;
   }
   if(!result?.reply)throw Error('Bağlantı kesildi; yanıt tamamlanamadı.');
   return result;
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
 window.aivoraStream={readReply};
})();
