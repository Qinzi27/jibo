'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../web/core.js');
const EX = require('../web/exercises.js');
const PLANS = require('../web/plans.js');
const ex = id => EX.find(e => e.id === id);
function stateWithBlock(id='chest-press') {
  const state=C.emptyState();state.draft=C.newDraft('2026-09-16');state.draft.blocks=[C.newBlock(id)];return state;
}
function filled() {
  const state=stateWithBlock();state.draft.blocks[0].sets.forEach((s,i)=>Object.assign(s,{weight:20,reps:[12,12,10][i],done:true}));return state;
}
test('empty state validates and contains no private/sample records',()=>assert.deepEqual(C.validateState(C.emptyState(),EX),C.emptyState()));
test('local date is not derived by UTC truncation',()=>{const d=new Date(2026,8,16,0,15);assert.equal(C.localDate(d),'2026-09-16');});
test('valid leap day accepted; impossible dates rejected',()=>{assert.equal(C.dateValue('2024-02-29'),'2024-02-29');assert.throws(()=>C.dateValue('2025-02-29'));assert.throws(()=>C.dateValue('2026-13-01'));});
test('number validator rejects NaN, Infinity, boolean and whitespace',()=>{for(const n of [NaN,Infinity,true,{},' '])assert.throws(()=>C.number(n,0,100,'值'));});
test('blank differs from explicit zero',()=>{assert.equal(C.number('',0,100,'重量',true),null);assert.equal(C.number('0',0,100,'重量',true),0);});
test('integer repetitions reject decimal counts',()=>assert.throws(()=>C.number('12.5',1,1000,'次数',false,true)));
test('20x12 + 20x12 + 20x10 equals 680 kg-reps',()=>{const s=filled();assert.deepEqual(C.sessionStats(s.draft,EX),{sets:3,reps:34,seconds:0,volume:680,exercises:1});});
test('incomplete sets do not count towards totals',()=>{const s=filled();s.draft.blocks[0].sets[2].done=false;assert.equal(C.sessionStats(s.draft,EX).volume,480);});
test('zero external load is valid only with filled repetitions',()=>{assert.equal(C.setReady({weight:0,reps:12},'weight'),true);assert.equal(C.setReady({weight:null,reps:12},'weight'),false);});
test('bodyweight reps never become inferred load',()=>{const s=stateWithBlock('push-up');Object.assign(s.draft.blocks[0].sets[0],{weight:65,reps:15,done:true});assert.deepEqual(C.sessionStats(s.draft,EX),{sets:1,reps:15,seconds:0,volume:0,exercises:1});});
test('timed movements sum seconds separately',()=>{const s=stateWithBlock('plank');Object.assign(s.draft.blocks[0].sets[0],{seconds:45,done:true});assert.deepEqual(C.sessionStats(s.draft,EX),{sets:1,reps:0,seconds:45,volume:0,exercises:1});});
test('empty archive is rejected',()=>assert.throws(()=>C.archive(stateWithBlock(),EX)));
test('archive is immutable and removes draft only from returned state',()=>{const s=filled();const {state}=C.archive(s,EX);assert.equal(state.sessions.length,1);assert.equal(state.draft,null);assert.notEqual(s.draft,null);});
test('editing same session updates rather than duplicates',()=>{let s=C.archive(filled(),EX).state;s.draft=JSON.parse(JSON.stringify(s.sessions[0]));s.draft.blocks[0].sets[0].weight=25;s=C.archive(s,EX).state;assert.equal(s.sessions.length,1);assert.equal(C.sessionStats(s.sessions[0],EX).volume,740);});
test('250mL at 62kcal and 3.4g per100 gives 155kcal,8.5g',()=>assert.deepEqual(C.nutrition(250,62,3.4),{factor:2.5,kcal:155,protein:8.5}));
test('nutrition accepts explicit zero values',()=>assert.deepEqual(C.nutrition(250,0,0),{factor:2.5,kcal:0,protein:0}));
test('nutrition rejects negative quantity and impossible protein density',()=>{assert.throws(()=>C.nutrition(-1,62,3.4));assert.throws(()=>C.nutrition(250,62,101));});
test('valid backup roundtrip preserves notes, draft, settings, labels, food and weight',()=>{const s=filled();s.profile.nickname='测试 <>&';s.profile.theme='blond';s.profile.fun=false;s.draft.note='多行\n中文<>&';s.foodLabels=[{id:'milk',name:'牛奶',unit:'mL',kcal100:62,protein100:3.4}];s.foodEntries=[{...s.foodLabels[0],id:'food1',date:'2026-09-16',quantity:250}];s.weights=[{date:'2026-09-16',kg:65}];assert.deepEqual(C.parseBackup(JSON.stringify(s),EX),s);});
test('malformed JSON rejected',()=>assert.throws(()=>C.parseBackup('{broken',EX)));
test('future unsupported schema rejected',()=>{const s=C.emptyState();s.schemaVersion=99;assert.throws(()=>C.validateState(s,EX));});
test('unknown exercise is rejected, not silently dropped',()=>{const s=filled();s.draft.blocks[0].exerciseId='unknown';assert.throws(()=>C.validateState(s,EX));});
test('invalid done flag and missing completed weights rejected',()=>{const s=filled();s.draft.blocks[0].sets[0].done='false';assert.throws(()=>C.validateState(s,EX));s.draft.blocks[0].sets[0].done=true;s.draft.blocks[0].sets[0].weight=null;assert.throws(()=>C.validateState(s,EX));});
test('duplicate set, block, and session identifiers rejected',()=>{let s=filled();s.draft.blocks[0].sets[1].id=s.draft.blocks[0].sets[0].id;assert.throws(()=>C.validateState(s,EX));s=filled();s.draft.blocks.push(s.draft.blocks[0]);assert.throws(()=>C.validateState(s,EX));s=C.archive(filled(),EX).state;s.sessions.push(s.sessions[0]);assert.throws(()=>C.validateState(s,EX));});
test('duplicate same-day weights rejected',()=>{const s=C.emptyState();s.weights=[{date:'2026-09-16',kg:65},{date:'2026-09-16',kg:66}];assert.throws(()=>C.validateState(s,EX));});
test('false boolean is preserved instead of defaulting true',()=>{const s=C.emptyState();s.profile.fun=false;assert.equal(C.validateState(s,EX).profile.fun,false);});
test('negative imported weights and extremely large collections rejected',()=>{const s=filled();s.draft.blocks[0].sets[0].weight=-1;assert.throws(()=>C.validateState(s,EX));const e=C.emptyState();e.sessions=new Array(5001).fill({});assert.throws(()=>C.validateState(e,EX));});
test('oversized backup fails before parsing',()=>assert.throws(()=>C.parseBackup('x'.repeat(C.MAX_BACKUP_BYTES+1),EX)));
test('unknown metadata/prototype keys are not carried into clean model',()=>{const s=C.emptyState();s.extra='ignore';const cleaned=C.validateState(s,EX);assert.equal(Object.hasOwn(cleaned,'extra'),false);});
test('CSV quotes commas/newlines and neutralizes spreadsheet formula injection',()=>{assert.equal(C.csvCell('a,"b"\nc'),'"a,""b""\nc"');assert.equal(C.csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(C.csvCell('-cmd'),'"\'-cmd"');assert.equal(C.csvCell(12),'"12"');});
test('CSV includes completed flag, load convention, and records only archived sessions',()=>{let s=filled();assert.equal(C.workoutCSV(s,EX).split('\r\n').length,1);s=C.archive(s,EX).state;const csv=C.workoutCSV(s,EX);assert.equal(csv.split('\r\n').length,4);assert.ok(csv.includes('load_convention'));assert.ok(csv.includes('器械推胸'));assert.ok(csv.includes('"20","12","","1"'));});
test('latest history is selected by date and copying does not mutate source',()=>{const s=C.archive(filled(),EX).state;const another=JSON.parse(JSON.stringify(s.sessions[0]));another.id=C.id();another.date='2026-09-15';s.sessions.push(another);assert.equal(C.lastSessionBlock(s,'chest-press').date,'2026-09-16');assert.equal(C.lastSessionBlock(s,'plank'),null);});
test('all built-in exercises have unique ids, local images and valid modes',()=>{assert.equal(EX.length,17);assert.equal(new Set(EX.map(e=>e.id)).size,EX.length);for(const e of EX){assert.ok(['weight','reps','time'].includes(e.mode));assert.ok(e.image.startsWith('assets/'));assert.ok(e.loadNote);}});

test('latest of multiple same-day sessions is selected',()=>{const s=C.archive(filled(),EX).state;const newer=JSON.parse(JSON.stringify(s.sessions[0]));newer.id=C.id();newer.blocks[0].sets[0].weight=99;s.sessions.push(newer);assert.equal(C.lastSessionBlock(s,'chest-press').block.sets[0].weight,99);});

function completedPlan(planId, date) {
  const draft=C.newPlanDraft(PLANS.find(plan=>plan.id===planId),date);
  Object.assign(draft.blocks[0].sets[0],{weight:10,reps:10,done:true});
  return draft;
}
test('new profiles use the 肌薄 default while imported profiles retain their identity',()=>{
  assert.equal(C.emptyState().profile.nickname,'训练者');
  const old=filled();old.profile.nickname='施工员';
  assert.deepEqual(C.parseBackup(JSON.stringify(old),EX),old);
});
test('both venues offer A/B/C templates and every generated draft validates with the supported exercise catalogue',()=>{
  assert.equal(PLANS.length,6);
  assert.equal(new Set(PLANS.map(plan=>plan.id)).size,6);
  for(const location of ['gym','home'])assert.deepEqual(PLANS.filter(plan=>plan.location===location).map(plan=>plan.letter),['A','B','C']);
  for(const plan of PLANS){
    const state=C.emptyState();state.draft=C.newPlanDraft(plan,'2026-09-16');
    assert.deepEqual(C.validateState(state,EX),state);
    assert.equal(C.sessionPlanId(state.draft),plan.id);
    assert.deepEqual(C.sessionStats(state.draft,EX),{sets:0,reps:0,seconds:0,volume:0,exercises:0});
    assert.throws(()=>C.archive(state,EX));
    for(const block of state.draft.blocks)for(const set of block.sets){
      assert.deepEqual([set.weight,set.reps,set.seconds,set.done],[null,null,null,false]);
    }
  }
});
test('generated plans preserve source templates and give each draft, block and set fresh identity',()=>{
  const before=JSON.stringify(PLANS);
  const first=C.newPlanDraft(PLANS[0],'2026-09-16'),second=C.newPlanDraft(PLANS[0],'2026-09-16');
  const ids=draft=>[draft.id,...draft.blocks.flatMap(block=>[block.id,...block.sets.map(set=>set.id)])];
  const all=[...ids(first),...ids(second)];assert.equal(new Set(all).size,all.length);
  first.blocks[0].sets[0].reps=12;
  assert.equal(second.blocks[0].sets[0].reps,null);assert.equal(JSON.stringify(PLANS),before);
});
test('plan targets survive backup and archive without becoming actual values',()=>{
  const state=C.emptyState();state.draft=completedPlan('home-a','2026-09-16');
  const {state:archived}=C.archive(state,EX);
  assert.equal(archived.schemaVersion,2);
  assert.equal(C.sessionStats(archived.sessions[0],EX).sets,1);
  assert.equal(C.sessionPlanId(archived.sessions[0]),'home-a');
  assert.match(archived.sessions[0].blocks[0].note,/建议 2 组/);
  assert.deepEqual(C.parseBackup(JSON.stringify(archived),EX),archived);
});
test('home plans cover pulling and use the existing total-repetition convention for single-arm rows',()=>{
  for(const plan of PLANS.filter(plan=>plan.location==='home'))assert.ok(plan.blocks.some(block=>block.exerciseId==='dumbbell-row'));
  const state=stateWithBlock('dumbbell-row');
  Object.assign(state.draft.blocks[0].sets[0],{weight:8,reps:20,done:true});
  assert.equal(C.sessionStats(state.draft,EX).volume,160);
});
test('invalid plan definitions cannot create oversized, empty or malformed draft data',()=>{
  assert.throws(()=>C.newPlanDraft({...PLANS[0],id:'a]\n[spoof]'}));
  assert.throws(()=>C.newPlanDraft({...PLANS[0],blocks:[]}));
  assert.throws(()=>C.newPlanDraft({...PLANS[0],blocks:[{...PLANS[0].blocks[0],sets:1000}]}));
  assert.throws(()=>C.newPlanDraft(PLANS[0],'2026-02-30'));
});
test('plan tags are recognized only as a full first line and never inferred from ordinary notes',()=>{
  assert.equal(C.sessionPlanId({note:'[肌薄计划:gym-b]\r\n备注'}),'gym-b');
  assert.equal(C.sessionPlanId({note:'今天尝试全身 B'}),null);
  assert.equal(C.sessionPlanId({note:'备注\n[肌薄计划:gym-b]'}),null);
  assert.equal(C.sessionPlanId({note:'[肌薄计划:gym-b] 其他文字'}),null);
  assert.equal(C.sessionPlanId(null),null);
});
test('weekly summary counts distinct archived training dates across a year boundary and excludes drafts or future dates',()=>{
  const state=C.emptyState();
  state.sessions=[completedPlan('gym-a','2025-12-28'),completedPlan('gym-a','2025-12-29'),completedPlan('gym-b','2025-12-31'),completedPlan('home-b','2025-12-31'),completedPlan('gym-c','2026-01-01'),completedPlan('gym-a','2026-01-02')];
  state.draft=completedPlan('gym-a','2025-12-30');
  const before=JSON.stringify(state);
  assert.deepEqual(C.weeklyTrainingSummary(state,EX,'2026-01-01'),{weekStart:'2025-12-29',weekEnd:'2026-01-04',dates:['2025-12-29','2025-12-31','2026-01-01'],days:3,sessions:4,sets:4});
  assert.equal(JSON.stringify(state),before);
});
test('weekly summary uses completed valid sets and handles Sunday/Monday rollover',()=>{
  const state=C.emptyState();
  state.sessions=[completedPlan('gym-a','2026-08-31'),completedPlan('gym-b','2026-09-06'),C.newPlanDraft(PLANS[0],'2026-09-05')];
  const invalid=completedPlan('gym-a','2026-09-04');invalid.blocks[0].sets[0].weight=null;state.sessions.push(invalid);
  assert.deepEqual(C.weeklyTrainingSummary(state,EX,'2026-09-06'),{weekStart:'2026-08-31',weekEnd:'2026-09-06',dates:['2026-08-31','2026-09-06'],days:2,sessions:2,sets:2});
  assert.deepEqual(C.weeklyTrainingSummary(state,EX,'2026-09-07'),{weekStart:'2026-09-07',weekEnd:'2026-09-13',dates:[],days:0,sessions:0,sets:0});
});
test('local week boundaries remain correct in time zones on both sides of UTC and across DST',()=>{
  const {execFileSync}=require('node:child_process');
  const script="const C=require('./web/core.js'); const result=['2026-03-09','2026-10-05'].map(date=>C.weeklyTrainingSummary(C.emptyState(),[],date)); process.stdout.write(JSON.stringify(result));";
  for(const TZ of ['America/Los_Angeles','Australia/Sydney']){
    const result=JSON.parse(execFileSync(process.execPath,['-e',script],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ},encoding:'utf8'}));
    assert.equal(result[0].weekStart,'2026-03-09',TZ);assert.equal(result[0].weekEnd,'2026-03-15',TZ);
    assert.equal(result[1].weekStart,'2026-10-05',TZ);assert.equal(result[1].weekEnd,'2026-10-11',TZ);
  }
});
test('recommendation rotates completed A/B/C sessions across venues and wraps to A',()=>{
  const state=C.emptyState();
  assert.equal(C.recommendPlan(state,PLANS,EX,'gym','2026-09-16').id,'gym-a');
  state.sessions.push(completedPlan('gym-a','2026-09-14'));
  assert.equal(C.recommendPlan(state,PLANS,EX,'home','2026-09-16').id,'home-b');
  state.sessions.push(completedPlan('home-b','2026-09-15'));
  assert.equal(C.recommendPlan(state,PLANS,EX,'gym','2026-09-16').id,'gym-c');
  state.sessions.push(completedPlan('gym-c','2026-09-16'));
  assert.equal(C.recommendPlan(state,PLANS,EX,'gym','2026-09-16').id,'gym-a');
});
test('recommendation ignores active, incomplete, untagged, unknown and future sessions',()=>{
  const state=C.emptyState();state.sessions=[completedPlan('gym-a','2026-09-14')];
  const custom=completedPlan('gym-c','2026-09-15');custom.note='自己的训练';
  const unknown=completedPlan('gym-c','2026-09-15');unknown.note='[肌薄计划:unknown]';
  state.sessions.push(C.newPlanDraft(PLANS[2],'2026-09-15'),custom,unknown,completedPlan('gym-c','2026-09-17'));
  state.draft=completedPlan('gym-b','2026-09-16');
  assert.equal(C.recommendPlan(state,PLANS,EX,'gym','2026-09-16').id,'gym-b');
  assert.equal(C.recommendPlan(state,PLANS,EX,'unknown','2026-09-16'),null);
});
test('recommendation sorts by calendar date, breaks same-day ties by stored order and does not mutate history',()=>{
  const state=C.emptyState();state.sessions=[completedPlan('gym-a','2026-09-16'),completedPlan('gym-c','2026-09-15'),completedPlan('home-b','2026-09-16')];
  const before=JSON.stringify(state),plansBefore=JSON.stringify(PLANS);
  assert.equal(C.recommendPlan(state,PLANS,EX,'gym','2026-09-16').id,'gym-c');
  assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(PLANS),plansBefore);
});

