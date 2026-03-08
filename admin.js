
async function load(){
 const data = await fetch('menu.json').then(r=>r.json())
 const list=document.getElementById('list')
 list.innerHTML=''
 data.syrups.forEach(s=>{
   const li=document.createElement('li')
   li.innerText=s.name
   list.appendChild(li)
 })
}

async function addSyrup(){
 const name=document.getElementById('newSyrup').value
 const data = await fetch('menu.json').then(r=>r.json())
 data.syrups.push({name})
 alert('Added locally (edit menu.json in repo to persist).')
}

load()
