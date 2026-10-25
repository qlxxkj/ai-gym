// 自定义 tabBar（对齐 daily-poetry）：原生 tabBar 颜色写死在 app.json，
// 切深色主题会留白底割裂，自己画才能跟主题走。
const i18n = require("../i18n");
const theme = require("../theme");

const TABS = [
  { key: "today", path: "/pages/today/today", tkey: "tab_today", icon: "check" },
  { key: "plan", path: "/pages/plan/plan", tkey: "tab_plan", icon: "clipboard" },
  { key: "exercises", path: "/pages/exercises/exercises", tkey: "tab_exercises", icon: "dumbbell" },
  { key: "stats", path: "/pages/stats/stats", tkey: "tab_stats", icon: "chart" },
  { key: "profile", path: "/pages/profile/profile", tkey: "tab_profile", icon: "user" },
];

function withText() {
  return TABS.map((t) => Object.assign({}, t, { text: i18n.fallback(t.tkey) }));
}

Component({
  data: {
    list: withText(),
    selected: 0,
    theme: "light",
  },

  lifetimes: {
    attached() {
      this.refresh();
      // 语言/外观都是 storage 持久化 + 广播，tabBar 常驻：监听广播即可跟上
      this._offLang = i18n.onChange(() => this.refresh());
      this._offTheme = theme.onThemeChange(() => this.refresh());
    },
    detached() {
      if (this._offLang) this._offLang();
      if (this._offTheme) this._offTheme();
    },
  },

  methods: {
    refresh() {
      this.setData({
        list: TABS.map((t) => Object.assign({}, t, { text: i18n.t(t.tkey) })),
        theme: theme.current(),
      });
    },
    onTap(e) {
      const i = Number(e.currentTarget.dataset.index);
      if (i === this.data.selected) return;
      this.setData({ selected: i });
      wx.switchTab({ url: TABS[i].path });
    },
  },
});
