const app = getApp();

function req(method, path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.base + path,
      method,
      data,
      header: { "X-Openid": app.globalData.openid, "content-type": "application/json" },
      timeout: 10000, // 弱网下 10s 未回直接 fail，避免页面卡死在「加载中」
      success: resolve,
      fail: reject,
    });
  });
}

module.exports = {
  // 小程序运行时没有 URLSearchParams，手动拼 query string（过滤空值）
  exercises: (params) =>
    req(
      "GET",
      "/exercises?" +
        Object.keys(params || {})
          .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
          .map((k) => k + "=" + encodeURIComponent(params[k]))
          .join("&")
    ).then((r) => r.data),
  plans: () => req("GET", "/plans").then((r) => r.data),
  plan: (id) => req("GET", `/plans/${id}`).then((r) => r.data),
  generate: (body) => req("POST", "/plans/generate", body).then((r) => r.data),
  revise: (id, body) => req("POST", `/plans/${id}/revise`, body).then((r) => r.data),
  createSession: (body) => req("POST", "/sessions", body).then((r) => r.data),
  sessions: (planId) => req("GET", `/sessions/${planId}`).then((r) => r.data),
  sessionSets: (sessionId) =>
    req("GET", `/sessions/${sessionId}/sets`).then((r) => r.data),
  // 某动作 30 天内最近一次组记录（预填上次重量）
  lastSet: (exerciseId) =>
    req("GET", `/sessions/last/${exerciseId}`).then((r) => r.data),
  day: (planId, dayNo) =>
    req("GET", `/plans/${planId}/day/${dayNo}`).then((r) => r.data),
  recordSet: (sessionId, body) =>
    req("POST", `/sessions/${sessionId}/sets`, body).then((r) => r.data),
  markDone: (sessionId) =>
    req("POST", `/sessions/${sessionId}/done`).then((r) => r.data),
  review: (planId, body) =>
    req("POST", `/plans/${planId}/review`, body).then((r) => r.data),
  // 体重
  weight: () => req("GET", "/weight").then((r) => r.data),
  weightAdd: (body) => req("POST", "/weight", body).then((r) => r.data),
  // 个人资料（身高 / 目标体重，BMI 用）
  profile: () => req("GET", "/profile").then((r) => r.data),
  profileSet: (body) => req("POST", "/profile", body).then((r) => r.data),
  // 数据统计
  stats: () => req("GET", "/stats").then((r) => r.data),
  stats1rm: () => req("GET", "/stats/1rm").then((r) => r.data),
  statsRadar: () => req("GET", "/stats/muscle-radar").then((r) => r.data),
  statsHeat: () => req("GET", "/stats/heatmap").then((r) => r.data),
};
