const BASE = "https://gym.70kj.vip";

module.exports = {
  BASE,
  // 动作图片/动画挂在 BASE 下的 /media/{still|clip}/{id}.{webp|mp4}
  mediaStill: (id) => `${BASE}/media/still/${id}.webp`,
  mediaClip: (id) => `${BASE}/media/clip/${id}.mp4`,
};
