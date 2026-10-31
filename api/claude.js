// 纯规则引擎：生成计划 / 调整计划 / 周复盘，不依赖任何 LLM
const crypto = require("crypto");

const GOAL_EN = { 增肌: "Hypertrophy", 减脂: "Fat Loss", 力量: "Strength", 体能: "Conditioning", 塑形: "Toning" };
const LEVEL_EN = { 新手: "Beginner", 中级: "Intermediate", 高级: "Advanced" };
const LABEL_EN = {
  推: "Push", 拉: "Pull", 腿: "Legs", 肩: "Shoulder", 臂: "Arm",
  背: "Back", 胸: "Chest", 核心: "Core", 全身: "Full Body",
  有氧: "Cardio", 休息: "Rest",
};
function labelEn(label) {
  const s = String(label || "");
  const hit = Object.keys(LABEL_EN).find(k => s.indexOf(k) >= 0);
  return hit ? s.replace(hit, LABEL_EN[hit]) : s;
}
function withEn(plan) {
  const p = JSON.parse(JSON.stringify(plan || {}));
  p.title_en = p.title_en || p.title || "";
  p.summary_en = p.summary_en || p.summary || "";
  p.weekly_goals_en = p.weekly_goals_en || (p.weekly_goals || []).map(x => String(x));
  p.tips_en = p.tips_en || (p.tips || []).map(x => String(x));
  (p.days || []).forEach(d => {
    d.label_en = d.label_en || labelEn(d.label);
    (d.exercises || []).forEach(e => (e.note_en = e.note_en || e.note || ""));
  });
  return p;
}

// ---------- 训练日分配规则 ----------
function buildSchedule(goal, daysPerWeek, equipment, exercises, level) {
  // 根据目标 + 周训练天数生成每日分配
  const rest = (labels) => ({ day: 0, label: "休息", focus: [], exercises: [] });
  const eq = equipment || "";

  // 部位轮转表
  const PUSH = ["胸", "肩", "臂"];
  const PULL = ["背", "核心"];
  const LEGS = ["腿"];
  const FULL = ["全身"];
  const CARDIO = ["有氧"];

  function pick(exercises, muscles, n) {
    const pool = exercises.filter(e => muscles.some(m => String(e.muscle || "").includes(m) || String(e.bodypart || "").includes(m)));
    const used = new Set();
    const result = [];
    for (const ex of pool) {
      if (result.length >= n) break;
      if (used.has(ex.id)) continue;
      used.add(ex.id);
      result.push(ex);
    }
    // 候选不够就全取
    if (result.length < n && pool.length < n) {
      for (const ex of pool) {
        if (result.length >= n) break;
        if (!used.has(ex.id)) { used.add(ex.id); result.push(ex); }
      }
    }
    return result;
  }

  function buildDay(dayNo, label, focus, exercises, goal, level) {
    const reps = level === "新手" ? [12, 15] : level === "高级" ? [6, 8] : [10, 12];
    const setsCount = goal === "减脂" ? 3 : goal === "力量" ? 4 : 4;
    const exList = exercises.slice(0, 4).map((ex, i) => ({
      id: ex.id,
      name: ex.name,
      sets: Array.from({ length: setsCount }, (_, s) => ({
        reps: reps[0] + s,
        rest_seconds: goal === "减脂" ? 45 : 90,
        weight_note: level === "新手" ? "轻重量，动作标准" : level === "高级" ? "渐进加重" : "中重量",
      })),
      note: "注意动作全程",
      note_en: "Full ROM with control",
    }));
    return { day: dayNo, label, focus, exercises: exList };
  }

  const days = [];
  let curDay = 1;

  // 休息日插入（第2天、第7天）
  const insertRest = () => { days.push({ day: curDay++, label: "休息", focus: [], exercises: [] }); };

  if (daysPerWeek <= 2) {
    days.push(buildDay(curDay++, "全身训练", FULL, pick(exercises, FULL, 6), goal, level));
    insertRest();
    days.push(buildDay(curDay++, "有氧", CARDIO, pick(exercises, CARDIO, 4), goal, level));
  } else if (daysPerWeek <= 3) {
    days.push(buildDay(curDay++, "推（胸/肩/臂）", PUSH, pick(exercises, PUSH, 5), goal, level));
    insertRest();
    days.push(buildDay(curDay++, "拉（背/核心）", PULL, pick(exercises, PULL, 5), goal, level));
    insertRest();
    days.push(buildDay(curDay++, "腿", LEGS, pick(exercises, LEGS, 5), goal, level));
  } else if (daysPerWeek <= 5) {
    days.push(buildDay(curDay++, "推（胸/肩/臂）", PUSH, pick(exercises, PUSH, 5), goal, level));
    days.push(buildDay(curDay++, "拉（背/核心）", PULL, pick(exercises, PULL, 5), goal, level));
    days.push(buildDay(curDay++, "腿", LEGS, pick(exercises, LEGS, 5), goal, level));
    insertRest();
    days.push(buildDay(curDay++, "肩部专项", ["肩"], pick(exercises, ["肩"], 4), goal, level));
    insertRest();
    days.push(buildDay(curDay++, "手臂专项", ["臂"], pick(exercises, ["臂"], 4), goal, level));
  } else {
    // 6 天：推/拉/腿 × 2
    const labels2 = [["推A", "推（胸/肩）"], ["拉A", "拉（背/二头）"], ["腿A", "腿（股四）"],
                     ["推B", "推（肩/三头）"], ["拉B", "拉（背/整体）"], ["腿B", "腿（臀/腘绳）"]];
    for (let i = 0; i < labels2.length; i++) {
      const muscles = labels2[i][0].includes("推") ? PUSH : labels2[i][0].includes("拉") ? PULL : LEGS;
      days.push(buildDay(curDay++, labels2[i][1], muscles, pick(exercises, muscles, 5), goal, level));
      if (i === 2) insertRest();
      if (i === 5) insertRest();
    }
  }

  // 补齐 day 编号连续
  days.forEach((d, i) => (d.day = i + 1));
  return days;
}

