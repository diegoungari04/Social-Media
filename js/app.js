/* app.js — orquestração geral */
window.App = (function () {
  const $ = (id) => document.getElementById(id);
  let manual = Store.getManual();

  // ---------- views ----------
  function showView(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === name));
    $("view-" + name).classList.add("is-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- manual <-> form ----------
  const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  function manualToForm(m) {
    $("m_brand").value = m.brand || "";
    $("m_niche").value = m.niche || "";
    $("m_client").value = m.client || "";
    $("m_diff").value = (m.differentials || []).join("\n");
    $("m_tone").value = (m.tone || []).join("\n");
    $("m_person").value = m.person || $("m_person").options[0].value;
    $("m_emoji").value = m.emoji || "poucos e pontuais";
    $("m_topics").value = (m.topics || []).join("\n");
    $("m_phrases").value = (m.phrases || []).join("\n");
    $("m_hashtags").value = (m.hashtags || []).join(" ");
    $("m_cta").value = m.cta || "";
    $("c_accent").value = m.colors?.accent || "#4c5c2b";
    $("c_dark").value = m.colors?.dark || "#2e3a1c";
    $("c_light").value = m.colors?.light || "#f4f1e8";
    $("c_ontext").value = m.colors?.ontext || "#ffffff";
    $("f_head").value = m.fonts?.head || "Playfair Display";
    $("f_body").value = m.fonts?.body || "Inter";
  }
  function formToManual() {
    return {
      brand: $("m_brand").value.trim(),
      niche: $("m_niche").value.trim(),
      client: $("m_client").value.trim(),
      differentials: lines($("m_diff").value),
      tone: lines($("m_tone").value),
      person: $("m_person").value,
      emoji: $("m_emoji").value,
      topics: lines($("m_topics").value),
      phrases: lines($("m_phrases").value),
      hashtags: $("m_hashtags").value.split(/\s+/).filter(Boolean),
      cta: $("m_cta").value.trim(),
      colors: { accent: $("c_accent").value, dark: $("c_dark").value, light: $("c_light").value, ontext: $("c_ontext").value },
      fonts: { head: $("f_head").value, body: $("f_body").value },
    };
  }

  // ---------- key status ----------
  function refreshKeyStatus() {
    const el = $("keyStatus");
    if (AI.hasKey()) { el.textContent = "● IA conectada"; el.classList.add("ok"); }
    else { el.textContent = "● sem chave (modo offline)"; el.classList.remove("ok"); }
  }

  function hint(id, msg, cls) {
    const el = $(id); el.textContent = msg || "";
    el.className = "hint" + (cls ? " " + cls : "");
  }

  // ---------- analyze -> manual ----------
  async function analyze() {
    const text = $("analyzeInput").value.trim();
    const niche = $("analyzeNiche").value.trim();
    if (text.length < 40) return hint("analyzeHint", "Cole mais texto (pelo menos algumas frases suas).", "err");
    hint("analyzeHint", "Analisando seu conteúdo", "");
    $("analyzeHint").classList.add("dots");
    $("btnAnalyze").disabled = true;
    try {
      let result;
      if (AI.hasKey()) {
        result = await AI.callJSON(Prompts.analyzeSystem(), Prompts.analyzeUser(text, niche), 1500);
      } else {
        result = Offline.analyze(text, niche);
      }
      manual = Object.assign(Store.defaultManual(), result);
      if (niche) manual.niche = niche;
      manualToForm(manual);
      Store.saveManual(manual);
      $("analyzeHint").classList.remove("dots");
      hint("analyzeHint", AI.hasKey() ? "Manual montado pela IA ✓ Revise e salve." : "Manual básico gerado (offline). Conecte a IA para um retrato mais rico.", "ok");
    } catch (e) {
      $("analyzeHint").classList.remove("dots");
      hint("analyzeHint", "Erro: " + e.message, "err");
    } finally {
      $("btnAnalyze").disabled = false;
    }
  }

  // ---------- generate ----------
  async function generate() {
    const topic = $("g_topic").value.trim();
    if (!topic) return hint("genHint", "Escreva um tema.", "err");
    if (!manual.brand && !manual.niche && !(manual.tone||[]).length)
      return hint("genHint", "Preencha e salve seu Manual da Marca primeiro (aba 1).", "err");
    const opts = {
      topic, format: $("g_format").value, objective: $("g_objective").value,
      count: +$("g_count").value,
    };
    hint("genHint", "Gerando posts no seu tom", ""); $("genHint").classList.add("dots");
    $("btnGenerate").disabled = true;
    $("genResults").innerHTML = "";
    try {
      let data;
      if (AI.hasKey()) data = await AI.callJSON(Prompts.generateSystem(), Prompts.generateUser(manual, opts), 3000);
      else data = Offline.generate(manual, opts);
      const posts = (data.posts || []).map((p) => ({ ...p, format: p.format || opts.format }));
      renderResults(posts);
      $("genHint").classList.remove("dots");
      hint("genHint", posts.length + " post(s) gerado(s) ✓", "ok");
    } catch (e) {
      $("genHint").classList.remove("dots");
      hint("genHint", "Erro: " + e.message, "err");
    } finally {
      $("btnGenerate").disabled = false;
    }
  }

  function renderResults(posts) {
    const wrap = $("genResults");
    wrap.innerHTML = "";
    posts.forEach((post) => {
      const style = Studio.buildStyle(manual, post);
      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = `
        <div class="result-thumb"></div>
        <div class="result-body">
          <h3>${escapeHtml(post.headline || "")}</h3>
          <div class="result-cap">${escapeHtml((post.caption || "").slice(0, 180))}${(post.caption||"").length>180?"…":""}</div>
          <div class="chips">${(post.hashtags||[]).slice(0,5).map((h)=>`<span class="chip">${escapeHtml(h)}</span>`).join("")}</div>
          ${post.rationale ? `<div class="result-why">${escapeHtml(post.rationale)}</div>` : ""}
          <div class="result-actions">
            <button class="btn btn-primary small">🎨 Abrir no Estúdio</button>
            <button class="btn btn-ghost small" data-copy>📋</button>
          </div>
        </div>`;
      const thumb = card.querySelector(".result-thumb");
      // mini render (largura do thumb calculada após inserir)
      wrap.appendChild(card);
      Studio.renderMini(thumb, post, style, thumb.clientWidth || 300);
      card.querySelector(".btn-primary").addEventListener("click", () => Studio.open(post));
      card.querySelector("[data-copy]").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(post.caption + "\n\n" + (post.hashtags||[]).join(" ")); toast("Legenda copiada ✓"); }
        catch(e){ toast("Clipboard bloqueado."); }
      });
    });
  }

  // ---------- ideas ----------
  async function ideas() {
    if (!(manual.topics||[]).length && !manual.niche) return hint("genHint", "Defina pilares/nicho no Manual para gerar ideias.", "err");
    hint("genHint", "Buscando ideias", ""); $("genHint").classList.add("dots");
    try {
      let data = AI.hasKey() ? await AI.callJSON(Prompts.ideasSystem(), Prompts.ideasUser(manual), 800) : Offline.ideas(manual);
      $("genHint").classList.remove("dots");
      const bar = document.createElement("div");
      bar.className = "card"; bar.style.marginTop = "14px";
      bar.innerHTML = `<h2>💡 Ideias de tema</h2><div class="chips" id="ideaChips"></div>`;
      $("genResults").prepend(bar);
      (data.ideas||[]).forEach((idea) => {
        const c = document.createElement("span");
        c.className = "chip"; c.style.cursor = "pointer"; c.textContent = idea;
        c.addEventListener("click", () => { $("g_topic").value = idea; toast("Tema preenchido — clique em Gerar"); });
        bar.querySelector("#ideaChips").appendChild(c);
      });
      hint("genHint", "", "");
    } catch (e) {
      $("genHint").classList.remove("dots");
      hint("genHint", "Erro: " + e.message, "err");
    }
  }

  // ---------- rewrite caption (studio) ----------
  async function rewriteCaption() {
    const cur = Studio.current; if (!cur) return;
    if (!AI.hasKey()) return toast("Reescrever precisa da Claude API (Config).");
    toast("Reescrevendo…");
    try {
      const data = await AI.callJSON(Prompts.rewriteSystem(), Prompts.rewriteUser(manual, cur.post.caption, ""), 1500);
      cur.post.caption = data.caption || cur.post.caption;
      if (data.hashtags) cur.post.hashtags = data.hashtags;
      $("e_caption").value = cur.post.caption;
      $("e_tags").value = (cur.post.hashtags||[]).join(" ");
      toast("Legenda reescrita ✓");
    } catch (e) { toast("Erro: " + e.message); }
  }

  // ---------- library ----------
  function refreshLibrary() {
    const grid = $("libraryGrid");
    const lib = Store.getLibrary();
    grid.innerHTML = lib.length ? "" : `<p class="muted">Nenhum post salvo ainda. Gere e salve posts no Estúdio.</p>`;
    lib.forEach((post) => {
      const style = post.style || Studio.buildStyle(manual, post);
      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = `
        <div class="result-thumb"></div>
        <div class="result-body">
          <h3>${escapeHtml(post.headline||"")}</h3>
          <div class="result-cap">${escapeHtml((post.caption||"").slice(0,140))}</div>
          <div class="result-actions">
            <button class="btn btn-primary small">Abrir</button>
            <button class="btn btn-ghost small" data-del>🗑</button>
          </div>
        </div>`;
      const thumb = card.querySelector(".result-thumb");
      grid.appendChild(card);
      Studio.renderMini(thumb, post, style, thumb.clientWidth || 300);
      card.querySelector(".btn-primary").addEventListener("click", () => Studio.open(post));
      card.querySelector("[data-del]").addEventListener("click", () => {
        Store.removeFromLibrary(post.id); refreshLibrary(); toast("Removido.");
      });
    });
  }

  function escapeHtml(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

  // ---------- settings ----------
  function openSettings() {
    const s = Store.getSettings();
    $("apiKey").value = s.apiKey || ""; $("modelSelect").value = s.model || "claude-sonnet-5";
    $("settingsModal").hidden = false;
  }
  function saveSettings() {
    Store.saveSettings({ apiKey: $("apiKey").value.trim(), model: $("modelSelect").value });
    $("settingsModal").hidden = true; refreshKeyStatus(); toast("Configurações salvas ✓");
  }

  // ---------- init ----------
  function init() {
    manualToForm(manual);
    refreshKeyStatus();
    refreshLibrary();
    Studio.bind();

    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));

    $("btnAnalyze").addEventListener("click", analyze);
    $("btnSaveManual").addEventListener("click", () => {
      manual = formToManual(); Store.saveManual(manual);
      Studio.applyStyleFromManual();
      hint("manualHint", "Manual salvo ✓ Agora vá para 'Gerar posts'.", "ok");
      toast("Manual da Marca salvo ✓");
    });
    $("btnLoadSample").addEventListener("click", () => { manual = Store.sampleManual(); manualToForm(manual); hint("manualHint","Exemplo carregado. Ajuste e salve.","ok"); });
    $("btnClearManual").addEventListener("click", () => { manual = Store.defaultManual(); manualToForm(manual); });

    $("btnGenerate").addEventListener("click", generate);
    $("btnIdeas").addEventListener("click", ideas);
    $("g_topic").addEventListener("keydown", (e) => { if (e.key === "Enter") generate(); });

    $("openSettings").addEventListener("click", openSettings);
    $("closeSettings").addEventListener("click", () => ($("settingsModal").hidden = true));
    $("saveSettings").addEventListener("click", saveSettings);
    $("settingsModal").addEventListener("click", (e) => { if (e.target.id === "settingsModal") $("settingsModal").hidden = true; });
  }

  return {
    init, showView, toast, refreshLibrary, rewriteCaption,
    get manual() { return manual; },
  };
})();

document.addEventListener("DOMContentLoaded", window.App.init);
