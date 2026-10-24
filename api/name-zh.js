// openGym 动作名 → 中文。openGym 命名是组合式（器材 + 动作 + 变体），
// 不逐条翻 5600 条，而是「命名片段词典 + 组合翻译」，一次覆盖全部。
// 未命中的 fallback 英文原名（前端 name_zh 会等于 name）。

// 器材/设备（按长度降序匹配，避免 "ez barbell" 被 "barbell" 先吃掉）
const GEAR = {
  "ez barbell": "EZ杆",
  "olympic barbell": "奥林匹克杆",
  "barbell": "杠铃",
  "dumbbell": "哑铃",
  "kettlebell": "壶铃",
  "bodyweight": "徒手",
  "body weight": "徒手",
  "body-weight": "徒手",
  "resistance band": "弹力带",
  "cable": "绳索",
  "trap bar": "六角杠",
  "sledge hammer": "大锤",
  "sledge": "大锤",
  "smith machine": "史密斯机",
  "leverage machine": "杠杆器械",
  "landmine": "地雷管",
  "medicine ball": "药球",
  "med ball": "药球",
  "bosu ball": "波速球",
  "stability ball": "健身球",
  "suspension trainer": "悬挂训练",
  "wheel roller": "健腹轮",
  "roller": "健腹轮",
  "sled machine": "雪橇机",
  "assisted": "助力器",
  "band": "弹力带",
  "weighted": "负重",
  "machine": "器械",
  "rope": "绳索",
  "axle": "杠轴",
  "weight plate": "杠铃片",
  "tire": "轮胎",
  "hammer": "锤",
  "macebell": "锤铃",
  "sandbag": "沙袋",
};

// 核心动作词（按长度降序匹配）
const MOVES = {
  "deadlift": "硬拉",
  "dead lift": "硬拉",
  "bench press": "卧推",
  "bench": "卧推",
  "squat": "深蹲",
  "pull up": "引体向上",
  "pull-up": "引体向上",
  "pullup": "引体向上",
  "chin up": "反握引体",
  "chin-up": "反握引体",
  "chin": "反握引体",
  "face pull": "面拉",
  "pull down": "高位下拉",
  "pull-down": "高位下拉",
  "pulldown": "高位下拉",
  "pull apart": "弹力带开合",
  "row": "划船",
  "curl": "弯举",
  "leg curl": "腿弯举",
  "leg press": "腿举",
  "leg extension": "腿屈伸",
  "hip extension": "髋伸展",
  "hip thrust": "臀桥",
  "shoulder press": "推举",
  "overhead press": "推举",
  "shoulder": "肩",
  "press": "推",
  "fly": "夹胸",
  "flyes": "夹胸",
  "crunch": "卷腹",
  "sit up": "仰卧起坐",
  "sit-up": "仰卧起坐",
  "lunge": "弓步",
  "sprinter lunge": "冲刺弓步",
  "split squat": "保加利亚蹲",
  "bulgarian split squat": "保加利亚蹲",
  "pistol squat": "手枪蹲",
  "kickback": "后踢",
  "kick": "踢",
  "dip": "双杠臂屈伸",
  "push-up": "俯卧撑",
  "push up": "俯卧撑",
  "pushup": "俯卧撑",
  "push up": "俯卧撑",
  "plank": "平板支撑",
  "plank": "平板支撑",
  "leg raise": "抬腿",
  "leg raise": "抬腿",
  "hip lift": "抬臀",
  "glute bridge": "臀桥",
  "bridge": "桥",
  "extension": "伸展",
  "extension": "伸展",
  "extension": "伸展",
  "rotation": "转体",
  "rotational": "转体",
  "rotator": "旋转",
  "twist": "扭转",
  "swinging": "摆动",
  "swing": "摆动",
  "snatch": "抓举",
  "clean": "提拉",
  "press down": "下压",
  "pressdown": "下压",
  "reverse": "反向",
  "incline": "斜",
  "decline": "下斜",
  "seated": "坐姿",
  "standing": "站姿",
  "lying": "卧姿",
  "kneeling": "跪姿",
  "hanging": "悬垂",
  "one arm": "单臂",
  "one arm": "单臂",
  "single arm": "单臂",
  "single leg": "单腿",
  "double arm": "双臂",
  "two arm": "双臂",
  "bilateral": "双侧",
  "alternating": "交替",
  "alternate": "交替",
  "cross": "交叉",
  "overhead": "头顶",
  "behind neck": "颈后",
  "front": "前",
  "rear": "后",
  "side": "侧",
  "lateral": "侧",
  "high": "高位",
  "low": "低位",
  "wide grip": "宽握",
  "wide-grip": "宽握",
  "narrow grip": "窄握",
  "close grip": "窄握",
  "close-grip": "窄握",
  "underhand": "反握",
  "neutral grip": "对握",
  "palm": "掌",
  "wrist": "腕",
  "forearm": "前臂",
  "bicep": "肱二头",
  "biceps": "肱二头",
  "tricep": "肱三头",
  "triceps": "肱三头",
  "triset": "肱三头",
  "chest": "胸",
  "lats": "背阔",
  "lat": "背阔",
  "upper back": "上背",
  "lower back": "下背",
  "glute": "臀",
  "glutes": "臀",
  "quad": "股四头",
  "quads": "股四头",
  "quadriceps": "股四头",
  "hamstring": "腘绳",
  "hamstrings": "腘绳",
  "calf": "小腿",
  "calves": "小腿",
  "abs": "腹",
  "ab": "腹",
  "core": "核心",
  "oblique": "腹斜",
  "obliques": "腹斜",
  "deltoid": "三角肌",
  "deltoids": "三角肌",
  "trapezius": "斜方肌",
  "trap": "斜方肌",
  "rhomboid": "菱形肌",
  "rhomboids": "菱形肌",
  "hip": "髋",
  "neck": "颈",
  "pelvis": "骨盆",
  "spine": "脊柱",
};

// 后缀变体标记（这些保留原样，不做中文，避免乱）
const SKIP = /(\. \d|version|v\. ?\d|side pov|f\.)\b/i;

// 组合翻译：把英文动作名切成「器材 + 动作 + 变体」拼成中文。
function translateZh(name) {
  if (!name) return "";
  // 去掉变体后缀（v.2 / version 2 / side pov）
  let core = name.replace(/\s*\(.*?\)/g, "").replace(/\s+v\.?\d+/g, "").trim();
  if (SKIP.test(name)) return ""; // 带强变体标记的，fallback 英文
  let rest = core.toLowerCase();
  const parts = [];
  // 1) 器材前缀（贪心匹配最长的）
  const gearKeys = Object.keys(GEAR).sort((a, b) => b.length - a.length);
  for (const g of gearKeys) {
    if (rest.startsWith(g + " ") || rest === g) {
      parts.push(GEAR[g]);
      rest = rest === g ? "" : rest.slice(g.length).trim();
      break;
    }
  }
  // 2) 剩下的核心动作词
  let word = rest;
  const moveKeys = Object.keys(MOVES).sort((a, b) => b.length - a.length);
  const buf = [];
  for (const mk of moveKeys) {
    if (word.includes(mk)) {
      const idx = word.indexOf(mk);
      // 只取第一个匹配，避免重叠
      buf.push(MOVES[mk]);
      break;
    }
  }
  parts.push(...buf);
  // 3) 剩下的非器材、非动作词（如 "seated" 位置词已被上面吞，剩长尾直接丢弃或保留）
  if (parts.length === 0) return ""; // 翻译不出有效词 → fallback 英文
  return parts.join("");
}

module.exports = { translateZh };
