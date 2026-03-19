const CFG = {
  STORE_MENU: "drinkshoppe:menu:override"
};

const Store = {
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

let defaultMenu = null;
let menu = null;
let activeTab = "syrups";

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function splitList(value) {
  return value.split(",").map(x => x.trim()).filter(Boolean);
}
function isValidMenu(m) {
  return !!(m && Array.isArray(m.categories) && Array.isArray(m.bases) && Array.isArray(m.syrups) && m.categories.length && m.bases.length && m.syrups.length);
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
async function loadDefaultMenu() {
  const res = await fetch("menu.json", { cache: "no-store" });
  return res.json();
}
function persist() {
  Store.saveJson(CFG.STORE_MENU, menu);
}
function syncTabs() {
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === activeTab));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${activeTab}`));
}

function renderCategoriesSelect() {
  const sel = document.getElementById("addBaseCategory");
  sel.innerHTML = "";
  (menu.categories || []).forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
}

function renderSyrups() {
  const list = document.getElementById("syrupsList");
  list.innerHTML = "";
  (menu.syrups || []).forEach(s => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="main">
        <div class="emoji">🍯</div>
        <div>
          <div class="name">${s.label}</div>
          <div class="meta">tags: ${(s.tags || []).join(", ") || "—"} · vibes: ${(s.vibe || []).join(", ")}</div>
        </div>
      </div>
      <label class="sw">
        <input type="checkbox" data-s-toggle="${s.id}" ${s.active !== false ? "checked" : ""}>
        <span class="sw-track"></span><span class="sw-thumb"></span>
      </label>
      <button class="icon" data-s-edit="${s.id}">✎</button>
      <button class="icon red" data-s-del="${s.id}">🗑</button>
    `;
    list.appendChild(item);
  });
}

function renderBases() {
  const list = document.getElementById("basesList");
  list.innerHTML = "";
  (menu.bases || []).forEach(b => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="main">
        <div class="emoji">${b.emoji || "🥤"}</div>
        <div>
          <div class="name">${b.label}</div>
          <div class="meta">${b.category} · alias: ${b.alias || ""}</div>
        </div>
      </div>
      <label class="sw">
        <input type="checkbox" data-b-toggle="${b.id}" ${b.active !== false ? "checked" : ""}>
        <span class="sw-track"></span><span class="sw-thumb"></span>
      </label>
      <button class="icon" data-b-edit="${b.id}">✎</button>
      <button class="icon red" data-b-del="${b.id}">🗑</button>
    `;
    list.appendChild(item);
  });
}

function renderLotus() {
  const list = document.getElementById("lotusList");
  list.innerHTML = "";
  (menu.lotus || []).forEach(l => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="main">
        <div class="emoji">⚡</div>
        <div>
          <div class="name">${l.label}</div>
          <div class="meta">family: ${l.family || "—"} · color: ${l.color || "—"} · pairs: ${(l.pairsWellWith || []).join(", ") || "—"}</div>
        </div>
      </div>
      <label class="sw">
        <input type="checkbox" data-l-toggle="${l.id}" ${l.active !== false ? "checked" : ""}>
        <span class="sw-track"></span><span class="sw-thumb"></span>
      </label>
      <button class="icon" data-l-edit="${l.id}">✎</button>
      <button class="icon red" data-l-del="${l.id}">🗑</button>
    `;
    list.appendChild(item);
  });
}

function renderAll() {
  renderCategoriesSelect();
  renderSyrups();
  renderBases();
  renderLotus();
  syncTabs();
}

function addSyrup() {
  const label = document.getElementById("addSyrupLabel").value.trim();
  const vibeText = document.getElementById("addSyrupVibes").value.trim();
  const tagsText = document.getElementById("addSyrupTags").value.trim();
  if (!label) return;
  const id = slugify(label);
  if ((menu.syrups || []).some(s => s.id === id)) return;
  const vibe = vibeText ? splitList(vibeText) : ["Bright","Sweet","Classic"];
  const tags = tagsText ? splitList(tagsText) : [];
  menu.syrups.push({ id, label, vibe, tags, active: true });
  persist();
  document.getElementById("addSyrupLabel").value = "";
  document.getElementById("addSyrupVibes").value = "";
  document.getElementById("addSyrupTags").value = "";
  renderSyrups();
}

function addBase() {
  const label = document.getElementById("addBaseLabel").value.trim();
  const alias = document.getElementById("addBaseAlias").value.trim();
  const category = document.getElementById("addBaseCategory").value;
  const emoji = document.getElementById("addBaseEmoji").value.trim() || "🥤";
  if (!label || !alias) return;
  const id = slugify(label);
  if ((menu.bases || []).some(b => b.id === id)) return;
  menu.bases.push({ id, label, category, emoji, alias, active: true });
  persist();
  document.getElementById("addBaseLabel").value = "";
  document.getElementById("addBaseAlias").value = "";
  document.getElementById("addBaseEmoji").value = "";
  renderBases();
}

