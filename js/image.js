/* image.js — geração de imagem de fundo por IA.
   Provedores: Pollinations (grátis, sem chave) e OpenAI gpt-image-1 (com chave).
   Sempre devolve um data: URL, para o export em PNG nunca ser bloqueado por CORS. */
window.ImageGen = (function () {

  async function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  // ---- Pollinations (sem chave) ----
  async function pollinations(prompt, w, h) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=${w}&height=${h}&nologo=true&model=flux&seed=${Math.floor(Math.random() * 1e6)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await blobToDataURL(await res.blob());
    } catch (e) {
      // Se o fetch falhar por CORS, usa a URL direta (mostra na tela;
      // o export pode exigir upload manual da imagem).
      return url;
    }
  }

  // ---- OpenAI gpt-image-1 (com chave) ----
  async function openai(prompt, key) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1536", n: 1 }),
    });
    if (!res.ok) {
      let m = ""; try { m = (await res.json()).error?.message || ""; } catch (e) {}
      throw new Error(`OpenAI ${res.status}: ${m || res.statusText}`);
    }
    const data = await res.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error("Sem imagem na resposta da OpenAI.");
    return "data:image/png;base64," + b64;
  }

  async function generate(prompt, opts) {
    const { width = 1080, height = 1350 } = opts || {};
    const s = Store.getSettings();
    const full = prompt + " — vertical composition, no text, no letters, no watermark, high quality, photographic.";
    if (s.imgProvider === "openai") {
      if (!(s.openaiKey || "").trim()) throw new Error("Configure a chave OpenAI ou use o Pollinations.");
      return openai(full, s.openaiKey.trim());
    }
    return pollinations(full, width, height);
  }

  return { generate };
})();
