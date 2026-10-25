// 生成图标 CSS 写回 app.wxss 的 @@ICONS@@ 占位。
// 用法：node build-icons.js  （新增/改图标后在 icon.js 里改，然后跑一遍）
const fs = require("fs");
const path = require("path");
const icon = require("./icon");

const file = path.join(__dirname, "app.wxss");
let src = fs.readFileSync(file, "utf8");
const marker = "@@ICONS@@";
const i = src.indexOf(marker);
if (i < 0) {
  console.error("app.wxss 里找不到占位 @@ICONS@@");
  process.exit(1);
}
src = src.slice(0, i) + icon.css() + src.slice(i + marker.length);
fs.writeFileSync(file, src);
console.log("app.wxss 图标 CSS 已更新");
