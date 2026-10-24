const api = require("../../api");

// 动作 id → 中文名（后端 name-zh 翻译好的）
const exZhCache = {};
async function ensureExZh() {
  if (Object.keys(exZhCache).length) return;
  try {
    const list = await api.exercises({ limit: 500 });
    (list || []).forEach((x) => (exZhCache[x.id] = x.name_zh));
  } catch {}
}

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
    this.load();
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  async load() {
    const planId = wx.getStorageSync("currentPlanId");
    if (!planId) {
      this.setData({ loading: false, plan: null });
      return;
    }
    try {
      await ensureExZh(); // 先拉一次动作中文映射（全局缓存，只拉一次）
      const plan = await api.plan(planId);
      const days = plan.plan_data.days || [];
      // 按今天是周几选 day：day 编号 1..N，周一=1
      const dayNo = (new Date().getDay() + 6) % 7 + 1;
      let idx = days.findIndex((d) => d.day === dayNo);
      if (idx < 0) idx = 0; // 没有对应天就用第一天
      const day = days[idx];

      const sess = await api.sessions(planId).then((r) =>
        r.find((s) => s.session_date === this.data.today)
      );
      let session = sess;
      if (!session) {
        session = await api.createSession({
          plan_id: planId,
          session_date: this.data.today,
        });
      }
      const sessionId = session && session.id ? session.id : null;

      let doneSets = {};
      if (sessionId) {
        const rows = await api.sessionSets(sessionId).catch(() => []);
        doneSets = toObj(rows.map((r) => r.exercise_id + ":" + r.set_no));
      }
      const exercises = ((day && day.exercises) || []).map((ex) => ({
        ...ex,
        // 动作名用后端 name_zh（拉不到就先显示英文原名，拉到后刷新）
        name_zh: exZhCache[ex.id] || ex.name,
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
      this.setData({ loading: false, plan: null });
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
