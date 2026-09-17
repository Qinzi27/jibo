#!/usr/bin/env python3
"""Real loopback browser regression tests; Python standard library + Node Playwright.

No packages are installed. Set NODE_PATH or --node-modules to existing Node packages.
Reports/screenshots go to --output-dir (a temporary directory by default), never docs.
Uses a disposable persistent Chrome profile; proves localStorage reload and browser
restart, but not Android native storage, file:// behavior, PWA, or OS downloads.
"""
from pathlib import Path
import argparse
import os
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--chromium', default=os.environ.get('CHROMIUM_PATH'))
parser.add_argument('--node', default=shutil.which('node'))
parser.add_argument('--node-modules', default=os.environ.get('NODE_PATH'))
parser.add_argument('--output-dir', type=Path)
parser.add_argument('--baseline', action='store_true', help='Skip the new 肌薄 plan contract')
parser.add_argument('--pwa-only', action='store_true', help='Only test source web/ service-worker caching and offline reload')
parser.add_argument('--mobile-only', action='store_true', help='Only test phone touch layout, workout navigation, timers and reduced viewport behavior; not a real Android keyboard')
parser.add_argument('--custom-only', action='store_true', help='Only test custom movement photos and reusable plans; file input is automated, not a real camera or Android picker')
parser.add_argument('--theory-only', action='store_true', help='Only test merged plans/progress navigation and local theory screenshot browsing; clipboard is intercepted, no external source page opens')
args = parser.parse_args()
if not args.node:
    parser.error('Node.js is required; install it on PATH or pass --node PATH')
if not args.node_modules and (ROOT / 'node_modules/playwright').is_dir():
    args.node_modules = str(ROOT / 'node_modules')
if not args.chromium:
    chrome = Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    args.chromium = str(chrome) if chrome.exists() else shutil.which('chromium')
args.output_dir = args.output_dir or Path(tempfile.mkdtemp(prefix='jibo-ui-'))
args.output_dir.mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
env.update(JIBO_ROOT=str(ROOT), JIBO_OUTPUT=str(args.output_dir.resolve()),
           JIBO_BASELINE='1' if args.baseline else '0', JIBO_PWA_ONLY='1' if args.pwa_only else '0',
           JIBO_MOBILE_ONLY='1' if args.mobile_only else '0', JIBO_CUSTOM_ONLY='1' if args.custom_only else '0',
           JIBO_THEORY_ONLY='1' if args.theory_only else '0')
if args.node_modules:
    env['NODE_PATH'] = args.node_modules
if args.chromium:
    env['CHROMIUM_PATH'] = args.chromium

