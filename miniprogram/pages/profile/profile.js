const user = require("../../user");
const theme = require("../../theme");
const i18n = require("../../i18n");
const exdict = require("../../exdict");

Page({
  data: {
    avatar: "",
    nick: "",
    version: user.VERSION,
    themePref: "auto",
    langPref: "auto",
    themeLabel: "",
    langLabel: "",
    favPlans: [],
    favExercises: [],
    favCount: 0,
  },

  onShow() {
    if (typeof this.getTabBar === "function") this.getTabBar().setData({ selected: 3 });
    theme.sync(this);
    i18n.sync(this);
    this.refreshLabels();
    this.refreshFav();
    exdict.load(() => this.refreshFav());
    // 切语言：广播回来时刷新 T/标签/收藏名
    if (!this._offLang) this._offLang = i18n.onChange(() => { i18n.sync(this); this.refreshLabels(); this.refreshFav(); });
  },

  refreshLabels() {
    const T = this.data.T || {};
    const themePref = this.data.themePref;
    const langPref = this.data.langPref;
    const themeLabel =
      themePref === "light" ? T.theme_light || "浅色" :
      themePref === "dark" ? T.theme_dark || "深色" :
      T.theme_auto || "跟随系统";
    const langLabel =
      langPref === "zh" ? T.lang_zh || "中文" :
      langPref === "en" ? T.lang_en || "英文" :
      T.lang_auto || "跟随系统";
    this.setData({ themeLabel, langLabel, avatar: user.avatar(), nick: user.nick() });
  },

  refreshFav() {
    const T = this.data.T || {};
    // 计划标题：cachedPlan 命中就显示标题，否则 #id
    const list = user.favPlans();
    const cached = wx.getStorageSync("cachedPlan");
    const favPlans = list.map((id) => ({
      id,
      title: cached && cached.id === id ? cached.title || "#" + id : "#" + id,
    }));
    const favExercises = user.favExercises().map((id) => ({
      id,
      name_zh: exdict.nameZh(id) || "#" + id,
    }));
    this.setData({
      favPlans,
      favExercises,
      favCount: favPlans.length + favExercises.length,
    });
  },

  // 外观：点「外观」行循环切换 auto→light→dark（对齐 daily-poetry 的行内切换）
  pickTheme() {
    const order = ["auto", "light", "dark"];
    const cur = this.data.themePref || "auto";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    theme.set(next);
    this.setData({ themePref: next });
    theme.sync(this);
    i18n.sync(this);
    this.refreshLabels();
  },

  // 语言：循环 auto→zh→en
  pickLang() {
    const order = ["auto", "zh", "en"];
    const cur = this.data.langPref || "auto";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    i18n.setLang(next === "auto" ? "auto" : next);
    this.setData({ langPref: next });
    i18n.sync(this);
    this.refreshLabels();
    this.refreshFav();
  },

  pickAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      success: (r) => {
        const tmp = r.tempFiles[0].path;
        // 复制到本地持久化（临时路径重启失效）
        const dst = wx.env.USER_DATA_PATH + "/avatar.png";
        try {
          wx.getFileSystemManager().saveFile({
            filePath: tmp,
            destPath: dst,
            success: () => {
              user.setAvatar(dst);
              this.setData({ avatar: dst });
            },
            fail: () => {
              user.setAvatar(tmp);
              this.setData({ avatar: tmp });
            },
          });
        } catch (e) {
          user.setAvatar(tmp);
          this.setData({ avatar: tmp });
        }
      },
    });
  },

  pickNick() {
    const T = this.data.T || {};
    wx.showModal({
      title: T.mine_nick_ph || "设置昵称",
      editable: true,
      placeholderText: this.data.nick,
      success: (r) => {
        if (r.confirm && r.content) {
          user.setNick(r.content.trim());
          this.setData({ nick: r.content.trim() });
        }
      },
    });
  },

  openFavPlan(e) {
    wx.setStorageSync("profileOpenPlan", e.currentTarget.dataset.id);
    wx.switchTab({ url: "/pages/plan/plan" });
  },

  openFavEx(e) {
    wx.setStorageSync("openExId", e.currentTarget.dataset.id);
    wx.switchTab({ url: "/pages/exercises/exercises" });
  },

  onShareAppMessage() {
    const T = this.data.T || {};
    return { title: T.about_brand || "AI 健身教练", path: "/pages/plan/plan" };
  },
});
