const express = require("express");
const crypto = require("crypto");
const { Pool } = require("pg");
const { generatePlan, revisePlan, weeklyReview } = require("./claude.js");
const { translateZh } = require("./name-zh.js");

const app = express();
app.use(express.json({ limit: "1mb" }));

// 动作图片/动画：openGym media 通过 volume 挂到容器内 /media（still/*.webp + clip/*.mp4）。
// edge 把 /media/* 反代到 :4010，由这里伺服。
// 动作图片/动画：openGym media 通过 volume 挂到容器内 /media（still/*.webp + clip/*.mp4）。
// edge 把 /media/* 反代到 :4010，由这里伺服。mp4 需要 range 请求（视频拖动）。
app.use("/media", express.static("/media", { maxAge: "1y", immutable: true }));
app.use((req, res, next) => {
  if (req.path.startsWith("/media/")) {
    res.setHeader("Accept-Ranges", "bytes");
  }
  next();
});

// 动作名中文化：优先用离线预生成的 name_zh（可被中文搜索命中），
// 库里没有的才现场用组合翻译器翻（命名片段词典），翻不出 fallback 英文原名。
function zhName(name) {
  return translateZh(name) || name;
}

function mediaBase() {
  // 小程序合法域名是 https://gym.70kj.vip，media 也挂它下面
  return process.env.MEDIA_BASE || "https://gym.70kj.vip";
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ---------- 鉴权：测试期 X-Openid 头直接放行 ----------
// 小程序端固定写死 dev-default。正式接微信登录时再换成 code2session 校验。
function reqOpenid(req, res, next) {
  const openid = req.get("X-Openid");
  if (!openid) return res.status(401).json({ error: "missing X-Openid" });
  req.openid = openid;
  next();
}

async function ensureUser(openid) {
  await pool.query(
    `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [openid]
  );
}

// ---------- 动作库 ----------
// 启动：幂等补 name_zh 列，并灌离线生成的中文（中文搜索靠它匹配）
pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS name_zh text DEFAULT ''`).catch((e) => console.error("migrate name_zh:", e));
// 离线中文名（gen-zh.js 生成）灌库：Postgres 单条 SQL 占位符上限 65535，但每块参数数也别太大，200 条/块稳妥
{
  const zhRows = require("./exercises-zh.js");
  const CHUNK = 200;
  for (let i = 0; i < zhRows.length; i += CHUNK) {
    const chunk = zhRows.slice(i, i + CHUNK);
    const names = chunk.map((r) => r.name);
    const flat = chunk.flatMap((r) => [r.name, r.zh]);
    pool
      .query(
        "UPDATE exercises e SET name_zh = v.zh FROM (VALUES " +
          names.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(",") +
          ") AS v(name, zh) WHERE e.name = v.name AND e.name_zh = ''",
        flat
      )
      .catch((e) => console.error("seed name_zh:", e));
  }
}

app.get("/exercises", async (req, res) => {
  // lang=en：搜索直接命中文本（name/muscle），不再命中 name_zh；
  // lang=zh（默认）：中文搜 name_zh，英文搜 name/muscle
  const { q, muscle, equipment, cat, limit = 50, offset = 0, lang } = req.query;
  const where = [];
  const args = [];
  if (q) {
    args.push(`%${q}%`);
    const qi = args.length; // 占位符引用统一用 qi，避免插值串里美元符号被意外展开
    // 英文模式（lang=en）：只命中 name/muscle，保证结果里可无中文展示；
    // 中文模式：中文搜 name_zh，英文搜 name/muscle
    if (lang === "en") {
      where.push(`(name ILIKE $${qi} OR muscle ILIKE $${qi})`);
    } else {
      const isCjk = /[\u4e00-\u9fff]/.test(q);
      where.push(
        isCjk
          ? `(name ILIKE $${qi} OR name_zh ILIKE $${qi})`
          : `(name ILIKE $${qi} OR muscle ILIKE $${qi})`
      );
    }
  }
  if (muscle) {
    args.push(muscle);
    where.push(`muscle = $${args.length}`);
  }
  if (equipment) {
    args.push(equipment);
    where.push(`equipment ILIKE $${args.length}`);
  }
  if (cat) {
    args.push(cat);
    where.push(`cat = $${args.length}`);
  }
  args.push(Math.min(Number(limit) || 50, 500), Number(offset));
  const sql = `
    SELECT id, name, muscle, muscles, equipment, target, cat, bodypart
    FROM exercises
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY name
    LIMIT $${args.length - 1} OFFSET $${args.length}`;
  const r = await pool.query(sql, args);
  const base = mediaBase();
  // 中文名取库里 name_zh（含搜索命中的），缺失才现场翻译；图片/动画 URL 由 id 推导（openGym 约定 {id}.webp / {id}.mp4）
  res.json(
    r.rows.map((x) => ({
      ...x,
      name_zh: x.name_zh || zhName(x.name),
      img_url: `${base}/media/still/${x.id}.webp`,
      clip_url: `${base}/media/clip/${x.id}.mp4`,
    }))
  );
});

// ---------- 计划 ----------
// 计划行补英文字段：goal_en 由 goal 值映射；plan_data 里的英文展示字段
// （title_en/summary_en/label_en/note_en）新计划生成时就带，旧计划缺失时
// 前端回退原值，不再逐条查库翻译
const GOAL_EN = { 增肌: "Hypertrophy", 减脂: "Fat Loss", 力量: "Strength", 体能: "Conditioning", 塑形: "Toning" };
function planRow(row) {
  const p = { ...row };
  p.goal_en = GOAL_EN[row.goal] || String(row.goal || "");
  return p;
}

app.get("/plans", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const r = await pool.query(
    `SELECT id, title, goal, status, version, created_at, updated_at,
            plan_data->'days' AS days
     FROM plans WHERE user_id = $1 ORDER BY updated_at DESC`,
    [req.openid]
  );
  res.json(r.rows.map(planRow));
});

app.get("/plans/:id", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const r = await pool.query(
    `SELECT * FROM plans WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.openid]
  );
  if (!r.rows.length) return res.status(404).json({ error: "not found" });
  res.json(planRow(r.rows[0]));
});

// 生成计划：body = { goal, days_per_week, level, time_per_session, equipment, focus, notes }
app.post("/plans/generate", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const req_ = req.body || {};
  // 拉取匹配动作作为素材，让 Claude 从真实动作库里挑
  const focus = (req_.focus || []).filter(Boolean);
  const eq = req_.equipment || "";
  const where = [];
  const args = [];
  if (eq) {
    args.push(eq);
    where.push(`equipment ILIKE '%' || $${args.length} || '%'`);
  }
  // focus 展开成逐个 = $n OR 项，不用 ::text[] 数组参数（pg 对数组参数类型推断会报 42P18）
  if (focus.length) {
    const terms = focus.map((m) => {
      args.push(m);
      return `muscle = $${args.length}`;
    });
    where.push("(" + terms.join(" OR ") + ")");
  }
  const exr = await pool.query(
    `SELECT id, name, muscle, equipment FROM exercises
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY random() LIMIT 80`,
    args
  );
  try {
    const plan = await generatePlan(req_, exr.rows);
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO plans (id, user_id, title, goal, plan_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.openid, plan.title || "AI 训练计划", req_.goal || "", JSON.stringify(plan)]
    );
    res.json({ id, plan });
  } catch (e) {
    res.status(502).json({ error: "plan generation failed", detail: String(e.message || e) });
  }
});

// 手动调整计划：body = { adjustments: [...] }，让 AI 基于现有计划 + 用户要求修改
app.post("/plans/:id/revise", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const r = await pool.query(
    `SELECT * FROM plans WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.openid]
  );
  if (!r.rows.length) return res.status(404).json({ error: "not found" });
  const plan = r.rows[0].plan_data;
  // 用计划里已选的动作 + 用户调整要求，让 AI 只改不改选范围外的动作
  const chosenExercises = (plan.days || []).flatMap(d => d.exercises || []);
  const revised = await revisePlan(plan, req.body.adjustments || [], chosenExercises);
  const version = r.rows[0].version + 1;
  await pool.query(
    `UPDATE plans SET plan_data = $3, version = $4, updated_at = now() WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.openid, JSON.stringify(revised), version]
  );
  res.json({ id: req.params.id, version, plan: revised });
});

// ---------- 每日执行 ----------
// 建当天 session
app.post("/sessions", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const { plan_id, session_date, notes } = req.body;
  const r = await pool.query(
    `SELECT id FROM plans WHERE id = $1 AND user_id = $2`,
    [plan_id, req.openid]
  );
  if (!r.rows.length) return res.status(404).json({ error: "plan not found" });
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO sessions (id, plan_id, user_id, session_date, notes)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (plan_id, session_date) DO NOTHING`,
    [id, plan_id, req.openid, session_date, notes || ""]
  );
  res.json({ id });
});

