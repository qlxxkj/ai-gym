const api = require("../../api");
const theme = require("../../theme");
const i18n = require("../../i18n");

// 前端用中文展示，但 openGym 动作库的 equipment/muscle 字段是英文。
// 提交前把中文映射成 DB 里的英文值，否则 ILIKE 匹配不到素材 → 计划空。
const EQUIP_EN = {
  自重: "body weight",
  哑铃: "dumbbell",
  杠铃: "barbell",
  器械: "leverage machine",
  弹力带: "band",
};
const MUSCLE_EN = {
  胸: "chest",
  背: "upper back",
  腿: "quadriceps",
  肩: "shoulders",
  手臂: "biceps",
  核心: "core",
  臀: "glutes",
};

const GOALS = ["增肌", "减脂", "力量", "体能", "塑形"];
const LEVELS = ["新手", "中级", "进阶"];
const FREQS = [1, 2, 3, 4, 5, 6];
const TIMES = [30, 45, 60, 90];
const EQUIPS = ["自重", "哑铃", "杠铃", "器械", "弹力带"];
const FOCUS = ["胸", "背", "腿", "肩", "手臂", "核心", "臀"];

// 分组结构：label/values/active(单选)/checked(多选) 由 onShow 按当前语言生成，
// 保证切语言后分组标题和选项一起刷新
function secs(T, d) {
  return [
    { id: "goal", label: T.form_goal, kind: "single", field: "goalIndex", values: GOALS, active: d.goalIndex },
    { id: "level", label: T.form_level, kind: "single", field: "levelIndex", values: LEVELS, active: d.levelIndex },
    {
      id: "freq", label: T.form_freq, kind: "single", field: "freqIndex",
      values: FREQS.map((n) => String(n) + " " + T.form_times_u),
      active: d.freqIndex,
    },
    {
      id: "time", label: T.form_time, kind: "single", field: "timeIndex",
      values: TIMES.map((n) => String(n) + " " + T.form_time_u),
      active: d.timeIndex,
    },
    { id: "equip", label: T.form_equip, kind: "single", field: "equipIndex", values: EQUIPS, active: d.equipIndex },
    {
      id: "focus", label: T.form_focus, kind: "multi", field: "focusChecked",
      values: FOCUS, checked: d.focusChecked,
    },
  ];
}

Page({
  data: {
    goalIndex: 0,
    levelIndex: 0,
    freqIndex: 2,
    timeIndex: 1,
    equipIndex: 0,
    focusChecked: {},
    notes: "",
    generating: false,
    secs: [],
  },

  onShow() {
    theme.sync(this);
    i18n.sync(this, { secs: secs(this.data.T || {}, this.data) });
    // 切语言：广播回来时重建分组（保留当前选中项）
    if (!this._offLang) this._offLang = i18n.onChange(() => i18n.sync(this, { secs: secs(this.data.T || {}, this.data) }));
  },

  pick(e) {
    const { field, i } = e.currentTarget.dataset;
    const patch = {};
    patch[field] = Number(i);
    patch.secs = secs(this.data.T || {}, { ...this.data, [field]: Number(i) });
    this.setData(patch);
  },

  toggleFocus(e) {
    const m = e.currentTarget.dataset.m;
    const checked = { ...this.data.focusChecked };
    checked[m] = !checked[m];
    this.setData({ focusChecked: checked, secs: secs(this.data.T || {}, this.data) });
  },

  onNotes(e) {
    this.setData({ notes: e.detail.value });
  },

  async submit() {
    const d = this.data;
    const focus = Object.keys(d.focusChecked).filter((k) => d.focusChecked[k]).map((m) => MUSCLE_EN[m] || m);
    const equip = EQUIP_EN[EQUIPS[d.equipIndex]] || EQUIPS[d.equipIndex];
    this.setData({ generating: true });
    wx.showLoading({ title: "AI 制定计划中..." });
    try {
      const r = await api.generate({
        goal: GOALS[d.goalIndex],
        level: LEVELS[d.levelIndex],
        days_per_week: FREQS[d.freqIndex],
        time_per_session: TIMES[d.timeIndex],
        equipment: equip,
        focus,
        notes: d.notes,
      });
      wx.hideLoading();
      this.setData({ generating: false });
      // generate 返回里已带完整计划数据（r.plan），直接存本地，"今天"页读缓存展示
      wx.setStorageSync("cachedPlan", {
        id: r.id,
        title: (r.plan && r.plan.title) || "",
        plan_data: r.plan,
      });
      wx.setStorageSync("currentPlanId", r.id);
      const back = () => wx.switchTab({ url: "/pages/plan/plan" });
      wx.navigateBack({ fail: back });
      wx.showToast({ title: "计划已生成", icon: "success" });
    } catch (err) {
      wx.hideLoading();
      this.setData({ generating: false });
      const code = err.statusCode || err.status || "";
      wx.showModal({
        title: "生成失败",
        content: "状态码 " + code + "\n" + String((err.data && err.data.error) || err.detail || err.errMsg || err.message),
        showCancel: false,
      });
    }
  },
});
