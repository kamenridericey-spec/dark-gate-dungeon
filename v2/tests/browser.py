from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:3300/',wait_until='networkidle')
 assert page.title()=='暗门地牢 · 第二版 V0.8.2'
 page.get_by_role('button',name='切换城主视角',exact=True).click()
 for i in range(3):page.locator('[data-action="pick"]').nth(i).click()
 page.get_by_role('button',name='确认主题与部署',exact=True).click()
 assert page.evaluate('game.phase')=='action'
 page.get_by_role('button',name='切换冒险者视角',exact=True).click()
 assert page.locator('.back').count()==3
 page.locator('[name=party][value="1"]').check();page.locator('[name=party][value="2"]').check()
 page.locator('#bearer').select_option('1')
 page.get_by_role('button',name='确认小队 · 准备开门',exact=True).click()
 page.locator('[data-action="reveal"]:enabled').nth(1).click()
 assert page.evaluate('game.encounter.party.length')==3
 assert page.evaluate('game.encounter.bearer')==1
 page.get_by_role('button',name='接受遭遇 · 继续',exact=True).click()
 if page.evaluate('game.phase')=='trade':page.get_by_role('button',name='接受 · 承担者支付一魂',exact=True).click()
 page.get_by_role('button',name='掷骰',exact=True).click()
 page.get_by_role('button',name='确认结果并结算',exact=True).click()
 i=0
 while page.evaluate('Boolean(game.pending)'):
  page.locator('[data-action="select"]').first.click();i+=1;assert i<25
 assert page.evaluate('game.round')==2
 assert page.evaluate('game.metrics.rooms')==1
 assert page.evaluate('game.slots.filter(Boolean).length')==2
 page.locator('[data-action="inspect"]').first.click()
 assert page.locator('#cardDialog').is_visible()
 page.get_by_role('button',name='收起',exact=True).click()
 assert not page.locator('#cardDialog').is_visible()
 page.screenshot(path=str(root/'reports/browser-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 assert page.locator('h1').is_visible()
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), '页面超出手机视口，地图应只在内部滚动'
 page.screenshot(path=str(root/'reports/browser-mobile.png'),full_page=True)
 assert not errors,errors
 print('PASS: 模块加载、城主自选部署、隐藏牌背、三人组队／选择承担者、手选第二槽、检定与结算、轮次推进、未用埋牌保留、大卡开关、窄屏加载；浏览器运行错误0。')
 b.close()
