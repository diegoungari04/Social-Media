/* calendar.js — planejamento de conteúdo em lote + exportação CSV/ICS */
window.Calendar = (function () {
  const $ = (id) => document.getElementById(id);
  const FORMAT_LABEL = { "imagem-unica": "Imagem", quote: "Frase", checklist: "Checklist", carrossel: "Carrossel" };
  const STATUS = ["ideia", "a fazer", "pronto", "publicado"];

  function toISO(d) { return d.toISOString().slice(0, 10); }
  function fmtBR(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  }
  function weekday(iso) {
    const wd = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    return wd[new Date(iso + "T12:00:00").getDay()];
  }

  function computeDates(count, stepDays, startISO) {
    const dates = [];
    let d = startISO ? new Date(startISO + "T12:00:00") : new Date();
    for (let i = 0; i < count; i++) {
      dates.push(toISO(d));
      d = new Date(d.getTime() + stepDays * 86400000);
    }
    return dates;
  }

  async function generatePlan() {
    const manual = window.App.manual;
    if (!(manual.topics || []).length && !manual.niche) {
      hint("Defina pilares/nicho no Manual da Marca primeiro.", "err");
      return;
    }
    const count = +$("cal_count").value;
    const step = +$("cal_freq").value;
    const start = $("cal_start").value || toISO(new Date());
    const objective = $("cal_objective").value;

    hint("Montando calendário", ""); $("calHint").classList.add("dots");
    $("btnPlan").disabled = true;
    try {
      let data;
      if (window.AI.hasKey()) data = await AI.callJSON(Prompts.planSystem(), Prompts.planUser(manual, { count, objective }), 2500);
      else data = Offline.plan(manual, { count });
      const dates = computeDates(count, step, start);
      const items = (data.items || []).slice(0, count).map((it, i) => ({
        id: "c_" + Date.now() + "_" + i,
        date: dates[i],
        pillar: it.pillar || "",
        format: it.format || "imagem-unica",
        title: it.title || "",
        angle: it.angle || "",
        status: "ideia",
        postId: null,
      }));
      Store.saveCalendar(items);
      render();
      $("calHint").classList.remove("dots");
      hint(items.length + " posts planejados ✓", "ok");
    } catch (e) {
      $("calHint").classList.remove("dots");
      hint("Erro: " + e.message, "err");
    } finally {
      $("btnPlan").disabled = false;
    }
  }

  function hint(msg, cls) { const el = $("calHint"); el.textContent = msg || ""; el.className = "hint" + (cls ? " " + cls : ""); }
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function render() {
    const list = $("calList");
    const items = Store.getCalendar();
    if (!items.length) { list.innerHTML = `<p class="muted">Nenhum plano ainda. Clique em "Gerar plano".</p>`; return; }
    list.innerHTML = `
      <div class="cal-row cal-head">
        <div>Data</div><div>Pilar</div><div>Formato</div><div>Tema / ângulo</div><div>Status</div><div></div>
      </div>` +
      items.map((it) => `
      <div class="cal-row" data-id="${it.id}">
        <div class="cal-date"><b>${fmtBR(it.date)}</b><span class="muted small"> ${weekday(it.date)}</span></div>
        <div class="muted small">${esc(it.pillar)}</div>
        <div><span class="chip">${FORMAT_LABEL[it.format] || it.format}</span></div>
        <div><b>${esc(it.title)}</b><div class="muted small">${esc(it.angle)}</div></div>
        <div>
          <select class="cal-status">${STATUS.map((s) => `<option ${s === it.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <div class="cal-actions">
          <button class="btn btn-primary small" data-gen>⚡ Gerar</button>
          <button class="btn btn-ghost small" data-del>🗑</button>
        </div>
      </div>`).join("");

    list.querySelectorAll(".cal-row[data-id]").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector(".cal-status").addEventListener("change", (e) => update(id, { status: e.target.value }));
      row.querySelector("[data-gen]").addEventListener("click", async () => {
        const it = Store.getCalendar().find((x) => x.id === id);
        const post = await window.App.generateForCalendar(it);
        if (post) update(id, { status: "pronto" });
      });
      row.querySelector("[data-del]").addEventListener("click", () => {
        Store.saveCalendar(Store.getCalendar().filter((x) => x.id !== id)); render();
      });
    });
  }

  function update(id, patch) {
    const items = Store.getCalendar();
    const it = items.find((x) => x.id === id);
    if (it) { Object.assign(it, patch); Store.saveCalendar(items); render(); }
  }

  // ---------- export ----------
  function download(name, mime, text) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function csvCell(s) { return `"${String(s == null ? "" : s).replace(/"/g, '""')}"`; }

  function exportCSV() {
    const items = Store.getCalendar();
    if (!items.length) return hint("Nada para exportar.", "err");
    const rows = [["Data", "Pilar", "Formato", "Tema", "Angulo", "Status"]]
      .concat(items.map((it) => [it.date, it.pillar, it.format, it.title, it.angle, it.status]));
    download("calendario-conteudo.csv", "text/csv;charset=utf-8", "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  }

  function exportICS() {
    const items = Store.getCalendar();
    if (!items.length) return hint("Nada para exportar.", "err");
    const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    const ev = items.map((it) => {
      const dt = it.date.replace(/-/g, "");
      const next = it.date.replace(/-/g, ""); // all-day single
      return [
        "BEGIN:VEVENT",
        "UID:" + it.id + "@postforge",
        "DTSTAMP:" + now,
        "DTSTART;VALUE=DATE:" + dt,
        "SUMMARY:" + icsEsc("[" + (FORMAT_LABEL[it.format] || it.format) + "] " + it.title),
        "DESCRIPTION:" + icsEsc((it.pillar ? "Pilar: " + it.pillar + "\\n" : "") + (it.angle || "") + "\\nStatus: " + it.status),
        "END:VEVENT",
      ].join("\r\n");
    }).join("\r\n");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PostForge//Calendario//PT-BR", "CALSCALE:GREGORIAN", ev, "END:VCALENDAR"].join("\r\n");
    download("calendario-conteudo.ics", "text/calendar;charset=utf-8", ics);
  }
  function icsEsc(s) { return String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }

  function bind() {
    $("cal_start").value = toISO(new Date());
    $("btnPlan").addEventListener("click", generatePlan);
    $("btnExportCSV").addEventListener("click", exportCSV);
    $("btnExportICS").addEventListener("click", exportICS);
    $("btnClearCal").addEventListener("click", () => { Store.saveCalendar([]); render(); });
    render();
  }

  return { bind, render };
})();
