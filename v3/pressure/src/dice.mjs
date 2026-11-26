export function diceMarkup(values,chosen,animate=false){
  const numbers=values?.length?values:['?'];
  const faces=['M31 3 57 18 57 47 31 61 5 47 5 18Z','M31 3 21 17 5 18M31 3 41 17 57 18M5 18 15 42 5 47M57 18 47 42 57 47M5 47 31 61 15 42M57 47 31 61 47 42M21 17 41 17 47 42 31 53 15 42Z'];
  return `<div class="dice ${animate?'rolling':''}" aria-label="${animate?'正在掷骰':numbers.join('、')}">${numbers.map((n,i)=>`<div class="die ${n===chosen?'take':''}" style="--die-order:${i}"><svg viewBox="0 0 62 64" aria-hidden="true"><path class="die-body" d="${faces[0]}"/><path class="die-facets" d="${faces[1]}"/></svg><b>${n}</b></div>`).join('')}</div>`;
}
export function animateDice(root,values,onComplete,duration=760){
  if(!root)return onComplete();
  const labels=[...root.querySelectorAll('.die b')];
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)duration=0;
  const ticker=setInterval(()=>labels.forEach(label=>label.textContent=Math.floor(Math.random()*20)+1),67);
  setTimeout(()=>{
    clearInterval(ticker);
    labels.forEach((label,i)=>label.textContent=values[i]);
    onComplete();
  },duration);
}
