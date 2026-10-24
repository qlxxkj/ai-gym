// 动作中文字典（id → name_zh），小程序全局共用。
// 首次拉一次全量 500 条存本地 exZhDict，之后秒开；
// 后台拉取不阻塞页面渲染，字典到位后调用注册的回调刷新中文名。
const api = require("./api");

let dict = wx.getStorageSync("exZhDict") || {};
let ready = Object.keys(dict).length > 0;
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
      const d = {};
      (r || []).forEach((x) => (d[x.id] = x.name_zh));
      Object.assign(dict, d);
      ready = true;
      wx.setStorageSync("exZhDict", dict);
      const cbs = [...pending];
      pending.clear();
      cbs.forEach((f) => f());
    })
    .catch(() => {});
}

// 取某动作中文名；还没有就返回 undefined（调用方 fallback 英文原名）
function nameZh(id) {
  return dict[id];
}

module.exports = { load, nameZh };
