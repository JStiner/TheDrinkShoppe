const CFG = {
  PAGE_SIZE: 40,
  STORE_FAV:  "drinkshoppe:favorites:editable:v1",
  STORE_HIDE: "drinkshoppe:hidden:editable:v1",
};

const LOTUS = { name:"White Lotus", pumpsPerAdd:1, caffeineMgPerPump:80, emoji:"⚡" };

let MENU = null;
let RECIPES = null;
let BASES = [];
let SYRUPS = [];

const Store = {
  load(key) {
    try { const r = localStorage.getItem(key); return new Set(r ? JSON.parse(r) : []); }
    catch { return new Set(); }
  },
  save(key, set) {
    try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
  }
};

const state = {
  baseCategory:   "all",
  baseFlavor:     "all",
  lotusOnly:      false,
  favOnly:        false,
  selectedSyrups: new Set(),
  pages:          { A: 0, B: 0, C: 0 },
  favorites:      Store.load(CFG.STORE_FAV),
  hidden:         Store.load(CFG.STORE_HIDE),
  lastHidden:     null,
};

function stableHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pick(arr, seed) { return arr[seed % arr.length]; }

function drinkId({ base, primary, secondary, lotus }) {
  return `${base.id}|${primary.id}|${secondary ? secondary.id : ""}|${lotus ? "L" : "N"}`;
}

function drinkName({ base, primary, secondary, lotus }) {
  const id   = drinkId({ base, primary, secondary, lotus });
  const seed = stableHash(id);
  const vibe = pick(primary.vibe, seed);
  const lead = secondary ? "🍹" : "🥤";
  const ltag = lotus ? ` ${LOTUS.emoji}` : "";
  if (!secondary) return `${lead} ${vibe} ${primary.label} ${base.alias}${ltag}`;
  const vibe2 = pick(secondary.vibe, seed >>> 1);
  return `${lead} ${vibe} ${primary.label} + ${vibe2} ${secondary.label} ${base.alias}${ltag}`;
}

function drinkRecipe({ base, primary, secondary, lotus }) {
  const parts = [base.label, `${primary.label} (2)`];
  if (secondary) parts.push(`${secondary.label} (1)`);
  if (lotus) parts.push(`${LOTUS.name} (${LOTUS.pumpsPerAdd})`);
  return parts.join(" + ");
}

let _allCache = null;
function getAllCombos() {
  if (_allCache) return _allCache;
  const result = [];
  for (const base of BASES) {
    for (const s1 of SYRUPS) {
      result.push({ base, primary: s1, secondary: null, lotus: false });
      result.push({ base, primary: s1, secondary: null, lotus: true });
      for (const s2 of SYRUPS) {
        if (s1.id === s2.id) continue;
        result.push({ base, primary: s1, secondary: s2, lotus: false });
        result.push({ base, primary: s1, secondary: s2, lotus: true });
      }
    }
  }
  _allCache = result;
  return result;
}

function applyFilters(combos) {
  const { baseCategory, baseFlavor, lotusOnly, favOnly, hidden, favorites, selectedSyrups } = state;
  return combos
    .filter(c => baseCategory === "all" || c.base.category === baseCategory)
    .filter(c => baseFlavor  === "all" || c.base.id === baseFlavor)
    .filter(c => lotusOnly ? c.lotus : !c.lotus)
    .filter(c => !hidden.has(drinkId(c)))
    .filter(c => !favOnly  || favorites.has(drinkId(c)))
    .filter(c => {
      if (selectedSyrups.size === 0) return true;
      return selectedSyrups.has(c.primary.id) || (c.secondary && selectedSyrups.has(c.secondary.id));
    })
    .map(c => {
      const id = drinkId(c);
      return { ...c, id, name: drinkName(c), recipe: drinkRecipe(c), isFav: favorites.has(id) };
    });
}

function renderItem(d) {
  const specific = (state.baseFlavor !== "all") || (state.baseCategory !== "all");
  const div = document.createElement("div");
  div.className = "drink";
  div.dataset.id = d.id;

  let actionsHtml = "";
  if (specific) {
    actionsHtml = `
      <button class="icon-btn ${d.isFav ? "fav-on" : ""}" data-action="fav" title="Favorite">
        ${d.isFav ? "★" : "☆"}
      </button>
      <button class="icon-btn" data-action="hide" title="Hide drink">✕</button>
    `;
  }

  div.innerHTML = `
    <div class="drink-emoji">${d.base.emoji}</div>
    <div class="drink-body">
      <div class="drink-name">${d.name}</div>
      <div class="drink-tags">
        <span class="dtag">${d.recipe}</span>
        <span class="dtag">${d.base.category.toUpperCase()}</span>
        ${d.lotus ? `<span class="dtag lotus">${LOTUS.emoji} Lotus</span>` : ""}
      </div>
    </div>
    <div class="drink-actions">${actionsHtml}</div>
  `;
  return div;
}

