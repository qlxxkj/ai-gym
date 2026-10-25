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
  abdominals: "腹部",
  adductors: "内收肌",
  "ankle stabilizers": "踝关节稳定肌",
  ankles: "踝",
  back: "背部",
  brachialis: "肱肌",
  calves: "小腿",
  deltoids: "三角肌",
  feet: "足部",
  forearms: "前臂",
  "grip muscles": "握力肌",
  groin: "腹股沟",
  hands: "手部",
  "hip flexors": "髂腰肌",
  "inner thighs": "大腿内侧",
  "latissimus dorsi": "背阔肌",
  lats: "背阔肌",
  "lower abs": "下腹",
  "lower back": "下背",
  obliques: "腹斜肌",
  "rear deltoids": "后三角",
  rhomboids: "菱形肌",
  "rotator cuff": "肩袖",
  shins: "胫骨",
  soleus: "比目鱼肌",
  sternocleidomastoid: "胸锁乳突肌",
  trapezius: "斜方肌",
  traps: "斜方肌",
  "upper chest": "上胸",
  "wrist extensors": "腕伸肌",
  "wrist flexors": "腕屈肌",
  wrists: "腕",
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
  "sled machine": "雪橇车",
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
  macebell: "锤铃",
  assisted: "助力",
  "elliptical machine": "椭圆机",
  "stationary bike": "动感单车",
  "stepmill machine": "阶梯机",
  "upper body ergometer": "划船机",
  "skierg machine": "滑雪机",
  hammer: "锤",
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
  abdominals: "腹部",
  adductors: "内收肌",
  "ankle stabilizers": "踝关节稳定肌",
  ankles: "踝",
  brachialis: "肱肌",
  calves: "小腿",
  deltoids: "三角肌",
  feet: "足部",
  forearms: "前臂",
  "grip muscles": "握力肌",
  groin: "腹股沟",
  hands: "手部",
  "hip flexors": "髂腰肌",
  "inner thighs": "大腿内侧",
  "latissimus dorsi": "背阔肌",
  lats: "背阔肌",
  "lower abs": "下腹",
  obliques: "腹斜肌",
  "rear deltoids": "后三角",
  rhomboids: "菱形肌",
  "rotator cuff": "肩袖",
  shins: "胫骨",
  soleus: "比目鱼肌",
  sternocleidomastoid: "胸锁乳突肌",
  trapezius: "斜方肌",
  traps: "斜方肌",
  "upper chest": "上胸",
  "wrist extensors": "腕伸肌",
  "wrist flexors": "腕屈肌",
  wrists: "腕",
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
  combat: "搏击",
  "olympic lift": "举重",
  olympic: "举重",
  plyo: "弹跳",
  powerlifting: "力量",
  pilates: "普拉提",
  yoga: "瑜伽",
  calisthenics: "自重",
  rehab: "康复",
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
    langEn: false,
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
    exStats: {}, // { "exId": { count, pct } } 近期训练组数（数据分析页拉）
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
    if (typeof this.getTabBar === "function") this.getTabBar().setData({ selected: 2 }); // tab: plan/today/exercises/profile
    theme.sync(this);
    i18n.sync(this);
    this.setData({ langEn: this.data.lang === "en" });
    // 切语言：重建当前语言展示（字典名/肌群器材标签全跟语言走）
    if (!this._offLang) this._offLang = i18n.onChange(() => {
      i18n.sync(this);
      this.setData({ langEn: this.data.lang === "en" });
      this.relang();
    });
    exdict.load(() => this.relang());
    // 近期训练统计（组数）后台拉，用来给列表画进度条；失败静默
    api.stats().then((s) => {
      const top = (s && s.top_exercises || []).map((x) => x.exercise_id);
      const maxSets = s && s.top_exercises && s.top_exercises[0] ? Number(s.top_exercises[0].sets) || 1 : 1;
      const exStats = {};
      (s && s.top_exercises || []).forEach((x) => {
        exStats[x.exercise_id] = { count: Number(x.sets) || 0, pct: Math.round(((Number(x.sets) || 0) / maxSets) * 100) };
      });
      this.setData({ exStats, exTopIds: top });
      this.relang();
    }).catch(() => {});
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
    const en = this.data.lang === "en";
    const nm = en ? exdict.nameEn(id) : exdict.nameZh(id) || exdict.nameEn(id);
    const fallback = {
      id: String(id),
      name: nm || "#" + id,
      name_zh: nm || "#" + id,
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

  // 字典到位 / 切语言后按当前语言重刷展示
  relang() {
    const list = this.decorate(this.data.list);
    const patch = { list };
    if (this.data.detail) patch.detail = this.decorate([this.data.detail])[0];
    this.setData(patch);
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

  // 把每条 list 的英文字段映射成当前语言展示字段（en 保持英文，zh 用中文表）
  // 附：_count/_pct = 近期训练组数进度；_faved = 本地收藏态
  decorate(list) {
    const en = this.data.lang === "en";
    const stats = this.data.exStats || {};
    return (list || []).map((x) => ({
      ...x,
      equipment_zh: en ? zh(x.equipment, {}) : zh(x.equipment, this.data.equipZh),
      muscle_zh: en ? zh(x.muscle, {}) : zh(x.muscle, this.data.partZh),
      cat_zh: en ? zh(x.cat, {}) : zh(x.cat, this.data.catZh),
      muscles_zh: en ? zh(x.muscles, {}) : zh(x.muscles, this.data.partZh),
      name_zh: en ? exdict.nameEn(x.id) || x.name : exdict.nameZh(x.id) || x.name_zh || x.name,
      _count: stats[x.id] ? stats[x.id].count : 0,
      _pct: stats[x.id] ? stats[x.id].pct : 0,
      _faved: user.isFavEx(x.id),
    }));
  },

  async search(q) {
    this.setData({ loading: true });
    try {
      const raw = await api.exercises({
        q: q || undefined,
        muscle: this.data.muscle || undefined,
        lang: this.data.lang, // 英文模式搜索不命中中文名
        limit: 60,
      });
      this.setData({ list: this.decorate(raw), loading: false, detail: null });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: this.data.lang === "en" ? "Search failed" : "搜索失败", icon: "none" });
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
    // 轻反馈 + 提示已进「我的」收藏
    wx.vibrateShort({ type: "light" });
    wx.showToast({
      title: this.data.lang === "en" ? (this.data.faved ? "Favorited" : "Removed") : this.data.faved ? "已加入收藏" : "已取消收藏",
      icon: "none",
    });
  },

  closeSheet() {
    this.setData({ detail: null });
  },

  // 列表行收藏（catchtap 阻止冒泡，不触发 showDetail）
  toggleListFav(e) {
    const ex = e.currentTarget.dataset.ex;
    if (!ex) return;
    user.toggleFavEx(ex.id);
    const faved = user.isFavEx(ex.id);
    this.setData({
      list: this.data.list.map((x) => (x.id === ex.id ? { ...x, _faved: faved } : x)),
    });
    wx.vibrateShort({ type: "light" });
    wx.showToast({
      title: this.data.lang === "en" ? (faved ? "Favorited" : "Removed") : faved ? "已加入收藏" : "已取消收藏",
      icon: "none",
    });
  },

  // AI 生成：基于选中的动作让 AI 出一份计划（form 页的快捷入口）
  goForm() {
    wx.navigateTo({ url: "/pages/form/form" });
  },
});
