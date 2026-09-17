/* Original compact exercise index. Illustrations are schematic identifiers, not coaching instructions. */
(function (root) {
  const exercises = [
    {id:'chest-press', name:'器械推胸', en:'Machine chest press', group:'胸部', equipment:'固定器械', mode:'weight', loadNote:'填写器械标示重量（kg）', hint:'座椅和把手位置按器械说明设置。'},
    {id:'lat-pulldown', name:'高位下拉', en:'Lat pulldown', group:'背部', equipment:'绳索器械', mode:'weight', loadNote:'填写器械标示重量（kg）', hint:'不同器械配重不能直接比较。器械和把手写入备注。'},
    {id:'seated-row', name:'坐姿划船', en:'Seated cable row', group:'背部', equipment:'绳索器械', mode:'weight', loadNote:'填写器械标示重量（kg）', hint:'更换握把或器械时写入备注。'},
    {id:'leg-press', name:'器械腿举', en:'Leg press', group:'腿部', equipment:'固定器械', mode:'weight', loadNote:'填写标示配重；是否含空车重量写入备注', hint:'按器械说明设置，不以图示判断活动范围。'},
    {id:'goblet-squat', name:'高脚杯深蹲', en:'Goblet squat', group:'腿部', equipment:'单只哑铃', mode:'weight', loadNote:'填写单只哑铃重量（kg）', hint:'每次按相同方式记录重量。'},
    {id:'leg-curl', name:'坐姿腿弯举', en:'Seated leg curl', group:'腿部', equipment:'固定器械', mode:'weight', loadNote:'填写器械标示重量（kg）', hint:'不同器械配重不能直接比较。器械名称写入备注。'},
    {id:'shoulder-press', name:'哑铃推举', en:'Dumbbell shoulder press', group:'肩部', equipment:'双哑铃', mode:'weight', loadNote:'填写两只哑铃总重量（kg）', hint:'左右各 5 kg，重量填 10 kg。'},
    {id:'lateral-raise', name:'哑铃侧平举', en:'Dumbbell lateral raise', group:'肩部', equipment:'双哑铃', mode:'weight', loadNote:'填写两只哑铃总重量（kg）', hint:'左右各 5 kg，重量填 10 kg。'},
    {id:'biceps-curl', name:'双臂哑铃弯举', en:'Bilateral dumbbell curl', group:'手臂', equipment:'双哑铃', mode:'weight', loadNote:'两臂同时完成算 1 次；重量填两只总和', hint:'交替弯举需备注计次方式。'},
    {id:'triceps-pushdown', name:'绳索下压', en:'Cable triceps pushdown', group:'手臂', equipment:'绳索器械', mode:'weight', loadNote:'填写器械标示重量（kg）', hint:'使用绳把或直杆写入备注。'},
    {id:'glute-bridge', name:'自重臀桥', en:'Bodyweight glute bridge', group:'臀部', equipment:'垫上自重', mode:'reps', loadNote:'填写次数，不计负重', hint:'按自重臀桥记录。'},
    {id:'calf-raise', name:'自重提踵', en:'Bodyweight calf raise', group:'腿部', equipment:'自重', mode:'reps', loadNote:'填写次数；单腿或双腿写入备注', hint:'单腿次数不会自动翻倍。'},
    {id:'push-up', name:'俯卧撑', en:'Push-up', group:'胸部', equipment:'自重', mode:'reps', loadNote:'填写次数，不计负重', hint:'跪姿、上斜等变式写入备注。'},
    {id:'plank', name:'平板支撑', en:'Plank', group:'核心', equipment:'垫上自重', mode:'time', loadNote:'每组填写秒数，单独统计', hint:'图示仅供识别动作。'},
    {id:'reverse-lunge', name:'自重后撤箭步蹲', en:'Bodyweight reverse lunge', group:'腿部', equipment:'自重', mode:'reps', loadNote:'次数填左右合计，不自动翻倍', hint:'左右各 10 次，合计填 20 次。'},
    {id:'dumbbell-row', name:'单臂哑铃划船', en:'Single-arm dumbbell row', group:'背部', equipment:'单只哑铃', mode:'weight', loadNote:'重量填单只哑铃，次数填左右合计', hint:'每侧 10 次填 20 次。支撑要稳，避免转体甩动哑铃。'},
    {id:'dead-bug', name:'死虫式', en:'Dead bug', group:'核心', equipment:'垫上自重', mode:'reps', loadNote:'次数填左右合计，不计负重', hint:'左右各 10 次，合计填 20 次。'}
  ].map((e, i) => ({...e, image:'assets/' + e.id + '.svg', number:String(i+1).padStart(2,'0')}));
  if (typeof module === 'object' && module.exports) module.exports = exercises;
  else root.LEAN_EXERCISES = exercises;
})(typeof globalThis !== 'undefined' ? globalThis : this);
