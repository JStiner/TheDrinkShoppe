
const MENU_KEY = 'drinkshoppe_menu_override_v1';

function syrupName(s){ return s.label || s.name || s.id || 'Unnamed'; }

async function getDefaultMenu(){
  return await fetch('menu.json').then(r=>r.json());
}

async function getMenu(){
  const local = localStorage.getItem(MENU_KEY);
  if(local){
    try { return JSON.parse(local); } catch(e){}
  }
  return await getDefaultMenu();
}

function saveMenu(data){
  localStorage.setItem(MENU_KEY, JSON.stringify(data));
}

async function load(){
  const data = await getMenu();
  const list = document.getElementById('list');
  list.innerHTML = '';
  (data.syrups || []).forEach((s, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${syrupName(s)}</strong><br><small>${(s.vibe || []).join(', ')}</small>`;
    list.appendChild(li);
  });
}

async function addSyrup(){
  const name = document.getElementById('newSyrup').value.trim();
  if(!name) return;
  const data = await getMenu();
  if(!data.syrups) data.syrups = [];
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  data.syrups.push({ id, label:name, vibe:["Bright","Sweet","Classic"], active:true });
  saveMenu(data);
  document.getElementById('newSyrup').value = '';
  load();
}

async function resetMenu(){
  localStorage.removeItem(MENU_KEY);
  load();
}

load();
