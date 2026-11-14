from playwright.sync_api import sync_playwright
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for side in ['party','city']:
  page=b.new_page(viewport={'width':1280,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:3301/',wait_until='networkidle');page.locator(f'[data-act=side][data-v={side}]').click();page.locator('[data-act=start]').click()
  clicks=0
  while clicks<500:
   clicks+=1
   if page.locator('[data-act=storyAll]').count():page.locator('[data-act=storyAll]').click();continue
   state=page.evaluate("({phase:game.phase,round:game.round,winner:game.winner,turn:game.turn,rooms:game.metrics.rooms})")
   if state['round']>=4 or state['winner']:break
   if page.locator('[data-act=monsterDone]').count():page.locator('[data-act=monsterDone]').click();continue
   phase=state['phase']
   if phase=='city':
    theme=page.evaluate("['破坏仪式','遗物回收','空间裂隙'].find(t=>t!==game.previousTheme)")
    page.locator(f'[data-act=theme][data-v="{theme}"]').click()
    if page.locator('[data-act=upgrade]:enabled').count():page.locator('[data-act=upgrade]').click();continue
    indices=page.evaluate("()=>game.cityHand.map((c,i)=>({i,n:c.dc})).sort((a,b)=>b.n-a.n).slice(0,game.slots.filter(s=>!s).length).map(x=>x.i)")
    for i in indices:page.locator(f'[data-act=pickCity][data-v="{i}"]').click()
    page.locator('[data-act=prepare]:enabled').click()
   elif phase=='action':
    action=page.evaluate("""()=>{const h=game.heroes[game.turn],ts=game.targets(h.id);if(!h.soul)return {kind:'wait'};if(ts.length){ts.sort((a,b)=>Number(game.rooms[b].type==='宝藏')-Number(game.rooms[a].type==='宝藏'));return {kind:'explore',to:ts[0]};}const to=game.reachable(h.pos).find(p=>game.rooms[p].links.some(n=>!game.visited.has(n)));return to===undefined?{kind:'wait'}:{kind:'travel',to};}""")
    if action['kind']=='wait':page.locator('[data-act=wait]').click()
    else:
     page.locator(f'[data-act=room][data-v="{action["to"]}"]').click();page.locator(f'[data-act={action["kind"]}]').click()
   elif phase=='door':page.locator('[data-act=reveal]').first.click()
   elif phase=='revealed':page.locator('[data-act=continue]').click()
   elif phase=='trade':page.locator('[data-act=tradeSoul]').click() if page.evaluate('game.heroes[game.encounter.bearer].soul')>=2 else page.locator('[data-act=refuse]').click()
   elif phase=='check':page.locator('[data-act=roll]').click()
   elif phase=='rolled':page.locator('[data-act=confirm]').click()
   elif phase=='damage':page.locator('[data-act=damage]').click()
   elif phase=='choice':
    if page.locator('[data-act=riftMap]').count():
     page.locator('[data-act=riftMap]').click();target=page.evaluate('game.pending.options[0].value');page.locator(f'[data-act=room][data-v="{target}"]').click()
    else:
     frag=page.locator('[data-act=choose]').filter(has_text='地牢碎片')
     (frag.first if frag.count() else page.locator('[data-act=choose]').first).click()
   else:raise AssertionError(state)
  assert clicks<500,'操作循环未推进'
  assert not errors,errors
  result={**state,'side':side,'clicks':clicks,'errors':errors};results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
  page.close()
 b.close()
(ROOT/'reports/v083-view-playthroughs.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
