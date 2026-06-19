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
      if (target === "confronta") renderConfronto();
    });
  });

  // ============================================================
  // ELEMENTI UI
  // ============================================================
  const nomeInput        = document.getElementById("nome");
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
      li.textContent = p.nome;
      li.addEventListener("click", () => {
        nomeInput.value        = p.nome;
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

  // Ogni voce memorizza sia l'indice reale in "dispensa" sia il prodotto
  // così la selezione resta stabile mentre la lista viene filtrata.
  let confrontoSelezionati = []; // indici reali di "dispensa"

  // Ascoltatore ricerca: filtra la lista al volo senza perdere la selezione
  confrontoRicerca.addEventListener("input", () => popolaListaConfronto());

  function renderConfronto() {
    confrontoSelezionati = [];
    confrontoRicerca.value = "";
    popolaListaConfronto();
    aggiornaGraficiConfronto();
  }

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
      nomeSpan.textContent = p.nome;

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

  function aggiornaStatoCheckboxConfronto() {
    const pieno = confrontoSelezionati.length >= 5;
    confrontoLista.querySelectorAll(".confronto-item").forEach(item => {
      const cb = item.querySelector("input[type=checkbox]");
      if (!cb.checked) {
        cb.disabled = pieno;
        item.classList.toggle("disabilitato", pieno);
      }
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
    const nomeTxt = document.createTextNode(p.nome);
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
    nomeInput.value = ""; scadenzaInput.value = "";
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
  // AVVIO
  // ============================================================
  aggiornaTagSelect();
  aggiornaTagBar();
  aggiornaUndoRedo();
  render();

}); // fine DOMContentLoaded
