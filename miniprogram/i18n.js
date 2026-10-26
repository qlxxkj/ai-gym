// UI 多语言：zh / en。
// 只管界面文案（按钮、标签、tabBar、导航栏等）；toast/modal 中文提示暂不翻译。
//
// 用法（对齐 daily-poetry）：
//   - 页面 onShow 里 i18n.sync(this) 把当前语言词典写进 data.T；
//   - wxml 里用 {{T.xxx}}；
//   - 切语言走 i18n.setLang(lang)，广播给已注册页面，各自刷新。

const DICT = {
  zh: {
    tab_plan: "计划",
    tab_today: "今日",
    tab_daily: "今天",
    tab_exercises: "动作",
    tab_profile: "我的",
    tab_stats: "数据",
    tab_form: "新建计划",
    tab_today_first: "首页",

    nav_plan: "我的计划",
    nav_daily: "今天训练",
    nav_exercises: "动作库",
    nav_profile: "我的",
    nav_form: "新建计划",

    // 计划页
    plan_new: "＋ 新建计划",
    plan_new2: "新建计划",
    plan_loading: "正在加载计划…",
    plan_load_err: "计划加载失败",
    plan_no_t: "还没有训练计划",
    plan_no_s: "填写目标，AI 为你定制",
    plan_goal: "目标",
    plan_v: "第",
    plan_v2: "版",
    plan_day: "第",
    plan_day_suf: "天",
    plan_set: "组",
    plan_reps: "次",
    plan_rest_s: "秒",
    plan_rest_lb: "组间休息",
    plan_tips: "教练提示",
    plan_review: "本周 AI 复盘",
    plan_review_close: "关闭",
    plan_apply: "采纳建议并更新计划",
    plan_apply_ing: "应用中…",
    plan_pending: "AI 建议 · 待你确认",
    plan_pending_note: "确认采纳后 AI 才会修改计划",
    plan_do_review: "AI 周复盘",
    plan_reviewing: "复盘中…",
    plan_revise: "让 AI 调整计划",
    plan_expand: "展开",
    plan_collapse: "收起",
    fav_on: "已收藏",
    fav_off: "收藏",

    // 今天页
    daily_empty_t: "今天没有训练",
    daily_empty_s: "先去「计划」页生成训练计划",
    daily_loading: "加载中…",
    daily_sub: "来自《",
    daily_sub_end: "》，逐项打勾完成训练",
    daily_rest: "组间休息",
    daily_all_done: "全部完成，点击打卡",
    daily_set: "组",
    daily_sets_u: "组",
    daily_sec_u: "秒",
    daily_reps_u: "次",
    daily_rest_u: "间歇",

    // 动作页
    ex_sub: "查动作、看示范",
    ex_ph: "搜索动作，如 深蹲 / 卧推",
    ex_none: "没有匹配动作",
    ex_equip: "器材",
    ex_muscle: "主肌群",
    ex_assist: "辅助肌群",
    ex_close: "关闭",
    ex_fav: "收藏",
    ex_faved: "已收藏",
    ex_done_u: "近期组数",
    ex_reps_u: "次",
    ex_ai_btn: "＋ 让 AI 生成计划",

    mine_title: "健身伙伴",
    mine_nofav: "去收藏",
    mine_plan: "计划",
    mine_ex: "动作",

    // 表单页
    form_title: "你的训练计划",
    form_sub: "选几个选项，AI 为你定制专属计划",
    form_goal: "目标",
    form_level: "水平",
    form_freq: "每周训练次数",
    form_time: "单次时长",
    form_equip: "可用器材",
    form_focus: "重点肌群（可多选）",
    form_notes: "补充说明（伤病、偏好等）",
    form_notes_ph: "例如：膝盖旧伤，避免深蹲；偏好徒手训练",
    form_submit: "生成我的训练计划",
    form_submit_ing: "AI 制定中…",
    form_times_u: "次",
    form_time_u: "分钟",

    // 我的页
    mine_nick_ph: "点击设置昵称",
    mine_faved_prefix: "已收藏 ",
    mine_faved_suffix: " 项",
    sec_fav: "我的收藏",
    sec_fav_plans: "训练计划",
    sec_fav_ex: "收藏动作",
    sheet_fav_empty_plan: "还没有收藏的计划，去「计划」页点收藏",
    sheet_fav_empty_ex: "还没有收藏的动作，去「动作」页点收藏",
    mine_fav_empty: "去「计划」「动作」页点 ♥ 收藏",
    sec_settings: "我的设置",
    sec_stats: "数据分析",
    mine_appearance: "外观",
    mine_text: "语言",
    sec_share: "分享",
    share_friend: "分享给好友",
    sec_about: "关于",
    about_version: "版本",
    about_brand: "AI 健身教练",
    about_desc: "AI 定制计划 · 每日打卡 · 动作库",

    theme_dark: "暗色",
    theme_auto: "跟随系统",
    theme_light: "浅色",
    lang_zh: "中文",
    lang_en: "English",

    // 今日页
    loading: "加载中…",
    today_hi: "开始今天",
    today_no_plan: "还没有训练计划，去生成一个",
    today_go_plan: "去生成计划",
    today_from: "来自",
    week_progress: "本周打卡",
    today_rest: "组间休息",
    today_all_done: "全部完成，点击打卡",
    today_set: "组",
    today_sets_u: "组",
    today_reps_u: "次",
    today_sec_u: "秒",
    today_rest_u: "间歇",
    today_sets7: "近 7 天完成组数",
    today_q_daily: "今天页",
    today_q_ex: "动作库",
    today_q_stats: "数据分析",

    // 今日页 AI 教练卡（规则可解释，非模型输出）
    today_est: "预计",
    today_est_min: "分钟",
    today_ex_u: "个动作",
    today_recover: "恢复状态",
    recover_good: "恢复充分，可按计划练",
    recover_mid: "恢复中等，注意间歇质量",
    recover_low: "恢复偏低，建议减量",
    coach_rest: "今天是恢复日：建议泡沫轴滚揉 10 分钟 + 快走 20 分钟，不动大肌群。",
    coach_streak: "本周还没打卡，今天先把前 3 个动作做完再评估加量。",
    coach_ready: "状态可以，按计划执行；每个动作完成最后一组时，如提前力竭就记 RPE 7。",
    last_w: "上次",
    today_coach: "AI 教练",
    rpe_lb: "RPE",
    rpe_hint: "打完一组可记 RPE（6 轻松 - 10 极限）",

    // 数据分析页
    st_total_days: "累计打卡天数",
    st_total_sets: "累计完成组数",
    st_total_reps: "累计次数",
    st_week7: "近 7 天组数",
    st_weekly: "每周打卡（近 8 周）",
    st_weekly_note: "本周目标",
    st_top_ex: "常用动作（近 90 天）",
    st_ex_sets: "组",
    st_weight: "体重",
    st_weight_ph: "输入体重 kg",
    st_weight_save: "记录",
    st_weight_saving: "记录中…",
    st_weight_empty: "还没有体重记录",
    st_1rm: "1RM 曲线（近 180 天）",
    st_bodymap: "肌群分布",
    st_bodymap_lo: "少",
    st_bodymap_hi: "多",
    st_radar: "肌群覆盖（近 90 天）",
    st_heat: "训练热力（近 26 周）",
    st_heat_note: "深绿 = 组数多",
    st_weight_target: "目标体重",
    st_weight_target_ph: "目标 kg",
    st_height: "身高",
    st_height_ph: "身高 cm",
    st_bmi: "BMI",
    st_bmi_thin: "偏瘦",
    st_bmi_normal: "正常",
    st_bmi_over: "偏重",
    st_bmi_obese: "超重",
    st_bmi_na: "填身高后计算",
  },

  en: {
    tab_plan: "Plan",
    tab_today: "Today",
    tab_daily: "Today",
    tab_exercises: "Moves",
    tab_profile: "Me",
    tab_stats: "Stats",
    tab_form: "New Plan",

    nav_plan: "My Plans",
    nav_daily: "Today",
    nav_exercises: "Exercises",
    nav_profile: "Me",
    nav_form: "New Plan",

    plan_new: "+ New Plan",
    plan_new2: "New Plan",
    plan_loading: "Loading plan…",
    plan_load_err: "Failed to load",
    plan_no_t: "No plans yet",
    plan_no_s: "Pick your goal, AI will build one",
    plan_goal: "Goal",
    plan_v: "v",
    plan_v2: "",
    plan_day: "Day",
    plan_day_suf: "",
    plan_set: "sets",
    plan_reps: "reps",
    plan_rest_s: "s",
    plan_rest_lb: "Rest",
    plan_tips: "Coach Tips",
    plan_review: "Weekly AI Review",
    plan_review_close: "Close",
    plan_apply: "Apply & update",
    plan_apply_ing: "Applying…",
    plan_pending: "AI suggestion · needs your confirm",
    plan_pending_note: "Plan only updates after you confirm",
    plan_do_review: "AI Review",
    plan_reviewing: "Reviewing…",
    plan_revise: "Ask AI to adjust",
    plan_expand: "Expand",
    plan_collapse: "Collapse",
    fav_on: "Favorited",
    fav_off: "Favorite",

    daily_empty_t: "Nothing to train",
    daily_empty_s: "Generate a plan in the Plan tab",
    daily_loading: "Loading…",
    daily_sub: "from “",
    daily_sub_end: "”",
    daily_rest: "Rest",
    daily_all_done: "All done, tap to check in",
    daily_set: "Set",
    daily_sets_u: "sets",
    daily_sec_u: "s",
    daily_reps_u: "reps",
    daily_rest_u: "Rest",

    ex_sub: "Browse & preview",
    ex_ph: "Search, e.g. squat",
    ex_none: "No matches",
    ex_equip: "Equipment",
    ex_muscle: "Main",
    ex_assist: "Assist",
    ex_close: "Close",
    ex_fav: "Favorite",
    ex_faved: "Favorited",
    ex_done_u: "Recent sets",
    ex_reps_u: "reps",
    ex_ai_btn: "+ Ask AI to build a plan",

    mine_title: "Gym Buddy",
    mine_nofav: "No faves",
    mine_plan: "plan",
    mine_ex: "move",

    form_title: "Your Training Plan",
    form_sub: "Pick a few options",
    form_goal: "Goal",
    form_level: "Level",
    form_freq: "Per week",
    form_time: "Length",
    form_equip: "Equipment",
    form_focus: "Focus (multi)",
    form_notes: "Notes",
    form_notes_ph: "e.g. knee injury, avoid squats",
    form_submit: "Build my plan",
    form_submit_ing: "Building…",
    form_times_u: "x",
    form_time_u: "min",

    mine_nick_ph: "Tap to set nickname",
    mine_faved_prefix: "Favorited ",
    mine_faved_suffix: "",
    sec_fav: "Favorites",
    sec_fav_plans: "Plans",
    sec_fav_ex: "Exercises",
    sheet_fav_empty_plan: "No favorited plans yet. Tap Favorite in the Plan tab",
    sheet_fav_empty_ex: "No favorited moves yet. Tap Favorite in the Moves tab",
    mine_fav_empty: "Tap ♥ in Plan / Moves tab",
    sec_settings: "Settings",
    sec_stats: "Analytics",
    mine_appearance: "Appearance",
    mine_text: "Language",
    sec_share: "Share",
    share_friend: "Share with friends",
    sec_about: "About",
    about_version: "Version",
    about_brand: "AI Coach",
    about_desc: "AI plans · daily check-in · library",

    theme_dark: "Dark",
    theme_auto: "System",
    theme_light: "Light",
    lang_zh: "中文",
    lang_en: "English",

    loading: "Loading…",
    today_hi: "Start today",
    today_no_plan: "No plan yet. Generate one",
    today_go_plan: "Generate plan",
    today_from: "from",
    week_progress: "This week",
    today_rest: "Rest",
    today_all_done: "All done, tap to check in",
    today_set: "Set",
    today_sets_u: "sets",
    today_reps_u: "reps",
    today_sec_u: "s",
    today_rest_u: "Rest",
    today_sets7: "Sets in last 7 days",
    today_q_daily: "Today tab",
    today_q_ex: "Moves",
    today_q_stats: "Analytics",

    today_est: "Est.",
    today_est_min: "min",
    today_ex_u: "moves",
    today_recover: "Recovery",
    recover_good: "Recover well, train as planned",
    recover_mid: "Moderate recovery, mind rest quality",
    recover_low: "Low recovery, consider reducing volume",
    coach_rest: "Recovery day: 10 min foam rolling + 20 min brisk walk. Skip heavy lifting.",
    coach_streak: "No check-in this week yet. Finish the first 3 moves, then decide on volume.",
    coach_ready: "Good to go. On the last set of each move, if you fail early, log RPE 7.",
    last_w: "Last",
    today_coach: "AI Coach",
    rpe_lb: "RPE",
    rpe_hint: "After a set, log RPE (6 easy - 10 max)",

    st_total_days: "Check-in days",
    st_total_sets: "Sets done",
    st_total_reps: "Total reps",
    st_week7: "Sets, last 7 days",
    st_weekly: "Weekly check-ins (8 weeks)",
    st_weekly_note: "Weekly goal",
    st_top_ex: "Most used moves (90 days)",
    st_ex_sets: "sets",
    st_weight: "Weight",
    st_weight_ph: "Weight in kg",
    st_weight_save: "Log",
    st_weight_saving: "Saving…",
    st_weight_empty: "No weight records yet",
    st_1rm: "1RM curve (180 days)",
    st_bodymap: "Muscle distribution",
    st_bodymap_lo: "Low",
    st_bodymap_hi: "High",
    st_radar: "Muscle coverage (90 days)",
    st_heat: "Training heatmap (26 weeks)",
    st_heat_note: "Darker = more sets",
    st_weight_target: "Target weight",
    st_weight_target_ph: "Target kg",
    st_height: "Height",
    st_height_ph: "Height in cm",
    st_bmi: "BMI",
    st_bmi_thin: "Underweight",
    st_bmi_normal: "Normal",
    st_bmi_over: "Overweight",
    st_bmi_obese: "Obese",
    st_bmi_na: "Enter height to compute",
  },
};

