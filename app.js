const CFG = {
  PAGE_SIZE: 40,
  STORE_FAV: "drinkshoppe:favorites",
  STORE_HIDE: "drinkshoppe:hidden",
  STORE_MENU: "drinkshoppe:menu:override",
  STORE_SAVED: "drinkshoppe:saveddrinks"
};

const LOTUS = { name: "White Lotus", pumpsPerAdd: 1, caffeineMgPerPump: 80, emoji: "⚡" };

let BASES = [];
let SYRUPS = [];
let MENU = null;
let RECIPES = [];
let RECIPE_INDEX = new Map();

const Store = {
  loadSet(key) {
    try {
      const raw = localStorage.getItem(key);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  },
  saveSet(key, set) {
    try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
  },
  loadJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

(async () => {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {}
})();

function loadFavoritesWithMigration() {
  const keys = [
    "drinkshoppe:favorites",
    "drinkshoppe:favorites:v7",
    "drinkshoppe:favorites:v8",
    "drinkshoppe:favorites:editable:v1",
    "drinkshoppe:favorites:base44:v1"
  ];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localStorage.setItem(CFG.STORE_FAV, JSON.stringify(parsed));
        return new Set(parsed);
      }
    } catch {}
  }
  return new Set();
}

const state = {
  baseCategory: "all",
  baseFlavor: "all",
  lotusOnly: false,
  favOnly: false,
  selectedSyrups: [],
  pages: { A: 0, B: 0, C: 0 },
  favorites: loadFavoritesWithMigration(),
  hidden: Store.loadSet(CFG.STORE_HIDE),
  savedDrinks: Store.loadJson(CFG.STORE_SAVED, []),
  lastHidden: null
};

function stableHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick(arr, seed) { return arr[seed % arr.length]; }

function byOrder(a, b) {
  const ao = typeof a.order === "number" ? a.order : 9999;
  const bo = typeof b.order === "number" ? b.order : 9999;
  if (ao !== bo) return ao - bo;
  return (a.label || "").localeCompare(b.label || "");
}

function isValidMenu(m) {
  return !!(m && Array.isArray(m.categories) && Array.isArray(m.bases) && Array.isArray(m.syrups) &&
    m.categories.length && m.bases.length && m.syrups.length);
}

async function loadMenu() {
  const res = await fetch("menu.json", { cache: "no-store" });
  const fileMenu = await res.json();
  const override = Store.loadJson(CFG.STORE_MENU, null);

  if (isValidMenu(override)) return override;

  if (override && !isValidMenu(override)) {
    Store.remove(CFG.STORE_MENU);
  }

  return fileMenu;
}

