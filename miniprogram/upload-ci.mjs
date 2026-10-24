// miniprogram-ci 上传脚本：推送 main → 自动上传开发版到微信后台。
// 读 process.env.WX_CI_UPLOAD_KEY（GitHub Actions 注入），从 project.config.json 读 appid，
// 从 miniprogram/package.json 读版本号（SemVer，提交时手动 bump，同 huidasuan 规矩）。

import ci from "miniprogram-ci";
import { readFileSync } from "node:fs";

const appid = JSON.parse(readFileSync("project.config.json", "utf8")).appid;
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const key = process.env.WX_CI_UPLOAD_KEY;

if (!key) {
  console.error("缺少 WX_CI_UPLOAD_KEY（在 GitHub Secrets 里配置）");
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
