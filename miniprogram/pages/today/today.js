// 今日页：当天应练（来自当前计划）+ 组打卡 + 训练量进度 + 快捷入口
const api = require("../../api");
const config = require("../../config");
const exdict = require("../../exdict");
const theme = require("../../theme");
const i18n = require("../../i18n");
const user = require("../../user");

// 部位标签中→英（en 模式）
const FOCUS_EN = {
  胸: "Chest", 背: "Back", 腿: "Legs", 肩: "Shoulders",
  手臂: "Arms", 臂: "Arms", 核心: "Core", 臀: "Glutes", 全身: "Full Body",
};
function focusEn(v) {
  const s = String(v || "");
  const hit = Object.keys(FOCUS_EN).find((k) => s.indexOf(k) >= 0);
  return hit ? s.replace(hit, FOCUS_EN[hit]) : s;
}

function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

// "eid:sno" 列表 → { "eid:sno": true }
function toObj(list) {
  const o = {};
  list.forEach((k) => (o[k] = true));
  return o;
}

Page({
  data: {
    today: todayStr(),
    loading: true,
    planErr: false, // 加载出错诊断条
    dayLabel: "",
    planTitle: "",
    planGoal: "",
    exercises: [],
    doneSets: {},
    session: null,
    allDone: false,
    // 进度：本周应练 X 天 / 已打卡 n 天；近 7 天组数
    weekGoal: 0,
    weekDone: 0,
    weekPct: 0,
    sets7: 0,
    stats: null,
    // 首页卡：预计训练量 / 恢复状态环 / AI 教练一句话（可解释规则，非模型）
    estMin: 0,
    totalSets: 0,
    totalEx: 0,
    recover: 0, // 0-100 恢复状态估算
    recoverLb: "",
    coachTip: "",
    coachTipKey: "", // 用于 i18n 兜底渲染
    restDay: false, // 今天不是训练日 → 给「轻活动」建议而不是"别练"
    lastSets: {}, // { exId: { weight, reps, last_date } } 上次重量预填
    rpe: {}, // { "eid:sno": 6-10 } 组 RPE 快选
    rpeOpen: "", // "eid:sno" 正在展开 RPE 快选
    playVid: {}, // { exId: true } 点按后才起该动作视频（多路 mp4 自动播放会拖死首屏）
  },

  onShow() {
    if (typeof this.getTabBar === "function") this.getTabBar().setData({ selected: 0 });
    theme.sync(this);
    i18n.sync(this);
    // 跟随系统：系统主题翻转时重跑 sync，页面 class 立即跟上
    if (!this._offTheme) this._offTheme = theme.onThemeChange(() => theme.sync(this));
    if (!this._offLang) this._offLang = i18n.onChange(() => { i18n.sync(this); this.reload(); });
    exdict.load(() => this.reloadNames());
    this.load();
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  // 加载失败/无计划时：下拉重拉
  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  // 后台字典到位后按当前语言补动作名
  reloadNames() {
    const en = this.data.lang === "en";
    if (!this.data.exercises.length) return;
    this.setData({
      exercises: this.data.exercises.map((ex) => ({
        ...ex,
        name_zh: en ? exdict.nameEn(ex.id) || ex.name : exdict.nameZh(ex.id) || ex.name,
      })),
    });
  },

  reload() {
    const lang = this.data.lang;
    const p = this.data.planRaw;
    if (!p) return;
    const lp = this.locPlan(p, lang);
    const day = ((lp.plan_data || {}).days || []).find((d) => d.day === this._dayNo) || {};
    this.setData({
      planRaw: lp,
      dayLabel: day.label || "",
      planTitle: lp.title || "",
      planGoal: (lp.plan_data || {}).goal || "",
    });
  },

  async load() {
    this._reqId = (this._reqId || 0) + 1;
    const rid = this._reqId;
    // 懒加载：先出当天动作（本地缓存/静态兜底），统计/打卡后到
    this.setData({ loading: true, planErr: false });

    // 1. 计划主体（本地缓存优先，无缓存走服务端）
    let plan = wx.getStorageSync("cachedPlan");
    let planId = wx.getStorageSync("currentPlanId");
    // 早期落盘的缓存可能缺 id（旧版 generate 没写 id）→ 视为无效，走服务端
    if (plan && !plan.id) {
      plan = null;
      wx.removeStorageSync("cachedPlan");
    }
    if (plan && plan.id && (planId ? plan.id === planId : true)) {
      planId = plan.id;
    }
    if (!planId) {
      try {
        const plans = await api.plans();
        const cur = plans.find((p) => p.id === planId) || plans[0];
        if (cur) {
          plan = await api.plan(cur.id).catch(() => null);
          planId = cur.id;
          if (plan) {
            wx.setStorageSync("cachedPlan", plan);
            wx.setStorageSync("currentPlanId", planId);
          }
        }
      } catch (e) {
        console.error("plans:", e);
      }
    }
    if (rid !== this._reqId) return; // 页面已重载，丢弃本次结果

    if (!plan) {
      wx.removeStorageSync("cachedPlan");
      wx.removeStorageSync("currentPlanId");
      this.setData({ loading: false, planRaw: null, planErr: true });
      return;
    }

    // 2. 立刻把当天动作铺出来（骨架屏 → 内容），不等统计
    const lp = this.locPlan(plan, this.data.lang);
    const days = (lp.plan_data || {}).days || [];
    const dayNo = (new Date().getDay() + 6) % 7 + 1; // 周一=1
    this._dayNo = dayNo;
    let idx = days.findIndex((d) => d.day === dayNo);
    const realIdx = idx;
    if (idx < 0) idx = 0;
    const day = days[idx] || {};
    const restDay = realIdx < 0 && dayNo > 0 && !(day && day.exercises && day.exercises.length);

    const en = this.data.lang === "en";
    const exName = (x) =>
      en ? exdict.nameEn(x.id) || x.name : exdict.nameZh(x.id) || x.name;
    const exercises = ((day.exercises) || []).map((ex) => ({
      ...ex,
      name_zh: exName(ex),
      img_url: config.mediaStill(ex.id),
      clip_url: config.mediaClip(ex.id),
      faved: user.isFavEx(ex.id),
      setStates: ex.sets.map(() => false), // 打卡状态由下面并行请求回填
      last: null, // 由 stats 回填
    }));
    const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const restAvg = ((lp.plan_data || {}).rest_seconds) || 90;
    const estMin = Math.round((totalSets * (40 + restAvg)) / 60 + totalSets * 0.2);

    this.setData({
      planRaw: lp,
      dayLabel: day.label || "",
      planTitle: lp.title || "",
      planGoal: (lp.plan_data || {}).goal || "",
      exercises,
      totalSets,
      totalEx: exercises.length,
      estMin,
      restDay,
      loading: false, // 主体已出，统计后到
    });

    // 3. 统计 + 打卡记录并行拉（慢也不挡主体）
    let sessionId = null;
    let doneSets = {};
    let stats = null;
    const [sessRes, statsRes] = await Promise.all([
      (async () => {
        try {
          const sess = await api.sessions(plan.id);
          const found = (Array.isArray(sess) ? sess : []).find((s) => s.session_date === this.data.today);
          if (found) {
            sessionId = found.id;
            if (found.done) this._dayDone = true;
          } else {
            const created = await api.createSession({ plan_id: plan.id, session_date: this.data.today });
            sessionId = created && created.id ? created.id : null;
          }
          if (sessionId) {
            const rows = await api.sessionSets(sessionId);
            doneSets = toObj(rows.map((r) => r.exercise_id + ":" + r.set_no));
          }
        } catch (e) {
          console.error("sessions:", e);
        }
      })(),
      api.stats().catch(() => null),
    ]);
    stats = statsRes;
    if (rid !== this._reqId) return;

    // 4. 回填：打卡状态 / 上次重量 / 周进度 / 恢复环 / 教练一句话
    const exercises2 = this.data.exercises.map((ex, i) => {
      const orig = exercises[i];
      return {
        ...orig,
        setStates: orig.sets.map((_, si) => doneSets[orig.id + ":" + (si + 1)] || false),
        last: (stats && stats.last_sets || []).find((x) => String(x.exercise_id) === String(orig.id)) || null,
      };
    });
    const weekGoal = stats && stats.goal ? stats.goal.per_week : 0;
    const weekDone = stats && stats.goal ? stats.goal.this_week : 0;
    const sets7 = (stats && stats.week7 || []).reduce((n, x) => n + Number(x.sets || 0), 0);
    const weekTarget = Math.max(weekGoal || 3, 3);
    const loadRecent = Math.min(1.5, sets7 / (weekTarget * 8 || 8));
    const recover = Math.round(100 - Math.min(100, loadRecent * 60 - Math.min(weekDone, weekTarget) * 5));
    const recoverLb = recover >= 80 ? "good" : recover >= 55 ? "mid" : "low";

    let coachTip = "";
    let coachTipKey = "";
    if (restDay) {
      coachTipKey = "coach_rest";
    } else if (recover < 55 && totalSets > 0) {
      coachTipKey = "coach_low_rec";
      coachTip = en
        ? "You've trained hard lately - drop the last exercise to optional and keep rests short."
        : "最近训练量大，最后一个动作可改选做，间歇保持 60s 内。";
    } else if (sets7 === 0 && totalSets > 0) {
      coachTipKey = "coach_streak";
    } else if (totalSets > 0) {
      coachTipKey = "coach_ready";
    }

    this.setData({
      exercises: exercises2,
      doneSets,
      session: sessionId,
      allDone: totalSets > 0 && Object.keys(doneSets).length >= totalSets,
      weekGoal,
      weekDone,
      weekPct: weekGoal ? Math.min(100, Math.round((weekDone / weekGoal) * 100)) : 0,
      sets7,
      recover,
      recoverLb,
      coachTip,
      coachTipKey,
      lastSets: ((stats && stats.last_sets) || []).reduce((o, x) => { o[x.exercise_id] = x; return o; }, {}),
    });
  },

  // en 模式把计划文案换成 *_en（缺省回退原值）
  locPlan(full, lang) {
    if (!full || lang !== "en") return full;
    const c = JSON.parse(JSON.stringify(full));
    c.title = full.title_en || full.title;
    const d = c.plan_data || {};
    d.goal = full.goal_en || full.goal;
    d.summary = full.summary_en || d.summary;
    if ((full.plan_data && full.plan_data.tips_en || []).length) d.tips = full.plan_data.tips_en;
    (d.days || []).forEach((day) => {
      day.label = day.label_en || day.label;
      day.focus = (day.focus || []).map(focusEn);
      (day.exercises || []).forEach((ex) => { if (ex.note_en) ex.note = ex.note_en; });
    });
    return c;
  },

  toggleSet(e) {
    const { exidx, setidx } = e.currentTarget.dataset;
    const exList = this.data.exercises;
    const ex = exList[exidx];
    const sno = Number(setidx) + 1;
    const key = ex.id + ":" + sno;
    const done = { ...this.data.doneSets };
    if (done[key]) {
      delete done[key];
    } else {
      done[key] = true;
      const sid = this.data.session;
      if (sid) api.recordSet(sid, { exercise_id: ex.id, set_no: sno, done: true }).catch(() => {});
      // 组间休息：同页内显示倒计时
      if (sno < ex.sets.length) {
        const rest = (ex.sets[setidx] && ex.sets[setidx].rest_seconds) || 90;
        this.startRest(rest);
      }
    }
    exList[exidx] = { ...ex, setStates: ex.setStates.map((s, i) => (i === setidx ? !!done[key] : s)) };
    const allDone = this.data.totalSets > 0 && Object.keys(done).length >= this.data.totalSets;
    this.setData({ exercises: exList, doneSets: done, allDone });
  },

  startRest(seconds) {
    if (this.timer) clearInterval(this.timer);
    this.setData({ restLeft: seconds, restTotal: seconds });
    this.timer = setInterval(() => {
      const left = this.data.restLeft - 1;
      this.setData({ restLeft: Math.max(0, left) });
      if (left <= 0) {
        clearInterval(this.timer);
        this.timer = null;
        wx.vibrateShort({ type: "medium" });
      }
    }, 1000);
  },

  // 全部完成 → 打卡
  async markAllDone() {
    const id = this.data.session;
    if (!id) return;
    await api.markDone(id).catch(() => {});
    this._dayDone = true;
    this.setData({ allDone: true });
    wx.showToast({ title: this.data.lang === "en" ? "Check-in done" : "今日打卡成功", icon: "success" });
    // 刷新本周完成数
    const s = await api.stats().catch(() => null);
    if (s) {
      this.setData({
        weekDone: s.goal.this_week,
        weekPct: s.goal.per_week ? Math.min(100, Math.round((s.goal.this_week / s.goal.per_week) * 100)) : 0,
      });
    }
  },

  // 动作卡上的收藏入口（本地）
  toggleExFav(e) {
    const ex = e.currentTarget.dataset.ex;
    if (!ex) return;
    user.toggleFavEx(ex.id);
    this.setData({
      exercises: this.data.exercises.map((x) => (x.id === ex.id ? { ...x, faved: user.isFavEx(ex.id) } : x)),
    });
    wx.vibrateShort({ type: "light" });
  },

  // RPE 快选：打勾后的组点 RPE 数字记录（6-10），再点取消
  toggleRpePicker(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ rpeOpen: this.data.rpeOpen === key ? "" : key });
  },
  pickRpe(e) {
    const { key, v } = e.currentTarget.dataset;
    const [exId, sno] = key.split(":");
    const rpe = { ...this.data.rpe };
    if (rpe[key] === Number(v)) delete rpe[key];
    else rpe[key] = Number(v);
    this.setData({ rpe, rpeOpen: rpe[key] ? key : "" });
    const sid = this.data.session;
    if (sid && rpe[key]) api.recordSet(sid, { exercise_id: exId, set_no: Number(sno), rpe: rpe[key] }).catch(() => {});
  },

  // 点按动作卡静态图 → 起该动作视频
  playVidTap(e) {
    const id = e.currentTarget.dataset.ex;
    if (!id) return;
    this.setData({ playVid: Object.assign({}, this.data.playVid, { [id]: true }) });
  },

  // 快捷入口
  goPlan() { wx.switchTab({ url: "/pages/plan/plan" }); },
  goDaily() { wx.switchTab({ url: "/pages/daily/daily" }); },
  goExercises() { wx.switchTab({ url: "/pages/exercises/exercises" }); },
  goStats() { wx.switchTab({ url: "/pages/stats/stats" }); }, // stats 是 tab 页
});
