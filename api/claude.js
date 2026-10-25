const BASE = (process.env.CLAUDE_API_BASE || "https://api.anthropic.com").replace(/\/+$/, "");
const KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

async function chat(messages) {
  if (!KEY) throw new Error("CLAUDE_API_KEY not configured");
  const res = await fetch(`${BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "authorization": `Bearer ${KEY}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: "你输出严格的 JSON，不要加任何解释、markdown 或代码块围栏。",
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");
  return text;
}

// 中文标签 → 英文（计划里 label/提示用）
const LABEL_EN = {
  推: "Push", 拉: "Pull", 腿: "Legs", 肩: "Shoulder", 臂: "Arm", 背: "Back",
  胸: "Chest", 核心: "Core", 全身: "Full Body", 有氧: "Cardio", 休息: "Rest",
};
function labelEn(label) {
  const s = String(label || "");
  const hit = Object.keys(LABEL_EN).find((k) => s.indexOf(k) >= 0);
  return hit ? s.replace(hit, LABEL_EN[hit]) : s;
}
// 给 plan_data 补英文字段（title_en/goal_en/summary_en/weekly_goals_en/tips_en/label_en/note_en），
// 英文字段由 AI 提示词直接输出真翻译；缺省则回退 labelEn 推导 / 原值
function withEn(plan) {
  const p = JSON.parse(JSON.stringify(plan || {}));
  p.title_en = p.title_en || p.title || "";
  p.summary_en = p.summary_en || p.summary || "";
  p.weekly_goals_en = p.weekly_goals_en || (p.weekly_goals || []).map((x) => String(x));
  p.tips_en = p.tips_en || (p.tips || []).map((x) => String(x));
  (p.days || []).forEach((d) => {
    d.label_en = d.label_en || labelEn(d.label);
    (d.exercises || []).forEach((e) => (e.note_en = e.note_en || e.note || ""));
  });
  return p;
}

// goal 值英文映射（前端提交的是中文 goal）
const GOAL_EN = { 增肌: "Hypertrophy", 减脂: "Fat Loss", 力量: "Strength", 体能: "Conditioning", 塑形: "Toning" };

function planPrompt(user, exercises) {
  return [
    "你是一名专业健身教练。请根据用户需求和可用动作库，制定一份可执行的训练计划。",
    "",
    "用户需求:",
    JSON.stringify(user, null, 2),
    "",
    "可用动作 (只能从这里选, 用 id 引用):",
    JSON.stringify(exercises),
    "",
    "输出严格的 JSON，格式如下:",
    `{
      "title": string,
      "title_en": string,
      "summary": string,
      "summary_en": string,
      "rest_seconds": number,
      "days": [
        {
          "day": number,
          "label": string,
          "label_en": string,
          "focus": [string],
          "exercises": [
            {
              "id": string,
              "name": string,
              "sets": [{ "reps": number, "rest_seconds": number, "weight_note": string }],
              "note": string,
              "note_en": string
            }
          ]
        }
      ],
      "weekly_goals": [string],
      "weekly_goals_en": [string],
      "tips": [string],
      "tips_en": [string]
    }`,
    "规则: 休息日 exercises 为空数组; 每个训练日 4-6 个动作; 每个动作 3-4 组; 新手用较轻重量多次数。",
    "语言: title/summary/days[].label/days[].exercises[].note/weekly_goals/tips 全部用简体中文; " +
    "对应 _en 字段（title_en/summary_en/label_en/note_en/weekly_goals_en/tips_en）全部用英文，是上面中文内容的准确翻译，不是占位。",
  ].join("\n");
}

function revisePrompt(plan, adjustments, exercises) {
  return [
    "你是健身教练。用户有一份现成计划，现在提出调整要求。请在原计划基础上修改，尽量少改动，不要引入下面列表之外的动作。",
    "",
    "当前计划:",
    JSON.stringify(plan, null, 2),
    "",
    "用户调整要求:",
    JSON.stringify(adjustments),
    "",
    "允许选用的动作（id 引用）:",
    JSON.stringify(exercises),
    "",
    "输出修改后的完整计划，严格 JSON，格式含双语字段：",
    "title/title_en, summary/summary_en, rest_seconds, days[].label/label_en, days[].exercises[].note/note_en, weekly_goals/weekly_goals_en, tips/tips_en。",
    "days 里的动作 id 只能来自上面允许列表。",
    "语言: 不带 _en 的字段全部用简体中文; _en 字段是中文的准确英文翻译，不能留空或照抄中文。",
  ].join("\n");
}

function reviewPrompt(plan, sessions, sets, extra) {
  // 训练量/频率统计：给 AI 数值依据，建议才能量化（减多少组、加几天）
  const daySet = new Set();
  let totalSets = 0, totalReps = 0, totalVol = 0;
  const exSet = new Map(); // exercise_id → sets
  for (const r of sets || []) {
    if (!r.done) continue;
    totalSets++;
    totalReps += Number(r.reps) || 0;
    totalVol += (Number(r.reps) || 0) * (Number(r.weight) || 0);
    const key = String(r.exercise_id || "");
    exSet.set(key, (exSet.get(key) || 0) + 1);
  }
  const top = [...exSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const doneDays = (sessions || []).filter((s) => s.done).length;
  const activeDays = new Set((sessions || []).map((s) => s.session_date)).size;
  const stats = {
    done_days: doneDays,
    active_days: activeDays,
    total_sets: totalSets,
    total_reps: totalReps,
    total_volume: Math.round(totalVol),
    top_exercises: top.map(([id, n]) => ({ exercise_id: id, sets: n })),
  };
  return [
    "你是健身教练，请基于用户过去一周的训练记录做复盘。",
    "",
    "当前计划:",
    JSON.stringify({ title: plan.title, goal: plan.goal, plan_data: plan.plan_data }, null, 2),
    "",
    "近 7 天打卡记录 (done=true 表示完成当天):",
    JSON.stringify(sessions),
    "",
    "近 7 天组记录:",
    JSON.stringify((sets || []).slice(0, 300)),
    "",
    "训练量/频率统计（复盘建议必须引用这些数值）:",
    JSON.stringify(stats),
    "",
    "用户反馈:",
    JSON.stringify(extra),
    "",
    "规则:",
    "- verdict/adherence/strengths/problems 保持原有风格；",
    "- suggestions 里每条 action 必须给出具体数值调整（组数、次数、频率、重量），例如「推日组数 4→3」，不要空泛建议；",
    "- 若 done_days 明显低于计划天数，first 提频率建议；若 total_volume 持平/下降，提渐进超负荷（加重量或次数）；",
    "- next_plan_adjustment 用一段话描述要交给修改接口执行的调整，含目标肌群/组数/次数变化。",
    "",
    "输出严格 JSON:",
    `{
      "verdict": string,
      "adherence": number,
      "strengths": [string],
      "problems": [string],
      "suggestions": [{ "action": string, "reason": string }],
      "next_plan_adjustment": string
    }`,
  ].join("\n");
}

function parseJson(text) {
  return JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ""));
}

