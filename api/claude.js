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
      "summary": string,
      "rest_seconds": number,
      "days": [
        {
          "day": number,
          "label": string,
          "focus": [string],
          "exercises": [
            {
              "id": string,
              "name": string,
              "sets": [{ "reps": number, "rest_seconds": number, "weight_note": string }],
              "note": string
            }
          ]
        }
      ],
      "weekly_goals": [string],
      "tips": [string]
    }`,
    "规则: 休息日 exercises 为空数组; 每个训练日 4-6 个动作; 每个动作 3-4 组; 新手用较轻重量多次数。",
    "语言: title、summary、days[].label、days[].exercises[].note、weekly_goals、tips 必须全部用简体中文, 不要出现任何英文单词。",
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
    "输出修改后的完整计划，严格 JSON，格式同原计划（title/summary/rest_seconds/days/weekly_goals/tips），days 里的动作 id 只能来自上面允许列表。",
    "语言: 所有文本字段（title/summary/label/note/weekly_goals/tips）必须用简体中文, 不要出现任何英文单词。",
  ].join("\n");
}

function reviewPrompt(plan, sessions, sets, extra) {
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
    JSON.stringify(sets.slice(0, 300)),
    "",
    "用户反馈:",
    JSON.stringify(extra),
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
  return parsed;
}

async function revisePlan(plan, adjustments, exercises) {
  const text = await chat([{ role: "user", content: revisePrompt(plan, adjustments, exercises) }]);
  const parsed = parseJson(text);
  const valid = new Set(exercises.map(e => e.id));
  parsed.days = parsed.days || [];
  for (const d of parsed.days) {
    d.exercises = (d.exercises || []).filter(e => valid.has(e.id));
  }
  return parsed;
}

async function weeklyReview(plan, sessions, sets, extra) {
  const text = await chat([{ role: "user", content: reviewPrompt(plan, sessions, sets, extra) }]);
  return parseJson(text);
}

module.exports = { generatePlan, revisePlan, weeklyReview };
