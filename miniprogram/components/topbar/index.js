// 自定义顶栏：微信原生导航栏的底色是静态的（app.json 写死），
// 做不到「浅色透明、深色深底」，所以自己画。
// 浅：透明底 + 深色文字；深：#141110 深底 + 浅色文字（与 page 同色，无割裂）。
// 胶囊位置用原生导航栏同款公式估算，标题右边留出胶囊区。
const theme = require("../../theme");
const i18n = require("../../i18n");

function metrics() {
  let statusH = 20,
    barH = 44,
    winW = 375;
  try {
    const w = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    if (w) {
      statusH = w.statusBarHeight || 20;
      winW = w.windowWidth || 375;
    }
  } catch (e) {
    /* 兜底默认值 */
  }
  let cap = null;
  try {
    cap = wx.getMenuButtonBoundingClientRect();
  } catch (e) {
    /* 忽略 */
  }
  const rightPad = cap ? Math.max(8, winW - cap.left + 8) : 140; // px
  return { statusH, barH, rightPad: rightPad + "px" };
}

Component({
  properties: {
    // i18n key（tab_ 前缀），组件内自己取文案，页面不用管
    tkey: { type: String, value: "" },
  },

  data: {
    theme: "light",
    text: "",
    totalH: 0,
    statusH: 0,
    barH: 0,
    rightPad: "140px",
  },

  lifetimes: {
    attached() {
      const m = metrics();
      this.setData({ totalH: m.statusH + m.barH, statusH: m.statusH, barH: m.barH, rightPad: m.rightPad });
      this.refresh();
      this._offTheme = theme.onThemeChange(() => this.refresh());
      this._offLang = i18n.onChange(() => this.refresh());
    },
    detached() {
      if (this._offTheme) this._offTheme();
      if (this._offLang) this._offLang();
    },
  },

  methods: {
    refresh() {
      this.setData({
        theme: theme.current(),
        text: i18n.t(this.data.tkey || "tab_plan"),
      });
    },
  },
});
