const api = require("../../api");
const config = require("../../config");

// 给 AI 计划里的动作补图片/视频/中文名（用 openGym id 拼 media URL，名字查本地字典）
const exdict = require("../../exdict");

function enrichPlan(full) {
  if (!full || !full.plan_data) return full;
  const cur = JSON.parse(JSON.stringify(full)); // 深拷贝避免污染 storage
  (cur.plan_data.days || []).forEach((d) => {
    (d.exercises || []).forEach((e) => {
      e.img_url = config.mediaStill(e.id);
      e.clip_url = config.mediaClip(e.id);
      e.name_zh = exdict.nameZh(e.id) || e.name;
    });
  });
  return cur;
}

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
    pending: false, // 刚生成完计划、正在后台加载详情时显示"加载计划中…"，避免空页误判
    loadErr: "",
  },

  onShow() {
    // 备动作中文字典：本地命中则瞬时；首次后台拉，不阻塞渲染，到位后回写中文名
    exdict.load(() => this.applyZhNames());
    this.load();
  },

  // 后台字典到位后回写当前计划动作的中文名
  applyZhNames() {
    const cur = this.data.current;
    if (!cur) return;
    const patched = enrichPlan(cur); // 用最新 exCache 重算 name_zh
    this.setData({ current: patched });
  },

  async load() {
    try {
      this.setData({ pending: true, loadErr: "" });
      const plans = await api.plans();
      const cur = wx.getStorageSync("currentPlanId");
      const current = plans.find((p) => p.id === cur) || plans[0] || null;
      if (current) wx.setStorageSync("currentPlanId", current.id);
      // enrichPlan 现在是同步的（中文名取自本地字典），不再串行等 500 条动作
      const full = current ? enrichPlan(await api.plan(current.id)) : null;
      this.setData({ plans, current: full, openDay: -1, pending: false });
      if (full && full.sup_review) {
        this.setData({ reviewText: JSON.stringify(full.sup_review, null, 2), showReviewPanel: true });
      }
    } catch (e) {
      console.error(e);
      this.setData({ pending: false, loadErr: String((e.data && e.data.error) || e.errMsg || e.message) });
      // 加载失败也弹出来，别让用户误以为"计划生成成功但页面空"
      wx.showModal({ title: "计划加载失败", content: "状态码 " + (e.statusCode || "") + "\n" + String((e.data && e.data.error) || e.errMsg || e.message), showCancel: false });
    }
  },

  async openPlan(e) {
    const id = e.currentTarget.dataset.id;
    const p = enrichPlan(await api.plan(id));
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
