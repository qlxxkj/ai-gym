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
const GOALS_EN = ["Muscle", "Fat loss", "Strength", "Conditioning", "Toning"];
const LEVELS = ["新手", "中级", "进阶"];
const LEVELS_EN = ["Beginner", "Intermediate", "Advanced"];
const FREQS = [1, 2, 3, 4, 5, 6];
const TIMES = [30, 45, 60, 90];
const EQUIPS = ["自重", "哑铃", "杠铃", "器械", "弹力带"];
const EQUIPS_EN = ["Bodyweight", "Dumbbells", "Barbell", "Machine", "Bands"];
const FOCUS = ["胸", "背", "腿", "肩", "手臂", "核心", "臀"];
const FOCUS_EN = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes"];

// 分组结构：label/values/active(单选)/checked(多选) 由 onShow 按当前语言生成，
// 保证切语言后分组标题和选项一起刷新
function secs(T, d, en) {
  return [
    { id: "goal", label: T.form_goal, kind: "single", field: "goalIndex", values: en ? GOALS_EN : GOALS, active: d.goalIndex },
    { id: "level", label: T.form_level, kind: "single", field: "levelIndex", values: en ? LEVELS_EN : LEVELS, active: d.levelIndex },
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
    { id: "equip", label: T.form_equip, kind: "single", field: "equipIndex", values: en ? EQUIPS_EN : EQUIPS, active: d.equipIndex },
    {
      id: "focus", label: T.form_focus, kind: "multi", field: "focusChecked",
      values: en ? FOCUS_EN : FOCUS, checked: d.focusChecked,
    },
  ];
}

// 多选 focus 的 key：显示值（中文/英文）→ DB 英文 muscle，提交时直接用 DB 值
const FOCUS_KEY_EN = { Chest: "chest", Back: "upper back", Legs: "quadriceps", Shoulders: "shoulders", Arms: "biceps", Core: "core", Glutes: "glutes" };

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
    // 先同步 i18n 把 T 写入 data，再构建 secs（否则 T 为空，标题全 undefined）
    i18n.sync(this);
    this.setData({ secs: secs(this.data.T, this.data, this.data.lang === "en") });
    if (!this._offLang) this._offLang = i18n.onChange(() => {
      i18n.sync(this);
      this.setData({ secs: secs(this.data.T, this.data, this.data.lang === "en") });
    });
  },

  pick(e) {
    const { field, i } = e.currentTarget.dataset;
    const patch = {};
    patch[field] = Number(i);
    patch.secs = secs(this.data.T || {}, { ...this.data, [field]: Number(i) }, this.data.lang === "en");
    this.setData(patch);
  },

  toggleFocus(e) {
    const m = e.currentTarget.dataset.m;
    const checked = { ...this.data.focusChecked };
    checked[m] = !checked[m];
    this.setData({ focusChecked: checked, secs: secs(this.data.T || {}, this.data, this.data.lang === "en") });
  },

  onNotes(e) {
    this.setData({ notes: e.detail.value });
  },

  async submit() {
    const d = this.data;
    const en = d.lang === "en";
    // 提交永远发 DB 认识的中文目标/水平值（后端提示词按中文生成）；focus 英文 key 先映射回 DB 值
    const focus = Object.keys(d.focusChecked).filter((k) => d.focusChecked[k])
      .map((m) => (en ? FOCUS_KEY_EN[m] : MUSCLE_EN[m]) || m);
    const equip = EQUIP_EN[EQUIPS[d.equipIndex]] || EQUIPS[d.equipIndex];
    this.setData({ generating: true });
    wx.showLoading({ title: en ? "AI is building your plan..." : "AI 制定计划中..." });
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
      // generate 返回里已带完整计划数据（r.plan），直接存本地，今日页（tab）读缓存展示当天应练
      wx.setStorageSync("cachedPlan", {
        id: r.id,
        title: (r.plan && r.plan.title) || "",
        plan_data: r.plan,
      });
      wx.setStorageSync("currentPlanId", r.id);
      const back = () => wx.switchTab({ url: "/pages/plan/plan" });
      wx.navigateBack({ fail: back });
      // 生成成功后直达今日页打卡
      this._generated = true;
      wx.showToast({ title: en ? "Plan created" : "计划已生成", icon: "success" });
    } catch (err) {
      wx.hideLoading();
      this.setData({ generating: false });
      const code = err.statusCode || err.status || "";
      wx.showModal({
        title: en ? "Failed" : "生成失败",
        content: (en ? "Code " : "状态码 ") + code + "\n" + String((err.data && err.data.error) || err.detail || err.errMsg || err.message),
        showCancel: false,
      });
    }
  },
});
