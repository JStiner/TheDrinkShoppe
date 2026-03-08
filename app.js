
const MENU_KEY = 'drinkshoppe_menu_override_v1';

function syrupName(s){ return s.label || s.name || s.id || 'Unnamed'; }

async function getMenu(){
  const local = localStorage.getItem(MENU_KEY);
  if(local){
    try { return JSON.parse(local); } catch(e){}
  }
  return await fetch('menu.json').then(r=>r.json());
}

async function loadMenu(){
  const data = await getMenu();
  const container = document.getElementById('syrups');
  container.innerHTML = '';
  (data.syrups || []).forEach(s => {
    if(s.active === false) return;
    const div = document.createElement('div');
    div.className = 'syrup';
    div.innerText = syrupName(s);
    container.appendChild(div);
  });
}

function resetSelections(){ location.reload(); }

loadMenu();
