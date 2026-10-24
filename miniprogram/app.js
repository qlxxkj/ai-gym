const config = require("./config");

App({
  globalData: {
    base: config.BASE,
    openid: "",
  },
  // 登录：wx.login 拿 code → 后端 /wx/login 换 openid。
  // 后端没配微信密钥时（测试期）降级用本地写死编号，同一部手机同一个人。
  // 拿到真实 openid 就存本地，下次启动直接用，不再重复登录。
  onLaunch() {
    const stored = wx.getStorageSync("openid");
    if (stored) {
      this.globalData.openid = stored;
      return;
    }
    this.globalData.openid = "dev-default"; // 先占位，各页面请求不会 401
    this.login();
  },

  login() {
    const self = this;
    wx.login({
      success: async (r) => {
        if (!r.code) return;
        try {
          const res = await new Promise((resolve, reject) =>
            wx.request({
              url: self.globalData.base + "/wx/login",
              method: "POST",
              data: { code: r.code },
              header: { "content-type": "application/json" },
              success: resolve,
              fail: reject,
            })
          );
          const openid = res.data && res.data.openid;
          if (openid) {
            self.globalData.openid = openid;
            wx.setStorageSync("openid", openid);
            wx.setStorageSync("currentPlanId", ""); // 换人后旧计划编号失效
          }
        } catch {
          /* 后端没配微信密钥，保持 dev-default 占位 */
        }
      },
      fail() {},
    });
  },
});