// ---------- 生成计划 ----------
function generatePlanSync(user, exercises) {
  const goal = user.goal || "增肌";
  const daysPerWeek = Number(user.days_per_week) || 3;
  const level = user.level || "新手";
  const equipment = user.equipment || "";
  const focus = (user.focus || []).filter(Boolean);

  const title = goal === "减脂" ? "高效减脂训练计划" : goal === "力量" ? "力量提升计划" : "增肌训练计划";
  const summary = `每周 ${daysPerWeek} 天训练，目标${goal}，适合${level}阶段${equipment ? "，主要使用" + equipment : ""}。`;

  const allMuscles = focus.length ? focus : ["胸", "背", "腿", "肩", "核心", "臂", "全身", "有氧"];
  const allExercises = exercises.length
    ? exercises
    : allMuscles.map(m => ({ id: m, name: m + "基础动作", muscle: m, equipment: equipment || "" }));

  const days = buildSchedule(goal, daysPerWeek, equipment, allExercises, level);

  const weeklyGoals = goal === "减脂"
    ? ["每周 3 次有氧，每次 30 分钟以上", "控制碳水摄入，每日热量缺口 300-500 kcal", "每天饮水 2L 以上"]
    : goal === "力量"
    ? ["重点动作每 2-3 周递增 2.5-5 kg", "休息充足，4-5 天训练间隔 48h", "睡眠 7-8 小时保证恢复"]
    : ["每 2-4 周渐进加重 5-10%", "组间休息控制在 60-90 秒", "保证蛋白质摄入 1.6-2.2 g/kg 体重"];

  const tips = [
    "每次训练前 5-10 分钟热身，重点活动相关关节",
    level === "新手" ? "前 4 周以学习动作模式为主，重量从轻开始" : "注意渐进超负荷，记录每次的重量和次数",
    "组间休息严格按计划执行，不要玩手机",
    goal === "减脂" ? "有氧优先空腹或晚餐后 2 小时进行" : "力量训练后 30 分钟内补充蛋白质",
  ];

  const plan = {
    title,
    summary,
    rest_seconds: goal === "减脂" ? 45 : 90,
    days,
    weekly_goals: weeklyGoals,
    tips,
  };
  return withEn(plan);
}

// 保持 API 签名不变（server.js 调的是 async generatePlan）
async function generatePlan(user, exercises) {
  return generatePlanSync(user, exercises);
}

