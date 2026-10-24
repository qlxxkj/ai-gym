const api = require("../../api");

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

Page({
  data: {
    goals: ["增肌", "减脂", "力量", "体能", "塑形"],
    levels: ["新手", "中级", "进阶"],
    freqs: [1, 2, 3, 4, 5, 6],
    times: [30, 45, 60, 90],
    equipments: ["自重", "哑铃", "杠铃", "器械", "弹力带"],
    focusMuscles: ["胸", "背", "腿", "肩", "手臂", "核心", "臀"],
    goalIndex: 0,
    levelIndex: 0,
    freqIndex: 2,
    timeIndex: 1,
    equipIndex: 0,
    focusChecked: {},
    notes: "",
    generating: false,
  },

  pick(e) {
    const { field, i } = e.currentTarget.dataset; // 对象解构，别写成数组解构 [field,i]（那是 key 名不是值）
    this.setData({ [field]: Number(i) });
  },

  toggleFocus(e) {
    const m = e.currentTarget.dataset.m;
    const checked = { ...this.data.focusChecked };
    checked[m] = !checked[m];
    this.setData({ focusChecked: checked });
  },

  onNotes(e) {
    this.setData({ notes: e.detail.value });
  },

  async submit() {
    const d = this.data;
    const focus = Object.keys(d.focusChecked).filter((k) => d.focusChecked[k]).map((m) => MUSCLE_EN[m] || m);
    const equip = EQUIP_EN[d.equipments[d.equipIndex]] || d.equipments[d.equipIndex];
    this.setData({ generating: true });
    wx.showLoading({ title: "AI 制定计划中..." });
    try {
      const r = await api.generate({
        goal: d.goals[d.goalIndex],
        level: d.levels[d.levelIndex],
        days_per_week: d.freqs[d.freqIndex],
        time_per_session: d.times[d.timeIndex],
        equipment: equip,
        focus,
        notes: d.notes,
      });
      wx.hideLoading();
      this.setData({ generating: false });
      wx.setStorageSync("currentPlanId", r.id);
      // plan 是 tabBar 页，必须用 switchTab（reLaunch 跳 tabBar 页在部分基础库上无效）
      wx.switchTab({ url: "/pages/plan/plan" });
      // 成功后弹提示，用户能明确看到"生成成功"，而不是静默切页以为失败了
      wx.showToast({ title: "计划已生成", icon: "success" });
    } catch (err) {
      wx.hideLoading();
      this.setData({ generating: false });
      // 把状态码也带上，方便定位 401（openid 缺失）vs 502（AI 失败）
      const code = err.statusCode || err.status || "";
      wx.showModal({
        title: "生成失败",
        content: "状态码 " + code + "\n" + String((err.data && err.data.error) || err.detail || err.errMsg || err.message),
        showCancel: false,
      });
    }
  },
});
