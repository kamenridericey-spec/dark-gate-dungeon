from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def stories():
  for _ in range(150):
   if page.locator('[data-act=storyAll]').count():page.locator('[data-act=storyAll]').click()
   else:return
  raise AssertionError('自动行动/播报循环')
 page.goto('http://127.0.0.1:3301/',wait_until='networkidle')
 assert page.get_by_role('heading',name='围桌，开始冒险').is_visible()
 page.locator('[data-act=start]').click();stories()
 assert page.evaluate('game.phase')=='action'
 assert page.evaluate('game.slots.filter(Boolean).length')==3
 assert not page.locator('#itemTarget').count()
 assert not page.get_by_text('更新探索小队',exact=True).count()
 page.evaluate("""()=>{const g=game;g.heroes[1].hand=[];g.heroes[2].hand=[];g.heroes[0].hand=['insight','substitute'].map(effect=>g.card(g.data.cards.find(c=>c.effect===effect)));g.slots[0].card={id:'regression',name:'纸门后的守卫',kind:'战斗',tier:1,attribute:'体魄',prefer:'奇遇',dc:12,text:''};g.monsters[1]=[structuredClone(g.data.monsters[1][0])];window.uiDebug.clearPresentation();}""")
 page.locator('[data-act=token][data-v="1"]').click()
 page.locator('[data-act=room][data-v="1"]').click()
 page.locator('[data-act=explore]').click()
 assert page.locator('.card-back').count()==3
 assert '位置' not in page.locator('.card-back').all_text_contents()[0]
 page.screenshot(path=str(ROOT/'reports/v083-final-backs.png'),full_page=True)
 page.locator('[data-act=bearer][data-v="1"]').click()
 assert page.evaluate('game.encounter.bearer')==1
 insight=page.evaluate("game.heroes[0].hand.find(c=>c.effect==='insight').uid")
 page.locator(f'.skillbar [data-act=item][data-v="0:{insight}"]').click();page.locator('[data-act=activate]').click();page.locator('[data-act=toolSlot][data-v="1"]').click();stories()
 assert page.evaluate('game.slots[1].open')
 assert page.evaluate('game.metrics.rooms')==0
 page.locator('[data-act=reveal][data-v="0"]').click();stories()
 assert not page.locator('.skillbar').get_by_text('重抽',exact=False).count()
 assert '奇遇房' in page.locator('.playing-card .card-preference').inner_text()
 assert '成功' in page.locator('.playing-card').inner_text() and '失败' in page.locator('.playing-card').inner_text()
 assert page.locator('.playing-card h3').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)') > page.locator('.playing-card .tag').first.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
 page.screenshot(path=str(ROOT/'reports/v083-card-front.png'),full_page=True)
 page.locator('[data-act=continue]').click();stories()
 if page.locator('[data-act=monsterDone]').count():page.locator('[data-act=monsterDone]').click()
 assert '承担者专长未匹配（心智）' in page.locator('#overlay').inner_text()
 assert page.evaluate('game.preview()')==0
 page.screenshot(path=str(ROOT/'reports/v083-check.png'),full_page=True)
 page.locator('[data-act=roll]').click();stories()
 page.evaluate("()=>{game.encounter.dice=[1,1];window.renderGame();}")
 page.locator('[data-act=confirm]').click();stories()
 assert page.evaluate('game.phase')=='damage'
 assert page.evaluate('game.heroes[1].soul')==3
 uid=page.evaluate("game.heroes[0].hand.find(c=>c.effect==='substitute').uid")
 page.locator(f'.skillbar [data-act=item][data-v="0:{uid}"]').click();page.locator('[data-act=activate]').click();page.locator('[data-act=toolTarget][data-v="0"]').click();stories()
 assert page.evaluate('game.encounter.bearer')==0
 page.locator('[data-act=damage]').click();stories()
 assert page.evaluate('game.heroes[0].soul')==3 and page.evaluate('game.heroes[1].soul')==3
 assert page.evaluate('game.metrics.income.battle')==0
 while page.locator('[data-act=choose]').count():page.locator('[data-act=choose]').last.click();stories()
 page.set_viewport_size({'width':1280,'height':800});page.screenshot(path=str(ROOT/'reports/v083-mac-viewport.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(ROOT/'reports/v083-mobile.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # City-side setup: no need to manually operate the three adventurers.
 page.locator('#restart').click();page.locator('[data-act=side][data-v=city]').click();page.locator('[data-act=start]').click();stories()
 assert page.evaluate('game.phase')=='city'
 for i in range(3):page.locator(f'[data-act=pickCity][data-v="{i}"]').click()
 page.locator('[data-act=prepare]').click();stories()
 assert page.evaluate('game.round')>=2 and page.evaluate('game.phase') in ['city','choice']
 assert not errors,errors
 print('PASS: 冒险者开局自动城主、城主开局自动三玩家、token组队、中央三张牌、心智承担不借用同行体魄、洞察只翻明、偏好与成败双栏、无虚假重抽提示、受伤前替身、战败零收入、1280×800/390×844无横向溢出。页面错误0。')
 b.close()
