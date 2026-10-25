const api = require("../../api");
const theme = require("../../theme");
const i18n = require("../../i18n");
const user = require("../../user");
const exdict = require("../../exdict");

// 肌群中文标签（值必须是 DB 里的英文 muscle，查不到要改值别改标签）
const MUSCLE_ZH = {
  quadriceps: "大腿前侧",
  hamstrings: "大腿后侧",
  glutes: "臀部",
  core: "核心",
  shoulders: "肩部",
  chest: "胸部",
  "upper back": "上背",
  biceps: "二头",
  triceps: "三头",
};

// 器材/部位/类型中文（DB 是 openGym 英文值，界面上尽量全中文）
const EQUIP_ZH = {
  "body weight": "自重",
  dumbbell: "哑铃",
  dumbbells: "哑铃",
  barbell: "杠铃",
  "trap bar": "六角杠",
  kettlebell: "壶铃",
  cable: "绳索",
  "leverage machine": "杠杆器械",
  machine: "器械",
  band: "弹力带",
  "resistance band": "弹力带",
  "medicine ball": "药球",
  "stability ball": "健身球",
  "bosu ball": "波速球",
  smith: "史密斯机",
  "smith machine": "史密斯机",
  landmine: "地雷管",
  "wheel roller": "健腹轮",
  roller: "健腹轮",
  rope: "绳索",
  suspension: "悬挂",
  tire: "轮胎",
  sandbag: "沙袋",
  sled: "雪橇",
  "sledge hammer": "大锤",
  "ez barbell": "弯杠",
  "olympic barbell": "奥林匹克杆",
  "suspension trainer": "悬挂",
  bodyweight: "自重",
  weighted: "负重",
  "weight plate": "杠铃片",
  "foam roller": "泡沫轴",
  towel: "毛巾",
  chair: "椅子",
  "step box": "台阶箱",
  medicine: "药球",
  "swiss ball": "健身球",
  mace: "锤铃",
  macebells: "锤铃",
  assisted: "助力",
};

const PART_ZH = {
  "upper back": "上背",
  "lower back": "下背",
  quadriceps: "大腿",
  quads: "大腿",
  hamstrings: "大腿",
  glutes: "臀部",
  chest: "胸部",
  shoulders: "肩部",
  biceps: "手臂",
  triceps: "手臂",
  core: "核心",
  "full body": "全身",
  legs: "腿部",
  back: "背部",
  arms: "手臂",
};

const CAT_ZH = {
  strength: "力量",
  cardio: "有氧",
  plyometrics: "弹跳",
  balance: "平衡",
  mobility: "活动度",
  stretching: "拉伸",
  bodybuilding: "健体",
  functional: "功能",
  isometric: "静力",
  "martial arts": "搏击",
  "olympic lift": "举重",
  plyo: "弹跳",
  powerlifting: "力量",
  pilates: "普拉提",
  yoga: "瑜伽",
};

function zh(v, map) {
  if (v == null || v === "") return "";
  const s = Array.isArray(v) ? v : [v];
  return s.map((x) => map[x] || x).join(" · ");
}

Page({
  data: {
    q: "",
    muscle: "",
    // 值必须是 DB 里的英文 muscle（"back" 查不到，DB 用 "upper back"）
    muscles: ["quadriceps", "hamstrings", "glutes", "core", "shoulders", "chest", "upper back", "biceps", "triceps"],
    muscleZh: MUSCLE_ZH,
    list: [],
    loading: false,
    detail: null,
    // 图片/视频加载失败的 id（失败则隐藏 media，只留文字）
    imgErr: {},
    clipErr: {},
    equipZh: EQUIP_ZH,
    partZh: PART_ZH,
    catZh: CAT_ZH,
    faved: false,
  },

  onImgErr(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ [`imgErr.${id}`]: true });
  },

  onClipErr(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ [`clipErr.${id}`]: true });
  },

  onShow() {
    if (typeof this.getTabBar === "function") this.getTabBar().setData({ selected: 2 });
    theme.sync(this);
    i18n.sync(this);
    if (!this._offLang) this._offLang = i18n.onChange(() => i18n.sync(this));
    exdict.load(() => {});
    // 从「我的」页点收藏动作跳来：自动弹该动作详情
    const openId = wx.getStorageSync("openExId");
    if (openId) {
      wx.removeStorageSync("openExId");
      this.openByExId(openId);
      return;
    }
    this.search("");
  },

  // 打开详情前先显示占位（字典名），后台拉列表命中后补全 media/器材字段
  openByExId(id) {
    const fallback = {
      id: String(id),
      name: exdict.nameZh(id) || "#" + id,
      name_zh: exdict.nameZh(id) || "#" + id,
      img_url: "",
      clip_url: "",
    };
    this.setData({ detail: fallback, faved: user.isFavEx(fallback.id) });
    api.exercises({ limit: 60 })
      .then((raw) => {
        const hit = (raw || []).find((x) => String(x.id) === String(id));
        if (hit && this.data.detail && this.data.detail.id === String(id)) {
          this.showDetailObj(hit);
        }
      })
      .catch(() => {});
  },

  onSearch(e) {
    this.setData({ q: e.detail.value });
    this.search(e.detail.value);
  },

  pickMuscle(e) {
    const m = e.currentTarget.dataset.m;
    this.setData({ muscle: this.data.muscle === m ? "" : m });
    this.search(this.data.q);
  },

  // 把每条 list 的英文字段映射成中文展示字段
  decorate(list) {
    return (list || []).map((x) => ({
      ...x,
      equipment_zh: zh(x.equipment, this.data.equipZh),
      muscle_zh: zh(x.muscle, this.data.partZh),
      cat_zh: zh(x.cat, this.data.catZh),
      muscles_zh: zh(x.muscles, this.data.partZh),
      name_zh: exdict.nameZh(x.id) || x.name_zh || x.name,
    }));
  },

  async search(q) {
    this.setData({ loading: true });
    try {
      const raw = await api.exercises({ q: q || undefined, muscle: this.data.muscle || undefined, limit: 60 });
      this.setData({ list: this.decorate(raw), loading: false, detail: null });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: "搜索失败", icon: "none" });
    }
  },

  showDetail(e) {
    const ex = e.currentTarget.dataset.ex;
    this.showDetailObj(ex);
  },

  showDetailObj(ex) {
    const d = this.decorate([ex])[0];
    this.setData({ detail: d, faved: user.isFavEx(d.id) });
  },

  toggleFav() {
    const d = this.data.detail;
    if (!d) return;
    user.toggleFavEx(d.id);
    this.setData({ faved: user.isFavEx(d.id) });
  },

  closeSheet() {
    this.setData({ detail: null });
  },
});
