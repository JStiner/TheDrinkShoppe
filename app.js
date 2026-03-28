const CFG = {
  PAGE_SIZE: 40,
  PAGE_SIZE_ALL_BASE: 10,
  STORE_FAV: "drinkshoppe:favorites",
  STORE_HIDE: "drinkshoppe:hidden",
  STORE_MENU: "drinkshoppe:menu:override",
  STORE_SAVED: "drinkshoppe:saveddrinks",
  STORE_CUP_SIZE: "drinkshoppe:cupsizeoz"
};

let BASES = [];
let SYRUPS = [];
let LOTUS_OPTIONS = [];
let MENU = null;
let RECIPES = [];
let RECIPE_INDEX = new Map();

const DEFAULT_PRIMARY_PUMPS = 2;
const DEFAULT_SECONDARY_PUMPS = 1;
const CUP_SIZE_MULTIPLIER = { 6: 0.5, 12: 1, 18: 1.5 };

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
  selectedLotus: "none",
  favOnly: false,
  selectedSyrups: [],
  pages: { A: 0, B: 0, C: 0 },
  favorites: loadFavoritesWithMigration(),
  hidden: Store.loadSet(CFG.STORE_HIDE),
  savedDrinks: Store.loadJson(CFG.STORE_SAVED, []),
  cupSizeOz: [6, 12, 18].includes(Number(Store.loadJson(CFG.STORE_CUP_SIZE, 12))) ? Number(Store.loadJson(CFG.STORE_CUP_SIZE, 12)) : 12,
  lastHidden: null,
  currentDetailId: null
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

function migrateMenu(override, defaults) {
  if (!isValidMenu(override)) return defaults;
  const next = JSON.parse(JSON.stringify(override));
  next.categories = (next.categories || defaults.categories || []).filter(c => c.id !== "water");
  next.bases = (next.bases || defaults.bases || []).filter(b => b.category !== "water" && b.id !== "water");
  next.lotus = Array.isArray(next.lotus) && next.lotus.length ? next.lotus : JSON.parse(JSON.stringify(defaults.lotus || []));
  next.syrups = (next.syrups || []).map(s => ({ ...s, tags: Array.isArray(s.tags) ? s.tags : [] }));
  return next;
}

async function loadMenu() {
  const res = await fetch("menu.json", { cache: "no-store" });
  const fileMenu = await res.json();
  const override = Store.loadJson(CFG.STORE_MENU, null);

  if (isValidMenu(override)) return migrateMenu(override, fileMenu);
  if (override && !isValidMenu(override)) Store.remove(CFG.STORE_MENU);
  return fileMenu;
}

async function loadRecipes() {
  const sources = [
    { file: "recipes_house.json", priority: 1 },
    { file: "recipes_7brew.json", priority: 2 },
    { file: "recipes_torani.json", priority: 3 }
  ];

  const all = [];

  for (const src of sources) {
    try {
      const res = await fetch(src.file, { cache: "no-store" });
      const data = await res.json();

      const recipes = Array.isArray(data)
        ? data
        : Array.isArray(data.recipes)
        ? data.recipes
        : [];

      recipes.forEach(r => {
        all.push({
          ...r,
          _priority: src.priority
        });
      });
    } catch (err) {
      console.warn(`Skipping ${src.file}`, err);
    }
  }

  return all;
}

