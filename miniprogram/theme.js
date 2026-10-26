// 主题：暗色（默认）/ 浅色 两档。
//
// 渲染方式：把解析出的 light|dark 写到页面 data.theme，页面根节点挂对应类
// （.t-dark），CSS 变量在类里整体替换（见 app.wxss）。
//
// 另两处必须跟着改，否则切主题会露出浅色底：
//   1. page 元素本身（我们只能在它内部的 view 上换变量，够不到它）
//   2. 状态栏/导航栏颜色

const KEY = "gym_theme"; // dark | light

function pref() {
  const p = wx.getStorageSync(KEY);
  // 老版本存过 "auto" / "ai"，统一归为 dark
  return p === "light" ? "light" : "dark";
}

function current() {
  return pref();
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
  const val = p === "light" ? "light" : "dark";
  wx.setStorageSync(KEY, val);
  fire();
  return val;
}

// 系统主题变化通知（保留用于各页 onThemeChange 监听，触发时重新 sync）
let listeners = [];
function onThemeChange(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

function fire() {
  listeners.forEach((fn) => {
    try { fn(); } catch (e) { /* 单个页面报错不影响其它页面 */ }
  });
}

// App 回前台时刷新一次（手动两档下主要是刷新 data，防止跨会话 stale）
function hookAppLifecycle() {
  try {
    const _app = getApp();
    if (!_app || _app._themeHooked) return;
    _app._themeHooked = true;
    const _oldShow = _app.onShow;
    _app.onShow = function () {
      _oldShow && _oldShow.call(this);
      fire();
    };
  } catch (e) { /* 忽略 */ }
}

// 页面/组件之外的那些「壳」：page 背景色 + 导航栏。
// 暗色 #0E0F13；浅色 #F9F6F5。
function paintChrome(t) {
  const dark = t !== "light";
  const bg = dark ? "#0E0F13" : "#F9F6F5";
  try {
    wx.setBackgroundColor({ backgroundColor: bg, backgroundColorTop: bg, backgroundColorBottom: bg });
  } catch (e) { /* 部分基础库不支持 top/bottom，忽略 */ }
  try {
    wx.setNavigationBarColor({ frontColor: dark ? "#ffffff" : "#000000", backgroundColor: bg });
  } catch (e) { /* 忽略 */ }
}

const LABEL = { dark: "暗色", light: "浅色" };

module.exports = {
  KEY, pref, set, current, sync, paintChrome,
  onThemeChange, LABEL, hookAppLifecycle,
};
