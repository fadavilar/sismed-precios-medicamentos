/* ============================================================
   Precios de medicamentos en Colombia (SISMED · SISPRO)
   Documento navegable: resumen, objetivo, materiales y métodos, y tres
   vistas de resultados (precios por unidad con termómetro, distribución
   del mercado relevante y precio reportado frente al regulado). Un solo
   eslabón por canal: transacción final institucional y venta primaria
   comercial del laboratorio. Toda vista exporta a Excel.
   Datos: data/meta.json, resumen.json, tendencia.json, productos.json,
   analisis/<año>.json, regulacion.json y data/y/<año>/<ATC>.json
   (generados por agent/sismed_agent.py).
   ============================================================ */
(function(){
  "use strict";

  /* ---------------- Tema ---------------- */
  const THEME_KEY = "sismed_theme";
  function applyTheme(m){ if(m === "light" || m === "dark") document.documentElement.setAttribute("data-theme", m); else document.documentElement.removeAttribute("data-theme"); }
  const effectiveTheme = ()=> document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  try{ applyTheme(localStorage.getItem(THEME_KEY)); }catch(e){}

  /* ---------------- Utilidades ---------------- */
  const svgNS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, kids){
    const n = document.createElement(tag);
    if(attrs) for(const k in attrs){ const v = attrs[k]; if(v == null || v === false) continue;
      if(k === "class") n.className = v; else if(k === "html") n.innerHTML = v; else if(k.slice(0,2) === "on") n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v); }
    (kids||[]).forEach(c=>{ if(c != null && c !== false) n.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c); });
    return n;
  }
  function svg(tag, attrs, kids){
    const n = document.createElementNS(svgNS, tag);
    for(const k in (attrs||{})) if(attrs[k] != null) n.setAttribute(k, attrs[k]);
    (kids||[]).forEach(c=> c && n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }
  const esc = (s)=> String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const NF = (d)=> new Intl.NumberFormat("es-CO",{ maximumFractionDigits:d, minimumFractionDigits:0 });
  const fmt = (x, d)=> (x==null || !isFinite(x)) ? "—" : NF(d==null?0:d).format(x);
  const money = (x)=> (x==null || !isFinite(x)) ? "—" : "$ "+NF(Math.abs(x) < 100 ? 2 : 0).format(x);
  const scaleWord = (x)=>{ const a = Math.abs(x); return a >= 1e12 ? [x/1e12,"billones"] : a >= 1e9 ? [x/1e9,"mil millones"] : a >= 1e6 ? [x/1e6,"millones"] : null; };
  const moneyShort = (x)=>{ if(x==null || !isFinite(x)) return "—"; const s = scaleWord(x); return s ? "$ "+fmt(s[0], s[0] < 10 ? 1 : 0)+" "+s[1] : money(x); };
  const unitsShort = (x)=>{ if(x==null || !isFinite(x)) return "—"; const s = scaleWord(x); return s ? fmt(s[0], s[0] < 10 ? 1 : 0)+" "+s[1] : fmt(x); };
  const pct = (x, d)=> (x==null || !isFinite(x)) ? "—" : fmt(x*100, d==null?1:d)+" %";
  const signedPct = (x)=> (x==null || !isFinite(x)) ? "—" : (x > 0.0005 ? "+" : x < -0.0005 ? "−" : "")+fmt(Math.abs(x*100), Math.abs(x) < .1 ? 1 : 0)+" %";
  const norm = (s)=> (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const SMALL = new Set(["de","del","la","las","el","los","y","e","o","u","en","con","sin","por","para","a","al"]);
  function title(s){
    return String(s||"").toLowerCase().split(/(\s+|[(\/-])/).map((w,i)=>{
      if(!w || /^(\s+|[(\/-])$/.test(w)) return w;
      if(/^[ivx]+$/.test(w) && w.length > 1) return w.toUpperCase();
      if(/^(s\.?a\.?s?\.?|ltda\.?|llc|ag|gmbh|usp|ui)$/.test(w)) return w.toUpperCase();
      if(/^(mg|ml|mcg|g)$/.test(w)) return w;
      if(i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join("");
  }
  const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const ymShort = (ym)=> MES[ym%100-1]+" "+Math.floor(ym/100);
  function fill(node, kids){ node.innerHTML = ""; (kids||[]).forEach(k=> k && node.appendChild(k)); return node; }
  let uid = 0;
  function seg(options, current, onPick, label){
    const g = el("div",{class:"seg", role:"group", "aria-label":label});
    options.forEach(o=>{
      const b = el("button",{type:"button", "aria-pressed": String(o.value) === String(current) ? "true" : "false"},[o.label]);
      b.addEventListener("click", ()=>{ g.querySelectorAll("button").forEach(x=> x.setAttribute("aria-pressed","false")); b.setAttribute("aria-pressed","true"); onPick(o.value); });
      g.appendChild(b);
    });
    return g;
  }
  function field(label, control, help){ const id = control.id || ("f"+(++uid)); control.id = id; return el("label",{class:"field", for:id},[ el("span",{},[label]), control, help ? el("small",{},[help]) : null ]); }
  function fieldset(label, control){ return el("div",{class:"field"},[ el("span",{},[label]), control ]); }
  function select(options, value, onChange){
    const s = el("select");
    options.forEach(o=>{ const op = el("option",{value:String(o.value)},[o.label]); if(String(o.value) === String(value)) op.selected = true; s.appendChild(op); });
    s.addEventListener("change", ()=> onChange(s.value));
    return s;
  }
  function block(h, lead, kids, action){
    return el("div",{class:"block"},[ el("div",{class:"block-head"},[ el("div",{},[ el("h2",{},[h]), lead ? el("p",{class:"lead"},[lead]) : null ]), action || null ]) ].concat(kids||[]));
  }

  /* ---------------- Exportación a Excel ---------------- */
  const XS = window.MiniXLSX ? MiniXLSX.S : {};
  const XSTYLE = { text:"label", money:"money", int:"int", dec:"dec2", pct:"pct" };
  const sheetName = (s)=> String(s).replace(/[\[\]:*?\/\\]/g," ").slice(0,31);
  function exportExcel(file, sheets){
    if(!window.MiniXLSX){ alert("No se pudo cargar el generador de Excel."); return; }
    const gen = new Date().toLocaleString("es-CO");
    const built = sheets.map(sh=>{
      const nc = sh.cols.length, head = 5;
      const rows = [
        [{ v: sh.title, s: XS.title }],
        [{ v: sh.query || "", s: XS.subtitle }],
        [{ v: "Fuente: MinSalud, SISMED (SISPRO), con ATC y titular del catálogo CUM del INVIMA. Datos procesados el "+(META ? META.generated.slice(0,10) : "")+". Descargado el "+gen+".", s: XS.subtitle }],
        null,
        sh.cols.map(c=> ({ v: c.h, s: XS.header })),
      ].concat(sh.rows.map(r=> r.map((v,j)=>{
        const t = sh.cols[j].t || "text";
        if(t === "text" || typeof v === "string") return { v: v == null ? "" : String(v), s: XS.label };
        return { v: (v == null || !isFinite(v)) ? "" : v, s: XS[XSTYLE[t]] };
      })));
      return { name: sheetName(sh.name), cols: sh.cols.map(c=> c.w || (c.t === "text" || !c.t ? 30 : 17)), rows,
        freeze: head, autofilter: "A"+head+":"+MiniXLSX.colName(nc-1)+(head + Math.max(1, sh.rows.length)) };
    });
    built.push({ name:"Notas", cols:[120], rows: [
      [{ v:"Cómo leer este archivo", s: XS.title }],
      [{ v:"Precios reportados a SISMED (Circular 06 de 2018 y anexos de las Circulares 17 de 2023 y 21 de 2026); no son valores auditados.", s: XS.note }],
      [{ v:"Un solo eslabón por canal, para no contar dos veces: institucional = transacción final, operación de venta; comercial = venta primaria del laboratorio (el canal comercial no tiene transacción final).", s: XS.note }],
      [{ v:"Precios y unidades por unidad mínima de dispensación (lo reportado por presentación comercial se convierte con las unidades del CUM). El precio promedio es valor ÷ unidades.", s: XS.note }],
      [{ v:"Termómetro: bajo hasta el límite bajo del rango normal, normal hasta el límite alto, alto por encima (regla del autor).", s: XS.note }],
      [{ v:"Desde septiembre de 2026 rige la Circular 21 de 2026 (reporte por factura electrónica, con notas crédito y bonificaciones a precio cero): esa serie no empalma con la anterior.", s: XS.note }],
      [{ v:"Ajustes de método con que se generó este archivo: "+methodText(), s: XS.note }],
      [{ v:"Filas atípicas excluidas: más de $1 billón, más de $50 mil millones con más de 1 millón de unidades, o precio 20 veces mayor o menor que la mediana del producto.", s: XS.note }],
      [{ v:"Aplicación: "+location.href.split("#")[0], s: XS.note }],
      [{ v:CONTENT.meta.author+", "+CONTENT.meta.credentials+". Licencia "+CONTENT.meta.license.name+".", s: XS.note }],
    ]});
    const blob = new Blob([MiniXLSX.build(built)], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = el("a",{ href:URL.createObjectURL(blob), download: file.replace(/[^\w\-.]+/g,"_")+".xlsx" });
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  const ICON_XL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h11l5 5v13H4z"/><path d="M14 3v6h6M8 13l4 5M12 13l-4 5"/></svg>';
  const xlBtn = (label, fn)=> el("button",{class:"btn btn-xl", type:"button", onclick:fn, html: ICON_XL+esc(label)});

  /* ============================================================
     DATOS
     ============================================================ */
  let META, RES, NRES = 0, TEN = [], PRODIDX = [];
  let TX = [], OP = [], UN = [], ROL = [], ATC = [], YEARS = [], YEAR_Q = {}, LAB = 0;
  let TXF = -1, TXPC = -1, OPV = 0;
  const MOL = new Map();
  function prepare(meta, res, ten){
    META = meta; TX = meta.dims.tx; OP = meta.dims.op; UN = meta.dims.units; ROL = meta.dims.rol || []; ATC = meta.dims.atc;
    LAB = Math.max(0, ROL.findIndex(r=> /^elabora/i.test(r)));
    TXF = TX.indexOf("Transaccion final institucional"); TXPC = TX.indexOf("Transaccion primaria comercial"); OPV = Math.max(0, OP.indexOf("Operacion de venta"));
    RES = Float64Array.from(res.rows); NRES = RES.length/7; TEN = ten.rows;
    buildFamilies();
    const ys = new Set(); for(let r=0;r<NRES;r++) ys.add(RES[r*7]); YEARS = Array.from(ys).sort();
    (meta.quality||[]).forEach(q=>{ const y = +q.q.slice(0,4); YEAR_Q[y] = (YEAR_Q[y]||0) + 1; });
  }
  /* El INVIMA registra algunos productos con un código ATC ya reemplazado por la OMS (p. ej. A10BX09
     en vez de A10BK01 para la dapagliflozina, o J01DA* para las cefalosporinas). Los códigos con el mismo
     principio activo y el mismo subgrupo (cuatro primeros caracteres) se analizan juntos, bajo el código
     con más años de datos (y, si empatan, con más ventas). Se dejan aparte las insulinas (el subgrupo
     distingue la acción) y los nombres genéricos («combinaciones», «varios»). */
  let CANON = [], FAM = [], OWNYEARS = [];
  function buildFamilies(){
    CANON = ATC.map((a,i)=> i); FAM = ATC.map((a,i)=> [i]); OWNYEARS = ATC.map(a=> (a[2]||[]).slice());
    const groups = new Map(), val = new Float64Array(ATC.length);
    for(let r=0;r<NRES;r++){ const o = r*7; if(RES[o+3] === OPV) val[RES[o+1]] += RES[o+6]; }
    ATC.forEach((a,i)=>{ const n = norm(a[1]||"").trim();
      if(a[0] === "SIN_ATC" || !n || /^(combinaciones|varios)\b|^insulina/.test(n)) return;
      const k = n+"|"+a[0].slice(0,4); if(!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
    groups.forEach(list=>{
      if(list.length < 2) return;
      list.sort((x,y)=> OWNYEARS[y].length - OWNYEARS[x].length || val[y] - val[x]);
      const c = list[0], ys = new Set();
      list.forEach(j=>{ CANON[j] = c; OWNYEARS[j].forEach(y=> ys.add(y)); });
      FAM[c] = list; ATC[c][2] = Array.from(ys).sort();
    });
  }
  const famCodes = (i)=> FAM[i].map(j=> ATC[j][0]).join(" + ");
  const partial = (y)=> (YEAR_Q[y]||0) < 4;
  const lastFull = ()=> YEARS.filter(y=> !partial(y)).pop() || YEARS[YEARS.length-1];
  const yearLabel = (y)=> partial(y) ? y+" (parcial)" : String(y);
  const unI = (n)=> UN.indexOf(n);
  const groupOf = (i)=>{ const c = ATC[i][0]; return (c !== "SIN_ATC" && CONTENT.atcGroups[c[0]]) ? c[0] : "?"; };
  const groupName = (g)=> g === "?" ? "Sin código ATC" : CONTENT.atcGroups[g];
  const molName = (i)=> ATC[i][0] === "SIN_ATC" ? "Sin código ATC" : title(ATC[i][1] || ATC[i][0]);

  /* Qué entra al reporte (Circular 06 de 2018 y anexos de las Circulares 17 de 2023 y 21 de 2026).
     SISMED no es un sistema de trazabilidad: cada eslabón de la cadena reporta por su lado, y el vendedor
     reporta la venta mientras el comprador reporta la compra de la misma factura. Sumar transacciones u
     operaciones cuenta el mismo medicamento varias veces. Se toma un solo eslabón por canal, el último
     que SISMED observa:
       institucional: transacción final, operación de venta (la IPS o el operador logístico que dispensa
         y factura al pagador, con recursos públicos);
       comercial: venta primaria del laboratorio. El canal comercial no tiene transacción final en SISMED
         (las droguerías no reportan) y las ventas entre mayoristas se repetirían. */
  const Q = { year:0, tx:"I" };
  const TXG = [ { value:"I", label:"Institucional", sub:"Recursos públicos. Transacción final: lo que factura quien dispensa." },
                { value:"C", label:"Comercial", sub:"Recursos privados. Venta primaria del laboratorio: el canal no tiene transacción final." } ];
  const inReport = (tx, op, rol, g)=> op === OPV && ((g || Q.tx) === "I" ? tx === TXF : tx === TXPC && rol === LAB);
  const chanIdx = (g)=> (g || Q.tx) === "I" ? 1 : 0;   // canal en data/analisis: 0 comercial, 1 institucional
  const txText = (g)=> (g || Q.tx) === "I" ? "canal institucional (transacción final, venta)" : "canal comercial (venta primaria del laboratorio)";
  const queryText = (extra)=> "SISMED, "+txText()+(extra ? ", "+extra : "")+". Precios por unidad mínima de dispensación.";

  /* Régimen de reporte de cada año. La Circular 21 de 2026 cambia el anexo técnico (factura
     electrónica, unidad mínima de dispensación, notas crédito y débito) y MinSalud advierte que la serie
     nueva no empalma con la anterior. */
  const REGIMES = [
    { from:201910, to:202312, circ:"Circular 06 de 2018", d:"Anexo MED100. Todos los actores reportan cada trimestre, agregado por mes, CUM y tipo de transacción, con precio mínimo y máximo." },
    { from:202401, to:202608, circ:"Circular 17 de 2023", d:"Mismo anexo y mismos campos. El laboratorio pasa a reportar cada mes (archivo MED105); los demás actores siguen trimestrales." },
    { from:202609, to:999912, circ:"Circular 21 de 2026", d:"Una línea por cada factura electrónica (CUFE), sin consolidar por CUM, con la contraparte y las unidades en unidad mínima de dispensación. Entran las notas crédito y débito del mismo periodo y las bonificaciones con precio cero; las muestras médicas no. Obligatoria desde octubre de 2026 (septiembre para el laboratorio, julio a septiembre para los demás). No empalma con la serie anterior." },
  ];
  // normas que rigen los meses con datos de ese año
  const regimesOf = (y)=>{ const end = Math.min(y*100+12, lastMonth() || y*100+12); return REGIMES.filter(r=> r.from <= end && r.to >= y*100+1); };
  const lastMonth = ()=> (META.dims.months||[]).slice(-1)[0];

  /* resumen: [año, atc, canal, operación, actor, registros, valor] */
  function aggRes(f, key){
    const out = new Map(), g = f.g || Q.tx;
    for(let r=0;r<NRES;r++){ const o = r*7;
      if(f.y != null && RES[o] !== f.y) continue;
      if(!inReport(RES[o+2], RES[o+3], RES[o+4], g)) continue;
      if(f.mols && !f.mols.has(CANON[RES[o+1]])) continue;
      const k = key ? key(o) : 0; let a = out.get(k); if(!a){ a = { n:0, v:0 }; out.set(k, a); }
      a.n += RES[o+5]; a.v += RES[o+6];
    }
    return out;
  }
  function loadMol(i){
    if(MOL.has(i)) return MOL.get(i);
    // se cargan todos los códigos de la familia y se unen por año (los índices de CUM se desplazan)
    const files = []; FAM[i].forEach(j=> OWNYEARS[j].forEach(y=> files.push([y, ATC[j][0]])));
    const p = Promise.all(files.map(([y,code])=> fetch("data/y/"+y+"/"+code+".json").then(r=> r.ok ? r.json() : null).catch(()=> null)))
      .then(list=>{ const by = {};
        list.forEach(d=>{ if(!d) return; const a = by[d.year];
          if(!a){ by[d.year] = d; return; }
          const off = a.cums.length;
          by[d.year] = Object.assign({}, a, { rows: a.rows.concat(d.rows), cums: a.cums.concat(d.cums), prods: a.prods.concat(d.prods.map(x=> [x[0]+off].concat(x.slice(1)))) });
        });
        return by; });
    MOL.set(i, p); return p;
  }
  const ANA = new Map();
  function loadAna(y){
    if(!ANA.has(y)) ANA.set(y, fetch("data/analisis/"+y+".json").then(r=> r.ok ? r.json() : null).catch(()=> null));
    return ANA.get(y);
  }
  let REG = null;
  function loadReg(){
    if(!REG) REG = fetch("data/regulacion.json").then(r=> r.ok ? r.json() : null).then(d=>{
      if(!d) return null;
      const by = new Map(); d.rows.forEach(r=> by.set(r[0], r)); d.by = by; return d; }).catch(()=> null);
    return REG;
  }

  /* ============================================================
     NAVEGACIÓN: un documento (resumen, objetivo, materiales y métodos) y tres vistas de resultados
     ============================================================ */
  const VIEWS = [
    { id:"precios", label:"Precios" },
    { id:"mercado", label:"Mercado" },
    { id:"regulacion", label:"Regulación" },
  ];
  const OLD = { termometro:"precios", marcas:"precios", medicamento:"precios", estimador:"precios", analisis:"mercado", datos:"metodos" };
  const S = { view:"precios", mol:null };
  const RENDER = {};
  const dirty = new Set(VIEWS.map(v=> v.id).concat(["resumen","metodos"]));
  function renderTabs(){
    fill(document.getElementById("tabs"), VIEWS.map(v=> el("a",{class:"tab", href:"#"+v.id, "aria-current": S.view === v.id ? "page" : null, onclick:(e)=>{ e.preventDefault(); go(v.id); }},[v.label])));
  }
  function show(view, scroll){
    view = OLD[view] || view;
    if(view === "metodos"){ const d = document.getElementById("metodos"); d.open = true; d.scrollIntoView(); view = S.view; }
    if(!VIEWS.some(v=> v.id === view)) view = "precios";
    if(S.mol == null) S.mol = defaultMol();
    S.view = view;
    document.querySelectorAll(".view").forEach(s=> s.hidden = s.dataset.view !== view);
    renderTabs(); renderQueryBar();
    if(dirty.has(view)){ dirty.delete(view); RENDER[view](); }
    if(scroll) document.getElementById("resultados").scrollIntoView();
    setTimeout(redraw, 20);
  }
  function go(view){ if(location.hash !== "#"+view) location.hash = view; else show(view, true); }
  function invalidate(){
    VIEWS.forEach(v=> dirty.add(v.id)); dirty.add("resumen"); dirty.add("metodos");
    dirty.delete(S.view); RENDER[S.view](); renderQueryBar();
    dirty.delete("resumen"); RENDER.resumen();
    if(document.getElementById("metodos").open){ dirty.delete("metodos"); RENDER.metodos(); }
  }
  function setMol(i, view){
    i = CANON[i]; S.mol = i;
    TER.cum = null; TER.units = null; TER.pinned = null;
    if(MK.mols.indexOf(i) < 0 && MK.auto){ MK.mols = [i]; }
    VIEWS.forEach(v=> dirty.add(v.id));
    if(view && view !== S.view) go(view); else { dirty.delete(S.view); RENDER[S.view](); renderQueryBar(); }
  }
  function defaultMol(){ const i = ATC.findIndex(a=> a[0] === "N02BE01"); return CANON[i >= 0 ? i : 0]; }

  /* Barra de consulta: año y canal valen para todo el documento. */
  function renderQueryBar(){
    const bar = document.getElementById("querybar");
    const reg = regimesOf(Q.year).map(r=> r.circ).join(" y ");
    fill(bar, [
      field("Año", select(YEARS.map(y=>({value:y, label:yearLabel(y)})), Q.year, (v)=>{ Q.year = +v; invalidate(); })),
      fieldset("Canal", seg(TXG, Q.tx, (v)=>{ Q.tx = v; invalidate(); }, "Canal")),
      el("p",{class:"qb-note"},[ el("span",{class:"qb-txt"},[(Q.tx === "I" ? "Transacción final, venta" : "Venta primaria del laboratorio")+". "+reg+"."]),
        el("button",{class:"link-btn", type:"button", onclick:()=> openMetodos("m-ajustes")},[ "Ajustes de método"+(mChanged() ? " ("+mChanged()+")" : "") ]) ]),
    ]);
  }

  /* ============================================================
     BUSCADOR (principio activo o marca)
     ============================================================ */
  let SEARCH = null, ALIASES = {};
  /* Combinaciones («metformina y empagliflozina») van después del principio activo solo. */
  const isCombo = (name)=> /\by\b|\+|\/|combinaci/.test(norm(name));
  function buildSearch(){
    // relevancia: valor del último año completo en los dos canales del reporte
    const val = new Map(); ["I","C"].forEach(g=> aggRes({ y:lastFull(), g }, o=> CANON[RES[o+1]]).forEach((a,k)=>{ const b = val.get(k) || { v:0 }; b.v += a.v; val.set(k, b); }));
    const mols = ATC.map((a,i)=>{
      // sinónimos del INVIMA: «acetaminofén» → paracetamol, «dipirona» → metamizol
      const al = Array.from(new Set([].concat.apply([], FAM[i].map(j=> ALIASES[j] || [])).map(norm)));
      return { kind:"mol", i, name: molName(i), meta: famCodes(i)+(al.length ? ", también "+al.join(", ") : "")+(groupOf(i) !== "?" ? ", "+groupName(groupOf(i)).toLowerCase() : ""),
        names: [norm(a[1])].concat(al), key: norm(a[1]+" "+a[0]+" "+al.join(" ")), combo: isCombo(a[1]), rank: val.has(i) ? val.get(i).v : 0 };
    }).filter(m=> ATC[m.i][0] !== "SIN_ATC" && CANON[m.i] === m.i);
    const prods = PRODIDX.map(p=>{ const i = CANON[p[1]]; return { kind:"prod", i, name: title(p[0]), meta: molName(i)+(p[2] ? ", "+title(p[2]) : ""), key: norm(p[0]), rank: val.has(i) ? val.get(i).v : 0 }; });
    SEARCH = { mols, prods };
  }
  function findMatches(q){
    const nq = norm(q.trim()); if(nq.length < 2 || !SEARCH) return [];
    // el ATC escribe a veces en inglés («atorvastatin»): se acepta la palabra sin su última letra o dos
    const cuts = nq.length >= 7 ? [nq, nq.slice(0,-1), nq.slice(0,-2)] : [nq];
    const molScore = (m)=>{
      if(m.names.indexOf(nq) >= 0) return 5;
      if(m.names.some(n=> cuts.indexOf(n) > 0)) return 4;
      if(m.names.some(n=> n.startsWith(nq))) return 3;
      if((" "+m.key).indexOf(" "+nq) >= 0) return 2;
      return cuts.some(c=> m.key.indexOf(c) >= 0) ? 1 : 0;
    };
    const mm = SEARCH.mols.map(m=>({ m, s: molScore(m) })).filter(x=> x.s > 0)
      .sort((a,b)=> b.s-a.s || a.m.combo-b.m.combo || b.m.rank-a.m.rank).slice(0,6).map(x=> x.m);
    const score = (m)=> m.key.startsWith(nq) ? 2 : (m.key.indexOf(" "+nq) >= 0 ? 1 : 0);
    const seen = new Set();
    const pp = SEARCH.prods.filter(m=> m.key.indexOf(nq) >= 0).sort((a,b)=> score(b)-score(a) || b.rank-a.rank)
      .filter(m=>{ const k = m.name+"|"+m.i; if(seen.has(k)) return false; seen.add(k); return true; }).slice(0,8);
    // si el texto solo aparece en nombres de producto, se ofrece también su principio activo
    if(!mm.length && pp.length){
      const tally = new Map(); pp.forEach(p=> tally.set(p.i, (tally.get(p.i)||0)+1));
      Array.from(tally.entries()).sort((a,b)=> b[1]-a[1]).slice(0,2).forEach(([i])=>{
        const m = SEARCH.mols.find(x=> x.i === i); if(m) mm.push(m); });
    }
    return mm.concat(pp);
  }
  function searchBox(opts){
    opts = opts || {};
    const id = "s"+(++uid);
    const input = el("input",{type:"search", id, placeholder: opts.placeholder || "Busca una marca o un medicamento", autocomplete:"off",
      role:"combobox", "aria-expanded":"false", "aria-controls":id+"-l", "aria-autocomplete":"list", "aria-label":"Buscar medicamento o marca"});
    const list = el("ul",{class:"suggest", id:id+"-l", role:"listbox", hidden:true});
    let items = [], active = -1;
    function pick(m){
      list.hidden = true; input.value = ""; input.setAttribute("aria-expanded","false");
      if(opts.onPick){ opts.onPick(m); return; }
      if(m.kind === "prod"){ TER.pendingName = m.name; TER.mode = "equiv"; } else { TER.mode = "mol"; TER.form = null; }
      setMol(m.i);
    }
    function render(){
      items = findMatches(input.value); active = -1;
      if(!input.value.trim()){ list.hidden = true; input.setAttribute("aria-expanded","false"); return; }
      fill(list, items.length ? items.map((m,k)=> el("li",{role:"presentation"},[ el("button",{type:"button", role:"option", id:id+"-o"+k, "aria-selected":"false", onmousedown:(e)=> e.preventDefault(), onclick:()=> pick(m)},[
        el("span",{class:"sg-name"},[m.name]), el("span",{class:"sg-meta"},[m.meta]), el("span",{class:"sg-kind"},[m.kind === "mol" ? "Principio activo" : "Marca"]) ]) ]))
        : [ el("li",{class:"sg-empty"},["No encontramos «"+input.value.trim()+"». Prueba con el principio activo o el código ATC."]) ]);
      list.hidden = false; input.setAttribute("aria-expanded","true");
    }
    function move(d){
      if(!items.length) return;
      active = (active + d + items.length) % items.length;
      list.querySelectorAll("button").forEach((b,k)=> b.setAttribute("aria-selected", k === active ? "true" : "false"));
      const b = list.querySelectorAll("button")[active]; if(b){ b.scrollIntoView({block:"nearest"}); input.setAttribute("aria-activedescendant", b.id); }
    }
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e)=>{
      if(e.key === "ArrowDown"){ e.preventDefault(); move(1); } else if(e.key === "ArrowUp"){ e.preventDefault(); move(-1); }
      else if(e.key === "Enter"){ e.preventDefault(); if(items.length) pick(items[Math.max(0, active)]); }
      else if(e.key === "Escape"){ list.hidden = true; input.setAttribute("aria-expanded","false"); }
    });
    input.addEventListener("blur", ()=> setTimeout(()=>{ list.hidden = true; input.setAttribute("aria-expanded","false"); }, 150));
    const box = el("div",{class:"search-box", html:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'});
    box.appendChild(input);
    return el("div",{class:"search"+(opts.compact ? " compact" : "")},[ box, list ]);
  }

  /* ============================================================
     GRÁFICOS Y TABLAS
     ============================================================ */
  const tipEl = ()=> document.getElementById("chart-tip");
  function tip(html, x, y){
    const t = tipEl(); t.innerHTML = html; t.hidden = false;
    const w = t.offsetWidth, h = t.offsetHeight;
    let l = x + 14, tp = y - h - 12;
    if(l + w > innerWidth - 8) l = x - w - 14; if(l < 8) l = 8; if(tp < 8) tp = y + 18;
    t.style.left = l+"px"; t.style.top = tp+"px";
  }
  const untip = ()=>{ const t = tipEl(); if(t) t.hidden = true; };
  function bars(items, opts){
    opts = opts || {};
    const max = Math.max.apply(null, items.map(i=> i.value).concat([1e-9]));
    const wrap = el("div",{class:"bars", role:"list", "aria-label": opts.label || ""});
    items.forEach(it=>{
      const kids = [ el("span",{class:"bar-label"},[it.label, it.code ? el("span",{class:"atc"},[it.code]) : null]),
        el("span",{class:"bar-track"},[ el("span",{class:"bar-fill", style:"width:"+Math.max(.6, it.value/max*100)+"%"}) ]), el("span",{class:"bar-value"},[it.valueLabel]) ];
      const row = opts.onClick ? el("button",{class:"bar-row", type:"button", onclick:()=>{ untip(); opts.onClick(it); }, "aria-label": it.label+", "+it.valueLabel}, kids)
                               : el("div",{class:"bar-row", role:"listitem", tabindex:"0", "aria-label": it.label+", "+it.valueLabel}, kids);
      if(it.tip){ const h = "<strong>"+esc(it.label)+"</strong><br>"+it.tip;
        row.addEventListener("mousemove", (e)=> tip(h, e.clientX, e.clientY)); row.addEventListener("mouseleave", untip);
        row.addEventListener("focus", ()=>{ const r = row.getBoundingClientRect(); tip(h, r.left + 40, r.top); }); row.addEventListener("blur", untip); }
      wrap.appendChild(row);
    });
    if(!items.length) wrap.appendChild(el("p",{class:"muted"},["No hay datos para esta consulta."]));
    return wrap;
  }
  const CHARTS = [];
  const niceCeil = (v)=>{ const p = Math.pow(10, Math.floor(Math.log10(v))), f = v/p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  const tickShort = (v)=>{ const s = scaleWord(v); return s ? fmt(s[0], 1)+({ "billones":" B", "mil millones":" mM", "millones":" M" }[s[1]]) : fmt(v); };
  const tickMoney = (v)=> "$ "+tickShort(v);
  function lineChart(holder, cfg){
    const box = el("div",{class:"chart"});
    if(cfg.series.length > 1) box.appendChild(el("div",{class:"legend"}, cfg.series.map(s=> el("span",{class:"legend-item"},[ el("span",{class:"sw "+s.cls+(s.dash ? " dash" : "")}), s.name ]))));
    const plot = el("div",{class:"line-plot"}); box.appendChild(plot); holder.appendChild(box);
    const xl = cfg.xLabel || ymShort;
    function draw(){
      plot.innerHTML = "";
      const W = Math.max(300, plot.clientWidth || 720), H = cfg.height || 260, pad = { l:70, r:12, t:10, b:28 }, n = cfg.x.length;
      const vals = [].concat.apply([], cfg.series.map(s=> s.values)).filter(v=> v != null && isFinite(v));
      const top = niceCeil((vals.length ? Math.max.apply(null, vals) : 1) || 1);
      const X = (i)=> pad.l + (n <= 1 ? (W-pad.l-pad.r)/2 : i*(W-pad.l-pad.r)/(n-1)), Y = (v)=> pad.t + (H-pad.t-pad.b)*(1 - v/top);
      const s = svg("svg",{viewBox:"0 0 "+W+" "+H, width:W, height:H, role:"img", "aria-label":cfg.label});
      for(let k=0;k<=4;k++){ const v = top*k/4, y = Y(v);
        s.appendChild(svg("line",{x1:pad.l, x2:W-pad.r, y1:y, y2:y, class: k ? "grid-line" : "axis-line"}));
        s.appendChild(svg("text",{x:pad.l-8, y:y+4, "text-anchor":"end", class:"tick"},[ (cfg.tick || fmt)(v) ])); }
      const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((W-pad.l-pad.r)/76))));
      cfg.x.forEach((m,i)=>{ if(i % step && i !== n-1) return; s.appendChild(svg("text",{x:X(i), y:H-7, "text-anchor":"middle", class:"tick"},[xl(m)])); });
      cfg.series.forEach(se=>{ let d = "", pen = false;
        se.values.forEach((v,i)=>{ if(v == null || !isFinite(v)){ pen = false; return; } d += (pen ? "L" : "M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)+" "; pen = true; });
        s.appendChild(svg("path",{d, class:"series "+se.cls+(se.dash ? " dash" : "")}));
        if(n <= 12) se.values.forEach((v,i)=>{ if(v != null && isFinite(v)) s.appendChild(svg("circle",{cx:X(i), cy:Y(v), r:3.5, class:"dot "+se.cls})); }); });
      const cross = svg("line",{y1:pad.t, y2:H-pad.b, class:"crosshair", visibility:"hidden"}); s.appendChild(cross);
      const ov = svg("rect",{x:pad.l-8, y:pad.t, width:W-pad.l-pad.r+16, height:H-pad.t-pad.b, class:"overlay", tabindex:"0", role:"slider",
        "aria-label":"Usa las flechas para recorrer la serie", "aria-valuemin":"0", "aria-valuemax":String(n-1)}); s.appendChild(ov);
      let cur = n-1;
      function at(i, cx, cy){
        cur = Math.max(0, Math.min(n-1, i));
        cross.setAttribute("x1", X(cur)); cross.setAttribute("x2", X(cur)); cross.setAttribute("visibility","visible");
        ov.setAttribute("aria-valuenow", cur); ov.setAttribute("aria-valuetext", xl(cfg.x[cur]));
        const r = s.getBoundingClientRect();
        tip("<strong>"+esc(xl(cfg.x[cur]))+"</strong>"+cfg.series.map(se=> '<div class="row"><span class="sw '+se.cls+'"></span>'+esc(se.name)+": <b>"+(cfg.fmt||fmt)(se.values[cur])+"</b></div>").join(""),
          cx != null ? cx : r.left + X(cur)*r.width/W, cy != null ? cy : r.top + 30);
      }
      ov.addEventListener("mousemove", (e)=>{ const r = s.getBoundingClientRect(); at(Math.round(((e.clientX - r.left)*W/r.width - pad.l) / ((W-pad.l-pad.r)/Math.max(1,n-1))), e.clientX, e.clientY); });
      const off = ()=>{ cross.setAttribute("visibility","hidden"); untip(); };
      ov.addEventListener("mouseleave", off); ov.addEventListener("blur", off); ov.addEventListener("focus", ()=> at(cur));
      ov.addEventListener("keydown", (e)=>{ if(e.key === "ArrowLeft"){ e.preventDefault(); at(cur-1); } else if(e.key === "ArrowRight"){ e.preventDefault(); at(cur+1); } });
      plot.appendChild(s);
    }
    CHARTS.push({ node:box, draw }); requestAnimationFrame(draw);
  }
  function redraw(){ for(let i=CHARTS.length-1;i>=0;i--){ const c = CHARTS[i]; if(!document.body.contains(c.node)) CHARTS.splice(i,1); else if(c.node.offsetParent) c.draw(); } }
  const SCLS = ["s1","s2","s3","s4","s5"];

  /* Tabla ordenable. cols: [{h, k, t:'text'|'money'|'moneyS'|'int'|'pct'|'signed', render?, xh?}] */
  function sortTable(cols, rows, opts){
    opts = opts || {};
    const st = { k: opts.sortKey || cols[0].k, dir: opts.dir || -1, limit: opts.limit || 50 };
    const wrap = el("div");
    function draw(){
      const c = cols.find(x=> x.k === st.k) || cols[0];
      const sorted = rows.slice().sort((a,b)=>{ const va = a[st.k], vb = b[st.k];
        if(c.t === "text") return String(va||"~").localeCompare(String(vb||"~"),"es") * st.dir;
        return ((va == null ? -Infinity : va) - (vb == null ? -Infinity : vb)) * st.dir; });
      const th = (x)=> el("th",{class: x.t !== "text" ? "num" : null, "aria-sort": st.k === x.k ? (st.dir > 0 ? "ascending" : "descending") : null},[
        x.nosort ? x.h : el("button",{type:"button", onclick:()=>{ if(st.k === x.k) st.dir *= -1; else { st.k = x.k; st.dir = x.t === "text" ? 1 : -1; } draw(); }},[x.h, st.k === x.k ? (st.dir > 0 ? " ▲" : " ▼") : ""]) ]);
      const cell = (x, r)=>{
        if(x.render) return el("td",{class: x.t !== "text" ? "num" : null},[x.render(r)]);
        const v = r[x.k];
        const txt = x.t === "money" ? money(v) : x.t === "moneyS" ? moneyShort(v) : x.t === "int" ? fmt(v) : x.t === "pct" ? pct(v) : x.t === "signed" ? signedPct(v) : (v == null || v === "" ? "—" : String(v));
        return el("td",{class: (x.t !== "text" ? "num" : "")+(x.t === "signed" && v ? (v > 0.0005 ? " up" : v < -0.0005 ? " down" : "") : "")},[txt]);
      };
      fill(wrap, [ el("div",{class:"table-wrap"},[ el("table",{class:"t"},[
        el("thead",{},[ el("tr",{}, cols.map(th)) ]),
        el("tbody",{}, sorted.slice(0, st.limit).map(r=> el("tr",{class: opts.rowClass ? opts.rowClass(r) : null}, cols.map(x=> cell(x, r))))) ]) ]),
        sorted.length > st.limit ? el("div",{class:"more"},[ el("button",{class:"btn", type:"button", onclick:()=>{ st.limit += 100; draw(); }},["Mostrar más ("+fmt(sorted.length - st.limit)+" restantes)"]) ]) : null ]);
    }
    draw();
    return wrap;
  }
  const XT = { text:"text", money:"money", moneyS:"money", int:"int", pct:"pct", signed:"pct", dec:"dec" };
  const toSheet = (name, ttl, cols, rows)=> ({ name, title: ttl, query: queryText("año "+Q.year),
    cols: cols.filter(c=> !c.noexport).map(c=>({ h:c.xh || c.h, t: XT[c.t] || "text" })), rows: rows.map(r=> cols.filter(c=> !c.noexport).map(c=> r[c.k])) });


  /* ============================================================
     FORMAS, EQUIVALENTES Y BANDAS
     ============================================================ */
  function formFamily(f){
    const s = norm(f||""); if(!s) return "";
    if(/tableta|capsula|gragea|comprimido/.test(s)) return "Tableta o cápsula";
    if(/inyectable|para reconstituir|liofilizado|infusion|perfusion/.test(s)) return "Inyectable";
    if(/jarabe|suspension oral|solucion oral|elixir|gotas orales|emulsion oral|polvo para suspension/.test(s)) return "Líquido oral";
    if(/crema|unguento|gel|locion|pomada/.test(s)) return "Tópico";
    if(/oftalmic/.test(s)) return "Oftálmico"; if(/inhal|aerosol/.test(s)) return "Inhalado";
    return title(f);
  }
  const unitWord = (fam)=> fam === "Tableta o cápsula" ? "tableta" : fam === "Inyectable" ? "vial o ampolla" : "unidad";
  const quantile = (s, q)=>{ if(!s.length) return null; const p = (s.length-1)*q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi]-s[lo])*(p-lo); };
  const bandOf = (p, a, b)=> p <= a ? "low" : p > b ? "high" : "mid";
  const BANDTXT = { low:"Precio bajo", mid:"Precio normal", high:"Precio alto" };
  const BANDSHORT = { low:"Bajo", mid:"Normal", high:"Alto" };
  const prodName = (p)=> p.producto ? title(p.producto) : (p.desc ? title(p.desc) : p.cum);
  const labName = (p)=> p.titular ? title(p.titular) : "Titular no identificado";
  /* Concentración comparable: «DAPAGLIFLOZINA PROPANODIOL 12.3 MG EQUIVALENTE A 10 MG DE DAPAGLIFLOZINA»,
     «DAPAGLIFOZINA 10 mg» y «DAPAGLIFLOZINA 10 mg» son la misma dosis. De cada componente se toma la
     última cantidad (la del principio activo, después de «equivalente a»), con su unidad y, si la hay,
     por mililitro o por gramo. */
  const UNITF = { g:1000, mg:1, mcg:0.001, ug:0.001, "µg":0.001 };
  const strengthKey = (conc)=>{
    const c = norm(conc).replace(/,/g,".");
    if(!c) return "";
    const re = /(\d+(?:\.\d+)?)\s*(mcg|µg|ug|mg|g|ui|u\.?i\.?|meq|mmol|%)(?![a-z])(?:\s*\/\s*(\d+(?:\.\d+)?)?\s*(ml|g|l)\b)?/g;
    const parts = c.split(/\s\+\s/).map(part=>{
      let m, last = null; re.lastIndex = 0; while((m = re.exec(part))) last = m;
      if(!last) return part.trim();
      let n = parseFloat(last[1]), u = last[2].replace(/\./g,"");
      if(UNITF[u] != null){ n *= UNITF[u]; u = "mg"; }
      if(u === "ui" || u === "u") u = "ui";
      if(last[4]){ const d = parseFloat(last[3] || "1") * (last[4] === "l" ? 1000 : 1); n = n/d; u += "/"+(last[4] === "l" ? "ml" : last[4]); }
      return (Math.round(n*1000)/1000)+u;
    });
    return parts.sort().join("+");
  };
  const peersOf = (list, sel)=>{ const k = strengthKey(sel.conc); return list.filter(p=> p.fam === sel.fam && strengthKey(p.conc) === k); };
  /* ============================================================
     AJUSTES DE MÉTODO. Cambian cómo se arma y se resume cada grupo de comparación, no los datos.
     Se aplican a todas las vistas y a los Excel, y se guardan en este navegador.
     ============================================================ */
  const METHOD_KEY = "sismed_metodo";
  const MDEF = { ref:"med", band:"25", atyp:"x10", marg:"in", scale:"auto", grp:"equiv", disp:"iqr" };
  const M = Object.assign({}, MDEF);
  try { const saved = JSON.parse(localStorage.getItem(METHOD_KEY) || "{}"); Object.keys(MDEF).forEach(k=>{ if(saved[k] != null) M[k] = String(saved[k]); }); } catch(e){}
  const METHOD = [
    { k:"ref", label:"Referencia del grupo", opts:[
      { value:"med", label:"Mediana de las marcas", help:"Cada marca pesa lo mismo, venda mucho o poco." },
      { value:"pond", label:"Precio promedio del mercado", help:"Valor del grupo dividido entre sus unidades: pesan más las marcas que más venden." } ] },
    { k:"band", label:"Rango normal", opts:[
      { value:"25", label:"P25 a P75", help:"La mitad central de las marcas tiene precio normal." },
      { value:"10", label:"P10 a P90", help:"Solo el 10 % más barato y el 10 % más caro salen del rango normal." },
      { value:"33", label:"Terciles", help:"Tres grupos del mismo tamaño: bajo, normal y alto." } ] },
    { k:"atyp", label:"Precios atípicos", opts:[
      { value:"x10", label:"10 veces la mediana", help:"Sale la marca que cuesta más de 10 veces o menos de la décima parte de la mediana." },
      { value:"iqr", label:"Rango intercuartílico", help:"Regla de Tukey sobre el logaritmo del precio: sale lo que se aleja más de 1,5 rangos intercuartílicos." },
      { value:"mad", label:"Desviación absoluta mediana", help:"Puntaje z robusto sobre el logaritmo del precio: sale lo que supera 3,5." },
      { value:"none", label:"No excluir", help:"Entran todas las marcas, aunque el precio sea imposible." } ] },
    { k:"marg", label:"Marcas con ventas marginales", opts:[
      { value:"in", label:"Incluir", help:"Cuenta toda marca que reporta ventas en la consulta." },
      { value:"out", label:"Excluir", help:"Salen las marcas con menos del 0,5 % de las unidades de su grupo." } ] },
    { k:"scale", label:"Escala del termómetro", opts:[
      { value:"auto", label:"Automática", help:"Logarítmica cuando el precio más alto supera 15 veces al más bajo." },
      { value:"lin", label:"Lineal", help:"La distancia entre puntos es la diferencia en pesos." },
      { value:"log", label:"Logarítmica", help:"La distancia entre puntos es la diferencia en porcentaje." } ] },
    { k:"grp", label:"Grupo de comparación del análisis", opts:[
      { value:"equiv", label:"Equivalentes", help:"Mismo principio activo, concentración y forma farmacéutica." },
      { value:"mol", label:"Principio activo y forma", help:"Todas las concentraciones juntas: mezcla dosis distintas y agranda la dispersión." } ] },
    { k:"disp", label:"Medida de dispersión", opts:[
      { value:"iqr", label:"P75 ÷ P25", help:"Cuántas veces cuesta la marca del percentil 75 frente a la del 25. Resiste a los extremos." },
      { value:"maxmin", label:"Máximo ÷ mínimo", help:"Cuántas veces cuesta la marca más cara frente a la más barata. Depende de los extremos." },
      { value:"cv", label:"Coeficiente de variación", help:"Desviación estándar del precio dividida entre el promedio simple." } ] },
  ];
  const mDef = (k)=> METHOD.find(x=> x.k === k);
  const mOpt = (k)=>{ const d = mDef(k); return d.opts.find(o=> o.value === M[k]) || d.opts[0]; };
  const mChanged = ()=> Object.keys(MDEF).filter(k=> M[k] !== MDEF[k]).length;
  const methodText = ()=> METHOD.map(d=> d.label+": "+mOpt(d.k).label).join("; ")+".";
  function saveMethod(){ try { localStorage.setItem(METHOD_KEY, JSON.stringify(M)); } catch(e){} }
  function setMethod(k, v){ M[k] = v; saveMethod(); invalidate(); }
  function resetMethod(){ Object.assign(M, MDEF); try { localStorage.removeItem(METHOD_KEY); } catch(e){} invalidate(); }
  const BANDS = { "25":[.25,.75,"P25","P75"], "10":[.10,.90,"P10","P90"], "33":[1/3,2/3,"P33","P67"] };
  const BQ = ()=> BANDS[M.band] || BANDS["25"];
  const refCap = ()=> M.ref === "pond" ? "Precio promedio del mercado" : "Mediana del grupo";
  const refThe = ()=> M.ref === "pond" ? "el precio promedio del mercado" : "la mediana";
  const refA = ()=> M.ref === "pond" ? "al precio promedio del mercado" : "a la mediana";
  const refDe = ()=> M.ref === "pond" ? "del precio promedio del mercado" : "de la mediana";
  const refShort = ()=> M.ref === "pond" ? "Promedio" : "Mediana";
  /* Referencia del grupo: mediana de las marcas o precio promedio ponderado por unidades. */
  function center(items){
    if(!items.length) return null;
    if(M.ref === "pond"){ const u = items.reduce((t,p)=> t+p.u, 0); return u ? items.reduce((t,p)=> t+p.v, 0)/u : null; }
    return quantile(items.map(p=> p.price).sort((a,c)=> a-c), .5);
  }
  /* Panel de ajustes: el mismo en la barra de consulta y en el análisis de resultados. */
  function methodPanel(){
    const n = mChanged();
    return el("div",{class:"method"},[
      el("div",{class:"m-grid"}, METHOD.map(d=> el("div",{class:"m-row"+(M[d.k] !== MDEF[d.k] ? " changed" : "")},[
        el("span",{class:"m-label"},[d.label]), seg(d.opts, M[d.k], (v)=> setMethod(d.k, v), d.label), el("small",{class:"m-help"},[mOpt(d.k).help]) ]))),
      el("div",{class:"m-foot"},[ el("p",{class:"small muted"},["Cambian cómo se arma y se resume cada grupo de comparación, no los datos. Se aplican a todas las vistas y a los archivos de Excel, y se guardan en este navegador."]),
        n ? el("button",{class:"btn", type:"button", onclick: resetMethod},["Volver a los ajustes iniciales"]) : null ]) ]);
  }
  /* Grupo de comparación: primero salen las marcas marginales (si se pide) y luego las de precio
     atípico, con la regla elegida. Los atípicos casi siempre son errores de conversión de caja a unidades. */
  const ATYP = 10, MARG = 0.005;
  function splitAtypical(items){
    let ok = items, small = [];
    if(M.marg === "out" && items.length > 2){
      const tu = items.reduce((t,p)=> t+p.u, 0); ok = [];
      items.forEach(p=> (p.u < tu*MARG ? small : ok).push(p));
    }
    if(M.atyp === "none" || ok.length < 5) return { ok, out:[], small };
    let test;
    if(M.atyp === "x10"){ const med = quantile(ok.map(p=> p.price).sort((a,c)=> a-c), .5); test = (p)=> p.price > med*ATYP || p.price < med/ATYP; }
    else {
      const lp = ok.map(p=> Math.log(p.price)).sort((a,c)=> a-c);
      if(M.atyp === "iqr"){ const q1 = quantile(lp,.25), q3 = quantile(lp,.75), k = 1.5*(q3-q1);
        test = k > 0 ? (p)=>{ const x = Math.log(p.price); return x < q1-k || x > q3+k; } : ()=> false; }
      else { const md = quantile(lp,.5), mad = quantile(lp.map(x=> Math.abs(x-md)).sort((a,c)=> a-c), .5);
        test = mad > 0 ? (p)=> Math.abs(0.6745*(Math.log(p.price)-md)/mad) > 3.5 : ()=> false; }
    }
    const ok2 = [], out = []; ok.forEach(p=> (test(p) ? out : ok2).push(p));
    return { ok:ok2, out, small };
  }
  const atypRule = ()=> ({ x10:"más de 10 veces por encima o por debajo de la mediana", iqr:"a más de 1,5 rangos intercuartílicos, en logaritmo del precio, según la regla de Tukey",
    mad:"con puntaje z robusto mayor de 3,5, en logaritmo del precio", none:"" })[M.atyp];


  /* ============================================================
     RESUMEN DEL MERCADO: marcas y grupos de comparación con los ajustes de método.
     ============================================================ */
  /* Nombre genérico (heurística): el nombre del producto contiene el del principio activo, como lo
     nombran la OMS o el INVIMA («Losartán MK», «Acetaminofén 500 mg»). */
  const GENW = new Set(["acido","hidroxido","carbonato","sulfato","cloruro","oxido","vitamina","factor","sodio","calcio","magnesio","potasio","complejo","toxina","insulina","combinaciones"]);
  const INN = new Map();
  function innWords(i){
    if(INN.has(i)) return INN.get(i);
    const names = [ATC[i][1] || ""].concat([].concat.apply([], FAM[i].map(j=> ALIASES[j] || [])));
    const w = new Set(); names.forEach(n=> norm(n).split(/[^a-z]+/).forEach(t=>{ if(t.length >= 5 && !GENW.has(t)) w.add(t.slice(0,6)); }));
    const out = Array.from(w); INN.set(i, out); return out;
  }
  const isGenericName = (prod, i)=>{ const p = norm(prod); const w = innWords(i); return w.length > 0 && w.some(t=> p.indexOf(t) >= 0); };

  // marcas: producto + titular + concentración comparable + forma, con unidades y valor por canal (0 comercial, 1 institucional)
  function anaBrands(d){
    const famOf = new Map(), skOf = new Map(), m = new Map();
    const fam = (k)=>{ if(!famOf.has(k)) famOf.set(k, formFamily(d.s[k])); return famOf.get(k); };
    const sk = (k)=>{ if(!skOf.has(k)) skOf.set(k, strengthKey(d.s[k])); return skOf.get(k); };
    d.rows.forEach(r=>{
      if(ATC[r[0]][0] === "SIN_ATC") return;
      const mol = CANON[r[0]], f = fam(r[4]), s = sk(r[3]);
      const key = mol+"|"+norm(d.s[r[1]])+"|"+norm(d.s[r[2]])+"|"+s+"|"+f;
      let b = m.get(key);
      if(!b){ b = { key, mol, prod:d.s[r[1]], lab:d.s[r[2]], conc:d.s[r[3]], fam:f, sk:s, ch:[{u:0,v:0},{u:0,v:0}] }; m.set(key, b); }
      b.ch[r[5]].u += r[6]; b.ch[r[5]].v += r[7];
    });
    return Array.from(m.values());
  }
  function dispOf(ps){
    if(ps.length < 3) return null;
    if(M.disp === "maxmin") return ps[ps.length-1]/ps[0];
    if(M.disp === "cv"){ const mu = ps.reduce((t,x)=> t+x, 0)/ps.length; return Math.sqrt(ps.reduce((t,x)=> t+(x-mu)*(x-mu), 0)/(ps.length-1))/mu; }
    return quantile(ps,.75)/quantile(ps,.25);
  }
  function anaGroups(brands, g){
    const m = new Map(), equiv = M.grp === "equiv";
    brands.forEach(b=>{ const c = b.ch[g]; if(!(c.u > 0 && c.v > 0)) return;
      const k = b.mol+"|"+b.fam+"|"+(equiv ? b.sk : "");
      let G = m.get(k); if(!G){ G = { k, mol:b.mol, fam:b.fam, conc: equiv ? b.conc : "", sk: equiv ? b.sk : "", all:[] }; m.set(k, G); }
      G.all.push({ b, prod:b.prod, lab:b.lab, u:c.u, v:c.v, price:c.v/c.u }); });
    return Array.from(m.values()).map(statGroup);
  }
  function statGroup(G){
    const sp = splitAtypical(G.all), ok = sp.ok, bq = BQ();
    const ps = ok.map(p=> p.price).sort((a,c)=> a-c);
    Object.assign(G, { ok, out:sp.out, small:sp.small, n:ok.length,
      v: ok.reduce((t,p)=> t+p.v, 0), u: ok.reduce((t,p)=> t+p.u, 0), vAll: G.all.reduce((t,p)=> t+p.v, 0),
      labs: new Set(ok.map(p=> norm(p.lab) || p.prod)).size, ref: center(ok),
      lo: quantile(ps, bq[0]), hi: quantile(ps, bq[1]), min: ps[0], max: ps[ps.length-1], disp: dispOf(ps), mm: ps.length >= 2 ? ps[ps.length-1]/ps[0] : null });
    G.cmp = G.n >= 3;
    // gasto sobre la referencia: lo que se habría pagado de menos si cada unidad vendida por encima
    // de la referencia hubiera costado la referencia (un ejercicio, no una meta de precio)
    G.excess = G.cmp ? ok.reduce((t,p)=> t + (p.price > G.ref ? (p.price - G.ref)*p.u : 0), 0) : 0;
    G.vHigh = G.cmp ? ok.reduce((t,p)=> t + (p.price > G.hi ? p.v : 0), 0) : 0;
    G.vLow = G.cmp ? ok.reduce((t,p)=> t + (p.price <= G.lo ? p.v : 0), 0) : 0;
    return G;
  }
  // concentración para mostrar: la del CUM si es corta; si no, la normalizada («250 mg + 65 mg + 220 mg»)
  const concLabel = (conc, sk)=> !conc ? "" : conc.length <= 42 ? title(conc) : (sk || strengthKey(conc)).split("+").map(x=> x.replace(/^(\d+(?:\.\d+)?)(.*)$/, (m,n,u)=> fmt(+n, 3)+" "+u)).join(" + ");
  const medianOf = (xs)=> quantile(xs.filter(x=> x != null && isFinite(x)).sort((a,c)=> a-c), .5);
  function anaSummary(groups){
    const cmp = groups.filter(G=> G.cmp), sum = (l,k)=> l.reduce((t,G)=> t+G[k], 0);
    const vC = sum(cmp,"v");
    return { groups:groups.length, cmp:cmp.length, v: sum(groups,"v"), vAll: sum(groups,"vAll"), vC, shareC: vC/(sum(groups,"v")||1),
      disp: medianOf(cmp.map(G=> G.disp)), mm: medianOf(cmp.map(G=> G.mm)),
      mm5: cmp.filter(G=> G.mm >= 5), high: sum(cmp,"vHigh")/(vC||1), low: sum(cmp,"vLow")/(vC||1), excess: sum(cmp,"excess"),
      out: groups.reduce((t,G)=> t+G.out.length, 0), outV: groups.reduce((t,G)=> t+G.out.reduce((a,p)=> a+p.v, 0), 0),
      small: groups.reduce((t,G)=> t+G.small.length, 0), brands: groups.reduce((t,G)=> t+G.all.length, 0) };
  }
  // la misma marca en los dos canales (si pasa los filtros del método en cada uno)
  function anaChannels(GR){
    const okSet = GR.map(gs=>{ const st = new Set(); gs.forEach(G=> G.ok.forEach(p=> st.add(p.b))); return st; });
    return Array.from(okSet[0]).filter(b=> okSet[1].has(b)).map(b=>{ const pc = b.ch[0].v/b.ch[0].u, pi = b.ch[1].v/b.ch[1].u;
      return { mol:b.mol, med:molName(b.mol), prod:title(b.prod), lab: b.lab ? title(b.lab) : "Titular no identificado", conc: concLabel(b.conc, b.sk), fam:b.fam,
        pc, pi, r: pi/pc, d: pi/pc-1, v: b.ch[0].v + b.ch[1].v, vc:b.ch[0].v, vi:b.ch[1].v, uc:b.ch[0].u, ui:b.ch[1].u }; });
  }
  // nombre genérico frente a marca, dentro de cada grupo (solo productos con titular del catálogo CUM)
  function anaGeneric(groups){
    const rows = []; let gu = 0, gv = 0, tu = 0, tv = 0;
    groups.forEach(G=>{
      const ok = G.ok.filter(p=> p.lab), gen = ok.filter(p=> isGenericName(p.prod, G.mol)), brd = ok.filter(p=> !isGenericName(p.prod, G.mol));
      gen.forEach(p=>{ gu += p.u; gv += p.v; }); ok.forEach(p=>{ tu += p.u; tv += p.v; });
      if(!gen.length || !brd.length) return;
      const pg = center(gen), pb = center(brd);
      rows.push({ mol:G.mol, med:molName(G.mol), conc: G.conc ? concLabel(G.conc, G.sk) : "", fam:G.fam, nGen:gen.length, nBrd:brd.length, pg, pb, prem: pb/pg-1, v:G.v,
        sGenU: gen.reduce((t,p)=> t+p.u, 0)/(G.u||1), sGenV: gen.reduce((t,p)=> t+p.v, 0)/(G.v||1) });
    });
    return { rows, shareU: gu/(tu||1), shareV: gv/(tv||1), prem: medianOf(rows.map(r=> r.prem)), dearer: rows.filter(r=> r.prem > 0.05).length };
  }
  const COMP = [[1,1,"Un laboratorio"],[2,2,"Dos laboratorios"],[3,4,"Tres o cuatro"],[5,9,"Cinco a nueve"],[10,Infinity,"Diez o más"]];
  function anaCompetition(groups){
    const tot = groups.reduce((t,G)=> t+G.v, 0) || 1;
    return COMP.map(([a,b,label], ord)=>{ const gs = groups.filter(G=> G.labs >= a && G.labs <= b);
      const hhi = gs.map(G=>{ const m = new Map(); G.ok.forEach(p=>{ const k = norm(p.lab) || p.prod; m.set(k, (m.get(k)||0) + p.v); }); let h = 0; m.forEach(x=>{ const sh = x/(G.v||1)*100; h += sh*sh; }); return h; });
      const v = gs.reduce((t,G)=> t+G.v, 0);
      return { ord, label, groups: gs.length, v, sv: v/tot, disp: medianOf(gs.filter(G=> G.cmp).map(G=> G.disp)), hhi: medianOf(hhi) }; });
  }
  // cuántas marcas y cuánto valor saca cada regla de atípicos (con las demás opciones vigentes)
  function anaOutliers(groups){
    const save = M.atyp, out = METHOD.find(d=> d.k === "atyp").opts.map((o, ord)=>{
      M.atyp = o.value; let n = 0, v = 0, gaff = 0, tot = 0, tv = 0;
      groups.forEach(G=>{ const sp = splitAtypical(G.all); n += sp.out.length; v += sp.out.reduce((t,p)=> t+p.v, 0); if(sp.out.length) gaff++; tot += G.all.length - sp.small.length; tv += G.all.reduce((t,p)=> t+p.v, 0); });
      return { ord, rule:o.label, value:o.value, n, sn: n/(tot||1), v, sv: v/(tv||1), gaff, on: o.value === save };
    });
    M.atyp = save; return out;
  }
  // índice de precio por laboratorio: lo que cobró frente a lo que habría costado lo mismo a la referencia de cada grupo
  function anaLabs(groups){
    const m = new Map();
    groups.filter(G=> G.cmp).forEach(G=> G.ok.forEach(p=>{ const k = p.lab ? title(p.lab) : "Titular no identificado";
      let a = m.get(k); if(!a){ a = { lab:k, v:0, vr:0, brands:0, groups:new Set(), high:0 }; m.set(k, a); }
      a.v += p.v; a.vr += p.u*G.ref; a.brands++; a.groups.add(G.k); if(p.price > G.hi) a.high += p.v; }));
    return Array.from(m.values()).map(a=>({ lab:a.lab, v:a.v, idx:a.v/a.vr, d:a.v/a.vr-1, brands:a.brands, groups:a.groups.size, sHigh:a.high/(a.v||1) })).sort((a,c)=> c.v-a.v);
  }
  const DISPINFO = {
    iqr: { name:"P75 ÷ P25", unit:(x)=> fmt(x, x < 10 ? 2 : 0)+" veces", sentence:(x)=> "En la mitad de los grupos comparables, la marca del percentil 75 cuesta al menos "+fmt(x,2)+" veces lo que la del percentil 25.",
      bins:[[1,1.25,"Menos de 1,25 veces"],[1.25,1.5,"1,25 a 1,5 veces"],[1.5,2,"1,5 a 2 veces"],[2,3,"2 a 3 veces"],[3,5,"3 a 5 veces"],[5,Infinity,"5 veces o más"]] },
    maxmin: { name:"Máximo ÷ mínimo", unit:(x)=> fmt(x, x < 10 ? 1 : 0)+" veces", sentence:(x)=> "En la mitad de los grupos comparables, la marca más cara cuesta al menos "+fmt(x,1)+" veces lo que la más barata.",
      bins:[[1,1.5,"Menos de 1,5 veces"],[1.5,2,"1,5 a 2 veces"],[2,3,"2 a 3 veces"],[3,5,"3 a 5 veces"],[5,10,"5 a 10 veces"],[10,Infinity,"10 veces o más"]] },
    cv: { name:"Coeficiente de variación", unit:(x)=> fmt(x*100,0)+" %", sentence:(x)=> "En la mitad de los grupos comparables, la desviación estándar del precio es al menos el "+fmt(x*100,0)+" % del promedio.",
      bins:[[0,.25,"Menos del 25 %"],[.25,.5,"25 % a 50 %"],[.5,1,"50 % a 100 %"],[1,2,"100 % a 200 %"],[2,Infinity,"200 % o más"]] },
  };
  const RATIOBINS = [[0,.5,"Menos de la mitad"],[.5,.8,"Entre 50 % y 80 %"],[.8,.95,"Entre 80 % y 95 %"],[.95,1.05,"Casi igual (± 5 %)"],[1.05,1.25,"Entre 5 % y 25 % más"],[1.25,2,"Entre 25 % y 100 % más"],[2,Infinity,"El doble o más"]];
  function histo(items, bins, val, weight){
    const tw = items.reduce((t,x)=> t+weight(x), 0) || 1;
    return bins.map(([a,b,label])=>{ const xs = items.filter(x=>{ const y = val(x); return y != null && y >= a && y < b; });
      return { label, n: xs.length, w: xs.reduce((t,x)=> t+weight(x), 0)/tw }; });
  }

  /* ============================================================
     PRECIOS POR UNIDAD
     ============================================================ */
  const TER = { cum:null, pendingName:null, groupBy:"marca", yearly:[], mode:"mol", form:null, pinned:null };
  /* Precio por unidad mínima de dispensación de cada CUM, con el filtro del reporte.
     prods: [cum, transacción, operación, unidad, actor, registros, unidades, valor, pmin, pmax].
     Lo reportado por presentación comercial se divide entre las unidades del CUM; lo reportado por
     embalaje primario o por unidad de concentración no se puede convertir y queda fuera. */
  function unitPrices(yd, g){
    const uD = unI("Unidad de dispensacion"), uP = unI("Presentacion comercial"), acc = new Map();
    yd.prods.forEach(p=>{
      if(!inReport(p[1], p[2], p[4], g)) return;
      const c = yd.cums[p[0]]; let eq = null, f = 1;
      if(p[3] === uD) eq = p[6]; else if(p[3] === uP && c[4]){ eq = p[6]*c[4]; f = 1/c[4]; }
      if(!eq || !p[7]) return;
      let a = acc.get(p[0]); if(!a){ a = { u:0, v:0, n:0, mn:null, mx:null }; acc.set(p[0], a); }
      a.u += eq; a.v += p[7]; a.n += p[5];
      if(p[8] != null){ const x = p[8]*f; if(a.mn == null || x < a.mn) a.mn = x; }
      if(p[9] != null){ const x = p[9]*f; if(a.mx == null || x > a.mx) a.mx = x; }
    });
    return Array.from(acc.entries()).map(([ci,a])=>{ const c = yd.cums[ci];
      return { cum:c[0], desc:c[1], titular:c[2], producto:c[3], qty:c[4], conc:c[5]||"", fam:formFamily(c[6]), price:a.v/a.u, v:a.v, u:a.u, n:a.n, mn:a.mn, mx:a.mx }; })
      .filter(r=> isFinite(r.price) && r.price > 0);
  }
  /* Una marca = producto + laboratorio + concentración + forma: se suman todas sus presentaciones (CUM).
     p.cum pasa a ser la clave de la marca; p.cums guarda los códigos CUM reales. */
  function brandize(list){
    const m = new Map();
    list.forEach(p=>{
      const key = norm(p.producto || p.desc)+"|"+norm(p.titular)+"|"+norm(p.conc)+"|"+p.fam;
      let a = m.get(key);
      if(!a){ a = { key, v:0, u:0, n:0, cums:[], rep:p, mn:null, mx:null }; m.set(key, a); }
      a.v += p.v; a.u += p.u; a.n += p.n; a.cums.push(p.cum); if(p.v > a.rep.v) a.rep = p;
      if(p.mn != null && (a.mn == null || p.mn < a.mn)) a.mn = p.mn;
      if(p.mx != null && (a.mx == null || p.mx > a.mx)) a.mx = p.mx;
    });
    return Array.from(m.values()).map(a=> Object.assign({}, a.rep, { cum:a.key, cums:a.cums, cumList:a.cums.join(", "), v:a.v, u:a.u, n:a.n, price:a.v/a.u, mn:a.mn, mx:a.mx }));
  }

  /* Termómetro: SVG más un recuadro (callout) con la ficha del producto que se toca. Tocar un punto
     abre la ficha y no cambia nada más; la ficha trae un botón para tomar ese producto como referencia. */
  function thermometerSVG(sel, peers, p25, p75, ctx){
    const prices = peers.map(p=> p.price).concat([sel.price]);
    let lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
    const useLog = M.scale === "log" ? true : M.scale === "lin" ? false : hi/lo > 15;
    if(!useLog){ const pv = (hi-lo)*0.1 || hi*0.1; lo = Math.max(0, lo-pv); hi = hi+pv; } else { lo = lo/1.25; hi = hi*1.25; }
    const W = 330, H = 480, tx = 132, tw = 38, top = 24, bot = 384, bulbR = 32, cy = 418;
    const Y = (p)=>{ const f = useLog ? (Math.log(p)-Math.log(lo))/(Math.log(hi)-Math.log(lo)) : (p-lo)/(hi-lo); return bot - Math.max(0, Math.min(1, f))*(bot-top); };
    const b = bandOf(sel.price, p25, p75);
    const wrap = el("div",{class:"thermo-wrap"});
    const call = el("div",{class:"th-callout", role:"dialog", "aria-live":"polite", hidden:true});
    const s = svg("svg",{class:"thermo-svg", viewBox:"0 0 "+W+" "+H, role:"img",
      "aria-label":"Termómetro: "+prodName(sel)+" cuesta "+money(sel.price)+" por unidad, "+BANDTXT[b].toLowerCase()+". Rango normal entre "+money(p25)+" y "+money(p75)+"."});
    const clip = "thc"+(++uid);
    s.appendChild(svg("defs",{},[ svg("clipPath",{id:clip},[ svg("rect",{x:tx, y:top, width:tw, height:bot-top+20, rx:tw/2}), svg("circle",{cx:tx+tw/2, cy, r:bulbR-4}) ]) ]));
    s.appendChild(svg("rect",{x:tx, y:top, width:tw, height:bot-top+18, rx:tw/2, class:"th-glass"}));
    s.appendChild(svg("circle",{cx:tx+tw/2, cy, r:bulbR, class:"th-glass"}));
    const g = svg("g",{"clip-path":"url(#"+clip+")"});
    const yP25 = Y(p25), yP75 = Y(p75), yMe = Y(sel.price);
    g.appendChild(svg("rect",{x:tx, y:top, width:tw, height:Math.max(0, yP75-top), class:"th-zone high"}));
    g.appendChild(svg("rect",{x:tx, y:yP75, width:tw, height:Math.max(0, yP25-yP75), class:"th-zone mid"}));
    g.appendChild(svg("rect",{x:tx, y:yP25, width:tw, height:Math.max(0, bot+20-yP25), class:"th-zone low"}));
    g.appendChild(svg("g",{class:"th-merc-col"},[ svg("rect",{x:tx+8, y:yMe, width:tw-16, height:cy-yMe, rx:(tw-16)/2, class:"th-merc "+b}) ]));
    g.appendChild(svg("circle",{cx:tx+tw/2, cy, r:bulbR-9, class:"th-merc "+b}));
    s.appendChild(g);
    s.appendChild(svg("rect",{x:tx, y:top, width:tw, height:bot-top+18, rx:tw/2, class:"th-outline"}));
    s.appendChild(svg("circle",{cx:tx+tw/2, cy, r:bulbR, class:"th-outline"}));
    s.appendChild(svg("rect",{x:tx+tw/2+6, y:top+14, width:4, height:bot-top-40, rx:2, class:"th-shine"}));
    // escala derecha: máximo, límite alto, referencia, límite bajo y mínimo (se omiten las que chocan)
    const sortedP = peers.slice().sort((a,c)=> a.price - c.price);
    const minP = sortedP[0], maxP = sortedP[sortedP.length-1];
    const bq = BQ(), marks = [[maxP.price, "Máx."], [p75, bq[3]], [center(peers), refShort()], [p25, bq[2]], [minP.price, "Mín."]];
    const used = [yMe];
    marks.forEach(([p,lab])=>{ if(p == null) return; const y = Y(p);
      if(used.some(u=> Math.abs(u - y) < 26)) return; used.push(y);
      const ext = lab === "Máx." || lab === "Mín.";
      s.appendChild(svg("line",{x1:tx+tw+4, x2:tx+tw+14, y1:y, y2:y, class:"th-tick"+(ext ? " ext" : "")}));
      s.appendChild(svg("text",{x:tx+tw+18, y:y-2, class:"th-tick-label"+(ext ? " ext" : "")},[money(p)]));
      s.appendChild(svg("text",{x:tx+tw+18, y:y+12, class:"th-tick-label", opacity:".7"},[lab])); });
    // un punto por marca, en carriles a la izquierda del tubo: si dos marcas tienen el mismo precio
    // (o casi), la segunda va al lado de la primera y no encima. Con muchas marcas, puntos más pequeños.
    const others = sortedP.filter(p=> p.cum !== sel.cum);
    function swarm(rr){
      const step = 2*rr+2, last = [];
      const pos = others.map(p=>{ const y = Y(p.price); let c = 0;
        while(last[c] != null && Math.abs(y - last[c]) < 2*rr+1) c++;
        last[c] = y; return { p, y, x: tx-14 - c*step }; });
      return { pos, lanes: last.length, step, r: rr };
    }
    let sw = swarm(4.6); if(sw.lanes > 9) sw = swarm(3.6); if(sw.lanes > 12) sw = swarm(3);
    const r = sw.r;
    // si los carriles no caben, el lienzo se amplía hacia la izquierda
    const vbX = Math.min(0, Math.floor(tx-14 - (sw.lanes-1)*sw.step - r - 50));
    if(vbX < 0) s.setAttribute("viewBox", vbX+" 0 "+(W-vbX)+" "+H);
    [["high",(top+yP75)/2,"Alto"],["mid",(yP75+yP25)/2,"Normal"],["low",(yP25+bot)/2,"Bajo"]].forEach(([c,y,t])=>{
      if((c === "high" ? yP75-top : c === "mid" ? yP25-yP75 : bot-yP25) < 18) return;
      s.appendChild(svg("text",{x:vbX+2, y:y+4, class:"th-zone-label "+c},[t])); });

    let pinned = null;
    function card(p){
      const ext = p === maxP ? "Precio más alto del grupo" : p === minP ? "Precio más bajo del grupo" : null;
      const isSel = p.cum === sel.cum;
      return [
        el("div",{class:"th-c-head"},[ el("strong",{},[prodName(p)]),
          el("button",{class:"th-c-x", type:"button", "aria-label":"Cerrar la ficha", onclick:(e)=>{ e.stopPropagation(); unpin(); }},["×"]) ]),
        el("span",{class:"th-c-lab"},[labName(p)+(p.conc ? ", "+concLabel(p.conc) : "")]),
        el("span",{class:"th-c-price"},[money(p.price)+" por "+unitWord(p.fam)]),
        el("span",{class:"th-c-row"},["Mínimo y máximo reportados: "+money(p.mn)+" a "+money(p.mx)]),
        el("span",{class:"th-c-row"},[unitsShort(p.u)+" unidades, "+moneyShort(p.v)+" ("+pct(p.v/(ctx.totV||1))+" del valor del grupo)"]),
        isSel ? el("span",{class:"th-c-diff"},["Producto de referencia"]) : el("span",{class:"th-c-diff "+(p.price < sel.price ? "down" : "up")},[signedPct(p.price/sel.price-1)+" frente al producto de referencia"]),
        ext ? el("span",{class:"th-c-ext"},[ext]) : null,
        el("span",{class:"th-c-row muted-inv"},[(p.cums||[]).length > 1 ? p.cums.length+" presentaciones (CUM)" : "CUM "+(p.cums||[p.cum])[0]]),
        !isSel && ctx.onPick ? el("button",{class:"th-c-btn", type:"button", onclick:(e)=>{ e.stopPropagation(); ctx.onPick(p); }},["Usar como producto de referencia"]) : null,
      ];
    }
    function place(node){
      const wr = wrap.getBoundingClientRect(), nr = node.getBoundingClientRect();
      const x = nr.left - wr.left + nr.width/2, y = nr.top - wr.top + nr.height/2;
      const cw = call.offsetWidth, ch = call.offsetHeight;
      let left = x - cw - 14, side = "left";
      if(left < 0){ left = x + 14; side = "right"; }
      if(left + cw > wr.width + 40){ left = Math.max(0, (wr.width - cw)/2); side = "below"; }
      const topPx = side === "below" ? Math.min(wr.height - ch, y + 16) : Math.max(0, Math.min(wr.height - ch, y - ch/2));
      call.style.left = left+"px"; call.style.top = topPx+"px";
      call.classList.toggle("right", side === "right"); call.classList.toggle("below", side === "below");
    }
    function open(p, node, pin){
      fill(call, card(p)); call.hidden = false; call.classList.toggle("pinned", !!pin);
      place(node); node.classList.add("on");
      if(pin){ pinned = { p, node }; TER.pinned = p.cum; }
    }
    function close(node){ if(pinned) return; call.hidden = true; if(node) node.classList.remove("on"); }
    function unpin(){ if(pinned){ pinned.node.classList.remove("on"); pinned = null; TER.pinned = null; } call.hidden = true; }
    function toggle(p, node){
      if(pinned && pinned.node === node){ unpin(); return; }
      if(pinned) pinned.node.classList.remove("on");
      pinned = null; open(p, node, true);
    }
    const hitR = Math.min(10, Math.max(r+4, sw.step/2+1));
    const nodes = new Map();
    sw.pos.forEach(({ p, x:cx, y:cyP })=>{
      const dot = svg("circle",{cx, cy:cyP, r, class:"th-peer"+(p.price < sel.price ? " cheaper" : "")+(p === maxP || p === minP ? " ext" : "")});
      const hit = svg("circle",{cx, cy:cyP, r:hitR, class:"th-hit", tabindex:"0", role:"button",
        "aria-label":prodName(p)+", "+labName(p)+": "+money(p.price)+" por unidad. Enter para ver la ficha."});
      hit.addEventListener("mouseenter", ()=>{ if(!pinned) open(p, dot); }); hit.addEventListener("mouseleave", ()=> close(dot));
      hit.addEventListener("click", (e)=>{ e.stopPropagation(); toggle(p, dot); });
      hit.addEventListener("keydown", (e)=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); toggle(p, dot); } else if(e.key === "Escape") unpin(); });
      s.appendChild(dot); s.appendChild(hit); nodes.set(p.cum, { p, dot });
    });
    s.appendChild(svg("line",{x1:tx-4, x2:tx+tw+16, y1:yMe, y2:yMe, class:"th-me-line"}));
    s.appendChild(svg("path",{d:"M"+(tx+tw+16)+" "+yMe+" l7 -6 v12 z", class:"th-me-arrow"}));
    s.appendChild(svg("text",{x:tx+tw+27, y:yMe+5, class:"th-me-label"},[money(sel.price)]));
    s.appendChild(svg("text",{x:tx+tw+27, y:yMe+20, class:"th-tick-label"},["referencia"]));
    const meHit = svg("rect",{x:tx, y:yMe-10, width:tw+100, height:32, class:"th-hit", tabindex:"0", role:"button", "aria-label":"Producto de referencia: "+prodName(sel)+", "+money(sel.price)+" por unidad"});
    meHit.addEventListener("mouseenter", ()=>{ if(!pinned) open(sel, meHit); }); meHit.addEventListener("mouseleave", ()=> close(meHit));
    meHit.addEventListener("click", (e)=>{ e.stopPropagation(); toggle(sel, meHit); });
    meHit.addEventListener("keydown", (e)=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); toggle(sel, meHit); } else if(e.key === "Escape") unpin(); });
    s.appendChild(meHit);
    if(useLog) s.appendChild(svg("text",{x:W-4, y:H-6, "text-anchor":"end", class:"th-tick-label", opacity:".7"},["Escala logarítmica"]));
    call.addEventListener("click", (e)=> e.stopPropagation());
    wrap.appendChild(s); wrap.appendChild(call);
    // tocar fuera de la ficha la cierra
    wrap.unpin = unpin;
    // si se vuelve a dibujar con una ficha abierta (cambio de tamaño), se reabre
    if(TER.pinned && nodes.has(TER.pinned)) requestAnimationFrame(()=>{ const n = nodes.get(TER.pinned); if(n && document.body.contains(n.dot)) open(n.p, n.dot, true); });
    return wrap;
  }
  document.addEventListener("click", (e)=>{ document.querySelectorAll(".thermo-wrap").forEach(w=>{ if(!w.contains(e.target) && w.unpin) w.unpin(); }); });
  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") document.querySelectorAll(".thermo-wrap").forEach(w=> w.unpin && w.unpin()); });

  RENDER.precios = function(){
    const v = document.getElementById("view-precios"), i = S.mol;
    const head = el("div",{class:"view-head"},[
      el("div",{},[ el("h2",{},["Precios por unidad"]),
        el("p",{},["Escribe un principio activo para ver todas sus marcas en el termómetro, o una marca para compararla con sus equivalentes. Toca un punto para ver la ficha del producto."]) ]),
      searchBox({ placeholder:"Principio activo o marca: dapagliflozina, losartán, Dolex…" }),
    ]);
    fill(v, [ head, el("p",{class:"loading-note"},["Cargando "+molName(i)+"…"]) ]);
    loadMol(i).then(by=>{
      if(S.mol !== i) return;
      const molTitle = el("div",{class:"mol-title"},[ el("h3",{},[molName(i)]), el("span",{class:"atc"},[famCodes(i)]) ]);
      const yd = by[Q.year];
      const list = yd ? brandize(unitPrices(yd)).sort((a,b)=> b.v - a.v) : [];
      if(!list.length){ fill(v, [ head, molTitle, el("p",{class:"callout"},["No hay ventas de "+molName(i)+" por unidad en el "+txText()+" en "+Q.year+". Cambia el canal o el año en la barra de consulta."]) ]); return; }
      if(TER.pendingName){ const nq = norm(TER.pendingName); const m = list.find(p=> norm(prodName(p)) === nq) || list.find(p=> norm(prodName(p)).indexOf(nq) >= 0); if(m){ TER.cum = m.cum; TER.form = m.fam; } TER.pendingName = null; }
      // formas farmacéuticas del principio activo, de mayor a menor valor
      const formV = new Map(); list.forEach(p=> formV.set(p.fam, (formV.get(p.fam)||0) + p.v));
      const forms = Array.from(formV.entries()).sort((a,c)=> c[1]-a[1]).map(e=> e[0]);
      if(TER.form == null || forms.indexOf(TER.form) < 0){ const cur = list.find(p=> p.cum === TER.cum); TER.form = cur ? cur.fam : forms[0]; }
      const molMode = TER.mode === "mol";
      const pool = molMode ? list.filter(p=> p.fam === TER.form) : list;
      const sel = pool.find(p=> p.cum === TER.cum || (p.cums||[]).indexOf(TER.cum) >= 0) || pool[0]; TER.cum = sel.cum;
      const groupOfList = (l)=> splitAtypical(molMode ? l.filter(p=> p.fam === TER.form) : peersOf(l, sel));
      const split = groupOfList(list), atyp = split.out, small = split.small;
      const peers = split.ok.indexOf(sel) >= 0 || !split.ok.length ? (split.ok.length ? split.ok : [sel]) : split.ok.concat([sel]);
      const selAtyp = atyp.indexOf(sel) >= 0;
      const groupTxt = molMode ? "marcas de "+molName(i).toLowerCase()+" ("+(TER.form || "todas las formas").toLowerCase()+")" : "marcas equivalentes";
      const sortedPeers = peers.slice().sort((a,c)=> a.price - c.price), minP = sortedPeers[0], maxP = sortedPeers[sortedPeers.length-1];
      const sorted = peers.map(p=> p.price).sort((a,b)=> a-b);
      const bq = BQ(), p25 = quantile(sorted, bq[0]), p75 = quantile(sorted, bq[1]), med = center(peers);
      const b = bandOf(sel.price, p25, p75), few = peers.length < 4, uw = unitWord(sel.fam);
      const cheaper = peers.filter(p=> p.price < sel.price).length;
      const totV = peers.reduce((s,p)=> s+p.v, 0), totU = peers.reduce((s,p)=> s+p.u, 0);
      const pickRef = (p)=>{ TER.cum = p.cum; TER.pinned = null; RENDER.precios(); };
      const prodSel = select(pool.map(p=>({ value:p.cum, label: prodName(p)+(p.conc ? ", "+concLabel(p.conc) : "")+" ("+labName(p)+")" })), sel.cum, (x)=>{ TER.cum = x; TER.pinned = null; RENDER.precios(); });
      const verdictText = few ? "Solo "+(peers.length === 1 ? "esta marca reporta" : peers.length+" "+groupTxt+" reportan")+" en esta consulta: la comparación es poco informativa."
        : (cheaper ? cheaper+" de "+peers.length+" "+groupTxt+" tienen precio más bajo (puntos verdes). Toca un punto para ver la marca, su precio y sus ventas." : "Es de las marcas más baratas entre las "+peers.length+" "+groupTxt+".");
      const modeSeg = seg([{value:"mol", label:"Todas las marcas"}, {value:"equiv", label:"Solo equivalentes"}], TER.mode, (x)=>{ TER.mode = x; TER.pinned = null; RENDER.precios(); }, "Comparar con");
      const formSel = select(forms.map(f=>({ value:f, label:f || "Sin forma registrada" })), TER.form, (x)=>{ TER.form = x; TER.cum = null; TER.pinned = null; RENDER.precios(); });
      const brandsHolder = el("div"), yearsHolder = el("div"), salesHolder = el("div");

      // filas de la tabla de precios por marca o laboratorio
      function brandRows(){
        if(TER.groupBy === "lab"){
          const m = new Map();
          peers.forEach(p=>{ const k = labName(p); let a = m.get(k); if(!a){ a = { lab:k, marcas:new Set(), v:0, u:0, mn:null, mx:null, mine:false }; m.set(k, a); }
            a.marcas.add(prodName(p)); a.v += p.v; a.u += p.u; if(p.cum === sel.cum) a.mine = true;
            if(p.mn != null && (a.mn == null || p.mn < a.mn)) a.mn = p.mn; if(p.mx != null && (a.mx == null || p.mx > a.mx)) a.mx = p.mx; });
          return Array.from(m.values()).map(a=>{ const price = a.v/a.u; return { lab:a.lab, marca: Array.from(a.marcas).slice(0,3).join(", ")+(a.marcas.size > 3 ? " y "+(a.marcas.size-3)+" más" : ""),
            price, mn:a.mn, mx:a.mx, dSel: price/sel.price-1, dMed: price/med-1, u:a.u, v:a.v, sv:a.v/totV, su:a.u/totU, band: BANDSHORT[bandOf(price,p25,p75)], mine:a.mine }; });
        }
        return peers.map(p=>({ lab: labName(p), marca: prodName(p), cum:p.cumList, desc:p.desc, conc: p.conc ? concLabel(p.conc) : "", price:p.price, mn:p.mn, mx:p.mx, dSel:p.price/sel.price-1, dMed:p.price/med-1, u:p.u, v:p.v, sv:p.v/totV, su:p.u/totU, band: BANDSHORT[bandOf(p.price,p25,p75)], mine: p.cum === sel.cum }));
      }
      const bandCell = (r)=> el("span",{class:"band "+({Bajo:"low",Normal:"mid",Alto:"high"}[r.band] || "")},[r.band]);
      function brandCols(){
        const lab = TER.groupBy === "lab";
        return [
          { h: lab ? "Laboratorio" : "Marca", k: lab ? "lab" : "marca", t:"text", render:(r)=> el("span",{},[ r.mine ? el("b",{},["Referencia: "]) : null, lab ? r.lab : r.marca ]) },
          { h: lab ? "Marcas" : "Laboratorio", k: lab ? "marca" : "lab", t:"text" },
          lab ? null : { h:"Concentración", k:"conc", t:"text" },
          { h:"Promedio", xh:"Precio promedio por unidad (COP)", k:"price", t:"money" },
          { h:"Mínimo", xh:"Precio mínimo reportado por unidad (COP)", k:"mn", t:"money" },
          { h:"Máximo", xh:"Precio máximo reportado por unidad (COP)", k:"mx", t:"money" },
          { h:"Frente a la referencia", xh:"Diferencia frente al producto de referencia", k:"dSel", t:"signed" },
          { h:"Frente "+refA(), xh:"Diferencia frente "+refA(), k:"dMed", t:"signed" },
          { h:"Unidades", k:"u", t:"int" },
          { h:"Valor", xh:"Valor (COP)", k:"v", t:"moneyS" },
          { h:"Part. valor", xh:"Participación en valor", k:"sv", t:"pct" },
          { h:"Part. unidades", xh:"Participación en unidades", k:"su", t:"pct" },
          { h:"Banda", k:"band", t:"text", render: bandCell },
        ].filter(Boolean).concat(lab ? [] : [{ h:"Códigos CUM", k:"cum", t:"text", noshow:true }]);
      }
      function drawBrands(){ fill(brandsHolder, [ sortTable(brandCols().filter(c=> !c.noshow), brandRows(), { sortKey:"price", dir:1, rowClass:(r)=> r.mine ? "sel" : null }) ]); }

      // precio por año, con la misma consulta
      const yrs = (ATC[i][2]||[]).filter(y=> by[y]);
      TER.yearly = yrs.map(y=>{ const l = brandize(unitPrices(by[y])); const me = l.find(p=> p.cum === sel.cum); const grp = groupOfList(l).ok, pp = grp.map(p=> p.price).sort((a,c)=> a-c);
        return { y, _g: grp, _me: me, me: me ? me.price : null, meU: me ? me.u : null, meV: me ? me.v : null, grpV: grp.length ? grp.reduce((t,p)=> t+p.v, 0) : null, grpU: grp.length ? grp.reduce((t,p)=> t+p.u, 0) : null, med: center(grp), p25: quantile(pp,bq[0]), p75: quantile(pp,bq[1]), n: pp.length }; });
      // todas las marcas del grupo por año (las mismas del termómetro: todas las marcas del principio activo en esa forma, o solo las equivalentes)
      const brandLabel = (p)=> prodName(p)+(molMode && p.conc ? " "+concLabel(p.conc) : "")+" ("+labName(p)+")";
      const brandMap = new Map();
      TER.yearly.forEach(r=>{ const items = r._me && r._g.indexOf(r._me) < 0 ? r._g.concat([r._me]) : r._g;
        items.forEach(p=>{ let a = brandMap.get(p.cum); if(!a){ a = { key:p.cum, name:brandLabel(p), prod:prodName(p), lab:labName(p), conc:p.conc ? concLabel(p.conc) : "", v:0, byY:new Map() }; brandMap.set(p.cum, a); }
          a.v += p.v; a.byY.set(r.y, { price:p.price, v:p.v, u:p.u }); }); });
      const brandsY = Array.from(brandMap.values()).sort((a,c)=> (c.key === sel.cum) - (a.key === sel.cum) || c.v - a.v);
      function exportTer(){
        const labs = new Map(); peers.forEach(p=>{ const k = labName(p); let a = labs.get(k); if(!a){ a = { lab:k, n:0, v:0, u:0 }; labs.set(k,a); } a.n++; a.v += p.v; a.u += p.u; });
        const save = TER.groupBy; TER.groupBy = "marca"; const bc = brandCols(), br = brandRows(); TER.groupBy = save;
        const extra = (p, band)=>({ marca: prodName(p), lab: labName(p), conc: p.conc ? concLabel(p.conc) : "", cum:p.cumList, desc:p.desc, price:p.price, mn:p.mn, mx:p.mx, dSel:p.price/sel.price-1, dMed:p.price/med-1, u:p.u, v:p.v, sv:null, su:null, band });
        exportExcel("precios_"+ATC[i][0]+"_"+Q.year+"_"+(Q.tx === "I" ? "institucional" : "comercial"), [
          toSheet("Precios por marca", "Precio por unidad: "+prodName(sel)+" frente a "+peers.length+" "+groupTxt+" ("+Q.year+")",
            bc.concat([{ h:"Descripción", k:"desc", t:"text" }]), br.sort((a,c)=> a.price-c.price).concat(atyp.map(p=> extra(p, "Atípico (excluido del termómetro)"))).concat(small.map(p=> extra(p, "Ventas marginales (excluida)")))),
          toSheet("Laboratorios", "Precio promedio por laboratorio ("+molName(i)+", "+Q.year+")",
            [ {h:"Laboratorio (titular)", k:"lab", t:"text"}, {h:"Marcas", k:"n", t:"int"}, {h:"Precio promedio por unidad (COP)", k:"price", t:"money"}, {h:"Diferencia frente al producto de referencia", k:"dSel", t:"signed"}, {h:"Unidades", k:"u", t:"int"}, {h:"Valor (COP)", k:"v", t:"money"}, {h:"Participación en valor", k:"sv", t:"pct"}, {h:"Participación en unidades", k:"su", t:"pct"} ],
            Array.from(labs.values()).map(a=> Object.assign(a, { price:a.v/a.u, dSel:(a.v/a.u)/sel.price-1, sv:a.v/totV, su:a.u/totU })).sort((a,c)=> c.v-a.v)),
          toSheet("Por año", "Precio por año: "+prodName(sel)+" frente a "+groupTxt,
            [ {h:"Año", k:"y", t:"int"}, {h:"Precio del producto de referencia (COP)", k:"me", t:"money"}, {h:"Unidades del producto de referencia", k:"meU", t:"int"}, {h:refCap()+" (COP)", k:"med", t:"money"}, {h:"Límite bajo, "+bq[2]+" (COP)", k:"p25", t:"money"}, {h:"Límite alto, "+bq[3]+" (COP)", k:"p75", t:"money"}, {h:"Marcas del grupo", k:"n", t:"int"}, {h:"Ventas del producto de referencia (COP)", k:"meV", t:"money"}, {h:"Ventas totales del grupo (COP)", k:"grpV", t:"money"}, {h:"Unidades del grupo", k:"grpU", t:"int"} ], TER.yearly),
          toSheet("Por año y marca", "Precio y ventas por año de cada marca: "+groupTxt,
            [ {h:"Año", k:"y", t:"int"}, {h:"Marca", k:"prod", t:"text"}, {h:"Laboratorio (titular)", k:"lab", t:"text"}, {h:"Concentración", k:"conc", t:"text"}, {h:"Precio promedio por unidad (COP)", k:"price", t:"money"}, {h:"Unidades", k:"u", t:"int"}, {h:"Ventas (COP)", k:"v", t:"money"} ],
            [].concat.apply([], TER.yearly.map(r=> brandsY.filter(b=> b.byY.has(r.y)).map(b=>{ const x = b.byY.get(r.y); return { y:r.y, prod:b.prod, lab:b.lab, conc:b.conc, price:x.price, u:x.u, v:x.v }; })))),
        ]);
      }

      fill(v, [ head,
        el("div",{class:"panel ter-panel"},[
          molTitle,
          el("div",{class:"ter-controls"},[ fieldset("Comparar con", modeSeg), molMode && forms.length > 1 ? field("Forma farmacéutica", formSel) : null,
            field("Producto de referencia", prodSel) ]),
          el("div",{class:"thermo-layout"},[
            thermometerSVG(sel, peers, p25, p75, { totV, totU, onPick: pickRef }),
            el("div",{class:"ter-read"},[
              el("p",{class:"ter-prod"},[prodName(sel)+(sel.conc ? ", "+concLabel(sel.conc) : "")]),
              el("p",{class:"muted small", style:"margin:0 0 8px"},[labName(sel).replace(/\.?$/,". ")+queryText("año "+Q.year)]),
              el("p",{class:"verdict "+(few ? "few" : b)},[few ? "Pocos datos para comparar" : BANDTXT[b]]),
              el("p",{class:"verdict-text"},[verdictText]),
              selAtyp ? el("p",{class:"callout small"},["El precio de esta marca es atípico ("+atypRule()+"): probablemente es un error de reporte o de conversión de caja a unidades."]) : null,
              atyp.length ? el("p",{class:"small muted"},[atyp.length+" "+(atyp.length === 1 ? "marca quedó" : "marcas quedaron")+" fuera del termómetro por precio atípico ("+atypRule()+"). Aparecen en el Excel."]) : null,
              small.length ? el("p",{class:"small muted"},[small.length+" "+(small.length === 1 ? "marca quedó" : "marcas quedaron")+" fuera por ventas marginales (menos del 0,5 % de las unidades del grupo). Aparecen en el Excel."]) : null,
              mChanged() ? el("p",{class:"small m-note"},["Ajustes de método cambiados: "+methodText()]) : null,
              el("div",{class:"thermo-facts"},[
                el("div",{},[ el("div",{class:"price-big"},[money(sel.price)]), el("div",{class:"fl"},["promedio por "+uw]) ]),
                el("div",{},[ el("div",{class:"fv"},[money(sel.mn)+" a "+money(sel.mx)]), el("div",{class:"fl"},["Mínimo y máximo reportados"]) ]),
                el("div",{},[ el("div",{class:"fv"},[signedPct(sel.price/med-1)]), el("div",{class:"fl"},["frente "+refA()+" ("+money(med)+")"]) ]),
                el("div",{},[ el("div",{class:"fv"},[money(p25)+" a "+money(p75)]), el("div",{class:"fl"},["Rango normal ("+bq[2]+" a "+bq[3]+") de "+peers.length+" marcas"]) ]),
                el("div",{class:"ext-fact"},[ el("div",{class:"fv"},[money(maxP.price)]), el("div",{class:"fl"},["Más alto: "+prodName(maxP)+" ("+labName(maxP)+")"]) ]),
                el("div",{class:"ext-fact"},[ el("div",{class:"fv"},[money(minP.price)]), el("div",{class:"fl"},["Más bajo: "+prodName(minP)+" ("+labName(minP)+")"]) ]),
                el("div",{},[ el("div",{class:"fv"},[pct(sel.v/totV)+" y "+pct(sel.u/totU)]), el("div",{class:"fl"},["Participación en valor y en unidades"]) ]),
              ]),
              el("div",{class:"actions"},[ xlBtn("Descargar los precios en Excel", exportTer) ]),
            ]),
          ]) ]),
        block("Precio promedio, mínimo y máximo por producto", (molMode ? "Todas las marcas de "+molName(i).toLowerCase()+" en "+(TER.form||"").toLowerCase()+" (cualquier concentración)" : "Marcas equivalentes al producto de referencia (mismo principio activo, concentración y forma)")+". Precio por unidad mínima de dispensación. El promedio es valor ÷ unidades; el mínimo y el máximo son los extremos que reportó algún actor en el año y suelen incluir errores de digitación o de unidad.",
          [ el("div",{class:"toolbar"},[ fieldset("Agrupar por", seg([{value:"marca",label:"Marca"},{value:"lab",label:"Laboratorio"}], TER.groupBy, (x)=>{ TER.groupBy = x; drawBrands(); }, "Agrupar por")) ]), brandsHolder ],
          xlBtn("Excel", exportTer)),
        block("Precio por año", "Precio por unidad de cada marca ("+groupTxt+"), con el producto de referencia resaltado, con el mismo canal y en todos los años disponibles. «Resumen del grupo» lo compara con "+refA()+" y el rango normal.", [ yearsHolder ], xlBtn("Excel", exportTer)),
        block("Ventas totales por año", "Valor vendido cada año por cada marca ("+groupTxt+"), con el producto de referencia resaltado y el resto de las marcas agrupadas en «Otras». «Resumen del grupo» muestra el total del grupo frente al producto de referencia. Es lo reportado por el laboratorio, sin las marcas apartadas por precio atípico o ventas marginales.", [ salesHolder ], xlBtn("Excel", exportTer)),
      ]);
      drawBrands();
      // Precio y ventas por año: una línea por marca (la de referencia resaltada) o el resumen del grupo
      const TOPN = 7, partialNote = "* Año parcial. Desde septiembre de 2026 rige la Circular 21 de 2026 (reporte por factura, con notas crédito y bonificaciones a precio cero): no compares esos meses con los años anteriores.";
      const yview = ()=> TER.yview || "marcas";
      const viewSeg = ()=> seg([{value:"marcas", label: molMode ? "Todas las marcas" : "Marcas equivalentes"}, {value:"grupo", label:"Resumen del grupo"}], yview(), (x)=>{ TER.yview = x; drawYearly(); }, "Ver por");
      function drawYearly(){
        const xs = TER.yearly.map(r=> r.y), xl = (y)=> partial(y) ? y+"*" : String(y), byBrand = yview() === "marcas";
        const top = brandsY.slice(0, TOPN), rest = brandsY.slice(TOPN);
        let ci = 1;
        const brandSeries = (pick, others)=>{ ci = 1;
          const out = top.map(b=>({ name:b.name, cls: b.key === sel.cum ? "s1 ref" : "s"+(++ci), values: xs.map(y=>{ const x = b.byY.get(y); return x ? x[pick] : null; }) }));
          if(others && rest.length) out.push({ name:"Otras "+rest.length+" marcas", cls:"s8", values: xs.map(y=>{ let t = 0, n = 0; rest.forEach(b=>{ const x = b.byY.get(y); if(x){ t += x[pick]; n++; } }); return n ? t : null; }) });
          return out; };
        const note = brandsY.length > top.length ? " Se dibujan las "+top.length+" marcas de mayor venta de "+brandsY.length+(byBrand ? "; todas están en el Excel." : ".") : "";
        yearsHolder.innerHTML = ""; salesHolder.innerHTML = "";
        yearsHolder.appendChild(el("div",{class:"toolbar"},[ fieldset("Ver por", viewSeg()) ]));
        salesHolder.appendChild(el("div",{class:"toolbar"},[ fieldset("Ver por", viewSeg()) ]));
        lineChart(yearsHolder, { label:"Precio por año", x:xs, xLabel:xl, fmt: money, tick:(x)=> "$ "+fmt(x),
          series: byBrand ? brandSeries("price", false)
            : [ { name:prodName(sel), cls:"s1", values: TER.yearly.map(r=> r.me) }, { name:refCap(), cls:"s3", values: TER.yearly.map(r=> r.med) },
                { name:"Límite bajo ("+bq[2]+")", cls:"s4", dash:true, values: TER.yearly.map(r=> r.p25) }, { name:"Límite alto ("+bq[3]+")", cls:"s5", dash:true, values: TER.yearly.map(r=> r.p75) } ] });
        yearsHolder.appendChild(el("p",{class:"small muted"},[partialNote+(byBrand ? note : "")]));
        lineChart(salesHolder, { label:"Ventas totales por año", x:xs, xLabel:xl, fmt: moneyShort, tick: tickMoney,
          series: byBrand ? brandSeries("v", true)
            : [ { name:"Total del grupo ("+groupTxt+")", cls:"s3", values: TER.yearly.map(r=> r.grpV) }, { name:prodName(sel), cls:"s1", values: TER.yearly.map(r=> r.meV) } ] });
        salesHolder.appendChild(el("p",{class:"small muted"},["* Año parcial: las ventas de un año con menos de cuatro trimestres publicados no son comparables con las de un año completo. Desde septiembre de 2026 rige la Circular 21 de 2026 (reporte por factura, con notas crédito y bonificaciones a precio cero): no compares esos meses con los años anteriores."+(byBrand ? note : "")]));
      }
      drawYearly();
    });
  };

  /* ============================================================
     MERCADO: distribución de valores y unidades en un mercado relevante que arma quien consulta
     (uno o varios principios activos). data/analisis/<año>.json trae las ventas del reporte por marca y
     canal: [molécula, producto, titular, concentración, forma, canal, unidades, valor].
     ============================================================ */
  const MK = { mols:[], auto:true, open:new Set(), group:"prod" };
  const CAT = ["c1","c2","c3","c4","c5","c6","c7","c8"];
  function addMols(list){ list.forEach(i=>{ i = CANON[i]; if(MK.mols.indexOf(i) < 0) MK.mols.push(i); }); MK.auto = false; dirty.add("regulacion"); RENDER.mercado(); }
  function removeMol(i){ MK.mols = MK.mols.filter(x=> x !== i); MK.open.delete(i); MK.auto = false; dirty.add("regulacion"); RENDER.mercado(); }
  // ventas por molécula y producto en el mercado elegido
  function marketData(d, g){
    const set = new Set(MK.mols), mols = new Map(), famsSeen = new Set();
    d.rows.forEach(r=>{
      if(r[5] !== g) return;
      const mi = CANON[r[0]]; if(!set.has(mi)) return;
      let m = mols.get(mi); if(!m){ m = { i:mi, v:0, u:0, prods:new Map() }; mols.set(mi, m); }
      const prod = d.s[r[1]], lab = d.s[r[2]], fam = formFamily(d.s[r[4]]);
      const key = MK.group === "lab" ? norm(lab) : norm(prod)+"|"+norm(lab)+"|"+fam;
      let p = m.prods.get(key); if(!p){ p = { prod, lab, fam, v:0, u:0, labs:new Set(), prodsN:new Set() }; m.prods.set(key, p); }
      p.v += r[7]; p.u += r[6]; p.labs.add(norm(lab)); p.prodsN.add(norm(prod)); m.v += r[7]; m.u += r[6]; famsSeen.add(fam);
    });
    const list = Array.from(mols.values()).sort((a,c)=> c.v-a.v);
    const V = list.reduce((t,m)=> t+m.v, 0), U = list.reduce((t,m)=> t+m.u, 0);
    return { list, V, U, fams: Array.from(famsSeen) };
  }
  // molécula del mismo subgrupo terapéutico (ATC de cuatro caracteres) con ventas en el año
  function siblings(i, d, g){
    const sub = ATC[i][0].slice(0,4), seen = new Map();
    d.rows.forEach(r=>{ if(r[5] !== g) return; const mi = CANON[r[0]]; if(ATC[mi][0].slice(0,4) === sub && ATC[mi][0] !== "SIN_ATC") seen.set(mi, (seen.get(mi)||0) + r[7]); });
    return Array.from(seen.entries()).sort((a,c)=> c[1]-a[1]).map(e=> e[0]);
  }
  function shareBar(label, items, total, key){
    const track = el("div",{class:"share-track", role:"img", "aria-label": label+": "+items.map(m=> m.name+" "+pct(m[key]/(total||1))).join(", ")});
    items.forEach(m=>{ const w = m[key]/(total||1)*100; if(w <= 0) return;
      const seg = el("span",{class:"share-seg "+m.cls, style:"width:"+w+"%"},[ w >= 9 ? el("span",{},[fmt(w, 0)+" %"]) : null ]);
      const h = "<strong>"+esc(m.name)+"</strong><br>"+esc(label)+": "+pct(m[key]/(total||1));
      seg.addEventListener("mousemove", (e)=> tip(h, e.clientX, e.clientY)); seg.addEventListener("mouseleave", untip);
      track.appendChild(seg); });
    return el("div",{class:"share-row"},[ el("span",{class:"share-label"},[label]), track ]);
  }

  RENDER.mercado = function(){
    const v = document.getElementById("view-mercado"), y = Q.year, g = chanIdx();
    if(!MK.mols.length) MK.mols = [S.mol];
    const head = el("div",{class:"view-head"},[ el("div",{},[ el("h2",{},["Distribución del mercado"]),
      el("p",{},["Valor y unidades vendidas, y la participación de cada principio activo y de cada producto en el mercado relevante que armes. Agrega los principios activos que compiten entre sí (por ejemplo, todos los iSGLT2) y abre cada uno con + para ver sus productos."]) ]) ]);
    fill(v, [ head, el("p",{class:"loading-note"},["Cargando las ventas de "+yearLabel(y)+"…"]) ]);
    loadAna(y).then(d=>{
      if(S.view !== "mercado" || Q.year !== y) return;
      if(!d){ fill(v, [ head, el("p",{class:"callout"},["No se pudieron cargar las ventas de "+y+"."]) ]); return; }
      const md = marketData(d, g), list = md.list;
      list.forEach((m,k)=>{ m.cls = CAT[k] || "c8"; m.name = molName(m.i); });
      const top = list.slice(0, 7), rest = list.slice(7);
      const shareItems = top.map(m=>({ name:m.name, cls:m.cls, v:m.v, u:m.u })).concat(rest.length ? [{ name:"Otros "+rest.length, cls:"c8", v: rest.reduce((t,m)=> t+m.v, 0), u: rest.reduce((t,m)=> t+m.u, 0) }] : []);
      // agregar principios activos
      const adder = searchBox({ compact:true, placeholder:"Agregar principio activo o marca…", onPick:(m)=> addMols([m.i]) });
      const sib = siblings(MK.mols[0], d, g).filter(x=> MK.mols.indexOf(x) < 0);
      const chips = el("div",{class:"chips"}, MK.mols.map(i=> el("span",{class:"chip"},[ molName(i), el("span",{class:"atc"},[ATC[i][0]]),
        MK.mols.length > 1 ? el("button",{type:"button", class:"chip-x", "aria-label":"Quitar "+molName(i), onclick:()=> removeMol(i)},["×"]) : null ])));
      const market = el("div",{class:"panel mk-build"},[
        el("h3",{class:"h3"},["Mercado relevante"]), chips,
        el("div",{class:"mk-add"},[ adder,
          sib.length ? el("button",{class:"btn", type:"button", onclick:()=> addMols(sib)},["Agregar "+sib.length+" del mismo subgrupo ("+ATC[MK.mols[0]][0].slice(0,4)+")"]) : null,
          MK.mols.length > 1 ? el("button",{class:"btn", type:"button", onclick:()=>{ MK.mols = [S.mol]; MK.open.clear(); MK.auto = true; dirty.add("regulacion"); RENDER.mercado(); }},["Volver a "+molName(S.mol)]) : null ]),
        sib.length ? el("p",{class:"small muted", style:"margin:8px 0 0"},["Mismo subgrupo: "+sib.slice(0,8).map(molName).join(", ")+(sib.length > 8 ? " y "+(sib.length-8)+" más" : "")+"."]) : null,
      ]);
      if(!list.length){ fill(v, [ head, market, el("p",{class:"callout"},["Ninguno de estos principios activos reporta ventas en el "+txText()+" en "+y+"."]) ]); return; }

      // tabla con filas desplegables: principio activo → productos
      const tbody = el("tbody");
      const lab = MK.group === "lab";
      function drawTable(){
        const rows = [];
        list.forEach(m=>{
          const opened = MK.open.has(m.i);
          rows.push(el("tr",{class:"mk-mol"},[
            el("td",{},[ el("button",{class:"mk-toggle", type:"button", "aria-expanded": opened ? "true" : "false", "aria-label":(opened ? "Cerrar " : "Abrir ")+m.name, onclick:()=>{ opened ? MK.open.delete(m.i) : MK.open.add(m.i); drawTable(); }},[opened ? "−" : "+"]),
              el("span",{class:"sw-dot "+m.cls}), el("strong",{},[m.name]), " ", el("span",{class:"atc"},[famCodes(m.i)]) ]),
            el("td",{class:"num"},[moneyShort(m.v)]), el("td",{class:"num"},[pct(m.v/(md.V||1))]),
            el("td",{class:"num"},[unitsShort(m.u)]), el("td",{class:"num"},[pct(m.u/(md.U||1))]), el("td",{class:"num"},[money(m.v/m.u)]) ]));
          if(opened) Array.from(m.prods.values()).sort((a,c)=> c.v-a.v).forEach(p=>{
            rows.push(el("tr",{class:"mk-prod"},[
              el("td",{},[ el("span",{class:"mk-pname"},[ lab ? (p.lab ? title(p.lab) : "Titular no identificado") : title(p.prod) ]),
                el("span",{class:"t-sub"},[ lab ? p.prodsN.size+" "+(p.prodsN.size === 1 ? "producto" : "productos") : (p.lab ? title(p.lab) : "Titular no identificado")+(p.fam ? ", "+p.fam.toLowerCase() : "") ]) ]),
              el("td",{class:"num"},[moneyShort(p.v)]), el("td",{class:"num"},[pct(p.v/(md.V||1))]),
              el("td",{class:"num"},[unitsShort(p.u)]), el("td",{class:"num"},[pct(p.u/(md.U||1))]), el("td",{class:"num"},[money(p.v/p.u)]) ]));
          });
        });
        rows.push(el("tr",{class:"mk-total"},[ el("td",{},["Total del mercado"]), el("td",{class:"num"},[moneyShort(md.V)]), el("td",{class:"num"},["100 %"]), el("td",{class:"num"},[unitsShort(md.U)]), el("td",{class:"num"},["100 %"]), el("td",{class:"num"},[money(md.V/md.U)]) ]));
        fill(tbody, rows);
      }
      const table = el("div",{class:"table-wrap"},[ el("table",{class:"t mk-table"},[ el("thead",{},[ el("tr",{},[ el("th",{},[lab ? "Principio activo y laboratorio" : "Principio activo y producto"]), el("th",{class:"num"},["Valor"]), el("th",{class:"num"},["% valor"]),
        el("th",{class:"num"},["Unidades"]), el("th",{class:"num"},["% unidades"]), el("th",{class:"num"},["Precio por unidad"]) ]) ]), tbody ]) ]);
      drawTable();

      // valor por año de cada principio activo (resumen.json: solo valor, sin unidades)
      const yearsHolder = el("div");
      const byYear = aggRes({ mols:new Set(MK.mols) }, o=> RES[o]+"|"+CANON[RES[o+1]]);
      const yrs = YEARS.slice();
      const series = top.slice(0,5).map((m,k)=>({ name:m.name, cls:"s"+(k+1), values: yrs.map(yy=>{ const a = byYear.get(yy+"|"+m.i); return a ? a.v : null; }) }));

      function exportMk(){
        const molRows = list.map(m=>({ med:m.name, atc:famCodes(m.i), v:m.v, sv:m.v/(md.V||1), u:m.u, su:m.u/(md.U||1), p:m.v/m.u }));
        const prodRows = []; list.forEach(m=> Array.from(m.prods.values()).forEach(p=> prodRows.push({ med:m.name, prod: lab ? "" : title(p.prod), lab: p.lab ? title(p.lab) : "Titular no identificado", fam:p.fam, v:p.v, sv:p.v/(md.V||1), svm:p.v/(m.v||1), u:p.u, su:p.u/(md.U||1), p:p.v/p.u })));
        const yRows = yrs.map(yy=>{ const o = { y:yy }; list.forEach(m=>{ const a = byYear.get(yy+"|"+m.i); o["m"+m.i] = a ? a.v : null; }); return o; });
        exportExcel("mercado_"+MK.mols.map(i=> ATC[i][0]).join("_").slice(0,60)+"_"+y+"_"+(Q.tx === "I" ? "institucional" : "comercial"), [
          toSheet("Principios activos", "Mercado relevante por principio activo ("+y+")", [ {h:"Principio activo",k:"med",t:"text"}, {h:"ATC",k:"atc",t:"text"}, {h:"Valor (COP)",k:"v",t:"money"}, {h:"Participación en valor",k:"sv",t:"pct"}, {h:"Unidades mínimas de dispensación",k:"u",t:"int"}, {h:"Participación en unidades",k:"su",t:"pct"}, {h:"Precio promedio por unidad (COP)",k:"p",t:"money"} ], molRows),
          toSheet(lab ? "Laboratorios" : "Productos", "Mercado relevante por "+(lab ? "laboratorio" : "producto")+" ("+y+")", [ {h:"Principio activo",k:"med",t:"text"}, lab ? null : {h:"Producto",k:"prod",t:"text"}, {h:"Laboratorio (titular)",k:"lab",t:"text"}, lab ? null : {h:"Forma",k:"fam",t:"text"}, {h:"Valor (COP)",k:"v",t:"money"}, {h:"Participación en el mercado (valor)",k:"sv",t:"pct"}, {h:"Participación en su principio activo (valor)",k:"svm",t:"pct"}, {h:"Unidades mínimas de dispensación",k:"u",t:"int"}, {h:"Participación en unidades",k:"su",t:"pct"}, {h:"Precio promedio por unidad (COP)",k:"p",t:"money"} ].filter(Boolean), prodRows.sort((a,c)=> c.v-a.v)),
          toSheet("Valor por año", "Valor por año de cada principio activo", [ {h:"Año",k:"y",t:"int"} ].concat(list.map(m=>({ h:m.name+" (COP)", k:"m"+m.i, t:"money" }))), yRows),
        ]);
      }
      const mixed = md.fams.length > 1;
      fill(v, [ head, market,
        el("div",{class:"toolbar"},[ el("p",{class:"small muted", style:"margin:0"},[queryText("año "+y)]), el("div",{class:"spacer"}), xlBtn("Descargar el mercado en Excel", exportMk) ]),
        el("div",{class:"figures"},[
          el("div",{class:"figure"},[ el("div",{class:"figure-v"},[moneyShort(md.V)]), el("div",{class:"figure-l"},["Valor del mercado en "+yearLabel(y)]) ]),
          el("div",{class:"figure"},[ el("div",{class:"figure-v"},[unitsShort(md.U)]), el("div",{class:"figure-l"},["Unidades mínimas de dispensación"]) ]),
          el("div",{class:"figure"},[ el("div",{class:"figure-v"},[money(md.V/md.U)]), el("div",{class:"figure-l"},["Precio promedio por unidad"]) ]),
          el("div",{class:"figure"},[ el("div",{class:"figure-v"},[fmt(list.reduce((t,m)=> t+m.prods.size, 0))]), el("div",{class:"figure-l"},[lab ? "Laboratorios" : "Productos con ventas"]) ]),
        ]),
        block("Participación en valor y en unidades", "Cada color es un principio activo. Si un principio activo pesa más en valor que en unidades, su unidad cuesta más que el promedio del mercado.", [
          el("div",{class:"share"},[ shareBar("Valor", shareItems, md.V, "v"), shareBar("Unidades", shareItems, md.U, "u") ]),
          el("div",{class:"legend"}, shareItems.map(m=> el("span",{class:"legend-item"},[ el("span",{class:"sw-dot "+m.cls}), m.name ]))),
          mixed ? el("p",{class:"callout small"},["Este mercado mezcla formas farmacéuticas ("+md.fams.join(", ").toLowerCase()+"). Las unidades mínimas de dispensación no son comparables entre formas (una tableta frente a un mililitro): lee la participación en unidades con cuidado."]) : null ]),
        block("Valores y unidades por principio activo y producto", "Abre cada principio activo con + para ver sus "+(lab ? "laboratorios" : "productos")+". Los porcentajes son sobre el total del mercado relevante.", [
          el("div",{class:"toolbar"},[ fieldset("Detalle", seg([{value:"prod",label:"Por producto"},{value:"lab",label:"Por laboratorio"}], MK.group, (x)=>{ MK.group = x; RENDER.mercado(); }, "Detalle")),
            el("button",{class:"btn", type:"button", onclick:()=>{ list.forEach(m=> MK.open.add(m.i)); drawTable(); }},["Abrir todos"]),
            el("button",{class:"btn", type:"button", onclick:()=>{ MK.open.clear(); drawTable(); }},["Cerrar todos"]) ]),
          table ], xlBtn("Excel", exportMk)),
        block("Valor por año", "Valor vendido por año de los principios activos de mayor valor, con el mismo canal.", [ yearsHolder ], xlBtn("Excel", exportMk)),
      ]);
      lineChart(yearsHolder, { label:"Valor por año", x: yrs, xLabel:(yy)=> partial(yy) ? yy+"*" : String(yy), fmt: moneyShort, tick: tickMoney, series });
      yearsHolder.appendChild(el("p",{class:"small muted"},["* Año parcial. Desde septiembre de 2026 rige la Circular 21 de 2026: no compares esos meses con los años anteriores."]));
    });
  };

  /* ============================================================
     REGULACIÓN: precio reportado frente al precio máximo de venta de la Comisión Nacional de Precios
     de Medicamentos y Dispositivos Médicos, por presentación comercial (CUM), en el mercado relevante.
     ============================================================ */
  const RG = { show:"all" };
  const UNITX = 5;
  RENDER.regulacion = function(){
    const v = document.getElementById("view-regulacion"), y = Q.year, g = Q.tx;
    if(!MK.mols.length) MK.mols = [S.mol];
    const head = el("div",{class:"view-head"},[ el("div",{},[ el("h2",{},["Precio reportado frente al precio regulado"]),
      el("p",{},["Para cada presentación comercial (CUM) de los principios activos del mercado relevante: el precio promedio y el máximo reportados a SISMED, frente al precio máximo de venta que fija la Comisión Nacional de Precios de Medicamentos y Dispositivos Médicos."]) ]) ]);
    const chips = el("div",{class:"chips"}, MK.mols.map(i=> el("span",{class:"chip"},[ molName(i), el("span",{class:"atc"},[ATC[i][0]]) ])).concat([ el("a",{class:"link-btn", href:"#mercado"},["Cambiar el mercado relevante"]) ]));
    fill(v, [ head, chips, el("p",{class:"loading-note"},["Cargando precios regulados…"]) ]);
    Promise.all([loadReg()].concat(MK.mols.map(loadMol))).then(([reg, ...bys])=>{
      if(S.view !== "regulacion" || Q.year !== y || Q.tx !== g) return;
      if(!reg){ fill(v, [ head, chips, el("p",{class:"callout"},["No se pudo cargar el precio regulado (data/regulacion.json)."]) ]); return; }
      const uD = unI("Unidad de dispensacion"), uP = unI("Presentacion comercial");
      const rows = [];
      bys.forEach((by, k)=>{
        const i = MK.mols[k], yd = by[y]; if(!yd) return;
        const acc = new Map();
        yd.prods.forEach(p=>{
          if(!inReport(p[1], p[2], p[4], g)) return;
          const c = yd.cums[p[0]], qty = c[4];
          let pres = null, mx = null;
          if(p[3] === uP){ pres = p[6]; mx = p[9]; } else if(p[3] === uD && qty){ pres = p[6]/qty; mx = p[9] != null ? p[9]*qty : null; }
          if(!pres || !p[7]) return;
          let a = acc.get(c[0]); if(!a){ a = { c, pres:0, v:0, mx:null }; acc.set(c[0], a); }
          a.pres += pres; a.v += p[7]; if(mx != null && (a.mx == null || mx > a.mx)) a.mx = mx;
        });
        acc.forEach((a, cum)=>{
          const r = reg.by.get(cum), c = a.c, price = a.v/a.pres;
          const pmv = r ? (g === "I" ? r[2] : r[4]) : null, marg = r && g === "I" ? (r[3] || 0) : 0;
          const ceil = pmv != null ? pmv + marg : null;
          // más de 5 veces por encima o por debajo del precio máximo: casi siempre un error de unidades
          // (unidades del CUM o reporte por caja marcado como unidad); se separa y no suma al exceso
          const ratio = ceil ? price/ceil : null;
          const st = ceil == null ? "none" : (ratio > UNITX || ratio < 1/UNITX) ? "unit" : price > ceil*1.005 ? "avg" : (a.mx != null && a.mx > ceil*1.005) ? "max" : "ok";
          rows.push({ i, med:molName(i), prod: title(c[3] || c[1]), lab: c[2] ? title(c[2]) : "Titular no identificado", cum, qty:c[4], pres:a.pres, v:a.v, price, mx:a.mx,
            pmv, marg: r && g === "I" ? marg : null, ceil, d: ceil ? price/ceil-1 : null, dMax: ceil && a.mx != null ? a.mx/ceil-1 : null,
            excess: st === "avg" ? (price-ceil)*a.pres : 0, st,
            mr: r ? reg.mercados[r[1]][1] : "", circ: r ? reg.circulares[r[5]][0] : "", vig: r ? reg.circulares[r[5]][1] : "" });
        });
      });
      if(!rows.length){ fill(v, [ head, chips, el("p",{class:"callout"},["No hay ventas por presentación de estos principios activos en el "+txText()+" en "+y+"."]) ]); return; }
      const withC = rows.filter(r=> r.ceil != null), V = rows.reduce((t,r)=> t+r.v, 0), Vc = withC.reduce((t,r)=> t+r.v, 0);
      const above = withC.filter(r=> r.st === "avg"), aboveMax = withC.filter(r=> r.st === "max"), excess = above.reduce((t,r)=> t+r.excess, 0);
      const circs = Array.from(new Set(withC.map(r=> r.circ+(r.vig ? " (vigente desde "+r.vig+")" : ""))));
      const unitChk = withC.filter(r=> r.st === "unit");
      const STX = { avg:"Promedio por encima", max:"Máximo por encima", ok:"Dentro del precio máximo", unit:"Revisar unidades", none:"Sin precio regulado" };
      const stCell = (r)=> el("span",{class:"band "+({ avg:"high", max:"mid", ok:"low", unit:"", none:"" })[r.st]},[STX[r.st]]);
      const COLS = [ { h:"Principio activo", k:"med", t:"text" }, { h:"Producto", k:"prod", t:"text" }, { h:"Laboratorio", k:"lab", t:"text" }, { h:"CUM", k:"cum", t:"text" },
        { h:"Precio promedio", xh:"Precio promedio reportado por presentación (COP)", k:"price", t:"money" }, { h:"Máximo reportado", xh:"Precio máximo reportado por presentación (COP)", k:"mx", t:"money" },
        { h:"Precio máximo regulado", xh:(g === "I" ? "Precio máximo de venta institucional + margen IPS" : "Precio máximo de venta comercial (primaria y secundaria)")+" (COP)", k:"ceil", t:"money" },
        { h:"Promedio frente al regulado", k:"d", t:"signed" }, { h:"Estado", k:"st", t:"text", render: stCell, xv:(r)=> STX[r.st] },
        { h:"Presentaciones", k:"pres", t:"int" }, { h:"Valor", xh:"Valor (COP)", k:"v", t:"moneyS" }, { h:"Valor sobre el precio regulado", xh:"Valor pagado sobre el precio máximo (COP)", k:"excess", t:"moneyS" },
        { h:"Mercado relevante (CNPMDM)", k:"mr", t:"text", noshow:true }, { h:"Precio máximo de venta sin margen (COP)", k:"pmv", t:"money", noshow:true },
        { h:"Margen IPS (COP)", k:"marg", t:"money", noshow:true }, { h:"Máximo reportado frente al regulado", k:"dMax", t:"signed", noshow:true },
        { h:"Unidades por presentación (CUM)", k:"qty", t:"int", noshow:true }, { h:"Circular", k:"circ", t:"text", noshow:true }, { h:"Vigencia desde", k:"vig", t:"text", noshow:true } ];
      const tableHolder = el("div");
      function drawTable(){
        const shown = RG.show === "reg" ? withC : RG.show === "above" ? withC.filter(r=> r.st === "avg" || r.st === "max") : RG.show === "unit" ? unitChk : rows;
        fill(tableHolder, [ sortTable(COLS.filter(c=> !c.noshow), shown, { sortKey: RG.show === "above" ? "excess" : "v", dir:-1, limit:40, rowClass:(r)=> r.st === "avg" ? "warn" : null }) ]);
      }
      // por principio activo: cuánto valor tiene precio regulado y cuánto se vende por encima
      const byMol = MK.mols.map(i=>{ const rr = rows.filter(r=> r.i === i), wc = rr.filter(r=> r.ceil != null), vv = rr.reduce((t,r)=> t+r.v, 0);
        return { i, med:molName(i), n:rr.length, nReg:wc.length, v:vv, sReg: wc.reduce((t,r)=> t+r.v, 0)/(vv||1), nAbove: wc.filter(r=> r.st === "avg").length, excess: wc.reduce((t,r)=> t+r.excess, 0) }; }).filter(r=> r.n);
      const MCOLS = [ { h:"Principio activo", k:"med", t:"text" }, { h:"Presentaciones con ventas", k:"n", t:"int" }, { h:"Con precio regulado", k:"nReg", t:"int" }, { h:"Valor con precio regulado", xh:"Parte del valor con precio regulado", k:"sReg", t:"pct" },
        { h:"Promedio por encima", xh:"Presentaciones con precio promedio por encima del regulado", k:"nAbove", t:"int" }, { h:"Valor sobre el precio regulado", xh:"Valor pagado sobre el precio máximo (COP)", k:"excess", t:"moneyS" } ];
      const exportRg = ()=> exportExcel("regulacion_"+MK.mols.map(i=> ATC[i][0]).join("_").slice(0,60)+"_"+y+"_"+(g === "I" ? "institucional" : "comercial"), [
        toSheet("Presentaciones", "Precio reportado frente al precio máximo de venta, por CUM ("+y+")", COLS.map(c=> c.k === "st" ? Object.assign({}, c, { k:"stx" }) : c), rows.map(r=> Object.assign({ stx: STX[r.st] }, r)).sort((a,c)=> c.v-a.v)),
        toSheet("Principios activos", "Resumen por principio activo ("+y+")", MCOLS, byMol),
      ]);
      const finding = (cls, big, h, t)=> el("div",{class:"finding "+(cls||"")},[ el("div",{class:"finding-v"},[big]), el("p",{class:"finding-h"},[h]), el("p",{class:"finding-t"},[t]) ]);
      fill(v, [ head, chips,
        el("div",{class:"toolbar"},[ el("p",{class:"small muted", style:"margin:0"},[queryText("año "+y)]), el("div",{class:"spacer"}), xlBtn("Descargar la comparación en Excel", exportRg) ]),
        el("div",{class:"findings"},[
          finding("", pct(Vc/(V||1),0), "Del valor tiene precio regulado", fmt(withC.length)+" de "+fmt(rows.length)+" presentaciones con ventas tienen precio máximo de venta."),
          finding(above.length ? "high" : "low", fmt(above.length), "Presentaciones con precio promedio por encima", above.length ? "Suman "+moneyShort(above.reduce((t,r)=> t+r.v, 0))+" en ventas. Se toma «por encima» cuando el promedio supera el precio máximo en más de 0,5 %." : "Ninguna presentación con precio regulado se vende, en promedio, por encima del precio máximo."),
          finding(aboveMax.length ? "high" : "", fmt(aboveMax.length), "Con algún precio máximo reportado por encima", "Su promedio está dentro del precio regulado, pero el precio más alto reportado en el año lo supera."),
          finding(excess ? "high" : "", moneyShort(excess), "Valor sobre el precio regulado", "(Precio promedio − precio máximo) × presentaciones vendidas, en las presentaciones con promedio por encima."+(unitChk.length ? " "+unitChk.length+" "+(unitChk.length === 1 ? "presentación queda" : "presentaciones quedan")+" aparte por un precio más de "+UNITX+" veces por encima o por debajo del regulado, casi siempre un error de unidades." : "")),
        ]),
        el("p",{class:"callout small"},[ "Precio máximo de venta: "+(circs.join("; ") || "sin dato")+". Es el que rige hoy; el que regía en "+y+" pudo ser otro, así que la comparación de años anteriores es una referencia, no una prueba de incumplimiento. "+
          (g === "I" ? "En el canal institucional se compara la transacción final con el precio máximo institucional más el margen de la IPS." : "En el canal comercial se compara la venta primaria del laboratorio con el precio máximo de la transacción primaria y secundaria comercial.") ]),
        block("Por principio activo", "Cuánto del valor de cada principio activo tiene precio regulado y cuántas presentaciones se venden, en promedio, por encima.", [ sortTable(MCOLS, byMol, { sortKey:"v", dir:-1 }) ], xlBtn("Excel", exportRg)),
        block("Por presentación comercial (CUM)", "Precio por presentación comercial: el valor reportado dividido entre las presentaciones vendidas (lo reportado por tableta o vial se convierte con las unidades del CUM).", [
          el("div",{class:"toolbar"},[ fieldset("Mostrar", seg([{value:"all",label:"Todas"},{value:"reg",label:"Con precio regulado"},{value:"above",label:"Por encima"}].concat(unitChk.length ? [{value:"unit",label:"Revisar unidades"}] : []), RG.show, (x)=>{ RG.show = x; drawTable(); }, "Mostrar")) ]),
          tableHolder ], xlBtn("Excel", exportRg)),
      ]);
      drawTable();
    });
  };

  /* ============================================================
     DOCUMENTO: RESUMEN, OBJETIVO, MATERIALES Y MÉTODOS
     ============================================================ */
  RENDER.resumen = function(){
    const box = document.getElementById("resumen-body"), y = Q.year, g = chanIdx();
    fill(box, [ el("p",{class:"loading-note"},["Calculando el resumen de "+yearLabel(y)+"…"]) ]);
    loadAna(y).then(d=>{
      if(Q.year !== y || chanIdx() !== g) return;
      if(!d){ fill(box, [ el("p",{class:"callout"},["No se pudieron cargar las ventas de "+y+"."]) ]); return; }
      const brands = anaBrands(d), groups = anaGroups(brands, g), sm = anaSummary(groups), bq = BQ(), DI = DISPINFO[M.disp] || DISPINFO.iqr;
      const molV = new Map(); brands.forEach(b=>{ const c = b.ch[g]; if(c.v > 0) molV.set(b.mol, (molV.get(b.mol)||0) + c.v); });
      const mols = Array.from(molV.entries()).sort((a,c)=> c[1]-a[1]), V = mols.reduce((t,m)=> t+m[1], 0);
      const top10 = mols.slice(0,10).reduce((t,m)=> t+m[1], 0);
      const labs = new Set(brands.filter(b=> b.ch[g].v > 0 && b.lab).map(b=> norm(b.lab))).size;
      const nBrands = brands.filter(b=> b.ch[g].v > 0).length;
      const chan = Q.tx === "I" ? "En el canal institucional (transacción final: lo que facturan IPS y operadores logísticos al dispensar con recursos públicos)" : "En el canal comercial (venta primaria del laboratorio, con recursos privados)";
      const finding = (cls, big, h, t)=> el("div",{class:"finding "+(cls||"")},[ el("div",{class:"finding-v"},[big]), el("p",{class:"finding-h"},[h]), el("p",{class:"finding-t"},[t]) ]);
      fill(box, [
        el("p",{class:"lede"},[ chan+", en "+yearLabel(y)+" se reportaron "+moneyShort(V)+" en "+fmt(mols.length)+" principios activos, "+fmt(nBrands)+" marcas y "+fmt(labs)+" laboratorios titulares. "+
          "Los diez principios activos de mayor valor suman el "+pct(top10/(V||1),0)+"; los primeros son "+mols.slice(0,3).map(m=> molName(m[0])+" ("+pct(m[1]/(V||1),1)+")").join(", ")+"." ]),
        el("div",{class:"findings"},[
          finding("", DI.unit ? (sm.disp == null ? "—" : DI.unit(sm.disp)) : "—", "Dispersión de precios entre equivalentes", sm.disp == null ? "No hay grupos con tres o más marcas." : DI.sentence(sm.disp)),
          finding("high", pct(sm.high,0), "Del valor, en marcas de precio alto", "Marcas por encima del "+bq[3]+" de su grupo de equivalentes. En marcas de precio bajo (hasta el "+bq[2]+"): "+pct(sm.low,0)+"."),
          finding("", moneyShort(sm.excess), "Gasto sobre la referencia", "El "+pct(sm.excess/(sm.vC||1),1)+" del valor comparable: lo que se habría pagado de menos si cada unidad por encima "+refDe()+" de su grupo hubiera costado eso. Un ejercicio, no una meta de precio."),
          finding("", fmt(sm.cmp), "Grupos con tres o más marcas", "De "+fmt(sm.groups)+" grupos de comparación; suman el "+pct(sm.shareC,0)+" del valor. En los demás no hay con qué comparar el precio."),
        ]),
        el("p",{class:"small muted"},["Cifras calculadas en el navegador con los datos publicados y los ajustes de método vigentes. Cambian con el año y el canal de la barra de consulta. La vista de regulación compara, presentación por presentación, el precio reportado con el precio máximo de venta."]),
      ]);
    });
  };

  function openMetodos(anchor){
    const d = document.getElementById("metodos");
    if(!d.open) d.open = true;
    if(dirty.has("metodos")){ dirty.delete("metodos"); RENDER.metodos(); }
    requestAnimationFrame(()=>{ const t = document.getElementById(anchor || "metodos"); if(t) t.scrollIntoView({ block:"start" }); });
  }
  RENDER.metodos = function(){
    const box = document.getElementById("metodos-body");
    const Qd = META.quality || [], src = META.source;
    const sum = (k)=> Qd.reduce((s,q)=> s+(q[k]||0), 0);
    const raw = sum("raw"), valid = sum("valid"), outl = sum("outliers")+sum("price_outliers"), outlV = sum("outlier_value")+sum("price_outlier_value");
    const lm = lastMonth();
    const qrows = Qd.map(q=>({ q:q.q.replace("-T"," T"), pub:q.published, raw:q.raw, valid:q.valid, out:(q.outliers||0)+(q.price_outliers||0), outv:(q.outlier_value||0)+(q.price_outlier_value||0), fix:q.atc_corrected||0, noatc:q.noatc }));
    const QCOLS = [ {h:"Trimestre",k:"q",t:"text"}, {h:"Publicado",k:"pub",t:"text"}, {h:"Leídos",k:"raw",t:"int"}, {h:"Usados",k:"valid",t:"int"}, {h:"Excluidos",k:"out",t:"int"}, {h:"Valor excluido",xh:"Valor excluido (COP)",k:"outv",t:"moneyS"}, {h:"ATC corregido",k:"fix",t:"int"}, {h:"Sin ATC",k:"noatc",t:"int"} ];
    const exportQ = ()=> exportExcel("calidad_sismed", [ { name:"Trimestres", title:"Reportes por trimestre", query:"Archivos MED100MPRE de SISPRO", cols: QCOLS.map(c=>({ h:c.xh||c.h, t: XT[c.t] })), rows: qrows.map(r=> QCOLS.map(c=> r[c.k])) } ]);
    // valor por transacción en el último año completo: qué se usa y qué se deja fuera
    const yL = lastFull(), tot = new Map();
    for(let r=0;r<NRES;r++){ const o = r*7; if(RES[o] !== yL) continue; const k = RES[o+2]+"|"+RES[o+3]+"|"+(RES[o+4] === LAB ? 1 : 2); tot.set(k, (tot.get(k)||0) + RES[o+6]); }
    const txRows = Array.from(tot.entries()).map(([k,v])=>{ const [t,o,rl] = k.split("|").map(Number);
      const used = inReport(t, o, rl === 1 ? LAB : -1, "I") || inReport(t, o, rl === 1 ? LAB : -1, "C");
      return { tx: (CONTENT.channels[TX[t]]||{}).short || title(TX[t]), op: CONTENT.ops[OP[o]] || title(OP[o]), rol: rl === 1 ? "Laboratorio (rol 1)" : "Otros actores (rol 2)", v, use: used ? "Se usa" : "Fuera", why: CONTENT.txWhy(TX[t], OP[o], rl === 1) }; })
      .sort((a,c)=> (a.use === c.use ? c.v-a.v : a.use === "Se usa" ? -1 : 1));
    fill(box, [
      el("h3",{},["Fuente de datos"]),
      el("p",{},["Precios y unidades reportados al Sistema de Información de Precios de Medicamentos (SISMED) que MinSalud publica en SISPRO: "+fmt(src.filesUsed)+" archivos MED100MPRE, de octubre de 2019 a "+(lm ? MES[lm%100-1]+" de "+Math.floor(lm/100) : "")+" ("+fmt(raw)+" filas leídas, "+pct(valid/(raw||1))+" usadas). El titular, el producto, la concentración, la forma farmacéutica y el código ATC se cruzan por expediente con el catálogo de Código Único de Medicamentos (CUM) del INVIMA. El precio máximo de venta sale de datos.gov.co (conjunto nauz-qkjw)."]),
      el("h3",{},["Qué transacción se usa en cada canal"]),
      el("p",{},["SISMED no es un sistema de trazabilidad: cada eslabón de la cadena reporta por su lado, y en una misma factura el vendedor reporta la venta y el comprador la compra. Sumar transacciones u operaciones cuenta el mismo medicamento varias veces. Por eso se toma un solo eslabón por canal, el último que SISMED observa, según las definiciones de la Circular 06 de 2018 (vigentes en las Circulares 17 de 2023 y 21 de 2026):"]),
      el("ul",{},[
        el("li",{},[ el("strong",{},["Institucional (recursos públicos): transacción final, operación de venta. "]), "Es lo que factura la IPS o el operador logístico al dispensar el medicamento, cualquiera sea el actor que reporta. La compra y el recobro de esa misma transacción quedan fuera, igual que la venta del laboratorio y la del distribuidor, que son eslabones anteriores del mismo medicamento." ]),
        el("li",{},[ el("strong",{},["Comercial (recursos privados): venta primaria del laboratorio. "]), "El canal comercial no tiene transacción final en SISMED, porque las droguerías no reportan. La venta secundaria (entre distribuidores y a droguerías) se repetiría cuando un mayorista vende a otro." ]),
      ]),
      el("p",{class:"small muted"},["Valor reportado en "+yL+" por transacción, operación y actor:"]),
      sortTable([ {h:"Transacción",k:"tx",t:"text"}, {h:"Operación",k:"op",t:"text"}, {h:"Actor que reporta",k:"rol",t:"text"}, {h:"Valor",xh:"Valor (COP)",k:"v",t:"moneyS"}, {h:"En el reporte",k:"use",t:"text"}, {h:"Por qué",k:"why",t:"text"} ], txRows, { sortKey:"use", dir:-1, limit:20, rowClass:(r)=> r.use === "Se usa" ? "sel" : null }),
      el("h3",{},["Unidades"]),
      el("p",{},["Todos los precios van por unidad mínima de dispensación (tableta, cápsula, vial, mililitro), la unidad que fija la Circular 21 de 2026. Lo reportado por presentación comercial se divide entre las unidades de la presentación del CUM; lo reportado por embalaje primario o por unidad mínima de concentración no se puede convertir y queda fuera. En la vista de regulación se hace lo inverso, porque el precio máximo de venta es por presentación comercial."]),
      el("h3",{},["Periodos y circulares"]),
      el("div",{class:"table-wrap"},[ el("table",{class:"t"},[ el("thead",{},[ el("tr",{},[ el("th",{},["Periodo"]), el("th",{},["Norma"]), el("th",{},["Qué cambia en el reporte"]) ]) ]),
        el("tbody",{}, REGIMES.map(r=> el("tr",{},[ el("td",{},[ymShort(r.from)+(r.to < 999900 ? " a "+ymShort(r.to) : " en adelante")]), el("td",{},[r.circ]), el("td",{},[r.d]) ]))) ]) ]),
      el("p",{},["Los años 2019 y "+Math.floor((lm||0)/100)+" están incompletos. Con la Circular 21 de 2026 las bonificaciones entran con precio cero y las notas crédito rebajan el precio de la factura, así que el precio promedio puede bajar sin que cambie el precio de lista. MinSalud advierte que esa serie no empalma con la anterior: la app no mezcla los dos formatos"+((META.formatosNuevos||[]).length ? " (SISPRO ya publica "+META.formatosNuevos.join(", ")+", que aún no se procesa)" : "")+"."]),
      el("h3",{},["Termómetro de precios"]),
      el("p",{},["Cada punto es una marca: producto, laboratorio, concentración y forma, con todas sus presentaciones. Precio = valor ÷ unidades. «Todas las marcas» compara las del mismo principio activo y la misma familia de forma farmacéutica; «Solo equivalentes» exige además la misma concentración (normalizada: «12,3 mg equivalente a 10 mg» es 10 mg). "+CONTENT.thermometer.rule]),
      el("h3",{},["Mercado relevante"]),
      el("p",{},["Quien consulta arma el mercado con uno o varios principios activos (o todo su subgrupo ATC de cuatro caracteres). La participación en valor y en unidades es sobre el total de ese mercado, en el año y el canal elegidos. La Comisión Nacional de Precios de Medicamentos y Dispositivos Médicos define sus propios mercados relevantes para regular precios; la vista de regulación muestra el que corresponde a cada CUM."]),
      el("h3",{},["Precio regulado"]),
      el("p",{},["Precio máximo de venta por presentación comercial (CUM). En el canal institucional se compara con el precio máximo de las transacciones primaria, secundaria y final institucional más el margen de la IPS; en el comercial, con el de la transacción primaria y secundaria comercial. «Por encima» quiere decir que el promedio reportado supera el precio máximo en más de 0,5 %. Las presentaciones con un precio más de "+UNITX+" veces por encima o por debajo del regulado quedan aparte («Revisar unidades»): casi siempre son errores en las unidades del CUM o reportes por caja marcados como unidad, y no suman al valor sobre el precio regulado. El precio máximo publicado es el vigente hoy: para años anteriores es una referencia."]),
      el("h3",{id:"m-ajustes"},["Ajustes de método"]),
      methodPanel(),
      el("h3",{},["Calidad de los datos"]),
      el("div",{class:"figures"},[
        el("div",{class:"figure"},[ el("div",{class:"figure-v"},[fmt(raw)]), el("div",{class:"figure-l"},["Filas leídas en "+fmt(src.filesUsed)+" archivos"]) ]),
        el("div",{class:"figure"},[ el("div",{class:"figure-v"},[pct(valid/(raw||1))]), el("div",{class:"figure-l"},["Filas usadas"]) ]),
        el("div",{class:"figure"},[ el("div",{class:"figure-v"},[pct(outl/(raw||1))]), el("div",{class:"figure-l"},["Excluidas por valores imposibles ("+moneyShort(outlV)+")"]) ]),
        el("div",{class:"figure"},[ el("div",{class:"figure-v"},[META.holders ? pct(META.holders.withHolder/META.holders.products,0) : "—"]), el("div",{class:"figure-l"},["Productos con titular identificado"]) ]),
      ]),
      el("div",{class:"block-head", style:"margin-top:14px"},[ el("p",{class:"small muted", style:"margin:0"},["Reportes por trimestre"]), xlBtn("Excel", exportQ) ]),
      sortTable(QCOLS, qrows, { sortKey:"q", dir:-1, limit:8 }),
      el("h3",{},["Limitaciones"]),
      el("div",{class:"notes"}, CONTENT.caveats.map(c=> el("details",{},[ el("summary",{},[c.t]), el("p",{},[c.d]) ]))),
      el("h3",{},["Fuentes"]),
      el("ul",{}, Object.values(CONTENT.sources).map(s=> el("li",{},[ el("a",{href:s.url, target:"_blank", rel:"noopener noreferrer"},[s.label]) ]))),
      el("p",{class:"small muted"},["Para reproducirlo: python agent/sismed_agent.py (solo biblioteca estándar de Python). El agente revisa SISPRO el día 1 de cada mes."]),
    ]);
  };

  /* ============================================================
     ARRANQUE
     ============================================================ */
  function boot(){
    const m = CONTENT.meta;
    document.getElementById("footer-author").textContent = m.author+", "+m.credentials+". "+m.affiliation+".";
    document.getElementById("footer-disclaimer").textContent = m.disclaimer;
    const lic = document.getElementById("footer-license"); lic.href = m.license.url; lic.textContent = m.license.name+".";
    document.getElementById("footer-license-text").textContent = m.license.text;
    fill(document.getElementById("objetivo-body"), [ el("p",{},[CONTENT.objective.general]), el("ul",{}, CONTENT.objective.specific.map(t=> el("li",{},[t]))) ]);
    document.getElementById("theme-toggle").addEventListener("click", ()=>{ const n = effectiveTheme() === "dark" ? "light" : "dark"; applyTheme(n); try{ localStorage.setItem(THEME_KEY, n); }catch(e){} redraw(); });
    // las pestañas quedan fijas justo debajo de la barra de consulta, que cambia de alto en el móvil
    const qb = document.getElementById("stickybar");
    const setQbH = ()=> document.documentElement.style.setProperty("--qb-h", qb.offsetHeight+"px");
    if(window.ResizeObserver) new ResizeObserver(setQbH).observe(qb);
    addEventListener("resize", ()=>{ setQbH(); clearTimeout(boot.rz); boot.rz = setTimeout(redraw, 150); });
    addEventListener("scroll", untip, { passive:true });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") untip(); });
    const met = document.getElementById("metodos");
    met.addEventListener("toggle", ()=>{ if(met.open && META && dirty.has("metodos")){ dirty.delete("metodos"); RENDER.metodos(); } });
    renderTabs();
    const state = document.getElementById("load-state");
    const get = (p)=> fetch(p, { cache:"no-cache" }).then(r=>{ if(!r.ok) throw new Error(p+" respondió "+r.status); return r.json(); });
    Promise.all([get("data/meta.json"), get("data/resumen.json"), get("data/tendencia.json")]).then(([meta, res, ten])=>{
      prepare(meta, res, ten);
      Q.year = lastFull(); Q.tx = "I";
      state.hidden = true;
      document.getElementById("doc").hidden = false;
      buildSearch();
      addEventListener("hashchange", ()=> show(location.hash.slice(1), true));
      const h = location.hash.slice(1);
      show(h || "precios", !!h && h !== "metodos");
      dirty.delete("resumen"); RENDER.resumen();
      if(met.open){ dirty.delete("metodos"); RENDER.metodos(); }
      get("data/productos.json").then(p=>{ PRODIDX = p.items || []; ALIASES = p.aliases || {}; INN.clear(); buildSearch(); dirty.delete("resumen"); RENDER.resumen(); }).catch(()=>{});
    }).catch(err=>{
      state.textContent = "No se pudieron cargar los datos ("+err.message+"). Si abriste el archivo directamente, sírvelo con un servidor local: python -m http.server";
      state.classList.add("error");
    });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
