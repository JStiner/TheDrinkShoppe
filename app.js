
async function loadMenu(){
 const data = await fetch('menu.json').then(r=>r.json())
 const container=document.getElementById('syrups')
 container.innerHTML=''
 data.syrups.forEach(s=>{
   const div=document.createElement('div')
   div.className='syrup'
   div.innerText=s.name
   container.appendChild(div)
 })
}
function resetSelections(){location.reload()}
loadMenu()
