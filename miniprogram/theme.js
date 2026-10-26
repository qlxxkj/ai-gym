// 主题：暗色（设计方案 HUD 板，默认）/ 跟随系统 / 浅色 三档。
//
// 渲染方式：把解析出的 light|dark 写到页面 data.theme，页面根节点挂对应类
// （.t-dark），CSS 变量在类里整体替换（见 app.wxss）。
//
// 另两处必须跟着改，否则切主题会露出浅色底：
//   1. page 元素本身（我们只能在它内部的 view 上换变量，够不到它）
//   2. 状态栏/导航栏颜色

const KEY = "gym_theme"; // dark | auto | light（老值 ai 按 dark 兼容）

function win() {
  try {
    return wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) {
    return {};
  }
}

// 系统暗色探测：安卓上 getWindowInfo().theme 经常取不到（老基础库 undefined，
// 新基础库默认色板），iOS 的「深色模式」开关有时也不进 theme。
// 顺序：window.theme → preferredTheme（开发者工具/模拟器）→ appDarkMode → 默认浅色。
// 页面每次 onShow 重跑一次（sync 里调），保证日间/夜间进应用都能拿到最新值。
function sysTheme() {
  try {
    const w = win();
    if (w && (w.theme === "dark" || w.preferredTheme === "dark")) return "dark";
  } catch (e) {
    /* 忽略 */
  }
  // 老基础库 getWindowInfo 拿不到时再试一次全量同步接口
  try {
    const s = wx.getSystemInfoSync();
    if (s && (s.theme === "dark" || s.preferredTheme === "dark")) return "dark";
  } catch (e) {
    /* 忽略 */
  }
  return "light";
}

function pref() {
  return wx.getStorageSync(KEY) || "dark";
}

function resolve(p) {
  if (p === "light" || p === "dark") return p;
  if (p === "auto" || p === "ai") {
    // 老默认值 ai 与「跟随系统」同解：跟随系统，系统非暗色则浅色
    return sysTheme() === "dark" ? "dark" : "light";
  }
  return "dark";
}

// 系统主题变化时通知正在显示的页面，避免「跟随系统档切了系统深色但当前页还是浅的」。
// 监听者直接调 theme.sync(this)，确保 data.theme 刷新 → wxml class 更新 → 全页变暗。
//
// 已知坑（安卓真机）：
//   1. wx.onThemeChange 在部分基础库上根本不会触发，或只在开发者工具里触发；
//   2. 开发者工具里 wx.getSystemInfoSync().theme 有时是 undefined（系统开了深色也拿不到）；
//   3. 所以「跟随系统」档必须保证每个页面 onShow 时重新解析（theme.sync 已做），
//      这是兜底路径，比 onThemeChange 回调可靠得多。
let listeners = [];
function onThemeChange(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

function fire() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      /* 单个页面报错不该影响其它页面 */
    }
  });
}

if (wx.onThemeChange) {
  wx.onThemeChange(() => fire());
}

// 页面/组件之外的那些「壳」：page 背景色 + 导航栏。
// 暗色 #0E0F13；浅色 #F9F6F5。全部不透明。
function paintChrome(t) {
  const dark = t !== "light";
  const bg = dark ? "#0E0F13" : "#F9F6F5";
  try {
    wx.setBackgroundColor({ backgroundColor: bg, backgroundColorTop: bg, backgroundColorBottom: bg });
  } catch (e) {
    /* 部分基础库不支持 top/bottom，忽略 */
  }
  try {
    wx.setNavigationBarColor({ frontColor: dark ? "#ffffff" : "#000000", backgroundColor: bg });
  } catch (e) {
    /* 忽略 */
  }
}

function current() {
  return resolve(pref());
}

// 页面 onShow 里调用：把主题写进 data 并同步壳层
function sync(page, extra) {
  const t = current();
  const patch = { theme: t, themePref: pref() };
  if (extra) Object.assign(patch, extra);
  if (page && page.setData) page.setData(patch);
  paintChrome(t);
  return t;
}

// 切换：写完立刻广播，当前页和已加载页都会跟上
function set(p) {
  wx.setStorageSync(KEY, p);
  fire();
  return resolve(p);
}

const LABEL = { dark: "暗色", auto: "跟随系统", light: "浅色" };

module.exports = { KEY, pref, set, resolve, current, sync, paintChrome, onThemeChange, LABEL, sysTheme };
