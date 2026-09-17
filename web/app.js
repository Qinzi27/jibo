/* 肌薄: offline UI, transactional local persistence, no analytics. */
(function () {
  'use strict';
  const C = window.LeanCore;
  const BASE_EX = window.LEAN_EXERCISES, BASE_PLANS = window.LEAN_PLANS;
  let EX = BASE_EX, PLANS = BASE_PLANS, EX_MAP = new Map(EX.map(e=>[e.id,e]));
  function refreshCatalog() { EX=C.allExercises(state,BASE_EX);PLANS=C.allPlans(state,BASE_PLANS);EX_MAP=new Map(EX.map(e=>[e.id,e])); }
  const STORE = 'lean-crew-local-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (n, p = 1) => C.round(n, p).toLocaleString('zh-CN', {maximumFractionDigits:p});
  const today = () => C.localDate();
  const isNative = () => !!window.LeanNative;
  const paths = {
    dumbbell:'<path d="M6 7v10M3 9v6m15-8v10m3-8v6M6 12h12"/>',
    home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
    book:'<path d="M12 5v16M12 5C8 2 3 4 3 4v15s5-2 9 2c4-4 9-2 9-2V4s-5-2-9 1Z"/>',
    food:'<path d="M5 3v7m3-7v7M2 3v7c0 3 6 3 6 0M5 13v8M17 3c-4 4-4 9 1 9V3h1v18"/>',
    chart:'<path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/>',
    settings:'<path d="m9 3-1 3-3 1 1 3-2 2 2 3-1 3 3 1 1 2h5l1-2 3-1-1-3 2-3-2-2 1-3-3-1-1-3Z"/><circle cx="11.5" cy="12" r="3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    x:'<path d="m6 6 12 12M18 6 6 18"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/>',
    clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6m-3 0v3"/>',
    copy:'<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M5 17H3V3h12v2"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload:'<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
    trophy:'<path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H3v3c0 3 2 4 5 4m8-7h5v3c0 3-2 4-5 4M12 13v6m-5 2h10m-9-2h8"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    edit:'<path d="m4 15 11-11 5 5L9 20l-6 1ZM13 6l5 5"/>'
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  const localImage = path => window.LEAN_EMBEDDED_IMAGES?.[path] || path;
  const quotes = ['稳稳完成一组，也是在向前。','今天练得认真，明天休息得踏实。','把动作做好，让记录慢慢累积。','不赶进度，找到自己的节奏。','今天的自己，就是最好的参照。','每一次真实记录，都值得留下。'];
  let state = C.emptyState();
  let bootError = '';
  let damagedRaw = '';
  let storageBlocked = false;
  let planLocation = 'gym', planView = 'plans';
  let tab = 'home', group = '全部', search = '', foodDate = today();
  let toastTimer, timerInterval, timerEnd = 0, returnFocus = null;
  let revision = 0, importTicket = 0, loadingImport = false;
  let pendingAction = null;
  let pendingModalAction = null;
  let lastReport = null;
  const foodForm = {name:'', unit:'g', quantity:'', kcal100:'', protein100:'', remember:true};

  function readStorage() {
    const raw = isNative() ? window.LeanNative.read() : localStorage.getItem(STORE);
    if (raw && raw !== 'null') state = C.parseBackup(raw, BASE_EX);
    return raw;
  }
  try { readStorage(); }
  catch (error) {
    bootError = '本地存储无法正常读取，已暂停写入，以免覆盖可能存在的记录。请先导出可读取的原始数据，再修复或重置。';
    try { damagedRaw = isNative() ? window.LeanNative.read() : localStorage.getItem(STORE) || ''; } catch (_) {}
    if (damagedRaw === 'ERROR_READING_EXISTING_LOCAL_DATA') { damagedRaw = ''; bootError = '设备无法读取原始数据文件，已暂停写入。请先检查设备存储；不要直接卸载或清空。'; }
    storageBlocked = true;
  }
  refreshCatalog();
  const RUNTIME_KEY='jibo-runtime-v1';
  let runtime={autoRest:true,timerEnd:0,draftId:null,workoutScroll:0}, overview=false;
  const navScroll={};
  try {
    const raw=isNative()&&window.LeanNative.readRuntime?window.LeanNative.readRuntime():localStorage.getItem(RUNTIME_KEY);
    const saved=raw?JSON.parse(raw):{};
    runtime.autoRest=saved.autoRest!==false;
    if(saved.draftId===state.draft?.id){runtime.draftId=saved.draftId;runtime.workoutScroll=Math.max(0,Math.min(200000,Number(saved.workoutScroll)||0));}
    if(Number.isFinite(saved.timerEnd)&&saved.timerEnd>Date.now()-3600000&&saved.timerEnd<Date.now()+3600000&&saved.draftId===(state.draft?.id||null))runtime.timerEnd=saved.timerEnd;
  }catch(_){}
  timerEnd=runtime.timerEnd;
  function saveRuntime() {
    runtime.timerEnd=timerEnd;runtime.draftId=state.draft?.id||null;
    const json=JSON.stringify(runtime);
    try {if(isNative()&&window.LeanNative.writeRuntime)window.LeanNative.writeRuntime(json);else localStorage.setItem(RUNTIME_KEY,json);}catch(_){}
  }
  function activeWorkout() { return tab==='home'&&!overview&&!!state.draft?.blocks.length; }
  function syncBackState() { if(isNative()&&window.LeanNative.setBackEnabled)window.LeanNative.setBackEnabled(!$('#modal').hidden||tab!=='home'||activeWorkout()); }
  function navScrollKey() { return tab==='plans'?`plans:${planView}`:tab; }
  function rememberScroll() { if(activeWorkout()){runtime.workoutScroll=window.scrollY;saveRuntime();}else navScroll[navScrollKey()]=window.scrollY; }
  function blockTarget(block) {
    const match=block.note.match(/^建议 (\d+) 组 × (.*?)；组间休息 (\d+) 秒。/);
    return match?{sets:Number(match[1]),target:match[2],restSeconds:Number(match[3])}:null;
  }
  function workoutPage() {
    const draft=state.draft,stats=C.sessionStats(draft,EX),total=draft.blocks.reduce((n,b)=>n+b.sets.length,0);
    const name=C.sessionPlanId(draft)?visibleNote(draft).split('\n')[0]:'自由训练';
    return `<section class="workout-focus"><div class="workout-titlebar"><button class="btn btn-ghost btn-small" data-action="workout-overview">← 训练概览</button><span class="chip">草稿自动保存</span></div><div class="workout-title"><div class="eyebrow">IN YOUR OWN RHYTHM</div><h1>${esc(name||'本次训练')}</h1><div class="workout-progress"><span id="workout-progress-count">${stats.sets} / ${total} 组完成</span><span>${draft.blocks.length} 个动作</span></div><div class="workout-meter"><span id="workout-progress-bar" style="width:${total?stats.sets/total*100:0}%"></span></div></div><div class="workout-tools"><button class="btn btn-secondary btn-small" data-action="toggle-auto-rest" aria-pressed="${runtime.autoRest}">${icon('clock')}自动休息：${runtime.autoRest?'开':'关'}</button><button class="btn btn-ghost btn-small" data-action="timer">手动计时</button></div><div class="section-head" id="workout-heading"><h2>本次记录 <span class="pill-label" id="draft-count">${stats.sets} 组完成</span></h2><button class="btn btn-ghost btn-small" data-nav="library">${icon('plus')}加动作</button></div><div id="draft-area">${draftHTML()}</div><div class="workout-dock"><div><strong id="dock-set-count">${stats.sets} 组已完成</strong><small>修改已保存在本机</small></div><button class="btn btn-primary" data-action="finish">结束训练 ${icon('check')}</button></div></section>`;
  }
  function requestFinish() {
    if(!checkVisibleInputs())return;
    const result=C.archive(state,EX),stats=C.sessionStats(result.session,EX);
    const total=result.session.blocks.reduce((n,b)=>n+b.sets.length,0),expectedRevision=revision;
    modal('<div class="eyebrow">WORKOUT COMPLETE</div><h2>把这次训练留下来。</h2>', `<div class="finish-summary"><strong>${stats.sets}<small> 组已完成</small></strong><p>${stats.exercises} 个已练动作 · ${stats.reps} 次${stats.seconds?' · '+stats.seconds+' 秒':''}</p></div><p class="notice">${total>stats.sets?`还有 ${total-stats.sets} 组未标记完成。只统计已完成的组，未完成内容保留为记录，不计入训练量。`:'完成数据已核对，可以归档。'}</p><div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">继续训练</button><button class="btn btn-primary" data-action="confirm">保存并结束</button></div>`);
    pendingModalAction=()=>{if(revision!==expectedRevision)throw new Error('训练数据刚刚有变化，请关闭后重新确认。');commit(result.state);stopTimer();overview=false;closeModal();render();report(result.session);};
  }
  function stopTimer() {clearInterval(timerInterval);timerInterval=null;timerEnd=0;$('#timer').hidden=true;saveRuntime();}
  let nativeKeyboard=false,keyboardBaseline=window.innerHeight;
  function syncKeyboard() {
    const viewport=window.visualViewport;
    const focused=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
    const shrunk=viewport?keyboardBaseline-viewport.height>140:false;
    const open=nativeKeyboard||(focused&&shrunk);
    document.body.classList.toggle('keyboard-open',open);
    document.documentElement.style.setProperty('--keyboard-inset',`${open&&!isNative()&&viewport?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0}px`);
  }
  window.LeanKeyboardChanged=function(visible){nativeKeyboard=!!visible;syncKeyboard();};
  window.visualViewport?.addEventListener('resize',syncKeyboard);
  window.addEventListener('resize',()=>{if(!document.body.classList.contains('keyboard-open'))keyboardBaseline=Math.max(keyboardBaseline,window.innerHeight);syncKeyboard();});
  document.addEventListener('focusin',syncKeyboard);
  document.addEventListener('focusout',()=>setTimeout(syncKeyboard,0));
  let scrollSaveTimer;
  window.addEventListener('scroll',()=>{if(!activeWorkout())return;clearTimeout(scrollSaveTimer);scrollSaveTimer=setTimeout(rememberScroll,180);},{passive:true});
  window.addEventListener('pagehide',rememberScroll);

  function commit(next, allowReset = false) {
    if (storageBlocked && !allowReset) throw new Error('当前存储处于保护状态。请到设置导出原始数据并处理。');
    const checked = C.validateState(next, BASE_EX);
    const json = JSON.stringify(checked);
    if (new TextEncoder().encode(json).length > C.MAX_BACKUP_BYTES) throw new Error('记录接近 4 MB 上限。请先备份并清理旧记录。');
    if (isNative()) {
      const ok = window.LeanNative.write(json);
      if (!ok) throw new Error('设备未能保存。原记录没有被替换，请导出备份后重试。');
    } else {
      try { localStorage.setItem(STORE, json); }
      catch (_) { throw new Error('浏览器无法保存记录。请避免隐私模式或存储已满，并导出备份。'); }
    }
    const oldDraft=state.draft?.id;
    state = checked;
    if(oldDraft!==state.draft?.id){runtime.workoutScroll=0;stopTimer();}
    refreshCatalog();
    revision += 1;
    if (allowReset) {storageBlocked = false; bootError = ''; damagedRaw = '';}
  }
  function mutate(fn) {
    const next = JSON.parse(JSON.stringify(state));
    fn(next);
    commit(next);
  }
  function safe(fn) {
    try { fn(); }
    catch (error) { toast(error.message || '操作未完成。'); }
  }
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }
  function notePrefix(session) { const id=C.sessionPlanId(session); return id?'[肌薄计划:'+id+']\n':''; }
  function visibleNote(session) { return session.note.slice(notePrefix(session).length); }
  function footer() { return '<footer class="footer"><span>LOCAL FIRST. ZERO ACCOUNT.</span><span>肌薄 · 把训练练成日常 · v1.4.0</span></footer>'; }
  function nav(mobile = false) {
    return `<nav class="${mobile ? 'mobile-nav' : 'desktop-nav'}" aria-label="${mobile ? '底部导航' : '主导航'}">${[['home','dumbbell','训练'],['plans','calendar','计划'],['library','book','动作'],['theory','bolt','肌薄理论'],['food','food','饮食']].map(([id,ic,name]) => `<button type="button" class="nav-item ${tab===id?'active':''}" data-nav="${id}" aria-current="${tab===id?'page':'false'}">${icon(ic)}<span>${name}</span></button>`).join('')}</nav>`;
  }
  function header() {
    return `<header class="topbar"><div class="brand"><div class="brand-icon"><img src="${esc(localImage('assets/icon-512.png'))}" alt="" width="44" height="44"></div><div><strong>肌薄</strong><div class="eyebrow">JIBO · FIND YOUR FORM</div></div></div>${nav()}<div class="top-actions"><span class="offline">本地离线</span><button type="button" class="icon-btn" data-action="settings" aria-label="设置与数据备份">${icon('settings')}</button></div></header>`;
  }
  function pageHead(eyebrow,title,desc = '') {
    return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${desc?`<p class="desc">${desc}</p>`:''}</div><div class="date-chip">${icon('calendar')}<span>${today().replaceAll('-','.')}</span></div></div>`;
  }
  function render() {
    document.body.classList.toggle('blond', state.profile.theme === 'blond');
    document.body.classList.toggle('training-focus',activeWorkout());
    const pages = {home:homePage, plans:plansPage, library:libraryPage, theory:theoryPage, food:foodPage, settings:settingsPage};
    $('#app').innerHTML = `<div class="app-shell">${header()}${bootError?`<div class="storage-error">${esc(bootError)} <button class="btn btn-small" data-action="settings">打开设置</button></div>`:''}<main id="main">${pages[tab]()}</main>${footer()}</div>${nav(true)}`;
    if (tab === 'food') refreshNutritionPreview();
    window.scrollTo({top:activeWorkout()?runtime.workoutScroll:(navScroll[navScrollKey()]||0),behavior:'instant'});
    syncBackState();syncKeyboard();
  }
  function go(next) {rememberScroll();closeModal();if(next==='progress'){planView='progress';next='plans';}else if(next==='plans')planView='plans';tab=next;if(next==='home')overview=false;render();}
  function todaySessions() { return state.sessions.filter(s => s.date === today()); }
  function totalStats(sessions) {
    return sessions.reduce((sum,s) => {
      const v = C.sessionStats(s,EX);
      for (const k of ['sets','reps','seconds','volume']) sum[k] += v[k];
      return sum;
    },{sets:0,reps:0,seconds:0,volume:0});
  }
  function allDone() { return totalStats(state.sessions).sets; }
  function weekCard() {
    const week = C.weeklyTrainingSummary(state, EX, today());
    const first = new Date(week.weekStart + 'T12:00:00');
    const dates = Array.from({length:7}, (_, i) => {const d = new Date(first); d.setDate(d.getDate()+i); return C.localDate(d);});
    return `<section class="panel week-panel"><div class="panel-title"><h3>这一周，稳步来</h3><span class="chip">每周 3 天起步</span></div><div class="week-value"><strong>${week.days}</strong><span>/ 3 <small>天已练</small></span></div><div class="week-days" aria-label="本周已训练 ${week.days} 天">${dates.map((date,i)=>`<div class="week-day ${week.dates.includes(date)?'complete':''} ${date===today()?'today':''}"><span>${['一','二','三','四','五','六','日'][i]}</span><b>${week.dates.includes(date)?icon('check'):date.slice(-2)}</b></div>`).join('')}</div><p class="footnote">${week.days>=3?'本周的 3 天参考节奏已达成，给恢复也留出时间。':'A / B / C 隔日轮换，休息日自由安排。'}<br>仅计入已归档且有完成组的日期。</p></section>`;
  }
  function homePage() {
    if(activeWorkout())return workoutPage();
    const dayStats = totalStats(todaySessions());
    const recommended = C.recommendPlan(state, PLANS, EX, planLocation==='custom'?'gym':planLocation, today());
    const hasDraft = !!state.draft?.blocks.length;
    const title = state.profile.nickname && !['施工员','训练者'].includes(state.profile.nickname) ? `${esc(state.profile.nickname)}，今天也练一点。` : '把训练，练成日常。';
    return `${pageHead('YOUR EVERYDAY STRENGTH',title)}
      <div class="dashboard"><div class="main-col">
        <section class="hero jibo-hero"><div class="hero-copy"><div class="eyebrow">JIBO / LEAN & STRONG</div><h1>有力量。<br>也有轻盈感。</h1><p>围绕薄肌目标，练好肩背、全身力量与核心。按自己的节奏，逐步积累。</p><button class="btn hero-cta" data-action="${hasDraft?'continue-workout':'plan-detail'}" ${hasDraft?'':`data-plan="${recommended.id}"`}>${hasDraft?'继续本次训练':'从今天这一练开始'} ${icon('arrow')}</button></div><img class="hero-mark" src="${esc(window.LEAN_HERO_IMAGE || 'assets/hero.svg')}" alt="哑铃训练徽章"><span class="hero-stamp">STRENGTH · BALANCE · CONSISTENCY</span></section>
        <section class="next-workout"><div class="plan-letter">${recommended.letter}</div><div><div class="eyebrow">${hasDraft?'NEXT IN YOUR ROTATION':'YOUR NEXT SESSION'}</div><h3>${esc(recommended.name)}</h3><p>${recommended.location==='gym'?'健身房':'居家哑铃'} · ${recommended.blocks.length} 个动作 · 约 ${recommended.durationMinutes} 分钟</p></div><button class="quiet-icon" data-nav="plans" aria-label="选择训练计划">${icon('arrow')}</button></section>
        <div class="section-head" id="workout-heading"><div><h2>本次训练 <span class="pill-label" id="draft-count">${state.draft ? C.sessionStats(state.draft, EX).sets : 0} 组完成</span></h2><div class="eyebrow">ONE SET AT A TIME</div></div><div class="row"><button class="btn btn-ghost btn-small" data-action="timer">${icon('clock')}计时</button><button class="btn btn-primary btn-small" data-nav="library">${icon('plus')}加动作</button></div></div>
        <div id="draft-area">${hasDraft?`<div class="empty"><h3>这次训练，还在这里。</h3><p>已保存 ${C.sessionStats(state.draft,EX).sets} 组完成记录，随时回去接着练。</p><button class="btn btn-primary" data-action="continue-workout">继续本次训练 ${icon('arrow')}</button></div>`:draftHTML()}</div>
        <div class="explainer">${icon('lock')}<p>训练记录保存在本机。每组填写后再勾选完成，重要记录可在设置中导出备份。</p></div>
      </div><aside class="aside-col">
        ${weekCard()}
        <section class="panel aside-card training-basics"><div class="eyebrow">THE JIBO APPROACH</div><h3>薄肌，练的是长期状态。</h3><p>「薄肌」是一种体态偏好。用规律的力量训练打好基础，保留恢复时间，慢慢找到自己的线条。</p><div class="principle"><span>01</span><div><strong>全身均衡，肩背有重点</strong><small>推、拉、腿臀与核心，轮换着练。</small></div></div><div class="principle"><span>02</span><div><strong>先练稳，再逐步增加</strong><small>从能控制的负重开始，记录自己的进步。</small></div></div><div class="principle"><span>03</span><div><strong>训练与恢复，都要留位置</strong><small>隔日安排训练，日常走走也很好。</small></div></div><button class="btn btn-ghost btn-wide" data-action="training-guide">了解训练安排 ${icon('arrow')}</button></section>
        <section class="panel aside-card"><div class="panel-title"><h3>今天的记录</h3><small>LOGGED TODAY</small></div><div class="mini-stats today-stats"><div><strong>${dayStats.sets}<small> 组</small></strong><span class="tiny-note">已完成并归档</span></div><div><strong>${fmt(dayStats.volume,0)}</strong><span class="tiny-note">kg·次，负重记录</span></div></div>${state.profile.fun?`<p class="daily-quote" id="quote">${quotes[new Date().getDate()%quotes.length]}</p>`:''}</section>
      </aside></div>`;
  }
  function locationSwitch() {
    return `<div class="location-switch" role="group" aria-label="训练场景">${[['gym','健身房'],['home','居家'],['custom','我的计划']].map(([id,label])=>`<button class="${planLocation===id?'active':''}" data-action="plan-location" data-location="${id}" aria-pressed="${planLocation===id}">${label}</button>`).join('')}</div>`;
  }
  function plansPage() {
    return `${pageHead('PLAN IT. LOG IT. REPEAT.','计划有谱，进步有数。','准备怎么练，已经练到哪，都放在这里。')}<section class="plans-hub"><div class="plan-view-switch" role="group" aria-label="计划与进度">${[['plans','calendar','训练计划'],['progress','chart','我的进度']].map(([id,ic,label])=>`<button type="button" class="${planView===id?'active':''}" data-action="plan-view" data-view="${id}" aria-pressed="${planView===id}" aria-controls="plan-view-content">${icon(ic)}${label}</button>`).join('')}</div><div id="plan-view-content" class="plan-view-content">${planView==='progress'?progressPage():planCatalogPage()}</div></section>`;
  }
  function planCatalogPage() {
    const recommended=planLocation==='custom'?null:C.recommendPlan(state,PLANS,EX,planLocation,today());
    const list=PLANS.filter(p=>p.location===planLocation);
    return `<p class="plan-view-intro">使用 A / B / C 起步，也可以用喜欢的动作搭配自己的计划。</p>
      <div class="plan-toolbar">${locationSwitch()}<button class="btn btn-primary btn-small" data-action="new-custom-plan">${icon('plus')}新建计划</button></div>
      <div class="plan-grid">${list.map(p=>`<article class="plan-card ${p.id===recommended?.id?'recommended':''}"><div class="row space"><span class="plan-letter">${esc(p.letter)}</span><span class="chip ${p.id===recommended?.id?'accent':''}">${p.location==='custom'?'我的计划':p.id===recommended?.id?'下次可练':'轮换训练'}</span></div><div class="eyebrow">${p.location==='custom'?'YOUR OWN ROUTINE':'FULL BODY / '+esc(p.letter)}</div><h2>${esc(p.name)}</h2><p class="plan-focus">${esc(p.focus)}</p><p class="tiny-note">${p.blocks.length} 个动作 · 约 ${p.durationMinutes} 分钟</p><div class="plan-movements">${p.blocks.map(b=>`<div><span>${esc(EX_MAP.get(b.exerciseId).name)}</span><small>${b.sets} 组</small></div>`).join('')}</div><button class="btn ${p.id===recommended?.id?'btn-primary':'btn-secondary'} btn-wide" data-action="plan-detail" data-plan="${p.id}">查看并开始 ${icon('arrow')}</button>${p.location==='custom'?`<button class="btn btn-ghost btn-wide custom-plan-edit" data-action="edit-custom-plan" data-id="${p.id}">${icon('edit')}编辑计划</button>`:''}</article>`).join('')}</div>
      ${!list.length?`<div class="empty"><div class="empty-icon">${icon('calendar')}</div><h3>按自己的习惯，排一场训练。</h3><p>选动作、排顺序、设组数和休息时间。自建动作也可以加入。</p><button class="btn btn-primary" data-action="new-custom-plan">${icon('plus')}创建第一份计划</button></div>`:''}
      <div class="plan-bottom"><section class="panel"><h3>留一天给恢复</h3><p class="small muted">内置计划可以周一 A、周三 B、周五 C 轮换。自己的计划按实际情况调整。</p><button class="btn btn-ghost btn-small" data-action="training-guide">了解训练安排</button></section><section class="panel"><h3>把学到的动作留下来</h3><p class="small muted">把手机里的动作照片或视频截图存进动作库，命名、写下学习要点，再加入自己的计划。</p><button class="btn btn-ghost btn-small" data-nav="library">打开动作库 ${icon('arrow')}</button></section></div>`;
  }
  function planDetail(id) {
    const plan = PLANS.find(p=>p.id===id); if(!plan)return;
    modal(`<div class="eyebrow">${plan.location==='custom'?'CUSTOM':plan.location==='gym'?'GYM':'HOME'} / SESSION ${esc(plan.letter)}</div><h2>${esc(plan.name)}</h2>`, `<p class="small muted">${esc(plan.description)}</p><div class="plan-detail-list">${plan.blocks.map((b,i)=>`<div class="plan-detail-row"><span class="movement-order">${String(i+1).padStart(2,'0')}</span><div><strong>${esc(EX_MAP.get(b.exerciseId).name)}</strong><p>${b.sets} 组 × ${esc(b.target)} · 组间休息 ${b.restSeconds} 秒</p>${b.note?`<small class="muted">${esc(b.note)}</small>`:''}</div><button class="quiet-icon" data-action="detail" data-ex="${b.exerciseId}" aria-label="查看${esc(EX_MAP.get(b.exerciseId).name)}说明">${icon('info')}</button></div>`).join('')}</div><p class="notice">先热身，再用能稳定控制的负重开始。目标可调整；训练中出现疼痛就停止该动作。</p><div class="modal-actions">${plan.location==='custom'?`<button class="btn btn-danger" data-action="delete-custom-plan" data-id="${plan.id}">删除计划</button>`:''}<button class="btn btn-ghost" data-action="close-modal">再看看</button><button class="btn btn-primary" data-action="start-plan" data-plan="${plan.id}">开始 ${esc(plan.letter)} 训练 ${icon('arrow')}</button></div>`);
  }
  function startPlan(id) {
    const plan=PLANS.find(p=>p.id===id); if(!plan)throw new Error('训练计划不存在。');
    const perform=()=>{mutate(next=>next.draft=C.newPlanDraft(plan,today()));planLocation=plan.location;go('home');scrollToWorkout();toast('计划已就绪。填写实际数据后，再勾选完成。');};
    if(state.draft)confirmModal('替换当前训练草稿？','当前草稿会被这份计划替换，尚未归档的修改会丢失。已归档的训练仍然保留。',perform,'替换并开始');
    else perform();
  }
  function scrollToWorkout() {
    $('#workout-heading')?.scrollIntoView({behavior:'instant',block:'start'});
  }
  function trainingGuide() {
    modal('<div class="eyebrow">BUILD YOUR ROUTINE</div><h2>规律，比赶进度更有用。</h2>', `<div class="stack small muted"><p>「薄肌」不是一种独立的肌肉类型。肌薄提供全身力量训练模板，帮助你围绕喜欢的体态建立规律。</p><p><strong class="accent">安排：</strong>每周 3 天是可调整的起点，A / B / C 隔日轮换，覆盖主要肌群。日常散步与其他喜欢的活动，也可以继续保留。</p><p><strong class="accent">执行：</strong>先热身，每个动作从 2 组开始。选能控制的负重，动作稳定后再逐步增加。不必每组练到力竭。</p><p><strong class="accent">恢复：</strong>按疲劳情况调整，给饮食、睡眠和休息留出位置。疼痛时停止动作；已有伤病或特殊训练需求时，请寻求专业指导。</p><p class="notice">这些是可修改的一般模板，不是个体化处方。8–12 次、1–3 组的一般范围参考 CDC；规律训练、覆盖主要肌群的原则参考 ACSM 2026 力量训练指南。时长和休息时间为模板估计。</p></div>`);
  }
  function draftHTML() {
    if (!state.draft || !state.draft.blocks.length) return `<div class="empty"><div class="empty-icon">${icon('dumbbell')}</div><h3>今天，从一份计划开始。</h3><p>选择薄肌训练计划，或从动作库自由搭配。实际重量和次数，由你练完后记录。</p><div class="row wrap"><button class="btn btn-primary" data-nav="plans">选择训练计划 ${icon('arrow')}</button><button class="btn btn-ghost" data-nav="library">自由添加动作</button></div></div>`;
    const draft = state.draft;
    const editing = state.sessions.some(s => s.id === draft.id);
    return `<div class="draft-top"><label class="field">训练日期<input type="date" id="draft-date" min="2000-01-01" max="2100-12-31" value="${esc(draft.date)}" required></label><span class="tiny-note">${editing?'正在编辑旧记录；归档会更新原记录。':'草稿本地保存 · 不把空白算完成'}</span></div><div class="stack">${draft.blocks.map(blockHTML).join('')}</div><label class="field" style="margin-top:16px">本次备注<textarea id="draft-note" maxlength="${1000-notePrefix(draft).length}" placeholder="器械设置、感受、下次提醒……">${esc(visibleNote(draft))}</textarea></label><div class="save-bar"><button class="btn btn-primary" data-action="finish">${icon('check')}${editing?'保存修改并归档':'结束训练并归档'}</button><button class="btn btn-ghost" data-action="discard-draft">放弃草稿</button></div>`;
  }
  function blockHTML(block) {
    const ex = EX_MAP.get(block.exerciseId);
    const prev = C.lastSessionBlock(state,ex.id);
    const target = blockTarget(block);
    const s = C.blockStats(block,ex);
    const details = prev ? `${prev.date} · ${prev.block.sets.filter(s=>s.done).map(s=>ex.mode==='time'?s.seconds+'秒':(ex.mode==='weight'?s.weight+'kg × ':'')+s.reps+'次').slice(0,5).join(' / ')}` : '还没有历史记录，今天就是起点。';
    return `<article class="block" data-block-id="${esc(block.id)}"><div class="block-header"><button class="quiet-icon" style="padding:0" data-action="detail" data-ex="${ex.id}" aria-label="查看${esc(ex.name)}图解"><img class="block-thumb" src="${esc(exerciseImage(ex))}" alt="${esc(ex.name)}示意图"></button><div class="block-info"><h3>${esc(ex.name)}</h3><div class="en">${esc(ex.en)}</div><small class="muted" data-block-stat="${esc(block.id)}">${s.sets} 组完成${ex.mode==='weight'?' · '+fmt(s.volume)+' kg·次':ex.mode==='time'?' · '+s.seconds+' 秒':''}</small></div><button class="quiet-icon" data-action="remove-block" data-block="${esc(block.id)}" aria-label="删除${esc(ex.name)}">${icon('trash')}</button></div><div class="load-note">${esc(ex.loadNote)}</div>${target?`<div class="target-note"><span>参考 · ${target.sets} 组 × ${esc(target.target)}</span><button data-action="start-timer" data-seconds="${target.restSeconds}">${icon('clock')}休息 ${target.restSeconds} 秒</button></div>`:''}<div class="sets"><div class="set-row set-labels ${ex.mode==='weight'?'':'time'}"><span>组</span>${ex.mode==='weight'?'<span>重量 / kg</span>':''}<span>${ex.mode==='time'?'时长 / 秒':'次数 / REPS'}</span><span>完成</span><span></span></div>${block.sets.map((set,i)=>setHTML(block,set,i,ex)).join('')}</div><div class="block-footer"><button class="btn btn-ghost btn-small" data-action="add-set" data-block="${esc(block.id)}">${icon('plus')}一组</button><div class="row" style="gap:2px">${prev?`<button class="btn btn-small btn-ghost" data-action="copy-last" data-block="${esc(block.id)}">${icon('copy')}上次</button>`:''}<button class="quiet-icon" data-action="block-note" data-block="${esc(block.id)}" aria-label="编辑动作备注">${icon('edit')}</button></div></div><div class="last-record">上次：${esc(details)}${block.note?'<br>备注：'+esc(block.note):''}</div></article>`;
  }
  function setHTML(block,set,index,ex) {
    const attrs = `data-block="${esc(block.id)}" data-set="${esc(set.id)}"`;
    const common = 'inputmode="decimal" autocomplete="off" enterkeyhint="next"';
    return `<div class="set-row ${ex.mode==='weight'?'':'time'}"><span class="set-no">${String(index+1).padStart(2,'0')}</span>${ex.mode==='weight'?`<input type="number" ${common} min="0" max="1000" step="any" placeholder="kg" value="${set.weight??''}" ${attrs} data-field="weight" aria-label="${esc(ex.name)}第${index+1}组重量">`:''}<input type="number" inputmode="numeric" enterkeyhint="done" min="1" max="${ex.mode==='time'?36000:1000}" step="1" placeholder="${ex.mode==='time'?'秒':'次'}" value="${ex.mode==='time'?(set.seconds??''):(set.reps??'')}" ${attrs} data-field="${ex.mode==='time'?'seconds':'reps'}" aria-label="${esc(ex.name)}第${index+1}组${ex.mode==='time'?'秒数':'次数'}"><button class="check ${set.done?'done':''}" data-action="toggle-set" ${attrs} aria-label="${esc(ex.name)}第${index+1}组${set.done?'取消完成':'标记完成'}" aria-pressed="${set.done}">${icon('check')}</button><button class="quiet-icon" data-action="remove-set" ${attrs} aria-label="删除${esc(ex.name)}第${index+1}组">${icon('x')}</button></div>`;
  }
  function refreshDraftStats() {
    if (!state.draft) return;
    const count = $('#draft-count');
    if (count) count.textContent = C.sessionStats(state.draft,EX).sets+' 组完成';
    const stats=C.sessionStats(state.draft,EX),total=state.draft.blocks.reduce((n,b)=>n+b.sets.length,0);
    if($('#dock-set-count'))$('#dock-set-count').textContent=stats.sets+' 组已完成';
    if($('#workout-progress-count'))$('#workout-progress-count').textContent=stats.sets+' / '+total+' 组完成';
    if($('#workout-progress-bar'))$('#workout-progress-bar').style.width=(total?stats.sets/total*100:0)+'%';
    state.draft.blocks.forEach(b => {
      const ex = EX_MAP.get(b.exerciseId), s = C.blockStats(b,ex);
      const el = [...document.querySelectorAll('[data-block-stat]')].find(e=>e.dataset.blockStat===b.id);
      if (el) el.textContent = `${s.sets} 组完成${ex.mode==='weight'?' · '+fmt(s.volume)+' kg·次':ex.mode==='time'?' · '+s.seconds+' 秒':''}`;
      b.sets.forEach(set=>{
        const button = [...document.querySelectorAll('[data-action="toggle-set"]')].find(e=>e.dataset.block===b.id&&e.dataset.set===set.id);
        if(button){button.classList.toggle('done',set.done);button.setAttribute('aria-pressed',String(set.done));}
      });
    });
  }
  function redrawDraft() {
    const scroll = window.scrollY;
    if(document.body.classList.contains('training-focus')!==activeWorkout()){render();return;}
    const area = $('#draft-area');
    if (area) {area.innerHTML=draftHTML(); refreshDraftStats();window.scrollTo(0,scroll);}
    else {tab='home';render();}
  }
  function addExercise(exId) {
    if (!EX_MAP.has(exId)) throw new Error('动作不存在。');
    mutate(next=>{
      if (!next.draft) next.draft=C.newDraft();
      next.draft.blocks.push(C.newBlock(exId));
    });
    closeModal();toast('已添加 '+EX_MAP.get(exId).name+'。填写后再勾选完成。');
    if(tab==='home')redrawDraft();
  }
  function exerciseImage(ex) { return ex.image || window.LEAN_EMBEDDED_IMAGES?.['assets/icon.svg'] || 'assets/icon.svg'; }
  let exerciseEditor = null, planEditor = null, photoTicket = 0, photoBusy = false;
  function customExerciseEditor(id = '') {
    const old = state.customExercises.find(e=>e.id===id);
    exerciseEditor = old ? {...old} : {name:'',group:'背部',mode:'weight',equipment:'',hint:'',image:''};
    photoBusy=false; photoTicket++;
    const locked=old && [state.draft,...state.sessions].filter(Boolean).some(s=>s.blocks.some(b=>b.exerciseId===id));
    modal(`<div class="eyebrow">YOUR MOVEMENT LIBRARY</div><h2>${old?'编辑动作':'添加自己的动作'}</h2>`, `<form id="custom-exercise-form" class="custom-editor-form"><div class="editor-scroll"><div class="custom-photo" id="custom-photo-preview">${exerciseEditor.image?`<img src="${esc(exerciseEditor.image)}" alt="动作照片预览"><button type="button" class="icon-btn" data-action="remove-exercise-photo" aria-label="移除这张照片">${icon('x')}</button>`:`${icon('dumbbell')}<p>选一张动作照片或视频截图</p>`}</div><div class="photo-actions"><button type="button" class="btn btn-primary" data-action="choose-exercise-photo">${icon('image')}${isNative()?'从手机选择图片':'选择本机图片'}</button><button type="button" class="btn btn-ghost" data-action="take-exercise-photo">拍一张照片</button></div><p class="tiny-note photo-local-note">图片可选 · 仅保存在本机，无需上传。<br>保存压缩副本，原图不变；保存后可离线查看。</p><p class="tiny-note" id="photo-status" role="status" aria-live="polite"></p><input id="exercise-camera" class="file-input" type="file" accept="image/*" capture="environment" aria-label="拍摄动作照片"><input id="exercise-gallery" class="file-input" type="file" accept="image/*" aria-label="选择本机动作图片"><div class="form-grid" style="margin-top:20px"><label class="field span2">动作名称<input id="custom-exercise-name" required maxlength="80" placeholder="例如：单臂绳索侧平举" value="${esc(exerciseEditor.name)}"></label><label class="field">训练部位<select id="custom-exercise-group">${['胸部','背部','腿部','肩部','手臂','臀部','核心'].map(g=>`<option ${exerciseEditor.group===g?'selected':''}>${g}</option>`).join('')}</select></label><label class="field">怎样记录<select id="custom-exercise-mode" ${locked?'disabled':''}>${[['weight','重量 × 次数'],['reps','仅次数'],['time','计时（秒）']].map(([v,t])=>`<option value="${v}" ${exerciseEditor.mode===v?'selected':''}>${t}</option>`).join('')}</select></label><label class="field span2">器械／负重口径<input id="custom-exercise-equipment" maxlength="80" placeholder="例如：单只哑铃，左右次数合计" value="${esc(exerciseEditor.equipment)}"></label><label class="field span2">学习笔记<textarea id="custom-exercise-hint" maxlength="500" placeholder="从视频学到的要点、器械设置、下次提醒……">${esc(exerciseEditor.hint)}</textarea></label></div>${locked?'<p class="footnote">这个动作已有训练记录，记录方式保持不变。</p>':''}</div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit" id="save-custom-exercise">保存动作</button></div></form>`);
  }
  async function loadExercisePhoto(file) {
    if(!file || !exerciseEditor)return;
    const ticket=++photoTicket;
    photoBusy=true;
    const status=$('#photo-status'); if(status)status.textContent='正在本机处理图片……';
    const save=$('#save-custom-exercise'); if(save)save.disabled=true;
    try {
      if(file.size>12*1024*1024)throw new Error('照片过大，请选择 12 MB 以内的图片。');
      const url=URL.createObjectURL(file), img=new Image();
      try { img.src=url; await img.decode(); }
      catch(_){throw new Error('无法读取这张照片，请改用 JPG、PNG 或 WebP 图片。');}
      finally {URL.revokeObjectURL(url);}
      let scale=Math.min(1,960/Math.max(img.naturalWidth,img.naturalHeight)), result='';
      for(let attempt=0;attempt<7;attempt++) {
        const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d'); ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        result=canvas.toDataURL('image/jpeg',Math.max(.5,.82-attempt*.06));
        if(result.length*3/4<96*1024)break;
        scale*=.8;
      }
      if(result.length*3/4>=96*1024)throw new Error('照片处理失败，请换一张图片。');
      if(ticket!==photoTicket||!$('#custom-exercise-form'))return;
      exerciseEditor.image=result;
      $('#custom-photo-preview').innerHTML=`<img src="${esc(result)}" alt="动作照片预览"><button type="button" class="icon-btn" data-action="remove-exercise-photo" aria-label="移除这张照片">${icon('x')}</button>`;
      $('#photo-status').textContent='照片已就绪，点击「保存动作」留在本机。';
    }catch(error){if(ticket===photoTicket){toast(error.message);if($('#photo-status'))$('#photo-status').textContent=error.message;}}
    finally{if(ticket===photoTicket){photoBusy=false;if($('#save-custom-exercise'))$('#save-custom-exercise').disabled=false;}}
  }
  function saveCustomExercise() {
    if(photoBusy)throw new Error('照片还在处理，请稍等。');
    const form=$('#custom-exercise-form'); if(!form.reportValidity())return;
    const fields={...exerciseEditor,name:$('#custom-exercise-name').value.trim(),group:$('#custom-exercise-group').value,mode:$('#custom-exercise-mode').value,equipment:$('#custom-exercise-equipment').value.trim()||'自定义',hint:$('#custom-exercise-hint').value.trim()};
    if(!fields.name)throw new Error('请给动作起一个名字。');
    if(fields.id&&fields.mode!==exerciseEditor.mode)fields.loadNote=C.newCustomExercise({...fields,loadNote:undefined}).loadNote;
    const ex=fields.id?fields:C.newCustomExercise(fields);
    commit(C.saveCustomExercise(state,ex,BASE_EX));
    closeModal();group='自建';search='';go('library');toast('动作和图片已保存在本机，可以加入训练或自己的计划。');
  }
  function syncPlanEditor() {
    if(!$('#custom-plan-form'))return;
    planEditor.name=$('#custom-plan-name').value;
    planEditor.description=$('#custom-plan-description').value;
    planEditor.durationMinutes=$('#custom-plan-duration').value;
    $('#custom-plan-steps').querySelectorAll('[data-step-index]').forEach(row=>{
      const b=planEditor.blocks[Number(row.dataset.stepIndex)];
      b.sets=$('[data-plan-field="sets"]',row).value;
      b.target=$('[data-plan-field="target"]',row).value;
      b.restSeconds=$('[data-plan-field="restSeconds"]',row).value;
    });
  }
  function customPlanEditor(id = '') {
    const old=state.customPlans.find(p=>p.id===id);
    planEditor=old?JSON.parse(JSON.stringify(old)):{name:'',description:'',durationMinutes:30,blocks:[]};
    drawPlanEditor();
  }
  function drawPlanEditor() {
    modal(`<div class="eyebrow">BUILD YOUR ROUTINE</div><h2>${planEditor.id?'编辑训练计划':'新建训练计划'}</h2>`, `<form id="custom-plan-form" class="custom-editor-form"><div class="editor-scroll"><div class="form-grid"><label class="field span2">计划名称<input id="custom-plan-name" required maxlength="80" value="${esc(planEditor.name)}" placeholder="例如：我的肩背日"></label><label class="field span2">安排与备注<textarea id="custom-plan-description" maxlength="700" placeholder="适合哪一天、训练重点、要注意的事……">${esc(planEditor.description)}</textarea></label><label class="field span2">预计时长／分钟<input id="custom-plan-duration" type="number" min="1" max="600" inputmode="numeric" value="${esc(planEditor.durationMinutes)}" required></label></div><div class="section-head"><h3>按顺序安排动作</h3><span class="tiny-note">${planEditor.blocks.length} 个动作</span></div><div id="custom-plan-steps" class="stack">${planEditor.blocks.map((b,i)=>`<article class="custom-plan-step" data-step-index="${i}"><div class="row space"><strong>${i+1}. ${esc(EX_MAP.get(b.exerciseId)?.name||'动作不可用')}</strong><div class="row step-order"><button type="button" class="quiet-icon" data-action="plan-step-up" data-index="${i}" aria-label="上移动作${i+1}" ${i===0?'disabled':''}>↑</button><button type="button" class="quiet-icon" data-action="plan-step-down" data-index="${i}" aria-label="下移动作${i+1}" ${i===planEditor.blocks.length-1?'disabled':''}>↓</button><button type="button" class="quiet-icon" data-action="plan-step-remove" data-index="${i}" aria-label="移除计划动作${i+1}">${icon('x')}</button></div></div><div class="plan-step-fields"><label class="field">组数<input data-plan-field="sets" type="number" min="1" max="10" inputmode="numeric" required value="${esc(b.sets)}"></label><label class="field">目标次数／秒数<input data-plan-field="target" required maxlength="100" value="${esc(b.target)}" placeholder="例如 8–12 次"></label><label class="field">休息／秒<input data-plan-field="restSeconds" type="number" min="15" max="600" inputmode="numeric" required value="${esc(b.restSeconds)}"></label></div></article>`).join('')||'<p class="notice">先添加一个动作；内置动作和你的自建动作都可以使用。</p>'}</div><div class="plan-add-row"><label class="field">选择动作<select id="custom-plan-add-ex">${EX.map(e=>`<option value="${e.id}">${esc(e.name)}${e.id.startsWith('custom-')?' · 自建':''}</option>`).join('')}</select></label><button type="button" class="btn btn-secondary" data-action="plan-step-add">${icon('plus')}添加</button></div><p class="footnote">这里只设置目标，开始训练后再填写实际完成的数据。</p></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">取消</button><button type="submit" class="btn btn-primary">保存计划</button></div></form>`);
  }
  function saveCustomPlan() {
    if(!$('#custom-plan-form').reportValidity())return;
    syncPlanEditor();
    const fields={...planEditor,name:planEditor.name.trim(),focus:'自己的训练安排'};
    if(!fields.name)throw new Error('请填写计划名称。');
    const plan=fields.id?fields:C.newCustomPlan(fields);
    mutate(next=>{const index=next.customPlans.findIndex(p=>p.id===plan.id);if(index>=0)next.customPlans[index]=plan;else next.customPlans.push(plan);});
    closeModal();planLocation='custom';go('plans');toast('自己的计划已保存，下次可以直接开始。');
  }
  function handleCustomAction(button) {
    const a=button.dataset.action,id=button.dataset.id;
    if(a==='new-custom-exercise')customExerciseEditor();
    else if(a==='edit-custom-exercise')customExerciseEditor(id);
    else if(a==='delete-custom-exercise')confirmModal('删除这个自建动作？','删除动作及其照片。正在被训练记录或计划使用的动作会保留。',()=>{commit(C.removeCustomExercise(state,id,BASE_EX));closeModal();render();},'删除动作',true);
    else if(a==='take-exercise-photo'||a==='choose-exercise-photo'){const input=$(a==='take-exercise-photo'?'#exercise-camera':'#exercise-gallery');input.value='';input.click();}
    else if(a==='remove-exercise-photo'){photoTicket++;photoBusy=false;exerciseEditor.image='';$('#custom-photo-preview').innerHTML=icon('dumbbell')+'<p>还没有动作照片</p>';$('#save-custom-exercise').disabled=false;$('#photo-status').textContent='照片已移除，保存后生效。';}
    else if(a==='new-custom-plan')customPlanEditor();
    else if(a==='edit-custom-plan')customPlanEditor(id);
    else if(a==='delete-custom-plan')confirmModal('删除这份计划？','只删除保存的计划，已经开始或归档的训练仍会保留。',()=>{commit(C.removeCustomPlan(state,id,BASE_EX));closeModal();render();},'删除计划',true);
    else if(a==='plan-step-add'){
      const exId=$('#custom-plan-add-ex').value;syncPlanEditor();
      const ex=EX_MAP.get(exId);if(!ex)throw new Error('请先选择动作。');
      planEditor.blocks.push({exerciseId:exId,sets:2,target:ex.mode==='time'?'20–30 秒':'8–12 次',restSeconds:90,note:''});drawPlanEditor();
    } else if(['plan-step-up','plan-step-down','plan-step-remove'].includes(a)) {
      syncPlanEditor();const index=Number(button.dataset.index);
      if(a==='plan-step-remove')planEditor.blocks.splice(index,1);
      else {const next=index+(a==='plan-step-up'?-1:1);if(next>=0&&next<planEditor.blocks.length)[planEditor.blocks[index],planEditor.blocks[next]]=[planEditor.blocks[next],planEditor.blocks[index]];}
      drawPlanEditor();
    } else return false;
    return true;
  }

  let theoryAuthor = 'all', theoryCategory = 'all', theorySearch = '';
  const theoryCategories = [['all','全部主题'],['theory','薄肌观点'],['training','训练'],['food','饮食'],['meme','趣味']];
  const theoryAsides = ['理论已看懂，今天先把一组练明白。','先收藏，再开练。第二步不要省略。','嘴上练的是版本，手上练的是哑铃。','薄肌可以慢慢来，动作先别糊弄。'];
  let theoryAside = 0, theoryGallery = null;
  function theoryImages(post) { return (Array.isArray(post.images)&&post.images.length?post.images:[post.image]).filter(path=>typeof path==='string'&&path.length); }
  function theoryImage(post, index = 0) { return localImage(theoryImages(post)[index]||post.image); }
  function theoryCategoryLabel(post) { return theoryCategories.find(([id])=>id===(post.category||'theory'))?.[1]||'薄肌观点'; }
  function filteredTheoryPosts() {
    const query=theorySearch.trim().toLocaleLowerCase();
    return (window.JIBO_THEORY_POSTS||[]).filter(post=>(theoryAuthor==='all'||post.authorId===theoryAuthor)&&(theoryCategory==='all'||(post.category||'theory')===theoryCategory)&&(!query||[post.author,post.handle,post.title,post.excerpt,post.summary,post.commentary,theoryCategoryLabel(post)].join(' ').toLocaleLowerCase().includes(query)));
  }
  function theoryResults() {
    const all=window.JIBO_THEORY_POSTS||[], posts=filteredTheoryPosts();
    if(!posts.length)return '<div class="empty theory-empty"><div class="empty-icon">'+icon('search')+'</div><h3>这页还没翻到。</h3><p>换个关键词，或清除作者与主题筛选，再找找原帖。</p><button class="btn btn-secondary" data-action="theory-clear">查看全部原帖</button></div>';
    return `<div class="theory-grid">${posts.map(post=>{const images=theoryImages(post);return `<article class="theory-card" data-post-id="${esc(post.id)}"><div class="theory-card-meta"><span class="theory-author-icon ${post.authorId==='sun'?'sun':'alan'}" aria-hidden="true">${post.authorId==='sun'?'孙':'邵'}</span><div><strong>${esc(post.author)}</strong><small>@${esc(post.handle)}</small></div><span class="theory-issue">NO. ${String(all.indexOf(post)+1).padStart(2,'0')}</span></div><button class="theory-picture" data-action="theory-image" data-id="${esc(post.id)}" aria-label="放大${esc(post.author)}的${esc(post.title)}${post.cropped?'原帖节选':'原帖截图'}${images.length>1?'，共'+images.length+'张':''}"><img src="${esc(theoryImage(post))}" alt="${esc(post.author)}的 X ${post.cropped?'原帖节选':'原帖截图'}：${esc(post.excerpt)}" loading="lazy"><span>${icon('search')}${images.length>1?images.length+' 张截图':'看原帖截图'}</span></button><div class="theory-card-body"><div class="theory-post-date">${esc(post.date)} · ${esc(theoryCategoryLabel(post))} · ${post.cropped?'原帖节选':'原帖截图'}</div><h3>${esc(post.title)}</h3>${post.summary?`<p class="theory-source-summary"><span>原帖摘要</span>${esc(post.summary)}</p>`:''}<p><span>肌薄旁白</span>${esc(post.commentary)}</p><button class="btn btn-ghost btn-small" data-action="theory-source" data-id="${esc(post.id)}">${icon('copy')}复制原帖链接</button></div></article>`;}).join('')}</div>`;
  }
  function refreshTheoryResults() {
    const results=$('#theory-results');if(!results)return;
    results.innerHTML=theoryResults();
    $('#theory-count').textContent=`${filteredTheoryPosts().length} / ${(window.JIBO_THEORY_POSTS||[]).length} 条原帖`;
    document.querySelectorAll('[data-action="theory-filter"],[data-action="theory-category"]').forEach(button=>{const active=button.dataset.author?button.dataset.author===theoryAuthor:button.dataset.category===theoryCategory;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  }
  function theoryPage() {
    const all=window.JIBO_THEORY_POSTS||[], posts=filteredTheoryPosts();
    return `${pageHead('THE UNOFFICIAL READING ROOM','肌薄理论','先读一点抽象，再练一点具体。')}<section class="theory-intro"><div><span class="theory-sticker">本馆不授予学位</span><p id="theory-aside-text">${esc(theoryAsides[theoryAside])}</p></div><button class="icon-btn" data-action="theory-shuffle" aria-label="换一句肌薄旁白">${icon('arrow')}</button></section><article class="theory-meme-card"><div class="theory-meme-copy"><span class="eyebrow">LOCAL MEME COLLECTION</span><h2>肌薄表情包</h2><p>先收藏一点乐子，再认真练一组。</p><small>独立梗图 · 非推文</small></div><button class="theory-meme-picture" data-action="theory-meme" aria-label="放大肌薄表情包漫画"><img src="${esc(localImage('assets/theory/muscle-meme.png'))}" alt="肌薄表情包漫画"><span>${icon('search')}放大</span></button></article><section class="theory-library" aria-label="原帖内容库"><div class="section-head theory-library-head"><div><h2>原帖库</h2><p class="tiny-note">公开可核实原帖 · 更新于 2026.09.17</p></div><span class="tiny-note" id="theory-count" role="status" aria-live="polite">${posts.length} / ${all.length} 条原帖</span></div><div class="searchbar theory-searchbar">${icon('search')}<input id="theory-search" type="search" maxlength="120" value="${esc(theorySearch)}" placeholder="搜原帖作者、关键词……" aria-label="搜索原帖" autocomplete="off" enterkeyhint="search"></div><div class="theory-toolbar"><div class="filter-row theory-author-filters" role="group" aria-label="按原帖作者筛选">${[['all','全部作者'],['sun','孙宇晨'],['alan','邵艾伦']].map(([id,name])=>`<button class="filter ${theoryAuthor===id?'active':''}" data-action="theory-filter" data-author="${id}" aria-pressed="${theoryAuthor===id}">${name}</button>`).join('')}</div><div class="filter-row theory-topic-filters" role="group" aria-label="按原帖主题筛选">${theoryCategories.map(([id,name])=>`<button class="filter ${theoryCategory===id?'active':''}" data-action="theory-category" data-category="${id}" aria-pressed="${theoryCategory===id}">${name}</button>`).join('')}</div></div><div id="theory-results">${theoryResults()}</div></section><p class="theory-footnote">收录本次公开检索可核实的原帖，不代表完整历史。长帖展示摘要与截图节选，视频仅收录封面，全部离线可看。原帖是作者观点，不是训练建议；“肌薄旁白”为本应用自制，与原作者无关。</p><button class="btn btn-secondary btn-wide" data-nav="plans">理论学完了，去看训练计划 ${icon('arrow')}</button>`;
  }
  function theoryDetail(id) {
    const post=(window.JIBO_THEORY_POSTS||[]).find(p=>p.id===id); if(!post)return;
    const images=theoryImages(post);if(!images.length)return;
    theoryGallery={id:post.id,index:0};
    modal(`<div class="eyebrow">X / ${post.cropped?'原帖节选':'原帖截图'}</div><h2>${esc(post.title)}</h2><p class="tiny-note">${esc(post.author)} · @${esc(post.handle)} · ${esc(post.date)}</p>`,`<div class="theory-lightbox" tabindex="0" aria-label="原帖截图，可滚动查看"><img src="${esc(theoryImage(post))}" alt="${esc(post.author)}${post.cropped?'原帖节选':'原帖'}：${esc(post.excerpt)}${images.length>1?'（第 1 张，共 '+images.length+' 张）':''}"></div>${images.length>1?`<div class="theory-gallery-nav" role="group" aria-label="原帖截图翻页"><button class="btn btn-secondary" data-action="theory-gallery" data-direction="-1" aria-label="上一张截图" disabled>← 上一张</button><span id="theory-gallery-count" role="status" aria-live="polite">1 / ${images.length}</span><button class="btn btn-secondary" data-action="theory-gallery" data-direction="1" aria-label="下一张截图">下一张 →</button></div>`:''}${post.summary?`<p class="theory-source-summary"><span>原帖摘要</span>${esc(post.summary)}</p>`:''}<p class="theory-source-url">${esc(post.sourceUrl)}</p><div class="modal-actions"><button class="btn btn-secondary" data-action="theory-zoom" aria-pressed="false">放大阅读</button><button class="btn btn-primary" data-action="theory-source" data-id="${esc(post.id)}">${icon('copy')}复制原帖链接</button></div>`);
  }
  function changeTheoryImage(direction) {
    const post=(window.JIBO_THEORY_POSTS||[]).find(p=>p.id===theoryGallery?.id),box=$('.theory-lightbox');
    if(!post||!box||![-1,1].includes(direction))return;
    const images=theoryImages(post);theoryGallery.index=Math.max(0,Math.min(images.length-1,theoryGallery.index+direction));
    const image=$('img',box);image.src=theoryImage(post,theoryGallery.index);image.alt=`${post.author}${post.cropped?'原帖节选':'原帖'}：${post.excerpt}（第 ${theoryGallery.index+1} 张，共 ${images.length} 张）`;
    box.scrollTo({left:0,top:0,behavior:'instant'});
    $('#theory-gallery-count').textContent=`${theoryGallery.index+1} / ${images.length}`;
    $('[data-action="theory-gallery"][data-direction="-1"]').disabled=theoryGallery.index===0;
    $('[data-action="theory-gallery"][data-direction="1"]').disabled=theoryGallery.index===images.length-1;
  }
  function theoryMeme() {
    theoryGallery=null;
    modal('<div class="eyebrow">LOCAL MEME COLLECTION</div><h2>肌薄表情包</h2>',`<div class="theory-lightbox" tabindex="0" aria-label="表情包漫画，可滚动查看"><img src="${esc(localImage('assets/theory/muscle-meme.png'))}" alt="肌薄表情包漫画"></div><p class="footnote">单独收藏的漫画梗图，不是孙宇晨或邵艾伦的推文。</p><div class="modal-actions"><button class="btn btn-secondary" data-action="theory-zoom" aria-pressed="false">放大阅读</button><button class="btn btn-primary" data-action="close-modal">看完了</button></div>`);
  }

  function libraryPage() {
    const filters = ['全部','自建','胸部','背部','腿部','肩部','手臂','臀部','核心'];
    return `${pageHead('MOVEMENT LIBRARY','动作图鉴。',`${EX.length} 个动作 · 内置图示与自己的照片`)}<div class="library-toolbar"><span class="small muted">收藏学到的动作，留下自己的训练笔记。</span><button class="btn btn-primary" data-action="new-custom-exercise">${icon('plus')}自建动作</button></div><div class="searchbar">${icon('search')}<input id="exercise-search" type="search" value="${esc(search)}" placeholder="搜索动作、英文名称或器械……" aria-label="搜索动作"></div><div class="filter-row">${filters.map(f=>`<button class="filter ${group===f?'active':''}" data-action="filter" data-group="${f}" aria-pressed="${group===f}">${f}</button>`).join('')}</div><div id="exercise-grid">${exerciseGrid()}</div><div class="explainer">${icon('info')}<p>从本机选择动作照片或视频截图，配上名字与学习笔记。图片和计划只保存在本机，不会上传。</p></div><div class="section-head"><span class="tiny-note">当前草稿：${state.draft?state.draft.blocks.length:0} 个动作</span><button class="btn btn-primary" data-nav="home">返回训练 ${icon('arrow')}</button></div>`;
  }
  function exerciseGrid() {
    const q = search.trim().toLowerCase();
    const list = EX.filter(e=>(group==='全部'||(group==='自建'?e.id.startsWith('custom-'):e.group===group))&&(!q||[e.name,e.en,e.equipment].join(' ').toLowerCase().includes(q)));
    if(!list.length)return '<div class="empty"><h3>没有找到这个动作。</h3><p>试试中文名称、英文名称或其他肌群分类。</p></div>';
    return `<div class="exercise-grid">${list.map(ex=>`<article class="exercise-card"><div class="exercise-picture"><span class="exercise-number">${esc(ex.number||'自建')}</span><span class="exercise-group">${esc(ex.group)}</span><img src="${esc(exerciseImage(ex))}" alt="${esc(ex.name)}动作图片" loading="lazy"></div><div class="exercise-body"><h3>${esc(ex.name)}</h3><p class="en">${esc(ex.en)}</p><div class="row"><span class="tiny-note">${esc(ex.equipment)}</span><button class="btn btn-ghost btn-small" data-action="detail" data-ex="${ex.id}" aria-label="查看${esc(ex.name)}说明">图解</button><button class="btn btn-primary btn-small" data-action="add-ex" data-ex="${ex.id}" aria-label="添加${esc(ex.name)}">${icon('plus')}添加</button></div></div></article>`).join('')}</div>`;
  }
  function detail(exId) {
    const ex = EX_MAP.get(exId); if(!ex)return;
    modal(`<div class="eyebrow">EXERCISE ${esc(ex.number||'自建')} · ${esc(ex.group)}</div><h2>${esc(ex.name)}</h2><p class="muted small">${esc(ex.en)}</p>`, `<img class="info-card-image" src="${esc(exerciseImage(ex))}" alt="${esc(ex.name)}示意图"><div class="notice"><strong class="accent">记录口径</strong><p>${esc(ex.loadNote)}</p></div><p class="small muted" style="margin-top:16px">${esc(ex.hint)}</p><p class="footnote">示意图仅用于识别，不代替现场指导。所有动作均由你自行选择；请根据实际能力安排训练。</p><div class="modal-actions">${ex.id.startsWith('custom-')?`<button class="btn btn-danger" data-action="delete-custom-exercise" data-id="${ex.id}">删除</button><button class="btn btn-secondary" data-action="edit-custom-exercise" data-id="${ex.id}">编辑动作</button>`:''}<button class="btn btn-primary" data-action="add-ex" data-ex="${ex.id}">${icon('plus')}加入本次训练</button></div>`);
  }
  function foodTotals(date) {
    return state.foodEntries.filter(f=>f.date===date).reduce((sum,f)=>{
      const v=C.nutrition(f.quantity,f.kcal100,f.protein100);return {kcal:sum.kcal+v.kcal,protein:sum.protein+v.protein};
    },{kcal:0,protein:0});
  }
  function foodPage() {
    const totals = foodTotals(foodDate);
    const entries=state.foodEntries.filter(f=>f.date===foodDate);
    return `${pageHead('FUEL STATION','为训练补给。','记录饮食与蛋白质，支持你的日常训练。')}<div class="draft-top"><label class="field">查看日期<input id="food-date" type="date" min="2000-01-01" max="2100-12-31" value="${esc(foodDate)}" required></label><span class="tiny-note">仅汇总你记录的食物，不等于全天实际摄入。</span></div><div class="nutrition-total"><section class="panel"><div class="eyebrow">LOGGED ENERGY</div><div class="metric">${fmt(totals.kcal)} <small>kcal</small></div><p class="small muted">当天已记录能量</p></section><section class="panel"><div class="eyebrow">LOGGED PROTEIN</div><div class="metric">${fmt(totals.protein)} <small>g</small></div><p class="small muted">当天已记录蛋白质</p></section></div><div class="section-head"><div><h2>标签计算器</h2><div class="eyebrow">LABEL × QUANTITY</div></div></div><div class="dashboard nutrition-layout"><section class="panel"><form id="food-form"><div class="form-grid"><label class="field span2">复用已保存标签<select id="saved-food"><option value="">新建标签 / New label</option>${state.foodLabels.map(f=>`<option value="${esc(f.id)}">${esc(f.name)} · 每100${f.unit}</option>`).join('')}</select></label><label class="field span2">食物名称<input id="food-name" name="name" maxlength="100" required placeholder="例如：某品牌牛奶" value="${esc(foodForm.name)}"></label><label class="field">计量单位<select id="food-unit" name="unit"><option value="g" ${foodForm.unit==='g'?'selected':''}>克 / g</option><option value="mL" ${foodForm.unit==='mL'?'selected':''}>毫升 / mL</option></select></label><label class="field">实际份量<input id="food-quantity" name="quantity" type="number" min="0.01" max="10000" step="0.01" inputmode="decimal" required placeholder="例如 250" value="${esc(foodForm.quantity)}"></label><label class="field">每100单位能量 / kcal<input id="food-kcal" name="kcal100" type="number" min="0" max="2000" step="0.01" inputmode="decimal" required placeholder="照标签填写" value="${esc(foodForm.kcal100)}"></label><label class="field">每100单位蛋白质 / g<input id="food-protein" name="protein100" type="number" min="0" max="100" step="0.01" inputmode="decimal" required placeholder="照标签填写" value="${esc(foodForm.protein100)}"></label></div><div class="form-preview" id="food-preview">填入标签和份量，就会显示计算过程。</div><label class="row small muted" style="margin:17px 0"><input type="checkbox" id="remember-food" ${foodForm.remember?'checked':''}>保存这个标签，方便下次复用</label><button class="btn btn-primary btn-wide" type="submit">${icon('plus')}记入 ${foodDate.slice(5).replace('-','月')} 日</button><p class="footnote">包装若写 kJ：先用 kJ ÷ 4.184 换成 kcal。按每份标注的产品，请先换算成每100 g 或每100 mL。</p></form></section><section class="panel"><div class="panel-title"><h3>已记录食物</h3><small>${entries.length} ITEMS</small></div>${entries.length?entries.map(f=>{const v=C.nutrition(f.quantity,f.kcal100,f.protein100);return `<div class="list-item"><div style="min-width:0"><strong style="overflow-wrap:anywhere">${esc(f.name)}</strong><p>${fmt(f.quantity)} ${f.unit} · 蛋白质 ${fmt(v.protein)} g</p></div><div class="row" style="gap:3px"><span class="food-values">${fmt(v.kcal)}<small> kcal</small></span><button class="quiet-icon" data-action="delete-food" data-id="${esc(f.id)}" aria-label="删除${esc(f.name)}饮食记录">${icon('x')}</button></div></div>`;}).join(''):'<div class="empty" style="min-height:170px"><div class="empty-icon">'+icon('food')+'</div><p>还没有记录。没有填的食物，<br>不会被自动算进来。</p></div>'}<div class="divider"></div><p class="tiny-note">这些数值取决于你填写的包装信息，不是实验室测量，也不提供减重或增肌处方。</p></section></div>`;
  }
  function syncFoodDraft() {
    if (!$('#food-form')) return;
    foodForm.name=$('#food-name').value; foodForm.unit=$('#food-unit').value; foodForm.quantity=$('#food-quantity').value;
    foodForm.kcal100=$('#food-kcal').value; foodForm.protein100=$('#food-protein').value;foodForm.remember=$('#remember-food').checked;
  }
  function refreshNutritionPreview() {
    const el=$('#food-preview');if(!el)return;
    syncFoodDraft();
    if([foodForm.quantity,foodForm.kcal100,foodForm.protein100].some(v=>v==='')){el.textContent='填入标签和份量，就会显示计算过程。';return;}
    try {
      const v=C.nutrition(foodForm.quantity,foodForm.kcal100,foodForm.protein100);
      el.innerHTML=`<div><strong>${fmt(v.kcal)}</strong> kcal &nbsp;·&nbsp; <strong>${fmt(v.protein)}</strong> g 蛋白质</div><div style="margin-top:9px">份数：${esc(foodForm.quantity)} ÷ 100 = ${fmt(v.factor,4)}<br>能量：${fmt(v.factor,4)} × ${esc(foodForm.kcal100)} = ${fmt(v.kcal,2)} kcal<br>蛋白质：${fmt(v.factor,4)} × ${esc(foodForm.protein100)} = ${fmt(v.protein,2)} g</div>`;
    }catch(error){el.textContent=error.message;}
  }
  function saveFood() {
    const form=$('#food-form');if(!form.reportValidity())return;
    syncFoodDraft();
    const label={id:C.id(), name:foodForm.name.trim(),unit:foodForm.unit,
      kcal100:C.number(foodForm.kcal100,0,2000,'标签能量'),protein100:C.number(foodForm.protein100,0,100,'标签蛋白质')};
    if(!label.name)throw new Error('请填写食物名称。');
    const entry={...label,id:C.id(),date:foodDate,quantity:C.number(foodForm.quantity,0.01,10000,'份量')};
    mutate(next=>{next.foodEntries.push(entry);if(foodForm.remember){const old=next.foodLabels.findIndex(f=>f.name===label.name&&f.unit===label.unit);if(old>=0){label.id=next.foodLabels[old].id;next.foodLabels[old]=label;}else next.foodLabels.push(label);}});
    Object.assign(foodForm,{name:'',unit:'g',quantity:'',kcal100:'',protein100:'',remember:true});
    render();toast('饮食已记入本机。');
  }
  function progressPage() {
    const stats=totalStats(state.sessions);
    const sessions=[...state.sessions].reverse().sort((a,b)=>b.date.localeCompare(a.date));
    const weights=[...state.weights].sort((a,b)=>b.date.localeCompare(a.date));
    const bars=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const date=C.localDate(d);const n=totalStats(state.sessions.filter(s=>s.date===date)).sets;bars.push({date,n});}
    const max=Math.max(1,...bars.map(b=>b.n));
    return `<p class="plan-view-intro">回看训练频率、完成组数与自己的历史记录。</p><div class="kpi-grid"><section class="panel"><div class="eyebrow">SESSIONS</div><div class="metric">${sessions.length}</div><p class="small muted">已归档训练</p></section><section class="panel"><div class="eyebrow">COMPLETED SETS</div><div class="metric">${stats.sets}</div><p class="small muted">累计完成组数</p></section><section class="panel"><div class="eyebrow">TRAINING DAYS</div><div class="metric">${new Set(state.sessions.filter(s=>C.sessionStats(s,EX).sets>0).map(s=>s.date)).size}</div><p class="small muted">累计训练天数</p></section></div><div class="dashboard"><div class="main-col"><section class="panel"><div class="panel-title"><h3>最近七天</h3><small>完成组数 / SETS</small></div><div class="bar-chart" role="img" aria-label="最近七天完成组数：${bars.map(b=>b.date+' '+b.n+'组').join('，')}">${bars.map(b=>`<div class="bar-col"><b>${b.n}</b><div class="bar" style="height:${Math.max(3,b.n/max*95)}px;opacity:${b.n?'.9':'.18'}"></div><span>${b.date.slice(5).replace('-','/')}</span></div>`).join('')}</div></section><div class="section-head"><div><h2>训练档案</h2><div class="eyebrow">YOUR LOCAL HISTORY</div></div><button class="btn btn-primary btn-small" data-action="report">${icon('trophy')}训练小结</button></div><div class="stack">${sessions.length?sessions.map(s=>{const st=C.sessionStats(s,EX);return `<article class="history-card"><div class="row space"><h3>${s.date}</h3><button class="quiet-icon" data-action="history" data-id="${esc(s.id)}" aria-label="查看${s.date}训练">${icon('arrow')}</button></div><p>${s.blocks.map(b=>EX_MAP.get(b.exerciseId).name).map(esc).join(' · ')}</p><div class="history-tags"><span class="chip">${st.sets} 组</span><span class="chip">${st.reps} 次</span>${st.seconds?`<span class="chip">${st.seconds} 秒</span>`:''}<span class="chip">${fmt(st.volume)} kg·次</span></div></article>`;}).join(''):'<div class="empty"><div class="empty-icon">'+icon('chart')+'</div><h3>还没有训练记录。</h3><p>回到训练页，完成一组并归档后，记录就会出现在这里。</p></div>'}</div></div><aside class="aside-col"><section class="panel"><div class="panel-title"><h3>体重小账本</h3><small>OPTIONAL</small></div>${weights.length?`<div class="weight-number">${fmt(weights[0].kg)} <small class="muted">kg</small></div><p class="tiny-note">最近记录 ${weights[0].date}</p>`:'<p class="small muted">可选记录。不设目标，不按体重打分。</p>'}<form id="weight-form" style="margin-top:17px"><div class="form-grid"><label class="field">日期<input id="weight-date" type="date" required min="2000-01-01" max="2100-12-31" value="${today()}"></label><label class="field">体重 / kg<input id="weight-kg" type="number" inputmode="decimal" min="1" max="500" step="0.1" required placeholder="选填记录"></label></div><button class="btn btn-secondary btn-wide" type="submit" style="margin-top:14px">${icon('plus')}保存体重</button></form><div class="weight-log" style="margin-top:15px">${weights.map(w=>`<div class="list-item"><span class="small muted">${w.date}</span><div class="row" style="gap:4px"><strong class="small">${fmt(w.kg)} kg</strong><button class="quiet-icon" data-action="delete-weight" data-date="${w.date}" aria-label="删除${w.date}体重">${icon('x')}</button></div></div>`).join('')}</div><p class="footnote">同一天再次保存会更新该日数值。</p></section><section class="panel aside-card"><h3>这些数字怎么算？</h3><p class="small muted" style="margin:12px 0">仅完成的负重组计入 kg·次；自重次数、计时秒数分别统计，不混成一个“热量”。</p><button class="btn btn-ghost btn-small" data-action="formulas">查看完整计算口径 ${icon('arrow')}</button></section></aside></div>`;
  }
  function history(id) {
    const s=state.sessions.find(v=>v.id===id);if(!s)return;
    modal(`<div class="eyebrow">WORKOUT ARCHIVE</div><h2>${s.date}</h2>`,`${s.blocks.map(b=>{const ex=EX_MAP.get(b.exerciseId);return `<div style="margin-bottom:18px"><h3>${esc(ex.name)}</h3><p class="tiny-note">${esc(ex.loadNote)}</p><div class="formula" style="margin-top:8px">${b.sets.map((v,i)=>`${i+1}. ${ex.mode==='time'?(v.seconds??'—')+'秒':(ex.mode==='weight'?(v.weight??'—')+' kg × ':'')+(v.reps??'—')+' 次'} ${v.done?'✓ 已完成':'○ 未完成'}`).map(esc).join('\n')}</div>${b.note?`<p class="small muted">备注：${esc(b.note)}</p>`:''}</div>`;}).join('')}${s.note?`<p class="small muted">本次备注：${esc(visibleNote(s))}</p>`:''}<div class="modal-actions"><button class="btn btn-danger" data-action="delete-session" data-id="${esc(id)}">删除</button><button class="btn btn-secondary" data-action="repeat-session" data-id="${esc(id)}">${icon('copy')}复制为新训练</button><button class="btn btn-primary" data-action="edit-session" data-id="${esc(id)}">编辑记录</button></div>`);
  }
  function settingsPage() {
    return `${pageHead('MAKE IT YOURS','设置与备份。','按喜欢的方式记录，保管自己的训练数据。')}<div class="wide-content stack"><section class="panel"><form id="profile-form"><label class="field">你的昵称<input id="nickname" maxlength="30" value="${esc(state.profile.nickname)}" placeholder="训练者"></label><button class="btn btn-secondary btn-small" type="submit" style="margin-top:12px">保存昵称</button></form><div class="settings-line"><div><strong>每日鼓励 / Daily note</strong><p>在首页显示一句轻松的训练鼓励。</p></div><button class="toggle ${state.profile.fun?'on':''}" role="switch" aria-checked="${state.profile.fun}" aria-label="每日鼓励" data-action="toggle-fun"></button></div><div style="margin-top:16px"><strong class="small">主题 / Theme</strong><div class="theme-picker"><button class="theme-option ${state.profile.theme==='lean'?'active':''}" data-action="theme" data-theme="lean">🟢 薄肌绿</button><button class="theme-option ${state.profile.theme==='blond'?'active':''}" data-action="theme" data-theme="blond">🟡 暖阳金</button></div></div></section><section class="panel"><div class="panel-title"><h3>本地数据与备份</h3>${icon('lock')}</div><p class="notice">${isNative()?'动作图片、计划和训练记录保存在这台手机的应用私有空间；应用没有网络权限，已关闭自动云备份。选图只读取你选择的图片，保存压缩副本，不改动相册原图。':'网页版写入当前浏览器的本地存储。移动 HTML 文件、换浏览器、隐私模式或清理站点数据，都可能使记录不可见或丢失。'}<br>卸载或清理应用前，请先导出 JSON。完整 JSON 包含动作图片、计划与记录，请保存在本机并自行保管。</p><div class="row wrap" style="margin-top:17px"><button class="btn btn-primary" data-action="export-json">${icon('download')}完整 JSON 备份</button><button class="btn btn-secondary" data-action="export-csv">训练 CSV</button><button class="btn btn-ghost" data-action="import-json">${icon('upload')}导入 JSON</button></div>${damagedRaw?'<button class="btn btn-danger btn-wide" style="margin-top:12px" data-action="export-raw">先导出未解析的原始数据</button>':''}<input id="import-file" class="file-input" type="file" accept="application/json,.json" aria-label="选择 JSON 备份"><p class="footnote">导入前会验证格式并显示确认；确认后整体替换，不是合并。建议先导出当前数据。JSON 包含自建动作、照片和计划；CSV 仅含已归档训练，不能用于完整恢复。</p><div class="danger-zone"><button class="btn btn-danger btn-small" data-action="reset">清空所有本地记录</button><p class="footnote">包括自建动作照片和自己的计划，清空前请先备份。</p></div></section><section class="panel"><h3>这个项目是什么？</h3><div class="settings-line"><div><strong>肌薄 · JIBO</strong><p>v1.4.0 · 本地优先 · 没有账号、广告、追踪或自动上传。</p></div></div><div class="settings-line"><div><strong>围绕薄肌，均衡训练</strong><p>健身房和居家 A / B / C 计划，兼顾全身力量、肩背与核心，按自己的节奏记录进步。</p></div></div><div class="settings-line"><div><strong>图示与许可</strong><p>${EX.length} 张动作图是示意性质，不是专业动作教学。代码与原创动作示意图采用 MIT 许可；原帖、漫画及人物参考图标另见素材说明。</p></div></div><div class="settings-line"><div><strong>边界</strong><p>内置计划是一般模板，自建内容由你整理；不提供医疗诊断或体型预测。计时器不会在退出 App 后发送系统通知。</p></div></div><button class="btn btn-ghost btn-small" style="margin-top:16px" data-action="formulas">${icon('info')}计算口径</button></section></div>`;
  }
  function formulas() {
    modal('<div class="eyebrow">TRANSPARENT CALCULATIONS</div><h2>每个数，讲清楚。</h2>',`<h3>1. 负重次数 / Load × reps</h3><div class="formula" style="margin:12px 0">20 kg × 12 次 = 240 kg·次\n20 kg × 12 次 = 240 kg·次\n20 kg × 10 次 = 200 kg·次\n总和 = 240 + 240 + 200 = 680 kg·次</div><p class="small muted">只计有效且勾选“完成”的组。空白不是零；重量填 0 是明确的 0。自重动作不估算负重，计时项目另算秒数。不同动作或器械不应仅凭这个总和判断效果。</p><div class="divider"></div><h3>2. 标签营养 / Label arithmetic</h3><div class="formula" style="margin:12px 0">假设标签每100 mL：62 kcal、蛋白质3.4 g\n记录250 mL：份数 = 250 ÷ 100 = 2.5\n能量 = 2.5 × 62 = 155 kcal\n蛋白质 = 2.5 × 3.4 = 8.5 g\nkJ ÷ 4.184 = kcal</div><p class="small muted">这是示例，不是某产品的真实标签。内部保留未四舍五入数值，显示时再处理小数；展示值可能有末位差异。</p><div class="divider"></div><h3>3. 本周训练天数</h3><p class="small muted" style="margin-top:10px">从本地时间周一到今天，至少有一组有效完成且已归档的日期，计为一个训练日。同一天多次训练只计一天；草稿和未来记录不计入。每周 3 天只是参考节奏。</p>`);
  }
  function modal(title,body) {
    const root=$('#modal');
    if(root.hidden)returnFocus=document.activeElement;
    root.innerHTML=`<section class="modal-box" role="dialog" aria-modal="true" aria-label="对话框"><div class="modal-head"><div>${title}</div><button class="icon-btn" data-action="close-modal" aria-label="关闭对话框">${icon('x')}</button></div>${body}</section>`;
    root.hidden=false;document.body.style.overflow='hidden';syncBackState();
    const focus=$('button,input,textarea,select,[tabindex="0"]',root);if(focus)focus.focus({preventScroll:true});
    syncKeyboard();
  }
  function closeModal() {
    theoryGallery=null;
    photoTicket++;photoBusy=false;
    $('#modal').hidden=true;$('#modal').innerHTML='';document.body.style.overflow='';
    pendingModalAction=null;
    if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});returnFocus=null;syncBackState();syncKeyboard();
  }
  function confirmModal(title,body,callback,button='确认',danger=false) {
    modal(`<h2>${esc(title)}</h2>`,`<p class="small muted">${esc(body)}</p><div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn ${danger?'btn-danger':'btn-primary'}" data-action="confirm">${esc(button)}</button></div>`);
    pendingModalAction=callback;
  }
  function report(session = null) {
    const stats=session?C.sessionStats(session,EX):totalStats(state.sessions);
    const date=session?session.date:today();
    const label=state.profile.nickname||'训练者';
    const title='肌薄 · 训练小结';
    const text=`${title}\n训练者：${label}\n日期：${date}\n${session?'本次':'累计归档'}完成：${stats.sets} 组 · ${stats.reps} 次${stats.seconds?' · '+stats.seconds+' 秒':''}\n负重次数：${fmt(stats.volume)} kg·次\n由肌薄本地生成；记录不代表训练效果或健康评分。`;
    lastReport=text;
    modal('<div class="eyebrow">LOCAL SHARE CARD</div><h2>你的训练小结。</h2>',`<div class="meme-ticket"><div class="eyebrow">YOUR OWN PROGRESS</div><h3>${stats.sets} 组，已记录。</h3><div class="report-text">${esc(text)}</div><div class="tear">LOCAL ONLY · NO AUTO SHARING</div></div><p class="tiny-note">复制后由你自己决定发给谁。不会自动访问联系人或发布。</p><div class="modal-actions"><button class="btn btn-primary" data-action="copy-report">${icon('copy')}复制战报文案</button></div>`);
  }
  async function copyText(text, message = '战报已复制。') {
    if(isNative()){window.LeanNative.copyText(text);toast(message);return;}
    try{await navigator.clipboard.writeText(text);toast(message);}
    catch(_){const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();const ok=document.execCommand('copy');t.remove();if(ok)toast(message);else{modal('<h2>长按或选择以下文字复制</h2>',`<textarea readonly style="min-height:260px">${esc(text)}</textarea>`);}}
  }
  function download(filename,content,mime='application/json') {
    if(isNative()){const ok=window.LeanNative.exportText(filename,content,mime);if(!ok)throw new Error('导出窗口正在打开，请完成或取消当前导出。');return;}
    const blob=new Blob([content],{type:mime+';charset=utf-8'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast('已请求导出，请确认浏览器的保存结果。');
  }
  function timerPicker() {
    modal('<div class="eyebrow">REST TIMER</div><h2>歇一下，不扣分。</h2>',`<p class="small muted">倒计时只在应用内显示；没有突然的声音，也不会后台推送。</p><div class="row wrap" style="margin-top:22px">${[30,60,90,120].map(s=>`<button class="btn btn-secondary" data-action="start-timer" data-seconds="${s}">${s} 秒</button>`).join('')}</div>`);
  }
  function startTimer(seconds) {
    if(!Number.isFinite(seconds)||seconds<15||seconds>3600)throw new Error('计时范围为 15–3600 秒。');
    timerEnd=Date.now()+seconds*1000;closeModal();clearInterval(timerInterval);saveRuntime();tickTimer();timerInterval=setInterval(tickTimer,500);
  }
  function tickTimer() {
    const remaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));
    const el=$('#timer');el.hidden=false;
    el.innerHTML=`<div><small>${remaining?'组间休息':'休息结束，可以继续'}</small><strong>${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}</strong></div><button class="btn btn-ghost btn-small" data-action="add-rest" aria-label="增加15秒休息">+15 秒</button><button class="btn btn-ghost btn-small" data-action="stop-timer" aria-label="关闭计时器">${remaining?'跳过':'收起'}</button>`;
    if(!remaining){clearInterval(timerInterval);timerInterval=null;}
  }
  async function importFile(file) {
    if(!file)return;
    const token=++importTicket;
    const startRevision=revision;
    if(file.size>C.MAX_BACKUP_BYTES){toast('备份不能超过 4 MB。');return;}
    loadingImport=true;
    try{
      const raw=await file.text();
      if(token!==importTicket)return;
      if(startRevision!==revision)throw new Error('读取备份期间记录发生变化，请重新选择文件，避免覆盖新编辑。');
      const incoming=C.parseBackup(raw,BASE_EX);
      const title='导入并替换当前记录？';
      modal(`<h2>${title}</h2>`,`<div class="notice">备份含 ${incoming.sessions.length} 次训练、${incoming.customExercises.length} 个自建动作（含照片）、${incoming.customPlans.length} 份自定义计划、${incoming.foodEntries.length} 条饮食和 ${incoming.weights.length} 条体重记录${incoming.draft?'，另有未结束草稿':''}。<br>这不是合并。确认后会替换当前本地数据。</div><div class="row wrap" style="margin-top:16px"><button class="btn btn-secondary" data-action="export-json">先备份当前数据</button></div><div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="confirm">确认替换</button></div>`);
      pendingModalAction=()=>{
        if(revision!==startRevision)throw new Error('记录已变化，导入已中止。请重新选择文件。');
        commit(incoming,true);closeModal();render();toast('备份已验证并导入。');
      };
    }catch(error){toast(error.message||'无法读取备份。');}
    finally{if(token===importTicket)loadingImport=false;}
  }
  function changeSet(input) {
    const {block:bid,set:sid,field}=input.dataset;
    const limits=field==='weight'?[0,1000,false]:field==='seconds'?[1,36000,true]:[1,1000,true];
    input.setCustomValidity('');
    try{
      const value=C.number(input.value,limits[0],limits[1],field==='weight'?'重量':field==='seconds'?'秒数':'次数',true,limits[2]);
      mutate(next=>{
        const block=next.draft?.blocks.find(b=>b.id===bid),set=block?.sets.find(s=>s.id===sid);if(!set)throw new Error('训练组不存在。');
        set[field]=value;if(!C.setReady(set,EX_MAP.get(block.exerciseId).mode))set.done=false;
      });
      refreshDraftStats();
    }catch(error){input.setCustomValidity(error.message);input.reportValidity();}
  }
  function checkVisibleInputs() {
    const inputs=[...document.querySelectorAll('#draft-area input')];
    const bad=inputs.find(input=>!input.checkValidity());if(bad){bad.reportValidity();return false;}return true;
  }
  function handleAction(button) {
    const a=button.dataset.action,{id,block:bid,set:sid,ex:exid}=button.dataset;
    const getBlock=next=>{const b=next.draft?.blocks.find(b=>b.id===bid);if(!b)throw new Error('找不到动作记录。');return b;};
    if(handleCustomAction(button))return;
    if(a==='settings')go('settings');
    else if(a==='close-modal')closeModal();
    else if(a==='confirm'){const fn=pendingModalAction;if(fn){fn();}}
    else if(a==='add-ex')addExercise(exid);
    else if(a==='detail')detail(exid);
    else if(a==='filter'){group=button.dataset.group;$('#exercise-grid').innerHTML=exerciseGrid();document.querySelectorAll('[data-action="filter"]').forEach(b=>{b.classList.toggle('active',b.dataset.group===group);b.setAttribute('aria-pressed',String(b.dataset.group===group));});}
    else if(a==='template')go('plans');
    else if(a==='theory-filter'){theoryAuthor=['sun','alan'].includes(button.dataset.author)?button.dataset.author:'all';refreshTheoryResults();}
    else if(a==='theory-category'){theoryCategory=theoryCategories.some(([key])=>key===button.dataset.category)?button.dataset.category:'all';refreshTheoryResults();}
    else if(a==='theory-clear'){theoryAuthor='all';theoryCategory='all';theorySearch='';$('#theory-search').value='';refreshTheoryResults();}
    else if(a==='theory-meme')theoryMeme();
    else if(a==='theory-gallery')changeTheoryImage(Number(button.dataset.direction));
    else if(a==='theory-image')theoryDetail(id);
    else if(a==='theory-source'){const post=(window.JIBO_THEORY_POSTS||[]).find(p=>p.id===id);if(post)copyText(post.sourceUrl,'原帖链接已复制，可粘贴到浏览器查看。');}
    else if(a==='theory-zoom'){const box=$('.theory-lightbox');if(box){const zoomed=box.classList.toggle('is-zoomed');button.setAttribute('aria-pressed',String(zoomed));button.textContent=zoomed?'适应屏幕':'放大阅读';}}
    else if(a==='theory-shuffle'){theoryAside=(theoryAside+1)%theoryAsides.length;$('#theory-aside-text').textContent=theoryAsides[theoryAside];}
    else if(a==='plan-view'){rememberScroll();planView=button.dataset.view==='progress'?'progress':'plans';render();}
    else if(a==='plan-location'){planLocation=['home','custom'].includes(button.dataset.location)?button.dataset.location:'gym';render();}
    else if(a==='plan-detail')planDetail(button.dataset.plan);
    else if(a==='start-plan')startPlan(button.dataset.plan);
    else if(a==='continue-workout'){overview=false;go('home');}
    else if(a==='workout-overview'){rememberScroll();overview=true;render();}
    else if(a==='toggle-auto-rest'){runtime.autoRest=!runtime.autoRest;saveRuntime();const y=window.scrollY;render();window.scrollTo(0,y);}
    else if(a==='training-guide')trainingGuide();
    else if(a==='add-set'){mutate(next=>getBlock(next).sets.push(C.newSet()));redrawDraft();}
    else if(a==='toggle-set'){
      if(!checkVisibleInputs())return;
      mutate(next=>{const b=getBlock(next),s=b.sets.find(v=>v.id===sid);if(!s)throw new Error('训练组不存在。');if(!s.done&&!C.setReady(s,EX_MAP.get(b.exerciseId).mode))throw new Error('请先填写这组的有效重量、次数或秒数，再标记完成。');s.done=!s.done;});
      const completed=getBlock(state).sets.find(s=>s.id===sid).done;
      redrawDraft();
      if(completed&&runtime.autoRest)startTimer(blockTarget(getBlock(state))?.restSeconds||90);
    }
    else if(a==='remove-set')confirmModal('删除这一组？','该组的重量、次数与完成状态都会移除。',()=>{mutate(next=>{const b=getBlock(next);b.sets=b.sets.filter(s=>s.id!==sid);});closeModal();redrawDraft();},'删除',true);
    else if(a==='remove-block')confirmModal('移除这个动作？','这个动作在当前草稿里的所有组都会移除。归档记录不受影响。',()=>{mutate(next=>next.draft.blocks=next.draft.blocks.filter(b=>b.id!==bid));closeModal();redrawDraft();},'移除',true);
    else if(a==='copy-last'){
      const b=getBlock(state),last=C.lastSessionBlock(state,b.exerciseId);if(!last)return;
      confirmModal('用上次记录填充？','将替换这个动作当前的所有组；复制后的组都保持未完成。',()=>{mutate(next=>getBlock(next).sets=last.block.sets.map(s=>({...s,id:C.id(),done:false})));closeModal();redrawDraft();},'复制');
    }
    else if(a==='block-note'){
      const b=getBlock(state);modal('<h2>动作备注</h2>',`<label class="field">器械、握把、单双侧口径<textarea id="block-note-input" maxlength="500">${esc(b.note)}</textarea></label><div class="modal-actions"><button class="btn btn-primary" data-action="confirm">保存备注</button></div>`);pendingModalAction=()=>{const note=$('#block-note-input').value;mutate(next=>getBlock(next).note=note);closeModal();redrawDraft();};
    }
    else if(a==='finish')requestFinish();
    else if(a==='discard-draft')confirmModal('放弃当前草稿？','草稿修改会移除。若正在编辑旧记录，原归档仍然保留。',()=>{mutate(next=>next.draft=null);closeModal();render();},'放弃草稿',true);
    else if(a==='timer')timerPicker();
    else if(a==='start-timer')startTimer(Number(button.dataset.seconds));
    else if(a==='stop-timer')stopTimer();
    else if(a==='add-rest'){timerEnd=Math.min(Math.max(Date.now(),timerEnd)+15000,Date.now()+3600000);saveRuntime();tickTimer();if(!timerInterval)timerInterval=setInterval(tickTimer,500);}
    else if(a==='quote'){$('#quote').textContent='“'+quotes[Math.floor(Math.random()*quotes.length)]+'”';}
    else if(a==='report')report();
    else if(a==='copy-report')copyText(lastReport||'');
    else if(a==='history')history(id);
    else if(a==='edit-session'||a==='repeat-session'){
      const s=state.sessions.find(s=>s.id===id);if(!s)return;
      const perform=()=>{mutate(next=>{const d=JSON.parse(JSON.stringify(s));if(a==='repeat-session'){d.id=C.id();d.date=today();d.blocks.forEach(b=>{b.id=C.id();b.sets.forEach(v=>{v.id=C.id();v.done=false;});});}next.draft=d;});go('home');toast(a==='repeat-session'?'已复制，所有组都未标记完成。':'正在编辑原记录，归档后更新。');};
      if(state.draft)confirmModal('替换当前草稿？','当前未归档修改会被替换。已有归档不会删除。',perform,'替换草稿');else perform();
    }
    else if(a==='delete-session')confirmModal('删除这次归档训练？','该训练记录会被删除；若有同一记录的编辑草稿，也会一并移除。',()=>{mutate(next=>{next.sessions=next.sessions.filter(s=>s.id!==id);if(next.draft?.id===id)next.draft=null;});closeModal();render();},'删除',true);
    else if(a==='delete-food')confirmModal('删除这条饮食记录？','只移除该次摄入记录，不删除保存的食品标签。',()=>{mutate(next=>next.foodEntries=next.foodEntries.filter(f=>f.id!==id));closeModal();render();},'删除',true);
    else if(a==='delete-weight')confirmModal('删除这条体重记录？',button.dataset.date+' 的体重数据会被移除。',()=>{mutate(next=>next.weights=next.weights.filter(w=>w.date!==button.dataset.date));closeModal();render();},'删除',true);
    else if(a==='toggle-fun'){mutate(next=>next.profile.fun=!next.profile.fun);render();}
    else if(a==='theme'){mutate(next=>next.profile.theme=button.dataset.theme);render();}
    else if(a==='formulas')formulas();
    else if(a==='export-json')download('jibo-backup-'+today()+'.json',C.backupJSON(state));
    else if(a==='export-csv')download('jibo-workouts-'+today()+'.csv',C.workoutCSV(state,EX),'text/csv');
    else if(a==='export-raw')download('lean-crew-unparsed-'+today()+'.txt',damagedRaw,'text/plain');
    else if(a==='import-json'){
      if(!$('#import-file'))throw new Error('请先打开设置。');
      $('#import-file').value='';$('#import-file').click();
    }
    else if(a==='reset'){
      modal('<h2>确实要清空吗？</h2>',`<p class="small muted">训练、自建动作与照片、自定义计划、饮食、体重、草稿、昵称和主题都将重置。先导出备份，再输入 <strong class="accent">清空</strong>。</p><label class="field" style="margin-top:18px">确认文字<input id="reset-text" autocomplete="off" placeholder="输入：清空"></label><div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn btn-danger" data-action="confirm">清空本地数据</button></div>`);pendingModalAction=()=>{if($('#reset-text').value!=='清空')throw new Error('未输入“清空”，没有删除任何数据。');commit(C.emptyState(),true);closeModal();render();toast('本地记录已重置。');};
    }
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.nav){go(button.dataset.nav);return;}
    if(button.dataset.action)safe(()=>handleAction(button));
  });
  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.id==='exercise-search'){search=el.value;$('#exercise-grid').innerHTML=exerciseGrid();}
    else if(el.id==='theory-search'){theorySearch=el.value;refreshTheoryResults();}
    else if(el.dataset.field)changeSet(el);
    else if(el.id==='draft-note')safe(()=>mutate(next=>next.draft.note=notePrefix(next.draft)+el.value));
    else if(el.closest('#food-form'))refreshNutritionPreview();
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='draft-date')safe(()=>{C.dateValue(el.value);mutate(next=>next.draft.date=el.value);});
    else if(el.id==='food-date')safe(()=>{foodDate=C.dateValue(el.value);render();});
    else if(el.id==='import-file')importFile(el.files[0]);
    else if(el.id==='exercise-camera'||el.id==='exercise-gallery')loadExercisePhoto(el.files[0]);
    else if(el.id==='saved-food'){
      const label=state.foodLabels.find(f=>f.id===el.value);if(!label)return;
      $('#food-name').value=label.name;$('#food-unit').value=label.unit;$('#food-kcal').value=label.kcal100;$('#food-protein').value=label.protein100;refreshNutritionPreview();
    }else if(el.closest('#food-form'))refreshNutritionPreview();
  });
  document.addEventListener('submit',event=>{
    event.preventDefault();
    safe(()=>{
      if(event.target.id==='custom-exercise-form')saveCustomExercise();
      else if(event.target.id==='custom-plan-form')saveCustomPlan();
      else if(event.target.id==='food-form')saveFood();
      else if(event.target.id==='profile-form'){mutate(next=>next.profile.nickname=$('#nickname').value.trim()||'训练者');render();toast('昵称已保存。');}
      else if(event.target.id==='weight-form'){
        if(!event.target.reportValidity())return;
        const date=C.dateValue($('#weight-date').value),kg=C.number($('#weight-kg').value,1,500,'体重');
        mutate(next=>{const old=next.weights.find(w=>w.date===date);if(old)old.kg=kg;else next.weights.push({date,kg});});render();toast('体重已保存。');
      }
    });
  });
  document.addEventListener('keydown',event=>{
    if($('#modal').hidden)return;
    if(event.key==='Escape'){closeModal();event.preventDefault();}
    if(event.key==='Tab'){
      const focusable=[...$('#modal').querySelectorAll('button,input,textarea,select,a,[tabindex="0"]')].filter(e=>!e.disabled);
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)rememberScroll();else if(timerEnd)tickTimer();});
  window.addEventListener('storage',event=>{
    if(event.key!==STORE||isNative())return;
    try{if(event.newValue){state=C.parseBackup(event.newValue,BASE_EX);}else state=C.emptyState();revision+=1;refreshCatalog();closeModal();render();toast('已同步另一个窗口的本地修改。');}catch(_){toast('另一个窗口写入的数据无效，请先备份再处理。');}
  });
  window.LeanBack=function(){if(document.body.classList.contains('keyboard-open')){document.activeElement?.blur();return true;}if(!$('#modal').hidden){closeModal();return true;}if(activeWorkout()){rememberScroll();overview=true;render();return true;}if(tab!=='home'){go('home');return true;}return false;};
  window.LeanNativeResult=function(message){toast(String(message));};
  const lastPlanSession=state.draft || [...state.sessions].reverse().sort((a,b)=>b.date.localeCompare(a.date)).find(s=>C.sessionPlanId(s));
  planLocation=PLANS.find(p=>p.id===C.sessionPlanId(lastPlanSession))?.location || 'gym';
  render();
  if(timerEnd){tickTimer();if(timerEnd>Date.now())timerInterval=setInterval(tickTimer,500);}
  if('serviceWorker' in navigator && !isNative() && !window.LEAN_SINGLE_FILE && ['http:','https:'].includes(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{/* file mode and restrictive hosts need no service worker */});
  }
})();
