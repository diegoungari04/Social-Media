/* studio.js — edição visual, variações, zoom e exportação */
window.Studio = (function () {
  let current = null;   // { post, style }
  let zoom = 0.44;
  let sizer, card;

  function $(id) { return document.getElementById(id); }

  function buildStyle(manual, post) {
    const c = manual.colors || {};
    const base = {
      accent: c.accent, dark: c.dark, light: c.light, ontext: c.ontext,
      head: manual.fonts?.head || "Playfair Display",
      body: manual.fonts?.body || "Inter",
      brand: manual.brand || "",
      photo: "", overlay: 40, headsize: 90, align: "left",
      variant: post.format === "quote" ? "quote"
             : (post.items && post.items.length ? "cartao-foto" : "titulo-destaque"),
    };
    return Object.assign(base, post.style || {});
  }

  // ---------- render helpers ----------
  function ensureSizer() {
    if (sizer) return;
    const frame = $("canvasFrame");
    card = $("postCard");
    sizer = document.createElement("div");
    sizer.id = "cardSizer";
    frame.innerHTML = "";
    sizer.appendChild(card);
    frame.appendChild(sizer);
    card.style.transformOrigin = "top left";
  }

  function applyZoom() {
    ensureSizer();
    sizer.style.width = 1080 * zoom + "px";
    sizer.style.height = 1350 * zoom + "px";
    card.style.transform = `scale(${zoom})`;
    $("zoomLabel").textContent = Math.round(zoom * 100) + "%";
  }

  function rerender() {
    if (!current) return;
    ensureSizer();
    Templates.render(card, current.post, current.style);
    applyZoom();
  }

  // mini preview isolado (results + variações)
  function renderMini(mountEl, post, style, cssWidth) {
    const z = cssWidth / 1080;
    mountEl.innerHTML = "";
    const s = document.createElement("div");
    s.style.width = cssWidth + "px";
    s.style.height = 1350 * z + "px";
    s.style.overflow = "hidden";
    const c = document.createElement("div");
    c.className = "post-card mini";
    c.style.transform = `scale(${z})`;
    c.style.transformOrigin = "top left";
    Templates.render(c, post, style);
    s.appendChild(c);
    mountEl.appendChild(s);
  }

  // ---------- open in studio ----------
  function open(post) {
    const manual = window.App.manual;
    current = { post: JSON.parse(JSON.stringify(post)), style: buildStyle(manual, post) };
    App.showView("studio");
    ensureSizer();
    fitZoom();
    populateControls();
    renderVariants();
    rerender();
  }

  function fitZoom() {
    const frame = $("canvasFrame");
    const avail = (frame.clientHeight || 600) - 20;
    zoom = Math.max(0.2, Math.min(0.62, avail / 1350));
  }

  function populateControls() {
    const p = current.post, s = current.style;
    $("e_headline").value = p.headline || "";
    $("e_highlight").value = p.highlight || "";
    $("e_sub").value = p.subheadline || "";
    $("e_items").value = (p.items || []).join("\n");
    $("itemsEditor").hidden = !(p.items && p.items.length) && !["cartao-foto","foto-topo","solido"].includes(s.variant);
    $("e_headsize").value = s.headsize;
    $("e_align").value = s.align;
    $("s_accent").value = s.accent; $("s_dark").value = s.dark;
    $("s_light").value = s.light; $("s_ontext").value = s.ontext;
    $("s_overlay").value = s.overlay; $("s_fhead").value = s.head;
    $("imgPrompt").value = p.imagePrompt || "";
    $("e_caption").value = p.caption || "";
    $("e_tags").value = (p.hashtags || []).join(" ");
    $("whyBox").innerHTML = p.rationale ? `<b>Por que esse post?</b>${escapeHtml(p.rationale)}` : "";
  }

  function renderVariants() {
    const list = $("variantList");
    list.innerHTML = "";
    Templates.VARIANTS.forEach((v) => {
      const el = document.createElement("div");
      el.className = "variant" + (v.id === current.style.variant ? " sel" : "");
      const mount = document.createElement("div");
      el.appendChild(mount);
      const lbl = document.createElement("div");
      lbl.className = "vlabel"; lbl.textContent = v.name;
      el.appendChild(lbl);
      renderMini(mount, current.post, { ...current.style, variant: v.id }, 150);
      el.addEventListener("click", () => {
        current.style.variant = v.id;
        renderVariants(); rerender();
        $("itemsEditor").hidden = !(current.post.items && current.post.items.length) && !["cartao-foto","foto-topo","solido"].includes(v.id);
      });
      list.appendChild(el);
    });
  }

  function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

  // ---------- export ----------
  async function exportPNG() {
    if (!current) return;
    App.toast("Renderizando PNG…");
    const prevTransform = card.style.transform;
    card.style.transform = "none";
    sizer.style.width = "1080px"; sizer.style.height = "1350px";
    try {
      const canvas = await html2canvas(card, {
        width: 1080, height: 1350, scale: 1,
        useCORS: true, allowTaint: false, backgroundColor: null, logging: false,
      });
      const a = document.createElement("a");
      const name = (current.post.headline || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      a.download = `postforge-${name || "post"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      App.toast("PNG exportado ✓");
    } catch (e) {
      App.toast("Falha ao exportar. Se usou foto por URL, tente enviar o arquivo (CORS).");
      console.error(e);
    } finally {
      card.style.transform = prevTransform;
      applyZoom();
    }
  }

  // ---------- bindings ----------
  function bind() {
    // panel tabs
    document.querySelectorAll(".ptab").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".ptab").forEach((x) => x.classList.remove("is-active"));
      document.querySelectorAll(".panel").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      $("panel-" + b.dataset.panel).classList.add("is-active");
    }));

    const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
    const upd = () => rerender();

    on("e_headline", "input", (e) => { current.post.headline = e.target.value; upd(); renderVariants(); });
    on("e_highlight", "input", (e) => { current.post.highlight = e.target.value; upd(); });
    on("e_sub", "input", (e) => { current.post.subheadline = e.target.value; upd(); });
    on("e_items", "input", (e) => { current.post.items = e.target.value.split("\n").map(s=>s.trim()).filter(Boolean); upd(); renderVariants(); });
    on("e_headsize", "input", (e) => { current.style.headsize = +e.target.value; upd(); });
    on("e_align", "change", (e) => { current.style.align = e.target.value; upd(); });

    on("s_accent", "input", (e) => { current.style.accent = e.target.value; upd(); renderVariants(); });
    on("s_dark", "input", (e) => { current.style.dark = e.target.value; upd(); renderVariants(); });
    on("s_light", "input", (e) => { current.style.light = e.target.value; upd(); renderVariants(); });
    on("s_ontext", "input", (e) => { current.style.ontext = e.target.value; upd(); renderVariants(); });
    on("s_overlay", "input", (e) => { current.style.overlay = +e.target.value; upd(); });
    on("s_fhead", "change", (e) => { current.style.head = e.target.value; upd(); renderVariants(); });

    on("e_caption", "input", (e) => { current.post.caption = e.target.value; });
    on("e_tags", "input", (e) => { current.post.hashtags = e.target.value.split(/\s+/).filter(Boolean); });

    // zoom
    on("btnZoomIn", "click", () => { zoom = Math.min(1, zoom + 0.06); applyZoom(); });
    on("btnZoomOut", "click", () => { zoom = Math.max(0.15, zoom - 0.06); applyZoom(); });
    on("btnExport", "click", exportPNG);

    // photo
    on("btnUploadPhoto", "click", () => $("photoFile").click());
    on("photoFile", "change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { current.style.photo = r.result; rerender(); renderVariants(); };
      r.readAsDataURL(f);
    });
    on("btnApplyUrl", "click", () => {
      const u = $("photoUrl").value.trim();
      if (u) { current.style.photo = u; rerender(); renderVariants(); App.toast("Foto aplicada (para export sem falha, prefira enviar o arquivo)."); }
    });
    on("btnUnsplash", "click", () => {
      const q = ($("photoQuery").value.trim() || current.post.headline || "office").replace(/\s+/g, ",");
      current.style.photo = `https://loremflickr.com/1080/1350/${encodeURIComponent(q)}?lock=${Date.now()%1000}`;
      rerender(); renderVariants();
      App.toast("Imagem de exemplo carregada. Para o export final, envie um arquivo próprio.");
    });
    on("btnGradient", "click", () => { current.style.photo = ""; rerender(); renderVariants(); });

    // imagem por IA
    on("btnSuggestPrompt", "click", async () => {
      const manual = window.App.manual;
      if (window.AI.hasKey()) {
        $("imgHint").textContent = "Sugerindo…";
        try {
          const txt = await window.AI.call(Prompts.imagePromptSystem(), Prompts.imagePromptUser(manual, current.post), 300);
          $("imgPrompt").value = txt.trim();
          current.post.imagePrompt = txt.trim();
          $("imgHint").textContent = "";
        } catch (e) { $("imgHint").textContent = "Erro: " + e.message; }
      } else {
        const base = manual.visualStyle || "fotografia de escritório aconchegante, tons terrosos, luz natural";
        $("imgPrompt").value = `${base} — tema: ${current.post.headline}`;
      }
    });
    on("btnGenImage", "click", async () => {
      const prompt = $("imgPrompt").value.trim();
      if (!prompt) { $("imgHint").textContent = "Escreva ou sugira um prompt."; return; }
      current.post.imagePrompt = prompt;
      $("imgHint").innerHTML = 'Gerando imagem<span class="dots"></span>';
      $("btnGenImage").disabled = true;
      try {
        const dataUrl = await window.ImageGen.generate(prompt);
        current.style.photo = dataUrl;
        rerender(); renderVariants();
        $("imgHint").textContent = "Imagem aplicada ✓";
      } catch (e) {
        $("imgHint").textContent = "Erro: " + e.message;
      } finally {
        $("btnGenImage").disabled = false;
      }
    });

    // caption tools
    on("btnCopyCaption", "click", async () => {
      const txt = current.post.caption + "\n\n" + (current.post.hashtags || []).join(" ");
      try { await navigator.clipboard.writeText(txt); App.toast("Legenda copiada ✓"); }
      catch (e) { App.toast("Copie manualmente (clipboard bloqueado)."); }
    });
    on("btnRewrite", "click", App.rewriteCaption);
    on("btnSaveToLibrary", "click", () => {
      const post = { ...current.post, style: current.style };
      const id = Store.addToLibrary(post);
      current.post.id = id;
      App.toast("Salvo na biblioteca ★");
      App.refreshLibrary();
    });
  }

  return {
    bind, open, rerender, renderMini, buildStyle,
    get current() { return current; },
    applyStyleFromManual() {
      if (!current) return;
      const m = window.App.manual;
      Object.assign(current.style, { accent: m.colors.accent, dark: m.colors.dark, light: m.colors.light, ontext: m.colors.ontext, head: m.fonts.head, body: m.fonts.body, brand: m.brand });
      rerender();
    },
  };
})();
