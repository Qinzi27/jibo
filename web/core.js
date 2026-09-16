/* Lean Crew Local — deterministic model and calculations. No network or packages. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LeanCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 2;
  const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
  const MAX_CUSTOM_IMAGE_BYTES = 200 * 1024;
  const MAX_CUSTOM_EXERCISES = 40;
  const MAX_CUSTOM_PLANS = 40;
  const EXERCISE_GROUPS = Object.freeze(['胸部', '背部', '腿部', '肩部', '手臂', '臀部', '核心']);
  const fail = message => { throw new Error(message); };
  function id() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  function localDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function dateValue(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('日期格式应为 YYYY-MM-DD。');
    const [y, m, d] = value.split('-').map(Number);
    if (y < 2000 || y > 2100) fail('日期需要在 2000—2100 年之间。');
    const date = new Date(y, m - 1, d, 12);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) fail('日期不存在。');
    return value;
  }
  function number(value, min, max, label, nullable = false, integer = false) {
    if (value === null || value === '' || value === undefined) {
      if (nullable) return null;
      fail('请填写' + label + '。');
    }
    if (typeof value !== 'number' && typeof value !== 'string') fail(label + '必须是数字。');
    if (typeof value === 'string' && value.trim() === '') {
      if (nullable) return null;
      fail('请填写' + label + '。');
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
      fail(label + '应为 ' + min + '—' + max + (integer ? ' 之间的整数。' : ' 之间的数字。'));
    }
    return n;
  }
  function text(value, max, label) {
    if (typeof value !== 'string') fail(label + '必须是文本。');
    if (value.length > max) fail(label + '过长。');
    return value;
  }
  function list(value, max, label) {
    if (!Array.isArray(value) || value.length > max) fail(label + '格式或数量不正确。');
    return value;
  }
  function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + '格式不正确。');
    return value;
  }
  function boolean(value, label) {
    if (typeof value !== 'boolean') fail(label + '应为开关值。');
    return value;
  }
  function unique(items, label) {
    const ids = new Set();
    items.forEach(item => {
      if (!item.id || ids.has(item.id)) fail(label + '存在重复或空编号。');
      ids.add(item.id);
    });
    return items;
  }
  function emptyState() {
    return {
      schemaVersion: VERSION,
      profile: { nickname: '训练者', theme: 'lean', fun: true },
      draft: null, sessions: [], foodLabels: [], foodEntries: [], weights: [],
      customExercises: [], customPlans: []
    };
  }
  function requiredText(value, max, label) {
    const result = text(value, max, label);
    if (!result.trim()) fail('请填写' + label + '。');
    return result;
  }
  function customId(value, prefix, label) {
    const result = text(value, 80, label);
    if (!result.startsWith(prefix) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result.length === prefix.length) fail(label + '格式不正确。');
    return result;
  }
  function customImage(value) {
    if (value === '') return '';
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_CUSTOM_IMAGE_BYTES / 3) * 4 + 32) fail('动作图片不能超过 200 KB，请先压缩。');
    const match = value.match(/^data:image\/(jpeg|png|webp);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/);
    if (!match || !match[2]) fail('动作图片只支持本地 JPEG、PNG 或 WebP 图片。');
    const encoded = match[2];
    const bytes = encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
    if (bytes > MAX_CUSTOM_IMAGE_BYTES) fail('动作图片不能超过 200 KB，请先压缩。');
    // Check the container signature too: changing an SVG's MIME label does not
    // turn it into a permitted raster image. Actual decoding/resizing is in UI.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const header = [];
    for (let offset = 0; offset < Math.min(encoded.length, 16); offset += 4) {
      const n = (alphabet.indexOf(encoded[offset]) << 18) | (alphabet.indexOf(encoded[offset + 1]) << 12)
        | ((alphabet.indexOf(encoded[offset + 2]) & 63) << 6) | (alphabet.indexOf(encoded[offset + 3]) & 63);
      header.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
    }
    const starts = signature => signature.every((byte, i) => header[i] === byte);
    const valid = match[1] === 'jpeg' ? bytes >= 4 && starts([255, 216, 255])
      : match[1] === 'png' ? bytes >= 24 && starts([137, 80, 78, 71, 13, 10, 26, 10])
      : bytes >= 16 && starts([82, 73, 70, 70]) && header.slice(8, 12).every((byte, i) => byte === [87, 69, 66, 80][i]);
    if (!valid) fail('动作图片内容与文件格式不匹配。');
    return value;
  }
  function validateCustomExercise(raw) {
    const v = record(raw, '自建动作');
    if (!EXERCISE_GROUPS.includes(v.group)) fail('动作部位不受支持。');
    if (!['weight', 'reps', 'time'].includes(v.mode)) fail('动作记录方式不受支持。');
    return {
      id: customId(v.id, 'custom-', '自建动作编号'), name: requiredText(v.name, 80, '动作名称'),
      en: text(v.en, 80, '动作英文名称'), group: v.group, equipment: requiredText(v.equipment, 80, '器材'),
      mode: v.mode, loadNote: requiredText(v.loadNote, 300, '记录口径'),
      hint: text(v.hint, 500, '动作说明'), image: customImage(v.image)
    };
  }
  function newCustomExercise(fields) {
    const v = record(fields, '自建动作');
    const defaults = {
      weight: '记录本次外部负重（kg）与实际次数；请始终使用相同的单双侧口径。',
      reps: '仅记录实际次数，不估算自重负荷；请始终使用相同的单双侧口径。',
      time: '每组记录实际秒数，与负重次数分开统计。'
    };
    return validateCustomExercise({
      id: 'custom-' + id(), name: v.name, en: 'Custom exercise', group: v.group, mode: v.mode,
      equipment: v.equipment ?? '自定义', loadNote: v.loadNote ?? defaults[v.mode],
      hint: v.hint ?? '', image: v.image ?? ''
    });
  }
  function validateCustomPlan(raw, exMap = null) {
    const v = record(raw, '自建计划');
    if (v.location !== 'custom') fail('自建计划的场景不正确。');
    const blocks = list(v.blocks, 60, '计划动作').map(rawStep => {
      const step = record(rawStep, '计划动作');
      const exerciseId = requiredText(step.exerciseId, 80, '计划动作编号');
      if (exMap && !exMap.has(exerciseId)) fail('计划引用了不存在的动作：' + exerciseId);
      return { exerciseId, sets: number(step.sets, 1, 10, '建议组数', false, true),
        target: requiredText(step.target, 100, '建议目标'),
        restSeconds: number(step.restSeconds, 15, 600, '组间休息秒数', false, true),
        note: text(step.note, 300, '计划动作说明') };
    });
    if (!blocks.length) fail('训练计划至少需要一个动作。');
    return { id: customId(v.id, 'custom-plan-', '自建计划编号'), location: 'custom',
      letter: requiredText(v.letter, 8, '计划简称'), name: requiredText(v.name, 80, '计划名称'),
      focus: text(v.focus, 120, '计划重点'), description: text(v.description, 700, '计划说明'),
      durationMinutes: number(v.durationMinutes, 1, 600, '预计分钟数', false, true), blocks };
  }
  function newCustomPlan(fields) {
    const v = record(fields, '自建计划');
    return validateCustomPlan({ id: 'custom-plan-' + id(), location: 'custom', letter: v.letter ?? '自',
      name: v.name, focus: v.focus ?? '按自己的节奏练习', description: v.description ?? '',
      durationMinutes: v.durationMinutes ?? 30,
      blocks: list(v.blocks, 60, '计划动作').map(step => ({ ...record(step, '计划动作'), note: step.note ?? '' })) });
  }
  function allExercises(state, builtins = []) {
    // Callers may already hold a merged catalogue from an older UI render.
    // Only definitions in this state own the reserved custom-* namespace.
    return [...builtins.filter(ex => !ex.id.startsWith('custom-')), ...(state.customExercises || [])];
  }
  function allPlans(state, builtins = []) {
    return [...builtins.filter(plan => !plan.id.startsWith('custom-plan-')), ...(state.customPlans || [])];
  }
  function exerciseReferences(state, exerciseId, includePlans = true) {
    const refs = [];
    if (state.draft?.blocks.some(block => block.exerciseId === exerciseId)) refs.push('当前训练草稿');
    if (state.sessions.some(session => session.blocks.some(block => block.exerciseId === exerciseId))) refs.push('已归档训练');
    if (includePlans && (state.customPlans || []).some(plan => plan.blocks.some(block => block.exerciseId === exerciseId))) refs.push('自建计划');
    return refs;
  }
  function saveCustomExercise(state, exercise, builtins) {
    const updated = validateCustomExercise(exercise);
    const next = validateState(state, builtins);
    const index = next.customExercises.findIndex(ex => ex.id === updated.id);
    const previous = next.customExercises[index];
    if (previous && exerciseReferences(next, previous.id, false).length
      && (previous.mode !== updated.mode || previous.loadNote !== updated.loadNote)) {
      fail('已有训练引用这个动作，不能更改记录方式或记录口径；请另建动作。');
    }
    if (index < 0) next.customExercises.push(updated); else next.customExercises[index] = updated;
    return validateState(next, builtins);
  }
  function removeCustomExercise(state, exerciseId, builtins) {
    const next = validateState(state, builtins);
    const refs = exerciseReferences(next, exerciseId);
    if (refs.length) fail('此动作仍被' + refs.join('、') + '引用，不能删除。');
    const index = next.customExercises.findIndex(ex => ex.id === exerciseId);
    if (index < 0) fail('找不到自建动作。');
    next.customExercises.splice(index, 1);
    return validateState(next, builtins);
  }
  function removeCustomPlan(state, planId, builtins) {
    const next = validateState(state, builtins);
    const index = next.customPlans.findIndex(plan => plan.id === planId);
    if (index < 0) fail('找不到自建计划。');
    // Session plan tags and copied target notes are historical snapshots.
    // Deleting a reusable template must not delete or rewrite those snapshots.
    next.customPlans.splice(index, 1);
    return validateState(next, builtins);
  }
  function newSet() { return { id: id(), weight: null, reps: null, seconds: null, done: false }; }
  function newBlock(exerciseId) { return { id: id(), exerciseId, note: '', sets: [newSet(), newSet(), newSet()] }; }
  function newDraft(date = localDate()) { return { id: id(), date: dateValue(date), note: '', blocks: [] }; }
  function newPlanDraft(plan, date = localDate()) {
    record(plan, '训练计划');
    const planId = text(plan.id, 80, '计划编号');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(planId)) fail('计划编号格式不正确。');
    const draft = newDraft(date);
    draft.note = text('[肌薄计划:' + planId + ']\n' + text(plan.name, 80, '计划名称') + '\n' + text(plan.description, 700, '计划说明'), 1000, '训练备注');
    draft.blocks = list(plan.blocks, 60, '计划动作').map(step => {
      record(step, '计划动作');
      const sets = number(step.sets, 1, 10, '建议组数', false, true);
      const rest = number(step.restSeconds, 15, 600, '组间休息秒数', false, true);
      const target = text(step.target, 100, '建议目标');
      const note = text(step.note || '', 300, '计划动作说明');
      return {
        id: id(), exerciseId: text(step.exerciseId, 80, '动作编号'),
        note: text('建议 ' + sets + ' 组 × ' + target + '；组间休息 ' + rest + ' 秒。' + (note ? '\n' + note : ''), 500, '动作备注'),
        // Targets are guidance, never measured values or completed work.
        sets: Array.from({ length: sets }, () => newSet())
      };
    });
    if (!draft.blocks.length) fail('训练计划至少需要一个动作。');
    return draft;
  }
  function sessionPlanId(session) {
    if (!session || typeof session.note !== 'string') return null;
    const match = session.note.match(/^\[肌薄计划:([a-z0-9]+(?:-[a-z0-9]+)*)\](?:\r?\n|$)/);
    return match ? match[1] : null;
  }
  function setReady(set, mode) {
    if (mode === 'time') return Number.isFinite(set.seconds) && set.seconds > 0;
    return Number.isInteger(set.reps) && set.reps > 0 && (mode !== 'weight' || (Number.isFinite(set.weight) && set.weight >= 0));
  }
  function blockStats(block, exercise) {
    const done = block.sets.filter(s => s.done && setReady(s, exercise.mode));
    return {
      sets: done.length,
      reps: exercise.mode === 'time' ? 0 : done.reduce((sum, s) => sum + s.reps, 0),
      seconds: exercise.mode === 'time' ? done.reduce((sum, s) => sum + s.seconds, 0) : 0,
      volume: exercise.mode === 'weight' ? done.reduce((sum, s) => sum + s.weight * s.reps, 0) : 0
    };
  }
  function sessionStats(session, exercises) {
    const map = new Map(exercises.map(e => [e.id, e]));
    return session.blocks.reduce((sum, block) => {
      const ex = map.get(block.exerciseId);
      if (!ex) return sum;
      const s = blockStats(block, ex);
      for (const key of ['sets', 'reps', 'seconds', 'volume']) sum[key] += s[key];
      if (s.sets) sum.exercises += 1;
      return sum;
    }, { sets: 0, reps: 0, seconds: 0, volume: 0, exercises: 0 });
  }
  function weeklyTrainingSummary(state, exercises, date = localDate()) {
    dateValue(date);
    exercises = allExercises(state, exercises);
    const [year, month, day] = date.split('-').map(Number);
    // Construct local noon and use calendar arithmetic: UTC parsing and fixed
    // millisecond offsets both give incorrect boundaries in some time zones.
    const monday = new Date(year, month - 1, day, 12);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const weekStart = localDate(monday);
    const weekEnd = localDate(sunday);
    const dates = new Set();
    let sessions = 0, sets = 0;
    for (const session of state.sessions) {
      if (session.date < weekStart || session.date > date || session.date > weekEnd) continue;
      const completed = sessionStats(session, exercises).sets;
      if (!completed) continue;
      dates.add(session.date);
      sessions += 1;
      sets += completed;
    }
    return { weekStart, weekEnd, dates: [...dates].sort(), days: dates.size, sessions, sets };
  }
  function recommendPlan(state, plans, exercises, location = 'gym', date = localDate()) {
    dateValue(date);
    plans = allPlans(state, plans);
    exercises = allExercises(state, exercises);
    const available = plans.filter(plan => plan.location === location).sort((a, b) => a.letter.localeCompare(b.letter));
    if (!available.length) return null;
    const byId = new Map(plans.map(plan => [plan.id, plan]));
    // Switching equipment keeps the A/B/C rotation. Date decides recency;
    // for multiple sessions on one date, the latest stored session wins.
    let latest = null;
    for (const session of state.sessions) {
      const plan = byId.get(sessionPlanId(session));
      if (!plan || session.date > date || (latest && session.date < latest.date)) continue;
      // A custom routine does not restart the built-in A/B/C rotation.
      if (location === 'custom' ? plan.location !== 'custom' : plan.location === 'custom') continue;
      if (!sessionStats(session, exercises).sets) continue;
      latest = { date: session.date, letter: plan.letter, planId: plan.id };
    }
    if (!latest) return available[0];
    const index = available.findIndex(plan => location === 'custom' ? plan.id === latest.planId : plan.letter === latest.letter);
    return available[(index + 1) % available.length];
  }
  function nutrition(quantity, kcal100, protein100) {
    const q = number(quantity, 0, 10000, '份量');
    const k = number(kcal100, 0, 2000, '每 100 单位能量');
    const p = number(protein100, 0, 100, '每 100 单位蛋白质');
    return { factor: q / 100, kcal: q / 100 * k, protein: q / 100 * p };
  }
  function round(value, places = 1) {
    const p = 10 ** places;
    return Math.round((value + Number.EPSILON) * p) / p;
  }
  function validateSession(raw, exMap, isDraft) {
    const v = record(raw, '训练记录');
    const result = {
      id: text(v.id, 80, '训练编号'), date: dateValue(v.date), note: text(v.note, 1000, '训练备注'),
      blocks: unique(list(v.blocks, 60, '动作列表').map(b => {
        record(b, '动作');
        const exerciseId = text(b.exerciseId, 80, '动作编号');
        const ex = exMap.get(exerciseId);
        if (!ex) fail('备份中含有当前版本不支持的动作：' + exerciseId);
        return {
          id: text(b.id, 80, '动作记录编号'), exerciseId, note: text(b.note, 500, '动作备注'),
          sets: unique(list(b.sets, 80, '组列表').map(s => {
            record(s, '训练组');
            const set = {
              id: text(s.id, 80, '组编号'), weight: number(s.weight, 0, 1000, '重量', true),
              reps: number(s.reps, 1, 1000, '次数', true, true), seconds: number(s.seconds, 1, 36000, '秒数', true, true),
              done: boolean(s.done, '完成状态')
            };
            if (set.done && !setReady(set, ex.mode)) fail('完成的训练组缺少有效的重量、次数或秒数。');
            return set;
          }), '训练组')
        };
      }), '动作记录')
    };
    if (!isDraft && !sessionStats(result, [...exMap.values()]).sets) fail('已归档训练至少需要一组完成记录。');
    return result;
  }
  function validateState(raw, exercises) {
    const v = record(raw, '备份');
    if (![1, VERSION].includes(v.schemaVersion)) fail('不支持的备份版本，原数据未修改。');
    if (v.schemaVersion === 1 && ((v.customExercises?.length || 0) || (v.customPlans?.length || 0))) fail('旧版备份不能包含自建动作或计划。');
    const p = record(v.profile, '个人设置');
    if (!['lean', 'blond'].includes(p.theme)) fail('主题不受支持。');
    const customExercises = v.schemaVersion === 1 ? [] : unique(list(v.customExercises, MAX_CUSTOM_EXERCISES, '自建动作').map(validateCustomExercise), '自建动作');
    const map = new Map(allExercises({ customExercises }, exercises).map(e => [e.id, e]));
    const customPlans = v.schemaVersion === 1 ? [] : unique(list(v.customPlans, MAX_CUSTOM_PLANS, '自建计划').map(plan => validateCustomPlan(plan, map)), '自建计划');
    const labels = unique(list(v.foodLabels, 500, '食品标签').map(f => {
      record(f, '食品标签');
      if (!['g', 'mL'].includes(f.unit)) fail('食品单位不受支持。');
      return { id: text(f.id, 80, '标签编号'), name: text(f.name, 100, '食品名称'), unit: f.unit,
        kcal100: number(f.kcal100, 0, 2000, '标签能量'), protein100: number(f.protein100, 0, 100, '标签蛋白质') };
    }), '食品标签');
    const foods = unique(list(v.foodEntries, 15000, '饮食记录').map(f => {
      record(f, '饮食记录');
      if (!['g', 'mL'].includes(f.unit)) fail('食品单位不受支持。');
      return { id: text(f.id, 80, '饮食编号'), date: dateValue(f.date), name: text(f.name, 100, '食品名称'), unit: f.unit,
        quantity: number(f.quantity, 0.01, 10000, '份量'), kcal100: number(f.kcal100, 0, 2000, '标签能量'),
        protein100: number(f.protein100, 0, 100, '标签蛋白质') };
    }), '饮食记录');
    const weights = list(v.weights, 15000, '体重记录').map(w => {
      record(w, '体重记录');
      return { date: dateValue(w.date), kg: number(w.kg, 1, 500, '体重') };
    });
    if (new Set(weights.map(w => w.date)).size !== weights.length) fail('同一天存在重复体重记录。');
    const result = {
      schemaVersion: VERSION,
      profile: { nickname: text(p.nickname, 30, '昵称'), theme: p.theme, fun: boolean(p.fun, '整蛊模式') },
      draft: v.draft === null ? null : validateSession(v.draft, map, true),
      sessions: unique(list(v.sessions, 5000, '训练记录').map(s => validateSession(s, map, false)), '训练记录'),
      foodLabels: labels, foodEntries: foods, weights, customExercises, customPlans
    };
    // The persisted representation is compact JSON. Pretty-printing must not
    // make a formerly valid v1 collection unreadable during migration.
    if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_BACKUP_BYTES) {
      // At the exact v1 limit, adding two empty arrays can cross the boundary
      // by a few bytes. Reading is safe; a subsequent v2 write still fails
      // until space is freed. backupJSON can preserve that state as v1.
      const readableLegacy = v.schemaVersion === 1 && new TextEncoder().encode(JSON.stringify(v)).length <= MAX_BACKUP_BYTES;
      if (!readableLegacy) fail('完整备份超过 4 MB，请先导出备份并减少图片或历史数据；原数据未修改。');
    }
    return result;
  }
  function backupJSON(state) {
    const pretty = JSON.stringify(state, null, 2);
    if (new TextEncoder().encode(pretty).length <= MAX_BACKUP_BYTES) return pretty;
    const compact = JSON.stringify(state);
    if (new TextEncoder().encode(compact).length <= MAX_BACKUP_BYTES) return compact;
    // Lossless escape hatch for a just-migrated, limit-sized v1 state. With no
    // v2 content, removing only the new empty collections restores its original
    // schema representation and preserves every training/nutrition field.
    if (state.schemaVersion === VERSION && state.customExercises?.length === 0 && state.customPlans?.length === 0) {
      const legacy = { ...state, schemaVersion: 1 };
      delete legacy.customExercises; delete legacy.customPlans;
      const compatible = JSON.stringify(legacy);
      if (new TextEncoder().encode(compatible).length <= MAX_BACKUP_BYTES) return compatible;
    }
    fail('完整备份超过 4 MB，请减少图片或历史数据；原数据未修改。');
  }
  function parseBackup(json, exercises) {
    if (typeof json !== 'string' || new TextEncoder().encode(json).length > MAX_BACKUP_BYTES) fail('备份超过 4 MB 或格式无效。');
    let obj;
    try { obj = JSON.parse(json); } catch (_) { fail('不是有效的 JSON 文件。原数据未修改。'); }
    return validateState(obj, exercises);
  }
  function archive(state, exercises) {
    if (!state.draft) fail('还没有正在进行的训练。');
    const next = validateState(state, exercises);
    const session = validateSession(next.draft, new Map(allExercises(next, exercises).map(e => [e.id, e])), false);
    const old = next.sessions.findIndex(s => s.id === session.id);
    if (old >= 0) next.sessions[old] = session; else next.sessions.push(session);
    next.draft = null;
    return { state: validateState(next, exercises), session };
  }
  function csvCell(value) {
    let s = String(value === null || value === undefined ? '' : value);
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function workoutCSV(state, exercises) {
    const map = new Map(allExercises(state, exercises).map(e => [e.id, e]));
    const rows = [['date','session_id','exercise','load_convention','set','weight_kg','reps','seconds','done','note']];
    for (const session of state.sessions) for (const block of session.blocks) {
      const ex = map.get(block.exerciseId);
      block.sets.forEach((set, index) => rows.push([session.date, session.id, ex.name, ex.loadNote,
        index + 1, ex.mode === 'weight' ? set.weight : '', ex.mode !== 'time' ? set.reps : '',
        ex.mode === 'time' ? set.seconds : '', set.done ? 1 : 0, block.note]));
    }
    return '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  }
  function lastSessionBlock(state, exerciseId) {
    const sessions = [...state.sessions].reverse().sort((a,b) => b.date.localeCompare(a.date));
    for (const session of sessions) {
      const block = session.blocks.find(b => b.exerciseId === exerciseId);
      if (block) return { date: session.date, block };
    }
    return null;
  }
  return { VERSION, MAX_BACKUP_BYTES, MAX_CUSTOM_IMAGE_BYTES, MAX_CUSTOM_EXERCISES, MAX_CUSTOM_PLANS, EXERCISE_GROUPS,
    id, localDate, dateValue, number, emptyState, newSet, newBlock, newDraft,
    allExercises, allPlans, newCustomExercise, newCustomPlan, saveCustomExercise, removeCustomExercise, removeCustomPlan,
    newPlanDraft, sessionPlanId, weeklyTrainingSummary, recommendPlan,
    setReady, blockStats, sessionStats, nutrition, round, validateState, parseBackup, backupJSON, archive, csvCell, workoutCSV, lastSessionBlock };
});
