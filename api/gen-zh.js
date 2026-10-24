#!/usr/bin/env node
// 离线生成 actions 表 name_zh 列数据：拉 /exercises 全量，用组合翻译器逐个翻，
// 输出到 exports（server.js 启动时灌库，中文搜索才命得到）。
// 运行：node gen-zh.js > exercises-zh.data.js（输出是 module.exports 数组），
// 或直接 require 本脚本跑生成（无数据库依赖，纯本地）。

const https = require("https");
const { translateZh } = require("./name-zh.js");

const BASE = process.env.MEDIA_BASE || "https://gym.70kj.vip";

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(BASE + path, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => resolve(JSON.parse(b)));
    }).on("error", reject);
  });
}

(async () => {
  // 全量动作（上限 500/次，openGym 共 5632 条，需翻页）
  const all = [];
  for (let off = 0; off < 10000; off += 500) {
    const page = await get(`/exercises?limit=500&offset=${off}`);
    all.push(...page);
    if (page.length < 500) break;
  }
  const rows = all.map((x) => ({ name: x.name, zh: translateZh(x.name) || x.name }));
  // 写成 server.js 直接可 require 的模块
  const out = "// 生成于 " + new Date().toISOString() + "，共 " + rows.length + " 条\nmodule.exports = " + JSON.stringify(rows, null, 0) + ";\n";
  process.stdout.write(out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