SCRIPT = r'''
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root=process.env.JIBO_ROOT, output=process.env.JIBO_OUTPUT;
const baseline=process.env.JIBO_BASELINE==='1', pwaOnly=process.env.JIBO_PWA_ONLY==='1', mobileOnly=process.env.JIBO_MOBILE_ONLY==='1', customOnly=process.env.JIBO_CUSTOM_ONLY==='1', theoryOnly=process.env.JIBO_THEORY_ONLY==='1';
const store='lean-crew-local-v1';
const checks=[], errors=[], external=[];
let context, server;
function check(name, condition) { assert.ok(condition,name);checks.push(name);console.log('PASS:',name); }
const state=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k) || JSON.stringify(LeanCore.emptyState())),store);
const saved=p=>p.evaluate(k=>localStorage.getItem(k),store);
const click=(p,action,tail='')=>p.locator(`[data-action="${action}"]${tail}:visible`).first().click();
const finish=async p=>{await click(p,'finish');await p.locator('#modal [data-action="confirm"]').waitFor({state:'visible'});await click(p,'confirm');};
const nav=async(p,name)=>{
  const destination=name==='progress'?'plans':name;
  await p.locator(`${p.viewportSize().width<=760?'.mobile-nav':'.desktop-nav'} [data-nav="${destination}"]`).click();
  if(name==='plans'||name==='progress')await click(p,'plan-view',`[data-view="${name}"]`);
};
const close=async p=>{if(await p.locator('#modal').isVisible())await click(p,'close-modal');};
function hook(p) {p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});}
let origin;
async function load(initial=null,width=390){
  const p=await context.newPage();hook(p);await p.setViewportSize({width,height:844});await p.goto(origin+'/dist/lean-crew-offline.html');
  await p.evaluate(({initial,store})=>{localStorage.clear();if(initial!==null)localStorage.setItem(store,initial)},{initial,store});await p.reload();return p;
}
async function downloads(p){await p.evaluate(()=>{window.__testDownloads=[];const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.__testDownloads.push(blob);return create(blob)};HTMLAnchorElement.prototype.click=function(){};});}
async function launch(){context=await chromium.launchPersistentContext(path.join(output,'browser-profile'),{
  headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,viewport:{width:390,height:844},args:['--no-sandbox']
});}
async function main(){
  const servedRoot=pwaOnly?path.join(root,'web'):root;
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
  server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const target=path.resolve(servedRoot,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!target.startsWith(servedRoot+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(target,(e,data)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;await launch();
  if(pwaOnly){await pwaChecks();return;}
  if(mobileOnly){await mobileChecks();return;}
  if(customOnly){await customChecks();return;}
  if(theoryOnly){await theoryChecks();return;}
  let p=await load();
  check('clean install contains no invented training records',(await state(p)).sessions.length===0);
  check('mobile home has no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:path.join(output,'home-mobile.png')});
  await nav(p,'library');
  check('exercise catalogue renders all source exercises',await p.locator('.exercise-card').count()===await p.evaluate(()=>LEAN_EXERCISES.length));
  await p.evaluate(async()=>{const imgs=[...document.querySelectorAll('.exercise-picture img')];imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()))});
  check('all embedded exercise illustrations decode',await p.evaluate(()=>[...document.querySelectorAll('.exercise-picture img')].every(i=>i.complete&&i.naturalWidth>0)));
  await p.locator('#exercise-search').fill('chest');check('English search finds chest press',await p.locator('.exercise-card').count()===1);await p.locator('#exercise-search').fill('');
  await click(p,'filter','[data-group="背部"]');check('muscle filter applies',await p.locator('.exercise-card').count()===await p.evaluate(()=>LEAN_EXERCISES.filter(e=>e.group==='背部').length));await click(p,'filter','[data-group="全部"]');
  await click(p,'add-ex','[data-ex="chest-press"]');await nav(p,'home');await click(p,'toggle-set');
  check('blank set cannot be completed',!(await state(p)).draft.blocks[0].sets[0].done);
  for(const [i,reps] of [12,12,10].entries()){await p.locator('[data-field="weight"]').nth(i).fill('20');await p.locator('[data-field="reps"]').nth(i).fill(String(reps));await p.locator('[data-action="toggle-set"]').nth(i).click();}
  check('three actual sets calculate 680 kg-reps',await p.evaluate(()=>LeanCore.sessionStats(JSON.parse(localStorage.getItem('lean-crew-local-v1')).draft,LEAN_EXERCISES).volume)===680);
  await p.locator('#draft-note').fill('多行中文\n<>& 应保留');const draftSaved=await saved(p);await p.reload();
  check('actual localStorage reload preserves full draft',await saved(p)===draftSaved&&await p.locator('#draft-note').inputValue()==='多行中文\n<>& 应保留');
  await p.screenshot({path:path.join(output,'workout-mobile.png')});
  await click(p,'finish');await click(p,'close-modal');
  check('cancelled archive keeps the current draft unchanged',await saved(p)===draftSaved);
  await p.evaluate(()=>{const b=document.querySelector('[data-action=finish]');b.click();b.click()});
  await p.locator('#modal [data-action="confirm"]').waitFor({state:'visible'});
  await p.evaluate(()=>{const b=document.querySelector('#modal [data-action=confirm]');b.click();b.click()});
  check('double archive saves exactly once and clears draft',(await state(p)).sessions.length===1&&(await state(p)).draft===null);
  check('archive report uses actual values',(await p.locator('#modal').innerText()).includes('680'));await close(p);
  await nav(p,'progress');await click(p,'history');await click(p,'edit-session');await p.locator('[data-field="weight"]').first().fill('25');await finish(p);await close(p);
  check('editing archive updates original record',(await state(p)).sessions.length===1&&(await state(p)).sessions[0].blocks[0].sets[0].weight===25);
  await nav(p,'progress');await click(p,'history');await click(p,'repeat-session');let st=await state(p);
  check('repeat creates a new draft with incomplete sets',st.draft.id!==st.sessions[0].id&&st.draft.blocks[0].sets.every(s=>!s.done));
  await click(p,'discard-draft');await click(p,'confirm');
  await nav(p,'library');await click(p,'add-ex','[data-ex="plank"]');await click(p,'add-ex','[data-ex="push-up"]');await nav(p,'home');
  await p.locator('[data-field="seconds"]').first().fill('45');await p.locator('.block').nth(0).locator('[data-action="toggle-set"]').first().click();
  await p.locator('[data-field="reps"]').first().fill('15');await p.locator('.block').nth(1).locator('[data-action="toggle-set"]').first().click();
  const stats=await p.evaluate(()=>LeanCore.sessionStats(JSON.parse(localStorage.getItem('lean-crew-local-v1')).draft,LEAN_EXERCISES));
  check('timed seconds and bodyweight reps remain separate',stats.seconds===45&&stats.reps===15&&stats.volume===0);await finish(p);await close(p);
  await nav(p,'food');for(const [selector,value] of [['#food-name','测试牛奶'],['#food-quantity','250'],['#food-kcal','62'],['#food-protein','3.4']])await p.locator(selector).fill(value);await p.locator('#food-unit').selectOption('mL');
  const preview=await p.locator('#food-preview').innerText();check('label calculation gives 155 kcal and 8.5 g protein',preview.includes('155')&&preview.includes('8.5'));await p.locator('#food-form button[type="submit"]').click();
  check('food entry and reusable label persist',(await state(p)).foodEntries.length===1&&(await state(p)).foodLabels.length===1);
  await nav(p,'progress');await p.locator('#weight-kg').fill('65');await p.locator('#weight-form button').click();await p.locator('#weight-kg').fill('65.1');await p.locator('#weight-form button').click();
  check('same-day bodyweight updates without duplication',(await state(p)).weights.length===1&&(await state(p)).weights[0].kg===65.1);
  await click(p,'settings');await p.locator('#nickname').fill('<img src=x onerror=alert(1)>');await p.locator('#profile-form button').click();await click(p,'theme','[data-theme="blond"]');
  check('theme persists and is applied',(await state(p)).profile.theme==='blond'&&await p.locator('body').evaluate(e=>e.classList.contains('blond')));
  const originalFun=(await state(p)).profile.fun;await click(p,'toggle-fun');check('cosmetic fun preference toggles',(await state(p)).profile.fun===!originalFun);
  await downloads(p);await click(p,'export-json');const backup=await p.evaluate(async()=>await window.__testDownloads[0].text());
  check('JSON export preserves the complete model',JSON.stringify(JSON.parse(backup))===JSON.stringify(await state(p)));
  await click(p,'export-csv');const csv=await p.evaluate(async()=>await window.__testDownloads[1].text());check('CSV includes load convention and archived records',csv.includes('load_convention')&&csv.includes('器械推胸'));
  const preRestart=await saved(p);await context.close();await launch();p=await context.newPage();hook(p);await p.goto(origin+'/dist/lean-crew-offline.html');
  check('browser process restart reads identical disk storage',await saved(p)===preRestart);
  check('stored nickname renders as text rather than executable markup',await p.locator('img[src="x"]').count()===0);
  await click(p,'settings');let before=await saved(p);
  await p.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await p.waitForTimeout(100);check('invalid JSON does not replace saved state',await saved(p)===before);
  const incoming=JSON.parse(backup);incoming.profile.nickname='导入验收';incoming.profile.fun=true;const payload={name:'good.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))};
  await p.locator('#import-file').setInputFiles(payload);await p.locator('#modal').waitFor({state:'visible'});await click(p,'close-modal');check('cancelled import preserves saved state',await saved(p)===before);
  await p.locator('#import-file').setInputFiles(payload);await p.locator('#modal').waitFor({state:'visible'});await click(p,'confirm');check('confirmed import is lossless',JSON.stringify(await state(p))===JSON.stringify(incoming));
  await p.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>setTimeout(()=>original.call(this).then(resolve),250))}});
  await p.locator('#import-file').setInputFiles(payload);await click(p,'theme','[data-theme="lean"]');await p.waitForTimeout(350);check('late import cannot overwrite a newer user edit',(await state(p)).profile.theme==='lean'&&await p.locator('#modal').isHidden());
  before=await saved(p);await p.evaluate(()=>{window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('quota')}});await click(p,'theme','[data-theme="blond"]');
  check('quota error leaves previously saved data intact',await saved(p)===before);await p.evaluate(()=>Storage.prototype.setItem=window.__originalSetItem);
  await click(p,'reset');await p.locator('#reset-text').fill('no');await click(p,'confirm');check('reset requires exact typed confirmation',(await state(p)).sessions.length===2);
  await p.locator('#reset-text').fill('清空');await click(p,'confirm');check('confirmed reset restores default model',(await state(p)).sessions.length===0&&JSON.stringify(await state(p))===await p.evaluate(()=>JSON.stringify(LeanCore.emptyState())));
  if(!baseline)await plans(p);
  await p.close();p=await load('{broken');check('unreadable stored data activates write protection',await p.locator('.storage-error').count()===1);
  if(await p.locator('[data-action="template"]').count())await click(p,'template');else {await nav(p,'plans');await click(p,'plan-detail','[data-plan="gym-a"]');await click(p,'start-plan','[data-plan="gym-a"]');}check('corrupt source is never silently replaced',await saved(p)==='{broken');await p.close();
  for(const width of [320,390,768,1280]){
    p=await load(null,width);for(const section of (baseline?['home','library','food','progress']:['home','plans','library','food','progress','theory'])){await nav(p,section);check(`${width}px ${section} has no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await click(p,'settings');check(`${width}px settings has no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(!baseline){await nav(p,'plans');await click(p,'plan-detail','[data-plan="gym-a"]');check(`${width}px plan detail stays within viewport`,await p.locator('.modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth));await click(p,'start-plan','[data-plan="gym-a"]');check(`${width}px active workout has no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await click(p,'discard-draft');await click(p,'confirm');}if(width===1280){await nav(p,'home');await p.screenshot({path:path.join(output,'home-desktop.png')});}await p.close();
  }
  check('no unhandled JavaScript exceptions',errors.length===0);check('application makes no external runtime requests',external.length===0);
}
async function planProgressChecks(){
  let p=await load(null,390);
  const fixture=await p.evaluate(()=>{
    const C=LeanCore,s=C.emptyState();
    const ex=C.newCustomExercise({name:'合并导航验收动作',group:'肩部',mode:'reps'});
    s.customExercises=[ex];
    const plan=C.newCustomPlan({name:'我的导航回归计划',durationMinutes:25,blocks:[{exerciseId:ex.id,sets:3,target:'8–12 次',restSeconds:60}]});
    s.customPlans=[plan];
    const history=C.newDraft(C.localDate());history.note='保持原样的历史记录';
    history.blocks=[C.newBlock('chest-press'),C.newBlock('push-up'),C.newBlock('plank')];
    Object.assign(history.blocks[0].sets[0],{weight:20,reps:12,done:true});
    Object.assign(history.blocks[0].sets[1],{weight:25,reps:8,done:true});
    Object.assign(history.blocks[0].sets[2],{weight:100,reps:100,done:false});
    Object.assign(history.blocks[1].sets[0],{reps:15,done:true});
    Object.assign(history.blocks[2].sets[0],{seconds:45,done:true});
    s.sessions=[history];s.weights=[{date:C.localDate(),kg:65}];
    s.draft=C.newPlanDraft(plan);s.draft.blocks[0].sets[0].reps=7;
    return C.validateState(s,LEAN_EXERCISES);
  });
  await p.close();p=await load(JSON.stringify(fixture),390);
  const initial=await saved(p),planId=fixture.customPlans[0].id;
  check('mobile navigation has five destinations with theory and no separate progress tab',JSON.stringify(await p.locator('.mobile-nav [data-nav]').evaluateAll(es=>es.map(e=>e.dataset.nav)))===JSON.stringify(['home','plans','library','theory','food']));
  check('desktop navigation matches the same five destinations',JSON.stringify(await p.locator('.desktop-nav [data-nav]').evaluateAll(es=>es.map(e=>e.dataset.nav)))===JSON.stringify(['home','plans','library','theory','food']));
  await nav(p,'plans');
  check('merged page opens the plan catalogue with a two-part accessible switch',await p.locator('[data-action="plan-view"]').count()===2&&await p.locator('[data-action="plan-view"][data-view="plans"]').getAttribute('aria-pressed')==='true'&&await p.locator('[data-action="plan-view"][data-view="progress"]').getAttribute('aria-pressed')==='false');
  await click(p,'plan-location','[data-location="custom"]');
  check('existing custom plans remain reachable inside the merged page',await p.locator(`[data-action="plan-detail"][data-plan="${planId}"]`).isVisible());
  await click(p,'plan-view','[data-view="progress"]');
  check('progress segment preserves completed-only totals and separate training units',JSON.stringify(await p.locator('.kpi-grid .metric').allTextContents())===JSON.stringify(['1','4','1'])&&await p.locator('.history-tags').innerText().then(t=>t.includes('4 组')&&t.includes('35 次')&&t.includes('45 秒')&&t.includes('440 kg·次')));
  check('progress segment retains weight history and existing archive',await p.locator('.weight-number').innerText().then(t=>t.includes('65'))&&await p.locator('.history-card').count()===1);
  await click(p,'history');
  check('merged history still exposes editing and repeating the original training',await p.locator('[data-action="edit-session"]').isVisible()&&await p.locator('[data-action="repeat-session"]').isVisible()&&await p.locator('#modal').innerText().then(t=>t.includes('20 kg × 12 次')));await close(p);
  await click(p,'plan-view','[data-view="plans"]');
  check('returning to plans retains the selected custom-plan filter',await p.locator(`[data-action="plan-detail"][data-plan="${planId}"]`).isVisible()&&await p.locator('[data-action="plan-location"][data-location="custom"]').getAttribute('aria-pressed')==='true');
  await click(p,'plan-view','[data-view="progress"]');await nav(p,'theory');await nav(p,'home');
  check('plan/progress/theory navigation never mutates current draft or historical data',await saved(p)===initial&&await p.locator('[data-field="reps"]').first().inputValue()==='7');
  await nav(p,'progress');await p.locator('#weight-kg').fill('66.1');await p.locator('#weight-form button').click();
  const weighted=await state(p),expected=structuredClone(fixture);expected.weights[0].kg=66.1;
  check('weight entry inside merged progress updates only that day and preserves plans and draft',JSON.stringify(weighted)===JSON.stringify(expected));
  const beforeRestart=await saved(p);await p.reload();await nav(p,'progress');
  check('merged progress reads the same archive and saved weight after reload',await saved(p)===beforeRestart&&await p.locator('.history-card').count()===1&&await p.locator('.weight-number').innerText().then(t=>t.includes('66.1')));
  await p.screenshot({path:path.join(output,'plans-progress-mobile.png')});
  return {p,before:beforeRestart};
}
async function theoryChecks(){
  const {p,before}=await planProgressChecks();
  await nav(p,'theory');
  const posts=await p.evaluate(()=>JIBO_THEORY_POSTS);
  check('theory includes attributed local screenshot cards from both selected authors',posts.length>=2&&new Set(posts.map(post=>post.id)).size===posts.length&&['sun','alan'].every(author=>posts.some(post=>post.authorId===author))&&posts.every(post=>post.author&&post.handle&&post.date&&post.title&&post.commentary&&/^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(post.sourceUrl)));
  check('theory cards expose all bundled posts without an account or network frame',await p.locator('.theory-card').count()===posts.length&&await p.locator('iframe').count()===0&&await p.locator('.theory-card[data-post-id]').evaluateAll(es=>es.map(e=>e.dataset.postId)).then(ids=>posts.every(post=>ids.includes(post.id))));
  await p.locator('.theory-card img').evaluateAll(async imgs=>{imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()));});
  check('every theory screenshot decodes from a packaged local image',await p.locator('.theory-card img').evaluateAll(imgs=>imgs.length>0&&imgs.every(i=>i.complete&&i.naturalWidth>=320&&i.naturalHeight>0&&!/^https?:\/\/(?!127\.0\.0\.1:)/.test(i.src))));
  await p.screenshot({path:path.join(output,'theory-mobile.png')});
  await p.screenshot({path:path.join(output,'theory-mobile-full.png'),fullPage:true});
  for(const author of ['sun','alan']){
    await click(p,'theory-filter',`[data-author="${author}"]`);
    const ids=await p.locator('.theory-card').evaluateAll(es=>es.map(e=>e.dataset.postId));
    check(`theory ${author} filter shows exactly that author's screenshots`,ids.length===posts.filter(post=>post.authorId===author).length&&ids.every(id=>posts.some(post=>post.id===id&&post.authorId===author))&&await p.locator(`[data-action="theory-filter"][data-author="${author}"]`).getAttribute('aria-pressed')==='true');
  }
  await click(p,'theory-filter','[data-author="all"]');
  check('all-author filter restores every screenshot card',await p.locator('.theory-card').count()===posts.length);
  const aside=await p.locator('#theory-aside-text').innerText();await click(p,'theory-shuffle');
  check('changing app commentary leaves all attributed source screenshots intact',await p.locator('#theory-aside-text').innerText()!==aside&&await p.locator('.theory-card').count()===posts.length);
  await p.evaluate(()=>{window.__copiedTheorySources=[];Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>window.__copiedTheorySources.push(text)});});
  await context.setOffline(true);
  const pagesBefore=context.pages().length,urlBefore=p.url();
  for(const post of [posts.find(x=>x.authorId==='sun'),posts.find(x=>x.authorId==='alan')]){
    await click(p,'theory-image',`[data-id="${post.id}"]`);
    const image=p.locator('.theory-lightbox img');await image.evaluate(e=>e.decode());
    check(`offline enlargement displays the selected ${post.authorId} screenshot`,await image.evaluate(e=>e.complete&&e.naturalWidth>=320)&&await image.getAttribute('src')===await p.locator(`.theory-card[data-post-id="${post.id}"] img`).getAttribute('src'));
    check(`offline enlargement stays within phone width for ${post.authorId}`,await p.locator('.modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth));
    await click(p,'theory-zoom');
    check(`offline ${post.authorId} screenshot supports scrollable full-size reading`,await p.locator('[data-action="theory-zoom"]').getAttribute('aria-pressed')==='true'&&await p.locator('.theory-lightbox').evaluate(e=>e.scrollWidth>e.clientWidth&&getComputedStyle(e).overflowX==='auto')&&await p.locator('.modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth));
    await click(p,'theory-zoom');
    check(`offline ${post.authorId} screenshot can return to screen-fitting size`,await p.locator('[data-action="theory-zoom"]').getAttribute('aria-pressed')==='false'&&await p.locator('.theory-lightbox').evaluate(e=>e.scrollWidth<=e.clientWidth));
    await close(p);await click(p,'theory-source',`[data-id="${post.id}"]`);
    await p.waitForFunction(source=>window.__copiedTheorySources.includes(source),post.sourceUrl);
    check(`copying ${post.authorId} source returns the exact source URL without navigation`,await p.evaluate(source=>window.__copiedTheorySources.at(-1)===source,post.sourceUrl)&&p.url()===urlBefore&&context.pages().length===pagesBefore);
  }
  await click(p,'theory-filter','[data-author="sun"]');await nav(p,'plans');await nav(p,'theory');
  await p.locator('.theory-card img').evaluateAll(async imgs=>{imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()));});
  check('offline return to theory keeps its bundled screenshots readable',await p.locator('.theory-card img').evaluateAll(imgs=>imgs.length>0&&imgs.every(i=>i.complete&&i.naturalWidth>=320)));
  await click(p,'theory-filter','[data-author="all"]');
  await p.locator('#toast').waitFor({state:'hidden'});
  for(const width of [320,390,430,1280]){
    await p.setViewportSize({width,height:844});
    check(`${width}px theory cards and author controls fit the viewport`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await p.locator('.theory-card').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
    if(width===1280){await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:path.join(output,'theory-desktop-full.png'),fullPage:true});}
    await click(p,'theory-image',`[data-id="${posts[0].id}"]`);await p.locator('.theory-lightbox img').evaluate(e=>e.decode());
    check(`${width}px enlarged theory screenshot fits its dialog`,await p.locator('.modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth));
    if(width===320||width===1280)await p.screenshot({path:path.join(output,`theory-enlarged-${width}.png`)});await close(p);
  }
  check('reading, filtering, enlarging and copying theory leaves all personal records unchanged',await saved(p)===before);
  check('theory and merged navigation have no unhandled JavaScript errors',errors.length===0);
  check('theory screenshots and copying sources make no external runtime requests',external.length===0);
}
async function customChecks(){
  let p=await load(null,390);await nav(p,'library');await click(p,'new-custom-exercise');
  check('photo creation exposes separate camera and gallery inputs',await p.locator('#exercise-camera').getAttribute('capture')==='environment'&&await p.locator('#exercise-camera').getAttribute('accept')==='image/*'&&await p.locator('#exercise-gallery').getAttribute('capture')===null);
  check('local image selection is the primary photo action',await p.locator('.photo-actions button').first().getAttribute('data-action')==='choose-exercise-photo'&&await p.locator('[data-action="choose-exercise-photo"]').innerText()==='选择本机图片');
  check('custom movement save button is reachable without scrolling the long form',await p.locator('#save-custom-exercise').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  for(const width of [320,390,430]){await p.setViewportSize({width,height:844});check(`${width}px local photo actions fit with touch-size buttons and reachable save`,await p.locator('.photo-actions').evaluate(e=>e.scrollWidth<=e.clientWidth)&&await p.locator('.photo-actions button, #save-custom-exercise').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>=48&&r.height>=48&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})));}
  // Label-only layout simulation; no LeanNative bridge or Android picker is mocked.
  await p.setViewportSize({width:320,height:844});await p.locator('[data-action="choose-exercise-photo"]').evaluate(e=>e.lastChild.textContent='从手机选择图片');
  check('320px simulated Android photo label fits beside its icon and camera action',await p.locator('.photo-actions').evaluate(e=>e.scrollWidth<=e.clientWidth)&&await p.locator('.photo-actions button, #save-custom-exercise').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return e.scrollWidth<=e.clientWidth&&r.width>=48&&r.height>=48&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})));
  await p.screenshot({path:path.join(output,'local-photo-native-label-320.png')});await p.locator('[data-action="choose-exercise-photo"]').evaluate(e=>e.lastChild.textContent='选择本机图片');await p.setViewportSize({width:390,height:844});
  await p.screenshot({path:path.join(output,'local-photo-editor-mobile.png')});
  await p.locator('#custom-exercise-name').fill('我的肩背<img src=x onerror=alert(1)>');await p.locator('#custom-exercise-group').selectOption('肩部');await p.locator('#custom-exercise-equipment').fill('单只哑铃，左右次数合计');await p.locator('#custom-exercise-hint').fill('这是测试学习笔记。');
  const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=1600;c.height=1200;const x=c.getContext('2d');x.fillStyle='#c8f577';x.fillRect(0,0,1600,1200);x.fillStyle='#19221a';x.fillRect(300,400,1000,300);return c.toDataURL('image/png').split(',')[1];});
  const sourcePhoto=path.join(output,'test-training-photo.png'),sourceBytes=Buffer.from(png,'base64');fs.writeFileSync(sourcePhoto,sourceBytes);
  const [galleryChooser]=await Promise.all([p.waitForEvent('filechooser'),click(p,'choose-exercise-photo')]);
  check('phone image button opens the single-image gallery file chooser',await galleryChooser.element().getAttribute('id')==='exercise-gallery'&&!galleryChooser.isMultiple());
  await galleryChooser.setFiles(sourcePhoto);
  await p.locator('#photo-status').filter({hasText:'照片已就绪'}).waitFor();await p.locator('#save-custom-exercise').click();
  let st=await state(p);const ex=st.customExercises[0];
  check('named custom movement and selected photo save locally',st.schemaVersion===2&&st.customExercises.length===1&&ex.name==='我的肩背<img src=x onerror=alert(1)>'&&ex.group==='肩部'&&ex.image.startsWith('data:image/jpeg;base64,'));
  check('custom movement names render markup as harmless text',await p.locator('.exercise-card h3').first().innerText()===ex.name&&await p.locator('img[src="x"]').count()===0);
  check('large chosen photo is stored as a compact image below 96 KB',Buffer.from(ex.image.split(',')[1],'base64').length<96*1024);
  const photo=p.locator('.exercise-card .exercise-picture img').first();await photo.evaluate(e=>e.decode());
  check('saved photo decodes at a maximum 960-pixel edge',await photo.evaluate(e=>e.complete&&e.naturalWidth>0&&Math.max(e.naturalWidth,e.naturalHeight)<=960));
  check('creating a compressed app copy does not modify the chosen source file',fs.readFileSync(sourcePhoto).equals(sourceBytes));fs.unlinkSync(sourcePhoto);
  await p.screenshot({path:path.join(output,'custom-movement-mobile.png')});
  const beforeCancelledEditor=await saved(p);await click(p,'detail',`[data-ex="${ex.id}"]`);await click(p,'edit-custom-exercise');
  const [emptyChooser]=await Promise.all([p.waitForEvent('filechooser'),click(p,'choose-exercise-photo')]);await emptyChooser.setFiles([]);
  check('an empty browser picker result preserves the current photo and saved data',await p.locator('#custom-photo-preview img').getAttribute('src')===ex.image&&await saved(p)===beforeCancelledEditor);
  const replacementPng=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=200;const x=c.getContext('2d');x.fillStyle='#ff7566';x.fillRect(0,0,200,200);return c.toDataURL('image/png').split(',')[1];});
  await p.locator('#custom-exercise-name').fill('尚未保存的新名字');await p.locator('#exercise-gallery').setInputFiles({name:'unsaved-photo.png',mimeType:'image/png',buffer:Buffer.from(replacementPng,'base64')});await p.locator('#photo-status').filter({hasText:'照片已就绪'}).waitFor();
  assert.notEqual(await p.locator('#custom-photo-preview img').getAttribute('src'),ex.image,'replacement fixture produces a different preview');await click(p,'close-modal');
  await click(p,'detail',`[data-ex="${ex.id}"]`);await click(p,'edit-custom-exercise');
  check('cancelling photo and name edits restores the saved movement unchanged',await saved(p)===beforeCancelledEditor&&await p.locator('#custom-photo-preview img').getAttribute('src')===ex.image&&await p.locator('#custom-exercise-name').inputValue()===ex.name);await click(p,'close-modal');
  await click(p,'detail',`[data-ex="${ex.id}"]`);await click(p,'edit-custom-exercise');await p.locator('#exercise-gallery').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await p.locator('#photo-status').filter({hasText:'无法读取'}).waitFor();await p.locator('#save-custom-exercise').click();
  check('an unreadable replacement photo preserves the saved original image',(await state(p)).customExercises[0].image===ex.image&&(await state(p)).customExercises.length===1);
  await click(p,'detail',`[data-ex="${ex.id}"]`);await click(p,'edit-custom-exercise');
  check('editing a stored movement photo offers direct removal',await p.locator('[data-action="remove-exercise-photo"]').isVisible());
  await p.evaluate(()=>{window.__jiboOriginalDecode=Image.prototype.decode;Image.prototype.decode=function(){return window.__jiboOriginalDecode.call(this).then(()=>new Promise(resolve=>setTimeout(resolve,1000)));};});
  await p.locator('#exercise-gallery').setInputFiles({name:'delayed-test-photo.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await click(p,'remove-exercise-photo');await p.waitForTimeout(1200);await p.evaluate(()=>{Image.prototype.decode=window.__jiboOriginalDecode;delete window.__jiboOriginalDecode;});
  check('removing a photo prevents late decoding from restoring it',await p.locator('#custom-photo-preview img').count()===0&&await p.locator('#save-custom-exercise').isEnabled());await p.locator('#save-custom-exercise').click();
  check('removed movement photo is omitted from saved data',(await state(p)).customExercises[0].image==='');
  await click(p,'detail',`[data-ex="${ex.id}"]`);await click(p,'edit-custom-exercise');await p.locator('#exercise-gallery').setInputFiles({name:'restored-test-photo.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await p.locator('#photo-status').filter({hasText:'照片已就绪'}).waitFor();await p.locator('#save-custom-exercise').click();
  check('a removed photo can be replaced by a fresh local selection',(await state(p)).customExercises[0].image===ex.image);
  await nav(p,'plans');await click(p,'new-custom-plan');await p.locator('#custom-plan-name').fill('我的肩背计划');await p.locator('#custom-plan-description').fill('每周按节奏安排，先练动作。');await p.locator('#custom-plan-duration').fill('35');
  await p.locator('#custom-plan-add-ex').selectOption(ex.id);await click(p,'plan-step-add');await p.locator('[data-plan-field="sets"]').first().fill('3');await p.locator('[data-plan-field="target"]').first().fill('10–12 次');await p.locator('[data-plan-field="restSeconds"]').first().fill('75');
  await p.locator('#custom-plan-add-ex').selectOption('push-up');await click(p,'plan-step-add');await click(p,'plan-step-up','[data-index="1"]');
  check('reordering plan movements preserves entered name and per-movement targets',await p.locator('#custom-plan-name').inputValue()==='我的肩背计划'&&await p.locator('[data-plan-field="sets"]').nth(1).inputValue()==='3'&&await p.locator('[data-plan-field="restSeconds"]').nth(1).inputValue()==='75');
  for(const width of [320,390,430]){await p.setViewportSize({width,height:844});check(`${width}px custom plan editor fits the phone modal`,await p.locator('.modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth));check(`${width}px custom plan save button remains in the viewport`,await p.locator('#custom-plan-form button[type="submit"]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));}
  await p.screenshot({path:path.join(output,'custom-plan-editor-mobile.png')});await p.locator('#custom-plan-form button[type="submit"]').click();
  st=await state(p);const plan=st.customPlans[0];
  check('custom plan saves ordered movements and training targets',st.customPlans.length===1&&plan.name==='我的肩背计划'&&plan.durationMinutes===35&&plan.blocks[0].exerciseId==='push-up'&&plan.blocks[1].exerciseId===ex.id&&plan.blocks[1].sets===3&&plan.blocks[1].target==='10–12 次'&&plan.blocks[1].restSeconds===75);
  await click(p,'plan-detail',`[data-plan="${plan.id}"]`);await click(p,'start-plan',`[data-plan="${plan.id}"]`);
  st=await state(p);check('starting a saved custom plan creates blank actual measurements',st.draft.blocks.length===2&&st.draft.blocks[1].sets.length===3&&st.draft.blocks.every(b=>b.sets.every(s=>s.weight===null&&s.reps===null&&s.seconds===null&&!s.done)));
  const activeDraft=JSON.stringify(st.draft),activeTargets=await p.locator('.target-note').allTextContents();
  await nav(p,'plans');await click(p,'edit-custom-plan',`[data-id="${plan.id}"]`);await p.locator('[data-plan-field="sets"]').nth(1).fill('5');await p.locator('[data-plan-field="restSeconds"]').nth(1).fill('105');await p.locator('#custom-plan-form button[type="submit"]').click();await nav(p,'home');
  check('editing a reusable plan preserves the active draft and target snapshot',JSON.stringify((await state(p)).draft)===activeDraft&&JSON.stringify(await p.locator('.target-note').allTextContents())===JSON.stringify(activeTargets)&&(await state(p)).customPlans[0].blocks[1].restSeconds===105);
  const beforeRestart=await saved(p);await context.close();await launch();p=await context.newPage();hook(p);await p.goto(origin+'/dist/lean-crew-offline.html');
  check('browser restart preserves custom photo, plan and active draft exactly',await saved(p)===beforeRestart&&await p.locator('.block').count()===2);
  const restartedPhoto=p.locator('.block').nth(1).locator('.block-thumb');await restartedPhoto.evaluate(e=>e.decode());
  check('saved local photo still decodes after source file deletion and browser restart',!fs.existsSync(sourcePhoto)&&await restartedPhoto.getAttribute('src')===ex.image&&await restartedPhoto.evaluate(e=>e.complete&&e.naturalWidth>0));
  const customBlock=p.locator('.block').nth(1);await customBlock.locator('[data-field="weight"]').first().fill('10');await customBlock.locator('[data-field="reps"]').first().fill('12');await customBlock.locator('[data-action="toggle-set"]').first().click();await finish(p);await close(p);
  check('custom movement training archives with its actual measurement',(await state(p)).sessions.length===1&&(await state(p)).sessions[0].blocks[1].sets[0].weight===10&&(await state(p)).sessions[0].blocks[1].sets[0].done);
  await nav(p,'library');await click(p,'filter','[data-group="自建"]');await click(p,'detail',`[data-ex="${ex.id}"]`);await click(p,'edit-custom-exercise');
  check('recorded custom movement cannot silently change measurement mode',await p.locator('#custom-exercise-mode').isDisabled());await click(p,'close-modal');
  const protectedData=await saved(p);await click(p,'detail',`[data-ex="${ex.id}"]`);await click(p,'delete-custom-exercise');await click(p,'confirm');
  check('deleting a referenced movement cannot remove training history or photo',await saved(p)===protectedData&&await p.locator('#modal').isVisible());await click(p,'close-modal');
  await click(p,'settings');await downloads(p);await click(p,'export-json');const backup=await p.evaluate(async()=>window.__testDownloads[0].text());
  check('JSON backup contains complete photo, reusable plan and archived training',JSON.stringify(JSON.parse(backup))===JSON.stringify(await state(p))&&JSON.parse(backup).customExercises[0].image===ex.image);
  await p.locator('#import-file').setInputFiles({name:'custom-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(backup)});await p.locator('#modal').waitFor({state:'visible'});await click(p,'confirm');
  check('custom image and plan backup imports without losing fields',JSON.stringify(await state(p))===JSON.stringify(JSON.parse(backup)));
  const archivedBeforeDelete=JSON.stringify((await state(p)).sessions);await nav(p,'plans');await click(p,'plan-location','[data-location="custom"]');await click(p,'plan-detail',`[data-plan="${plan.id}"]`);await click(p,'start-plan',`[data-plan="${plan.id}"]`);
  const draftBeforeDelete=JSON.stringify((await state(p)).draft),targetsBeforeDelete=await p.locator('.target-note').allTextContents();await nav(p,'plans');await click(p,'plan-detail',`[data-plan="${plan.id}"]`);await click(p,'delete-custom-plan');await click(p,'confirm');await nav(p,'home');
  check('deleting a reusable plan preserves active and archived training snapshots',(await state(p)).customPlans.length===0&&JSON.stringify((await state(p)).sessions)===archivedBeforeDelete&&JSON.stringify((await state(p)).draft)===draftBeforeDelete&&JSON.stringify(await p.locator('.target-note').allTextContents())===JSON.stringify(targetsBeforeDelete));
  const legacy=await p.evaluate(()=>{const s=LeanCore.emptyState();s.schemaVersion=1;delete s.customExercises;delete s.customPlans;const historical=LeanCore.newDraft('2026-09-14');historical.blocks=[LeanCore.newBlock('chest-press')];Object.assign(historical.blocks[0].sets[0],{weight:20,reps:12,done:true});s.sessions=[historical];return s;});
  await p.close();p=await load(JSON.stringify(legacy));await nav(p,'progress');await click(p,'history');
  check('an existing schema-1 backup opens with its original archived training',await p.locator('#modal').innerText().then(t=>t.includes('20 kg × 12 次'))&&await saved(p)===JSON.stringify(legacy));await close(p);
  await nav(p,'library');await click(p,'new-custom-exercise');await p.locator('#custom-exercise-name').fill('迁移验收动作');await p.locator('#save-custom-exercise').click();
  check('first custom save migrates schema 1 without changing historical records',(await state(p)).schemaVersion===2&&(await state(p)).customExercises.length===1&&JSON.stringify((await state(p)).sessions)===JSON.stringify(legacy.sessions));
  check('custom content regression has no unhandled JavaScript errors',errors.length===0);check('custom content regression makes no external runtime requests',external.length===0);
}
async function mobileChecks(){
  const visibleRect=(p,selector)=>p.locator(selector).first().evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};});
  const timerSeconds=async p=>{const [m,s]=(await p.locator('#timer strong').innerText()).split(':').map(Number);return m*60+s;};
  let p=await load(null,390);
  await nav(p,'plans');await click(p,'plan-detail','[data-plan="gym-a"]');await click(p,'start-plan','[data-plan="gym-a"]');
  check('starting a plan opens the phone workout focus view',await p.locator('body').evaluate(e=>e.classList.contains('training-focus'))&&await p.locator('.workout-focus').isVisible());
  const pristine=await saved(p);
  await click(p,'workout-overview');
  check('leaving workout focus retains the complete unarchived draft',await saved(p)===pristine&&await p.locator('body').evaluate(e=>!e.classList.contains('training-focus')));
  await click(p,'continue-workout');
  check('resuming workout restores focus with identical draft data',await saved(p)===pristine&&await p.locator('.workout-focus').isVisible());
  await p.locator('.block').nth(3).scrollIntoViewIfNeeded();
  const scrolled=await p.evaluate(()=>scrollY);await nav(p,'library');await nav(p,'home');
  await p.waitForFunction(expected=>Math.abs(scrollY-expected)<8,scrolled);
  check('returning from the movement library restores training scroll position',await saved(p)===pristine&&Math.abs(await p.evaluate(()=>scrollY)-scrolled)<8);
  for(const width of [320,360,390,430]){
    await p.setViewportSize({width,height:844});
    check(`${width}px focused workout fits the phone width`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight/2,behavior:'instant'}));
    const dock=await visibleRect(p,'.workout-dock'),navRect=await visibleRect(p,'.mobile-nav');
    check(`${width}px archive action remains reachable above the bottom navigation`,dock.top>=0&&dock.bottom<=navRect.top+1&&await p.locator('.workout-dock [data-action="finish"]').isVisible());
    const targets=await p.locator('.mobile-nav [data-nav], .workout-dock button, .set-row .check, .set-row [data-action="remove-set"], .block-footer [data-action="add-set"]').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,name:e.getAttribute('aria-label')||e.textContent.trim()})));
    check(`${width}px routine training touch targets are at least 48 by 48 CSS pixels`,targets.length>0&&targets.every(t=>t.w>=47.9&&t.h>=47.9));
    check(`${width}px training measurement inputs use readable 16px text and numeric keyboards`,await p.locator('[data-field]').evaluateAll(es=>es.length>0&&es.every(e=>parseFloat(getComputedStyle(e).fontSize)>=16&&['numeric','decimal'].includes(e.inputMode))));
    await p.screenshot({path:path.join(output,`phone-workout-${width}.png`)});
  }
  await p.setViewportSize({width:390,height:844});
  await p.locator('[data-action="toggle-set"]').first().click();
  check('an invalid empty set does not trigger automatic rest',await p.locator('#timer').isHidden()&&!(await state(p)).draft.blocks[0].sets[0].done);
  await p.locator('[data-field="weight"]').first().fill('20');await p.locator('[data-field="reps"]').first().fill('12');await p.locator('[data-action="toggle-set"]').first().click();
  check('completing a planned set automatically starts its 120-second rest',await p.locator('#timer').isVisible()&&await timerSeconds(p)>=117&&await timerSeconds(p)<=120);
  const secondsBefore=await timerSeconds(p);await click(p,'add-rest');
  check('rest can be extended by fifteen seconds',await timerSeconds(p)>=secondsBefore+13&&await timerSeconds(p)<=secondsBefore+15);
  await click(p,'stop-timer');await p.locator('[data-action="toggle-set"]').first().click();
  check('undoing set completion does not start a new timer',await p.locator('#timer').isHidden()&&!(await state(p)).draft.blocks[0].sets[0].done);
  await click(p,'toggle-auto-rest');await p.locator('[data-action="toggle-set"]').first().click();
  check('automatic rest can be disabled while recording still works',await p.locator('#timer').isHidden()&&(await state(p)).draft.blocks[0].sets[0].done);
  await p.reload();await p.locator('[data-action="toggle-set"]').first().click();await p.locator('[data-action="toggle-set"]').first().click();
  check('disabled automatic-rest preference survives a page reload',await p.locator('#timer').isHidden());
  await click(p,'toggle-auto-rest');await p.locator('[data-action="toggle-set"]').first().click();await p.locator('[data-action="toggle-set"]').first().click();
  const trainingBeforeRestart=await saved(p),restBeforeRestart=await timerSeconds(p);
  await context.close();await launch();p=await context.newPage();hook(p);await p.goto(origin+'/dist/lean-crew-offline.html');
  check('browser restart restores the draft and its existing rest deadline',await saved(p)===trainingBeforeRestart&&await p.locator('#timer').isVisible()&&await timerSeconds(p)<=restBeforeRestart&&await timerSeconds(p)>=restBeforeRestart-15);
  await click(p,'stop-timer');check('skip rest immediately dismisses the timer',await p.locator('#timer').isHidden());
  await p.locator('[data-field="weight"]').first().focus();
  await p.evaluate(()=>window.LeanKeyboardChanged(true));
  check('simulated native keyboard-open signal hides navigation and the workout dock',await p.locator('body').evaluate(e=>e.classList.contains('keyboard-open'))&&await p.locator('.mobile-nav').isHidden()&&await p.locator('.workout-dock').isHidden());
  await p.evaluate(()=>{document.activeElement.blur();window.LeanKeyboardChanged(false);});
  check('simulated native keyboard-close signal restores controls without changing training data',await p.locator('.mobile-nav').isVisible()&&await p.locator('.workout-dock').isVisible()&&await saved(p)===trainingBeforeRestart);
  await p.screenshot({path:path.join(output,'phone-focus-restored.png')});
  const beforeArchive=await saved(p);await p.locator('.workout-dock [data-action="finish"]').click();
  check('phone finish first presents a review confirmation and keeps the draft',await p.locator('#modal [data-action="confirm"]').isVisible()&&await saved(p)===beforeArchive);
  await click(p,'close-modal');check('cancelling phone archive leaves the full draft intact',await saved(p)===beforeArchive);
  await p.locator('.workout-dock [data-action="finish"]').click();await click(p,'confirm');await close(p);
  check('confirmed phone archive saves once and clears the focus draft',(await state(p)).sessions.length===1&&(await state(p)).draft===null);
  await nav(p,'library');
  check('movement search text is readable at phone size',await p.locator('#exercise-search').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
  await nav(p,'food');await p.locator('#food-name').fill('手机输入测试');
  await p.setViewportSize({width:390,height:450});await p.locator('#food-name').focus();await p.locator('#food-name').scrollIntoViewIfNeeded();
  check('reduced phone viewport preserves the active text input and has no horizontal overflow',await p.locator('#food-name').inputValue()==='手机输入测试'&&await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:path.join(output,'phone-reduced-viewport.png')});
  await p.setViewportSize({width:390,height:844});await nav(p,'food');
  check('restoring the viewport retains unfinished food form text',await p.locator('#food-name').inputValue()==='手机输入测试');
  check('phone regression has no unhandled JavaScript errors',errors.length===0);
  check('phone regression makes no external runtime requests',external.length===0);
}
async function pwaChecks(){
  let p=await context.newPage();hook(p);
  let response=await p.goto(origin+'/index.html');
  check('source index loads from independent loopback server',response.status()===200);
  check('source app loads 肌薄 plans and all 17 exercises',await p.evaluate(()=>LEAN_PLANS.length===6&&LEAN_EXERCISES.length===17)&&await p.locator('.brand strong').innerText()==='肌薄');
  await p.waitForFunction(()=>navigator.serviceWorker.controller!==null,{},{timeout:20000});
  const registration=await p.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return {scope:r.scope,state:r.active?.state,scriptURL:r.active?.scriptURL,controller:navigator.serviceWorker.controller?.scriptURL};});
  check('service worker activates and controls source app',registration.state==='activated'&&registration.scope===origin+'/'&&registration.controller===origin+'/sw.js');
  const sw=fs.readFileSync(path.join(root,'web/sw.js'),'utf8');
  const cacheName=JSON.parse(sw.match(/const CACHE = ("[^"]+");/)[1]);
  const assets=JSON.parse(sw.match(/const ASSETS = (\[[^;]+\]);/)[1]);
  const cache=await p.evaluate(async name=>{const c=await caches.open(name);const keys=await c.keys();return {names:await caches.keys(),urls:keys.map(r=>r.url)};},cacheName);
  check('active service-worker cache uses generated content hash',cache.names.includes(cacheName)&&/^lean-crew-[a-f0-9]{12}$/.test(cacheName));
  check('all declared source assets are precached',assets.every(a=>cache.urls.includes(new URL(a,origin+'/').href)));
  check('plans script and dumbbell-row SVG are precached',cache.urls.includes(origin+'/plans.js')&&cache.urls.includes(origin+'/assets/dumbbell-row.svg'));
  const cdp=await context.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await context.setOffline(true);
  const offlineResponses=[];p.on('response',r=>offlineResponses.push({url:r.url(),fromServiceWorker:r.fromServiceWorker(),status:r.status()}));
  response=await p.reload({waitUntil:'load'});
  check('offline reload is served by service worker with HTTP cache disabled',response.fromServiceWorker()&&response.status()===200);
  check('offline home renders brand and weekly training overview',await p.locator('.brand strong').innerText()==='肌薄'&&await p.locator('.week-value').isVisible());
  await p.locator('.hero-mark').evaluate(i=>i.decode());check('offline home illustration decodes',await p.locator('.hero-mark').evaluate(i=>i.complete&&i.naturalWidth>0));
  check('offline app scripts, plans and theory load from service-worker cache',['app.js','core.js','exercises.js','plans.js','theory.js','styles.css'].every(file=>offlineResponses.some(r=>r.url===origin+'/'+file&&r.fromServiceWorker&&r.status===200)));
  await p.screenshot({path:path.join(output,'offline-home.png')});
  await nav(p,'plans');check('offline plans remain interactive',await p.locator('.plan-card').count()===3);await click(p,'plan-detail','[data-plan="gym-a"]');await click(p,'start-plan','[data-plan="gym-a"]');
  const offlineDraft=await saved(p);check('offline plan creation saves a blank six-movement draft',(await state(p)).draft.blocks.length===6&&(await state(p)).draft.blocks.every(b=>b.sets.length===2&&b.sets.every(s=>!s.done&&s.reps===null&&s.weight===null&&s.seconds===null)));
  await nav(p,'library');await p.evaluate(async()=>{const imgs=[...document.querySelectorAll('.exercise-picture img')];imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()))});
  check('all 17 exercise illustrations decode while browser is offline',await p.locator('.exercise-card').count()===17&&await p.evaluate(()=>[...document.querySelectorAll('.exercise-picture img')].every(i=>i.complete&&i.naturalWidth>0)));
  check('new dumbbell row illustration is served by service worker offline',offlineResponses.some(r=>r.url===origin+'/assets/dumbbell-row.svg'&&r.fromServiceWorker&&r.status===200));
  await p.screenshot({path:path.join(output,'offline-library.png')});
  await nav(p,'theory');
  const theoryPosts=await p.evaluate(()=>JIBO_THEORY_POSTS);
  check('all theory screenshot source files are explicitly precached',theoryPosts.length>0&&theoryPosts.every(post=>cache.urls.includes(new URL(post.image,origin+'/').href)));
  await p.locator('.theory-card img').evaluateAll(async imgs=>{imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()));});
  check('every theory screenshot decodes offline using the service-worker cache',await p.locator('.theory-card img').count()===theoryPosts.length&&await p.locator('.theory-card img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>=320))&&theoryPosts.every(post=>offlineResponses.some(r=>r.url===new URL(post.image,origin+'/').href&&r.fromServiceWorker&&r.status===200)));
  await p.screenshot({path:path.join(output,'offline-theory.png')});
  await context.close();await launch();await context.setOffline(true);p=await context.newPage();hook(p);response=await p.goto(origin+'/index.html',{waitUntil:'load'});
  check('independent browser restart can open source app while offline',response.fromServiceWorker()&&await p.locator('.brand strong').innerText()==='肌薄');
  check('offline-created draft survives independent browser restart',await saved(p)===offlineDraft&&await p.locator('.block').count()===6);
  await nav(p,'theory');await p.locator('.theory-card img').evaluateAll(async imgs=>{imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()));});
  check('theory screenshots remain readable after an offline browser restart',await p.locator('.theory-card img').count()===theoryPosts.length&&await p.locator('.theory-card img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>=320))&&await saved(p)===offlineDraft);
  check('offline PWA run has no unhandled JavaScript errors',errors.length===0);check('offline PWA run makes no external requests',external.length===0);
  fs.writeFileSync(path.join(output,'pwa-evidence.json'),JSON.stringify({origin,registration,cacheName,declaredAssets:assets.length,cachedAssets:cache.urls,offlineResponses,httpCacheDisabled:true,offlineBrowserRestart:true},null,2));
}
async function plans(p){
  await nav(p,'home');
  check('product name is 肌薄',(await p.locator('.brand strong').innerText()).trim()==='肌薄');
  check('new user weekly count is zero',(await p.locator('.week-value strong').innerText()).trim()==='0');
  await nav(p,'plans');
  check('gym has three A/B/C plan cards',await p.locator('.plan-card').count()===3&&await p.locator('.plan-card [data-plan="gym-a"]').count()===1&&await p.locator('.plan-card [data-plan="gym-b"]').count()===1&&await p.locator('.plan-card [data-plan="gym-c"]').count()===1);
  await click(p,'plan-location','[data-location="home"]');
  check('home has three A/B/C plan cards',await p.locator('.plan-card').count()===3&&await p.locator('.plan-card [data-plan="home-a"]').count()===1&&await p.locator('.plan-card [data-plan="home-b"]').count()===1&&await p.locator('.plan-card [data-plan="home-c"]').count()===1);
  await click(p,'plan-location','[data-location="gym"]');
  await click(p,'plan-detail','[data-plan="gym-a"]');
  check('plan preview includes all six movements',await p.locator('.plan-detail-row').count()===6);
  await click(p,'start-plan','[data-plan="gym-a"]');
  const fresh=await state(p);
  check('plan starts six exercises with two blank incomplete sets each',fresh.draft.blocks.length===6&&fresh.draft.blocks.every(b=>b.sets.length===2&&b.sets.every(s=>s.weight===null&&s.reps===null&&s.seconds===null&&s.done===false)));
  check('target guidance never pre-fills actual measurement inputs',await p.locator('[data-field]').evaluateAll(es=>es.every(e=>e.value==='')));
  check('each plan movement displays target guidance',await p.locator('.target-note').count()===6);
  await click(p,'workout-overview');check('starting a plan never credits weekly completion',(await p.locator('.week-value strong').innerText()).trim()==='0');await click(p,'continue-workout');
  await click(p,'toggle-set');check('blank planned set cannot be marked complete',!(await state(p)).draft.blocks[0].sets[0].done);
  const planSaved=await saved(p);await p.reload();
  check('real reload preserves entire planned draft and target guidance',await saved(p)===planSaved&&await p.locator('.target-note').count()===6);
  await click(p,'workout-overview');await click(p,'continue-workout');check('continue workout returns to the current draft without replacement',await saved(p)===planSaved&&await p.locator('.workout-focus').isVisible());
  await click(p,'start-timer','[data-seconds="120"]');
  check('rest timer uses the selected template interval',await p.locator('#timer').isVisible()&&['02:00','01:59'].includes(await p.locator('#timer strong').innerText()));
  await click(p,'stop-timer');check('rest timer can be dismissed',await p.locator('#timer').isHidden());
  await nav(p,'plans');await click(p,'plan-detail','[data-plan="gym-b"]');await click(p,'start-plan','[data-plan="gym-b"]');
  check('replacing any planned draft requires confirmation',await p.locator('#modal [data-action="confirm"]').count()===1&&await saved(p)===planSaved);
  await click(p,'close-modal');check('cancelling replacement preserves draft byte for byte',await saved(p)===planSaved);
  await click(p,'plan-detail','[data-plan="gym-c"]');await click(p,'start-plan','[data-plan="gym-c"]');await click(p,'confirm');
  check('confirmed replacement changes only current draft',(await state(p)).draft.id!==fresh.draft.id&&(await state(p)).sessions.length===0&&await p.evaluate(()=>LeanCore.sessionPlanId(JSON.parse(localStorage.getItem('lean-crew-local-v1')).draft))==='gym-c');
  await click(p,'discard-draft');await click(p,'confirm');
  await nav(p,'plans');await click(p,'plan-detail','[data-plan="gym-a"]');await click(p,'start-plan','[data-plan="gym-a"]');
  await p.locator('.block').first().locator('[data-field="weight"]').first().fill('20');await p.locator('.block').first().locator('[data-field="reps"]').first().fill('12');await p.locator('.block').first().locator('[data-action="toggle-set"]').first().click();
  await p.locator('#draft-note').fill('肩背发力稳定，下次继续。');await p.reload();check('editing visible plan notes preserves plan identity and targets',await p.locator('#draft-note').inputValue()==='肩背发力稳定，下次继续。'&&await p.evaluate(()=>LeanCore.sessionPlanId(JSON.parse(localStorage.getItem('lean-crew-local-v1')).draft))==='gym-a'&&await p.locator('.target-note').count()===6);
  await click(p,'workout-overview');check('a completed draft set still awaits archive for weekly credit',(await p.locator('.week-value strong').innerText()).trim()==='0');await click(p,'continue-workout');
  await finish(p);await close(p);
  check('archiving a completed training day credits exactly one day',(await p.locator('.week-value strong').innerText()).trim()==='1');
  await nav(p,'plans');check('archived A advances recommendation to gym B',await p.locator('.plan-card.recommended [data-plan="gym-b"]').count()===1);
  await click(p,'plan-location','[data-location="home"]');check('switching scene preserves next rotation letter B',await p.locator('.plan-card.recommended [data-plan="home-b"]').count()===1);
  await click(p,'plan-detail','[data-plan="home-b"]');await click(p,'start-plan','[data-plan="home-b"]');
  const rowIndex=(await state(p)).draft.blocks.findIndex(b=>b.exerciseId==='dumbbell-row');assert.ok(rowIndex>=0,'home B includes dumbbell row');const row=p.locator('.block').nth(rowIndex);
  await row.locator('[data-field="weight"]').first().fill('10');await row.locator('[data-field="reps"]').first().fill('20');await row.locator('[data-action="toggle-set"]').first().click();
  const rowStats=await p.evaluate(()=>LeanCore.sessionStats(JSON.parse(localStorage.getItem('lean-crew-local-v1')).draft,LEAN_EXERCISES));
  check('single-arm row uses entered combined reps exactly once',rowStats.volume===200&&rowStats.reps===20&&rowStats.sets===1);
  await p.screenshot({path:path.join(output,'home-plan-workout-mobile.png')});
  await finish(p);await close(p);check('two archives on one date still count as one training day',(await p.locator('.week-value strong').innerText()).trim()==='1');
  await nav(p,'plans');check('completed home B advances to home C',await p.locator('.plan-card.recommended [data-plan="home-c"]').count()===1);
  await p.screenshot({path:path.join(output,'plans-mobile.png')});
  await nav(p,'library');await click(p,'add-ex','[data-ex="push-up"]');await nav(p,'home');await p.locator('[data-field="reps"]').first().fill('7');const customSaved=await saved(p);
  await nav(p,'plans');await click(p,'plan-detail','[data-plan="home-a"]');await click(p,'start-plan','[data-plan="home-a"]');await click(p,'close-modal');
  check('freeform draft values also survive cancelled plan replacement',await saved(p)===customSaved);
  await nav(p,'home');await click(p,'discard-draft');await click(p,'confirm');
}
(async()=>{let failure;try{await main()}catch(e){failure=String(e.stack||e);console.error(failure);process.exitCode=1;if(context){const page=context.pages().at(-1);if(page){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error('OVERFLOW:',await page.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1||e.left< -1)).catch(()=>[]));}}}finally{
  if(context)await context.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));
  const report={mode:pwaOnly?'Chrome source web/ on isolated loopback; installed service worker; actual offline reload with HTTP cache disabled; offline browser restart':mobileOnly?'Chrome phone-sized CSS viewports on isolated loopback; actual persistent localStorage and independent browser restart; reduced viewport is not a real mobile keyboard':customOnly?'Chrome custom movement and plan flow; actual file-input image decode and compact raster storage; isolated persistent localStorage and browser restart; no real device camera or Android picker':theoryOnly?'Chrome merged plan/progress and local theory screenshot flow; actual localStorage; offline rendering and enlargement; intercepted clipboard, no external navigation':'Chrome loopback with real persistent localStorage, reload and independent browser restart; downloads intercepted',passed:checks.length,checks,unhandled_errors:errors,external_requests:external,failure:failure||null,not_verified:['Android compilation/signing/device install','Android AtomicFile and document picker','Android soft keyboard and device touch accuracy','Native or OS clipboard', 'file:// browser persistence',pwaOnly?'PWA OS installation/standalone launch integration':'PWA installation/service-worker cache','OS-level download saving']};
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:checks.length,output,failure:failure||null}));
}})();
'''
raise SystemExit(subprocess.run([args.node, '-e', SCRIPT], env=env).returncode)