app.get("/sessions/:planId", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const r = await pool.query(
    `SELECT s.*, count(sr.id) AS set_count
     FROM sessions s LEFT JOIN set_records sr ON sr.session_id = s.id
     WHERE s.plan_id = $1 AND s.user_id = $2
     GROUP BY s.id ORDER BY s.session_date DESC`,
    [req.params.planId, req.openid]
  );
  res.json(r.rows);
});

// 打卡 / 组记录
app.post("/sessions/:id/sets", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const { exercise_id, set_no, reps, weight, done = true } = req.body;
  const r = await pool.query(
    `SELECT s FROM sessions WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.openid]
  );
  if (!r.rows.length) return res.status(404).json({ error: "session not found" });
  const out = await pool.query(
    `INSERT INTO set_records (session_id, exercise_id, set_no, reps, weight, done)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.params.id, exercise_id, set_no, reps ?? null, weight ?? null, done]
  );
  res.json(out.rows[0]);
});

// 读回某 session 已完成的组（页面刷新恢复用）
app.get("/sessions/:id/sets", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const ok = await pool.query(
    `SELECT s.id FROM sessions s WHERE s.id = $1 AND s.user_id = $2`,
    [req.params.id, req.openid]
  );
  if (!ok.rows.length) return res.status(404).json({ error: "session not found" });
  const r = await pool.query(
    `SELECT exercise_id, set_no, reps, weight, done
     FROM set_records WHERE session_id = $1 AND done`,
    [req.params.id]
  );
  res.json(r.rows);
});

