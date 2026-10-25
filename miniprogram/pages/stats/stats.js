// 数据分析页：打卡/训练量/常用动作/近 7 天趋势/体重记录（可录入）
const api = require("../../api");
const theme = require("../../theme");
const i18n = require("../../i18n");
const exdict = require("../../exdict");

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

// 8 个周起点（date_trunc week = 周一）
function last8Weeks() {
  const out = [];
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  for (let i = 7; i >= 0; i--) {
    const d = new Date(mon);
    d.setDate(mon.getDate() - i * 7);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

Page({
  data: {
    loading: true,
    s: null,
    // 周柱状：[{week, n, pct}]
    weeks: [],
    maxWeek: 0,
    // 近 7 天趋势
    week7Max: 0,
    // 体重
    weights: [], // [{day, weight}]
    weightLatest: "",
    weightDelta: "",
    weightDeltaPct: "",
    weightInput: "",
    saving: false,
  },

  onShow() {
    theme.sync(this);
    i18n.sync(this);
    exdict.load(() => this.refreshExNames());
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const [s, weights] = await Promise.all([api.stats().catch(() => null), api.weight().catch(() => [])]);
      if (s) this.renderStats(s);
      this.renderWeights(Array.isArray(weights) ? weights : []);
      this.setData({ loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: "failed", icon: "none" });
    }
  },

  renderStats(s) {
    const en = this.data.lang === "en";
    const weeksBase = last8Weeks();
    const byWk = {};
    (s.weekly || []).forEach((w) => { byWk[w.wk && w.wk.slice(0, 10)] = w.n; });
    const perWeek = s.goal ? s.goal.per_week : 3;
    const maxWeek = Math.max(perWeek, 1);
    const weeks = weeksBase.map((d) => {
      const n = byWk[d] || 0;
      return { week: d.slice(5), n, pct: Math.round((n / maxWeek) * 100) };
    });
    const week7 = (s.week7 || []).map((x) => ({ d: x.session_date.slice(5), sets: Number(x.sets || 0) }));
    const week7Max = Math.max(1, ...week7.map((x) => x.sets));
    const top = (s.top_exercises || []).map((x) => ({
      ...x,
      disp: en ? x.name : exdict.nameZh(x.exercise_id) || x.name_zh || x.name,
    }));
    this.setData({ s, weeks, maxWeek, week7Max, topExercises: top });
  },

  // 后台字典到位后刷新常用动作名
  refreshExNames() {
    if (!this.data.topExercises) return;
    const en = this.data.lang === "en";
    this.setData({
      topExercises: this.data.topExercises.map((x) => ({
        ...x,
        disp: en ? x.name : exdict.nameZh(x.exercise_id) || x.name_zh || x.name,
      })),
    });
  },

  renderWeights(rows) {
    // 服务端倒序（新→旧），转成正序画图
    const asc = [...rows].reverse();
    if (asc.length < 2) {
      this.setData({
        weights: asc,
        weightLatest: asc.length ? String(asc[asc.length - 1].weight) : "",
        weightDelta: "",
        weightDeltaPct: "",
      });
      return;
    }
    const first = Number(asc[0].weight);
    const last = Number(asc[asc.length - 1].weight);
    const delta = Math.round((last - first) * 100) / 100;
    const pct = Math.round((delta / first) * 1000) / 10;
    this.setData({
      weights: asc,
      weightLatest: String(last),
      weightDelta: (delta > 0 ? "+" : "") + delta,
      weightDeltaPct: pct + "%",
    });
  },

  onWeightInput(e) {
    this.setData({ weightInput: e.detail.value });
  },

  async saveWeight() {
    const v = parseFloat(this.data.weightInput);
    if (!v || v <= 0) {
      wx.showToast({ title: this.data.lang === "en" ? "Enter a valid weight" : "输入有效体重", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    try {
      await api.weightAdd({ day: todayStr(), weight: v });
      wx.showToast({ title: this.data.lang === "en" ? "Saved" : "已记录", icon: "success" });
      this.setData({ weightInput: "" });
      this.renderWeights((await api.weight().catch(() => [])) || []);
    } catch (e) {
      wx.showToast({ title: this.data.lang === "en" ? "Save failed" : "保存失败", icon: "none" });
    }
    this.setData({ saving: false });
  },

  goPlan() { wx.switchTab({ url: "/pages/plan/plan" }); },
});
