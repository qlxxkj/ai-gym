const api = require("../../api");

Page({
  data: {
    plans: [],
    current: null,
    openDay: 0,
    reviewText: "",
    reviewing: false,
    revising: false,
    applying: false,
    showReviewPanel: false,
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const plans = await api.plans();
      const cur = wx.getStorageSync("currentPlanId");
      const current = plans.find((p) => p.id === cur) || plans[0] || null;
      if (current) wx.setStorageSync("currentPlanId", current.id);
      const full = current ? await api.plan(current.id) : null;
      this.setData({ plans, current: full, openDay: -1 });
      if (full && full.sup_review) {
        this.setData({ reviewText: JSON.stringify(full.sup_review, null, 2), showReviewPanel: true });
      }
    } catch (e) {
      console.error(e);
    }
  },

  async openPlan(e) {
    const id = e.currentTarget.dataset.id;
    const p = await api.plan(id);
    wx.setStorageSync("currentPlanId", id);
    this.setData({
      current: p,
      openDay: -1,
      reviewText: p.sup_review ? JSON.stringify(p.sup_review, null, 2) : "",
      showReviewPanel: !!p.sup_review,
    });
  },

  toggleDay(e) {
    const d = e.currentTarget.dataset.d;
    this.setData({ openDay: this.data.openDay === d ? -1 : d });
  },

  async doReview() {
    this.setData({ reviewing: true });
    wx.showLoading({ title: "AI 复盘中..." });
    try {
      const r = await api.review(this.data.current.id, {});
      this.setData({
        reviewText: JSON.stringify(r.review, null, 2),
        showReviewPanel: true,
      });
    } catch (err) {
      wx.showModal({
        title: "复盘失败",
        content: String((err.data && err.data.error) || err.message),
        showCancel: false,
      });
    }
    wx.hideLoading();
    this.setData({ reviewing: false });
  },

  async doRevise() {
    const { current } = this.data;
    const text = await this.promptRevise();
    if (!text) return;
    this.setData({ revising: true });
    try {
      await api.revise(current.id, { adjustments: [text] });
      this.load();
      wx.showToast({ title: "计划已更新" });
    } catch (err) {
      wx.showModal({
        title: "修改失败",
        content: String((err.data && err.data.error) || err.message),
        showCancel: false,
      });
    }
    this.setData({ revising: false });
  },

  promptRevise() {
    return new Promise((resolve) => {
      wx.showModal({
        title: "告诉 AI 想怎么调整",
        editable: true,
        placeholderText: "例如：推日换成哑铃动作，组数减到3组",
        success: (r) => resolve(r.confirm ? r.content : null),
        fail: () => resolve(null),
      });
    });
  },

  // 采纳复盘里的 next_plan_adjustment，让 AI 据此修改计划
  async applyReview() {
    const p = this.data.current;
    if (!p || !p.sup_review) return;
    const adj = p.sup_review.next_plan_adjustment;
    if (!adj) {
      wx.showToast({ title: "本次复盘没有计划调整项", icon: "none" });
      return;
    }
    this.setData({ applying: true });
    try {
      await api.revise(p.id, { adjustments: [adj] });
      this.load();
      wx.showToast({ title: "已按建议更新计划" });
    } catch (err) {
      wx.showModal({
        title: "应用失败",
        content: String((err.data && err.data.error) || err.message),
        showCancel: false,
      });
    }
    this.setData({ applying: false });
  },

  dismissReview() {
    this.setData({ showReviewPanel: false });
  },

  goForm() {
    wx.switchTab({ url: "/pages/form/form" });
  },
});