// 完成当天
app.post("/sessions/:id/done", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  await pool.query(
    `UPDATE sessions SET done = true WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.openid]
  );
  res.json({ ok: true });
});

// 拉取某计划某天的应练动作 + 当日组记录（每日页用）
app.get("/plans/:id/day/:dayNo", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const p = await pool.query(
    `SELECT plan_data FROM plans WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.openid]
  );
  if (!p.rows.length) return res.status(404).json({ error: "not found" });
  const days = (p.rows[0].plan_data && p.rows[0].plan_data.days) || [];
  const day = days.find((d) => d.day === Number(req.params.dayNo)) || days[0];
  res.json({ day, rest_seconds: p.rows[0].plan_data.rest_seconds });
});

// ---------- 体重 ----------
app.get("/weight", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const r = await pool.query(
    `SELECT day, weight, note FROM weight_log WHERE user_id = $1 ORDER BY day DESC LIMIT 90`,
    [req.openid]
  );
  res.json(r.rows);
});

app.post("/weight", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const { day, weight, note } = req.body || {};
  if (weight == null || weight <= 0 || weight > 400)
    return res.status(400).json({ error: "bad weight" });
  const d = String(day || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
    return res.status(400).json({ error: "bad day" });
  const r = await pool.query(
    `INSERT INTO weight_log (user_id, day, weight, note)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, day) DO UPDATE SET weight = EXCLUDED.weight, note = EXCLUDED.note
     RETURNING day, weight, note`,
    [req.openid, d, weight, note || ""]
  );
  res.json(r.rows[0]);
});