function addLotus() {
  const label = document.getElementById("addLotusLabel").value.trim();
  const family = document.getElementById("addLotusFamily").value.trim();
  const color = document.getElementById("addLotusColor").value.trim();
  const pairs = document.getElementById("addLotusPairs").value.trim();
  const vibes = document.getElementById("addLotusVibes").value.trim();
  if (!label) return;
  const id = slugify(label);
  if ((menu.lotus || []).some(l => l.id === id)) return;
  menu.lotus = menu.lotus || [];
  menu.lotus.push({
    id,
    label,
    family: family || id,
    color: color || "clear",
    flavorNotes: [],
    pairsWellWith: splitList(pairs),
    avoidWith: ["cola", "rootbeer", "spice"],
    vibe: vibes ? splitList(vibes) : ["Bright", "Glow", "Pulse"],
    active: true
  });
  persist();
  document.getElementById("addLotusLabel").value = "";
  document.getElementById("addLotusFamily").value = "";
  document.getElementById("addLotusColor").value = "";
  document.getElementById("addLotusPairs").value = "";
  document.getElementById("addLotusVibes").value = "";
  renderLotus();
}

document.addEventListener("click", e => {
  const tab = e.target.closest("[data-tab]");
  if (tab) { activeTab = tab.dataset.tab; syncTabs(); }

  const st = e.target.closest("[data-s-toggle]");
  if (st) {
    const s = menu.syrups.find(x => x.id === st.dataset.sToggle);
    if (s) { s.active = e.target.checked; persist(); }
  }
  const bt = e.target.closest("[data-b-toggle]");
  if (bt) {
    const b = menu.bases.find(x => x.id === bt.dataset.bToggle);
    if (b) { b.active = e.target.checked; persist(); }
  }
  const lt = e.target.closest("[data-l-toggle]");
  if (lt) {
    const l = menu.lotus.find(x => x.id === lt.dataset.lToggle);
    if (l) { l.active = e.target.checked; persist(); }
  }

  const se = e.target.closest("[data-s-edit]");
  if (se) {
    const s = menu.syrups.find(x => x.id === se.dataset.sEdit);
    if (s) {
      const label = prompt("Syrup name", s.label);
      if (label !== null && label.trim()) s.label = label.trim();
      const vibe = prompt("Vibe words (comma separated)", (s.vibe || []).join(", "));
      if (vibe !== null) s.vibe = splitList(vibe);
      const tags = prompt("Tags (comma separated)", (s.tags || []).join(", "));
      if (tags !== null) s.tags = splitList(tags);
      persist(); renderSyrups();
    }
  }

  const be = e.target.closest("[data-b-edit]");
  if (be) {
    const b = menu.bases.find(x => x.id === be.dataset.bEdit);
    if (b) {
      const label = prompt("Base name", b.label);
      if (label !== null && label.trim()) b.label = label.trim();
      const alias = prompt("Alias", b.alias || "");
      if (alias !== null && alias.trim()) b.alias = alias.trim();
      const emoji = prompt("Emoji", b.emoji || "🥤");
      if (emoji !== null && emoji.trim()) b.emoji = emoji.trim();
      persist(); renderBases();
    }
  }

  const le = e.target.closest("[data-l-edit]");
  if (le) {
    const l = menu.lotus.find(x => x.id === le.dataset.lEdit);
    if (l) {
      const label = prompt("Lotus name", l.label);
      if (label !== null && label.trim()) l.label = label.trim();
      const family = prompt("Family", l.family || "");
      if (family !== null && family.trim()) l.family = family.trim();
      const color = prompt("Color", l.color || "");
      if (color !== null && color.trim()) l.color = color.trim();
      const notes = prompt("Flavor notes (comma separated)", (l.flavorNotes || []).join(", "));
      if (notes !== null) l.flavorNotes = splitList(notes);
      const pairs = prompt("Pairs well with tags (comma separated)", (l.pairsWellWith || []).join(", "));
      if (pairs !== null) l.pairsWellWith = splitList(pairs);
      const avoid = prompt("Avoid tags (comma separated)", (l.avoidWith || []).join(", "));
      if (avoid !== null) l.avoidWith = splitList(avoid);
      const vibes = prompt("Vibe words (comma separated)", (l.vibe || []).join(", "));
      if (vibes !== null) l.vibe = splitList(vibes);
      persist(); renderLotus();
    }
  }

  const sd = e.target.closest("[data-s-del]");
  if (sd) {
    menu.syrups = menu.syrups.filter(x => x.id !== sd.dataset.sDel);
    persist(); renderSyrups();
  }

  const bd = e.target.closest("[data-b-del]");
  if (bd) {
    menu.bases = menu.bases.filter(x => x.id !== bd.dataset.bDel);
    persist(); renderBases();
  }

  const ld = e.target.closest("[data-l-del]");
  if (ld) {
    menu.lotus = menu.lotus.filter(x => x.id !== ld.dataset.lDel);
    persist(); renderLotus();
  }
});

document.getElementById("addSyrupBtn").addEventListener("click", addSyrup);
document.getElementById("addBaseBtn").addEventListener("click", addBase);
document.getElementById("addLotusBtn").addEventListener("click", addLotus);
document.getElementById("backBtn").addEventListener("click", () => location.href = "index.html");
document.getElementById("resetDefaultsBtn").addEventListener("click", () => {
  Store.remove(CFG.STORE_MENU);
  menu = JSON.parse(JSON.stringify(defaultMenu));
  renderAll();
});

(async function init() {
  defaultMenu = await loadDefaultMenu();
  const override = Store.loadJson(CFG.STORE_MENU, null);
  menu = migrateMenu(override, JSON.parse(JSON.stringify(defaultMenu)));
  renderAll();
})().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;color:#fff;background:#080c10;font-family:system-ui">
    <h2>Admin failed to load</h2><p>${err.message}</p>
  </div>`;
});
