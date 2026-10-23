-- ai_gym 数据库 schema（在 ai_gym 库里执行）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- wechat openid
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,              -- openGym id
  name TEXT NOT NULL,
  muscle TEXT NOT NULL DEFAULT '',
  muscles TEXT[] NOT NULL DEFAULT '{}',
  equipment TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '',
  cat TEXT NOT NULL DEFAULT '',
  bodypart TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ex_muscle ON exercises(muscle);
CREATE INDEX IF NOT EXISTS idx_ex_cat ON exercises(cat);
CREATE INDEX IF NOT EXISTS idx_ex_equip ON exercises(equipment);

-- 计划：由 AI 生成，plan_data 存 JSONB（日程/动作/组数等）
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,             -- uuid
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  plan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',   -- active / archived
  version INT NOT NULL DEFAULT 1,
  sup_review JSONB,               -- 最近一次周复盘建议
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);

-- 训练会话：每天一条
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,             -- uuid
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, session_date);

-- 每个组记录：exercise_id + 组序号 + 次数/重量/完成
CREATE TABLE IF NOT EXISTS set_records (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  set_no INT NOT NULL DEFAULT 1,
  reps INT,
  weight FLOAT,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sets_session ON set_records(session_id);