const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XmAAAAAASUVORK5CYII=';
const customExercise = (fields={}) => C.newCustomExercise({name:'我的划船',group:'背部',mode:'weight',...fields});
const customPlan = (exerciseId,fields={}) => C.newCustomPlan({name:'自己的练习',blocks:[{exerciseId,sets:2,target:'8–12 次',restSeconds:75,note:'用同一握把'}],...fields});
function customState() {
  const state=C.emptyState();const exercise=customExercise({image:PIXEL_PNG});
  state.customExercises.push(exercise);state.customPlans.push(customPlan(exercise.id));
  state.draft=C.newPlanDraft(state.customPlans[0],'2026-09-16');
  return state;
}
test('schema v1 migrates every existing field without changing the input or requiring a new storage key',()=>{
  const old=C.archive(filled(),EX).state;old.schemaVersion=1;delete old.customExercises;delete old.customPlans;
  old.profile={nickname:'原来的名字 <>&',theme:'blond',fun:false};
  old.draft=C.newDraft('2026-09-16');old.draft.note='未归档\n空白仍是空白';old.draft.blocks=[C.newBlock('push-up')];
  Object.assign(old.draft.blocks[0].sets[0],{weight:0,reps:4,done:true});
  old.sessions[0].blocks[0].note='器械 01\n原始口径';
  old.foodLabels=[{id:'milk-v1',name:'牛奶',unit:'mL',kcal100:62,protein100:3.4}];
  old.foodEntries=[{...old.foodLabels[0],id:'meal-v1',date:'2026-09-16',quantity:250}];
  old.weights=[{date:'2026-09-16',kg:65.4}];
  const original=JSON.stringify(old);const migrated=C.parseBackup(original,EX);
  assert.deepEqual(migrated,{...old,schemaVersion:2,customExercises:[],customPlans:[]});
  assert.equal(JSON.stringify(old),original);
  assert.deepEqual(C.parseBackup(JSON.stringify(migrated,null,2),EX),migrated);
  assert.equal(migrated.draft.blocks[0].sets[0].weight,0);
  assert.equal(migrated.draft.blocks[0].sets[1].weight,null);
});
test('a damaged v2 collection or a false v1 declaration is rejected instead of discarding custom content',()=>{
  for(const key of ['customExercises','customPlans']){
    const state=C.emptyState();delete state[key];assert.throws(()=>C.validateState(state,EX));
  }
  const state=customState();state.schemaVersion=1;assert.throws(()=>C.validateState(state,EX),/旧版/);
});
test('custom exercise identities are fresh and required names, modes and existing groups are checked',()=>{
  const first=customExercise(),second=customExercise();assert.match(first.id,/^custom-/);assert.notEqual(first.id,second.id);
  assert.equal(first.en,'Custom exercise');assert.equal(first.image,'');
  for(const fields of [{name:' '},{name:'x'.repeat(81)},{mode:'energy'},{group:'unknown'},{loadNote:''}])assert.throws(()=>customExercise(fields));
  const state=C.emptyState();state.customExercises=[first,first];assert.throws(()=>C.validateState(state,EX),/重复/);
  state.customExercises=[{...first,id:'chest-press'}];assert.throws(()=>C.validateState(state,EX),/编号/);
});
test('custom photos roundtrip unchanged and reject remote, SVG, malformed base64 and mismatched raster signatures',()=>{
  const state=customState();assert.deepEqual(C.parseBackup(JSON.stringify(state,null,2),EX),state);
  for(const image of [
    'https://example.com/photo.jpg','file:///tmp/picture.png','data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:image/gif;base64,R0lGODlh','data:image/png;base64,invalid!!','data:image/jpeg;base64,PHN2Zz48L3N2Zz4=',
    'data:image/png;base64,','data:image/png;base64,AAAA',PIXEL_PNG.replace('image/png','image/webp')
  ])assert.throws(()=>customExercise({image}),image.slice(0,60));
});
test('raster MIME allowlist accepts JPEG and WebP container signatures without pretending to decode them',()=>{
  // The browser must still decode/resize camera images. These fixtures exercise
  // the model's container allowlist, not an image decoder or visual validity.
  const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1,255,217]);
  const webp=Buffer.from([82,73,70,70,8,0,0,0,87,69,66,80,86,80,56,32]);
  for(const [mime,bytes] of [['jpeg',jpeg],['webp',webp]]){
    const image='data:image/'+mime+';base64,'+bytes.toString('base64');
    assert.equal(customExercise({image}).image,image);
  }
});
test('individual photo, collection counts and complete export size limits fail without modifying source data',()=>{
  const header=Buffer.from(PIXEL_PNG.split(',')[1],'base64');
  const imageOfSize=bytes=>{const raw=Buffer.alloc(bytes,0);header.copy(raw);return 'data:image/png;base64,'+raw.toString('base64');};
  const largest=imageOfSize(C.MAX_CUSTOM_IMAGE_BYTES);
  assert.equal(customExercise({image:largest}).image,largest);
  assert.throws(()=>customExercise({image:imageOfSize(C.MAX_CUSTOM_IMAGE_BYTES+1)}),/200 KB/);
  let state=C.emptyState();state.customExercises=Array.from({length:C.MAX_CUSTOM_EXERCISES+1},()=>customExercise());
  assert.throws(()=>C.validateState(state,EX),/数量/);
  state=C.emptyState();state.customPlans=Array.from({length:C.MAX_CUSTOM_PLANS+1},()=>customPlan('chest-press'));
  assert.throws(()=>C.validateState(state,EX),/数量/);
  state=C.emptyState();state.customExercises=Array.from({length:16},()=>customExercise({image:largest}));
  const before=JSON.stringify(state);assert.throws(()=>C.validateState(state,EX),/4 MB/);assert.equal(JSON.stringify(state),before);
});
test('custom plans validate every reference and reject missing, empty and oversized target definitions',()=>{
  const state=customState();assert.deepEqual(C.validateState(state,EX),state);
  for(const fields of [{name:''},{blocks:[]},{durationMinutes:0},{durationMinutes:1.5},
    {blocks:[{exerciseId:'chest-press',sets:11,target:'10次',restSeconds:90}]},
    {blocks:[{exerciseId:'chest-press',sets:2,target:'',restSeconds:90}]},
    {blocks:[{exerciseId:'chest-press',sets:2,target:'10次',restSeconds:601}]}]){
    assert.throws(()=>customPlan('chest-press',fields));
  }
  const broken=C.emptyState();broken.customPlans=[customPlan('custom-missing')];
  assert.throws(()=>C.validateState(broken,EX),/不存在/);
  broken.customPlans=[customPlan('chest-press')];broken.customPlans.push(broken.customPlans[0]);assert.throws(()=>C.validateState(broken,EX),/重复/);
});
test('custom plan copies preserve targets in notes and never count targets as measured or completed sets',()=>{
  const state=customState();const template=JSON.stringify(state.customPlans[0]);
  const another=C.newPlanDraft(state.customPlans[0],'2026-09-16');
  assert.match(state.draft.note,/^\[肌薄计划:custom-plan-/);
  assert.equal(C.sessionPlanId(state.draft),state.customPlans[0].id);
  assert.match(state.draft.blocks[0].note,/建议 2 组 × 8–12 次；组间休息 75 秒/);
  assert.deepEqual(C.sessionStats(state.draft,C.allExercises(state,EX)),{sets:0,reps:0,seconds:0,volume:0,exercises:0});
  for(const set of state.draft.blocks[0].sets)assert.deepEqual([set.weight,set.reps,set.seconds,set.done],[null,null,null,false]);
  assert.notEqual(state.draft.id,another.id);assert.notEqual(state.draft.blocks[0].sets[0].id,another.blocks[0].sets[0].id);
  assert.equal(JSON.stringify(state.customPlans[0]),template);assert.throws(()=>C.archive(state,EX));
});
test('custom weighted, reps and timed records archive, export and calculate separately using the current catalogue',()=>{
  let state=C.emptyState();
  state.customExercises=[customExercise({name:'=CUSTOM_WEIGHT',mode:'weight'}),customExercise({name:'自定义次数',mode:'reps'}),customExercise({name:'自定义计时',mode:'time'})];
  state.draft=C.newDraft('2026-09-16');state.draft.blocks=state.customExercises.map(item=>C.newBlock(item.id));
  Object.assign(state.draft.blocks[0].sets[0],{weight:12.5,reps:8,done:true});
  Object.assign(state.draft.blocks[1].sets[0],{weight:999,reps:20,done:true});
  Object.assign(state.draft.blocks[2].sets[0],{weight:999,reps:100,seconds:45,done:true});
  state=C.archive(state,EX).state;
  assert.deepEqual(C.sessionStats(state.sessions[0],C.allExercises(state,EX)),{sets:3,reps:28,seconds:45,volume:100,exercises:3});
  assert.equal(C.weeklyTrainingSummary(state,EX,'2026-09-16').sets,3);
  const csv=C.workoutCSV(state,EX);assert.ok(csv.includes("'="+'CUSTOM_WEIGHT'));assert.ok(csv.includes('"12.5","8","","1"'));
  assert.ok(csv.includes('"","20","","1"'));assert.ok(csv.includes('"","","45","1"'));assert.ok(!csv.includes('"999"'));
  assert.deepEqual(C.parseBackup(JSON.stringify(state,null,2),EX),state);
});
test('merging a stale UI catalogue is idempotent and cannot rescue dangling custom references after deletion/import',()=>{
  const state=customState(),merged=C.allExercises(state,EX),plans=C.allPlans(state,PLANS);
  assert.deepEqual(C.allExercises(state,merged),merged);assert.deepEqual(C.allPlans(state,plans),plans);
  assert.equal(C.allExercises(C.emptyState(),merged).length,EX.length);
  assert.equal(C.allPlans(C.emptyState(),plans).length,PLANS.length);
  const broken=JSON.parse(JSON.stringify(state));broken.customExercises=[];
  assert.throws(()=>C.validateState(broken,merged),/不存在|不支持/);
});
test('referenced custom exercises cannot be removed from draft, archive or plans; unreferenced removal is immutable',()=>{
  const exercise=customExercise();
  for(const reference of ['draft','session','plan']){
    const state=C.emptyState();state.customExercises=[exercise];
    if(reference==='plan')state.customPlans=[customPlan(exercise.id)];
    else {
      state.draft=C.newDraft('2026-09-16');state.draft.blocks=[C.newBlock(exercise.id)];
      if(reference==='session'){Object.assign(state.draft.blocks[0].sets[0],{weight:10,reps:10,done:true});state.sessions=[state.draft];state.draft=null;}
    }
    const before=JSON.stringify(state);assert.throws(()=>C.removeCustomExercise(state,exercise.id,EX),/引用/);assert.equal(JSON.stringify(state),before);
  }
  const state=C.emptyState();state.customExercises=[exercise];
  assert.equal(C.removeCustomExercise(state,exercise.id,EX).customExercises.length,0);assert.equal(state.customExercises.length,1);
});
test('changing a used exercise mode or load convention is rejected while a label/photo update preserves numeric history',()=>{
  let state=customState();Object.assign(state.draft.blocks[0].sets[0],{weight:12,reps:10,done:true});state=C.archive(state,EX).state;
  const exercise=state.customExercises[0],before=JSON.stringify(state);
  assert.throws(()=>C.saveCustomExercise(state,{...exercise,mode:'time'},EX),/记录方式/);
  assert.throws(()=>C.saveCustomExercise(state,{...exercise,loadNote:'新的口径'},EX),/记录口径/);
  const edited=C.saveCustomExercise(state,{...exercise,name:'新名字',image:''},EX);
  assert.equal(C.sessionStats(edited.sessions[0],C.allExercises(edited,EX)).volume,120);
  assert.deepEqual(edited.sessions,state.sessions);assert.equal(JSON.stringify(state),before);
  const unused=C.emptyState();unused.customExercises=[exercise];
  assert.equal(C.saveCustomExercise(unused,{...exercise,mode:'time',loadNote:'秒数'},EX).customExercises[0].mode,'time');
});
test('deleting or editing a custom plan preserves active and archived target snapshots and referenced exercise protection',()=>{
  let state=customState();Object.assign(state.draft.blocks[0].sets[0],{weight:10,reps:10,done:true});state=C.archive(state,EX).state;
  state.draft=C.newPlanDraft(state.customPlans[0],'2026-09-16');
  const draft=JSON.stringify(state.draft),sessions=JSON.stringify(state.sessions),planId=state.customPlans[0].id;
  const edited=JSON.parse(JSON.stringify(state));edited.customPlans[0].blocks[0].target='100 次';
  assert.equal(JSON.stringify(C.validateState(edited,EX).draft),draft);
  const removed=C.removeCustomPlan(state,planId,EX);
  assert.equal(removed.customPlans.length,0);assert.equal(state.customPlans.length,1);
  assert.equal(JSON.stringify(removed.draft),draft);assert.equal(JSON.stringify(removed.sessions),sessions);
  assert.equal(C.sessionPlanId(removed.draft),planId);
  assert.throws(()=>C.removeCustomExercise(removed,removed.customExercises[0].id,EX),/引用/);
  assert.deepEqual(C.parseBackup(JSON.stringify(removed),EX),removed);
});
test('custom routine recommendation cycles by identity without resetting the built-in A/B/C sequence',()=>{
  const state=C.emptyState();state.customPlans=[customPlan('chest-press'),customPlan('chest-press'),customPlan('plank')];
  state.sessions=[completedPlan('gym-a','2026-09-14')];
  const own=C.newPlanDraft(state.customPlans[1],'2026-09-15');Object.assign(own.blocks[0].sets[0],{weight:10,reps:10,done:true});state.sessions.push(own);
  assert.equal(C.recommendPlan(state,PLANS,EX,'home','2026-09-16').id,'home-b');
  assert.equal(C.recommendPlan(state,PLANS,EX,'custom','2026-09-16').id,state.customPlans[2].id);
});

function largeLegacyState(count=2600) {
  const old=C.emptyState();old.schemaVersion=1;delete old.customExercises;delete old.customPlans;
  for(let i=0;i<count;i++){
    const session=C.newDraft('2026-09-16');session.note='a'.repeat(800);session.blocks=[C.newBlock('chest-press')];
    Object.assign(session.blocks[0].sets[0],{weight:10,reps:10,done:true});old.sessions.push(session);
  }
  return old;
}
test('a large valid v1 backup survives migration even when pretty JSON exceeds 4 MiB',()=>{
  const old=largeLegacyState();const raw=JSON.stringify(old),before=raw;
  assert.ok(Buffer.byteLength(raw)<C.MAX_BACKUP_BYTES);
  assert.ok(Buffer.byteLength(JSON.stringify(old,null,2))>C.MAX_BACKUP_BYTES);
  const migrated=C.parseBackup(raw,EX);
  assert.deepEqual(migrated,{...old,schemaVersion:2,customExercises:[],customPlans:[]});
  assert.deepEqual(C.validateState(migrated,EX),migrated);
  const exported=C.backupJSON(migrated);
  assert.equal(JSON.parse(exported).schemaVersion,2);assert.equal(exported,JSON.stringify(migrated));
  assert.ok(Buffer.byteLength(exported)<=C.MAX_BACKUP_BYTES);
  assert.deepEqual(C.parseBackup(exported,EX),migrated);assert.equal(JSON.stringify(old),before);
});
test('an exact-limit v1 backup stays readable and exportable while writes requiring v2 overhead remain protected',()=>{
  const old=largeLegacyState(3000);
  let remaining=C.MAX_BACKUP_BYTES-Buffer.byteLength(JSON.stringify(old));assert.ok(remaining>0);
  for(const session of old.sessions){const extra=Math.min(200,remaining);session.note+='a'.repeat(extra);remaining-=extra;}
  assert.equal(remaining,0);const raw=JSON.stringify(old);assert.equal(Buffer.byteLength(raw),C.MAX_BACKUP_BYTES);
  const migrated=C.parseBackup(raw,EX);
  assert.equal(migrated.schemaVersion,2);assert.ok(Buffer.byteLength(JSON.stringify(migrated))>C.MAX_BACKUP_BYTES);
  assert.deepEqual(migrated.sessions,old.sessions);
  assert.throws(()=>C.validateState(migrated,EX),/原数据未修改/);
  const exported=C.backupJSON(migrated);assert.equal(JSON.parse(exported).schemaVersion,1);
  assert.equal(Buffer.byteLength(exported),C.MAX_BACKUP_BYTES);
  assert.deepEqual(C.parseBackup(exported,EX),migrated);
  const freed=structuredClone(migrated);freed.sessions[0].note='';
  assert.deepEqual(C.validateState(freed,EX),freed);assert.equal(JSON.parse(C.backupJSON(freed)).schemaVersion,2);
  assert.equal(JSON.stringify(old),raw);
});
test('backupJSON keeps small backups readable and never discards custom collections to meet the size limit',()=>{
  const state=customState();assert.equal(C.backupJSON(state),JSON.stringify(state,null,2));
  assert.deepEqual(C.parseBackup(C.backupJSON(state),EX),state);
  const oversized=largeLegacyState(3000);oversized.schemaVersion=2;
  oversized.customExercises=[customExercise({image:PIXEL_PNG})];oversized.customPlans=[];
  for(const session of oversized.sessions)session.note+='a'.repeat(200);
  const before=JSON.stringify(oversized);assert.throws(()=>C.backupJSON(oversized),/4 MB/);assert.equal(JSON.stringify(oversized),before);
});
