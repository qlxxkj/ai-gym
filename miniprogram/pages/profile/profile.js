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
    langPref: "zh",
    themeOpts: [],
    langOpts: [],
    favPlans: [],
    favExercises: [],
    favCount: 0,
  },

  onShow() {
    if (typeof this.getTabBar === "function") this.getTabBar().setData({ selected: 3 });
    theme.sync(this);
    i18n.sync(this);
    this.refreshOpts();
    this.refreshNick();
    this.refreshFav();
    exdict.load(() => this.refreshFav());
    if (!this._offLang) this._offLang = i18n.onChange(() => { i18n.sync(this); this.refreshOpts(); });
  },

  refreshOpts() {
    const T = this.data.T || {};
    this.setData({
      themeOpts: [
        { v: "auto", label: T.theme_auto },
        { v: "light", label: T.theme_light },
        { v: "dark", label: T.theme_dark },
      ],
      langOpts: [
        { v: "zh", label: T.lang_zh },
        { v: "en", label: T.lang_en },
      ],
    });
  },

  refreshNick() {
    const T = this.data.T || {};
    this.setData({ nick: user.nick() || T.mine_title });
  },

  refreshFav() {
    const T = this.data.T || {};
    const en = this.data.lang === "en";
    const cached = wx.getStorageSync("cachedPlan");
    const dict = exdict.dict();
    const favPlans = user.favPlans().map((id) => {
      const hit = cached && cached.id === id ? cached : null;
      // 全英文模式：计划标题/目标显示英文（goal_en/title_en，后端补的字段），
      // 缓存里没有就用 #id 占位，不留中文
      return {
        id,
        title: en ? (hit && hit.title_en ? hit.title_en : hit ? hit.title || "#" + id : "#" + id) : (hit ? hit.title || "#" + id : "#" + id),
        goal: hit ? (en ? hit.goal_en || "" : hit.goal || "") : "",
      };
    });
    const favExercises = user.favExercises().map((id) => ({
      id,
      // en 模式用英文原名，zh 用本地字典中文名
      name: lang === "en" ? exdict.nameEn(id) || "#" + id : dict[id] || exdict.nameEn(id) || "#" + id,
    }));
    this.setData({
      favPlans,
      favExercises,
      favCount: favPlans.length + favExercises.length,
    });
  },

  // 外观：点 chip 直接选档
  pickThemeOpt(e) {
    theme.set(e.currentTarget.dataset.v);
    this.setData({ themePref: e.currentTarget.dataset.v });
    theme.sync(this);
    i18n.sync(this);
    this.refreshOpts();
  },

  // 语言：点 chip 直接选档（没有「跟随系统」）
  pickLangOpt(e) {
    i18n.setLang(e.currentTarget.dataset.v);
    this.setData({ langPref: e.currentTarget.dataset.v });
    i18n.sync(this);
    this.refreshOpts();
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
    const en = this.data.lang === "en";
    const T = this.data.T || {};
    wx.showModal({
      title: en ? "Set nickname" : T.mine_nick_ph || "设置昵称",
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
