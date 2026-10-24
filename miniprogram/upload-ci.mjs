// miniprogram-ci 上传脚本：推送 main → 自动上传开发版到微信后台。
// 读 process.env.WX_CI_UPLOAD_KEY（GitHub Actions 注入），从 project.config.json 读 appid，
// 从 miniprogram/package.json 读版本号（SemVer，提交时手动 bump，同 huidasuan 规矩）。

import ci from "miniprogram-ci";
import { readFileSync } from "node:fs";

// appid 优先取 secret（WX_APPID），没有则回退读 project.config.json。
// project.config.json 里的 appid 保留给微信开发者工具本地调试用。
const cfgAppid = JSON.parse(readFileSync("project.config.json", "utf8")).appid;
const appid = process.env.WX_APPID || cfgAppid;
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const key = process.env.WX_CI_UPLOAD_KEY;

if (!key) {
  console.error("缺少 WX_CI_UPLOAD_KEY（在 GitHub Secrets 里配置）");
  process.exit(1);
}
if (!appid || appid === "填你的AppID") {
  console.error(`缺少 appid：project.config.json 里是占位值，且没配 WX_APPID secret`);
  process.exit(1);
}

const project = new ci.Project({
  appid,
  type: "miniProgram",
  projectPath: ".",
  privateKey: key,
  ignores: ["node_modules/**/*"],
});

await ci.upload({
  project,
  version,
  desc: `CI auto-upload ${new Date().toISOString()}`,
  robot: 1,
  onProgressUpdate: console.log,
});

console.log(`开发版已上传（appid=${appid}, version=${version}），请在微信后台选为体验版或提审`);
