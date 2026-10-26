const config = require("./config");
const theme = require("./theme");

App({
  globalData: {
    base: config.BASE,
    openid: "",
  },
  // 测试期固定写死 openid，同一部手机永远同一个人，历史计划归属稳定。
  // 微信里 App.onLaunch 才会自动执行（原先写成 init() 没人调，openid 一直是空 → 全 401）。
  onLaunch() {
    this.globalData.openid = "dev-default";
    theme.hookAppLifecycle(); // 回前台时重新探测系统主题（跟随系统兜底）
  },
});
