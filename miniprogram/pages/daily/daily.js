const api = require("../../api");
const exdict = require("../../exdict");

function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

// 把 "eid:sno" 列表转成 { "eid:sno": true } 对象（WXML 对象索引支持点号键不行，但支持字符串字面量键）
function toObj(list) {
  const o = {};
  list.forEach((k) => (o[k] = true));
  return o;
}

Page({
  data: {
    plan: null,
    dayLabel: "",
    session: null,
    today: todayStr(),
    exercises: [],
    doneSets: {}, // { "exercise_id:set_no": true }
    restLeft: 0,
    restTotal: 0,
    restDefault: 90,
    allDone: false,
    loading: true,
  },
  timer: null,

  onShow() {
    // 备动作中文字典：本地命中瞬时；首次后台拉不阻塞，到位后刷新中文名
    exdict.load(() => this.refreshZhNames());
    this.load();
  },

  // 后台字典到位后，把当前动作列表的中文名补上
  refreshZhNames() {
    if (!this.data.exercises.length) return;
    const list = this.data.exercises.map((ex) => ({
      ...ex,
      name_zh: exdict.nameZh(ex.id) || ex.name,
    }));
    this.setData({ exercises: list });
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  async load() {
    // 先尝试读本地缓存的完整计划，命中就直接展示（不依赖网络 / 登录编号）
    let plan = null;
    let planId = wx.getStorageSync("currentPlanId");
    const cachedPlan = wx.getStorageSync("cachedPlan");
    if (cachedPlan && cachedPlan.id && (planId ? cachedPlan.id === planId : true)) {
      plan = cachedPlan;
      planId = plan.id;
    }
    if (!plan) {
      // 缓存没有，拉服务器
      const plans = (await api.plans().catch(() => [])) || [];
      if (!plans.some((p) => p.id === planId)) planId = plans.length ? plans[0].id : null;
      if (planId) {
        plan = await api.plan(planId).catch(() => null);
        if (plan) {
          wx.setStorageSync("cachedPlan", plan);
          wx.setStorageSync("currentPlanId", planId);
        }
      }
    }
    if (!plan) {
      this.setData({ loading: false, plan: null });
      return;
    }
    try {
      const days = (plan.plan_data || {}).days || [];
      // 按今天是周几选 day：day 编号 1..N，周一=1
      const dayNo = (new Date().getDay() + 6) % 7 + 1;
      let idx = days.findIndex((d) => d.day === dayNo);
      if (idx < 0) idx = 0; // 没有对应天就用第一天
      const day = days[idx];

      // 打卡记录依赖登录编号，单独 try：失败只影响"已完成"状态，不能把计划本身清掉
      let sessionId = null;
      let doneSets = {};
      try {
        const sess = await api.sessions(planId).catch(() => []);
        const found = (Array.isArray(sess) ? sess : []).find(
          (s) => s.session_date === this.data.today
        );
        if (found) {
          sessionId = found.id;
        } else {
          const created = await api.createSession({
            plan_id: planId,
            session_date: this.data.today,
          });
          sessionId = created && created.id ? created.id : null;
        }
        if (sessionId) {
          const rows = await api.sessionSets(sessionId).catch(() => []);
          doneSets = toObj(rows.map((r) => r.exercise_id + ":" + r.set_no));
        }
      } catch (se) {
        console.error("打卡记录加载失败（不影响计划展示）:", se);
      }

      const exercises = ((day && day.exercises) || []).map((ex) => ({
        ...ex,
        // 动作名查本地字典，还没有就先用英文原名占位，后台字典到位后 refreshZhNames 补上
        name_zh: exdict.nameZh(ex.id) || ex.name,
        setStates: ex.sets.map((_, i) => doneSets[ex.id + ":" + (i + 1)] || false),
      }));
      this.setData({
        plan,
        dayLabel: day ? day.label : "",
        session: sessionId,
        exercises,
        restDefault: plan.plan_data.rest_seconds || 90,
        doneSets,
        allDone: this.checkAllDone(),
        loading: false,
      });
    } catch (e) {
      console.error(e);
      // 计划主体已拿到（缓存或服务器），展示环节出错不清空 plan，只关 loading
      this.setData({ loading: false });
    }
  },

  toggleSet(e) {
    const { exidx, setidx } = e.currentTarget.dataset;
    const exList = this.data.exercises;
    const ex = exList[exidx];
    const sno = Number(setidx) + 1;
    const key = ex.id + ":" + sno;
    const done = { ...this.data.doneSets };
    if (done[key]) {
      delete done[key];
    } else {
      done[key] = true;
      const sid = this.data.session;
      if (sid) {
        api.recordSet(sid, { exercise_id: ex.id, set_no: sno, done: true }).catch(() => {});
      }
      if (sno < ex.sets.length) {
        const rest =
          (ex.sets[setidx] && ex.sets[setidx].rest_seconds) ||
          this.data.restDefault ||
          90;
        this.startRest(rest);
      }
    }
    exList[exidx] = { ...ex, setStates: ex.setStates.map((s, i) => (i === setidx ? !!done[key] : s)) };
    this.setData({ exercises: exList, doneSets: done, allDone: this.checkAllDone() });
  },

  startRest(seconds) {
    if (this.timer) clearInterval(this.timer);
    this.setData({ restLeft: seconds, restTotal: seconds });
    this.timer = setInterval(() => {
      const left = this.data.restLeft - 1;
      this.setData({ restLeft: Math.max(0, left) });
      if (left <= 0) {
        clearInterval(this.timer);
        this.timer = null;
        wx.vibrateShort({ type: "medium" });
      }
    }, 1000);
  },

  checkAllDone() {
    const need = this.data.exercises.reduce(
      (n, ex) => n + ((ex.sets && ex.sets.length) || 1),
      0
    );
    const got = Object.keys(this.data.doneSets).length;
    return need > 0 && got >= need;
  },

  async markAllDone() {
    const id = this.data.session;
    if (!id) return;
    await api.markDone(id).catch(() => {});
    this.setData({ allDone: true });
    wx.showToast({ title: "今日完成，打卡成功" });
  },
});
