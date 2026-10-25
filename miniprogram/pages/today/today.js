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
  },

  onShow() {
    if (typeof this.getTabBar === "function") this.getTabBar().setData({ selected: 1 });
    theme.sync(this);
    i18n.sync(this);
    if (!this._offLang) this._offLang = i18n.onChange(() => { i18n.sync(this); this.reload(); });
    exdict.load(() => this.reloadNames());
    this.load();
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
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
    this.setData({ loading: true });
    // 计划主体走本地缓存（生成后即落盘），打卡记录走服务器
    let plan = wx.getStorageSync("cachedPlan");
    const planId = wx.getStorageSync("currentPlanId");
    if (plan && plan.id && (planId ? plan.id === planId : true)) {
      planId = plan.id;
    }
    if (!planId) {
      const plans = await api.plans().catch(() => []);
      const cur = plans.find((p) => p.id === planId) || plans[0];
      if (cur) {
        plan = await api.plan(cur.id).catch(() => null);
        planId = cur.id;
        if (plan) {
          wx.setStorageSync("cachedPlan", plan);
          wx.setStorageSync("currentPlanId", planId);
        }
      }
    }
    if (!plan) {
      this.setData({ loading: false, planRaw: null });
      return;
    }
    try {
      const lp = this.locPlan(plan, this.data.lang);
      const days = (lp.plan_data || {}).days || [];
      const dayNo = (new Date().getDay() + 6) % 7 + 1; // 周一=1
      this._dayNo = dayNo;
      let idx = days.findIndex((d) => d.day === dayNo);
      if (idx < 0) idx = 0;
      const day = days[idx] || {};

      // 打卡（依赖服务器，失败不影响展示）
      let sessionId = null;
      let doneSets = {};
      try {
        const sess = await api.sessions(plan.id).catch(() => []);
        const found = (Array.isArray(sess) ? sess : []).find((s) => s.session_date === this.data.today);
        if (found) {
          sessionId = found.id;
          if (found.done) this._dayDone = true;
        } else {
          const created = await api.createSession({ plan_id: plan.id, session_date: this.data.today }).catch(() => null);
          sessionId = created && created.id ? created.id : null;
        }
        if (sessionId) {
          const rows = await api.sessionSets(sessionId).catch(() => []);
          doneSets = toObj(rows.map((r) => r.exercise_id + ":" + r.set_no));
        }
      } catch (e) {
        console.error("sessions:", e);
      }

      const en = this.data.lang === "en";
      const exName = (x) =>
        en ? exdict.nameEn(x.id) || x.name : exdict.nameZh(x.id) || x.name;
      const exercises = ((day.exercises) || []).map((ex) => ({
        ...ex,
        name_zh: exName(ex),
        img_url: config.mediaStill(ex.id),
        clip_url: config.mediaClip(ex.id),
        faved: user.isFavEx(ex.id),
        setStates: ex.sets.map((_, i) => doneSets[ex.id + ":" + (i + 1)] || false),
      }));
      const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);

      // 本周进度 + 近 7 天组数（后台拉，失败降级）
      let stats = null;
      try {
        stats = await api.stats().catch(() => null);
      } catch (e) { /* 降级 */ }
      const weekGoal = stats && stats.goal ? stats.goal.per_week : 0;
      const weekDone = stats && stats.goal ? stats.goal.this_week : 0;
      const sets7 = (stats && stats.week7 || []).reduce((n, x) => n + Number(x.sets || 0), 0);

      this.setData({
        planRaw: lp,
        dayLabel: day.label || "",
        planTitle: lp.title || "",
        planGoal: (lp.plan_data || {}).goal || "",
        exercises,
        totalSets,
        session: sessionId,
        doneSets,
        allDone: totalSets > 0 && Object.keys(doneSets).length >= totalSets,
        weekGoal,
        weekDone,
        weekPct: weekGoal ? Math.min(100, Math.round((weekDone / weekGoal) * 100)) : 0,
        sets7,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
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

  // 快捷入口
  goPlan() { wx.switchTab({ url: "/pages/plan/plan" }); },
  goDaily() { wx.switchTab({ url: "/pages/daily/daily" }); },
  goExercises() { wx.switchTab({ url: "/pages/exercises/exercises" }); },
  goStats() { wx.navigateTo({ url: "/pages/stats/stats" }); },
});
