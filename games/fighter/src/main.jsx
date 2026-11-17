import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import FighterJet from './components/fighter-jet-eject.js';
import sections from './controls.json';
import './style.css';

const controls = sections.flatMap(section => section.controls);
const defaults = Object.fromEntries(controls.filter(c => 'default' in c).map(c => [c.prop, c.default]));
const storageKey = 'fighter-remix-settings-v1';
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return Object.fromEntries(controls.map(c => {
      const v = saved[c.prop];
      const valid = c.control === 'number' ? typeof v === 'number' && Number.isFinite(v) : c.control === 'slider' ? typeof v === 'number' && Number.isFinite(v) && v >= c.min && v <= c.max
        : c.control === 'switch' ? typeof v === 'boolean'
        : c.control === 'segmented' ? c.options.includes(v)
        : c.control === 'color' ? typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) : false;
      return [c.prop, valid ? v : defaults[c.prop]];
    }));
  } catch { return defaults; }
}
function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [open, setOpen] = useState(false);
  function change(prop, value) {
    setSettings(previous => {
      const next = { ...previous, [prop]: value };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function reset() {
    setSettings({ ...defaults });
    try { localStorage.removeItem(storageKey); } catch {}
  }
  return <main>
    <div className="flight"><FighterJet {...settings} /></div>
    <button className="settings-toggle" aria-expanded={open} aria-controls="flight-settings" onClick={() => setOpen(!open)}>{open ? '关闭调节 ×' : '调节飞行 ☷'}</button>
    {open && <aside id="flight-settings" className="settings" aria-label="飞行设置" onKeyDown={e => { if(e.key === 'Escape') setOpen(false); e.stopPropagation(); }} onKeyUp={e => e.stopPropagation()}>
      <header><h1>像素飞行</h1><p>调整立即生效，自动保存在当前浏览器。</p><button onClick={reset}>恢复默认设置</button></header>
      {sections.map(section => <details key={section.title} open><summary>{section.title}</summary>{section.controls.map(c => {
        if(c.visibleWhen && settings[c.visibleWhen.prop] !== c.visibleWhen.equals) return null;
        const id = `setting-${c.prop}`;
        return <div className="setting" key={c.prop}><label htmlFor={id}>{c.label}</label>
          {c.control === 'slider' ? <div className="range"><input id={id} type="range" min={c.min} max={c.max} step={c.step} value={settings[c.prop]} onChange={e => change(c.prop, Number(e.target.value))}/><output htmlFor={id}>{settings[c.prop]}</output></div>
            : c.control === 'switch' ? <input id={id} type="checkbox" checked={Boolean(settings[c.prop])} onChange={e => change(c.prop, e.target.checked)}/>
            : c.control === 'segmented' ? <select id={id} value={settings[c.prop]} onChange={e => change(c.prop, e.target.value)}>{c.options.map(v => <option key={v} value={v}>{v}</option>)}</select>
            : c.control === 'number' ? <input id={id} type="number" value={settings[c.prop]} onChange={e => { if(e.target.value !== '' && Number.isFinite(Number(e.target.value))) change(c.prop, Number(e.target.value)); }}/> : c.control === 'color' ? <input id={id} type="color" value={settings[c.prop]} onChange={e => change(c.prop, e.target.value)}/> : null}
        </div>;
      })}</details>)}
      <footer><a href="https://github.com/kamenridericey-spec/dark-gate-dungeon/tree/main/games/fighter" target="_blank" rel="noreferrer">查看代码</a><a href="https://forge.ui8.ai/share/frag_f88d18ca-218d-4194-abde-ee631568c2af" target="_blank" rel="noreferrer">Forge 原项目</a></footer>
    </aside>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
