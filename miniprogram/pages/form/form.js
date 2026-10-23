const api = require("../../api");

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
    const [field, i] = e.currentTarget.dataset;
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
    const focus = Object.keys(d.focusChecked).filter((k) => d.focusChecked[k]);
    this.setData({ generating: true });
    wx.showLoading({ title: "AI 制定计划中..." });
    try {
      const r = await api.generate({
        goal: d.goals[d.goalIndex],
        level: d.levels[d.levelIndex],
        days_per_week: d.freqs[d.freqIndex],
        time_per_session: d.times[d.timeIndex],
        equipment: d.equipments[d.equipIndex],
        focus,
        notes: d.notes,
      });
      wx.hideLoading();
      wx.setStorageSync("currentPlanId", r.id);
      wx.reLaunch({ url: "/pages/plan/plan" });
    } catch (err) {
      wx.hideLoading();
      this.setData({ generating: false });
      wx.showModal({ title: "生成失败", content: String(err.data && err.data.error || err.message), showCancel: false });
    }
  },
});
