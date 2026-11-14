// File contents are untrusted data, never application instructions.
export async function extractAttachmentText(bytes: Uint8Array, extension: string) {
 if(bytes.length>4194304)throw Error('Dosya en fazla 4 MB olabilir.');
 if(extension==='pdf'){
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('Geçerli bir PDF seç.');
  const {getDocumentProxy,extractText}=await import('npm:unpdf@2.2.0');
  const pdf=await getDocumentProxy(bytes,{maxImageSize:16777216,isEvalSupported:false});
  try{
   if(pdf.numPages>40)throw Error('PDF en fazla 40 sayfa olabilir.');
   const result=await extractText(pdf,{mergePages:true});
   const text=String(result.text).trim();
   if(!text)throw Error('PDF içinde okunabilir metin bulunamadı. Taranmış belgeyi fotoğraf olarak ekleyebilirsin.');
   return {text:text.slice(0,12000),truncated:text.length>12000};
  }finally{await pdf.destroy();}
 }
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).trim();
 if(!text||text.includes('\u0000'))throw Error('UTF-8 biçiminde okunabilir bir metin dosyası seç.');
 return {text:text.slice(0,12000),truncated:text.length>12000};
}