async function loadRecipes() {
  const files = [
    "recipes_house.json",
    "recipes_7brew.json",
    "recipes_torani.json"
  ];

  const results = await Promise.all(
    files.map(async file => {
      try {
        const res = await fetch(file, { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.recipes)) return data.recipes;
        return [];
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}

function normalizeRecipeBaseId(baseId) {
  const id = String(baseId || "").trim().toLowerCase();

  if (["sparkling", "nt_bubble_water", "bubble_water", "fizz"].includes(id)) return "fizz";
  if (["chill_lemonade", "fruit_chill_lemonade", "chill"].includes(id)) return "chill";

  return id;
}

function normalizeSyrupIds(ids = []) {
  return ids.filter(Boolean).slice().sort();
}

function recipeKey(baseId, syrupIds, lotusRequired) {
  return `${normalizeRecipeBaseId(baseId)}|${lotusRequired ? "lotus" : "plain"}|${normalizeSyrupIds(syrupIds).join("|")}`;
}

function recipePriority(recipe) {
  const name = String(recipe?.name || "").toLowerCase();
  const source = String(recipe?.source || "").toLowerCase();

  if (name === "orange you glad it's got banana too") return 400;
  if (["the joker", "i am batman", "gotham night", "harley punch"].includes(name)) return 390;
  if (source.includes("7 brew")) return 300;
  if (source.includes("torani")) return 200;
  if (source.includes("drink shoppe")) return 100;

  return 0;
}

function applyRecipes(recipes) {
  RECIPES = Array.isArray(recipes) ? recipes.slice() : [];
  RECIPE_INDEX = new Map();

  for (const recipe of RECIPES) {
    if (!recipe?.baseId || !Array.isArray(recipe.syrupIds) || !recipe.syrupIds.length) continue;

    const key = recipeKey(recipe.baseId, recipe.syrupIds, !!recipe.lotusRequired);
    const existing = RECIPE_INDEX.get(key);

    if (!existing || recipePriority(recipe) > recipePriority(existing)) {
      RECIPE_INDEX.set(key, recipe);
    }
  }
}

function comboBaseId(c) {
  if (c.base?.category === "fizz") return "fizz";
  if (c.base?.category === "chill") return "chill";
  return c.base?.id || "";
}

function matchRecipeForCombo(c) {
  const key = recipeKey(comboBaseId(c), getDrinkSyrupIds(c), !!c.lotus);
  return RECIPE_INDEX.get(key) || null;
}
function applyMenu(menu) {
  MENU = menu;
  BASES = (menu.bases || []).filter(x => x.active !== false).slice().sort(byOrder);
  SYRUPS = (menu.syrups || []).filter(x => x.active !== false).slice().sort(byOrder);
}

function drinkId({ base, primary, secondary, tertiary, lotus }) {
  return `${base.id}|${primary.id}|${secondary ? secondary.id : ""}|${tertiary ? tertiary.id : ""}|${lotus ? "L" : "N"}`;
}
function getDrinkSyrupIds(c) {
  return [c.primary?.id, c.secondary?.id, c.tertiary?.id].filter(Boolean);
}
function matchCount(c) {
  const chosen = new Set(state.selectedSyrups);
  return getDrinkSyrupIds(c).filter(id => chosen.has(id)).length;
}
function selectedPriorityRank(c) {
  const selected = state.selectedSyrups;
  if (!selected.length) return 0;
  const ids = getDrinkSyrupIds(c);
  const matched = selected.filter(id => ids.includes(id));
  if (!matched.length) return 99;

  if (selected.length === 3) {
    if (matched.length === 3 && ids.length === 3) return 1;
    if (matched.length === 2 && ids.length === 2) return 2;
    if (matched.length === 1 && ids.length === 1) return 3;
    if (matched.length === 3) return 4;
    if (matched.length === 2) return 5;
    return 6;
  }
  if (selected.length === 2) {
    if (matched.length === 2 && ids.length === 2) return 1;
    if (matched.length === 1 && ids.length === 1) return 2;
    if (matched.length === 2) return 3;
    return 4;
  }
  if (selected.length === 1) {
    if (matched.length === 1 && ids.length === 1) return 1;
    return 2;
  }
  return 99;
}
function compareSelectedOrder(a, b) {
  const sel = state.selectedSyrups;
  const aIds = getDrinkSyrupIds(a);
  const bIds = getDrinkSyrupIds(b);
  for (let i = 0; i < sel.length; i++) {
    const av = aIds.includes(sel[i]) ? 0 : 1;
    const bv = bIds.includes(sel[i]) ? 0 : 1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function drinkName({ base, primary, secondary, tertiary, lotus }) {
  const id = drinkId({ base, primary, secondary, tertiary, lotus });
  const seed = stableHash(id);
  const v1 = pick(primary.vibe, seed);
  const lead = (secondary || tertiary) ? "🍹" : "🥤";
  const ltag = lotus ? ` ${LOTUS.emoji}` : "";
  if (!secondary) return `${lead} ${v1} ${primary.label} ${base.alias}${ltag}`;
  const v2 = pick(secondary.vibe, seed >>> 1);
  if (!tertiary) return `${lead} ${v1} ${primary.label} + ${v2} ${secondary.label} ${base.alias}${ltag}`;
  const v3 = pick(tertiary.vibe, seed >>> 2);
  return `${lead} ${v1} ${primary.label} + ${v2} ${secondary.label} + ${v3} ${tertiary.label} ${base.alias}${ltag}`;
}

function drinkRecipe({ base, primary, secondary, tertiary, lotus }) {
  const parts = [base.label, `${primary.label} (2)`];
  if (secondary) parts.push(`${secondary.label} (1)`);
  if (tertiary) parts.push(`${tertiary.label} (1)`);
  if (lotus) parts.push(`${LOTUS.name} (${LOTUS.pumpsPerAdd})`);
  return parts.join(" + ");
}

let _allCache = null;
function getAllCombos() {
  if (_allCache) return _allCache;
  const result = [];
  for (const base of BASES) {
    for (const s1 of SYRUPS) {
      result.push({ base, primary: s1, secondary: null, tertiary: null, lotus: false });
      result.push({ base, primary: s1, secondary: null, tertiary: null, lotus: true });
      for (const s2 of SYRUPS) {
        if (s1.id === s2.id) continue;
        result.push({ base, primary: s1, secondary: s2, tertiary: null, lotus: false });
        result.push({ base, primary: s1, secondary: s2, tertiary: null, lotus: true });
        for (const s3 of SYRUPS) {
          if (s1.id === s3.id || s2.id === s3.id) continue;
          result.push({ base, primary: s1, secondary: s2, tertiary: s3, lotus: false });
          result.push({ base, primary: s1, secondary: s2, tertiary: s3, lotus: true });
        }
      }
    }
  }
  _allCache = result;
  return _allCache;
}

function applyFilters(combos) {
  const { baseCategory, baseFlavor, lotusOnly, favOnly, hidden, favorites, selectedSyrups } = state;
  return combos
    .filter(c => baseCategory === "all" || c.base.category === baseCategory)
    .filter(c => baseFlavor === "all" || c.base.id === baseFlavor)
    .filter(c => lotusOnly ? c.lotus : !c.lotus)
    .filter(c => !hidden.has(drinkId(c)))
    .filter(c => !favOnly || favorites.has(drinkId(c)))
    .filter(c => {
      if (favOnly) return true;
      if (!selectedSyrups.length) return true;
      const ids = getDrinkSyrupIds(c);
      return selectedSyrups.some(s => ids.includes(s));
    })
    .map(c => {
  const id = drinkId(c);
  const matchedRecipe = matchRecipeForCombo(c);

  return {
    ...c,
    id,
    name: matchedRecipe?.name || drinkName(c),
    recipe: drinkRecipe(c),
    isFav: favorites.has(id),
    matchedRecipe
  };
})
    .sort((a, b) => {
      if (favOnly) return a.name.localeCompare(b.name);
      const ap = selectedPriorityRank(a);
      const bp = selectedPriorityRank(b);
      if (ap !== bp) return ap - bp;

      const am = matchCount(a);
      const bm = matchCount(b);
      if (am !== bm) return bm - am;

      const ao = compareSelectedOrder(a, b);
      if (ao !== 0) return ao;

      const ac = getDrinkSyrupIds(a).length;
      const bc = getDrinkSyrupIds(b).length;
      if (selectedSyrups.length > 0 && am > 0 && bm > 0 && ac !== bc) return ac - bc;

      return a.name.localeCompare(b.name);
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
      <button class="icon-btn ${d.isFav ? "fav-on" : ""}" data-action="fav" title="Favorite">${d.isFav ? "★" : "☆"}</button>
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

function renderSavedDrinks(list) {
  if (!state.savedDrinks.length) return;
  const divider = document.createElement("div");
  divider.className = "section-divider";
  divider.textContent = "Saved Drinks";
  list.appendChild(divider);

  state.savedDrinks.forEach(sd => {
    const div = document.createElement("div");
    div.className = "drink";
    div.innerHTML = `
      <div class="drink-emoji">⭐</div>
      <div class="drink-body">
        <div class="drink-name">${sd.name}</div>
        <div class="drink-tags">
          ${(sd.syrups || []).map(s => `<span class="dtag">${s}</span>`).join("")}
          ${sd.baseLabel ? `<span class="dtag">${sd.baseLabel}</span>` : ""}
        </div>
      </div>
      <div class="drink-actions">
        <button class="icon-btn" data-action="remove-saved" data-saved-id="${sd.id}" title="Remove saved drink">✕</button>
      </div>
    `;
    list.appendChild(div);
  });

  const divider2 = document.createElement("div");
  divider2.className = "section-divider";
  divider2.textContent = "Favorite Drinks";
  list.appendChild(divider2);
}

function renderColumn({ listEl, footEl, countEl, prevBtn, nextBtn, items, pageKey, includeSaved = false }) {
  const total = items.length;
  const maxPage = Math.max(0, Math.ceil(total / CFG.PAGE_SIZE) - 1);
  state.pages[pageKey] = Math.min(Math.max(state.pages[pageKey], 0), maxPage);

  const slice = items.slice(state.pages[pageKey] * CFG.PAGE_SIZE, (state.pages[pageKey] + 1) * CFG.PAGE_SIZE);

  listEl.innerHTML = "";
  if (includeSaved && state.pages[pageKey] === 0 && state.savedDrinks.length) {
    renderSavedDrinks(listEl);
  }

  if (!slice.length && !(includeSaved && state.pages[pageKey] === 0 && state.savedDrinks.length)) {
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
  const selectedIds = new Set(state.selectedSyrups);
  const selected = state.selectedSyrups.map(id => SYRUPS.find(s => s.id === id)).filter(Boolean);
  const unselected = SYRUPS.filter(s => !selectedIds.has(s.id)).slice().sort(byOrder);
  const ordered = [...selected, ...unselected];

  for (const s of ordered) {
    const btn = document.createElement("button");
    btn.className = "chip" + (selectedIds.has(s.id) ? " active" : "");
    btn.textContent = s.label;
    btn.dataset.syrupId = s.id;
    el.appendChild(btn);
  }
}

function renderBaseOptions() {
  const sel = document.getElementById("baseCategory");
  const categories = (MENU.categories || []).slice().sort(byOrder);
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

function showToast(msg) {
  const el = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 3000);
}

function resetPages() {
  state.pages = { A: 0, B: 0, C: 0 };
}

function saveCurrentDrink() {
  if (!state.selectedSyrups.length) {
    showToast("Select syrups first");
    return;
  }
  const name = prompt("Name your drink");
  if (!name || !name.trim()) return;

  const syrups = state.selectedSyrups.map(id => SYRUPS.find(s => s.id === id)?.label || id);
  const base = BASES.find(b => b.id === state.baseFlavor);
  state.savedDrinks.unshift({
    id: `saved_${Date.now()}`,
    name: name.trim(),
    syrups,
    baseLabel: base ? base.label : ""
  });
  Store.saveJson(CFG.STORE_SAVED, state.savedDrinks);
  showToast("Drink saved");
  render();
}

function render() {
  document.getElementById("lotusLabel").textContent = state.lotusOnly ? "Only Lotus" : "Exclude Lotus";
  document.getElementById("favLabel").textContent = state.favOnly ? "Only Favorites" : "All Drinks";

  const items = applyFilters(getAllCombos());
  const listA = items.filter(x => x.base.category === "soda");
  const listB = items.filter(x => x.base.category === "chill");
  const listC = items.filter(x => ["fizz", "water"].includes(x.base.category));

  const cols = [
    { sec: "secA", list: listA, key: "A", list_el: "cola", foot: "footA", ct: "cta", prev: "aPrev", next: "aNext", includeSaved: state.favOnly },
    { sec: "secB", list: listB, key: "B", list_el: "colb", foot: "footB", ct: "ctb", prev: "bPrev", next: "bNext" },
    { sec: "secC", list: listC, key: "C", list_el: "colc", foot: "footC", ct: "ctc", prev: "cPrev", next: "cNext" }
  ];

  let visible = 0;
  for (const c of cols) {
    const sec = document.getElementById(c.sec);
    if (!c.list.length && !(c.includeSaved && state.savedDrinks.length)) {
      sec.style.display = "none";
    } else {
      sec.style.display = "";
      visible++;
      renderColumn({
        listEl: document.getElementById(c.list_el),
        footEl: document.getElementById(c.foot),
        countEl: document.getElementById(c.ct),
        prevBtn: document.getElementById(c.prev),
        nextBtn: document.getElementById(c.next),
        items: c.list,
        pageKey: c.key,
        includeSaved: c.includeSaved
      });
    }
  }
  document.getElementById("grid").dataset.cols = visible <= 1 ? "1" : visible === 2 ? "2" : "3";
  renderSyrupChips();
}

document.getElementById("saveDrinkBtn").addEventListener("click", saveCurrentDrink);
document.getElementById("resetAll").addEventListener("click", () => {
  state.baseCategory = "all";
  state.baseFlavor = "all";
  state.lotusOnly = false;
  state.favOnly = false;
  state.selectedSyrups = [];
  resetPages();
  document.getElementById("baseCategory").value = "all";
  renderBaseFlavorOptions();
  document.getElementById("baseFlavor").value = "all";
  document.getElementById("lotusToggle").checked = false;
  document.getElementById("favToggle").checked = false;
  render();
});
document.getElementById("baseCategory").addEventListener("change", e => {
  state.baseCategory = e.target.value;
  renderBaseFlavorOptions();
  const matchingBases = state.baseCategory === "all" ? BASES : BASES.filter(b => b.category === state.baseCategory);
  if (matchingBases.length === 1) {
    state.baseFlavor = matchingBases[0].id;
    document.getElementById("baseFlavor").value = matchingBases[0].id;
  } else {
    state.baseFlavor = "all";
    document.getElementById("baseFlavor").value = "all";
  }
  resetPages();
  render();
});
document.getElementById("baseFlavor").addEventListener("change", e => {
  state.baseFlavor = e.target.value;
  resetPages();
  render();
});
document.getElementById("lotusToggle").addEventListener("change", e => {
  state.lotusOnly = e.target.checked;
  resetPages();
  render();
});
document.getElementById("favToggle").addEventListener("change", e => {
  state.favOnly = e.target.checked;
  resetPages();
  render();
});
document.getElementById("syrupChips").addEventListener("click", e => {
  const btn = e.target.closest("[data-syrup-id]");
  if (!btn) return;
  const id = btn.dataset.syrupId;
  const idx = state.selectedSyrups.indexOf(id);
  if (idx >= 0) {
    state.selectedSyrups.splice(idx, 1);
  } else {
    if (state.selectedSyrups.length >= 3) {
      showToast("Max 3 syrups selected");
      return;
    }
    state.selectedSyrups.push(id);
  }
  resetPages();
  render();
});

[["aPrev","aNext","A"],["bPrev","bNext","B"],["cPrev","cNext","C"]].forEach(([prev, next, key]) => {
  document.getElementById(prev).addEventListener("click", () => { state.pages[key]--; render(); });
  document.getElementById(next).addEventListener("click", () => { state.pages[key]++; render(); });
});

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action } = btn.dataset;

  if (action === "remove-saved") {
    const savedId = btn.dataset.savedId;
    state.savedDrinks = state.savedDrinks.filter(d => d.id !== savedId);
    Store.saveJson(CFG.STORE_SAVED, state.savedDrinks);
    render();
    showToast("Saved drink removed");
    return;
  }

  const item = btn.closest(".drink");
  if (!item) return;
  const id = item.dataset.id;

  if (action === "fav") {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    Store.saveSet(CFG.STORE_FAV, state.favorites);
    render();
  }
  if (action === "hide") {
    state.hidden.add(id);
    state.lastHidden = id;
    Store.saveSet(CFG.STORE_HIDE, state.hidden);
    resetPages();
    render();
    showToast("Drink hidden");
  }
});

document.getElementById("toast-undo").addEventListener("click", () => {
  if (!state.lastHidden) return;
  state.hidden.delete(state.lastHidden);
  Store.saveSet(CFG.STORE_HIDE, state.hidden);
  state.lastHidden = null;
  document.getElementById("toast").classList.remove("show");
  resetPages();
  render();
});

document.getElementById("resetFav").addEventListener("click", () => {
  state.favorites.clear();
  Store.saveSet(CFG.STORE_FAV, state.favorites);
  render();
});
document.getElementById("resetHide").addEventListener("click", () => {
  state.hidden.clear();
  Store.saveSet(CFG.STORE_HIDE, state.hidden);
  state.lastHidden = null;
  resetPages();
  render();
});

async function init() {
  const [menu, recipes] = await Promise.all([
    loadMenu(),
    loadRecipes()
  ]);

  applyMenu(menu);
  applyRecipes(recipes);

  renderBaseOptions();
  renderBaseFlavorOptions();
  render();
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;color:#fff;background:#080c10;font-family:system-ui"><h2>Drink Shoppe failed to load</h2><p>${err.message}</p></div>`;
});