function renderColumn({ listEl, footEl, countEl, prevBtn, nextBtn, items, pageKey }) {
  const total   = items.length;
  const maxPage = Math.max(0, Math.ceil(total / CFG.PAGE_SIZE) - 1);
  state.pages[pageKey] = Math.min(Math.max(state.pages[pageKey], 0), maxPage);

  const slice = items.slice(state.pages[pageKey] * CFG.PAGE_SIZE, (state.pages[pageKey] + 1) * CFG.PAGE_SIZE);

  listEl.innerHTML = "";
  if (slice.length === 0) {
    listEl.innerHTML = `<div class="empty"><div class="empty-icon">🥤</div><div class="empty-msg">No drinks match your filters</div></div>`;
  } else {
    slice.forEach(d => listEl.appendChild(renderItem(d)));
  }

  countEl.textContent = `${total} · pg ${state.pages[pageKey] + 1}/${maxPage + 1}`;
  prevBtn.disabled = state.pages[pageKey] <= 0;
  nextBtn.disabled = state.pages[pageKey] >= maxPage;
  footEl.style.display = total > CFG.PAGE_SIZE ? "flex" : "none";
}

function renderSyrupChips() {
  const el = document.getElementById("syrupChips");
  el.innerHTML = "";

  if (state.selectedSyrups.size > 0) {
    const clear = document.createElement("button");
    clear.className = "chip chip-clear";
    clear.textContent = "Clear all";
    clear.onclick = () => { state.selectedSyrups.clear(); resetPages(); render(); };
    el.appendChild(clear);
  }

  for (const s of SYRUPS) {
    const btn = document.createElement("button");
    btn.className = "chip" + (state.selectedSyrups.has(s.id) ? " active" : "");
    btn.textContent = s.label;
    btn.dataset.syrupId = s.id;
    el.appendChild(btn);
  }
}

function populateBaseCategoryOptions() {
  const sel = document.getElementById("baseCategory");
  const categories = MENU.categories || [
    { id:"soda", label:"NT Soda" },
    { id:"chill", label:"Fruit Chill" },
    { id:"fizz", label:"Fizz" },
    { id:"water", label:"Water" }
  ];

  sel.innerHTML = `<option value="all">All</option>`;
  categories.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.label;
    sel.appendChild(o);
  });
  sel.value = state.baseCategory;
}

function renderBaseFlavorOptions() {
  const sel = document.getElementById("baseFlavor");
  const prev = state.baseFlavor;
  sel.innerHTML = `<option value="all">All</option>`;
  const bases = state.baseCategory === "all" ? BASES : BASES.filter(b => b.category === state.baseCategory);
  bases.forEach(b => {
    const o = document.createElement("option");
    o.value = b.id;
    o.textContent = b.label;
    sel.appendChild(o);
  });
  sel.value = [...sel.options].some(o => o.value === prev) ? prev : "all";
  state.baseFlavor = sel.value;
}

function render() {
  document.getElementById("lotusLabel").textContent = state.lotusOnly ? "Only Lotus" : "Exclude Lotus";
  document.getElementById("favLabel").textContent   = state.favOnly   ? "Only Favorites" : "All Drinks";

  const all   = getAllCombos();
  const items = applyFilters(all);

  const colA = MENU.columns?.A?.categories || ["soda"];
  const colB = MENU.columns?.B?.categories || ["chill"];
  const colC = MENU.columns?.C?.categories || ["fizz","water"];

  document.getElementById("headA").textContent = MENU.columns?.A?.title || "NT Sodas";
  document.getElementById("headB").textContent = MENU.columns?.B?.title || "NT Fruit Chill";
  document.getElementById("headC").textContent = MENU.columns?.C?.title || "Fizz & Water";

  const listA = items.filter(x => colA.includes(x.base.category));
  const listB = items.filter(x => colB.includes(x.base.category));
  const listC = items.filter(x => colC.includes(x.base.category));

  const cols = [
    { sec:"secA", list:listA, key:"A", list_el:"cola", foot:"footA", ct:"cta", prev:"aPrev", next:"aNext" },
    { sec:"secB", list:listB, key:"B", list_el:"colb", foot:"footB", ct:"ctb", prev:"bPrev", next:"bNext" },
    { sec:"secC", list:listC, key:"C", list_el:"colc", foot:"footC", ct:"ctc", prev:"cPrev", next:"cNext" },
  ];

  let visible = 0;
  for (const c of cols) {
    const sec = document.getElementById(c.sec);
    if (c.list.length === 0) {
      sec.style.display = "none";
    } else {
      sec.style.display = "";
      visible++;
      renderColumn({
        listEl:  document.getElementById(c.list_el),
        footEl:  document.getElementById(c.foot),
        countEl: document.getElementById(c.ct),
        prevBtn: document.getElementById(c.prev),
        nextBtn: document.getElementById(c.next),
        items:   c.list,
        pageKey: c.key,
      });
    }
  }

  document.getElementById("grid").dataset.cols = visible <= 1 ? "1" : visible === 2 ? "2" : "3";
  renderSyrupChips();
}

