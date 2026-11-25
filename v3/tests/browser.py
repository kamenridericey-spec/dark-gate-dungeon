"""Real click-through smoke tests for both seats. Requires Playwright and Chromium."""
from pathlib import Path
from os import environ
from playwright.sync_api import sync_playwright

BASE = environ.get('DUNGEON_URL', 'http://127.0.0.1:3317/')
with sync_playwright() as manager:
    browser = manager.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    def action(name):
        return page.locator(f'[data-act="{name}"]')
    def click(name, val=None):
        item=action(name)
        if val is not None:
            item=item.and_(page.locator(f'[data-v="{val}"]'))
        item.first.click(timeout=4000)
    page.goto(BASE)
    click('start')
    page.locator('.room.reachable').first.wait_for(timeout=5000)
    assert page.locator('.room:not(.preview)').count() == 36
    assert page.locator('.room.entrance .door').count() == 4
    assert page.locator('.room.covered .door').count() == 0
    assert set(page.locator('.room.covered .swatch').all_text_contents()) == {'○','△','×'}
    page.locator('.pile',has_text='遭遇牌堆').hover()
    assert '抽空后' in page.locator('#game-tooltip').inner_text()
    click('item')
    assert page.locator('.item-card p').inner_text().strip()
    click('close')
    page.screenshot(path='/tmp/dungeon-v3-board.png')
    action('team').first.click()
    page.locator('.room.covered.reachable .room-button').first.click()
    assert '2人' in action('explore').inner_text()
    click('explore')
    assert action('reveal').count() == 3
    assert [c.strip() for c in page.locator('.card.back strong').all_text_contents()] == ['I','I','I']
    page.screenshot(path='/tmp/dungeon-v3-backs.png')
    click('bearer',1)
    click('reveal')
    assert page.locator('.room.pending .door').count() == 1
    assert page.locator('.card .outcome').count() == 2
    assert page.locator('.card [title]').count()>=4
    page.screenshot(path='/tmp/dungeon-v3-encounter.png')
    click('continue')
    if action('monster').count():
        click('monster')
    if action('trade').count():
        click('trade','yes')
    click('roll')
    assert page.locator('.dice b').count() in (1,2)
    assert page.locator('.dice svg').count()==page.locator('.dice b').count()
    assert page.locator('.dice.rolling').count()==1
    page.screenshot(path='/tmp/dungeon-v3-dice.png')
    click('resolve')
    for _ in range(14):
        if action('damage').count():
            click('damage')
        elif action('choice').count():
            click('choice')
        elif action('leave').count():
            click('leave')
        elif action('orient').count():
            click('orient')
        elif action('wait').count():
            break
        else:
            page.locator('#controls').wait_for()
    action('wait').wait_for(timeout=6000)
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='/tmp/dungeon-v3-mobile.png')
    page.get_by_role('button',name='返回开局').click()
    click('reset')
    page.set_viewport_size({'width':1280,'height':800})
    click('choose-side','city')
    click('start')
    assert action('city-pick').count()==6
    assert page.locator('.city-upgrade').get_by_role('button',name='升级迷宫 · 0/5 魂').is_visible()
    click('pattern','方格')
    for i in range(3):click('city-pick',i)
    click('deploy')
    page.get_by_role('dialog',name='冒险者行动结果').wait_for(timeout=7000)
    summary=page.locator('.feedback-list').inner_text()
    assert '进入' in summary or '赶路' in summary or '结束行动' in summary
    page.wait_for_timeout(400)
    assert page.get_by_role('dialog',name='冒险者行动结果').is_visible()
    assert page.locator('#city .ward').count()==1
    click('feedback-next')
    for _ in range(90):
        if action('feedback-next').count():
            click('feedback-next')
        elif action('orient').count():
            click('orient')
        elif action('deploy').count():
            break
        elif page.get_by_role('button',name='新对局').count():
            break
        else:
            page.wait_for_timeout(100)
    assert action('deploy').count() or action('reset').count()
    merchant=browser.new_page(viewport={'width':1280,'height':800})
    merchant.add_init_script('Date.now = () => 21')
    merchant.on('pageerror',lambda err:errors.append(str(err)))
    page=merchant
    page.goto(BASE)
    click('start')
    page.locator('.room.covered.reachable .room-button').first.wait_for(timeout=5000)
    click('team',2)
    page.locator('.room.covered.reachable .room-button').first.click()
    click('explore');click('bearer',2);click('reveal',2);click('continue')
    assert '失败翻 2 件' in page.locator('.offer-line').inner_text()
    click('trade','yes');click('roll');click('resolve')
    assert '检定失败' in page.locator('.kicker').inner_text()
    assert action('buy').count()==2
    click('buy')
    if action('choice').count():click('choice')
    click('hide') if action('hide').count() else None
    page.get_by_role('button',name='对局记录').click()
    assert '城主 +1 魂 · 实际成交' in page.locator('.journal').inner_text()
    assert not errors,errors
    print('PASS: adventurer clicks and auto-city; city deploy and auto-adventurers; tile symbols and card backs, hover tips, dossier and dice animation, opponent result pauses, mobile width; failed charm trade opens two goods and pays one trade soul; zero browser errors.')
