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
  const row = () => step('dumbbell-row', '16–24 次（两侧合计）', 90, '每侧 8–12 次；重量记单只哑铃，次数记左右合计。例如每侧 10 次，填 20 次。');
  const lunge = () => step('reverse-lunge', '16–24 次（两侧合计）', 90, '每侧 8–12 次；次数记左右合计。');
  const deadBug = () => step('dead-bug', '16–24 次（两侧合计）', 60, '每侧 8–12 次；次数记左右合计，按能稳定控制的幅度练习。');
  const pushUp = () => step('push-up', '8–12 次', 90, '可选择上斜或跪姿版本，以动作稳定为先；把变式写入备注。');
  const plans = [
    {
      id: 'gym-a', location: 'gym', letter: 'A', name: '全身 A · 建立基础', focus: '蹲 · 推 · 拉 · 核心', durationMinutes: 40,
      description: '用固定器械熟悉全身力量训练。每个动作先从 2 组开始，使用能稳定完成的重量；新手可减少为 1 组。',
      blocks: [step('leg-press', '8–12 次', 120), step('chest-press'), step('lat-pulldown'), step('leg-curl'), step('lateral-raise', '10–15 次', 60), step('plank', '20–30 秒', 60)]
    },
    {
      id: 'gym-b', location: 'gym', letter: 'B', name: '全身 B · 稳定发力', focus: '腿臀 · 划船 · 肩胸', durationMinutes: 40,
      description: '交替练习下肢、背部和推举。与上次力量训练至少间隔一天；组间尚未恢复时，可以延长休息。',
      blocks: [step('goblet-squat', '8–12 次', 120), step('seated-row'), step('shoulder-press'), step('glute-bridge', '10–15 次', 60), pushUp(), deadBug()]
    },
      {
      id: 'gym-c', location: 'gym', letter: 'C', name: '全身 C · 巩固节奏', focus: '腿臀 · 胸背 · 手臂', durationMinutes: 40,
      description: '继续覆盖主要肌群，留意同一动作的稳定性。目标范围是起点，无需每组力竭；熟练后再逐步调整次数或重量。',
      blocks: [lunge(), step('chest-press'), step('lat-pulldown'), step('glute-bridge', '10–15 次', 60), step('biceps-curl', '8–12 次', 60), step('plank', '20–30 秒', 60)]
    },
    {
      id: 'home-a', location: 'home', letter: 'A', name: '全身 A · 居家基础', focus: '哑铃 · 自重 · 核心', durationMinutes: 35,
      description: '需要哑铃和垫子，以深蹲、俯卧撑和划船建立基础。每项先练 2 组，新手可减少为 1 组；实际完成后再记录。',
      blocks: [step('goblet-squat', '8–12 次', 120), pushUp(), row(), step('glute-bridge', '10–15 次', 60), step('lateral-raise', '10–15 次', 60), step('plank', '20–30 秒', 60)]
    },
    {
      id: 'home-b', location: 'home', letter: 'B', name: '全身 B · 居家稳定', focus: '单腿 · 胸背 · 肩部', durationMinutes: 35,
      description: '需要哑铃和垫子，练习单腿控制与上肢推拉。与上次力量训练至少间隔一天；保持可控动作，按恢复情况休息。',
      blocks: [lunge(), row(), step('shoulder-press'), pushUp(), step('glute-bridge', '10–15 次', 60), deadBug()]
    },
    {
      id: 'home-c', location: 'home', letter: 'C', name: '全身 C · 居家巩固', focus: '腿臀 · 胸背 · 手臂', durationMinutes: 35,
      description: '需要哑铃和垫子，继续 A／B／C 轮换。先把动作做稳定，无需每组力竭；能稳定完成后，再小幅增加次数或重量。',
      blocks: [step('goblet-squat', '8–12 次', 120), pushUp(), row(), step('glute-bridge', '10–15 次', 60), step('biceps-curl', '8–12 次', 60), deadBug()]
    }
  ];
  if (typeof module === 'object' && module.exports) module.exports = plans;
  else root.LEAN_PLANS = plans;
})(typeof globalThis !== 'undefined' ? globalThis : this);
