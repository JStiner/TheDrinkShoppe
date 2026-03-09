
/*
Drink Shoppe – Updated Logic
Features added:
1. Syrup chip selection (max 3, ordered)
2. Builder-style filtering (only drinks containing selected syrups)
3. "Save My Drink" favorites feature
*/

const MAX_SYRUPS = 3;

const state = {
  selectedSyrups: [],
  favorites: new Set(JSON.parse(localStorage.getItem("drinkshoppe:favorites") || "[]"))
};

function saveFavorites(){
  localStorage.setItem("drinkshoppe:favorites", JSON.stringify([...state.favorites]));
}

function toggleFavorite(id){
  if(state.favorites.has(id)){
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }
  saveFavorites();
  render();
}

document.addEventListener("click", (e)=>{

  const chip = e.target.closest("[data-syrup-id]");
  if(chip){
    const id = chip.dataset.syrupId;
    const idx = state.selectedSyrups.indexOf(id);

    if(idx >= 0){
      state.selectedSyrups.splice(idx,1);
    }else{

      if(state.selectedSyrups.length >= MAX_SYRUPS){
        alert("Maximum 3 syrups");
        return;
      }

      state.selectedSyrups.push(id);
    }

    render();
    return;
  }

  const favBtn = e.target.closest("[data-fav-id]");
  if(favBtn){
    toggleFavorite(favBtn.dataset.favId);
  }

});

function matchScore(drink){

  if(state.selectedSyrups.length === 0) return 0;

  const ids = [drink.primary?.id, drink.secondary?.id, drink.tertiary?.id].filter(Boolean);

  let matches = 0;

  for(const s of state.selectedSyrups){
    if(ids.includes(s)) matches++;
  }

  return matches;
}

function filterDrinks(drinks){

  if(state.selectedSyrups.length === 0) return drinks;

  return drinks.filter(d=>{

    const ids = [d.primary?.id, d.secondary?.id, d.tertiary?.id];

    return state.selectedSyrups.some(s=>ids.includes(s));

  });
}

function sortDrinks(drinks){

  return drinks.sort((a,b)=>{

    const aScore = matchScore(a);
    const bScore = matchScore(b);

    if(aScore !== bScore) return bScore - aScore;

    return a.name.localeCompare(b.name);

  });

}

function render(){

  if(typeof generateDrinks !== "function") return;

  let drinks = generateDrinks();

  drinks = filterDrinks(drinks);

  drinks = sortDrinks(drinks);

  const container = document.getElementById("drinkList");
  if(!container) return;

  container.innerHTML = "";

  drinks.forEach(d=>{

    const div = document.createElement("div");
    div.className = "drink";

    const fav = state.favorites.has(d.id);

    div.innerHTML = `
      <div class="drink-name">${d.name}</div>
      <div class="drink-actions">
        <button data-fav-id="${d.id}">${fav ? "★" : "☆"}</button>
      </div>
    `;

    container.appendChild(div);

  });

}

/* Save My Drink */

function saveCurrentDrink(){

  if(state.selectedSyrups.length === 0){
    alert("Select syrups first");
    return;
  }

  const name = prompt("Name your drink");

  if(!name) return;

  const custom = {
    id: "custom_" + Date.now(),
    name,
    syrups: [...state.selectedSyrups]
  };

  let saved = JSON.parse(localStorage.getItem("drinkshoppe:custom") || "[]");
  saved.push(custom);

  localStorage.setItem("drinkshoppe:custom", JSON.stringify(saved));

  alert("Drink saved!");

}

window.saveCurrentDrink = saveCurrentDrink;

