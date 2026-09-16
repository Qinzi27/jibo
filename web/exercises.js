/* Original compact exercise index. Illustrations are schematic identifiers, not coaching instructions. */
(function (root) {
  const exercises = [
    {id:'chest-press', name:'器械推胸', en:'Machine chest press', group:'胸部', equipment:'固定器械', mode:'weight', loadNote:'记录这台器械的标示重量（kg）', hint:'用图片识别动作类别；座椅、把手位置请按器械说明或教练指导设置。'},
    {id:'lat-pulldown', name:'高位下拉', en:'Lat pulldown', group:'背部', equipment:'绳索器械', mode:'weight', loadNote:'记录这台器械的标示重量（kg）', hint:'不同器械的配重不可直接比较。请在备注中写下器械编号或把手类型。'},
    {id:'seated-row', name:'坐姿划船', en:'Seated cable row', group:'背部', equipment:'绳索器械', mode:'weight', loadNote:'记录这台器械的标示重量（kg）', hint:'每次使用相同记录口径。握把与器械变化时，可在备注里注明。'},
    {id:'leg-press', name:'器械腿举', en:'Leg press', group:'腿部', equipment:'固定器械', mode:'weight', loadNote:'记录标示配重；是否包含空车重量请在备注写明', hint:'示意图不代表安全活动范围；具体设置请遵循器械说明。'},
    {id:'goblet-squat', name:'高脚杯深蹲', en:'Goblet squat', group:'腿部', equipment:'单只哑铃', mode:'weight', loadNote:'记录手持这一只哑铃的重量（kg）', hint:'同一动作的历史比较需要相同负重记录方式。图示只用于辨认。'},
    {id:'leg-curl', name:'坐姿腿弯举', en:'Seated leg curl', group:'腿部', equipment:'固定器械', mode:'weight', loadNote:'记录这台器械的标示重量（kg）', hint:'不同型号的器械阻力并不等同；建议在备注里记录器械名称。'},
    {id:'shoulder-press', name:'哑铃推举', en:'Dumbbell shoulder press', group:'肩部', equipment:'双哑铃', mode:'weight', loadNote:'记录两只哑铃的总重量（kg），程序不再乘 2', hint:'例如左右各 5 kg，这里的重量填 10 kg。保持这个口径即可。'},
    {id:'lateral-raise', name:'哑铃侧平举', en:'Dumbbell lateral raise', group:'肩部', equipment:'双哑铃', mode:'weight', loadNote:'记录两只哑铃的总重量（kg），程序不再乘 2', hint:'这是图鉴条目，不会自动给你开重量或组数处方。'},
    {id:'biceps-curl', name:'双臂哑铃弯举', en:'Bilateral dumbbell curl', group:'手臂', equipment:'双哑铃', mode:'weight', loadNote:'两臂同时完成算 1 次；重量填两只总和', hint:'本条目按双臂同时完成记录。交替弯举请保持自己的次数口径并备注。'},
    {id:'triceps-pushdown', name:'绳索下压', en:'Cable triceps pushdown', group:'手臂', equipment:'绳索器械', mode:'weight', loadNote:'记录这台器械的标示重量（kg）', hint:'换用绳把或直杆时，在备注注明，方便回看。'},
    {id:'glute-bridge', name:'自重臀桥', en:'Bodyweight glute bridge', group:'臀部', equipment:'垫上自重', mode:'reps', loadNote:'仅记录次数，不估算自重训练吨位', hint:'本条目按自重动作处理，不把体重自动换算成负重。'},
    {id:'calf-raise', name:'自重提踵', en:'Bodyweight calf raise', group:'腿部', equipment:'自重', mode:'reps', loadNote:'仅记录次数；单双腿口径写入备注', hint:'不自动把单腿次数乘 2；采用固定口径更容易比较。'},
    {id:'push-up', name:'俯卧撑', en:'Push-up', group:'胸部', equipment:'自重', mode:'reps', loadNote:'仅记录次数，不估算有效负重', hint:'跪姿、上斜等变式请写在备注中，不把不同变式当成同一负荷。'},
    {id:'plank', name:'平板支撑', en:'Plank', group:'核心', equipment:'垫上自重', mode:'time', loadNote:'每组记录秒数；不计入负重次数', hint:'计时数据与负重数据分开统计。图示不是姿势合格判定。'},
    {id:'reverse-lunge', name:'自重后撤箭步蹲', en:'Bodyweight reverse lunge', group:'腿部', equipment:'自重', mode:'reps', loadNote:'左右各完成一次共记 2 次；不自动翻倍', hint:'左右次数合计填入；若习惯按每侧记录，请在备注里清楚标明。'},
    {id:'dumbbell-row', name:'单臂哑铃划船', en:'Single-arm dumbbell row', group:'背部', equipment:'单只哑铃', mode:'weight', loadNote:'重量填单只哑铃；次数填左右合计，程序不再乘 2', hint:'例如每侧做 10 次，次数填 20。用稳固支撑并保持躯干稳定，不靠转体甩起哑铃。'},
    {id:'dead-bug', name:'死虫式', en:'Dead bug', group:'核心', equipment:'垫上自重', mode:'reps', loadNote:'左右各完成一次共记 2 次；不计负重', hint:'本工具只记录次数，不判断活动范围、呼吸或动作质量。'}
  ].map((e, i) => ({...e, image:'assets/' + e.id + '.svg', number:String(i+1).padStart(2,'0')}));
  if (typeof module === 'object' && module.exports) module.exports = exercises;
  else root.LEAN_EXERCISES = exercises;
})(typeof globalThis !== 'undefined' ? globalThis : this);
