// 微信小程序登录：wx.login 拿 code → code2Session 换 openid。
// openid 是微信给每个用户在该小程序下的唯一标识，每个真人一个，
// 替代测试期的写死编号，各用户数据互不干扰。
const crypto = require("crypto");
const https = require("https");

const APPID = process.env.WX_APPID || "";
const SECRET = process.env.WX_SECRET || "";

// 每个 code 只能用一次，且几秒过期；同一次启动重试时拿同个 code 会 40029/41002，
// 按 (appid, code) 做进程内缓存，避免重复打接口被微信限流
const sessionCache = new Map();

function code2Session(code) {
  const key = APPID + ":" + code;
  const hit = sessionCache.get(key);
  if (hit && Date.now() - hit.ts < 3 * 60 * 1000) return Promise.resolve(hit.data);
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(
      APPID
    )}&secret=${encodeURIComponent(SECRET)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    https.get(url, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => {
        try {
          const j = JSON.parse(b);
          if (j.openid) {
            sessionCache.set(key, { ts: Date.now(), data: j });
            if (sessionCache.size > 200) sessionCache.delete(sessionCache.keys().next().value);
            resolve(j);
          } else {
            // 微信返回 errcode：40029 code 无效、41002 code 已被用过、40125 appid/secret 错
            reject(new Error("code2session: " + (j.errmsg || j.errcode || "no openid")));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

module.exports = { code2Session, hasCredentials: () => !!(APPID && SECRET) };
