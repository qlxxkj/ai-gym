const config = require("./config");

App({
  globalData: {
    base: config.BASE,
    openid: "",
  },
  // MVP：openid 固定 dev-default，不再用本地缓存（缓存里可能残留旧版本的 dev-时间戳，
  // 导致生成/查看挂在两个不同编号下，「今天」页拉不到刚生成的计划）。
  // 正式接 wx.login → 后端 code2session 换成真实 openid。
  onLaunch() {
    this.globalData.openid = "dev-default";
  },
});