function applyMenu(menu) {
  MENU = menu;
  BASES = (menu.bases || []).filter(x => x.active !== false).slice().sort(byOrder);
  SYRUPS = (menu.syrups || []).filter(x => x.active !== false).map(s => ({ ...s, tags: s.tags || [] })).slice().sort(byOrder);
  LOTUS_OPTIONS = (menu.lotus || []).filter(x => x.active !== false).slice().sort(byOrder);
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeSyrupIds(ids = []) {
  return ids.filter(Boolean).map(normalizeToken).sort();
}

function recipeKey(baseToken, syrupIds, lotusRequired) {
  return `${normalizeToken(baseToken)}|${lotusRequired ? "lotus" : "plain"}|${normalizeSyrupIds(syrupIds).join("|")}`;
}

function getRecipeBaseTokens(baseId) {
  const token = normalizeToken(baseId);
  const tokens = new Set([token]);

  if (["sparkling", "bubble_water", "nt_bubble_water", "fizz"].includes(token)) {
    tokens.add("sparkling");
    tokens.add("bubble_water");
    tokens.add("nt_bubble_water");
    tokens.add("fizz");
  }

  if (["chill_lemonade", "fruit_chill_lemonade", "lemonade", "chill"].includes(token)) {
    tokens.add("chill_lemonade");
    tokens.add("fruit_chill_lemonade");
    tokens.add("lemonade");
    tokens.add("chill");
  }

  if (["energy", "lotus"].includes(token)) {
    tokens.add("energy");
    tokens.add("lotus");
    tokens.add("sparkling");
    tokens.add("bubble_water");
    tokens.add("nt_bubble_water");
    tokens.add("fizz");
  }

  return [...tokens];
}

function getComboBaseTokens(c) {
  const tokens = new Set();

  const baseId = normalizeToken(c?.base?.id);
  const category = normalizeToken(c?.base?.category);

  if (baseId) tokens.add(baseId);
  if (category) tokens.add(category);

  if (["nt_bubble_water", "bubble_water", "sparkling", "fizz"].includes(baseId) || category === "fizz") {
    tokens.add("sparkling");
    tokens.add("bubble_water");
    tokens.add("nt_bubble_water");
    tokens.add("fizz");
  }

  if (["fruit_chill_lemonade", "chill_lemonade", "lemonade"].includes(baseId) || category === "chill") {
    tokens.add("fruit_chill_lemonade");
    tokens.add("chill_lemonade");
    tokens.add("lemonade");
    tokens.add("chill");
  }

  if (c?.lotus) {
    tokens.add("energy");
    tokens.add("lotus");
    tokens.add("sparkling");
    tokens.add("bubble_water");
    tokens.add("nt_bubble_water");
    tokens.add("fizz");
  }

  return [...tokens];
}

function getRecipeSyrupSpecs(recipe) {
  if (!recipe) return [];

  if (Array.isArray(recipe.syrups) && recipe.syrups.length) {
    return recipe.syrups
      .filter(s => s && s.id)
      .map((s, idx) => ({
        id: s.id,
        pumps: typeof s.pumps === "number" && !Number.isNaN(s.pumps) ? s.pumps : (idx === 0 ? DEFAULT_PRIMARY_PUMPS : DEFAULT_SECONDARY_PUMPS)
      }));
  }

  if (Array.isArray(recipe.syrupIds) && recipe.syrupIds.length) {
    return recipe.syrupIds
      .filter(Boolean)
      .map((id, idx) => ({
        id,
        pumps: idx === 0 ? DEFAULT_PRIMARY_PUMPS : DEFAULT_SECONDARY_PUMPS
      }));
  }

  return [];
}

function getRecipeSyrupIds(recipe) {
  return getRecipeSyrupSpecs(recipe).map(s => s.id);
}

function getDefaultSyrupSpecsFromCombo(combo) {
  return [combo?.primary, combo?.secondary, combo?.tertiary]
    .filter(Boolean)
    .map((s, idx) => ({
      syrup: s,
      pumps: idx === 0 ? DEFAULT_PRIMARY_PUMPS : DEFAULT_SECONDARY_PUMPS
    }));
}

function scalePumpCount(pumps, cupSizeOz = state.cupSizeOz) {
  const multiplier = CUP_SIZE_MULTIPLIER[cupSizeOz] || 1;
  return Math.round((pumps * multiplier) * 2) / 2;
}

function formatPumpCount(pumps) {
  return Number.isInteger(pumps) ? String(pumps) : pumps.toFixed(1).replace(/\.0$/, "");
}

function formatPumpLabel(pumps) {
  return `${formatPumpCount(pumps)} pump${pumps === 1 ? "" : "s"}`;
}

function buildRecipeSyrupDetails(combo, matchedRecipe = null) {
  const defaultSpecs = getDefaultSyrupSpecsFromCombo(combo);

  if (matchedRecipe) {
    const byId = new Map(defaultSpecs.map(s => [s.syrup.id, s.syrup]));
    const recipeSpecs = getRecipeSyrupSpecs(matchedRecipe);
    const matchedSpecs = recipeSpecs
      .map(spec => ({
        syrup: byId.get(spec.id),
        pumps: spec.pumps
      }))
      .filter(spec => spec.syrup);

    if (matchedSpecs.length) return matchedSpecs;
  }

  return defaultSpecs;
}

function applyRecipes(recipes) {
  RECIPES = Array.isArray(recipes) ? recipes.slice() : [];
  RECIPE_INDEX = new Map();

  RECIPES.forEach(r => {
    const recipeSyrupIds = getRecipeSyrupIds(r);
    if (!r?.baseId || !recipeSyrupIds.length || !r.name) return;

    const baseTokens = getRecipeBaseTokens(r.baseId);
    for (const token of baseTokens) {
      RECIPE_INDEX.set(recipeKey(token, recipeSyrupIds, !!r.lotusRequired), r);
    }
  });
}

function drinkId({ base, primary, secondary, tertiary, lotus }) {
  return `${base.id}|${primary.id}|${secondary ? secondary.id : ""}|${tertiary ? tertiary.id : ""}|${lotus ? lotus.id : "none"}`;
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

function lotusScore(base, syrups, lotus) {
  if (!lotus || !base || base.category === "soda") return -999;
  const tags = new Set();
  syrups.forEach(s => (s.tags || []).forEach(t => tags.add(t)));

  let score = base.category === "fizz" ? 2 : 1;
  if (lotus.family === "white") score += 2;

  for (const tag of tags) {
    if ((lotus.pairsWellWith || []).includes(tag)) score += 3;
    if ((lotus.avoidWith || []).includes(tag)) score -= 4;
  }

  if (tags.has("dessert") || tags.has("spice")) score -= 2;
  return score;
}

function drinkName({ base, primary, secondary, tertiary }) {
  const id = drinkId({ base, primary, secondary, tertiary, lotus: null });
  const seed = stableHash(id);
  const v1 = pick(primary.vibe, seed);
  const v2 = secondary ? pick(secondary.vibe, seed >>> 1) : null;
  const v3 = tertiary ? pick(tertiary.vibe, seed >>> 2) : null;
  const lead = (secondary || tertiary) ? "🍹" : "🥤";
  const words = [v1, v2, v3].filter(Boolean);

  if (base.id === "nt_dr") return `${lead} Dr. ${words.join(" ")}`;
  return `${lead} ${words.join(" ")} ${base.alias}`.replace(/\s+/g, " ").trim();
}

function drinkRecipe({ base, primary, secondary, tertiary, lotus }, matchedRecipe = null) {
  const syrupDetails = buildRecipeSyrupDetails({ base, primary, secondary, tertiary, lotus }, matchedRecipe);

  const parts = [base.label];

  syrupDetails.forEach(({ syrup, pumps }) => {
    parts.push(`${syrup.label} (${formatPumpCount(scalePumpCount(pumps))})`);
  });

  if (lotus) parts.push(`${lotus.label} (${formatPumpCount(scalePumpCount(1))})`);

  return parts.join(" + ");
}

function matchRecipeForCombo(c) {
  const syrupIds = getDrinkSyrupIds(c);
  const baseTokens = getComboBaseTokens(c);

  for (const token of baseTokens) {
    const key = recipeKey(token, syrupIds, !!c.lotus);
    const match = RECIPE_INDEX.get(key);
    if (match) return match;
  }

  return null;
}

function labelMap(items) {
  const map = new Map();
  items.forEach(item => {
    if (!item?.label) return;
    map.set(item.label.trim().toLowerCase(), item.id);
  });
  return map;
}

function migrateSavedDrinks() {
  const syrupByLabel = labelMap(SYRUPS);
  const baseByLabel = labelMap(BASES);
  const lotusByLabel = labelMap(LOTUS_OPTIONS);
  let changed = false;

  state.savedDrinks = (state.savedDrinks || []).map(sd => {
    if (sd?.baseId && Array.isArray(sd?.syrupIds)) return sd;
    const syrupIds = Array.isArray(sd?.syrups)
      ? sd.syrups.map(label => syrupByLabel.get(String(label).trim().toLowerCase())).filter(Boolean)
      : [];
    const baseId = sd?.baseLabel ? baseByLabel.get(String(sd.baseLabel).trim().toLowerCase()) || null : null;
    const lotusId = sd?.lotusLabel ? lotusByLabel.get(String(sd.lotusLabel).trim().toLowerCase()) || null : null;
    changed = true;
    return {
      id: sd?.id || `saved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: sd?.name || "Saved Drink",
      syrupIds,
      baseId,
      lotusId
    };
  }).filter(sd => sd && sd.baseId && Array.isArray(sd.syrupIds) && sd.syrupIds.length);

  if (changed) Store.saveJson(CFG.STORE_SAVED, state.savedDrinks);
}

function buildCombo(baseId, syrupIds, lotusId = null) {
  const base = BASES.find(b => b.id === baseId);
  const syrups = (syrupIds || []).map(id => SYRUPS.find(s => s.id === id)).filter(Boolean);
  const lotus = lotusId ? LOTUS_OPTIONS.find(l => l.id === lotusId) || null : null;
  if (!base || !syrups.length) return null;
  return {
    base,
    primary: syrups[0],
    secondary: syrups[1] || null,
    tertiary: syrups[2] || null,
    lotus,
    lotusScore: lotus ? lotusScore(base, syrups, lotus) : 0
  };
}

function savedDrinkToItem(sd) {
  const combo = buildCombo(sd.baseId, sd.syrupIds, sd.lotusId || null);
  if (!combo) return null;
  const matchedRecipe = matchRecipeForCombo(combo);
  return {
    ...combo,
    id: `saved:${sd.id}`,
    savedId: sd.id,
    isSavedDrink: true,
    name: sd.name || matchedRecipe?.name || drinkName(combo),
    generatedName: drinkName(combo),
    recipe: drinkRecipe(combo,matchedRecipe),
    isFav: true,
    matchedRecipe,
    sourceTag: matchedRecipe ? `${matchedRecipe.source || "Recipe"}${matchedRecipe.collection ? ` · ${matchedRecipe.collection}` : ""}` : "MY DRINK"
  };
}

function ingredientEmoji(label, id = "") {
  const key = `${id} ${label}`.toLowerCase();

  if (key.includes("bubble") || key.includes("fizz")) return "🫧";
  if (key.includes("lemonade")) return "🍋";
  if (key.includes("cola")) return "🥤";
  if (key.includes("root")) return "🍺";
  if (key.includes("dr")) return "🥤";
  if (key.includes("lotus")) return "⚡";
  if (key.includes("strawberry")) return "🍓";
  if (key.includes("raspberry")) return "🫐";
  if (key.includes("blackberry")) return "🫐";
  if (key.includes("blue_raspberry") || key.includes("blue raspberry")) return "🟦";
  if (key.includes("orange")) return "🍊";
  if (key.includes("peach")) return "🍑";
  if (key.includes("coconut")) return "🥥";
  if (key.includes("cherry")) return "🍒";
  if (key.includes("almond")) return "🌰";
  if (key.includes("vanilla")) return "🍦";
  if (key.includes("pomegranate")) return "🍷";
  if (key.includes("brown_sugar_cinnamon")) return "🧁";

  return "🍹";
}

function detailLookupItems() {
  const comboItems = applyFilters(getAllCombos());
  const savedItems = (state.savedDrinks || []).map(savedDrinkToItem).filter(Boolean);
  return [...savedItems, ...comboItems];
}

function getDrinkById(id) {
  return detailLookupItems().find(d => d.id === id) || null;
}

function getDrinkIngredients(d) {
  const syrupDetails = buildRecipeSyrupDetails(d, d.matchedRecipe);

  const list = [
    { label: d.base.label, id: d.base.id, amount: `${state.cupSizeOz} oz base` }
  ];

  syrupDetails.forEach(({ syrup, pumps }) => {
    list.push({
      label: syrup.label,
      id: syrup.id,
      amount: formatPumpLabel(scalePumpCount(pumps))
    });
  });

  if (d.lotus) {
    list.push({
      label: d.lotus.label,
      id: d.lotus.id,
      amount: formatPumpLabel(scalePumpCount(1))
    });
  }

  return list;
}

function openDrinkDetail(id) {
  const d = getDrinkById(id);
  state.currentDetailId = d ? id : null;
  if (!d) return;

  const detail = document.getElementById("drinkDetail");
  const nameEl = document.getElementById("drinkDetailName");
  const emojiEl = document.getElementById("drinkDetailEmoji");
  const srcEl = document.getElementById("drinkDetailSource");
  const ingredientsEl = document.getElementById("drinkDetailIngredients");
  const recipeEl = document.getElementById("drinkDetailRecipe");
  const favBtn = document.getElementById("drinkDetailFav");

  if (!detail || !nameEl || !emojiEl || !srcEl || !ingredientsEl || !recipeEl || !favBtn) {
    return;
  }

  nameEl.textContent = d.name;
  emojiEl.textContent = d.base.emoji || "🥤";
  srcEl.textContent = d.sourceTag || (d.isSavedDrink ? "My Drink" : "");
  recipeEl.textContent = d.recipe;

  ingredientsEl.innerHTML = "";
  getDrinkIngredients(d).forEach(item => {
    const row = document.createElement("div");
    row.className = "drink-ingredient";
    row.innerHTML = `
      <div class="drink-ingredient-emoji">${ingredientEmoji(item.label, item.id)}</div>
      <div>${item.label}</div>
      <div style="margin-left:auto; opacity:.75;">${item.amount}</div>
    `;
    ingredientsEl.appendChild(row);
  });

  if (d.isSavedDrink) {
    favBtn.classList.add("fav-on");
    favBtn.textContent = "★";
    favBtn.disabled = true;
    delete favBtn.dataset.drinkId;
  } else {
    const isFav = state.favorites.has(d.id);
    favBtn.disabled = false;
    favBtn.dataset.drinkId = d.id;
    favBtn.classList.toggle("fav-on", isFav);
    favBtn.textContent = isFav ? "★" : "☆";
  }

  detail.dataset.drinkId = d.id;
  detail.classList.remove("hidden");
  detail.setAttribute("aria-hidden", "false");
}

function closeDrinkDetail() {
  const detail = document.getElementById("drinkDetail");
  if (!detail) return;
  detail.classList.add("hidden");
  detail.setAttribute("aria-hidden", "true");
  delete detail.dataset.drinkId;
}

let _allCache = null;
function getAllCombos() {
  if (_allCache) return _allCache;
  const result = [];

  for (const base of BASES) {
    for (let i = 0; i < SYRUPS.length; i++) {
      const s1 = SYRUPS[i];

      result.push({ base, primary: s1, secondary: null, tertiary: null, lotus: null, lotusScore: 0 });

      if (base.category !== "soda") {
        for (const lotus of LOTUS_OPTIONS) {
          const score = lotusScore(base, [s1], lotus);
          if (score > 0) result.push({ base, primary: s1, secondary: null, tertiary: null, lotus, lotusScore: score });
        }
      }

      for (let j = i + 1; j < SYRUPS.length; j++) {
        const s2 = SYRUPS[j];

        result.push({ base, primary: s1, secondary: s2, tertiary: null, lotus: null, lotusScore: 0 });

        if (base.category !== "soda") {
          for (const lotus of LOTUS_OPTIONS) {
            const score = lotusScore(base, [s1, s2], lotus);
            if (score > 0) result.push({ base, primary: s1, secondary: s2, tertiary: null, lotus, lotusScore: score });
          }
        }

        for (let k = j + 1; k < SYRUPS.length; k++) {
          const s3 = SYRUPS[k];

          result.push({ base, primary: s1, secondary: s2, tertiary: s3, lotus: null, lotusScore: 0 });

          if (base.category !== "soda") {
            for (const lotus of LOTUS_OPTIONS) {
              const score = lotusScore(base, [s1, s2, s3], lotus);
              if (score > 0) result.push({ base, primary: s1, secondary: s2, tertiary: s3, lotus, lotusScore: score });
            }
          }
        }
      }
    }
  }

  _allCache = result;
  return _allCache;
}

function applyFilters(combos) {
  const { baseCategory, baseFlavor, selectedLotus, favOnly, hidden, favorites, selectedSyrups } = state;

  const mapped = combos
    .filter(c => baseCategory === "all" || c.base.category === baseCategory)
    .filter(c => baseFlavor === "all" || c.base.id === baseFlavor)
    .filter(c => selectedLotus === "none" ? !c.lotus : c.lotus?.id === selectedLotus)
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
        generatedName: drinkName(c),
        name: matchedRecipe?.name || drinkName(c),
        recipe: drinkRecipe(c,matchedRecipe),
        isFav: favorites.has(id),
        matchedRecipe,
        sourceTag: matchedRecipe ? `${matchedRecipe.source || "Recipe"}${matchedRecipe.collection ? ` · ${matchedRecipe.collection}` : ""}` : ""
      };
    });

  const seenRecipes = new Set();

  const filtered = mapped.filter(c => {
    if (!c.matchedRecipe) return true;

    const key = c.matchedRecipe.id;
    if (seenRecipes.has(key)) return false;

    seenRecipes.add(key);
    return true;
  });

  return filtered.sort((a, b) => {
    if (a.isFav && !b.isFav) return -1;
    if (!a.isFav && b.isFav) return 1;

    if (a.matchedRecipe && !b.matchedRecipe) return -1;
    if (!a.matchedRecipe && b.matchedRecipe) return 1;

    if (favOnly) return a.name.localeCompare(b.name);

    const ap = selectedPriorityRank(a);
    const bp = selectedPriorityRank(b);
    if (ap !== bp) return ap - bp;

    const am = matchCount(a);
    const bm = matchCount(b);
    if (am !== bm) return bm - am;

    if (state.selectedLotus !== "none" && a.lotusScore !== b.lotusScore) return b.lotusScore - a.lotusScore;

    const ao = compareSelectedOrder(a, b);
    if (ao !== 0) return ao;

    const ac = getDrinkSyrupIds(a).length;
    const bc = getDrinkSyrupIds(b).length;
    if (selectedSyrups.length > 0 && am > 0 && bm > 0 && ac !== bc) return ac - bc;

    return a.name.localeCompare(b.name);
  });
}

function renderItem(d) {
  const specific = (state.baseFlavor !== "all") || (state.baseCategory !== "all") || state.selectedLotus !== "none";
  const div = document.createElement("div");
  div.className = "drink";
  div.dataset.id = d.id;

  let actionsHtml = "";
  if (d.isSavedDrink) {
    actionsHtml = `<button class="icon-btn" data-action="remove-saved" data-saved-id="${d.savedId}" title="Remove saved drink">✕</button>`;
  } else if (specific) {
    actionsHtml = `
      <button class="icon-btn ${d.isFav ? "fav-on" : ""}" data-action="fav" title="Favorite">${d.isFav ? "★" : "☆"}</button>
      <button class="icon-btn" data-action="hide" title="Hide drink">✕</button>
    `;
  }

  div.innerHTML = `
    <div class="drink-body" data-action="open-detail" data-drink-id="${d.id}">
      <div class="drink-name">${d.name}</div>
      <div class="drink-tags">
        <span class="dtag">${d.recipe}</span>
        <span class="dtag">${d.base.category.toUpperCase()}</span>
        ${d.lotus ? `<span class="dtag lotus">⚡ ${d.lotus.label}</span>` : ""}
        ${d.sourceTag ? `<span class="dtag">${d.sourceTag}</span>` : ""}
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

  state.savedDrinks
    .map(savedDrinkToItem)
    .filter(Boolean)
    .forEach(item => list.appendChild(renderItem(item)));

  const divider2 = document.createElement("div");
  divider2.className = "section-divider";
  divider2.textContent = "Favorite Drinks";
  list.appendChild(divider2);
}

function getPageSize() {
  return state.baseCategory === 'all' ? CFG.PAGE_SIZE_ALL_BASE : CFG.PAGE_SIZE;
}

function renderColumn({ listEl, footEl, countEl, prevBtn, nextBtn, items, pageKey, includeSaved = false }) {
  const pageSize = getPageSize();
  const total = items.length;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  state.pages[pageKey] = Math.min(Math.max(state.pages[pageKey], 0), maxPage);

  const slice = items.slice(state.pages[pageKey] * pageSize, (state.pages[pageKey] + 1) * pageSize);

  listEl.innerHTML = "";
  if (includeSaved && state.pages[pageKey] === 0 && state.savedDrinks.length) renderSavedDrinks(listEl);

  if (!slice.length && !(includeSaved && state.pages[pageKey] === 0 && state.savedDrinks.length)) {
    listEl.innerHTML = `<div class="empty"><div class="empty-icon">🥤</div><div class="empty-msg">No drinks match your filters</div></div>`;
  } else {
    slice.forEach(d => listEl.appendChild(renderItem(d)));
  }

  countEl.textContent = `${total} · pg ${state.pages[pageKey] + 1}/${maxPage + 1}`;
  prevBtn.disabled = state.pages[pageKey] <= 0;
  nextBtn.disabled = state.pages[pageKey] >= maxPage;
  footEl.style.display = total > pageSize ? "flex" : "none";
}

function renderSyrupChips() {
  const el = document.getElementById("syrupChips");
  if (!el) return;
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
  if (!sel) return;
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
  if (!sel) return;
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

function renderLotusOptions() {
  const sel = document.getElementById("lotusSelect");
  if (!sel) return;
  const prev = state.selectedLotus;
  sel.innerHTML = `<option value="none">No Lotus</option>`;
  LOTUS_OPTIONS.forEach(l => {
    const o = document.createElement("option");
    o.value = l.id;
    o.textContent = l.label;
    sel.appendChild(o);
  });
  sel.value = [...sel.options].some(o => o.value === prev) ? prev : "none";
  state.selectedLotus = sel.value;
}

function setCupSizePickerOpen(isOpen) {
  const picker = document.getElementById("cupSizePicker");
  const badge = document.getElementById("cupSizeBadge");
  if (picker) picker.classList.toggle("open", !!isOpen);
  if (badge) badge.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function renderCupSizeControls() {
  const badge = document.getElementById("cupSizeBadge");
  if (badge) badge.textContent = `🍹 ${state.cupSizeOz}oz Glass`;

  const buttons = document.querySelectorAll("[data-cup-size]");
  buttons.forEach(btn => {
    const size = Number(btn.dataset.cupSize);
    const active = size === state.cupSizeOz;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setCupSize(size) {
  if (![6, 12, 18].includes(size) || size === state.cupSizeOz) return;
  state.cupSizeOz = size;
  Store.saveJson(CFG.STORE_CUP_SIZE, size);
  renderCupSizeControls();
  render();
  if (state.currentDetailId) openDrinkDetail(state.currentDetailId);
}

function showToast(msg) {
  const el = document.getElementById("toast");
  const msgEl = document.getElementById("toast-msg");
  if (!el || !msgEl) return;
  msgEl.textContent = msg;
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
  if (state.baseFlavor === "all") {
    showToast("Choose a specific base first");
    return;
  }
  const base = BASES.find(b => b.id === state.baseFlavor);
  if (!base) {
    showToast("Choose a specific base first");
    return;
  }
  const name = prompt("Name your drink");
  if (!name || !name.trim()) return;

  const lotus = state.selectedLotus === "none" ? null : LOTUS_OPTIONS.find(l => l.id === state.selectedLotus) || null;
  state.savedDrinks.unshift({
    id: `saved_${Date.now()}`,
    name: name.trim(),
    syrupIds: [...state.selectedSyrups],
    baseId: base.id,
    lotusId: lotus?.id || null
  });
  Store.saveJson(CFG.STORE_SAVED, state.savedDrinks);
  showToast("Drink saved");
  render();
}

function render() {
  const favLabel = document.getElementById("favLabel");
  if (favLabel) favLabel.textContent = state.favOnly ? "Only Favorites" : "All Drinks";

  const items = applyFilters(getAllCombos());
  const listA = items.filter(x => x.base.category === "soda");
  const listB = items.filter(x => x.base.category === "chill");
  const listC = items.filter(x => x.base.category === "fizz");

  const cols = [
    { sec: "secA", list: listA, key: "A", list_el: "cola", foot: "footA", ct: "cta", prev: "aPrev", next: "aNext", includeSaved: state.favOnly },
    { sec: "secB", list: listB, key: "B", list_el: "colb", foot: "footB", ct: "ctb", prev: "bPrev", next: "bNext" },
    { sec: "secC", list: listC, key: "C", list_el: "colc", foot: "footC", ct: "ctc", prev: "cPrev", next: "cNext" }
  ];

  let visible = 0;
  for (const c of cols) {
    const sec = document.getElementById(c.sec);
    if (!sec) continue;
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
  const grid = document.getElementById("grid");
  if (grid) grid.dataset.cols = visible <= 1 ? "1" : visible === 2 ? "2" : "3";
  renderSyrupChips();
}

const cupSizeBadgeBtn = document.getElementById("cupSizeBadge");
if (cupSizeBadgeBtn) cupSizeBadgeBtn.addEventListener("click", () => {
  const wrap = document.getElementById("cupSizePicker");
  setCupSizePickerOpen(!(wrap && wrap.classList.contains("open")));
});

const cupSizePickerEl = document.getElementById("cupSizePicker");
if (cupSizePickerEl) cupSizePickerEl.addEventListener("click", e => {
  const btn = e.target.closest("[data-cup-size]");
  if (!btn) return;
  setCupSize(Number(btn.dataset.cupSize));
  setCupSizePickerOpen(false);
});

document.addEventListener("click", e => {
  const picker = document.getElementById("cupSizePicker");
  const badge = document.getElementById("cupSizeBadge");
  if (!picker || !badge) return;
  if (picker.contains(e.target) || badge.contains(e.target)) return;
  setCupSizePickerOpen(false);
});

const saveDrinkBtn = document.getElementById("saveDrinkBtn");
if (saveDrinkBtn) saveDrinkBtn.addEventListener("click", saveCurrentDrink);

const resetAllBtn = document.getElementById("resetAll");
if (resetAllBtn) resetAllBtn.addEventListener("click", () => {
  state.baseCategory = "all";
  state.baseFlavor = "all";
  state.selectedLotus = "none";
  state.favOnly = false;
  state.selectedSyrups = [];
  resetPages();
  const baseCategoryEl = document.getElementById("baseCategory");
  const baseFlavorEl = document.getElementById("baseFlavor");
  const lotusSelectEl = document.getElementById("lotusSelect");
  const favToggleEl = document.getElementById("favToggle");
  if (baseCategoryEl) baseCategoryEl.value = "all";
  renderBaseFlavorOptions();
  if (baseFlavorEl) baseFlavorEl.value = "all";
  if (lotusSelectEl) lotusSelectEl.value = "none";
  if (favToggleEl) favToggleEl.checked = false;
  render();
});

const baseCategoryEl = document.getElementById("baseCategory");
if (baseCategoryEl) baseCategoryEl.addEventListener("change", e => {
  state.baseCategory = e.target.value;
  renderBaseFlavorOptions();
  const matchingBases = state.baseCategory === "all" ? BASES : BASES.filter(b => b.category === state.baseCategory);
  const baseFlavorEl = document.getElementById("baseFlavor");
  if (matchingBases.length === 1) {
    state.baseFlavor = matchingBases[0].id;
    if (baseFlavorEl) baseFlavorEl.value = matchingBases[0].id;
  } else {
    state.baseFlavor = "all";
    if (baseFlavorEl) baseFlavorEl.value = "all";
  }
  resetPages();
  render();
});

const baseFlavorEl2 = document.getElementById("baseFlavor");
if (baseFlavorEl2) baseFlavorEl2.addEventListener("change", e => {
  state.baseFlavor = e.target.value;
  resetPages();
  render();
});

const lotusSelectEl2 = document.getElementById("lotusSelect");
if (lotusSelectEl2) lotusSelectEl2.addEventListener("change", e => {
  state.selectedLotus = e.target.value;
  resetPages();
  render();
});

const favToggleEl2 = document.getElementById("favToggle");
if (favToggleEl2) favToggleEl2.addEventListener("change", e => {
  state.favOnly = e.target.checked;
  resetPages();
  render();
});

const syrupChipsEl = document.getElementById("syrupChips");
if (syrupChipsEl) syrupChipsEl.addEventListener("click", e => {
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

[["aPrev", "aNext", "A"], ["bPrev", "bNext", "B"], ["cPrev", "cNext", "C"]].forEach(([prev, next, key]) => {
  const prevEl = document.getElementById(prev);
  const nextEl = document.getElementById(next);
  if (prevEl) prevEl.addEventListener("click", () => { state.pages[key]--; render(); });
  if (nextEl) nextEl.addEventListener("click", () => { state.pages[key]++; render(); });
});

document.addEventListener("click", e => {
  const openTarget = e.target.closest('[data-action="open-detail"]');
  if (openTarget) {
    openDrinkDetail(openTarget.dataset.drinkId);
    return;
  }

  const backBtn = e.target.closest("#drinkDetailBack");
  if (backBtn) {
    closeDrinkDetail();
    return;
  }

  const favBtn = e.target.closest("#drinkDetailFav");
  if (favBtn) {
    const id = favBtn.dataset.drinkId;
    if (!id) return;

    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }

    Store.saveSet(CFG.STORE_FAV, state.favorites);
    render();
    openDrinkDetail(id);
    return;
  }

  const overlay = e.target.closest("#drinkDetail");
  if (overlay && e.target.id === "drinkDetail") {
    closeDrinkDetail();
    return;
  }

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

const toastUndoEl = document.getElementById("toast-undo");
if (toastUndoEl) toastUndoEl.addEventListener("click", () => {
  if (!state.lastHidden) return;
  state.hidden.delete(state.lastHidden);
  Store.saveSet(CFG.STORE_HIDE, state.hidden);
  state.lastHidden = null;
  const toastEl = document.getElementById("toast");
  if (toastEl) toastEl.classList.remove("show");
  resetPages();
  render();
});

const resetFavEl = document.getElementById("resetFav");
if (resetFavEl) resetFavEl.addEventListener("click", () => {
  state.favorites.clear();
  Store.saveSet(CFG.STORE_FAV, state.favorites);
  render();
});

const resetHideEl = document.getElementById("resetHide");
if (resetHideEl) resetHideEl.addEventListener("click", () => {
  state.hidden.clear();
  Store.saveSet(CFG.STORE_HIDE, state.hidden);
  state.lastHidden = null;
  resetPages();
  render();
});

async function init() {
  const [menu, recipes] = await Promise.all([loadMenu(), loadRecipes()]);
  applyMenu(menu);
  applyRecipes(recipes);
  migrateSavedDrinks();
  renderBaseOptions();
  renderBaseFlavorOptions();
  renderLotusOptions();
  renderCupSizeControls();
  render();
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;color:#fff;background:#080c10;font-family:system-ui"><h2>Drink Shoppe failed to load</h2><p>${err.message}</p></div>`;
});
