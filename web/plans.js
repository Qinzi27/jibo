/* 肌薄 — editable starting templates, not a promise of a particular body shape.
 * General frequency / effort checked against ACSM (17 March 2026):
 * https://acsm.org/resistance-training-guidelines-update-2026/
 * General repetition / set guidance checked against CDC:
 * https://www.cdc.gov/physical-activity-basics/adding-adults/what-counts.html
 * Exercise selection, target ranges and rests below are adjustable app defaults,
 * not individualized prescriptions from either source. No runtime network use.
 */
(function (root) {
  'use strict';
  const step = (exerciseId, target = '8–12 次', restSeconds = 90, note = '') => ({ exerciseId, sets: 2, target, restSeconds, note });
  const row = () => step('dumbbell-row', '16–24 次（两侧合计）', 90, '每侧 8–12 次。重量填单只哑铃，次数填左右合计；每侧 10 次填 20 次。');
  const lunge = () => step('reverse-lunge', '16–24 次（两侧合计）', 90, '每侧 8–12 次，次数填左右合计。');
  const deadBug = () => step('dead-bug', '16–24 次（两侧合计）', 60, '每侧 8–12 次，次数填左右合计。动作幅度以能稳定控制为准。');
  const pushUp = () => step('push-up', '8–12 次', 90, '可做上斜或跪姿俯卧撑，变式写入备注。');
  const plans = [
    {
      id: 'gym-a', location: 'gym', letter: 'A', name: '健身房 A', focus: '蹲 · 推 · 拉 · 核心', durationMinutes: 40,
      description: '每项 2 组，新手可从 1 组开始。重量以能稳定完成为准。',
      blocks: [step('leg-press', '8–12 次', 120), step('chest-press'), step('lat-pulldown'), step('leg-curl'), step('lateral-raise', '10–15 次', 60), step('plank', '20–30 秒', 60)]
    },
    {
      id: 'gym-b', location: 'gym', letter: 'B', name: '健身房 B', focus: '腿臀 · 划船 · 肩胸', durationMinutes: 40,
      description: '与上次力量训练至少间隔一天。组间未恢复可延长休息。',
      blocks: [step('goblet-squat', '8–12 次', 120), step('seated-row'), step('shoulder-press'), step('glute-bridge', '10–15 次', 60), pushUp(), deadBug()]
    },
      {
      id: 'gym-c', location: 'gym', letter: 'C', name: '健身房 C', focus: '腿臀 · 胸背 · 手臂', durationMinutes: 40,
      description: '无需每组力竭。能稳定完成后，再增加次数或重量。',
      blocks: [lunge(), step('chest-press'), step('lat-pulldown'), step('glute-bridge', '10–15 次', 60), step('biceps-curl', '8–12 次', 60), step('plank', '20–30 秒', 60)]
    },
    {
      id: 'home-a', location: 'home', letter: 'A', name: '居家 A', focus: '哑铃 · 自重 · 核心', durationMinutes: 35,
      description: '需要哑铃和垫子。每项 2 组，新手可从 1 组开始。',
      blocks: [step('goblet-squat', '8–12 次', 120), pushUp(), row(), step('glute-bridge', '10–15 次', 60), step('lateral-raise', '10–15 次', 60), step('plank', '20–30 秒', 60)]
    },
    {
      id: 'home-b', location: 'home', letter: 'B', name: '居家 B', focus: '单腿 · 胸背 · 肩部', durationMinutes: 35,
      description: '需要哑铃和垫子。与上次力量训练至少间隔一天。',
      blocks: [lunge(), row(), step('shoulder-press'), pushUp(), step('glute-bridge', '10–15 次', 60), deadBug()]
    },
    {
      id: 'home-c', location: 'home', letter: 'C', name: '居家 C', focus: '腿臀 · 胸背 · 手臂', durationMinutes: 35,
      description: '需要哑铃和垫子。无需每组力竭，能稳定完成后再增加次数或重量。',
      blocks: [step('goblet-squat', '8–12 次', 120), pushUp(), row(), step('glute-bridge', '10–15 次', 60), step('biceps-curl', '8–12 次', 60), deadBug()]
    }
  ];
  if (typeof module === 'object' && module.exports) module.exports = plans;
  else root.LEAN_PLANS = plans;
})(typeof globalThis !== 'undefined' ? globalThis : this);
