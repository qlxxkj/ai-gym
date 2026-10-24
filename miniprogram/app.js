const config = require("./config");

App({
  globalData: {
    base: config.BASE,
    openid: "",
  },
  // MVP：openid 直接本地生成占位；正式接 wx.login → 后端 code2session
  onLaunch() {
    // 微信里 App 的 onLaunch 才会自动执行；原先只写了 init() 没人调用，
    // 导致 globalData.openid 一直是空串，所有请求被后端 401 拒掉（静默失败）
    const openid = wx.getStorageSync("openid");
    if (openid) {
      this.globalData.openid = openid;
    } else {
      this.globalData.openid = "dev-" + Date.now();
      wx.setStorageSync("openid", this.globalData.openid);
    }
  },
});
