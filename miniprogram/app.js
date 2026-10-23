const config = require("./config");

App({
  globalData: {
    base: config.BASE,
    openid: "",
  },
  // MVP：openid 直接本地生成占位；正式接 wx.login → 后端 code2session
  init() {
    const openid = wx.getStorageSync("openid");
    if (openid) {
      this.globalData.openid = openid;
    } else {
      this.globalData.openid = "dev-" + Date.now();
      wx.setStorageSync("openid", this.globalData.openid);
    }
  },
});
