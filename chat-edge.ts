async function platformRpc(name, body) {
 const url = Deno.env.get("SUPABASE_URL");
 const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const r = await fetch(url + "/rest/v1/rpc/" + name, {method:"POST",headers:{apikey:service,Authorization:"Bearer "+service,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if (!r.ok) throw new Error("usage_database_unavailable");
 return r.json();
}
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const allowedOrigins = new Set(["https://eyupbey34.github.io", "https://aivora.tr", "https://www.aivora.tr"]);
  const headers = {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://aivora.tr",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Geçersiz istek" }, 405);
  let requestId = null;
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Oturum gerekli" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userResponse = await fetch(url + "/auth/v1/user", { headers: { Authorization: auth, apikey: key } });
    if (!userResponse.ok) return json({ error: "Oturumun sona erdi. Yeniden giriş yap." }, 401);
    const user = await userResponse.json();
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [{ role: "user", content: body.message }];
    if (!messages.length || messages.length > 21 || messages.some((m: any) => !["user", "assistant"].includes(m?.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 4000) || messages.at(-1).role !== "user") return json({ error: "Geçersiz mesaj. En fazla 4000 karakter yazabilirsin." }, 400);
    let instructions = "Sen Aivora'nın Türkçe konuşan, yardımsever yapay zekâ asistanısın.";
    if (body.agentId) {
      if (typeof body.agentId !== "string" || body.agentId.length > 100) return json({ error: "Geçersiz asistan" }, 400);
      const query = new URLSearchParams({ id: "eq." + body.agentId, user_id: "eq." + user.id, select: "name,type,instructions", limit: "1" });
      const result = await fetch(url + "/rest/v1/assistants?" + query, { headers: { Authorization: auth, apikey: key } });
      if (!result.ok) return json({ error: "Asistan yüklenemedi." }, 500);
      const assistants = await result.json();
      if (!assistants.length) return json({ error: "Asistan bulunamadı." }, 404);
      const agent = assistants[0];
      instructions += "\nAsistan adı: " + agent.name + "\nUzmanlık: " + agent.type + "\nGörev: " + (agent.instructions || "Müşteriye yardımcı ol.");
    }
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "Yapay zekâ bağlantısı henüz hazır değil." }, 503);
    if (!body.agentId) return json({error:"Önce bir asistan seç."},400);
    const reservation = await platformRpc("reserve_ai_request",{p_user_id:user.id,p_assistant_id:body.agentId});
    if (!reservation.ok) return json({error:reservation.message,code:reservation.code},reservation.code==="quota_exceeded"||reservation.code==="rate_limit"||reservation.code==="request_pending"?429:403);
    requestId = reservation.request_id;
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", instructions, input: messages, max_output_tokens: 500 }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await aiResponse.json();
    const reply = (data.output || []).flatMap((item: any) => item.content || []).filter((item: any) => item.type === "output_text").map((item: any) => item.text).join("\n");
    const inputTokens=Math.max(0,Math.floor(Number(data.usage?.input_tokens)||0));
    const outputTokens=Math.max(0,Math.floor(Number(data.usage?.output_tokens)||0));
    const cachedTokens=Math.min(inputTokens,Math.max(0,Math.floor(Number(data.usage?.input_tokens_details?.cached_tokens)||0)));
    await platformRpc("finish_ai_request",{p_request_id:requestId,p_status:aiResponse.ok&&reply?"success":"error",p_input:inputTokens,p_output:outputTokens,p_cached:cachedTokens,p_error:aiResponse.ok?(reply?null:"empty_reply"):String(data?.error?.code||"provider_error").slice(0,80)});
    if (!aiResponse.ok) {
      console.error("AI provider status", aiResponse.status, data?.error?.code);
      return json({ error: aiResponse.status === 429 ? "Yapay zekâ kullanım limiti doldu. Lütfen daha sonra tekrar dene." : "Yapay zekâ servisine şu anda ulaşılamıyor." }, aiResponse.status === 429 ? 429 : 502);
    }

    return reply ? json({ reply }) : json({ error: "Yanıt alınamadı. Tekrar dene." }, 502);
  } catch (error) {
    if(requestId) { try { await platformRpc("finish_ai_request",{p_request_id:requestId,p_status:"error",p_error:"request_failed"}); } catch { console.error("Usage finalization failed"); } }
    console.error("Chat request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "İstek tamamlanamadı. Lütfen tekrar dene." }, 500);
  }
});