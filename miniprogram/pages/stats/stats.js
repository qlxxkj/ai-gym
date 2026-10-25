// 数据分析页：1RM 曲线 + 肌群雷达图 + 周热力图 + 体重（可录入 + 目标线）
const api = require("../../api");
const theme = require("../../theme");
const i18n = require("../../i18n");
const exdict = require("../../exdict");
const bodymap = require("./bodymap");

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

// 把 [{wk, rm1, name}] 扁平化为按 exercise_id 分组的 {ex: {name, pts: [{x, y}]}}
// 返回 top N 条动作（按最新 1RM 排序）供页面渲染
function build1RM(raw, maxLines) {
  const byEx = {};
  (raw || []).forEach((row) => {
    const key = row.exercise_id || row.id;
    if (!byEx[key]) byEx[key] = { name: row.name_zh || row.name || key, pts: [] };
    byEx[key].pts.push({
      x: row.wk ? String(row.wk).slice(5) : "",
      y: Number(row.rm1 || 0),
    });
  });
  const list = Object.entries(byEx).sort(
    (a, b) => (b[1].pts[b[1].pts.length - 1]?.y || 0) - (a[1].pts[a[1].pts.length - 1]?.y || 0)
  );
  return list.slice(0, maxLines || 4).map(([id, v]) => ({ id, name: v.name, pts: v.pts }));
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
    weights: [],
    weightLatest: "",
    weightDelta: "",
    weightDeltaPct: "",
    weightInput: "",
    saving: false,
    // 体重目标
    weightTarget: "",
    weightTargetDiff: "",
    weightTargetDiffPct: "",
    // 1RM：[{id, name, pts: [{x, y}]}]
    oneRm: [],
    rmMaxY: 1,
    rmColors: ["#00E08A", "#8B7CF6", "#FFB020", "#F09286"],
    // 肌群地图
    bodyMapUrl: "",
    // 雷达图：[{key, lb, sets, pct, angleDeg, top, left}]
    radar: [],
    // 热力图：[{week, sets, pct}]
    heatmap: [],
  },

  onShow() {
    if (typeof this.getTabBar === "function") this.getTabBar().setData({ selected: 3 });
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
      const [s, weights, oneRmRaw, radarRaw, heatRaw] = await Promise.all([
        api.stats().catch(() => null),
        api.weight().catch(() => []),
        api.stats1rm().catch(() => []),
        api.statsRadar().catch(() => []),
        api.statsHeat().catch(() => []),
      ]);
      if (s) this.renderStats(s);
      this.renderWeights(Array.isArray(weights) ? weights : []);
      this.render1RM(oneRmRaw);
      this.renderRadar(radarRaw);
      this.renderHeat(heatRaw);
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
    (s.weekly || []).forEach((w) => { byWk[w.wk && String(w.wk).slice(0, 10)] = w.n; });
    const perWeek = s.goal ? s.goal.per_week : 3;
    const maxWeek = Math.max(perWeek, 1);
    const weeks = weeksBase.map((d) => {
      const n = byWk[d] || 0;
      return { week: d.slice(5), n, pct: Math.round((n / maxWeek) * 100) };
    });
    const week7 = (s.week7 || []).map((x) => ({ d: String(x.session_date).slice(5), sets: Number(x.sets || 0) }));
    const week7Max = Math.max(1, ...week7.map((x) => x.sets));
    const top = (s.top_exercises || []).map((x) => ({
      ...x,
      disp: en ? x.name : exdict.nameZh(x.exercise_id) || x.name_zh || x.name,
    }));
    this.setData({ s, weeks, maxWeek, week7Max, topExercises: top });
  },

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

  // 1RM 曲线（SVG polyline，按条线展示 top 4 动作）
  render1RM(raw) {
    const list = build1RM(raw, 4);
    let maxY = 0;
    list.forEach((l) => l.pts.forEach((p) => { if (p.y > maxY) maxY = p.y; }));
    this.setData({ oneRm: list, rmMaxY: maxY });
  },

  // 肌群雷达图（6 个主要部位）
  renderRadar(raw) {
    const MUSCLES = ["quadriceps", "chest", "upper back", "shoulders", "biceps", "core"];
    const labels = {
      zh: { quadriceps: "腿", chest: "胸", "upper back": "背", shoulders: "肩", biceps: "臂", core: "核心" },
      en: { quadriceps: "Legs", chest: "Chest", "upper back": "Back", shoulders: "Shoulders", biceps: "Arms", core: "Core" },
    };
    const en = this.data.lang === "en";
    const byMuscle = {};
    (raw || []).forEach((x) => { byMuscle[x.muscle] = Number(x.sets || 0); });
    const maxSets = Math.max(1, ...MUSCLES.map((m) => byMuscle[m] || 0));
    const N = MUSCLES.length;
    const radar = MUSCLES.map((m, i) => {
      const angle = i * (360 / N) - 90;
      const rad = (angle * Math.PI) / 180;
      const sets = byMuscle[m] || 0;
      const pct = Math.round((sets / maxSets) * 100);
      return {
        key: m,
        lb: labels[en ? "en" : "zh"][m] || m,
        sets,
        pct,
        angleDeg: angle,
        top: 50 + 48 * Math.sin(rad),
        left: 50 + 48 * Math.cos(rad),
      };
    });
    // 同时生成肌群地图（人体轮廓）
    const t = this.data.theme || "ai";
    const url = bodymap.buildBodyMap(radar, t);
    this.setData({ radar, bodyMapUrl: url });
  },

  // 周热力图（近 26 周）
  renderHeat(raw) {
    const byWk = {};
    (raw || []).forEach((x) => { byWk[String(x.week).slice(0, 10)] = Number(x.sets || 0); });
    const maxSets = Math.max(1, ...Object.values(byWk));
    const now = new Date();
    const cells = [];
    for (let i = 25; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7 - ((now.getDay() + 6) % 7));
      const key = d.toISOString().slice(0, 10);
      const sets = byWk[key] || 0;
      cells.push({ key, sets, pct: Math.round((sets / maxSets) * 100) });
    }
    this.setData({ heatmap: cells });
  },

  onWeightInput(e) {
    this.setData({ weightInput: e.detail.value });
  },

  onWeightTargetInput(e) {
    this.setData({ weightTarget: e.detail.value });
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

  saveWeightTarget() {
    const t = parseFloat(this.data.weightTarget);
    if (t && t > 0 && this.data.weightLatest) {
      const diff = Math.round((t - Number(this.data.weightLatest)) * 100) / 100;
      const pct = Math.round((diff / Number(this.data.weightLatest)) * 1000) / 10;
      this.setData({
        weightTargetDiff: (diff > 0 ? "+" : "") + diff + " kg",
        weightTargetDiffPct: pct + "%",
      });
    }
  },
});