// ---------- 数据统计（数据分析页） ----------
// 总打卡天数 / 每周打卡（近 8 周）/ 训练量（reps×组、总组数）/ 动作次数 top / 近 7 天趋势 / 目标进度
app.get("/stats", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const u = req.openid;
  const [total, weekly, volume, topEx, week7, weightRow] = await Promise.all([
    // 累计打卡天数
    pool.query(
      `SELECT count(*)::int AS n FROM sessions WHERE user_id = $1 AND done`, [u]
    ),
    // 近 8 周每周打卡天数（周一为起）
    pool.query(
      `SELECT date_trunc('week', session_date) AS wk, count(*)::int AS n
       FROM sessions WHERE user_id = $1 AND done AND session_date >= date_trunc('week', CURRENT_DATE - INTERVAL '56 days')
       GROUP BY 1 ORDER BY 1`, [u]
    ),
    // 累计训练量
    pool.query(
      `SELECT count(*)::int AS sets,
              coalesce(sum(reps),0)::int AS reps,
              count(DISTINCT s.plan_id)::int AS plans_n
       FROM set_records sr JOIN sessions s ON s.id = sr.session_id
       WHERE s.user_id = $1 AND sr.done AND s.session_date >= CURRENT_DATE - INTERVAL '365 days'`, [u]
    ),
    // 常用动作 top5（近 90 天完成的组数）
    pool.query(
      `SELECT sr.exercise_id, e.name, e.name_zh, count(*)::int AS sets
       FROM set_records sr
       JOIN sessions s ON s.id = sr.session_id
       JOIN exercises e ON e.id = sr.exercise_id
       WHERE s.user_id = $1 AND sr.done AND s.session_date >= CURRENT_DATE - INTERVAL '90 days'
       GROUP BY sr.exercise_id, e.name, e.name_zh
       ORDER BY sets DESC LIMIT 5`, [u]
    ),
    // 近 7 天每日完成组数（趋势）
    pool.query(
      `SELECT s.session_date, count(*)::int AS sets
       FROM set_records sr JOIN sessions s ON s.id = sr.session_id
       WHERE s.user_id = $1 AND sr.done AND s.session_date >= CURRENT_DATE - 6
       GROUP BY 1 ORDER BY 1`, [u]
    ),
    // 体重：最近 + 最早（算变化）
    pool.query(
      `SELECT (ARRAY_AGG(weight ORDER BY day DESC))[1]::numeric AS latest,
              min(weight) AS min, max(weight) AS max,
              (ARRAY_AGG(day ORDER BY day DESC))[1] AS latest_day
       FROM weight_log WHERE user_id = $1 AND day >= CURRENT_DATE - INTERVAL '180 days'`, [u]
    ),
  ]);
  // 目标进度：当前计划周训练天数（plan_data.days）对比本周实际打卡
  const pw = await pool.query(
    `SELECT jsonb_array_length(plan_data->'days') FROM plans
     WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`, [u]
  );
  const perWeek = pw.rows[0] && pw.rows[0]["jsonb_array_length"]
    ? Number(pw.rows[0]["jsonb_array_length"])
    : 3;
  const week = new Date();
  const monday = new Date(week);
  monday.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  const thisWeek = await pool.query(
    `SELECT count(*)::int AS n FROM sessions WHERE user_id = $1 AND done AND session_date >= $2`,
    [u, monday.toISOString().slice(0, 10)]
  );
  res.json({
    total_days: total.rows[0].n,
    weekly: weekly.rows, // [{wk, n}] 近 8 周
    volume: volume.rows[0], // {sets, reps, plans_n} 近一年
    top_exercises: topEx.rows, // [{exercise_id, name, name_zh, sets}]
    week7: week7.rows, // [{session_date, sets}]
    weight: weightRow.rows[0], // {latest, min, max, latest_day}
    goal: { per_week: perWeek, this_week: thisWeek.rows[0].n },
  });
});

// ---------- 周复盘 ----------
app.post("/plans/:id/review", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const p = await pool.query(
    `SELECT * FROM plans WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.openid]
  );
  if (!p.rows.length) return res.status(404).json({ error: "not found" });
  const s = await pool.query(
    `SELECT session_date, done FROM sessions
     WHERE plan_id = $1 AND user_id = $2
       AND session_date >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY session_date`,
    [req.params.id, req.openid]
  );
  const sets = await pool.query(
    `SELECT e.name, sr.set_no, sr.reps, sr.weight, sr.done
     FROM set_records sr JOIN sessions ss ON ss.id = sr.session_id
     JOIN exercises e ON e.id = sr.exercise_id
     WHERE ss.plan_id = $1 AND ss.user_id = $2
       AND ss.session_date >= CURRENT_DATE - INTERVAL '7 days'`,
    [req.params.id, req.openid]
  );
  const review = await weeklyReview(p.rows[0], s.rows, sets.rows, req.body || {});
  await pool.query(
    `UPDATE plans SET sup_review = $2 WHERE id = $1`,
    [req.params.id, JSON.stringify(review)]
  );
  res.json({ review });
});

const PORT = process.env.PORT || 4010;
app.listen(PORT, "0.0.0.0", () => console.log("ai-gym-api listening on", PORT));
