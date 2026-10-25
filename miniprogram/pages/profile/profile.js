const user = require("../../user");
const theme = require("../../theme");
const i18n = require("../../i18n");
const exdict = require("../../exdict");

Page({
  data: {
    dark: false,
    i18n: {},
    avatar: "",
    nick: "",
    version: user.VERSION,
    themeMode: "auto",
    langMode: "auto",
    themeModes: [
      { v: "auto", label: "auto" },
      { v: "light", label: "light" },
      { v: "dark", label: "dark" },
    ],
    langModes: [
      { v: "auto", label: "auto" },
      { v: "zh", label: "zh" },
      { v: "en", label: "en" },
    ],
    favPlans: [],
    favExercises: [],
  },

  onShow() {
    theme.apply(this);
    this.setData({ i18n: i18n.bundle() });
    this.refresh();
    exdict.load(() => this.refreshExNames());
  },

  refresh() {
    const t = theme.get();
    const l = i18n.get();
    const i18nB = i18n.bundle();
    // 把模式项 label 换成本语言文案
    const themeModes = [
      { v: "auto", label: i18nB.profileThemeAuto },
      { v: "light", label: i18nB.profileThemeLight },
      { v: "dark", label: i18nB.profileThemeDark },
    ];
    const langModes = [
      { v: "auto", label: i18nB.profileLangAuto },
      { v: "zh", label: i18nB.profileLangZh },
      { v: "en", label: i18nB.profileLangEn },
    ];
    this.setData({
      avatar: user.avatar(),
      nick: user.nick(),
      themeMode: t,
      langMode: l,
      themeModes,
      langModes,
      favPlans: this.buildFavPlans(),
      favExercises: this.buildFavEx(),
      i18n: i18nB,
    });
  },

  buildFavPlans() {
    // 标题只在 cachedPlan 命中时显示，否则用 #id 占位（不阻塞 onShow，后台补）
    const list = user.favPlans();
    const cached = wx.getStorageSync("cachedPlan");
    return list.map((id) => {
      const hit = cached && cached.id === id;
      return { id, title: hit ? cached.title || "#" + id : "#" + id };
    });
  },

  buildFavEx() {
    const list = user.favExercises();
    return list.map((id) => ({ id, name_zh: exdict.nameZh(id) || "#" + id }));
  },

  refreshExNames() {
    this.setData({ favExercises: this.buildFavEx() });
  },

  pickAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      success: (r) => {
        const tmp = r.tempFiles[0].path;
        // 复制到本地缓存持久化（临时路径重启可能失效）
        const fd = wx.getFileSystemManager();
        const dst = wx.env.USER_DATA_PATH + "/avatar.png";
        try {
          fd.saveFile({
            filePath: tmp,
            destPath: dst,
            success: () => {
              user.setAvatar(dst);
              this.setData({ avatar: dst });
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
    const i18nB = this.data.i18n;
    wx.showModal({
      title: i18nB.profileNickPh,
      editable: true,
      placeholderText: this.data.nick || i18nB.profileNickPh,
      success: (r) => {
        if (r.confirm && r.content) {
          user.setNick(r.content.trim());
          this.setData({ nick: r.content.trim() });
        }
      },
    });
  },

  copyVersion() {
    wx.setClipboardData({
      data: user.VERSION,
      success: () => wx.showToast({ title: "v" + user.VERSION, icon: "none" }),
    });
  },

  setThemeMode(e) {
    theme.set(e.currentTarget.dataset.v);
    theme.apply(this);
    this.setData({ themeMode: theme.get() });
  },

  setLangMode(e) {
    i18n.set(e.currentTarget.dataset.v);
    this.refresh();
  },

  openFavPlan(e) {
    const id = e.currentTarget.dataset.id;
    wx.setStorageSync("profileOpenPlan", id);
    wx.switchTab({ url: "/pages/plan/plan" });
  },

  openFavEx(e) {
    const id = e.currentTarget.dataset.id;
    wx.setStorageSync("openExId", id);
    wx.switchTab({ url: "/pages/exercises/exercises" });
  },

  onShareAppMessage() {
    return { title: "AI 健身教练", path: "/pages/plan/plan" };
  },
});