// ---------- 调整计划 ----------
async function revisePlan(plan, adjustments, exercises) {
  const revised = JSON.parse(JSON.stringify(plan));
  const adj = String(adjustments || "");

  // 规则：根据关键词调整
  if (/减少|轻松|减负|简单/.test(adj)) {
    revised.days.forEach(d => {
      d.exercises.forEach(e => {
        e.sets = e.sets.slice(0, 3);
        e.sets.forEach(s => (s.reps = Math.min(s.reps, 12)));
      });
    });
    revised.tips.push("当前减负模式，每组减少 1 组");
  } else if (/增加|加重|强度|进阶|难/.test(adj)) {
    revised.days.forEach(d => {
      d.exercises.forEach(e => {
        if (e.sets.length < 5) e.sets.push({ reps: 8, rest_seconds: 90, weight_note: "加重" });
        e.sets.forEach(s => (s.weight_note = "比上次加重 5-10%"));
      });
    });
    revised.tips.push("进阶模式：每次尝试比上次加重 2.5-5 kg");
  } else if (/有氧|减脂|心肺/.test(adj)) {
    // 插入或强化有氧日
    const cardioDay = revised.days.find(d => d.label.includes("有氧"));
    if (cardioDay) {
      cardioDay.exercises.forEach(e => e.sets.forEach(s => (s.rest_seconds = 30)));
    } else {
      revised.days.push({
        day: revised.days.length + 1,
        label: "有氧日",
        label_en: "Cardio",
        focus: ["有氧"],
        exercises: (exercises || []).filter(e => String(e.muscle || e.bodypart || "").includes("有氧") || String(e.muscle || "").includes("Cardio")).slice(0, 3).map(e => ({
          id: e.id, name: e.name,
          sets: [{ reps: 30, rest_seconds: 30, weight_note: "30分钟中强度有氧" }],
          note: "保持心率 130-150 区间",
          note_en: "Maintain heart rate 130-150",
        })),
      });
    }
    revised.tips.push("有氧日：中等强度，可以说话但不能唱歌");
  } else if (/腿|臀|股四|腘绳/.test(adj)) {
    const legDay = revised.days.find(d => d.label.includes("腿") || d.label.includes("Legs"));
    if (legDay) {
      legDay.exercises = (exercises || []).filter(e => String(e.muscle || "").includes("腿") || String(e.bodypart || "").includes("leg")).slice(0, 5).map(e => ({
        id: e.id, name: e.name,
        sets: Array(4).fill().map((_, i) => ({ reps: 10 + i, rest_seconds: 90, weight_note: "中等重量" })),
        note: "注重蹲的最低点停留 1-2 秒",
        note_en: "Pause 1-2s at the bottom",
      }));
    }
  }
  revised.version = (plan.version || 0) + 1;
  return revised;
}

// ---------- 周复盘（规则版） ----------
async function weeklyReview(plan, sessions, sets, extra) {
  const doneDays = (sessions || []).filter(s => s.done).length;
  const plannedDays = ((plan.plan_data || plan).days || []).filter(d => d.exercises && d.exercises.length > 0).length || 3;
  const adherence = plannedDays ? Math.round(doneDays / plannedDays * 100) : 100;

  const doneSets = (sets || []).filter(s => s.done);
  const totalReps = doneSets.reduce((a, s) => a + (Number(s.reps) || 0), 0);
  const totalVol = doneSets.reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
  const exMap = {};
  doneSets.forEach(s => { exMap[s.exercise_id] = (exMap[s.exercise_id] || 0) + 1; });
  const topEx = Object.entries(exMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ exercise_id: id, sets: n }));

  const strengths = [];
  const problems = [];
  const suggestions = [];

  if (adherence >= 80) strengths.push(`打卡率 ${adherence}%，完成度高，继续保持`);
  else if (adherence >= 50) { strengths.push("训练量中等"); problems.push(`打卡率 ${adherence}%，低于目标（每周应完成 ${plannedDays} 天）`); }
  else { problems.push(`打卡率仅 ${adherence}%（${doneDays}/${plannedDays} 天），建议先把频率提上来再加重`); }

  if (totalVol > 0) {
    strengths.push(`本周累计 ${totalReps} 次 / ${Math.round(totalVol)} kg 训练量`);
    if (topEx.length) problems.push("部分动作训练量偏少，注意各部位均衡");
  } else {
    problems.push("本周无有效组记录，建议至少完成 3 天训练");
  }

  // 建议
  if (adherence < 50) {
    suggestions.push({ action: "下周目标：每天 5 分钟热身 + 1 个核心动作，先建立习惯", reason: "打卡率过低" });
  }
  if (totalVol > 0 && adherence >= 70) {
    suggestions.push({ action: "主要动作每组加 1-2 kg 或加 1 组", reason: "训练量稳定，可以渐进超负荷" });
  }
  if (problems.some(p => p.includes("各部位"))) {
    suggestions.push({ action: "下周腿日组数从 3→4，臀/腿动作优先", reason: "下肢训练量不足" });
  }

  const verdict = adherence >= 80 ? "表现优秀" : adherence >= 50 ? "中等，有提升空间" : "偏低，需要加强频率";

  return {
    verdict,
    adherence,
    strengths,
    problems,
    suggestions: suggestions.slice(0, 3),
    next_plan_adjustment: adherence < 50
      ? "下一周期减少每周训练天数至 2-3 天，优先保证完成质量"
      : totalVol > 0
      ? "保持当前频率，主要复合动作加 2.5-5 kg，组间休息减 15 秒"
      : "维持当前计划，下周确保完成全部训练天数",
  };
}

module.exports = { generatePlan, revisePlan, weeklyReview };
