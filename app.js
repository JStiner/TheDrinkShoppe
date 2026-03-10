const CFG = {
PAGE_SIZE: 40,
STORE_FAV: "drinkshoppe:favorites",
STORE_HIDE: "drinkshoppe:hidden",
STORE_MENU: "drinkshoppe:menu:override",
STORE_SAVED: "drinkshoppe:saveddrinks"
};

const LOTUS = {
name: "White Lotus",
pumpsPerAdd: 1,
caffeineMgPerPump: 80,
emoji: "⚡"
};

let MENU = null;
let BASES = [];
let SYRUPS = [];

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
localStorage.setItem(key, JSON.stringify([...set]));
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
localStorage.setItem(key, JSON.stringify(value));
}
};

const state = {
baseCategory: "all",
baseFlavor: "all",
lotusOnly: false,
favOnly: false,
selectedSyrups: [],
pages: { A:0, B:0, C:0 },
favorites: Store.loadSet(CFG.STORE_FAV),
hidden: Store.loadSet(CFG.STORE_HIDE),
savedDrinks: Store.loadJson(CFG.STORE_SAVED, []),
lastHidden: null
};

function renderSavedDrinks(list) {

if (!state.savedDrinks.length) return;

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
<button class="icon-btn" data-action="remove-saved" data-saved-id="${sd.id}">
✕
</button>
</div>
`;

list.appendChild(div);

});

}

function render() {

const list = document.getElementById("cola");
if (!list) return;

list.innerHTML = "";

/* Saved drinks only show when Favorites toggle is ON */

if (state.favOnly) {
renderSavedDrinks(list);
}

}

document.addEventListener("click", e => {

const btn = e.target.closest("[data-action]");
if (!btn) return;

const action = btn.dataset.action;

/* Remove saved drink */

if (action === "remove-saved") {

const id = btn.dataset.savedId;

state.savedDrinks = state.savedDrinks.filter(d => d.id !== id);

Store.saveJson(CFG.STORE_SAVED, state.savedDrinks);

render();

return;
}

});

async function init() {

render();

}

init();