const KEY = "gym_lang"; // auto | zh | en
const FALLBACK = "zh";

function isLang(l) {
  return l === "zh" || l === "en";
}

// 语言只两档：中文 / 英文（产品要求去掉「跟随系统」），默认中文。
// 主题仍保留跟随系统（那是外观，不是文案）。
function lang() {
  const p = wx.getStorageSync(KEY) || "zh";
  return p === "en" ? "en" : "zh";
}

function dict() {
  return DICT[lang()] || DICT[FALLBACK];
}

function t(key) {
  const d = dict();
  if (key in d) return d[key];
  if (key in DICT[FALLBACK]) return DICT[FALLBACK][key];
  return key;
}

function fallback(key) {
  return key in DICT[FALLBACK] ? DICT[FALLBACK][key] : key;
}

// 把当前词典写进页面 data.T
function sync(page, extra) {
  const l = lang();
  const patch = { T: dict(), lang: l, langPref: l };
  if (extra) Object.assign(patch, extra);
  if (page && page.setData) page.setData(patch);
  return dict();
}

// ---------- 变更广播 ----------
let listeners = [];
function onChange(fn) {
  listeners.push(fn);
  return function off() {
    listeners = listeners.filter((f) => f !== fn);
  };
}

function fire() {
  const l = lang();
  listeners.forEach((fn) => {
    try {
      fn(l);
    } catch (e) {
      /* 单个页面报错不影响其它 */
    }
  });
}

function setLang(l) {
  if (!isLang(l)) return; // 只有 zh / en，不再有 auto
  wx.setStorageSync(KEY, l);
  fire();
}

module.exports = { DICT, lang, dict, t, fallback, sync, onChange, setLang, KEY };
