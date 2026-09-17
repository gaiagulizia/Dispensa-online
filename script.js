"use strict";

window.addEventListener("DOMContentLoaded", () => {

  // ============================================================
  // TEMA
  // ============================================================
  const temaBtn = document.getElementById("temaBtn");
  function applicaTema(dark) {
    document.body.classList.toggle("dark", dark);
    temaBtn.innerHTML = dark ? "&#9728;" : "&#9790;";
    try { localStorage.setItem("tema", dark ? "dark" : "light"); } catch(e) {}
  }
  (function() {
    let t = "light";
    try { t = localStorage.getItem("tema") || "light"; } catch(e) {}
    applicaTema(t === "dark");
  })();
  temaBtn.addEventListener("click", () => applicaTema(!document.body.classList.contains("dark")));

  // ============================================================
  // NAVIGAZIONE TAB
  // ============================================================
  const tabBtns     = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle("attivo", b.dataset.tab === target));
      tabContents.forEach(c => c.classList.toggle("hidden", c.id !== "tab-" + target));
      if (target === "confronta")    { popolaListaConfronto(); aggiornaGraficiConfronto(); }
      if (target === "unisci")       { popolaListaUnisci(); aggiornaUnisci(); }
      if (target === "calendario")   renderCalendario();
      if (target === "impostazioni") renderImpostazioni();
    });
  });

  // ============================================================
  // CARICAMENTO DATI
  // ============================================================
  function caricaDati(k, fb) {
    try { return JSON.parse(localStorage.getItem(k)) || fb; } catch(e) { return fb; }
  }
  function genId() { return "id_" + Math.random().toString(36).substr(2, 9); }

  let dispensa       = caricaDati("dispensa",       []);
  let tags           = caricaDati("tags",            []);
  let catalogo       = caricaDati("catalogo",        []);
  let micronutrienti = caricaDati("micronutrienti",  []);
  let calendario     = caricaDati("calendario",      {});
  let obiettivi      = caricaDati("obiettivi",       { calorie:2000, proteine:50, carboidrati:250, grassi:70 });

  let filtroTag      = "TUTTI";
  let filtroScadenza = "TUTTI";
  let ordinamento    = "data";
  let indiceInModifica = -1;

  // ============================================================
  // SALVATAGGIO
  // ============================================================
  function salva() {
    try {
      localStorage.setItem("dispensa",       JSON.stringify(dispensa));
      localStorage.setItem("tags",           JSON.stringify(tags));
      localStorage.setItem("catalogo",       JSON.stringify(catalogo));
    } catch(e) { console.warn("salva:", e); }
  }
  function salvaMicronutrienti() {
    try { localStorage.setItem("micronutrienti", JSON.stringify(micronutrienti)); } catch(e) {}
  }
  function salvaCalendario() {
    try { localStorage.setItem("calendario", JSON.stringify(calendario)); } catch(e) {}
  }
  function salvaObiettivi() {
    try { localStorage.setItem("obiettivi", JSON.stringify(obiettivi)); } catch(e) {}
  }

  // ============================================================
  // UNDO / REDO
  // ============================================================
  const undoStack = [], redoStack = [];
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");

  function snapshot() { return JSON.stringify({ dispensa, tags, catalogo }); }
  function pushUndo() { undoStack.push(snapshot()); redoStack.length = 0; aggiornaUndoRedo(); }
  function ripristinaStato(json) {
    const s = JSON.parse(json);
    dispensa = s.dispensa; tags = s.tags; catalogo = s.catalogo;
    salva(); aggiornaTagSelect(); aggiornaTagBar(); render();
  }
  function aggiornaUndoRedo() { undoBtn.disabled = !undoStack.length; redoBtn.disabled = !redoStack.length; }
  undoBtn.addEventListener("click", () => { if (!undoStack.length) return; redoStack.push(snapshot()); ripristinaStato(undoStack.pop()); aggiornaUndoRedo(); });
  redoBtn.addEventListener("click", () => { if (!redoStack.length) return; undoStack.push(snapshot()); ripristinaStato(redoStack.pop()); aggiornaUndoRedo(); });

  // ============================================================
  // AUTOCOMPLETE
  // ============================================================
  const nomeInput = document.getElementById("nome");
  const suggerimenti = document.getElementById("suggerimenti");
  nomeInput.addEventListener("input", () => {
    const val = nomeInput.value.trim().toLowerCase();
    suggerimenti.innerHTML = "";
    if (!val) { suggerimenti.classList.add("hidden"); return; }
    const matches = catalogo.filter(p => p.nome.toLowerCase().includes(val));
    if (!matches.length) { suggerimenti.classList.add("hidden"); return; }
    suggerimenti.classList.remove("hidden");
    matches.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p.nome;
      li.addEventListener("click", () => {
        nomeInput.value = p.nome;
        document.getElementById("calorie").value     = p.calorie     || "";
        document.getElementById("proteine").value    = p.proteine    || "";
        document.getElementById("carboidrati").value = p.carboidrati || "";
        document.getElementById("grassi").value      = p.grassi      || "";
        if (p.tag && tags.includes(p.tag)) { document.getElementById("tagSelect").value = p.tag; document.getElementById("tagInput").value = ""; }
        else if (p.tag) { document.getElementById("tagInput").value = p.tag; }
        // Ripristina mn
        if (p.micronutrienti) {
          document.querySelectorAll("#mnCheckboxList .mn-checkbox-item").forEach(el => {
            el.classList.toggle("selezionato", p.micronutrienti.includes(el.dataset.mnId));
          });
        }
        suggerimenti.classList.add("hidden");
      });
      suggerimenti.appendChild(li);
    });
  });
  document.addEventListener("click", e => { if (!e.target.closest(".autocomplete-wrapper")) suggerimenti.classList.add("hidden"); });

  // ============================================================
  // MICRONUTRIENTI — checkbox list in form
  // ============================================================
  function aggiornaMnCheckboxList(containerId, selectedIds) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    if (!micronutrienti.length) {
      container.innerHTML = `<span style="font-size:12px;color:var(--text-muted);">Nessun micronutriente in Impostazioni.</span>`;
      return;
    }
    micronutrienti.forEach(mn => {
      const item = document.createElement("label");
      item.className = "mn-checkbox-item" + (selectedIds && selectedIds.includes(mn.id) ? " selezionato" : "");
      item.dataset.mnId = mn.id;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selectedIds && selectedIds.includes(mn.id);
      const dot = document.createElement("span");
      dot.className = "mn-dot";
      dot.style.background = mn.colore;
      const lbl = document.createElement("span");
      lbl.textContent = mn.nome;
      item.appendChild(cb);
      item.appendChild(dot);
      item.appendChild(lbl);
      item.addEventListener("click", e => {
        e.preventDefault();
        item.classList.toggle("selezionato");
        cb.checked = item.classList.contains("selezionato");
      });
      container.appendChild(item);
    });
  }

  function getMnSelezionati(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .mn-checkbox-item.selezionato`))
      .map(el => el.dataset.mnId);
  }

  // ============================================================
  // TAG SELECT
  // ============================================================
  function aggiornaTagSelect() {
    const ts = document.getElementById("tagSelect");
    const et = document.getElementById("editTag");
    ts.innerHTML = `<option value="">Tag esistenti</option>`;
    et.innerHTML = "";
    tags.forEach(t => {
      const o1 = document.createElement("option"); o1.value = t; o1.textContent = t; ts.appendChild(o1);
      const o2 = document.createElement("option"); o2.value = t; o2.textContent = t; et.appendChild(o2);
    });
  }

  // ============================================================
  // TAG BAR
  // ============================================================
  const tagBar = document.getElementById("tagBar");
  function aggiornaTagBar() {
    tagBar.innerHTML = "";
    const tagsAttivi = ["TUTTI", ...tags.filter(t => dispensa.some(p => p.tag === t))];
    tagsAttivi.forEach(t => {
      const chip = document.createElement("button");
      chip.className = "tag-chip" + (filtroTag === t ? " attivo" : "");
      chip.textContent = t;
      chip.addEventListener("click", () => { filtroTag = t; aggiornaTagBar(); render(); });
      tagBar.appendChild(chip);
    });
    if (tags.length > 0) {
      const g = document.createElement("button");
      g.className = "tag-chip tag-chip-gestisci";
      g.textContent = "Gestisci tag...";
      g.addEventListener("click", apriModaleTag);
      tagBar.appendChild(g);
    }
  }

  // ============================================================
  // MODALE GESTIONE TAG
  // ============================================================
  const modaleTag = document.getElementById("modaleTag");
  const listaTagGest = document.getElementById("listaTagGestione");
  function pulisciDragResidui() {
    document.querySelectorAll(".tag-ghost").forEach(g => g.remove());
    document.querySelectorAll("#listaTagGestione li.dragging-source").forEach(l => l.classList.remove("dragging-source"));
  }
  function apriModaleTag() {
    pulisciDragResidui();
    listaTagGest.innerHTML = "";
    if (!tags.length) { listaTagGest.innerHTML = `<li style="color:var(--text-muted);font-style:italic;">Nessun tag.</li>`; }
    else {
      tags.forEach((t, i) => {
        const li = document.createElement("li");
        const handle = document.createElement("span"); handle.className = "tag-drag-handle"; handle.textContent = "\u2630";
        const inp = document.createElement("input"); inp.className = "tag-edit-input"; inp.value = t;
        const btnS = document.createElement("button"); btnS.className = "btn-tag-salva"; btnS.textContent = "Salva";
        btnS.addEventListener("click", () => {
          const n = inp.value.trim();
          if (!n) { alert("Il nome non puo essere vuoto."); return; }
          if (n === t) return;
          pushUndo();
          dispensa.forEach(p => { if (p.tag === t) p.tag = n; });
          catalogo.forEach(p => { if (p.tag === t) p.tag = n; });
          tags[i] = n; if (filtroTag === t) filtroTag = n;
          salva(); aggiornaTagSelect(); aggiornaTagBar(); render(); apriModaleTag();
        });
        const btnE = document.createElement("button"); btnE.className = "btn-tag-elimina"; btnE.textContent = "Elimina";
        btnE.addEventListener("click", () => {
          const inUso = dispensa.some(p => p.tag === t);
          if (inUso && !confirm(`Eliminare il tag "${t}"?`)) return;
          pushUndo();
          dispensa.forEach(p => { if (p.tag === t) p.tag = ""; });
          catalogo.forEach(p => { if (p.tag === t) p.tag = ""; });
          tags.splice(i, 1); if (filtroTag === t) filtroTag = "TUTTI";
          salva(); aggiornaTagSelect(); aggiornaTagBar(); render(); apriModaleTag();
        });
        li.dataset.tagName = t;
        li.appendChild(handle); li.appendChild(inp); li.appendChild(btnS); li.appendChild(btnE);
        listaTagGest.appendChild(li);
        abilitaDragTag(li, handle);
      });
    }
    modaleTag.classList.remove("hidden");
  }
  document.getElementById("chiudiModaleTag").addEventListener("click", () => { pulisciDragResidui(); modaleTag.classList.add("hidden"); });
  modaleTag.addEventListener("click", e => { if (e.target === modaleTag) { pulisciDragResidui(); modaleTag.classList.add("hidden"); } });

  // Drag tag
  function abilitaDragTag(li, handle) {
    let timer = null, dragging = false, startX = 0, startY = 0, ghost = null, ghostOffY = 0;
    function creaGhost(y) {
      const r = li.getBoundingClientRect();
      ghost = li.cloneNode(true); ghost.classList.add("tag-ghost");
      ghost.style.left = r.left + "px"; ghost.style.top = r.top + "px"; ghost.style.width = r.width + "px";
      document.body.appendChild(ghost); ghostOffY = y - r.top; li.classList.add("dragging-source");
    }
    function valutaScambio(y) {
      const ch = Array.from(listaTagGest.children), idx = ch.indexOf(li);
      for (let i = 0; i < ch.length; i++) {
        if (ch[i] === li) continue;
        const r = ch[i].getBoundingClientRect(), mid = r.top + r.height / 2;
        if (i < idx && y < mid) { listaTagGest.insertBefore(li, ch[i]); return; }
        if (i > idx && y > mid) { listaTagGest.insertBefore(li, ch[i].nextSibling); return; }
      }
    }
    function onMove(e) {
      if (!dragging) { if (Math.abs(e.clientY - startY) > 10 || Math.abs(e.clientX - startX) > 10) clearTimeout(timer); return; }
      if (e.cancelable) e.preventDefault();
      ghost.style.top = (e.clientY - ghostOffY) + "px";
      valutaScambio(e.clientY);
    }
    function onEnd() {
      clearTimeout(timer);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
      if (dragging) { dragging = false; pulisciDragResidui(); finalizzaOrdineTag(); }
    }
    handle.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX; startY = e.clientY;
      timer = setTimeout(() => { dragging = true; creaGhost(startY); }, 350);
      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", onEnd);
      document.addEventListener("pointercancel", onEnd);
    });
    handle.addEventListener("contextmenu", e => e.preventDefault());
  }
  function finalizzaOrdineTag() {
    const nuovo = Array.from(listaTagGest.children).map(el => el.dataset.tagName).filter(Boolean);
    if (nuovo.length === tags.length) { pushUndo(); tags = nuovo; salva(); aggiornaTagSelect(); aggiornaTagBar(); apriModaleTag(); }
  }

  // ============================================================
  // MODALE MODIFICA PRODOTTO
  // ============================================================
  const modaleModifica = document.getElementById("modaleModifica");
  function apriModaleModifica(idx) {
    indiceInModifica = idx;
    const p = dispensa[idx];
    document.getElementById("editNome").value        = p.nome        || "";
    document.getElementById("editScadenza").value    = p.scadenza    || "";
    document.getElementById("editQuantita").value    = p.quantita    || "";
    document.getElementById("editUnita").value       = p.unita       || "pz";
    document.getElementById("editCalorie").value     = p.calorie     || "";
    document.getElementById("editProteine").value    = p.proteine    || "";
    document.getElementById("editCarboidrati").value = p.carboidrati || "";
    document.getElementById("editGrassi").value      = p.grassi      || "";
    aggiornaTagSelect(); if (p.tag) document.getElementById("editTag").value = p.tag;
    aggiornaMnCheckboxList("editMnCheckboxList", p.micronutrienti || []);
    modaleModifica.classList.remove("hidden");
  }
  document.getElementById("salvaModifica").addEventListener("click", () => {
    if (indiceInModifica < 0) return;
    const nome = document.getElementById("editNome").value.trim();
    if (!nome) { alert("Il nome non puo essere vuoto."); return; }
    pushUndo();
    const p = dispensa[indiceInModifica];
    p.nome = nome; p.scadenza = document.getElementById("editScadenza").value;
    p.quantita = document.getElementById("editQuantita").value; p.unita = document.getElementById("editUnita").value;
    p.tag = document.getElementById("editTag").value;
    p.calorie = document.getElementById("editCalorie").value.trim();
    p.proteine = document.getElementById("editProteine").value.trim();
    p.carboidrati = document.getElementById("editCarboidrati").value.trim();
    p.grassi = document.getElementById("editGrassi").value.trim();
    p.micronutrienti = getMnSelezionati("editMnCheckboxList");
    const ci = catalogo.findIndex(c => c.nome.toLowerCase() === nome.toLowerCase());
    if (ci !== -1) Object.assign(catalogo[ci], p);
    salva(); aggiornaTagBar(); render(); modaleModifica.classList.add("hidden"); indiceInModifica = -1;
  });
  function chiudiEdit() { modaleModifica.classList.add("hidden"); indiceInModifica = -1; }
  document.getElementById("chiudiModifica").addEventListener("click", chiudiEdit);
  modaleModifica.addEventListener("click", e => { if (e.target === modaleModifica) chiudiEdit(); });

  // ============================================================
  // FILTRI & ORDINAMENTO
  // ============================================================
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    if (!btn.closest(".andamento-periodo-bar")) {
      btn.addEventListener("click", () => {
        filtroScadenza = btn.dataset.filtro;
        document.querySelectorAll(".filtri-scadenza .filtro-btn").forEach(b => b.classList.remove("attivo"));
        btn.classList.add("attivo"); render();
      });
    }
  });
  const ordinaSelect = document.getElementById("ordinaSelect");
  ordinaSelect.addEventListener("change", () => { ordinamento = ordinaSelect.value; render(); });

  function applicaOrdinamento(lista) {
    const c = [...lista];
    switch (ordinamento) {
      case "scadenza_asc": c.sort((a,b) => { if (!a.scadenza && !b.scadenza) return 0; if (!a.scadenza) return 1; if (!b.scadenza) return -1; return new Date(a.scadenza) - new Date(b.scadenza); }); break;
      case "alfabetico":      c.sort((a,b) => a.nome.localeCompare(b.nome,"it")); break;
      case "calorie_desc":    c.sort((a,b) => (parseFloat(b.calorie)||0)     - (parseFloat(a.calorie)||0));     break;
      case "calorie_asc":     c.sort((a,b) => (parseFloat(a.calorie)||0)     - (parseFloat(b.calorie)||0));     break;
      case "proteine_desc":   c.sort((a,b) => (parseFloat(b.proteine)||0)    - (parseFloat(a.proteine)||0));    break;
      case "proteine_asc":    c.sort((a,b) => (parseFloat(a.proteine)||0)    - (parseFloat(b.proteine)||0));    break;
      case "carboidrati_desc":c.sort((a,b) => (parseFloat(b.carboidrati)||0) - (parseFloat(a.carboidrati)||0)); break;
      case "carboidrati_asc": c.sort((a,b) => (parseFloat(a.carboidrati)||0) - (parseFloat(b.carboidrati)||0)); break;
      case "grassi_desc":     c.sort((a,b) => (parseFloat(b.grassi)||0)      - (parseFloat(a.grassi)||0));      break;
      case "grassi_asc":      c.sort((a,b) => (parseFloat(a.grassi)||0)      - (parseFloat(b.grassi)||0));      break;
    }
    return c;
  }

  // ============================================================
  // TORTA SVG (dispensa)
  // ============================================================
  const PIE = { proteine: "#8e94f2", carboidrati: "#ee8434", grassi: "#a1da4c" };

  function buildPie(carb, prot, gras) {
    const c = parseFloat(carb)||0, pr = parseFloat(prot)||0, g = parseFloat(gras)||0, tot = c+pr+g;
    const wrap = document.createElement("div"); wrap.className = "pie-container";
    if (tot === 0) { const msg = document.createElement("span"); msg.style.cssText="font-size:12px;color:var(--text-muted);"; msg.textContent="Nessun dato"; wrap.appendChild(msg); return wrap; }
    const slices = [{ label:"Prot.",v:pr,col:PIE.proteine },{ label:"Carb.",v:c,col:PIE.carboidrati },{ label:"Grassi",v:g,col:PIE.grassi }].filter(s=>s.v>0);
    const NS="http://www.w3.org/2000/svg", svg=document.createElementNS(NS,"svg");
    svg.setAttribute("viewBox","0 0 100 100"); const R=46,cx=50,cy=50; let ang=0;
    slices.forEach(s => {
      const d2=s.v/tot*2*Math.PI, en=ang+d2; let d;
      if (slices.length===1) d=`M ${cx} ${cy-R} A ${R} ${R} 0 1 1 ${cx-0.001} ${cy-R} Z`;
      else { const x1=cx+R*Math.cos(ang),y1=cy+R*Math.sin(ang),x2=cx+R*Math.cos(en),y2=cy+R*Math.sin(en); d=`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${d2>Math.PI?1:0} 1 ${x2} ${y2} Z`; }
      const path=document.createElementNS(NS,"path"); path.setAttribute("d",d); path.setAttribute("fill",s.col); path.setAttribute("class","pie-slice"); svg.appendChild(path); ang=en;
    });
    wrap.appendChild(svg);
    const leg=document.createElement("div"); leg.className="pie-legend";
    slices.forEach(s => {
      const pct=Math.round(s.v/tot*100), item=document.createElement("div"); item.className="pie-legend-item";
      const dot=document.createElement("span"); dot.className="pie-dot"; dot.style.background=s.col;
      const lbl=document.createElement("span"); lbl.textContent=s.label;
      const pctS=document.createElement("span"); pctS.className="pie-pct"; pctS.textContent=" "+pct+"%";
      item.appendChild(dot); item.appendChild(lbl); item.appendChild(pctS); leg.appendChild(item);
    });
    wrap.appendChild(leg); return wrap;
  }

  // ============================================================
  // RENDER DISPENSA
  // ============================================================
  const dispensaDiv = document.getElementById("dispensa");
  function creaCardProdotto(p) {
    let classe = "";
    if (p.scadenza) { const diff=(new Date(p.scadenza)-new Date())/86400000; classe=diff<0?"scaduto":diff<30?"scadenza-vicina":"scadenza-ok"; }
    const cals=p.calorie?p.calorie+" kcal":"—", prots=p.proteine?p.proteine+" g":"—";
    const carbs=p.carboidrati?p.carboidrati+" g":"—", fats=p.grassi?p.grassi+" g":"—";
    const qta=p.quantita?p.quantita+" "+(p.unita||""):"";
    const card=document.createElement("div"); card.className="prodotto "+classe;
    const nomeEl=document.createElement("div"); nomeEl.className="prodotto-nome"+(p.expanded?" aperto":"");
    const ch=document.createElement("span"); ch.className="chevron"; ch.textContent="\u25B6"; nomeEl.appendChild(ch);
    nomeEl.appendChild(document.createTextNode(p.nome));
    if (qta) { const q=document.createElement("span"); q.style.cssText="font-weight:normal;font-size:13px;color:var(--text-muted);margin-left:4px;"; q.textContent="("+qta.trim()+")"; nomeEl.appendChild(q); }
    const dataEl=document.createElement("p"); dataEl.className="prodotto-data"; dataEl.textContent="Scadenza: "+(p.scadenza||"non impostata");
    // Micronutrienti dots sul prodotto
    const mnDotsWrap = document.createElement("div"); mnDotsWrap.className = "prodotto-mn-dots";
    (p.micronutrienti||[]).forEach(mnId => {
      const mn = micronutrienti.find(m => m.id === mnId);
      if (!mn) return;
      const dot = document.createElement("span"); dot.className = "cal-dot"; dot.style.background = mn.colore; dot.title = mn.nome;
      mnDotsWrap.appendChild(dot);
    });
    const extra=document.createElement("div"); extra.className="extra"; extra.style.display=p.expanded?"block":"none";
    const inner=document.createElement("div"); inner.className="extra-inner";
    const valori=document.createElement("div"); valori.className="extra-valori";
    [{ l:"Valori per 100g:",b:true },{ l:"Calorie: "+cals },{ l:"Proteine: "+prots,c:PIE.proteine },{ l:"Carboidrati: "+carbs,c:"#b08800" },{ l:"Grassi: "+fats,c:PIE.grassi }]
      .forEach(r => { const el=document.createElement("p"); if(r.b){ const s=document.createElement("strong"); s.textContent=r.l; el.appendChild(s); } else el.textContent=r.l; if(r.c){el.style.color=r.c;el.style.fontWeight="600";} valori.appendChild(el); });
    // Micronutrienti nel dettaglio
    if ((p.micronutrienti||[]).length) {
      const mnSec = document.createElement("div"); mnSec.style.cssText="margin-top:8px;";
      const mnLbl = document.createElement("p"); mnLbl.style.cssText="font-size:12px;color:var(--text-muted);margin-bottom:4px;"; mnLbl.textContent="Micronutrienti:";
      const mnRow = document.createElement("div"); mnRow.className="riepilogo-mn-dots";
      (p.micronutrienti||[]).forEach(mnId => {
        const mn=micronutrienti.find(m=>m.id===mnId); if(!mn) return;
        const chip=document.createElement("div"); chip.className="riepilogo-mn-chip";
        chip.innerHTML=`<span class="cal-dot" style="background:${mn.colore}"></span><span>${mn.nome}</span>`;
        mnRow.appendChild(chip);
      });
      mnSec.appendChild(mnLbl); mnSec.appendChild(mnRow); valori.appendChild(mnSec);
    }
    inner.appendChild(valori); inner.appendChild(buildPie(p.carboidrati,p.proteine,p.grassi)); extra.appendChild(inner);
    const azioni=document.createElement("div"); azioni.className="prodotto-azioni";
    const btnM=document.createElement("button"); btnM.className="btn-modifica"; btnM.textContent="Modifica";
    btnM.addEventListener("click",e=>{e.stopPropagation();apriModaleModifica(p.realIndex);});
    const btnR=document.createElement("button"); btnR.className="btn-rimuovi"; btnR.textContent="Rimuovi";
    btnR.addEventListener("click",e=>{e.stopPropagation();rimuovi(p.realIndex);});
    azioni.appendChild(btnM); azioni.appendChild(btnR); extra.appendChild(azioni);
    card.appendChild(nomeEl); card.appendChild(dataEl);
    if ((p.micronutrienti||[]).length) card.appendChild(mnDotsWrap);
    card.appendChild(extra);
    nomeEl.addEventListener("click",e=>{e.stopPropagation();dispensa[p.realIndex].expanded=!dispensa[p.realIndex].expanded;salva();render();});
    return card;
  }

  function render() {
    dispensaDiv.innerHTML = "";
    let lista = [...dispensa];
    if (filtroTag !== "TUTTI") lista = lista.filter(p => p.tag === filtroTag);
    if (filtroScadenza === "7") lista = lista.filter(p => { if (!p.scadenza) return false; const d=(new Date(p.scadenza)-new Date())/86400000; return d>=0&&d<=7; });
    else if (filtroScadenza === "30") lista = lista.filter(p => { if (!p.scadenza) return false; const d=(new Date(p.scadenza)-new Date())/86400000; return d>=0&&d<=30; });
    lista = applicaOrdinamento(lista);
    if (!lista.length) { const m=document.createElement("p"); m.style.cssText="color:var(--text-muted);text-align:center;margin-top:20px;font-style:italic;"; m.textContent="Nessun prodotto trovato."; dispensaDiv.appendChild(m); return; }
    if (ordinamento === "data") {
      const gruppi={}, ordG=[];
      lista.forEach(p => { const ri=dispensa.indexOf(p),k=p.tag||""; if(!gruppi[k]){gruppi[k]=[];ordG.push(k);} gruppi[k].push({...p,realIndex:ri}); });
      ordG.forEach(tag => {
        const t=document.createElement("div"); t.className="tag-title"; t.textContent=tag||"Senza tag"; dispensaDiv.appendChild(t);
        gruppi[tag].forEach(p => dispensaDiv.appendChild(creaCardProdotto(p)));
      });
    } else {
      lista.forEach(p => { const ri=dispensa.indexOf(p); dispensaDiv.appendChild(creaCardProdotto({...p,realIndex:ri})); });
    }
  }

  // ============================================================
  // AGGIUNGI PRODOTTO
  // ============================================================
  const addBtn = document.getElementById("addBtn");
  addBtn.addEventListener("click", () => {
    const tag = document.getElementById("tagInput").value.trim() || document.getElementById("tagSelect").value;
    if (!tag) { alert("Seleziona o inserisci un tag."); return; }
    const nome = nomeInput.value.trim();
    if (!nome) { alert("Il nome del prodotto e obbligatorio."); return; }
    pushUndo(); if (!tags.includes(tag)) tags.push(tag);
    const prodotto = {
      nome, scadenza: document.getElementById("scadenza").value,
      quantita: document.getElementById("quantita").value, unita: document.getElementById("unitaSelect").value,
      calorie: document.getElementById("calorie").value.trim(), proteine: document.getElementById("proteine").value.trim(),
      carboidrati: document.getElementById("carboidrati").value.trim(), grassi: document.getElementById("grassi").value.trim(),
      micronutrienti: getMnSelezionati("mnCheckboxList"), tag, expanded: false
    };
    const ci = catalogo.findIndex(p => p.nome.toLowerCase() === nome.toLowerCase());
    if (ci === -1) catalogo.push({...prodotto});
    else { const sc=catalogo[ci].scadenza; Object.assign(catalogo[ci],prodotto); catalogo[ci].scadenza=sc; }
    dispensa.push(prodotto); salva(); aggiornaTagSelect(); aggiornaTagBar(); render();
    ["nome","scadenza","quantita","tagInput","calorie","proteine","carboidrati","grassi"].forEach(id => document.getElementById(id).value="");
    document.getElementById("tagSelect").value=""; document.getElementById("unitaSelect").value="pz";
    document.querySelectorAll("#mnCheckboxList .mn-checkbox-item").forEach(el => el.classList.remove("selezionato"));
    document.querySelector('.tab-btn[data-tab="dispensa"]').click();
  });

  // ============================================================
  // RIMUOVI
  // ============================================================
  function rimuovi(i) { pushUndo(); dispensa.splice(i,1); salva(); aggiornaTagBar(); render(); }

  // ============================================================
  // CONFRONTA
  // ============================================================
  const confrontoLista   = document.getElementById("confrontoLista");
  const confrontoGrafici = document.getElementById("confrontoGrafici");
  const confrontoRicerca = document.getElementById("confrontoRicerca");
  const COLORI_CONFRONTO = { calorie:"#4E86C8", proteine:PIE.proteine, carboidrati:PIE.carboidrati, grassi:PIE.grassi };
  const CONFRONTO_METRICHE = [
    { chiave:"calorie",     etichetta:"Calorie",     unita:"kcal", colore:COLORI_CONFRONTO.calorie     },
    { chiave:"proteine",    etichetta:"Proteine",    unita:"g",    colore:COLORI_CONFRONTO.proteine    },
    { chiave:"carboidrati", etichetta:"Carboidrati", unita:"g",    colore:COLORI_CONFRONTO.carboidrati },
    { chiave:"grassi",      etichetta:"Grassi",      unita:"g",    colore:COLORI_CONFRONTO.grassi      },
  ];
  let confrontoSelezionati = [];
  confrontoRicerca.addEventListener("input", () => popolaListaConfronto());
  document.getElementById("confrontoCancella").addEventListener("click", () => { confrontoSelezionati=[]; confrontoRicerca.value=""; popolaListaConfronto(); aggiornaGraficiConfronto(); });

  function popolaListaConfronto() {
    confrontoLista.innerHTML = "";
    if (!dispensa.length) { confrontoLista.innerHTML=`<p class="confronto-vuoto">Non ci sono alimenti in dispensa.</p>`; return; }
    const query = confrontoRicerca.value.trim().toLowerCase();
    const voci = dispensa.map((p,idx)=>({idx,p})).sort((a,b)=>a.p.nome.localeCompare(b.p.nome,"it"));
    const filt = query ? voci.filter(({p})=>p.nome.toLowerCase().includes(query)||(p.tag||"").toLowerCase().includes(query)) : voci;
    if (!filt.length) { confrontoLista.innerHTML=`<p class="confronto-vuoto">Nessun alimento trovato.</p>`; return; }
    const pieno = confrontoSelezionati.length >= 5;
    filt.forEach(({idx,p}) => {
      const isSel = confrontoSelezionati.includes(idx);
      const item = document.createElement("label");
      item.className = "confronto-item"+(isSel?" selezionato":"")+((!isSel&&pieno)?" disabilitato":"");
      const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=isSel; cb.disabled=!isSel&&pieno;
      const ns=document.createElement("span"); ns.className="confronto-nome"; ns.textContent=p.nome;
      const ts=document.createElement("span"); ts.className="confronto-tag"; ts.textContent=p.tag||"Senza tag";
      cb.addEventListener("change",()=>{
        if (cb.checked){ if(confrontoSelezionati.length>=5){cb.checked=false;alert("Max 5 alimenti.");return;} confrontoSelezionati.push(idx); }
        else confrontoSelezionati=confrontoSelezionati.filter(i=>i!==idx);
        popolaListaConfronto(); aggiornaGraficiConfronto();
      });
      item.appendChild(cb); item.appendChild(ns); item.appendChild(ts); confrontoLista.appendChild(item);
    });
  }

  function aggiornaGraficiConfronto() {
    confrontoGrafici.innerHTML = "";
    if (!confrontoSelezionati.length) { confrontoGrafici.innerHTML=`<p class="confronto-vuoto">Seleziona almeno un alimento per vedere il confronto.</p>`; return; }
    const foods = confrontoSelezionati.map(i => dispensa[i]).filter(Boolean);
    CONFRONTO_METRICHE.forEach(m => confrontoGrafici.appendChild(buildBarChart(m,foods)));
  }

  function buildBarChart(metrica, foods) {
    const wrap = document.createElement("div"); wrap.className = "confronto-grafico-blocco";
    const titolo = document.createElement("h4"); titolo.style.color = metrica.colore;
    titolo.textContent = `${metrica.etichetta} (${metrica.unita} per 100g)`; wrap.appendChild(titolo);
    const valori = foods.map(f => parseFloat(f[metrica.chiave])||0);
    const maxV = Math.max(...valori, 1);
    const W=400, barH=22, gap=10, padL=8, padT=4;
    const svgH = foods.length*(barH+gap)+padT;
    const NS="http://www.w3.org/2000/svg", svg=document.createElementNS(NS,"svg");
    svg.setAttribute("viewBox",`0 0 ${W} ${svgH}`); svg.setAttribute("class","andamento-svg");
    foods.forEach((f,i) => {
      const v=valori[i], barW=Math.max(2,(v/maxV)*(W-80)), y=padT+i*(barH+gap);
      const rect=document.createElementNS(NS,"rect"); rect.setAttribute("x",padL); rect.setAttribute("y",y); rect.setAttribute("width",barW); rect.setAttribute("height",barH); rect.setAttribute("fill",metrica.colore); rect.setAttribute("rx","4"); svg.appendChild(rect);
      const lbl=document.createElementNS(NS,"text"); lbl.setAttribute("x",padL+barW+6); lbl.setAttribute("y",y+barH/2+5); lbl.setAttribute("font-size","12"); lbl.setAttribute("class","barra-valore"); lbl.textContent=v+` ${metrica.unita}`; svg.appendChild(lbl);
      const nm=document.createElementNS(NS,"text"); nm.setAttribute("x",padL); nm.setAttribute("y",y-3); nm.setAttribute("font-size","11"); nm.setAttribute("class","barra-nome"); nm.textContent=f.nome; svg.appendChild(nm);
    });
    wrap.appendChild(svg); return wrap;
  }

  // ============================================================
  // UNISCI
  // ============================================================
  const unisciLista      = document.getElementById("unisciLista");
  const unisciRicerca    = document.getElementById("unisciRicerca");
  const unisciGrammiBox  = document.getElementById("unisciGrammiBox");
  const unisciGrammiLista= document.getElementById("unisciGrammiLista");
  const unisciRisultato  = document.getElementById("unisciRisultato");
  const unisciPieSvg     = document.getElementById("unisciPieSvg");
  const unisciLeggenda   = document.getElementById("unisciLeggenda");
  const unisciValori     = document.getElementById("unisciValori");
  const unisciVuoto      = document.getElementById("unisciVuoto");
  let unisciSelezionati  = {};
  unisciRicerca.addEventListener("input", () => popolaListaUnisci());
  document.getElementById("unisciCancella").addEventListener("click", () => { unisciSelezionati={}; unisciRicerca.value=""; popolaListaUnisci(); aggiornaUnisci(); });

  function popolaListaUnisci() {
    unisciLista.innerHTML = "";
    if (!dispensa.length) { unisciLista.innerHTML=`<p class="confronto-vuoto">Non ci sono alimenti in dispensa.</p>`; }
    else {
      const q=unisciRicerca.value.trim().toLowerCase();
      const voci=dispensa.map((p,i)=>({idx:i,p})).sort((a,b)=>a.p.nome.localeCompare(b.p.nome,"it"));
      const filt=q?voci.filter(({p})=>p.nome.toLowerCase().includes(q)||(p.tag||"").toLowerCase().includes(q)):voci;
      if (!filt.length) { unisciLista.innerHTML=`<p class="confronto-vuoto">Nessun alimento trovato.</p>`; }
      else {
        const pieno=Object.keys(unisciSelezionati).length>=10;
        filt.forEach(({idx,p})=>{
          const isSel=idx in unisciSelezionati;
          const item=document.createElement("label"); item.className="confronto-item"+(isSel?" selezionato":"")+((!isSel&&pieno)?" disabilitato":"");
          const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=isSel; cb.disabled=!isSel&&pieno;
          const ns=document.createElement("span"); ns.className="confronto-nome"; ns.textContent=p.nome;
          const ts=document.createElement("span"); ts.className="confronto-tag"; ts.textContent=p.tag||"Senza tag";
          cb.addEventListener("change",()=>{
            if(cb.checked){if(Object.keys(unisciSelezionati).length>=10){cb.checked=false;alert("Max 10 alimenti.");return;} unisciSelezionati[idx]=100;}
            else delete unisciSelezionati[idx];
            popolaListaUnisci(); aggiornaUnisci();
          });
          item.appendChild(cb); item.appendChild(ns); item.appendChild(ts); unisciLista.appendChild(item);
        });
      }
    }
    popolaGrammiUnisci();
  }

  function popolaGrammiUnisci() {
    unisciGrammiLista.innerHTML = "";
    const sel=Object.keys(unisciSelezionati).map(i=>({idx:+i,p:dispensa[+i]})).filter(x=>!!x.p).sort((a,b)=>a.p.nome.localeCompare(b.p.nome,"it"));
    if (!sel.length) { unisciGrammiBox.classList.add("hidden"); return; }
    unisciGrammiBox.classList.remove("hidden");
    sel.forEach(({idx,p})=>{
      const row=document.createElement("div"); row.className="unisci-grammi-row";
      const nm=document.createElement("span"); nm.className="unisci-grammi-nome"; nm.textContent=p.nome;
      const inp=document.createElement("input"); inp.type="number"; inp.min="0"; inp.step="1"; inp.value=unisciSelezionati[idx]; inp.className="unisci-grammi-input"; inp.inputMode="decimal";
      inp.addEventListener("input",()=>{ const v=parseFloat(inp.value); unisciSelezionati[idx]=isNaN(v)||v<0?0:v; aggiornaUnisci(); });
      const unit=document.createElement("span"); unit.className="unisci-grammi-unit"; unit.textContent="g";
      row.appendChild(nm); row.appendChild(inp); row.appendChild(unit); unisciGrammiLista.appendChild(row);
    });
  }

  function aggiornaUnisci() {
    const sel=Object.keys(unisciSelezionati);
    if (!sel.length) { unisciRisultato.classList.add("hidden"); unisciVuoto.classList.remove("hidden"); return; }
    unisciVuoto.classList.add("hidden"); unisciRisultato.classList.remove("hidden");
    let tC=0,tP=0,tCb=0,tG=0;
    sel.forEach(i=>{ const p=dispensa[+i],f=(unisciSelezionati[+i]||0)/100; if(!p)return; tC+=(parseFloat(p.calorie)||0)*f; tP+=(parseFloat(p.proteine)||0)*f; tCb+=(parseFloat(p.carboidrati)||0)*f; tG+=(parseFloat(p.grassi)||0)*f; });
    const totM=tP+tCb+tG;
    const slices=[{l:"Prot.",v:tP,c:PIE.proteine},{l:"Carb.",v:tCb,c:PIE.carboidrati},{l:"Grassi",v:tG,c:PIE.grassi}].filter(s=>s.v>0);
    disegnaTortaUnisci(slices,totM); disegnaLeggendaUnisci(slices,totM); disegnaValoriUnisci(tC,tP,tCb,tG);
  }

  function disegnaTortaUnisci(slices,tot) {
    const NS="http://www.w3.org/2000/svg"; unisciPieSvg.innerHTML="";
    if (!slices.length||tot===0) { const ci=document.createElementNS(NS,"circle"); ci.setAttribute("cx","100"); ci.setAttribute("cy","100"); ci.setAttribute("r","90"); ci.setAttribute("fill","var(--border)"); unisciPieSvg.appendChild(ci); return; }
    const R=90,cx=100,cy=100; let ang=0;
    slices.forEach(s=>{ const d2=s.v/tot*2*Math.PI,en=ang+d2; let d;
      if(slices.length===1) d=`M ${cx} ${cy-R} A ${R} ${R} 0 1 1 ${cx-0.001} ${cy-R} Z`;
      else { const x1=cx+R*Math.cos(ang),y1=cy+R*Math.sin(ang),x2=cx+R*Math.cos(en),y2=cy+R*Math.sin(en); d=`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${d2>Math.PI?1:0} 1 ${x2} ${y2} Z`; }
      const path=document.createElementNS(NS,"path"); path.setAttribute("d",d); path.setAttribute("fill",s.c); unisciPieSvg.appendChild(path); ang=en;
    });
  }

  function disegnaLeggendaUnisci(slices,tot) {
    unisciLeggenda.innerHTML="";
    slices.forEach(s=>{ const pct=tot>0?Math.round(s.v/tot*100):0, row=document.createElement("div"); row.className="unisci-leggenda-item";
      const dot=document.createElement("span"); dot.className="unisci-leggenda-dot"; dot.style.background=s.c;
      const lbl=document.createElement("span"); lbl.className="unisci-leggenda-label"; lbl.textContent=s.l;
      const pctS=document.createElement("span"); pctS.className="unisci-leggenda-pct"; pctS.textContent=pct+"%";
      row.appendChild(dot); row.appendChild(lbl); row.appendChild(pctS); unisciLeggenda.appendChild(row);
    });
  }

  function disegnaValoriUnisci(cal,prot,carb,gras) {
    unisciValori.innerHTML="";
    [{l:"Calorie",v:Math.round(cal*10)/10,u:"kcal",c:"#4E86C8"},{l:"Proteine",v:Math.round(prot*10)/10,u:"g",c:PIE.proteine},{l:"Carboidrati",v:Math.round(carb*10)/10,u:"g",c:PIE.carboidrati},{l:"Grassi",v:Math.round(gras*10)/10,u:"g",c:PIE.grassi}]
      .forEach(d=>{ const card=document.createElement("div"); card.className="unisci-val-card"; card.style.borderLeftColor=d.c;
        const lbl=document.createElement("div"); lbl.className="unisci-val-label"; lbl.textContent=d.l;
        const num=document.createElement("div"); num.innerHTML=`<span class="unisci-val-numero">${d.v}</span><span class="unisci-val-unita"> ${d.u}</span>`;
        card.appendChild(lbl); card.appendChild(num); unisciValori.appendChild(card);
      });
  }

  // ============================================================
  // CALENDARIO
  // ============================================================
  let calAnno = new Date().getFullYear(), calMese = new Date().getMonth();
  const calGriglia = document.getElementById("calGriglia");
  const calTitolo  = document.getElementById("calTitolo");
  const NOMI_MESI  = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  const NOMI_GIORNI= ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];

  document.getElementById("calPrev").addEventListener("click",()=>{ calMese--; if(calMese<0){calMese=11;calAnno--;} renderCalendario(); });
  document.getElementById("calNext").addEventListener("click",()=>{ calMese++; if(calMese>11){calMese=0;calAnno++;} renderCalendario(); });

  function getMnGiorno(ds) {
    const dg=calendario[ds]; if(!dg) return [];
    const s=new Set();
    ["colazione","pranzo","cena","merenda"].forEach(pasto=>{
      (dg[pasto]||[]).forEach(item=>{
        const prod=catalogo.find(p=>p.nome.toLowerCase()===item.nome.toLowerCase());
        if(prod&&prod.micronutrienti) prod.micronutrienti.forEach(id=>s.add(id));
      });
    });
    return Array.from(s);
  }

  function renderCalendario() {
    calTitolo.textContent = NOMI_MESI[calMese]+" "+calAnno;
    calGriglia.innerHTML = "";
    const primo=new Date(calAnno,calMese,1), ultimo=new Date(calAnno,calMese+1,0);
    const oggi=new Date();
    let dow=primo.getDay()-1; if(dow<0)dow=6;
    for(let i=0;i<dow;i++){ const v=document.createElement("div"); v.className="cal-cella vuota"; calGriglia.appendChild(v); }
    for(let g=1;g<=ultimo.getDate();g++){
      const ds=`${calAnno}-${String(calMese+1).padStart(2,"0")}-${String(g).padStart(2,"0")}`;
      const cella=document.createElement("div"); cella.className="cal-cella";
      const isOggi=oggi.getFullYear()===calAnno&&oggi.getMonth()===calMese&&oggi.getDate()===g;
      if(isOggi) cella.classList.add("oggi");
      const hasDati=calendario[ds]&&["colazione","pranzo","cena","merenda"].some(p=>(calendario[ds][p]||[]).length>0);
      if(hasDati) cella.classList.add("ha-dati");
      const num=document.createElement("span"); num.className="cal-giorno-num"; num.textContent=g; cella.appendChild(num);
      const mnIds=getMnGiorno(ds);
      if(mnIds.length){ const dots=document.createElement("div"); dots.className="cal-dots"; mnIds.slice(0,5).forEach(id=>{ const mn=micronutrienti.find(m=>m.id===id); if(!mn)return; const d=document.createElement("span"); d.className="cal-dot"; d.style.background=mn.colore; dots.appendChild(d); }); cella.appendChild(dots); }
      cella.addEventListener("click",()=>apriModaleGiorno(ds));
      calGriglia.appendChild(cella);
    }
  }

  // ============================================================
  // MODALE GIORNO
  // ============================================================
  const modaleGiorno = document.getElementById("modaleGiorno");
  let giornoAperto = null, pastoCorrente = null, alimentoSelezionato = null;

  function apriModaleGiorno(ds) {
    giornoAperto=ds;
    if(!calendario[ds]) calendario[ds]={colazione:[],pranzo:[],cena:[],merenda:[]};
    const [a,m,g]=ds.split("-"); const data=new Date(+a,+m-1,+g);
    document.getElementById("modaleGiornoTitolo").textContent=`${NOMI_GIORNI[data.getDay()]} ${+g} ${NOMI_MESI[+m-1]} ${a}`;
    renderPastiGiorno(); renderRiepilogoGiorno();
    modaleGiorno.classList.remove("hidden");
  }

  document.getElementById("chiudiModaleGiorno").addEventListener("click",()=>{ modaleGiorno.classList.add("hidden"); renderCalendario(); });
  modaleGiorno.addEventListener("click",e=>{ if(e.target===modaleGiorno){modaleGiorno.classList.add("hidden");renderCalendario();} });

  function calcolaMacroGiorno(alimenti) {
    let cal=0,prot=0,carb=0,gras=0;
    alimenti.forEach(item=>{ const prod=catalogo.find(p=>p.nome.toLowerCase()===item.nome.toLowerCase()); if(!prod)return; const f=item.grammi/100; cal+=(parseFloat(prod.calorie)||0)*f; prot+=(parseFloat(prod.proteine)||0)*f; carb+=(parseFloat(prod.carboidrati)||0)*f; gras+=(parseFloat(prod.grassi)||0)*f; });
    return {cal,prot,carb,gras};
  }

  function renderPastiGiorno() {
    const container=document.getElementById("pastiContainer"); container.innerHTML="";
    const dg=calendario[giornoAperto]||{};
    const pastiDef=[["colazione","Colazione"],["pranzo","Pranzo"],["cena","Cena"],["merenda","Merenda"]];
    pastiDef.forEach(([pasto,nomeP])=>{
      const alimenti=(dg[pasto]||[]);
      const {cal}=calcolaMacroGiorno(alimenti);
      const sec=document.createElement("div"); sec.className="pasto-section";
      const hdr=document.createElement("div"); hdr.className="pasto-header";
      const tit=document.createElement("span"); tit.className="pasto-titolo"; tit.textContent=nomeP;
      const kcal=document.createElement("span"); kcal.className="pasto-kcal"; kcal.textContent=cal>0?Math.round(cal)+" kcal":"";
      hdr.appendChild(tit); hdr.appendChild(kcal); sec.appendChild(hdr);
      const lista=document.createElement("div"); lista.className="pasto-lista";
      alimenti.forEach((item,idx)=>{
        const riga=document.createElement("div"); riga.className="pasto-alimento-riga";
        const nm=document.createElement("span"); nm.className="pasto-alimento-nome"; nm.textContent=item.nome;
        const inp=document.createElement("input"); inp.type="number"; inp.min="0"; inp.value=item.grammi; inp.className="pasto-grammi-input"; inp.inputMode="decimal";
        inp.addEventListener("change",()=>{ const v=parseFloat(inp.value); calendario[giornoAperto][pasto][idx].grammi=isNaN(v)||v<0?0:v; salvaCalendario(); renderPastiGiorno(); renderRiepilogoGiorno(); });
        const unit=document.createElement("span"); unit.className="pasto-grammi-unit"; unit.textContent="g";
        const btnR=document.createElement("button"); btnR.className="pasto-rimuovi-btn"; btnR.innerHTML="&#10005;";
        btnR.addEventListener("click",()=>{ calendario[giornoAperto][pasto].splice(idx,1); salvaCalendario(); renderPastiGiorno(); renderRiepilogoGiorno(); renderCalendario(); });
        riga.appendChild(nm); riga.appendChild(inp); riga.appendChild(unit); riga.appendChild(btnR); lista.appendChild(riga);
      });
      sec.appendChild(lista);
      const addBtn=document.createElement("button"); addBtn.className="btn-aggiungi-pasto"; addBtn.textContent="+ Aggiungi alimento";
      addBtn.addEventListener("click",()=>apriAggiuntaAlimento(pasto));
      sec.appendChild(addBtn); container.appendChild(sec);
    });
  }

  function renderRiepilogoGiorno() {
    const container=document.getElementById("giornoRiepilogo"); container.innerHTML="";
    const dg=calendario[giornoAperto]||{};
    const tutti=[...(dg.colazione||[]),...(dg.pranzo||[]),...(dg.cena||[]),...(dg.merenda||[])];
    if(!tutti.length){ container.innerHTML=`<p style="color:var(--text-muted);font-style:italic;font-size:13px;">Nessun alimento registrato.</p>`; return; }
    const {cal,prot,carb,gras}=calcolaMacroGiorno(tutti);
    // Calorie card
    const calCard=document.createElement("div"); calCard.className="riepilogo-cal-card";
    calCard.innerHTML=`<span class="riepilogo-cal-num">${Math.round(cal)}</span><span class="riepilogo-cal-unit"> kcal totali</span>`; container.appendChild(calCard);
    // Pie
    const totM=prot+carb+gras;
    if(totM>0){
      const pieWrap=document.createElement("div"); pieWrap.className="riepilogo-pie-wrap";
      const NS="http://www.w3.org/2000/svg", svg=document.createElementNS(NS,"svg"); svg.setAttribute("viewBox","0 0 100 100"); svg.setAttribute("class","riepilogo-pie-svg");
      const slices=[{v:prot,c:PIE.proteine},{v:carb,c:PIE.carboidrati},{v:gras,c:PIE.grassi}].filter(s=>s.v>0);
      let ang=0; const R=46,cx=50,cy=50;
      slices.forEach(s=>{ const d2=s.v/totM*2*Math.PI,en=ang+d2; let d;
        if(slices.length===1) d=`M ${cx} ${cy-R} A ${R} ${R} 0 1 1 ${cx-0.001} ${cy-R} Z`;
        else{const x1=cx+R*Math.cos(ang),y1=cy+R*Math.sin(ang),x2=cx+R*Math.cos(en),y2=cy+R*Math.sin(en);d=`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${d2>Math.PI?1:0} 1 ${x2} ${y2} Z`;}
        const path=document.createElementNS(NS,"path"); path.setAttribute("d",d); path.setAttribute("fill",s.c); svg.appendChild(path); ang=en;
      });
      pieWrap.appendChild(svg);
      const leg=document.createElement("div"); leg.className="riepilogo-pie-legend";
      [{l:"Proteine",v:prot,c:PIE.proteine},{l:"Carboidrati",v:carb,c:PIE.carboidrati},{l:"Grassi",v:gras,c:PIE.grassi}].forEach(s=>{
        const pct=Math.round(s.v/totM*100), row=document.createElement("div"); row.className="pie-legend-item";
        row.innerHTML=`<span class="pie-dot" style="background:${s.c}"></span><span>${s.l}</span><span class="pie-pct"> ${pct}%</span>`; leg.appendChild(row);
      });
      pieWrap.appendChild(leg); container.appendChild(pieWrap);
    }
    // Macros grid
    const mg=document.createElement("div"); mg.className="unisci-valori";
    [{l:"Calorie",v:Math.round(cal*10)/10,u:"kcal",c:"#4E86C8"},{l:"Proteine",v:Math.round(prot*10)/10,u:"g",c:PIE.proteine},{l:"Carboidrati",v:Math.round(carb*10)/10,u:"g",c:PIE.carboidrati},{l:"Grassi",v:Math.round(gras*10)/10,u:"g",c:PIE.grassi}]
      .forEach(d=>{ const c=document.createElement("div"); c.className="unisci-val-card"; c.style.borderLeftColor=d.c;
        c.innerHTML=`<div class="unisci-val-label">${d.l}</div><div><span class="unisci-val-numero">${d.v}</span><span class="unisci-val-unita"> ${d.u}</span></div>`; mg.appendChild(c); });
    container.appendChild(mg);
    // Micronutrienti
    const mnIds=getMnGiorno(giornoAperto);
    if(mnIds.length){
      const sec=document.createElement("div"); sec.className="riepilogo-mn-section";
      const tit=document.createElement("p"); tit.className="riepilogo-mn-title"; tit.textContent="Micronutrienti assunti:"; sec.appendChild(tit);
      const dots=document.createElement("div"); dots.className="riepilogo-mn-dots";
      mnIds.forEach(id=>{ const mn=micronutrienti.find(m=>m.id===id); if(!mn)return; const chip=document.createElement("div"); chip.className="riepilogo-mn-chip"; chip.innerHTML=`<span class="cal-dot" style="background:${mn.colore}"></span><span>${mn.nome}</span>`; dots.appendChild(chip); });
      sec.appendChild(dots); container.appendChild(sec);
    }
  }

  // ============================================================
  // AGGIUNGI ALIMENTO AL PASTO
  // ============================================================
  const modaleAggiunta = document.getElementById("modaleAggiuntaAlimento");
  const ricercaPasto   = document.getElementById("ricercaAlimentoPasto");
  const listaAlimPasto = document.getElementById("listaAlimentiPasto");
  const grammiPasto    = document.getElementById("grammiAlimentoPasto");

  function apriAggiuntaAlimento(pasto) {
    pastoCorrente=pasto; alimentoSelezionato=null;
    document.getElementById("modaleAggiuntaTitolo").textContent=`Aggiungi a ${pasto.charAt(0).toUpperCase()+pasto.slice(1)}`;
    ricercaPasto.value=""; grammiPasto.value="100";
    renderListaAlimentiPasto(); modaleAggiunta.classList.remove("hidden");
  }

  function renderListaAlimentiPasto() {
    listaAlimPasto.innerHTML="";
    const q=ricercaPasto.value.trim().toLowerCase();
    const voci=catalogo.filter(p=>!q||p.nome.toLowerCase().includes(q)||(p.tag||"").toLowerCase().includes(q)).sort((a,b)=>a.nome.localeCompare(b.nome,"it"));
    if(!voci.length){ listaAlimPasto.innerHTML=`<p class="confronto-vuoto">Nessun alimento trovato.</p>`; return; }
    voci.forEach(p=>{
      const item=document.createElement("div"); item.className="confronto-item"+(alimentoSelezionato===p.nome?" selezionato":"");
      const nm=document.createElement("span"); nm.className="confronto-nome"; nm.textContent=p.nome;
      const tg=document.createElement("span"); tg.className="confronto-tag"; tg.textContent=p.tag||"";
      item.appendChild(nm); item.appendChild(tg);
      item.addEventListener("click",()=>{
        alimentoSelezionato=p.nome;
        document.querySelectorAll("#listaAlimentiPasto .confronto-item").forEach(el=>el.classList.remove("selezionato")); item.classList.add("selezionato");
      });
      listaAlimPasto.appendChild(item);
    });
  }

  ricercaPasto.addEventListener("input",()=>renderListaAlimentiPasto());

  document.getElementById("confermaAggiunta").addEventListener("click",()=>{
    if(!alimentoSelezionato){ alert("Seleziona un alimento."); return; }
    const g=parseFloat(grammiPasto.value)||100;
    if(!calendario[giornoAperto]) calendario[giornoAperto]={colazione:[],pranzo:[],cena:[],merenda:[]};
    calendario[giornoAperto][pastoCorrente].push({nome:alimentoSelezionato,grammi:g});
    salvaCalendario(); modaleAggiunta.classList.add("hidden");
    renderPastiGiorno(); renderRiepilogoGiorno(); renderCalendario();
  });
  document.getElementById("annullaAggiunta").addEventListener("click",()=>modaleAggiunta.classList.add("hidden"));
  modaleAggiunta.addEventListener("click",e=>{ if(e.target===modaleAggiunta) modaleAggiunta.classList.add("hidden"); });

  // ============================================================
  // ANDAMENTO
  // ============================================================
  const modaleAndamento = document.getElementById("modaleAndamento");
  let periodoAndamento = 7;
  document.getElementById("calAndamentoBtn").addEventListener("click",()=>{ renderAndamento(periodoAndamento); modaleAndamento.classList.remove("hidden"); });
  document.getElementById("chiudiAndamento").addEventListener("click",()=>modaleAndamento.classList.add("hidden"));
  modaleAndamento.addEventListener("click",e=>{ if(e.target===modaleAndamento) modaleAndamento.classList.add("hidden"); });

  document.querySelectorAll(".andamento-periodo-bar .filtro-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      periodoAndamento=+btn.dataset.periodo;
      document.querySelectorAll(".andamento-periodo-bar .filtro-btn").forEach(b=>b.classList.remove("attivo")); btn.classList.add("attivo");
      renderAndamento(periodoAndamento);
    });
  });

  function renderAndamento(periodo) {
    const container=document.getElementById("andamentoChart"); container.innerHTML="";
    const oggi=new Date(); const giorni=[];
    for(let i=periodo-1;i>=0;i--){ const d=new Date(oggi); d.setDate(d.getDate()-i); giorni.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }
    const dati=giorni.map(ds=>{ const dg=calendario[ds]||{}; const tutti=[...(dg.colazione||[]),...(dg.pranzo||[]),...(dg.cena||[]),...(dg.merenda||[])]; return {ds,...calcolaMacroGiorno(tutti)}; });
    const nutrienti=[
      {key:"cal",  label:"Calorie",     col:"#4E86C8",ob:obiettivi.calorie,     u:"kcal"},
      {key:"prot", label:"Proteine",    col:PIE.proteine,   ob:obiettivi.proteine,    u:"g"},
      {key:"carb", label:"Carboidrati", col:PIE.carboidrati,ob:obiettivi.carboidrati, u:"g"},
      {key:"gras", label:"Grassi",      col:PIE.grassi,     ob:obiettivi.grassi,      u:"g"},
    ];
    nutrienti.forEach(nut=>{
      const maxV=Math.max(...dati.map(d=>d[nut.key]||0),nut.ob||0,1);
      const blocco=document.createElement("div"); blocco.className="andamento-blocco";
      const tit=document.createElement("p"); tit.className="andamento-blocco-titolo"; tit.style.color=nut.col;
      tit.textContent=nut.label+(nut.ob?` (obiett.: ${nut.ob} ${nut.u})`:""); blocco.appendChild(tit);
      const W=500,H=90,padL=5,padT=8,padB=18,padR=5,chartW=W-padL-padR,chartH=H-padT-padB;
      const gap=chartW/periodo, barW=Math.max(2,gap*0.65);
      const NS="http://www.w3.org/2000/svg", svg=document.createElementNS(NS,"svg");
      svg.setAttribute("viewBox",`0 0 ${W} ${H}`); svg.setAttribute("class","andamento-svg");
      dati.forEach((d,i)=>{
        const v=d[nut.key]||0, bH=maxV>0?(v/maxV)*chartH:0;
        const x=padL+i*gap+(gap-barW)/2, y=padT+chartH-bH;
        const rect=document.createElementNS(NS,"rect"); rect.setAttribute("x",x); rect.setAttribute("y",y); rect.setAttribute("width",barW); rect.setAttribute("height",Math.max(0,bH)); rect.setAttribute("fill",nut.col); rect.setAttribute("rx","2"); svg.appendChild(rect);
        if(periodo<=7||(i%5===0)){
          const [,,gg]=d.ds.split("-");
          const txt=document.createElementNS(NS,"text"); txt.setAttribute("x",x+barW/2); txt.setAttribute("y",H-4); txt.setAttribute("text-anchor","middle"); txt.setAttribute("font-size","9"); txt.setAttribute("fill","var(--text-muted)"); txt.textContent=+gg; svg.appendChild(txt);
        }
      });
      if(nut.ob&&nut.ob>0){ const ly=padT+chartH-(nut.ob/maxV)*chartH; const line=document.createElementNS(NS,"line"); line.setAttribute("x1",padL); line.setAttribute("y1",ly); line.setAttribute("x2",W-padR); line.setAttribute("y2",ly); line.setAttribute("stroke",nut.col); line.setAttribute("stroke-width","1.5"); line.setAttribute("stroke-dasharray","5,3"); line.setAttribute("opacity","0.75"); svg.appendChild(line); }
      blocco.appendChild(svg); container.appendChild(blocco);
    });
  }

  // ============================================================
  // IMPOSTAZIONI
  // ============================================================
  function renderImpostazioni() {
    renderMicronutrientiList();
    document.getElementById("obCalorie").value     = obiettivi.calorie     || "";
    document.getElementById("obProteine").value    = obiettivi.proteine    || "";
    document.getElementById("obCarboidrati").value = obiettivi.carboidrati || "";
    document.getElementById("obGrassi").value      = obiettivi.grassi      || "";
  }

  function renderMicronutrientiList() {
    const lista=document.getElementById("micronutrientiLista"); lista.innerHTML="";
    if(!micronutrienti.length){ lista.innerHTML=`<p style="color:var(--text-muted);font-style:italic;font-size:13px;">Nessun micronutriente registrato.</p>`; return; }
    micronutrienti.forEach((mn,i)=>{
      const riga=document.createElement("div"); riga.className="mn-riga";
      const dot=document.createElement("span"); dot.className="mn-dot-grande"; dot.style.background=mn.colore;
      const nomeInp=document.createElement("input"); nomeInp.className="mn-nome-editable"; nomeInp.value=mn.nome;
      nomeInp.addEventListener("blur",()=>{ const n=nomeInp.value.trim(); if(n){micronutrienti[i].nome=n;salvaMicronutrienti();aggiornaMnCheckboxList("mnCheckboxList",[]);} });
      const colorePicker=document.createElement("input"); colorePicker.type="color"; colorePicker.value=mn.colore; colorePicker.className="mn-colore-picker";
      const hexInp=document.createElement("input"); hexInp.type="text"; hexInp.value=mn.colore; hexInp.maxLength=7; hexInp.className="mn-hex-input-small"; hexInp.placeholder="#RRGGBB";
      colorePicker.addEventListener("input",()=>{ hexInp.value=colorePicker.value; micronutrienti[i].colore=colorePicker.value; dot.style.background=colorePicker.value; salvaMicronutrienti(); });
      hexInp.addEventListener("blur",()=>{ const v=hexInp.value.trim(); if(/^#[0-9a-fA-F]{6}$/.test(v)){colorePicker.value=v;micronutrienti[i].colore=v;dot.style.background=v;salvaMicronutrienti();} else hexInp.value=colorePicker.value; });
      const btnE=document.createElement("button"); btnE.className="btn-tag-elimina"; btnE.textContent="Elimina";
      btnE.addEventListener("click",()=>{ micronutrienti.splice(i,1); salvaMicronutrienti(); renderMicronutrientiList(); aggiornaMnCheckboxList("mnCheckboxList",[]); });
      riga.appendChild(dot); riga.appendChild(nomeInp); riga.appendChild(colorePicker); riga.appendChild(hexInp); riga.appendChild(btnE);
      lista.appendChild(riga);
    });
  }

  // Sync HEX <-> color nel form "aggiungi micronutriente"
  const mnRGB=document.getElementById("mnNuovoColoreRGB"), mnHEX=document.getElementById("mnNuovoColoreHEX");
  mnRGB.addEventListener("input",()=>mnHEX.value=mnRGB.value);
  mnHEX.addEventListener("blur",()=>{ if(/^#[0-9a-fA-F]{6}$/.test(mnHEX.value.trim())) mnRGB.value=mnHEX.value.trim(); else mnHEX.value=mnRGB.value; });

  document.getElementById("mnAggiungiBtn").addEventListener("click",()=>{
    const nome=document.getElementById("mnNuovoNome").value.trim();
    if(!nome){ alert("Inserisci un nome per il micronutriente."); return; }
    const colore=mnRGB.value;
    micronutrienti.push({id:genId(),nome,colore});
    salvaMicronutrienti(); renderMicronutrientiList();
    aggiornaMnCheckboxList("mnCheckboxList",getMnSelezionati("mnCheckboxList"));
    document.getElementById("mnNuovoNome").value=""; mnRGB.value="#8E94F2"; mnHEX.value="#8E94F2";
  });

  document.getElementById("salvaObiettivi").addEventListener("click",()=>{
    obiettivi.calorie     = parseFloat(document.getElementById("obCalorie").value)     || 0;
    obiettivi.proteine    = parseFloat(document.getElementById("obProteine").value)    || 0;
    obiettivi.carboidrati = parseFloat(document.getElementById("obCarboidrati").value) || 0;
    obiettivi.grassi      = parseFloat(document.getElementById("obGrassi").value)      || 0;
    salvaObiettivi(); alert("Obiettivi salvati.");
  });

  // ============================================================
  // AVVIO
  // ============================================================
  aggiornaTagSelect();
  aggiornaTagBar();
  aggiornaMnCheckboxList("mnCheckboxList", []);
  aggiornaUndoRedo();
  render();

}); // fine DOMContentLoaded
