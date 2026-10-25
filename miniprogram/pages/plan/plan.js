const api = require("../../api");
const config = require("../../config");
const exdict = require("../../exdict");
const theme = require("../../theme");
const i18n = require("../../i18n");
const user = require("../../user");

// 给 AI 计划里的动作补图片/视频/名称（用 openGym id 拼 media URL，名字查本地字典）
// 全英文模式下 name_zh 字段塞英文原名，wxml 不动
function enrichPlan(full, lang) {
  if (!full || !full.plan_data) return full;
  const cur = JSON.parse(JSON.stringify(full)); // 深拷贝避免污染 storage
  const en = lang === "en";
  (cur.plan_data.days || []).forEach((d) => {
    (d.exercises || []).forEach((e) => {
      e.img_url = config.mediaStill(e.id);
      e.clip_url = config.mediaClip(e.id);
      e.name_zh = en ? e.name : exdict.nameZh(e.id) || e.name;
    });
  });
  return cur;
}

// 部位标签中→英（AI 计划 days[].focus 是中文部位词）
const FOCUS_EN = {
  胸: "Chest", 背: "Back", 腿: "Legs", 肩: "Shoulders",
  手臂: "Arms", 臂: "Arms", 核心: "Core", 臀: "Glutes", 全身: "Full Body",
};
function focusEn(v) {
  const s = String(v || "");
  const hit = Object.keys(FOCUS_EN).find((k) => s.indexOf(k) >= 0);
  return hit ? s.replace(hit, FOCUS_EN[hit]) : s;
}

// 计划显示用名称：en 用英文（标题/目标/摘要/天标签/提示/备注/部位），zh 用原值
function locPlan(full, lang) {
  if (!full) return full;
  if (lang !== "en") return full;
  const c = JSON.parse(JSON.stringify(full));
  c.title = full.title_en || full.title;
  const d = c.plan_data || {};
  d.goal = full.goal_en || full.goal;
  d.summary = full.summary_en || d.summary;
  if ((full.plan_data && full.plan_data.tips_en || []).length) d.tips = full.plan_data.tips_en;
  if ((full.plan_data && full.plan_data.weekly_goals_en || []).length) d.weekly_goals = full.plan_data.weekly_goals_en;
  (d.days || []).forEach((day) => {
    day.label = day.label_en || day.label;
    day.focus = (day.focus || []).map(focusEn);
    (day.exercises || []).forEach((ex) => { if (ex.note_en) ex.note = ex.note_en; });
  });
  return c;
}

