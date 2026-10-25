// 主题：AI（HUD 暗色，默认）/ 跟随系统 / 浅色 / 深色 四档。
//
// 渲染方式：把解析出的 light|dark|ai 写到页面 data.theme，页面根节点挂对应类
// （.t-dark / .t-ai），CSS 变量在类里整体替换（见 app.wxss）。
//
// 另两处必须跟着改，否则切主题会露出浅色底：
//   1. page 元素本身（我们只能在它内部的 view 上换变量，够不到它）
//   2. 状态栏/导航栏颜色

const KEY = "gym_theme"; // ai | auto | light | dark

function win() {
  try {
    return wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) {
    return {};
  }
}

function sysTheme() {
  const w = win();
  return w && w.theme === "dark" ? "dark" : "light";
}

function pref() {
  return wx.getStorageSync(KEY) || "ai";
}

function resolve(p) {
  if (p === "ai" || p === "light" || p === "dark") return p;
  if (p === "auto") return sysTheme();
  return "ai"; // 老档值（未设过）按新默认走
}

// 系统主题变化时通知正在显示的页面，避免「切了系统深色但当前页还是浅的」
let listeners = [];
function onThemeChange(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

function fire() {
  const t = resolve(pref());
  listeners.forEach((fn) => {
    try {
      fn(t);
    } catch (e) {
      /* 单个页面报错不该影响其它页面 */
    }
  });
}

if (wx.onThemeChange) {
  wx.onThemeChange(() => fire());
}

// 页面/组件之外的那些「壳」：page 背景色 + 导航栏。
// 浅色：浅填充 #F9F6F5；ai：#0E0F13；深色：#141110。全部不透明。
function paintChrome(t) {
  const dark = t !== "light";
  const bg = t === "ai" ? "#0E0F13" : t === "dark" ? "#141110" : "#F9F6F5";
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

const LABEL = { ai: "AI 暗色", auto: "跟随系统", light: "浅色", dark: "深色" };

module.exports = { KEY, pref, set, resolve, current, sync, paintChrome, onThemeChange, LABEL, sysTheme };
