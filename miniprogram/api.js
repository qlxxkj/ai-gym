const app = getApp();

function req(method, path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.base + path,
      method,
      data,
      header: { "X-Openid": app.globalData.openid, "content-type": "application/json" },
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
  day: (planId, dayNo) =>
    req("GET", `/plans/${planId}/day/${dayNo}`).then((r) => r.data),
  recordSet: (sessionId, body) =>
    req("POST", `/sessions/${sessionId}/sets`, body).then((r) => r.data),
  markDone: (sessionId) =>
    req("POST", `/sessions/${sessionId}/done`).then((r) => r.data),
  review: (planId, body) =>
    req("POST", `/plans/${planId}/review`, body).then((r) => r.data),
};
