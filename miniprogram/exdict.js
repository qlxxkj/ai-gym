// 动作名字典（id → 中文名 / 英文原名），小程序全局共用。
// 首次拉一次全量 500 条存本地 exZhDict，之后秒开；
// 后台拉取不阻塞页面渲染，字典到位后调用注册的回调刷新名称。
const api = require("./api");

let zh = wx.getStorageSync("exZhDict") || {};
let en = wx.getStorageSync("exEnDict") || {};
let ready = Object.keys(zh).length > 0;
const pending = new Set(); // 等字典的回调

function load(cb) {
  if (ready) {
    cb && cb();
    return;
  }
  if (cb) pending.add(cb);
  if (pending.size > 1) return; // 已有在途请求，不重复发
  api.exercises({ limit: 500 })
    .then((r) => {
      const z = {};
      const e = {};
      (r || []).forEach((x) => {
        z[x.id] = x.name_zh;
        e[x.id] = x.name;
      });
      Object.assign(zh, z);
      Object.assign(en, e);
      ready = true;
      wx.setStorageSync("exZhDict", zh);
      wx.setStorageSync("exEnDict", en);
      const cbs = [...pending];
      pending.clear();
      cbs.forEach((f) => f());
    })
    .catch(() => {});
}

// 取某动作中文名；还没有就返回 undefined（调用方 fallback 英文原名）
function nameZh(id) {
  return zh[id];
}

// 取某动作英文原名（全英文模式用）
function nameEn(id) {
  return en[id];
}

// 按当前语言取动作名：zh 用字典中文名，en 用英文原名（保证全英文无中文）
function name(id, lang) {
  if (lang === "en") return en[id] || zh[id] || "";
  return zh[id] || en[id] || "";
}

module.exports = { load, nameZh, nameEn, name, dict: () => zh };
