/* ai.js — cliente da Claude API (direto do navegador) + fallback offline */
window.AI = (function () {
  const ENDPOINT = "https://api.anthropic.com/v1/messages";

  function hasKey() {
    return !!(Store.getSettings().apiKey || "").trim();
  }

  async function call(system, user, maxTokens = 2000) {
    const s = Store.getSettings();
    const key = (s.apiKey || "").trim();
    if (!key) throw new Error("NO_KEY");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: s.model || "claude-sonnet-5",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error?.message || ""; } catch (e) {}
      throw new Error(`API ${res.status}: ${detail || res.statusText}`);
    }
    const data = await res.json();
    return (data.content || []).map((b) => b.text || "").join("").trim();
  }

  // extrai o primeiro objeto/array JSON de um texto (tolerante a cercas de código)
  function parseJSON(text) {
    if (!text) throw new Error("Resposta vazia da IA.");
    let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/,"").trim();
    // tenta direto
    try { return JSON.parse(t); } catch (e) {}
    // procura o primeiro { ... } ou [ ... ] balanceado
    const start = t.search(/[\[{]/);
    if (start >= 0) {
      const open = t[start];
      const close = open === "{" ? "}" : "]";
      let depth = 0, end = -1, inStr = false, esc = false;
      for (let i = start; i < t.length; i++) {
        const c = t[i];
        if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === open) depth++;
        else if (c === close) { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end > start) return JSON.parse(t.slice(start, end + 1));
    }
    throw new Error("Não consegui interpretar o JSON da IA.");
  }

  async function callJSON(system, user, maxTokens) {
    return parseJSON(await call(system, user, maxTokens));
  }

  return { ENDPOINT, hasKey, call, callJSON, parseJSON };
})();

/* ---------- Fallback offline (sem chave): gerador simples baseado em regras ----------
   Não é criativo como o Claude, mas mantém o app 100% funcional sem chave. */
window.Offline = (function () {
  const pick = (a, i) => a[i % a.length];

  function analyze(text, niche) {
    const words = (text.match(/#[\wçãõáéíóúâêô-]+/gi) || []);
    const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 12);
    return {
      brand: "",
      niche: niche || "",
      client: sentences[0] ? "Público que se identifica com: " + sentences[0] : "",
      differentials: sentences.slice(1, 4),
      tone: ["Direto", "Autêntico", "Coloquial brasileiro"],
      person: "Fala direto com 'você'",
      emoji: /[\u{1F300}-\u{1FAFF}☀-➿]/u.test(text) ? "poucos e pontuais" : "nenhum",
      topics: [...new Set(words.map((w) => w.replace("#", "")))].slice(0, 5),
      phrases: sentences.slice(0, 2),
      hashtags: [...new Set(words)].slice(0, 6),
      cta: "Comenta aqui o que você achou 👇",
      colors: { accent: "#4c5c2b", dark: "#2e3a1c", light: "#f4f1e8", ontext: "#ffffff" },
      fonts: { head: "Playfair Display", body: "Inter" },
    };
  }

  const HOOKS = [
    (t) => `A verdade sobre ${t.toLowerCase()}`,
    (t) => `${cap(t)}?`,
    (t) => `Ninguém te conta isso sobre ${t.toLowerCase()}`,
    (t) => `Repense ${t.toLowerCase()}`,
    (t) => `${cap(t)} não é o que parece`,
  ];
  function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function generate(m, { topic, format, count }) {
    const posts = [];
    for (let i = 0; i < count; i++) {
      const headline = pick(HOOKS, i)(topic);
      const tone = (m.tone || []).join(", ") || "autêntico";
      const cta = m.cta || "Comenta aqui 👇";
      const items = format === "checklist" || format === "carrossel"
        ? ["Ponto essencial sobre o tema", "O erro mais comum", "O que ninguém percebe", "Como mudar isso hoje", "O próximo passo"].slice(0, 5)
        : [];
      const caption =
`${headline}.\n\n` +
`Sobre ${topic}: a maioria trata isso como detalhe, mas é aí que mora a diferença.\n\n` +
`No fim, ${topic.toLowerCase()} tem menos a ver com esforço e mais com escolha.\n\n` +
`${cta}\n\n${(m.hashtags || []).join(" ")}`;
      posts.push({
        format,
        headline,
        highlight: "",
        subheadline: `Uma leitura ${tone} sobre ${topic.toLowerCase()}.`,
        items,
        caption,
        hashtags: m.hashtags || [],
        rationale: "Gancho de quebra de padrão + desenvolvimento + CTA. (Gerado no modo offline — conecte a Claude API para textos no seu tom real.)",
        imagePrompt: (m.visualStyle || "fotografia de escritório aconchegante, tons terrosos, luz natural") + `, tema: ${topic}`,
      });
    }
    return { posts };
  }

  function plan(m, { count }) {
    const pillars = (m.topics && m.topics.length) ? m.topics : [m.niche || "seu tema"];
    const formats = ["imagem-unica", "quote", "checklist", "carrossel"];
    const angles = ["o mito mais comum", "o erro que quase todo mundo comete", "o que ninguém te conta", "como eu penso sobre isso", "um passo prático hoje"];
    const items = [];
    for (let i = 0; i < count; i++) {
      const p = pillars[i % pillars.length];
      items.push({
        pillar: p,
        format: formats[i % formats.length],
        title: `${cap(p)}: ${angles[i % angles.length]}`,
        angle: `Explorar ${p.toLowerCase()} pelo ângulo de "${angles[i % angles.length]}".`,
      });
    }
    return { items };
  }

  function ideas(m) {
    const base = (m.topics && m.topics.length ? m.topics : ["seu tema principal"]);
    const templates = [
      (t) => `O maior mito sobre ${t.toLowerCase()}`,
      (t) => `3 erros comuns em ${t.toLowerCase()}`,
      (t) => `Como eu penso sobre ${t.toLowerCase()}`,
    ];
    const out = [];
    base.forEach((t, i) => templates.forEach((fn) => out.push(fn(t))));
    return { ideas: out.slice(0, 8) };
  }

  function rewrite(m, caption) {
    return { caption: caption, hashtags: m.hashtags || [] };
  }

  return { analyze, generate, ideas, rewrite, plan };
})();
