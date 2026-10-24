const api = require("../../api");

Page({
  data: {
    q: "",
    muscle: "",
    // 值必须是 DB 里的英文 muscle（"back" 查不到，DB 用 "upper back"）
    muscles: ["quadriceps", "hamstrings", "glutes", "core", "shoulders", "chest", "upper back", "biceps", "triceps"],
    list: [],
    loading: false,
    detail: null,
    // 图片/视频加载失败的 id（失败则隐藏 media，只留文字）
    imgErr: {},
    clipErr: {},
  },

  onImgErr(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ [`imgErr.${id}`]: true });
  },

  onClipErr(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ [`clipErr.${id}`]: true });
  },

  onShow() {
    this.search("");
  },

  onSearch(e) {
    this.setData({ q: e.detail.value });
    this.search(e.detail.value);
  },

  pickMuscle(e) {
    const m = e.currentTarget.dataset.m;
    this.setData({ muscle: this.data.muscle === m ? "" : m });
    this.search(this.data.q);
  },

  async search(q) {
    this.setData({ loading: true });
    try {
      const list = await api.exercises({ q: q || undefined, muscle: this.data.muscle || undefined, limit: 60 });
      this.setData({ list, loading: false, detail: null });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: "搜索失败", icon: "none" });
    }
  },

  showDetail(e) {
    const ex = e.currentTarget.dataset.ex;
    this.setData({ detail: ex || null });
  },
});