Page({
  data: {
    plans: [],
    current: null,
    curGoal: "",
    langEn: false,
    openDay: 0,
    reviewText: "",
    reviewing: false,
    revising: false,
    applying: false,
    showReviewPanel: false,
    pending: false, // 刚生成完计划、正在后台加载详情时显示"加载计划中…"，避免空页误判
    loadErr: "",
    faved: false,
  },

  onShow() {
    if (typeof this.getTabBar === "function") this.getTabBar().setData({ selected: 0 });
    theme.sync(this);
    i18n.sync(this);
    // 切语言：重建当前计划（动作名/标题按语言取），tabBar 文案另走广播
    if (!this._offLang) this._offLang = i18n.onChange(() => { i18n.sync(this); this.setData({ langEn: this.data.lang === "en" }); this.reloadLang(); });
    // 备动作中文字典：本地命中则瞬时；首次后台拉，不阻塞渲染，到位后回写名称
    exdict.load(() => this.applyZhNames());
    // 从「我的」页点收藏计划跳来：读 key 直接打开该计划
    const openId = wx.getStorageSync("profileOpenPlan");
    if (openId) {
      wx.removeStorageSync("profileOpenPlan");
      this.openPlanById(openId);
      return;
    }
    this.load();
  },

  // 后台字典到位后回写当前计划动作的名称（按当前语言）
  applyZhNames() {
    const cur = this.data.current;
    if (!cur) return;
    this.setData({ current: enrichPlan(cur, this.data.lang) });
  },

  // 切语言后按新语言重建当前计划显示（标题/目标/摘要/天标签/动作名）
  reloadLang() {
    const lang = this.data.lang;
    this.setData({ plans: this.data.plans.map((p) => locPlan(p, lang)) });
    const cur = this.data.current;
    if (cur) {
      const fresh = enrichPlan(locPlan(cur, lang), lang);
      this.setData({ current: fresh, curGoal: (fresh.plan_data || {}).goal || "" });
    }
  },

  async load() {
    this.setData({ pending: true, loadErr: "" });
    const lang = this.data.lang;

    // 先读本地缓存：命中就立即展示（不阻塞、不依赖网络）
    const cached = wx.getStorageSync("cachedPlan");
    const cachedId = wx.getStorageSync("currentPlanId");
    if (cached && cached.id && (!cachedId || cached.id === cachedId)) {
      const full = enrichPlan(locPlan(cached, lang), lang);
      this.setData({
        current: full,
        curGoal: (full.plan_data || {}).goal || "",
        langEn: lang === "en",
        openDay: -1,
        pending: false,
        faved: user.isFavPlan(full.id),
      });
      if (full.sup_review) {
        this.setData({ reviewText: JSON.stringify(full.sup_review, null, 2), showReviewPanel: true });
      }
    }

    // 后台拉最新列表+详情；成功回写缓存；失败不清已展示的缓存，只在无缓存时弹错
    try {
      const rawPlans = await api.plans();
      const plans = rawPlans.map((p) => locPlan(p, lang));
      const cur = wx.getStorageSync("currentPlanId");
      const current = plans.find((p) => p.id === cur) || plans[0] || null;
      if (current) {
        wx.setStorageSync("currentPlanId", current.id);
        const full = enrichPlan(locPlan(await api.plan(current.id), lang), lang);
        wx.setStorageSync("cachedPlan", full); // 回写缓存供下次离线用
        this.setData({
          plans,
          current: full,
          curGoal: (full.plan_data || {}).goal || "",
          langEn: lang === "en",
          openDay: -1,
          pending: false,
          faved: user.isFavPlan(full.id),
        });
        if (full.sup_review) {
          this.setData({ reviewText: JSON.stringify(full.sup_review, null, 2), showReviewPanel: true });
        }
      } else {
        this.setData({ plans, pending: false });
      }
    } catch (e) {
      console.error("plans refresh failed, using cache:", e);
      if (!this.data.current) {
        const en = this.data.lang === "en";
        this.setData({ pending: false, loadErr: String((e.data && e.data.error) || e.errMsg || e.message) });
        wx.showModal({
          title: en ? "Load failed" : "计划加载失败",
          content: (en ? "Code " : "状态码 ") + (e.statusCode || "") + "\n" + String((e.data && e.data.error) || e.errMsg || e.message),
          showCancel: false,
        });
      }
    }
  },

  async openPlan(e) {
    await this.openPlanById(e.currentTarget.dataset.id);
  },

  async openPlanById(id) {
    const lang = this.data.lang;
    const p = enrichPlan(locPlan(await api.plan(id), lang), lang);
    wx.setStorageSync("currentPlanId", id);
    wx.setStorageSync("cachedPlan", p); // 回写缓存，今日页（tab）读它展示当天应练
    this.setData({
      current: p,
      curGoal: (p.plan_data || {}).goal || "",
      openDay: -1,
      reviewText: p.sup_review ? JSON.stringify(p.sup_review, null, 2) : "",
      showReviewPanel: !!p.sup_review,
      faved: user.isFavPlan(id),
    });
  },

  toggleDay(e) {
    const d = e.currentTarget.dataset.d;
    this.setData({ openDay: this.data.openDay === d ? -1 : d });
  },

  // 收藏当前计划（本地）
  toggleFav() {
    const id = this.data.current && this.data.current.id;
    if (!id) return;
    user.toggleFavPlan(id);
    this.setData({ faved: user.isFavPlan(id) });
  },

  async doReview() {
    const en = this.data.lang === "en";
    this.setData({ reviewing: true });
    wx.showLoading({ title: en ? "AI reviewing..." : "AI 复盘中..." });
    try {
      const r = await api.review(this.data.current.id, {});
      this.setData({
        reviewText: JSON.stringify(r.review, null, 2),
        showReviewPanel: true,
      });
    } catch (err) {
      wx.showModal({
        title: en ? "Review failed" : "复盘失败",
        content: String((err.data && err.data.error) || err.message),
        showCancel: false,
      });
    }
    wx.hideLoading();
    this.setData({ reviewing: false });
  },

  async doRevise() {
    const en = this.data.lang === "en";
    const { current } = this.data;
    const text = await this.promptRevise();
    if (!text) return;
    this.setData({ revising: true });
    try {
      await api.revise(current.id, { adjustments: [text] });
      this.load();
      wx.showToast({ title: en ? "Plan updated" : "计划已更新" });
    } catch (err) {
      wx.showModal({
        title: en ? "Adjust failed" : "修改失败",
        content: String((err.data && err.data.error) || err.message),
        showCancel: false,
      });
    }
    this.setData({ revising: false });
  },

  promptRevise() {
    const en = this.data.lang === "en";
    return new Promise((resolve) => {
      wx.showModal({
        title: en ? "Tell the AI how to adjust" : "告诉 AI 想怎么调整",
        editable: true,
        placeholderText: en ? "e.g. switch push day to dumbbells, drop to 3 sets" : "例如：推日换成哑铃动作，组数减到3组",
        success: (r) => resolve(r.confirm ? r.content : null),
        fail: () => resolve(null),
      });
    });
  },

  // 采纳复盘里的 next_plan_adjustment，让 AI 据此修改计划
  async applyReview() {
    const en = this.data.lang === "en";
    const p = this.data.current;
    if (!p || !p.sup_review) return;
    const adj = p.sup_review.next_plan_adjustment;
    if (!adj) {
      wx.showToast({ title: en ? "No adjustment in this review" : "本次复盘没有计划调整项", icon: "none" });
      return;
    }
    this.setData({ applying: true });
    try {
      await api.revise(p.id, { adjustments: [adj] });
      this.load();
      wx.showToast({ title: en ? "Updated by suggestion" : "已按建议更新计划" });
    } catch (err) {
      wx.showModal({
        title: en ? "Apply failed" : "应用失败",
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
    // form 现在是普通页（不再是 tab），直接 navigateTo
    wx.navigateTo({ url: "/pages/form/form" });
  },
});
