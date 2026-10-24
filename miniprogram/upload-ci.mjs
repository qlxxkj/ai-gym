// miniprogram-ci 上传脚本：推送 main → 自动上传开发版到微信后台。
// 读 process.env.WX_CI_UPLOAD_KEY（GitHub Actions 注入），从 project.config.json 读 appid，
// 从 miniprogram/package.json 读版本号（SemVer，提交时手动 bump，同 huidasuan 规矩）。

import ci from "miniprogram-ci";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

// 把 secret 里的密钥规整成合法 PEM。
// OpenSSL 3（GitHub Actions 的 node 内置）对密钥解析很严格：粘贴 secret 时换行被压没、
// 或 PKCS1/PKCS8 混用，会报 "DECODER routines::unsupported" / "asn1 ... too long"。
// 这里不靠补换行的运气：剥出 base64 正文 → 按识别出的类型解析成 KeyObject →
// 统一重导出成干净 PKCS8 PEM。兼容：整段 PEM（丢没丢换行都行）/ 裸 base64 / base64 编码后的 PEM。
function normalizeKey(raw) {
  let k = String(raw).trim();
  // secret 存成一行 base64 时，先解码还原成 PEM 文本
  if (!k.includes("BEGIN") && /^[A-Za-z0-9+/\s=]+$/.test(k)) {
    try {
      const dec = Buffer.from(k.replace(/\s/g, ""), "base64").toString("utf8");
      if (dec.includes("BEGIN")) k = dec;
    } catch {}
  }
  let begin = k.match(/-----\s*BEGIN([A-Z ]*?)\s*PRIVATE\s*KEY\s*-----/);
  let end = k.match(/-----\s*END([A-Z ]*?)\s*PRIVATE\s*KEY\s*-----/);
  // 兼容「裸 base64 正文」secret：没有 PEM 头尾，整段就是 base64 编码的 DER。
  // 此时把整段当 DER 解析（先试 PKCS8 再试 PKCS1），统一重导出 PKCS8 PEM。
  if (!begin || !end) {
    const der = Buffer.from(k.replace(/\s/g, ""), "base64");
    for (const type of ["pkcs8", "pkcs1"]) {
      try {
        const ko = crypto.createPrivateKey({ key: der, format: "der", type });
        return ko.export({ type: "pkcs8", format: "pem" });
      } catch {}
    }
    throw new Error("密钥里没找到 PEM 段，且裸 base64 无法按 PKCS8/PKCS1 解析。请确认 secret 是「小程序密钥文件」整串内容");
  }
  const label = (begin[1] || "").replace(/\s+/g, " ").trim(); // "RSA"(PKCS1) 或 ""(PKCS8)
  const bIdx = k.indexOf(begin[0]);
  const eIdx = k.indexOf(end[0]);
  const body = k.slice(bIdx + begin[0].length, eIdx).replace(/\s+/g, "");
  const isPkcs1 = /^RSA$/.test(label);
  const ko = crypto.createPrivateKey({
    key: Buffer.from(body, "base64"),
    format: "der",
    type: isPkcs1 ? "pkcs1" : "pkcs8",
  });
  return ko.export({ type: "pkcs8", format: "pem" });
}

// appid 优先取 secret（WX_APPID），没有则回退读 project.config.json。
// project.config.json 里的 appid 保留给微信开发者工具本地调试用。
const cfgAppid = JSON.parse(readFileSync("project.config.json", "utf8")).appid;
const appid = process.env.WX_APPID || cfgAppid;
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const rawKey = process.env.WX_CI_UPLOAD_KEY;

if (!rawKey) {
  console.error("缺少 WX_CI_UPLOAD_KEY（在 GitHub Secrets 里配置）");
  process.exit(1);
}
if (!appid || appid === "填你的AppID") {
  console.error(`缺少 appid：project.config.json 里是占位值，且没配 WX_APPID secret`);
  process.exit(1);
}
let key;
try {
  key = normalizeKey(rawKey);
} catch (e) {
  console.error("WX_CI_UPLOAD_KEY 格式无法解析：", e.message);
  process.exit(1);
}
console.log("密钥规整完成，PEM 头:", key.split("\n")[0]);

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
