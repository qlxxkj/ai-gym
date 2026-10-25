// 用户信息（本地存储，无真实登录）：
//   userAvatar  头像路径（wx.chooseImage 的本地临时路径 / 缓存路径），空则用默认占位
//   userNick    昵称，默认「健身伙伴」
//   favPlans    收藏的计划 id 数组
//   favExercises 收藏的动作 id 数组
const version = require("./version");

function isFav(list, id) {
  return (list || []).indexOf(id) > -1;
}

function toggle(list, id) {
  const arr = (list || []).slice();
  const i = arr.indexOf(id);
  if (i > -1) arr.splice(i, 1);
  else arr.push(id);
  return arr;
}

function avatar() {
  return wx.getStorageSync("userAvatar") || "";
}

function nick() {
  return wx.getStorageSync("userNick") || "";
}

function favPlans() {
  return wx.getStorageSync("favPlans") || [];
}

function favExercises() {
  return wx.getStorageSync("favExercises") || [];
}

module.exports = {
  VERSION: version,
  avatar,
  setAvatar: (p) => wx.setStorageSync("userAvatar", p || ""),
  nick,
  setNick: (n) => wx.setStorageSync("userNick", n || ""),
  favPlans,
  favExercises,
  isFavPlan: (id) => isFav(favPlans(), id),
  isFavEx: (id) => isFav(favExercises(), id),
  toggleFavPlan: (id) => wx.setStorageSync("favPlans", toggle(favPlans(), id)),
  toggleFavEx: (id) => wx.setStorageSync("favExercises", toggle(favExercises(), id)),
};
