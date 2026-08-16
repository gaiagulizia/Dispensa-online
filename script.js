/* ============================================================
   DISPENSA DIGITALE — script.js
   Compatibile con WebView Android (API 21+) e browser moderni.
   Usa solo JS standard ES6, nessuna dipendenza esterna.
   localStorage richiede setDomStorageEnabled(true) su WebView.
   ============================================================ */

"use strict";

window.addEventListener("DOMContentLoaded", () => {

  // ============================================================
  // TEMA (chiaro / scuro) — gestito prima di tutto il resto
  // ============================================================
  const temaBtn = document.getElementById("temaBtn");

  function applicaTema(dark) {
    document.body.classList.toggle("dark", dark);
    temaBtn.textContent = dark ? "☼" : "☾";
    try { localStorage.setItem("tema", dark ? "dark" : "light"); } catch(e) {}
  }

  (function inizializzaTema() {
    let tema = "light";
    try { tema = localStorage.getItem("tema") || "light"; } catch(e) {}
    applicaTema(tema === "dark");
  })();

  temaBtn.addEventListener("click", () => {
    applicaTema(!document.body.classList.contains("dark"));
  });

  // ============================================================
  // NAVIGAZIONE A TAB
  // ============================================================
  const tabBtns    = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle("attivo", b.dataset.tab === target));
      tabContents.forEach(c => c.classList.toggle("hidden", c.id !== "tab-" + target));
      if (target === "confronta") { popolaListaConfronto(); aggiornaGraficiConfronto(); }
      if (target === "pasti")    { popolaListaPasti(); aggiornaPasti(); }
      if (target === "profilo")  { renderProfilo(); }
    });
  });

  // ============================================================
  // ELEMENTI UI
  // ============================================================
  const nomeInput        = document.getElementById("nome");
  const marcaInput       = document.getElementById("marca");
  const scadenzaInput    = document.getElementById("scadenza");
  const quantitaInput    = document.getElementById("quantita");
  const unitaSelect      = document.getElementById("unitaSelect");
  const tagInputEl       = document.getElementById("tagInput");
  const tagSelectEl      = document.getElementById("tagSelect");
  const calorieInput     = document.getElementById("calorie");
  const proteineInput    = document.getElementById("proteine");
  const carboidratiInput = document.getElementById("carboidrati");
  const grassiInput      = document.getElementById("grassi");
  const addBtn           = document.getElementById("addBtn");
  const undoBtn          = document.getElementById("undoBtn");
  const redoBtn          = document.getElementById("redoBtn");
  const ordinaSelect     = document.getElementById("ordinaSelect");
  const dispensaDiv      = document.getElementById("dispensa");
  const tagBar           = document.getElementById("tagBar");
  const suggerimenti     = document.getElementById("suggerimenti");

  // Modale gestione tag
  const modaleTag       = document.getElementById("modaleTag");
  const listaTagGest    = document.getElementById("listaTagGestione");
  const chiudiModaleTag = document.getElementById("chiudiModaleTag");

  // Modale modifica prodotto
  const modaleModifica   = document.getElementById("modaleModifica");
  const editNome         = document.getElementById("editNome");
  const editMarca        = document.getElementById("editMarca");
  const editScadenza     = document.getElementById("editScadenza");
  const editQuantita     = document.getElementById("editQuantita");
  const editUnita        = document.getElementById("editUnita");
  const editTag          = document.getElementById("editTag");
  const editCalorie      = document.getElementById("editCalorie");
  const editProteine     = document.getElementById("editProteine");
  const editCarboidrati  = document.getElementById("editCarboidrati");
  const editGrassi       = document.getElementById("editGrassi");
  const salvaModificaBtn = document.getElementById("salvaModifica");
  const chiudiModifica   = document.getElementById("chiudiModifica");

  // ============================================================
  // STATO APPLICAZIONE
  // ============================================================
  function caricaDati(chiave, fallback) {
    try { return JSON.parse(localStorage.getItem(chiave)) || fallback; }
    catch(e) { return fallback; }
  }

  let dispensa = caricaDati("dispensa", []);
  let tags     = caricaDati("tags",     []);
  let catalogo = caricaDati("catalogo", []);
  let pasti    = caricaDati("pasti",    []); // [{id, data, alimenti:[{nome,marca,grammi,cal,prot,carb,gras}], totCal, totProt, totCarb, totGras}]

  let filtroTag      = "TUTTI";
  let filtroScadenza = "TUTTI";
  let ordinamento    = "data";
  let indiceInModifica = -1;

  // ============================================================
  // PERSISTENZA
  // ============================================================
  function salva() {
    try {
      localStorage.setItem("dispensa", JSON.stringify(dispensa));
      localStorage.setItem("tags",     JSON.stringify(tags));
      localStorage.setItem("catalogo", JSON.stringify(catalogo));
      localStorage.setItem("pasti",    JSON.stringify(pasti));
    } catch(e) {
      console.warn("Salvataggio fallito:", e);
    }
  }

  // ============================================================
  // UNDO / REDO
  // ============================================================
  const undoStack = [], redoStack = [];

  function snapshot() {
    return JSON.stringify({ dispensa, tags, catalogo });
  }

  function pushUndo() {
    undoStack.push(snapshot());
    redoStack.length = 0;
    aggiornaUndoRedo();
  }

  function ripristinaStato(json) {
    const s = JSON.parse(json);
    dispensa = s.dispensa;
    tags     = s.tags;
    catalogo = s.catalogo;
    salva();
    aggiornaTagSelect();
    aggiornaTagBar();
    render();
  }

  function aggiornaUndoRedo() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  undoBtn.addEventListener("click", () => {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    ripristinaStato(undoStack.pop());
    aggiornaUndoRedo();
  });

  redoBtn.addEventListener("click", () => {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    ripristinaStato(redoStack.pop());
    aggiornaUndoRedo();
  });

  // ============================================================
  // AUTOCOMPLETE
  // ============================================================
  nomeInput.addEventListener("input", () => {
    const val = nomeInput.value.trim().toLowerCase();
    suggerimenti.innerHTML = "";
    if (!val) { suggerimenti.classList.add("hidden"); return; }

    const matches = catalogo.filter(p => p.nome.toLowerCase().includes(val));
    if (!matches.length) { suggerimenti.classList.add("hidden"); return; }

    suggerimenti.classList.remove("hidden");
    matches.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p.nome + (p.marca ? ` (${p.marca})` : "");
      li.addEventListener("click", () => {
        nomeInput.value        = p.nome;
        marcaInput.value       = p.marca       || "";
        calorieInput.value     = p.calorie     || "";
        proteineInput.value    = p.proteine    || "";
        carboidratiInput.value = p.carboidrati || "";
        grassiInput.value      = p.grassi      || "";
        if (p.tag && tags.includes(p.tag)) {
          tagSelectEl.value = p.tag;
          tagInputEl.value  = "";
        } else if (p.tag) {
          tagInputEl.value  = p.tag;
        }
        suggerimenti.classList.add("hidden");
      });
      suggerimenti.appendChild(li);
    });
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".autocomplete-wrapper")) {
      suggerimenti.classList.add("hidden");
    }
  });

  // ============================================================
  // TAG SELECT (form + modale modifica)
  // ============================================================
  function aggiornaTagSelect() {
    tagSelectEl.innerHTML = `<option value="">Tag esistenti</option>`;
    editTag.innerHTML = "";
    tags.forEach(t => {
      const o1 = document.createElement("option");
      o1.value = t; o1.textContent = t;
      tagSelectEl.appendChild(o1);
      const o2 = document.createElement("option");
      o2.value = t; o2.textContent = t;
      editTag.appendChild(o2);
    });
  }

  // ============================================================
  // TAG BAR
  // ============================================================
  function aggiornaTagBar() {
    tagBar.innerHTML = "";

    // Solo i tag che hanno almeno un prodotto in dispensa
    const tagsAttivi = ["TUTTI", ...tags.filter(t => dispensa.some(p => p.tag === t))];

    tagsAttivi.forEach(t => {
      const chip = document.createElement("button");
      chip.className = "tag-chip" + (filtroTag === t ? " attivo" : "");
      chip.textContent = t;
      chip.addEventListener("click", () => {
        filtroTag = t;
        aggiornaTagBar();
        render();
      });
      tagBar.appendChild(chip);
    });

    if (tags.length > 0) {
      const gestBtn = document.createElement("button");
      gestBtn.className = "tag-chip tag-chip-gestisci";
      gestBtn.textContent = "Gestisci tag...";
      gestBtn.addEventListener("click", apriModaleTag);
      tagBar.appendChild(gestBtn);
    }
  }

  // ============================================================
  // MODALE GESTIONE TAG
  // ============================================================
  function apriModaleTag() {
    pulisciDragResidui();
    listaTagGest.innerHTML = "";

    if (tags.length === 0) {
      listaTagGest.innerHTML = `<li style="color:var(--text-muted);font-style:italic;">Nessun tag registrato.</li>`;
    } else {
      tags.forEach((t, i) => {
        const li = document.createElement("li");
        li.dataset.tagName = t;

        const handle = document.createElement("span");
        handle.className = "tag-drag-handle";
        handle.textContent = "\u2630";
        handle.setAttribute("aria-label", "Tieni premuto per riordinare");

        const inp = document.createElement("input");
        inp.className = "tag-edit-input";
        inp.value = t;

        const btnS = document.createElement("button");
        btnS.className = "btn-tag-salva";
        btnS.textContent = "Salva";
        btnS.addEventListener("click", () => {
          const nuovo = inp.value.trim();
          if (!nuovo) { alert("Il nome non puo essere vuoto."); return; }
          if (nuovo === t) return;
          pushUndo();
          dispensa.forEach(p => { if (p.tag === t) p.tag = nuovo; });
          catalogo.forEach(p => { if (p.tag === t) p.tag = nuovo; });
          tags[i] = nuovo;
          if (filtroTag === t) filtroTag = nuovo;
          salva();
          aggiornaTagSelect();
          aggiornaTagBar();
          render();
          apriModaleTag();
        });

        const btnE = document.createElement("button");
        btnE.className = "btn-tag-elimina";
        btnE.textContent = "Elimina";
        btnE.addEventListener("click", () => {
          const inUso = dispensa.some(p => p.tag === t);
          if (inUso && !confirm(`Il tag "${t}" e usato. Eliminarlo comunque?`)) return;
          pushUndo();
          dispensa.forEach(p => { if (p.tag === t) p.tag = ""; });
          catalogo.forEach(p => { if (p.tag === t) p.tag = ""; });
          tags.splice(i, 1);
          if (filtroTag === t) filtroTag = "TUTTI";
          salva();
          aggiornaTagSelect();
          aggiornaTagBar();
          render();
          apriModaleTag();
        });

        li.appendChild(handle);
        li.appendChild(inp);
        li.appendChild(btnS);
        li.appendChild(btnE);
        listaTagGest.appendChild(li);

        abilitaDragTag(li, handle);
      });
    }

    modaleTag.classList.remove("hidden");
  }

  // ============================================================
  // RIORDINO TAG (tieni premuto e trascina, SOLO verticale)
  // Il fantasma segue il dito in verticale; la coordinata
  // orizzontale resta sempre fissa. Gli ascoltatori sono
  // registrati su document (non sull'elemento) per evitare
  // che il drag si blocchi durante il gesto.
  // ============================================================
  function pulisciDragResidui() {
    document.querySelectorAll(".tag-ghost").forEach(g => g.remove());
    document.querySelectorAll("#listaTagGestione li.dragging-source")
      .forEach(l => l.classList.remove("dragging-source"));
  }

  function abilitaDragTag(li, handle) {
    let longPressTimer = null;
    let dragging = false;
    let startX = 0, startY = 0;
    let ghost = null;
    let ghostOffsetY = 0;

    function creaGhost(y) {
      const rect = li.getBoundingClientRect();
      ghost = li.cloneNode(true);
      ghost.classList.add("tag-ghost");
      ghost.style.left  = rect.left + "px";
      ghost.style.top   = rect.top + "px";
      ghost.style.width = rect.width + "px";
      document.body.appendChild(ghost);
      ghostOffsetY = y - rect.top;
      li.classList.add("dragging-source");
    }

    function spostaGhost(y) {
      if (!ghost) return;
      // Solo verticale: la posizione orizzontale del fantasma
      // non viene mai aggiornata, resta quella iniziale.
      ghost.style.top = (y - ghostOffsetY) + "px";
    }

    function valutaScambio(pointerY) {
      const children = Array.from(listaTagGest.children);
      const liIndex = children.indexOf(li);
      for (let i = 0; i < children.length; i++) {
        const sib = children[i];
        if (sib === li) continue;
        const rect = sib.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (i < liIndex && pointerY < mid) {
          listaTagGest.insertBefore(li, sib);
          return;
        }
        if (i > liIndex && pointerY > mid) {
          listaTagGest.insertBefore(li, sib.nextSibling);
          return;
        }
      }
    }

    function onMove(e) {
      const y = e.clientY, x = e.clientX;
      if (!dragging) {
        if (Math.abs(y - startY) > 10 || Math.abs(x - startX) > 10) {
          clearTimeout(longPressTimer);
        }
        return;
      }
      if (e.cancelable) e.preventDefault();
      spostaGhost(y);
      valutaScambio(y);
    }

    function onEnd() {
      clearTimeout(longPressTimer);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
      if (dragging) {
        dragging = false;
        pulisciDragResidui();
        finalizzaOrdineTag();
      }
    }

    handle.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX; startY = e.clientY;
      dragging = false;
      longPressTimer = setTimeout(() => {
        dragging = true;
        creaGhost(startY);
      }, 350);
      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", onEnd);
      document.addEventListener("pointercancel", onEnd);
    });

    handle.addEventListener("contextmenu", e => e.preventDefault());
  }

  function finalizzaOrdineTag() {
    const nuovoOrdine = Array.from(listaTagGest.children)
      .map(el => el.dataset.tagName)
      .filter(Boolean);
    if (nuovoOrdine.length === tags.length) {
      pushUndo();
      tags = nuovoOrdine;
      salva();
      aggiornaTagSelect();
      aggiornaTagBar();
      apriModaleTag();
    }
  }

  chiudiModaleTag.addEventListener("click", () => {
    pulisciDragResidui();
    modaleTag.classList.add("hidden");
  });
  modaleTag.addEventListener("click", e => {
    if (e.target === modaleTag) {
      pulisciDragResidui();
      modaleTag.classList.add("hidden");
    }
  });

  // ============================================================
  // MODALE MODIFICA PRODOTTO
  // ============================================================
  function apriModaleModifica(idx) {
    indiceInModifica = idx;
    const p = dispensa[idx];
    editNome.value        = p.nome        || "";
    editMarca.value       = p.marca       || "";
    editScadenza.value    = p.scadenza    || "";
    editQuantita.value    = p.quantita    || "";
    editUnita.value       = p.unita       || "pz";
    editCalorie.value     = p.calorie     || "";
    editProteine.value    = p.proteine    || "";
    editCarboidrati.value = p.carboidrati || "";
    editGrassi.value      = p.grassi      || "";
    aggiornaTagSelect();
    if (p.tag) editTag.value = p.tag;
    modaleModifica.classList.remove("hidden");
  }

  salvaModificaBtn.addEventListener("click", () => {
    if (indiceInModifica < 0) return;
    const nome = editNome.value.trim();
    if (!nome) { alert("Il nome non puo essere vuoto."); return; }
    pushUndo();
    const p = dispensa[indiceInModifica];
    p.nome        = nome;
    p.marca       = editMarca.value.trim();
    p.scadenza    = editScadenza.value;
    p.quantita    = editQuantita.value;
    p.unita       = editUnita.value;
    p.tag         = editTag.value;
    p.calorie     = editCalorie.value.trim();
    p.proteine    = editProteine.value.trim();
    p.carboidrati = editCarboidrati.value.trim();
    p.grassi      = editGrassi.value.trim();
    // Aggiorna catalogo
    const ci = catalogo.findIndex(c => c.nome.toLowerCase() === nome.toLowerCase());
    if (ci !== -1) Object.assign(catalogo[ci], p);
    salva();
    aggiornaTagBar();
    render();
    modaleModifica.classList.add("hidden");
    indiceInModifica = -1;
  });

  function chiudiModaleModifica() {
    modaleModifica.classList.add("hidden");
    indiceInModifica = -1;
  }
  chiudiModifica.addEventListener("click", chiudiModaleModifica);
  modaleModifica.addEventListener("click", e => { if (e.target === modaleModifica) chiudiModaleModifica(); });

  // ============================================================
  // FILTRI SCADENZA
  // ============================================================
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      filtroScadenza = btn.dataset.filtro;
      document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("attivo"));
      btn.classList.add("attivo");
      render();
    });
  });

  // ============================================================
  // ORDINAMENTO
  // ============================================================
  ordinaSelect.addEventListener("change", () => { ordinamento = ordinaSelect.value; render(); });

  function applicaOrdinamento(lista) {
    const c = [...lista];
    switch (ordinamento) {
      case "scadenza_asc":
        c.sort((a, b) => {
          if (!a.scadenza && !b.scadenza) return 0;
          if (!a.scadenza) return 1;
          if (!b.scadenza) return -1;
          return new Date(a.scadenza) - new Date(b.scadenza);
        });
        break;
      case "alfabetico":
        c.sort((a, b) => a.nome.localeCompare(b.nome, "it")); break;
      case "calorie_desc":
        c.sort((a, b) => (parseFloat(b.calorie)||0)     - (parseFloat(a.calorie)||0));     break;
      case "calorie_asc":
        c.sort((a, b) => (parseFloat(a.calorie)||0)     - (parseFloat(b.calorie)||0));     break;
      case "proteine_desc":
        c.sort((a, b) => (parseFloat(b.proteine)||0)    - (parseFloat(a.proteine)||0));    break;
      case "proteine_asc":
        c.sort((a, b) => (parseFloat(a.proteine)||0)    - (parseFloat(b.proteine)||0));    break;
      case "carboidrati_desc":
        c.sort((a, b) => (parseFloat(b.carboidrati)||0) - (parseFloat(a.carboidrati)||0)); break;
      case "carboidrati_asc":
        c.sort((a, b) => (parseFloat(a.carboidrati)||0) - (parseFloat(b.carboidrati)||0)); break;
      case "grassi_desc":
        c.sort((a, b) => (parseFloat(b.grassi)||0)      - (parseFloat(a.grassi)||0));      break;
      case "grassi_asc":
        c.sort((a, b) => (parseFloat(a.grassi)||0)      - (parseFloat(b.grassi)||0));      break;
    }
    return c;
  }

  // ============================================================
  // GRAFICO A TORTA SVG
  // ============================================================
  const PIE = {
    proteine:    "#8e94f2",
    carboidrati: "#ee8434",
    grassi:      "#a1da4c",
  };

  function buildPie(carboidrati, proteine, grassi) {
    const c   = parseFloat(carboidrati) || 0;
    const pr  = parseFloat(proteine)    || 0;
    const g   = parseFloat(grassi)      || 0;
    const tot = c + pr + g;

    const wrap = document.createElement("div");
    wrap.className = "pie-container";

    if (tot === 0) {
      const msg = document.createElement("span");
      msg.style.cssText = "font-size:12px;color:var(--text-muted);";
      msg.textContent = "Nessun dato";
      wrap.appendChild(msg);
      return wrap;
    }

    const slices = [
      { label: "Prot.",  value: pr, color: PIE.proteine    },
      { label: "Carb.",  value: c,  color: PIE.carboidrati },
      { label: "Grassi", value: g,  color: PIE.grassi      },
    ].filter(s => s.value > 0);

    const NS  = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");

    const R = 46, cx = 50, cy = 50;
    let ang = 0;

    slices.forEach(s => {
      const delta = (s.value / tot) * 2 * Math.PI;
      const end   = ang + delta;
      let d;
      if (slices.length === 1) {
        d = `M ${cx} ${cy-R} A ${R} ${R} 0 1 1 ${cx-0.001} ${cy-R} Z`;
      } else {
        const x1 = cx + R * Math.cos(ang),  y1 = cy + R * Math.sin(ang);
        const x2 = cx + R * Math.cos(end),  y2 = cy + R * Math.sin(end);
        d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${delta > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
      }
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", s.color);
      path.setAttribute("class", "pie-slice");
      svg.appendChild(path);
      ang = end;
    });

    wrap.appendChild(svg);

    const legend = document.createElement("div");
    legend.className = "pie-legend";
    slices.forEach(s => {
      const pct  = Math.round((s.value / tot) * 100);
      const item = document.createElement("div");
      item.className = "pie-legend-item";
      const dot  = document.createElement("span");
      dot.className = "pie-dot";
      dot.style.background = s.color;
      const lbl  = document.createElement("span");
      lbl.textContent = s.label;
      const pctS = document.createElement("span");
      pctS.className = "pie-pct";
      pctS.textContent = " " + pct + "%";
      item.appendChild(dot);
      item.appendChild(lbl);
      item.appendChild(pctS);
      legend.appendChild(item);
    });

    wrap.appendChild(legend);
    return wrap;
  }

  // ============================================================
  // TAB CONFRONTA — selezione alimenti + grafici a barre
  // ============================================================
  const confrontoLista   = document.getElementById("confrontoLista");
  const confrontoGrafici = document.getElementById("confrontoGrafici");
  const confrontoRicerca = document.getElementById("confrontoRicerca");
  const confrontoCancella = document.getElementById("confrontoCancella");

  // Colori: stessi assegnati ai valori nutrizionali nel resto dell'app;
  // per le calorie si usa l'azzurro del tasto "Modifica".
  const COLORI_CONFRONTO = {
    calorie:     "#4E86C8",
    proteine:    PIE.proteine,
    carboidrati: PIE.carboidrati,
    grassi:      PIE.grassi,
  };

  const CONFRONTO_METRICHE = [
    { chiave: "calorie",     etichetta: "Calorie",     unita: "kcal", colore: COLORI_CONFRONTO.calorie     },
    { chiave: "proteine",    etichetta: "Proteine",    unita: "g",    colore: COLORI_CONFRONTO.proteine    },
    { chiave: "carboidrati", etichetta: "Carboidrati", unita: "g",    colore: COLORI_CONFRONTO.carboidrati },
    { chiave: "grassi",      etichetta: "Grassi",      unita: "g",    colore: COLORI_CONFRONTO.grassi      },
  ];

  // Stato persistente: resta invariato passando da una tab all'altra,
  // si azzera solo premendo il tasto "cancella selezione".
  let confrontoSelezionati = []; // indici reali di "dispensa"

  // Ascoltatore ricerca: filtra la lista al volo senza perdere la selezione
  confrontoRicerca.addEventListener("input", () => popolaListaConfronto());

  confrontoCancella.addEventListener("click", () => {
    confrontoSelezionati = [];
    confrontoRicerca.value = "";
    popolaListaConfronto();
    aggiornaGraficiConfronto();
  });

  // Popola (o ri-popola dopo una ricerca) la lista in ordine alfabetico,
  // filtrando per il testo corrente nella barra di ricerca.
  function popolaListaConfronto() {
    confrontoLista.innerHTML = "";

    if (!dispensa.length) {
      confrontoLista.innerHTML = `<p class="confronto-vuoto">Non ci sono alimenti in dispensa.</p>`;
      return;
    }

    const query = confrontoRicerca.value.trim().toLowerCase();

    // Costruisce coppie {idx, prodotto} ordinate alfabeticamente per nome
    const voci = dispensa
      .map((p, idx) => ({ idx, p }))
      .sort((a, b) => a.p.nome.localeCompare(b.p.nome, "it"));

    // Filtra per query (cerca su nome e tag)
    const vociFiltrate = query
      ? voci.filter(({ p }) =>
          p.nome.toLowerCase().includes(query) ||
          (p.tag || "").toLowerCase().includes(query)
        )
      : voci;

    if (!vociFiltrate.length) {
      confrontoLista.innerHTML = `<p class="confronto-vuoto">Nessun alimento corrisponde alla ricerca.</p>`;
      return;
    }

    const pieno = confrontoSelezionati.length >= 5;

    vociFiltrate.forEach(({ idx, p }) => {
      const isSelezionato = confrontoSelezionati.includes(idx);

      const item = document.createElement("label");
      item.className = "confronto-item" +
        (isSelezionato ? " selezionato" : "") +
        (!isSelezionato && pieno ? " disabilitato" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isSelezionato;
      cb.disabled = !isSelezionato && pieno;

      const nomeSpan = document.createElement("span");
      nomeSpan.className = "confronto-nome";
      nomeSpan.textContent = p.nome + (p.marca ? ` (${p.marca})` : "");

      const tagSpan = document.createElement("span");
      tagSpan.className = "confronto-tag";
      tagSpan.textContent = p.tag || "Senza tag";

      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (confrontoSelezionati.length >= 5) {
            cb.checked = false;
            alert("Puoi selezionare al massimo 5 alimenti.");
            return;
          }
          confrontoSelezionati.push(idx);
        } else {
          confrontoSelezionati = confrontoSelezionati.filter(i => i !== idx);
        }
        // Ri-popola la lista per aggiornare stati disabilitato/selezionato
        popolaListaConfronto();
        aggiornaGraficiConfronto();
      });

      item.appendChild(cb);
      item.appendChild(nomeSpan);
      item.appendChild(tagSpan);
      confrontoLista.appendChild(item);
    });
  }

  function aggiornaGraficiConfronto() {
    confrontoGrafici.innerHTML = "";

    if (!confrontoSelezionati.length) {
      confrontoGrafici.innerHTML = `<p class="confronto-vuoto">Seleziona almeno un alimento per vedere il confronto.</p>`;
      return;
    }

    const foods = confrontoSelezionati.map(idx => dispensa[idx]);
    CONFRONTO_METRICHE.forEach(metrica => {
      confrontoGrafici.appendChild(buildBarChart(metrica, foods));
    });
  }

  function buildBarChart(metrica, foods) {
    const blocco = document.createElement("div");
    blocco.className = "confronto-grafico-blocco";

    const titolo = document.createElement("h4");
    titolo.textContent = `${metrica.etichetta} (${metrica.unita} per 100g)`;
    blocco.appendChild(titolo);

    const valori = foods.map(f => parseFloat(f[metrica.chiave]) || 0);
    const max = Math.max(...valori, 1) * 1.18;

    const W = 320, H = 180;
    const padBottom = 34, padTop = 22, padSide = 14;
    const n = foods.length;
    const slotW = (W - padSide * 2) / n;
    const barW = Math.min(slotW * 0.55, 46);

    const NS  = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const baseLine = document.createElementNS(NS, "line");
    baseLine.setAttribute("class", "barra-base");
    baseLine.setAttribute("x1", padSide);
    baseLine.setAttribute("x2", W - padSide);
    baseLine.setAttribute("y1", H - padBottom);
    baseLine.setAttribute("y2", H - padBottom);
    baseLine.setAttribute("stroke-width", "1");
    svg.appendChild(baseLine);

    foods.forEach((f, i) => {
      const val   = valori[i];
      const barH  = max > 0 ? (val / max) * (H - padBottom - padTop) : 0;
      const cx    = padSide + slotW * i + slotW / 2;
      const x     = cx - barW / 2;
      const y     = H - padBottom - barH;

      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", x.toFixed(1));
      rect.setAttribute("y", y.toFixed(1));
      rect.setAttribute("width", barW.toFixed(1));
      rect.setAttribute("height", Math.max(barH, 0).toFixed(1));
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", metrica.colore);
      svg.appendChild(rect);

      const valText = document.createElementNS(NS, "text");
      valText.setAttribute("class", "barra-valore");
      valText.setAttribute("x", cx.toFixed(1));
      valText.setAttribute("y", (y - 6).toFixed(1));
      valText.setAttribute("text-anchor", "middle");
      valText.setAttribute("font-size", "11");
      valText.textContent = (val % 1 === 0) ? val : val.toFixed(1);
      svg.appendChild(valText);

      const nomeText = document.createElementNS(NS, "text");
      nomeText.setAttribute("class", "barra-nome");
      nomeText.setAttribute("x", cx.toFixed(1));
      nomeText.setAttribute("y", (H - padBottom + 16).toFixed(1));
      nomeText.setAttribute("text-anchor", "middle");
      nomeText.setAttribute("font-size", "10");
      nomeText.textContent = f.nome.length > 10 ? f.nome.slice(0, 9) + "…" : f.nome;
      svg.appendChild(nomeText);
    });

    blocco.appendChild(svg);
    return blocco;
  }

  // ============================================================
  // CREAZIONE CARD PRODOTTO
  // ============================================================
  function creaCardProdotto(p) {
    // Classe colore scadenza:
    // scaduto -> rosso | scade entro 1 mese -> giallo | oltre 1 mese -> verde
    let classe = "";
    if (p.scadenza) {
      const diff = (new Date(p.scadenza) - new Date()) / 86400000;
      classe = diff < 0 ? "scaduto" : diff < 30 ? "scadenza-vicina" : "scadenza-ok";
    }

    const cals = p.calorie     ? p.calorie     + " kcal" : "—";
    const prot = p.proteine    ? p.proteine    + " g"    : "—";
    const carb = p.carboidrati ? p.carboidrati + " g"    : "—";
    const gras = p.grassi      ? p.grassi      + " g"    : "—";
    const qta  = p.quantita    ? p.quantita + " " + (p.unita || "") : "";

    const card = document.createElement("div");
    card.className = "prodotto " + classe;

    // Nome (cliccabile per espandere)
    const nomeEl = document.createElement("div");
    nomeEl.className = "prodotto-nome" + (p.expanded ? " aperto" : "");
    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.textContent = "\u25B6";
    nomeEl.appendChild(chevron);
    const nomeTxt = document.createTextNode(p.nome + (p.marca ? ` (${p.marca})` : ""));
    nomeEl.appendChild(nomeTxt);
    if (qta) {
      const qtaEl = document.createElement("span");
      qtaEl.style.cssText = "font-weight:normal;font-size:13px;color:var(--text-muted);margin-left:4px;";
      qtaEl.textContent = "(" + qta.trim() + ")";
      nomeEl.appendChild(qtaEl);
    }

    // Data scadenza
    const dataEl = document.createElement("p");
    dataEl.className = "prodotto-data";
    dataEl.textContent = "Scadenza: " + (p.scadenza || "non impostata");

    // Sezione espandibile
    const extra = document.createElement("div");
    extra.className = "extra";
    extra.style.display = p.expanded ? "block" : "none";

    // Valori + torta
    const inner = document.createElement("div");
    inner.className = "extra-inner";

    const valori = document.createElement("div");
    valori.className = "extra-valori";

    const righe = [
      { label: "Valori per 100g:", valore: null, bold: true },
      { label: "Calorie: " + cals, valore: null, bold: false },
      { label: "Proteine: " + prot, valore: null, bold: false },
      { label: "Carboidrati: " + carb, valore: null, bold: false },
      { label: "Grassi: " + gras, valore: null, bold: false },
    ];
    righe.forEach(r => {
      const el = document.createElement("p");
      if (r.bold) { const s = document.createElement("strong"); s.textContent = r.label; el.appendChild(s); }
      else { el.textContent = r.label; }
      if (r.colore) { el.style.color = r.colore; el.style.fontWeight = "600"; }
      valori.appendChild(el);
    });

    inner.appendChild(valori);
    inner.appendChild(buildPie(p.carboidrati, p.proteine, p.grassi));
    extra.appendChild(inner);

    // Bottoni azione
    const azioni = document.createElement("div");
    azioni.className = "prodotto-azioni";

    const btnMod = document.createElement("button");
    btnMod.className = "btn-modifica";
    btnMod.textContent = "Modifica";
    btnMod.addEventListener("click", e => { e.stopPropagation(); apriModaleModifica(p.realIndex); });

    const btnRim = document.createElement("button");
    btnRim.className = "btn-rimuovi";
    btnRim.textContent = "Rimuovi";
    btnRim.addEventListener("click", e => { e.stopPropagation(); rimuovi(p.realIndex); });

    azioni.appendChild(btnMod);
    azioni.appendChild(btnRim);
    extra.appendChild(azioni);

    card.appendChild(nomeEl);
    card.appendChild(dataEl);
    card.appendChild(extra);

    // Toggle espandi/chiudi solo sul nome
    nomeEl.addEventListener("click", e => {
      e.stopPropagation();
      dispensa[p.realIndex].expanded = !dispensa[p.realIndex].expanded;
      salva();
      render();
    });

    return card;
  }

  // ============================================================
  // RENDER LISTA PRODOTTI
  // ============================================================
  function render() {
    dispensaDiv.innerHTML = "";

    let lista = [...dispensa];

    if (filtroTag !== "TUTTI") lista = lista.filter(p => p.tag === filtroTag);

    if (filtroScadenza === "7") {
      lista = lista.filter(p => {
        if (!p.scadenza) return false;
        const d = (new Date(p.scadenza) - new Date()) / 86400000;
        return d >= 0 && d <= 7;
      });
    } else if (filtroScadenza === "30") {
      lista = lista.filter(p => {
        if (!p.scadenza) return false;
        const d = (new Date(p.scadenza) - new Date()) / 86400000;
        return d >= 0 && d <= 30;
      });
    }

    lista = applicaOrdinamento(lista);

    if (!lista.length) {
      const msg = document.createElement("p");
      msg.style.cssText = "color:var(--text-muted);text-align:center;margin-top:20px;font-style:italic;";
      msg.textContent = "Nessun prodotto trovato.";
      dispensaDiv.appendChild(msg);
      return;
    }

    if (ordinamento === "data") {
      // Ordine di default: raggruppato per tag/categoria
      const gruppi = {};
      const ordineGruppi = [];
      lista.forEach(p => {
        const ri = dispensa.indexOf(p);
        const k  = p.tag || "";
        if (!gruppi[k]) { gruppi[k] = []; ordineGruppi.push(k); }
        gruppi[k].push({ ...p, realIndex: ri });
      });

      ordineGruppi.forEach(tag => {
        const titolo = document.createElement("div");
        titolo.className = "tag-title";
        titolo.textContent = tag || "Senza tag";
        dispensaDiv.appendChild(titolo);

        gruppi[tag].forEach(p => {
          dispensaDiv.appendChild(creaCardProdotto(p));
        });
      });
    } else {
      // Ordinamento per criterio scelto: lista unica, indipendente dal tag
      lista.forEach(p => {
        const ri = dispensa.indexOf(p);
        dispensaDiv.appendChild(creaCardProdotto({ ...p, realIndex: ri }));
      });
    }
  }

  // ============================================================
  // AGGIUNGI PRODOTTO
  // ============================================================
  addBtn.addEventListener("click", () => {
    const tag  = tagInputEl.value.trim() || tagSelectEl.value;
    if (!tag)  { alert("Seleziona o inserisci un tag."); return; }
    const nome = nomeInput.value.trim();
    if (!nome) { alert("Il nome del prodotto e obbligatorio."); return; }

    pushUndo();
    if (!tags.includes(tag)) tags.push(tag);

    const prodotto = {
      nome,
      marca:       marcaInput.value.trim(),
      scadenza:    scadenzaInput.value,
      quantita:    quantitaInput.value,
      unita:       unitaSelect.value,
      calorie:     calorieInput.value.trim(),
      proteine:    proteineInput.value.trim(),
      carboidrati: carboidratiInput.value.trim(),
      grassi:      grassiInput.value.trim(),
      tag,
      expanded: false,
    };

    const ci = catalogo.findIndex(p => p.nome.toLowerCase() === nome.toLowerCase());
    if (ci === -1) {
      catalogo.push({ ...prodotto });
    } else {
      const scad = catalogo[ci].scadenza;
      Object.assign(catalogo[ci], prodotto);
      catalogo[ci].scadenza = scad;
    }

    dispensa.push(prodotto);
    salva();
    aggiornaTagSelect();
    aggiornaTagBar();
    render();

    // Reset campi
    nomeInput.value = ""; marcaInput.value = ""; scadenzaInput.value = "";
    quantitaInput.value = ""; unitaSelect.value = "pz";
    tagInputEl.value = ""; tagSelectEl.value = "";
    calorieInput.value = ""; proteineInput.value = "";
    carboidratiInput.value = ""; grassiInput.value = "";

    // Porta l'utente alla tab dispensa dopo l'aggiunta
    document.querySelector('.tab-btn[data-tab="dispensa"]').click();
  });

  // ============================================================
  // RIMUOVI PRODOTTO
  // ============================================================
  function rimuovi(i) {
    pushUndo();
    dispensa.splice(i, 1);
    salva();
    aggiornaTagBar();
    render();
  }

  // ============================================================
  // TAB PASTI (ex Unisci) — combina fino a 10 alimenti con grammi liberi
  // ============================================================
  const pastiLista      = document.getElementById("pastiLista");
  const pastiRicerca    = document.getElementById("pastiRicerca");
  const pastiRisultato  = document.getElementById("pastiRisultato");
  const pastiPieSvg     = document.getElementById("pastiPieSvg");
  const pastiLeggenda   = document.getElementById("pastiLeggenda");
  const pastiValori     = document.getElementById("pastiValori");
  const pastiVuoto      = document.getElementById("pastiVuoto");
  const pastiCancella   = document.getElementById("pastiCancella");
  const pastiGrammiBox  = document.getElementById("pastiGrammiBox");
  const pastiGrammiLista = document.getElementById("pastiGrammiLista");
  const aggiungiPastoBtn = document.getElementById("aggiungiPastoBtn");

  // Stato persistente: resta invariato passando da una tab all'altra,
  // si azzera solo premendo il tasto "cancella selezione".
  let pastiSelezionati = {}; // { idx: grammi }

  pastiRicerca.addEventListener("input", () => popolaListaPasti());

  pastiCancella.addEventListener("click", () => {
    pastiSelezionati = {};
    pastiRicerca.value = "";
    popolaListaPasti();
    aggiornaPasti();
  });

  function popolaListaPasti() {
    pastiLista.innerHTML = "";

    if (!dispensa.length) {
      pastiLista.innerHTML = `<p class="confronto-vuoto">Non ci sono alimenti in dispensa.</p>`;
    } else {
      const query = pastiRicerca.value.trim().toLowerCase();
      const voci = dispensa
        .map((p, idx) => ({ idx, p }))
        .sort((a, b) => a.p.nome.localeCompare(b.p.nome, "it"));

      const vociFiltrate = query
        ? voci.filter(({ p }) =>
            p.nome.toLowerCase().includes(query) ||
            (p.tag || "").toLowerCase().includes(query))
        : voci;

      if (!vociFiltrate.length) {
        pastiLista.innerHTML = `<p class="confronto-vuoto">Nessun alimento corrisponde alla ricerca.</p>`;
      } else {
        const pieno = Object.keys(pastiSelezionati).length >= 10;

        vociFiltrate.forEach(({ idx, p }) => {
          const isSelezionato = idx in pastiSelezionati;

          const item = document.createElement("label");
          item.className = "confronto-item" +
            (isSelezionato ? " selezionato" : "") +
            (!isSelezionato && pieno ? " disabilitato" : "");

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = isSelezionato;
          cb.disabled = !isSelezionato && pieno;

          const nomeSpan = document.createElement("span");
          nomeSpan.className = "confronto-nome";
          nomeSpan.textContent = p.nome + (p.marca ? ` (${p.marca})` : "");

          const tagSpan = document.createElement("span");
          tagSpan.className = "confronto-tag";
          tagSpan.textContent = p.tag || "Senza tag";

          cb.addEventListener("change", () => {
            if (cb.checked) {
              if (Object.keys(pastiSelezionati).length >= 10) {
                cb.checked = false;
                alert("Puoi selezionare al massimo 10 alimenti.");
                return;
              }
              pastiSelezionati[idx] = 100; // grammi default
            } else {
              delete pastiSelezionati[idx];
            }
            popolaListaPasti();
            aggiornaPasti();
          });

          item.appendChild(cb);
          item.appendChild(nomeSpan);
          item.appendChild(tagSpan);
          pastiLista.appendChild(item);
        });
      }
    }

    // Lista grammi: contenitore separato, sempre aggiornato
    // indipendentemente dall'esito della ricerca sopra.
    popolaGrammiPasti();
  }

  // Disegna la lista "grammi per alimento selezionato" in un blocco
  // del tutto separato dalla lista di selezione, cosi' non serve
  // scorrere fino in fondo per modificare le quantita'.
  function popolaGrammiPasti() {
    pastiGrammiLista.innerHTML = "";

    const selezionatiOrdinati = Object.keys(pastiSelezionati)
      .map(i => ({ idx: +i, p: dispensa[+i] }))
      .filter(({ p }) => !!p)
      .sort((a, b) => a.p.nome.localeCompare(b.p.nome, "it"));

    if (!selezionatiOrdinati.length) {
      pastiGrammiBox.classList.add("hidden");
      return;
    }
    pastiGrammiBox.classList.remove("hidden");

    selezionatiOrdinati.forEach(({ idx, p }) => {
      const row = document.createElement("div");
      row.className = "unisci-grammi-row";

      const nome = document.createElement("span");
      nome.className = "unisci-grammi-nome";
      nome.textContent = p.nome + (p.marca ? ` (${p.marca})` : "");

      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.step = "1";
      inp.value = pastiSelezionati[idx];
      inp.className = "unisci-grammi-input";
      inp.inputMode = "decimal";

      inp.addEventListener("input", () => {
        const v = parseFloat(inp.value);
        pastiSelezionati[idx] = isNaN(v) || v < 0 ? 0 : v;
        aggiornaPasti();
      });

      const unit = document.createElement("span");
      unit.className = "unisci-grammi-unit";
      unit.textContent = "g";

      row.appendChild(nome);
      row.appendChild(inp);
      row.appendChild(unit);
      pastiGrammiLista.appendChild(row);
    });
  }

  function aggiornaPasti() {
    const sel = Object.keys(pastiSelezionati);
    if (!sel.length) {
      pastiRisultato.classList.add("hidden");
      aggiungiPastoBtn.classList.add("hidden");
      pastiVuoto.classList.remove("hidden");
      return;
    }
    pastiVuoto.classList.add("hidden");
    pastiRisultato.classList.remove("hidden");
    aggiungiPastoBtn.classList.remove("hidden");

    // Calcola totali pesati per i grammi impostati
    let totCal = 0, totProt = 0, totCarb = 0, totGras = 0;
    sel.forEach(i => {
      const p = dispensa[+i];
      const g = pastiSelezionati[+i] || 0;
      const f = g / 100; // i valori nutrizionali sono per 100g
      totCal  += (parseFloat(p.calorie)     || 0) * f;
      totProt += (parseFloat(p.proteine)    || 0) * f;
      totCarb += (parseFloat(p.carboidrati) || 0) * f;
      totGras += (parseFloat(p.grassi)      || 0) * f;
    });

    // Grafico a torta (proporzionale su prot+carb+grassi in g)
    const totMacro = totProt + totCarb + totGras;
    const slices = [
      { label: "Proteine",    valore: totProt, colore: PIE.proteine,    unita: "g"    },
      { label: "Carboidrati", valore: totCarb, colore: PIE.carboidrati, unita: "g"    },
      { label: "Grassi",      valore: totGras, colore: PIE.grassi,      unita: "g"    },
    ].filter(s => s.valore > 0);

    disegnaTortaPasti(slices, totMacro);
    disegnaLeggendaPasti(slices, totMacro);
    disegnaValoriPasti(totCal, totProt, totCarb, totGras);
  }

  function disegnaTortaPasti(slices, tot) {
    const NS = "http://www.w3.org/2000/svg";
    pastiPieSvg.innerHTML = "";
    if (!slices.length || tot === 0) {
      // Cerchio grigio se nessun macro
      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("cx", "100"); circle.setAttribute("cy", "100");
      circle.setAttribute("r", "90"); circle.setAttribute("fill", "var(--border)");
      pastiPieSvg.appendChild(circle);
      return;
    }
    const R = 90, cx = 100, cy = 100;
    let ang = 0;
    slices.forEach(s => {
      const delta = (s.valore / tot) * 2 * Math.PI;
      const end   = ang + delta;
      let d;
      if (slices.length === 1) {
        d = `M ${cx} ${cy-R} A ${R} ${R} 0 1 1 ${cx-0.001} ${cy-R} Z`;
      } else {
        const x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang);
        const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
        d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${delta > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
      }
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", s.colore);
      pastiPieSvg.appendChild(path);
      ang = end;
    });
  }

  function disegnaLeggendaPasti(slices, tot) {
    pastiLeggenda.innerHTML = "";
    slices.forEach(s => {
      const pct = tot > 0 ? Math.round((s.valore / tot) * 100) : 0;
      const row = document.createElement("div");
      row.className = "unisci-leggenda-item";
      const dot = document.createElement("span");
      dot.className = "unisci-leggenda-dot";
      dot.style.background = s.colore;
      const lbl = document.createElement("span");
      lbl.className = "unisci-leggenda-label";
      lbl.textContent = s.label;
      const pctSpan = document.createElement("span");
      pctSpan.className = "unisci-leggenda-pct";
      pctSpan.textContent = pct + "%";
      row.appendChild(dot); row.appendChild(lbl); row.appendChild(pctSpan);
      pastiLeggenda.appendChild(row);
    });
  }

  function disegnaValoriPasti(cal, prot, carb, gras) {
    pastiValori.innerHTML = "";
    const dati = [
      { label: "Calorie",     valore: cal,  unita: "kcal", colore: "#4E86C8" },
      { label: "Proteine",    valore: prot, unita: "g",    colore: PIE.proteine    },
      { label: "Carboidrati", valore: carb, unita: "g",    colore: PIE.carboidrati },
      { label: "Grassi",      valore: gras, unita: "g",    colore: PIE.grassi      },
    ];
    dati.forEach(d => {
      const card = document.createElement("div");
      card.className = "unisci-val-card";
      card.style.borderLeftColor = d.colore;
      const lbl = document.createElement("div");
      lbl.className = "unisci-val-label";
      lbl.textContent = d.label;
      const num = document.createElement("div");
      const numSpan = document.createElement("span");
      numSpan.className = "unisci-val-numero";
      numSpan.textContent = Math.round(d.valore * 10) / 10;
      const unitSpan = document.createElement("span");
      unitSpan.className = "unisci-val-unita";
      unitSpan.textContent = d.unita;
      num.appendChild(numSpan); num.appendChild(unitSpan);
      card.appendChild(lbl); card.appendChild(num);
      pastiValori.appendChild(card);
    });
  }

  // ============================================================
  // AGGIUNGI PASTO (salva nella lista pasti)
  // ============================================================
  aggiungiPastoBtn.addEventListener("click", () => {
    const sel = Object.keys(pastiSelezionati);
    if (!sel.length) return;

    let totCal = 0, totProt = 0, totCarb = 0, totGras = 0;
    const alimentiPasto = [];

    sel.forEach(i => {
      const p = dispensa[+i];
      const g = pastiSelezionati[+i] || 0;
      const f = g / 100;
      const cal  = (parseFloat(p.calorie)     || 0) * f;
      const prot = (parseFloat(p.proteine)    || 0) * f;
      const carb = (parseFloat(p.carboidrati) || 0) * f;
      const gras = (parseFloat(p.grassi)      || 0) * f;
      totCal  += cal;
      totProt += prot;
      totCarb += carb;
      totGras += gras;
      alimentiPasto.push({
        nome:   p.nome,
        marca:  p.marca || "",
        grammi: g,
        cal:    Math.round(cal  * 10) / 10,
        prot:   Math.round(prot * 10) / 10,
        carb:   Math.round(carb * 10) / 10,
        gras:   Math.round(gras * 10) / 10,
      });
    });

    const oggi = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const pasto = {
      id:       Date.now(),
      data:     oggi,
      alimenti: alimentiPasto,
      totCal:   Math.round(totCal  * 10) / 10,
      totProt:  Math.round(totProt * 10) / 10,
      totCarb:  Math.round(totCarb * 10) / 10,
      totGras:  Math.round(totGras * 10) / 10,
    };

    pasti.push(pasto);
    salva();

    // Reset selezione
    pastiSelezionati = {};
    pastiRicerca.value = "";
    popolaListaPasti();
    aggiornaPasti();

    // Feedback visivo: porta al profilo
    const msgFb = document.createElement("div");
    msgFb.className = "pasto-feedback";
    msgFb.textContent = "✓ Pasto registrato!";
    document.querySelector("#tab-pasti .card").appendChild(msgFb);
    setTimeout(() => msgFb.remove(), 2500);
  });

  // ============================================================
  // SEZIONE PROFILO — grafici andamento giornaliero
  // ============================================================
  let profiloIntervallo = "7d"; // "7d" | "1m" | "6m" | "1a"
  let profiloOffset     = 0;   // 0 = periodo corrente, -1 = periodo precedente, ecc.
  let profiloGiornoSelezionato = null; // "YYYY-MM-DD" del giorno cliccato

  // Valori ideali (persistiti)
  let ideali = caricaDati("ideali", { calorie: "", proteine: "", carboidrati: "", grassi: "" });

  // Input valori ideali
  const idealeCalInput  = document.getElementById("idealeCalorie");
  const idealePrtInput  = document.getElementById("idealeProteine");
  const idealeCrbInput  = document.getElementById("idealeCarboidrati");
  const idealeGrsInput  = document.getElementById("idealeGrassi");

  idealeCalInput.value  = ideali.calorie;
  idealePrtInput.value  = ideali.proteine;
  idealeCrbInput.value  = ideali.carboidrati;
  idealeGrsInput.value  = ideali.grassi;

  function salvaIdeali() {
    ideali.calorie     = idealeCalInput.value;
    ideali.proteine    = idealePrtInput.value;
    ideali.carboidrati = idealeCrbInput.value;
    ideali.grassi      = idealeGrsInput.value;
    try { localStorage.setItem("ideali", JSON.stringify(ideali)); } catch(e) {}
    renderProfilo();
  }

  [idealeCalInput, idealePrtInput, idealeCrbInput, idealeGrsInput].forEach(inp => {
    inp.addEventListener("change", salvaIdeali);
    inp.addEventListener("input",  salvaIdeali);
  });

  // Selettore intervallo
  document.querySelectorAll(".profilo-int-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".profilo-int-btn").forEach(b => b.classList.remove("attivo"));
      btn.classList.add("attivo");
      profiloIntervallo = btn.dataset.intervallo;
      profiloOffset = 0;
      profiloGiornoSelezionato = null;
      renderProfilo();
    });
  });

  // Navigazione periodo
  document.getElementById("profiloPrev").addEventListener("click", () => {
    profiloOffset--;
    profiloGiornoSelezionato = null;
    renderProfilo();
  });
  document.getElementById("profiloNext").addEventListener("click", () => {
    if (profiloOffset < 0) {
      profiloOffset++;
      profiloGiornoSelezionato = null;
      renderProfilo();
    }
  });

  // Calcola range date in base a intervallo + offset
  function calcolaRange() {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    let fine = new Date(oggi);
    let inizio = new Date(oggi);

    // Calcola durata del periodo
    const durazioni = { "7d": 7, "1m": 30, "6m": 182, "1a": 365 };
    const giorni = durazioni[profiloIntervallo] || 7;

    // Fine periodo (offset 0 = oggi, -1 = N giorni fa, ecc.)
    fine.setDate(fine.getDate() + profiloOffset * giorni);
    inizio = new Date(fine);
    inizio.setDate(inizio.getDate() - giorni + 1);

    return { inizio, fine };
  }

  // Formatta data per label
  function fmtData(d) {
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  }

  function fmtDataCompleta(d) {
    return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
  }

  // Genera lista di date YYYY-MM-DD nell'intervallo
  function dateNelRange(inizio, fine) {
    const lista = [];
    const cur = new Date(inizio);
    while (cur <= fine) {
      lista.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return lista;
  }

  // Raggruppa pasti per data
  function pastiPerData() {
    const mappa = {};
    pasti.forEach(pasto => {
      if (!mappa[pasto.data]) mappa[pasto.data] = [];
      mappa[pasto.data].push(pasto);
    });
    return mappa;
  }

  // Funzione principale render Profilo
  function renderProfilo() {
    const { inizio, fine } = calcolaRange();
    const date = dateNelRange(inizio, fine);
    const perData = pastiPerData();

    // Label periodo
    const navLabel = document.getElementById("profiloNavLabel");
    navLabel.textContent = `${fmtData(inizio)} – ${fmtData(fine)}`;

    // Disabilita freccia avanti se siamo già al periodo corrente
    document.getElementById("profiloNext").disabled = profiloOffset >= 0;

    // Calcola valori giornalieri
    const valoriGiornalieri = date.map(d => {
      const pastiDelGiorno = perData[d] || [];
      const totCal  = pastiDelGiorno.reduce((s, p) => s + p.totCal,  0);
      const totProt = pastiDelGiorno.reduce((s, p) => s + p.totProt, 0);
      const totCarb = pastiDelGiorno.reduce((s, p) => s + p.totCarb, 0);
      const totGras = pastiDelGiorno.reduce((s, p) => s + p.totGras, 0);
      return { data: d, cal: totCal, prot: totProt, carb: totCarb, gras: totGras, haPasti: pastiDelGiorno.length > 0 };
    });

    // Calcola medie (solo sui giorni con almeno un pasto)
    const giorniConPasti = valoriGiornalieri.filter(v => v.haPasti);
    const n = giorniConPasti.length || 1;
    const mediaCal  = giorniConPasti.reduce((s, v) => s + v.cal,  0) / n;
    const mediaProt = giorniConPasti.reduce((s, v) => s + v.prot, 0) / n;
    const mediaCarb = giorniConPasti.reduce((s, v) => s + v.carb, 0) / n;
    const mediaGras = giorniConPasti.reduce((s, v) => s + v.gras, 0) / n;

    // Definizione metriche grafici
    const metriche = [
      { svgId: "graficoCalorie",     mediaId: "mediaCalorie",     chiave: "cal",  colore: "#4E86C8", unita: "kcal", media: mediaCal,  ideale: parseFloat(ideali.calorie)     || 0 },
      { svgId: "graficoProteine",    mediaId: "mediaProteine",    chiave: "prot", colore: "#8e94f2", unita: "g",    media: mediaProt, ideale: parseFloat(ideali.proteine)    || 0 },
      { svgId: "graficoCarboidrati", mediaId: "mediaCarboidrati", chiave: "carb", colore: "#ee8434", unita: "g",    media: mediaCarb, ideale: parseFloat(ideali.carboidrati) || 0 },
      { svgId: "graficoGrassi",      mediaId: "mediaGrassi",      chiave: "gras", colore: "#a1da4c", unita: "g",    media: mediaGras, ideale: parseFloat(ideali.grassi)      || 0 },
    ];

    metriche.forEach(m => {
      const svg = document.getElementById(m.svgId);
      const valori = valoriGiornalieri.map(v => v[m.chiave]);
      disegnaGraficoProfilo(svg, valori, date, valoriGiornalieri, m.colore, m.ideale, m.unita);

      const mediaEl = document.getElementById(m.mediaId);
      const medVal = giorniConPasti.length > 0 ? Math.round(m.media * 10) / 10 : null;
      mediaEl.textContent = medVal !== null
        ? `Media periodo: ${medVal} ${m.unita}/giorno`
        : "Nessun dato nel periodo";
    });

    // Mostra pasti del giorno selezionato
    renderPastiGiorno(profiloGiornoSelezionato, perData);
  }

  function disegnaGraficoProfilo(svg, valori, date, valoriGiornalieri, colore, ideale, unita) {
    svg.innerHTML = "";
    const NS = "http://www.w3.org/2000/svg";

    const W = 320, H = 160;
    const padBottom = 28, padTop = 14, padLeft = 36, padRight = 8;
    const areaW = W - padLeft - padRight;
    const areaH = H - padBottom - padTop;
    const n = valori.length;
    if (n === 0) return;

    const maxVal = Math.max(...valori, ideale || 0, 1);
    const maxEff = maxVal * 1.15;

    // Linee di sfondo (griglia orizzontale)
    const stepY = Math.ceil(maxEff / 4);
    for (let i = 0; i <= 4; i++) {
      const v = i * stepY;
      const y = padTop + areaH - (v / maxEff) * areaH;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", padLeft);
      line.setAttribute("x2", W - padRight);
      line.setAttribute("y1", y.toFixed(1));
      line.setAttribute("y2", y.toFixed(1));
      line.setAttribute("stroke", "var(--border)");
      line.setAttribute("stroke-width", "0.5");
      svg.appendChild(line);

      // Label asse Y
      const lbl = document.createElementNS(NS, "text");
      lbl.setAttribute("x", (padLeft - 3).toString());
      lbl.setAttribute("y", (y + 3).toFixed(1));
      lbl.setAttribute("text-anchor", "end");
      lbl.setAttribute("font-size", "8");
      lbl.setAttribute("fill", "var(--text-muted)");
      lbl.setAttribute("font-family", "Arial, sans-serif");
      lbl.textContent = v > 999 ? Math.round(v / 100) / 10 + "k" : v;
      svg.appendChild(lbl);
    }

    // Barre
    const slotW = areaW / n;
    const barW  = Math.max(Math.min(slotW * 0.65, 22), 4);

    valori.forEach((val, i) => {
      const barH = maxEff > 0 ? (val / maxEff) * areaH : 0;
      const cx   = padLeft + slotW * i + slotW / 2;
      const x    = cx - barW / 2;
      const y    = padTop + areaH - barH;

      // Barra
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", x.toFixed(1));
      rect.setAttribute("y", y.toFixed(1));
      rect.setAttribute("width", barW.toFixed(1));
      rect.setAttribute("height", Math.max(barH, 0).toFixed(1));
      rect.setAttribute("rx", "3");
      rect.setAttribute("fill", profiloGiornoSelezionato === date[i] ? colore : colore + "CC");
      rect.setAttribute("stroke", profiloGiornoSelezionato === date[i] ? "#fff" : "none");
      rect.setAttribute("stroke-width", "1.5");
      rect.style.cursor = "pointer";
      rect.style.transition = "opacity 0.15s";

      // Hover e click
      rect.addEventListener("mouseenter", () => rect.setAttribute("fill", colore));
      rect.addEventListener("mouseleave", () => {
        rect.setAttribute("fill", profiloGiornoSelezionato === date[i] ? colore : colore + "CC");
      });
      rect.addEventListener("click", () => {
        profiloGiornoSelezionato = profiloGiornoSelezionato === date[i] ? null : date[i];
        renderProfilo();
      });

      svg.appendChild(rect);

      // Label data asse X (ogni N giorni per non sovraffollare)
      const totDays = valori.length;
      const mostraLabel = totDays <= 14 || i % Math.ceil(totDays / 8) === 0 || i === totDays - 1;
      if (mostraLabel) {
        const d = new Date(date[i] + "T00:00:00");
        const lbl = document.createElementNS(NS, "text");
        lbl.setAttribute("x", cx.toFixed(1));
        lbl.setAttribute("y", (H - padBottom + 12).toFixed(1));
        lbl.setAttribute("text-anchor", "middle");
        lbl.setAttribute("font-size", "7");
        lbl.setAttribute("fill", "var(--text-muted)");
        lbl.setAttribute("font-family", "Arial, sans-serif");
        lbl.textContent = `${d.getDate()}/${d.getMonth() + 1}`;
        svg.appendChild(lbl);
      }
    });

    // Linea ideale (rossa tratteggiata)
    if (ideale > 0) {
      const yIdeale = padTop + areaH - (ideale / maxEff) * areaH;
      const lineaIdeale = document.createElementNS(NS, "line");
      lineaIdeale.setAttribute("x1", padLeft.toString());
      lineaIdeale.setAttribute("x2", (W - padRight).toString());
      lineaIdeale.setAttribute("y1", yIdeale.toFixed(1));
      lineaIdeale.setAttribute("y2", yIdeale.toFixed(1));
      lineaIdeale.setAttribute("stroke", "#e63946");
      lineaIdeale.setAttribute("stroke-width", "1.5");
      lineaIdeale.setAttribute("stroke-dasharray", "4,3");
      svg.appendChild(lineaIdeale);

      // Label valore ideale
      const lblIdeale = document.createElementNS(NS, "text");
      lblIdeale.setAttribute("x", (W - padRight).toString());
      lblIdeale.setAttribute("y", (yIdeale - 3).toFixed(1));
      lblIdeale.setAttribute("text-anchor", "end");
      lblIdeale.setAttribute("font-size", "8");
      lblIdeale.setAttribute("fill", "#e63946");
      lblIdeale.setAttribute("font-family", "Arial, sans-serif");
      lblIdeale.textContent = ideale + " " + unita;
      svg.appendChild(lblIdeale);
    }
  }

  // ============================================================
  // RENDER PASTI DEL GIORNO SELEZIONATO
  // ============================================================
  function renderPastiGiorno(dataStr, perData) {
    const sezione    = document.getElementById("profiloPastiGiorno");
    const titolo     = document.getElementById("profiloPastiGiornoTitolo");
    const lista      = document.getElementById("profiloPastiGiornoLista");

    if (!dataStr) {
      sezione.style.display = "none";
      return;
    }

    const pastiGiorno = perData[dataStr] || [];
    sezione.style.display = "block";

    const d = new Date(dataStr + "T00:00:00");
    titolo.textContent = "Pasti del " + fmtDataCompleta(d);
    lista.innerHTML = "";

    if (!pastiGiorno.length) {
      lista.innerHTML = `<p class="confronto-vuoto">Nessun pasto registrato in questo giorno.</p>`;
      return;
    }

    pastiGiorno.forEach(pasto => {
      const card = document.createElement("div");
      card.className = "profilo-pasto-card";

      // Header pasto con totali
      const header = document.createElement("div");
      header.className = "profilo-pasto-header";

      const orario = document.createElement("span");
      orario.className = "profilo-pasto-orario";
      orario.textContent = `ID ${pasto.id % 10000}`;

      const totali = document.createElement("span");
      totali.className = "profilo-pasto-totali";
      totali.textContent = `${pasto.totCal} kcal · P:${pasto.totProt}g · C:${pasto.totCarb}g · G:${pasto.totGras}g`;

      header.appendChild(orario);
      header.appendChild(totali);
      card.appendChild(header);

      // Lista alimenti
      const alimentiEl = document.createElement("ul");
      alimentiEl.className = "profilo-pasto-alimenti";
      pasto.alimenti.forEach(a => {
        const li = document.createElement("li");
        li.textContent = `${a.nome}${a.marca ? ` (${a.marca})` : ""} — ${a.grammi}g → ${a.cal} kcal`;
        alimentiEl.appendChild(li);
      });
      card.appendChild(alimentiEl);

      // Azioni
      const azioni = document.createElement("div");
      azioni.className = "profilo-pasto-azioni";

      const btnMod = document.createElement("button");
      btnMod.className = "btn-modifica";
      btnMod.textContent = "Modifica";
      btnMod.addEventListener("click", () => apriModalePasto(pasto));

      const btnDel = document.createElement("button");
      btnDel.className = "btn-rimuovi";
      btnDel.textContent = "Elimina";
      btnDel.addEventListener("click", () => {
        if (!confirm("Eliminare questo pasto?")) return;
        pasti = pasti.filter(p => p.id !== pasto.id);
        salva();
        renderProfilo();
      });

      azioni.appendChild(btnMod);
      azioni.appendChild(btnDel);
      card.appendChild(azioni);

      lista.appendChild(card);
    });
  }

  // ============================================================
  // MODALE MODIFICA PASTO
  // ============================================================
  const modalePasto       = document.getElementById("modalePasto");
  const modalePastoData   = document.getElementById("modalePastoData");
  const modalePastoAl     = document.getElementById("modalePastoAlimenti");
  const salvaModPastoBtn  = document.getElementById("salvaModificaPasto");
  const chiudiModalePasto = document.getElementById("chiudiModalePasto");

  let pastoInModifica = null;
  let grammiModifica  = {}; // { index: grammi }

  function apriModalePasto(pasto) {
    pastoInModifica = pasto;
    const d = new Date(pasto.data + "T00:00:00");
    modalePastoData.textContent = fmtDataCompleta(d);
    modalePastoAl.innerHTML = "";
    grammiModifica = {};

    pasto.alimenti.forEach((a, i) => {
      grammiModifica[i] = a.grammi;
      const row = document.createElement("div");
      row.className = "unisci-grammi-row";

      const nome = document.createElement("span");
      nome.className = "unisci-grammi-nome";
      nome.textContent = a.nome + (a.marca ? ` (${a.marca})` : "");

      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.step = "1";
      inp.value = a.grammi;
      inp.className = "unisci-grammi-input";
      inp.inputMode = "decimal";
      inp.addEventListener("input", () => {
        const v = parseFloat(inp.value);
        grammiModifica[i] = isNaN(v) || v < 0 ? 0 : v;
      });

      const unit = document.createElement("span");
      unit.className = "unisci-grammi-unit";
      unit.textContent = "g";

      row.appendChild(nome);
      row.appendChild(inp);
      row.appendChild(unit);
      modalePastoAl.appendChild(row);
    });

    modalePasto.classList.remove("hidden");
  }

  salvaModPastoBtn.addEventListener("click", () => {
    if (!pastoInModifica) return;
    // Ricalcola i totali con i nuovi grammi
    const idx = pasti.findIndex(p => p.id === pastoInModifica.id);
    if (idx === -1) return;

    let totCal = 0, totProt = 0, totCarb = 0, totGras = 0;
    const nuoviAlimenti = pastoInModifica.alimenti.map((a, i) => {
      const g = grammiModifica[i] || 0;
      // Cerca il prodotto in dispensa o catalogo per ricalcolare
      const prod = catalogo.find(p => p.nome.toLowerCase() === a.nome.toLowerCase()) ||
                   dispensa.find(p => p.nome.toLowerCase() === a.nome.toLowerCase());
      const f = g / 100;
      const cal  = prod ? (parseFloat(prod.calorie)     || 0) * f : a.cal  * (g / (a.grammi || 1));
      const prot = prod ? (parseFloat(prod.proteine)    || 0) * f : a.prot * (g / (a.grammi || 1));
      const carb = prod ? (parseFloat(prod.carboidrati) || 0) * f : a.carb * (g / (a.grammi || 1));
      const gras = prod ? (parseFloat(prod.grassi)      || 0) * f : a.gras * (g / (a.grammi || 1));
      totCal  += cal;
      totProt += prot;
      totCarb += carb;
      totGras += gras;
      return {
        ...a,
        grammi: g,
        cal:  Math.round(cal  * 10) / 10,
        prot: Math.round(prot * 10) / 10,
        carb: Math.round(carb * 10) / 10,
        gras: Math.round(gras * 10) / 10,
      };
    });

    pasti[idx] = {
      ...pasti[idx],
      alimenti: nuoviAlimenti,
      totCal:   Math.round(totCal  * 10) / 10,
      totProt:  Math.round(totProt * 10) / 10,
      totCarb:  Math.round(totCarb * 10) / 10,
      totGras:  Math.round(totGras * 10) / 10,
    };

    salva();
    modalePasto.classList.add("hidden");
    pastoInModifica = null;
    renderProfilo();
  });

  chiudiModalePasto.addEventListener("click", () => {
    modalePasto.classList.add("hidden");
    pastoInModifica = null;
  });
  modalePasto.addEventListener("click", e => {
    if (e.target === modalePasto) {
      modalePasto.classList.add("hidden");
      pastoInModifica = null;
    }
  });

  // ============================================================
  // AVVIO
  // ============================================================
  aggiornaTagSelect();
  aggiornaTagBar();
  aggiornaUndoRedo();
  render();

}); // fine DOMContentLoaded
