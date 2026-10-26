const config = require("./config");
const theme = require("./theme");

App({
  globalData: {
    base: config.BASE,
    openid: "",
  },
  onLaunch() {
    theme.hookAppLifecycle();
    this.login();
  },
  // 真实登录：wx.login → /auth/login 换 openid；失败回退本地缓存或 dev-default
  login() {
    const that = this;
    // 先用本地缓存顶上（上次成功登录的 openid），避免首个请求发 dev-default
    that.globalData.openid = wx.getStorageSync("openid") || "dev-default";
    wx.login({
      success(res) {
        if (!res.code) return;
        wx.request({
          url: that.globalData.base + "/auth/login",
          method: "POST",
          data: { code: res.code },
          success(r) {
            if (r.data && r.data.openid) {
              that.globalData.openid = r.data.openid;
              wx.setStorageSync("openid", r.data.openid);
            }
          },
        });
      },
    });
  },
});
