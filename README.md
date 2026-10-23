# AI 健身教练 微信小程序

基于 openGym 动作库（5632 个动作）+ Claude 定制训练计划。

## 架构

```
微信小程序 (miniprogram/)
    ↓ HTTPS (需公网域名)
Node.js API (api/, 容器 ai-gym-api, :4010)
    ├── Postgres 库 ai_gym（容器 ai-gym-db, 已导入 5632 动作）
    └── Anthropic API（CLAUDE_API_KEY 配在 ~/ai-gym/api/.env）
```

部署位置：207.211.161.100:~/ai-gym（api/ 是 compose 项目，db 和 api 两个容器）
动作库来源：/tmp/openGym-slim.json（openGym EXDB 精简版，已导入两个库：
Supabase 实例里的 ai_gym 库 + ai-gym-db 容器里的 ai_gym 库，两处数据一致）

## 数据模型

- users(openid)
- exercises(id, name, muscle, muscles[], equipment, target, cat, bodypart)
- plans(id, user_id, title, goal, plan_data JSONB, version, sup_review JSONB)
  - plan_data: { title, summary, rest_seconds, days:[{day,label,focus,exercises:[{id,name,sets:[{reps,rest_seconds,weight_note}],note}]}], weekly_goals, tips }
- sessions(id, plan_id, user_id, session_date, done, notes) UNIQUE(plan_id, session_date)
- set_records(id, session_id, exercise_id, set_no, reps, weight, done)

## API

鉴权：X-Openid 头（MVP，正式接 wx.login 换 code → 后端 code2session）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /exercises?q=&muscle=&equipment=&cat=&limit= | 动作搜索 |
| GET | /plans | 我的计划列表 |
| GET | /plans/:id | 计划详情（含 sup_review） |
| POST | /plans/generate | body: goal/level/days_per_week/time_per_session/equipment/focus[]/notes → AI 生成 |
| POST | /plans/:id/revise | body: { adjustments: [...] } → AI 修改，version+1 |
| POST | /plans/:id/review | 周复盘，结果存 sup_review |
| GET | /plans/:id/day/:dayNo | 某天应练动作 |
| POST | /sessions | { plan_id, session_date } 建当天 |
| GET | /sessions/:planId | 会话列表 |
| GET | /sessions/:id/sets | 已完成组（恢复用） |
| POST | /sessions/:id/sets | { exercise_id, set_no, reps?, weight?, done } |
| POST | /sessions/:id/done | 打卡 |

## 小程序

- pages/form：需求表单（目标/水平/频次/时长/器材/重点肌群/备注）→ 生成计划
- pages/plan：计划查看（按天展开）+ AI 调整 + 周复盘面板（可采纳 next_plan_adjustment）
- pages/daily：今天该练什么，逐组勾选，组间休息倒计时（完成一组自动计时），全部完成打卡
- pages/exercises：动作库搜索（肌肉群筛选）

开发：微信开发者工具导入 miniprogram/ 目录，改 config.js 的 BASE 指向本机调试地址。
正式上线需要：
1. API 挂公网 HTTPS 域名（可加到 openship edge，参照 poetry/supabase legacy vhost 模式）
2. wx.login 换 openid 的真登录（现在是 dev- 前缀占位）
3. 小程序后台配置 request 合法域名

## 已知限制

- 每日页按「今天周几 = 计划的 day 编号」匹配，计划里如果某天是休息日会回退到第一天，
  后续可在 form 里让用户选每周具体哪几天练（当前只选了次数）。