async function generatePlan(user, exercises) {
  const text = await chat([{ role: "user", content: planPrompt(user, exercises) }]);
  const parsed = parseJson(text);
  const valid = new Set(exercises.map(e => e.id));
  parsed.days = parsed.days || [];
  for (const d of parsed.days) {
    d.exercises = (d.exercises || []).filter(e => valid.has(e.id)).slice(0, 6);
  }
  // 英文字段：goal_en 按 goal 值映射；label_en/note_en 由中文标签推导
  parsed.goal_en = GOAL_EN[user.goal] || String(user.goal || "");
  return withEn(parsed);
}

async function revisePlan(plan, adjustments, exercises) {
  const text = await chat([{ role: "user", content: revisePrompt(plan, adjustments, exercises) }]);
  const parsed = parseJson(text);
  const valid = new Set(exercises.map(e => e.id));
  parsed.days = parsed.days || [];
  for (const d of parsed.days) {
    d.exercises = (d.exercises || []).filter(e => valid.has(e.id));
  }
  // 英文字段沿用上版计划的 goal_en（label_en/note_en 重新推导）
  parsed.goal_en = plan.goal_en || "";
  return withEn(parsed);
}

async function weeklyReview(plan, sessions, sets, extra) {
  const text = await chat([{ role: "user", content: reviewPrompt(plan, sessions, sets, extra) }]);
  return parseJson(text);
}

module.exports = { generatePlan, revisePlan, weeklyReview };
