// 人体正面轮廓 SVG data URI，按部位训练量控制填充深度
// 返回 data:image/svg+xml;base64 URI，供 <image> 组件渲染
// 微信小程序无 Buffer，用 encodeURIComponent + 手动 base64 实现

const SVG_TEMPLATE = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400" viewBox="0 0 200 400">',
  '<rect width="200" height="400" fill="transparent"/>',
  // 头
  '<ellipse cx="100" cy="52" rx="34" ry="38" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  // 躯干
  '<path d="M60 86 L60 200 Q60 210 70 210 L130 210 Q140 210 140 200 L140 86 Q140 76 130 76 L70 76 Q60 76 60 86 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  // 左臂
  '<path d="M56 88 L36 148 L40 160 L58 152 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  '<path d="M40 160 L38 210 L48 212 L52 162 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  // 右臂
  '<path d="M144 88 L164 148 L160 160 L142 152 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  '<path d="M160 160 L162 210 L152 212 L148 162 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  // 左腿
  '<path d="M62 210 L58 320 L78 320 L82 210 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  '<path d="M58 320 L54 370 L80 370 L82 320 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  // 右腿
  '<path d="M118 210 L122 320 L142 320 L138 210 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  '<path d="M122 320 L120 370 L146 370 L142 320 Z" fill="{OP}" stroke="{LINE}" stroke-width="2"/>',
  // 部位高亮层
  '<rect x="68" y="88" width="64" height="48" rx="6" fill="{AC}" opacity="{CHEST}"/>',
  '<rect x="68" y="140" width="64" height="60" rx="4" fill="{AC}" opacity="{CORE}"/>',
  '<ellipse cx="62" cy="88" rx="18" ry="14" fill="{AC}" opacity="{SH}"/>',
  '<ellipse cx="138" cy="88" rx="18" ry="14" fill="{AC}" opacity="{SH}"/>',
  '<rect x="34" y="148" width="22" height="52" rx="8" fill="{AC}" opacity="{BI}"/>',
  '<rect x="144" y="148" width="22" height="52" rx="8" fill="{AC}" opacity="{BI}"/>',
  '<rect x="58" y="212" width="30" height="100" rx="6" fill="{AC}" opacity="{QUADS}"/>',
  '<rect x="112" y="212" width="30" height="100" rx="6" fill="{AC}" opacity="{QUADS}"/>',
  '</svg>',
].join("");

const THEMES = {
  dark:   { ac: "#00E08A", op: "#1E2128", line: "#262A33" },
  light:  { ac: "#059E58", op: "#F6F0EF", line: "#EAE5E3" },
};

function buildBodyMap(radar, theme) {
  const t = THEMES[theme] || THEMES.dark;
  const byKey = {};
  (radar || []).forEach((r) => { byKey[r.key] = r.pct || 0; });

  const op = (key) => Math.round(0.12 + ((byKey[key] || 0) / 100) * 0.88);

  const svg = SVG_TEMPLATE
    .replace(/\{OP\}/g, t.op)
    .replace(/\{LINE\}/g, t.line)
    .replace(/\{AC\}/g, t.ac)
    .replace(/\{CHEST\}/g, op("chest"))
    .replace(/\{CORE\}/g, op("core"))
    .replace(/\{SH\}/g, op("shoulders"))
    .replace(/\{BI\}/g, op("biceps"))
    .replace(/\{QUADS\}/g, op("quadriceps"));

  // 小程序无 Buffer，用 encodeURIComponent 拼 URL-encoded data URI（<image> 支持）
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

module.exports = { buildBodyMap };
