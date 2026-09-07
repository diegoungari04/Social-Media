/* templates.js — renderização visual do post (alvo de export: 1080x1350) */
window.Templates = (function () {

  const VARIANTS = [
    { id: "titulo-destaque", name: "Título em destaque" },
    { id: "cartao-foto",     name: "Cartão sobre foto" },
    { id: "foto-topo",       name: "Foto no topo" },
    { id: "foto-lateral",    name: "Foto lateral" },
    { id: "quote",           name: "Frase de impacto" },
    { id: "solido",          name: "Fundo sólido" },
  ];

  const SERIF = ["Playfair Display", "DM Serif Display", "Lora"];
  function fontStack(name) {
    return SERIF.includes(name) ? `"${name}", Georgia, serif` : `"${name}", Inter, system-ui, sans-serif`;
  }
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // aplica caixa de destaque numa substring da headline
  function withHighlight(headline, highlight, accent, ontext, radius = 12) {
    const h = esc(headline);
    if (!highlight) return h;
    const idx = headline.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx < 0) return h;
    const before = esc(headline.slice(0, idx));
    const mid = esc(headline.slice(idx, idx + highlight.length));
    const after = esc(headline.slice(idx + highlight.length));
    const box = `<span style="background:${accent};color:${ontext};padding:.02em .28em;border-radius:${radius}px;box-decoration-break:clone;-webkit-box-decoration-break:clone;">${mid}</span>`;
    return before + box + after;
  }

  function bgLayer(style) {
    const overlay = (style.overlay ?? 35) / 100;
    if (style.photo) {
      return `
        <img src="${esc(style.photo)}" crossorigin="anonymous" referrerpolicy="no-referrer"
             style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
        <div style="position:absolute;inset:0;background:rgba(0,0,0,${overlay});"></div>`;
    }
    return `<div style="position:absolute;inset:0;background:linear-gradient(150deg,${style.accent},${style.dark});"></div>`;
  }

  function checklist(items, style, dark) {
    if (!items || !items.length) return "";
    return `<div style="display:flex;flex-direction:column;gap:26px;margin-top:36px;">` +
      items.map((it) => `
        <div style="display:flex;align-items:center;gap:22px;">
          <div style="flex:none;width:66px;height:66px;border-radius:16px;background:${style.accent};display:flex;align-items:center;justify-content:center;">
            <span style="color:${style.ontext};font-size:38px;font-weight:800;line-height:1;">✓</span>
          </div>
          <div style="font-family:${fontStack(style.body)};font-weight:700;font-size:40px;color:${dark};line-height:1.15;">${esc(it)}</div>
        </div>`).join("") +
      `</div>`;
  }

  function logoMark(style, color) {
    if (!style.brand) return "";
    return `<div style="font-family:${fontStack(style.body)};font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:24px;color:${color};opacity:.9;">${esc(style.brand)}</div>`;
  }

  // ---------- variantes ----------
  function v_tituloDestaque(post, style) {
    const head = fontStack(style.head);
    const hsize = style.headsize || 96;
    return `
    <div style="position:absolute;inset:0;">${bgLayer({ ...style, overlay: style.overlay ?? 45 })}</div>
    <div style="position:absolute;inset:0;padding:96px 84px;display:flex;flex-direction:column;justify-content:flex-end;text-align:${style.align};">
      ${logoMark(style, style.ontext)}
      <div style="flex:1"></div>
      <h1 style="font-family:${head};font-weight:800;font-size:${hsize}px;line-height:1.02;color:${style.ontext};margin:0 0 30px;">
        ${withHighlight(post.headline, post.highlight, style.accent, style.ontext, 14)}
      </h1>
      <p style="font-family:${fontStack(style.body)};font-weight:600;font-size:46px;line-height:1.28;color:${style.ontext};margin:0;max-width:900px;${style.align==='center'?'margin-left:auto;margin-right:auto;':''}">
        ${esc(post.subheadline)}
      </p>
    </div>`;
  }

  function v_cartaoFoto(post, style) {
    const head = fontStack(style.head);
    const hsize = Math.min(style.headsize || 84, 92);
    const body = post.items && post.items.length
      ? checklist(post.items, style, style.dark)
      : `<p style="font-family:${fontStack(style.body)};font-weight:600;font-size:44px;line-height:1.3;color:${style.dark};margin:24px 0 0;">${esc(post.subheadline)}</p>`;
    return `
    <div style="position:absolute;inset:0;">${bgLayer({ ...style, overlay: style.overlay ?? 20 })}</div>
    <div style="position:absolute;inset:0;padding:72px;display:flex;align-items:center;">
      <div style="background:${hexA(style.light, .93)};border-radius:34px;padding:64px 56px;width:100%;box-shadow:0 30px 60px rgba(0,0,0,.25);text-align:${style.align};">
        <h1 style="font-family:${head};font-weight:800;font-size:${hsize}px;line-height:1.03;color:${style.dark};margin:0;">
          ${withHighlight(post.headline, post.highlight, style.accent, style.ontext, 12)}
        </h1>
        ${body}
      </div>
    </div>`;
  }

  function v_fotoTopo(post, style) {
    const head = fontStack(style.head);
    const hsize = Math.min(style.headsize || 84, 92);
    const body = post.items && post.items.length
      ? checklist(post.items, style, style.dark)
      : `<p style="font-family:${fontStack(style.body)};font-weight:600;font-size:44px;line-height:1.3;color:${style.dark};margin:26px 0 0;">${esc(post.subheadline)}</p>`;
    return `
    <div style="position:absolute;inset:0;background:${style.light};"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:46%;overflow:hidden;">${bgLayer({ ...style, overlay: style.overlay ?? 10 })}</div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:56%;padding:64px 72px;display:flex;flex-direction:column;justify-content:center;text-align:${style.align};">
      <h1 style="font-family:${head};font-weight:800;font-size:${hsize}px;line-height:1.03;color:${style.dark};margin:0;">
        ${withHighlight(post.headline, post.highlight, style.accent, style.ontext, 12)}
      </h1>
      ${body}
    </div>`;
  }

  function v_fotoLateral(post, style) {
    const head = fontStack(style.head);
    const hsize = Math.min(style.headsize || 76, 84);
    return `
    <div style="position:absolute;inset:0;background:${style.light};"></div>
    <div style="position:absolute;top:0;left:0;bottom:0;width:44%;overflow:hidden;">${bgLayer({ ...style, overlay: style.overlay ?? 12 })}</div>
    <div style="position:absolute;top:0;right:0;bottom:0;width:56%;padding:72px 64px;display:flex;flex-direction:column;justify-content:center;text-align:${style.align};">
      ${logoMark(style, style.accent)}
      <h1 style="font-family:${head};font-weight:800;font-size:${hsize}px;line-height:1.05;color:${style.dark};margin:18px 0 0;">
        ${withHighlight(post.headline, post.highlight, style.accent, style.ontext, 12)}
      </h1>
      <p style="font-family:${fontStack(style.body)};font-weight:600;font-size:40px;line-height:1.3;color:${style.dark};margin:24px 0 0;">${esc(post.subheadline)}</p>
    </div>`;
  }

  function v_quote(post, style) {
    const head = fontStack(SERIF.includes(style.head) ? style.head : "Playfair Display");
    const hsize = style.headsize || 96;
    return `
    <div style="position:absolute;inset:0;">${bgLayer({ ...style, overlay: style.overlay ?? 55 })}</div>
    <div style="position:absolute;inset:0;padding:96px 84px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-family:${head};font-size:170px;line-height:.5;color:${style.accent};margin-bottom:20px;">&ldquo;</div>
      <h1 style="font-family:${head};font-style:italic;font-weight:700;font-size:${hsize}px;line-height:1.06;color:${style.ontext};margin:0;">
        ${withHighlight(post.headline, post.highlight, style.accent, style.ontext, 12)}
      </h1>
      <div style="height:3px;background:${hexA(style.ontext,.6)};margin:44px 0;width:70%;"></div>
      <p style="font-family:${fontStack(style.body)};font-weight:700;font-size:46px;line-height:1.28;color:${style.ontext};margin:0;">${esc(post.subheadline)}</p>
      <div style="flex:0"></div>
      <div style="margin-top:40px;">${logoMark(style, style.ontext)}</div>
    </div>`;
  }

  function v_solido(post, style) {
    const head = fontStack(style.head);
    const hsize = style.headsize || 100;
    const body = post.items && post.items.length
      ? checklist(post.items, { ...style }, style.ontext)
      : `<p style="font-family:${fontStack(style.body)};font-weight:600;font-size:46px;line-height:1.3;color:${style.ontext};margin:30px 0 0;opacity:.92;">${esc(post.subheadline)}</p>`;
    return `
    <div style="position:absolute;inset:0;background:linear-gradient(155deg,${style.accent},${style.dark});"></div>
    <div style="position:absolute;inset:0;padding:96px 84px;display:flex;flex-direction:column;justify-content:center;text-align:${style.align};">
      ${logoMark(style, style.ontext)}
      <div style="flex:0.15"></div>
      <h1 style="font-family:${head};font-weight:800;font-size:${hsize}px;line-height:1.03;color:${style.ontext};margin:0;">
        ${withHighlight(post.headline, post.highlight, style.light, style.dark, 14)}
      </h1>
      ${body}
    </div>`;
  }

  const RENDERERS = {
    "titulo-destaque": v_tituloDestaque,
    "cartao-foto": v_cartaoFoto,
    "foto-topo": v_fotoTopo,
    "foto-lateral": v_fotoLateral,
    "quote": v_quote,
    "solido": v_solido,
  };

  function hexA(hex, a) {
    const h = (hex || "#000000").replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // style: {accent,dark,light,ontext,head,body,brand,photo,overlay,headsize,align,variant}
  function render(el, post, style) {
    const fn = RENDERERS[style.variant] || v_tituloDestaque;
    el.innerHTML = fn(post, style);
  }

  return { VARIANTS, render, fontStack, hexA };
})();
