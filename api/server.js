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

// 动作名中文化：openGym 是英文库，用组合翻译器（命名片段词典）翻成中文，
// 翻不出有效词就 fallback 英文原名（前端 name_zh 恒有值）。
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

// ---------- 鉴权：微信 openid 由小程序端登录换取后传入 ----------
// MVP：X-Openid 头。后续可换成 JWT。
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
app.get("/exercises", async (req, res) => {
  const { q, muscle, equipment, cat, limit = 50, offset = 0 } = req.query;
  const where = [];
  const args = [];
  if (q) {
    args.push(`%${q}%`);
    where.push(`(name ILIKE $${args.length} OR muscle ILIKE $${args.length})`);
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
  // 补中文显示名 + 图片/动画 URL（由 id 推导，openGym 约定 {id}.webp / {id}.mp4）
  res.json(
    r.rows.map((x) => ({
      ...x,
      name_zh: zhName(x.name),
      img_url: `${base}/media/still/${x.id}.webp`,
      clip_url: `${base}/media/clip/${x.id}.mp4`,
    }))
  );
});

// ---------- 计划 ----------
app.get("/plans", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const r = await pool.query(
    `SELECT id, title, goal, status, version, created_at, updated_at,
            plan_data->'days' AS days
     FROM plans WHERE user_id = $1 ORDER BY updated_at DESC`,
    [req.openid]
  );
  res.json(r.rows);
});

app.get("/plans/:id", reqOpenid, async (req, res) => {
  await ensureUser(req.openid);
  const r = await pool.query(
    `SELECT * FROM plans WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.openid]
  );
  if (!r.rows.length) return res.status(404).json({ error: "not found" });
  res.json(r.rows[0]);
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