let _toastTimer;
function showToast(msg) {
  const el = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 4000);
}

document.getElementById("toast-undo").addEventListener("click", () => {
  if (!state.lastHidden) return;
  state.hidden.delete(state.lastHidden);
  Store.save(CFG.STORE_HIDE, state.hidden);
  state.lastHidden = null;
  document.getElementById("toast").classList.remove("show");
  resetPages(); render();
});

function resetPages() { state.pages.A = 0; state.pages.B = 0; state.pages.C = 0; }

function resetAllViewOnly() {
  state.baseCategory = "all";
  state.baseFlavor   = "all";
  state.lotusOnly    = false;
  state.favOnly      = false;
  state.selectedSyrups.clear();
  state.hidden.clear();
  Store.save(CFG.STORE_HIDE, state.hidden);

  document.getElementById("baseCategory").value = "all";
  renderBaseFlavorOptions();
  document.getElementById("baseFlavor").value = "all";
  document.getElementById("lotusToggle").checked = false;
  document.getElementById("favToggle").checked = false;

  resetPages();
  render();
}

document.getElementById("resetAllTop").addEventListener("click", resetAllViewOnly);

document.getElementById("baseCategory").addEventListener("change", e => {
  state.baseCategory = e.target.value;
  renderBaseFlavorOptions();
  resetPages(); render();
});
document.getElementById("baseFlavor").addEventListener("change", e => {
  state.baseFlavor = e.target.value; resetPages(); render();
});
document.getElementById("lotusToggle").addEventListener("change", e => {
  state.lotusOnly = e.target.checked; resetPages(); render();
});
document.getElementById("favToggle").addEventListener("change", e => {
  state.favOnly = e.target.checked; resetPages(); render();
});

document.getElementById("syrupChips").addEventListener("click", e => {
  const btn = e.target.closest("[data-syrup-id]");
  if (!btn) return;
  const id = btn.dataset.syrupId;
  state.selectedSyrups.has(id) ? state.selectedSyrups.delete(id) : state.selectedSyrups.add(id);
  resetPages(); render();
});

[["aPrev","aNext","A"],["bPrev","bNext","B"],["cPrev","cNext","C"]].forEach(([prev, next, key]) => {
  document.getElementById(prev).addEventListener("click", () => { state.pages[key]--; render(); });
  document.getElementById(next).addEventListener("click", () => { state.pages[key]++; render(); });
});

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action } = btn.dataset;
  const item = btn.closest(".drink");
  if (!item) return;
  const id = item.dataset.id;

  if (action === "fav") {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    Store.save(CFG.STORE_FAV, state.favorites);
    render();
  }
  if (action === "hide") {
    state.hidden.add(id);
    state.lastHidden = id;
    Store.save(CFG.STORE_HIDE, state.hidden);
    resetPages(); render();
    showToast("Drink hidden");
  }
});

document.getElementById("resetHide").addEventListener("click", () => {
  state.hidden.clear();
  Store.save(CFG.STORE_HIDE, state.hidden);
  state.lastHidden = null;
  resetPages(); render();
});

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function init() {
  MENU = await loadJson("menu.json");
  RECIPES = await loadJson("recipes.json");
  BASES = MENU.bases || [];
  SYRUPS = MENU.syrups || [];
  populateBaseCategoryOptions();
  renderBaseFlavorOptions();
  render();
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;font-family:system-ui;color:#fff;background:#080c10">
    <h2>Drink Shoppe failed to load</h2>
    <p>${err.message}</p>
    <p>Check that <strong>menu.json</strong> and <strong>recipes.json</strong> are included with the app.</p>
  </div>`;
});
