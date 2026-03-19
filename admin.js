
const CFG = { STORE_MENU: "drinkshoppe:menu:override" };

const Store = {
  loadJson(key, fallback=null) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } },
  saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};

let defaultMenu = null;
let menu = null;
let activeTab = "syrups";

async function loadDefaultMenu() {
  const res = await fetch("menu.json", { cache: "no-store" });
  return await res.json();
}

function persist() { Store.saveJson(CFG.STORE_MENU, menu); }

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function syncTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === activeTab);
  });
  document.getElementById("panel-syrups").classList.toggle("active", activeTab === "syrups");
  document.getElementById("panel-bases").classList.toggle("active", activeTab === "bases");
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
        <div>
          <div class="name">${s.label}</div>
          <div class="meta">${(s.vibe || []).join(", ")}</div>
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

function renderAll() {
  renderCategoriesSelect();
  renderSyrups();
  renderBases();
  syncTabs();
}

function addSyrup() {
  const label = document.getElementById("addSyrupLabel").value.trim();
  const vibeText = document.getElementById("addSyrupVibes").value.trim();
  if (!label) return;
  const id = slugify(label);
  if ((menu.syrups || []).some(s => s.id === id)) return;
  const vibe = vibeText ? vibeText.split(",").map(x => x.trim()).filter(Boolean) : ["Bright","Sweet","Classic"];
  menu.syrups.push({ id, label, vibe, active: true });
  persist();
  document.getElementById("addSyrupLabel").value = "";
  document.getElementById("addSyrupVibes").value = "";
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

  const se = e.target.closest("[data-s-edit]");
  if (se) {
    const s = menu.syrups.find(x => x.id === se.dataset.sEdit);
    if (s) {
      const label = prompt("Syrup name", s.label);
      if (label !== null && label.trim()) s.label = label.trim();
      const vibe = prompt("Vibe words (comma separated)", (s.vibe || []).join(", "));
      if (vibe !== null) s.vibe = vibe.split(",").map(x => x.trim()).filter(Boolean);
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
});

document.getElementById("addSyrupBtn").addEventListener("click", addSyrup);
document.getElementById("addBaseBtn").addEventListener("click", addBase);
document.getElementById("backBtn").addEventListener("click", () => location.href = "index.html");
document.getElementById("resetDefaultsBtn").addEventListener("click", () => {
  Store.remove(CFG.STORE_MENU);
  menu = JSON.parse(JSON.stringify(defaultMenu));
  renderAll();
});

(async function init() {
  defaultMenu = await loadDefaultMenu();
  menu = Store.loadJson(CFG.STORE_MENU, JSON.parse(JSON.stringify(defaultMenu)));
  renderAll();
})().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:24px;color:#fff;background:#080c10;font-family:system-ui">
    <h2>Admin failed to load</h2><p>${err.message}</p>
  </div>`;
});
