const api = require("../../api");

Page({
  data: {
    q: "",
    muscle: "",
    muscles: ["quadriceps", "hamstrings", "glutes", "core", "shoulders", "chest", "back", "biceps", "triceps"],
    list: [],
    loading: false,
    detail: null,
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
