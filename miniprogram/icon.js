// 图标：一份 SVG 做 mask，颜色由 background-color（CSS 变量 --ic）提供。
// 用法：<view class="ic ic-heart ic--acc" />
// mask 的 SVG 统一 24x24、stroke #000、stroke-width 2（lucide 风格）。
// 注意：组件（topbar / custom-tab-bar）因样式隔离拿不到 app.wxss 的 .ic 类，
// 它们的图标各自在本地 wxss 写死 base64。
const S = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">";

const ICONS = {
  // 通用
  chevron: "<path d=\"m9 18 6-6-6-6\"/>",
  plus: "<path d=\"M12 5v14\"/><path d=\"M5 12h14\"/>",
  minus: "<path d=\"M5 12h14\"/>",
  close: "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>",
  check: "<path d=\"M20 6.5 9 17.5l-5-5\"/>",
  refresh: "<path d=\"M20.5 12a8.5 8.5 0 0 0-14.6-5.9L3 9\"/><path d=\"M3 3.5V9h5.5\"/><path d=\"M3.5 12a8.5 8.5 0 0 0 14.6 5.9L21 15\"/><path d=\"M21 20.5V15h-5.5\"/>",
  search: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20.5 20.5-4.2-4.2\"/>",
  info: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8h.01\"/><path d=\"M11 12h1v4h1\"/>",
  heart: "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/>",
  camera: "<path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/>",
  share: "<circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"m8.6 13.5 6.8 3.9\"/><path d=\"M15.4 6.6 8.6 10.5\"/>",
  moon: "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
  sun: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.9 4.9 1.4 1.4\"/><path d=\"m17.7 17.7 1.4 1.4\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m4.9 19.1 1.4-1.4\"/><path d=\"m17.7 6.3 1.4-1.4\"/>",
  clock: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  // 健身
  target: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/>",
  flame: "<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 2 5.5 0 7.5-1.34 1.18-3.5 1.18-5 .5\"/><path d=\"M12.5 22c4.5-2 6.5-5 6.5-9 0-1.5-.5-3-2-4.5\"/><path d=\"M13.5 3.5c-1 2.5-.5 4.5 1 6\"/>",
  user: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M5 21c0-3.5 3-6 7-6s7 2.5 7 6\"/>",
  activity: "<path d=\"M22 12h-4l-3 8L9 4l-3 8H2\"/>",
  dumbbell: "<rect x=\"0\" y=\"9.5\" width=\"3\" height=\"5\" rx=\"1\"/><rect x=\"21\" y=\"9.5\" width=\"3\" height=\"5\" rx=\"1\"/><rect x=\"4\" y=\"7.5\" width=\"4\" height=\"9\" rx=\"1\"/><rect x=\"16\" y=\"7.5\" width=\"4\" height=\"9\" rx=\"1\"/><path d=\"M8 12h8\"/>",
  calendar: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"/><path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><path d=\"M3 9h18\"/>",
  list: "<path d=\"M8 6h13\"/><path d=\"M8 12h13\"/><path d=\"M8 18h13\"/><path d=\"M3 6h.01\"/><path d=\"M3 12h.01\"/><path d=\"M3 18h.01\"/>",
  clipboard: "<rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"M9 12h6\"/><path d=\"M9 16h6\"/>",
  book: "<path d=\"M4 19.5A2.5 2.5 0 0 1 6.5 17H20\"/><path d=\"M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z\"/>",
  // 我的页
  moonfill: "<path fill=\"#000\" stroke=\"none\" d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
  lang: "<path d=\"m5 8 6 6\"/><path d=\"m4 14 6-6 2-3\"/><path d=\"M2 5h12\"/><path d=\"M7 2h1\"/><path d=\"m22 22-5-10-5 10\"/><path d=\"M14 18h6\"/>",
};

function css() {
  let out = ".ic{--ic:var(--ink-3);background-color:var(--ic);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:100% 100%;mask-size:100% 100%;width:38rpx;height:38rpx;flex:none;display:block;}\n";
  out += ".ic--ink{--ic:var(--ink)}.ic--ink2{--ic:var(--ink-2)}.ic--acc{--ic:var(--accent)}.ic--w{--ic:var(--on-solid)}\n";
  out += "page .ic{width:40rpx;height:40rpx}\n";
  Object.keys(ICONS).forEach((k) => {
    const svg = S + ICONS[k] + "</svg>";
    const b64 = Buffer.from(svg).toString("base64");
    const url = "url(\"data:image/svg+xml;base64," + b64 + "\")";
    out += ".ic-" + k + "{-webkit-mask-image:" + url + ";mask-image:" + url + "}\n";
  });
  return out;
}

module.exports = { css };
