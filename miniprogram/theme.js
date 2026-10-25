// 主题（外观）：auto / light / dark，存 storage "theme"。
// apply(page)：page.setData({ dark }) 驱动页面根节点 class；导航栏统一深色（#241D1B 白字），不动。

function sysTheme() {
  try {
    return wx.getSystemInfoSync().theme || "light";
  } catch (e) {
    return "light";
  }
}

function get() {
  return wx.getStorageSync("theme") || "auto";
}

function set(v) {
  wx.setStorageSync("theme", v || "auto");
}

// 当前生效的深色布尔值
function isDark() {
  const t = get();
  if (t === "light") return false;
  if (t === "dark") return true;
  return sysTheme() === "dark";
}

function apply(page) {
  page.setData({ dark: isDark() });
}

module.exports = { get, set, isDark, apply };
