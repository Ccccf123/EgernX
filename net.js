/**
 * ==========================================
 * 📌 代码名称: ✈️ 机场订阅流量监控 (12h 定时版)
 * ✨ 特色功能: 12小时刷新建议；标题栏；更新时间；10段进度条。
 * ⏱️ 更新时间: 2026.03.17
 * ==========================================
 */

export default async function (ctx) {
  const MAX = 5;
  const slots = [];
  for (let i = 1; i <= MAX; i++) {
    const url = (ctx.env[`URL${i}`] || "").trim();
    if (!url) continue;
    slots.push({
      name: (ctx.env[`NAME${i}`] || "").trim() || `机场 ${i}`,
      url,
      resetDay: parseInt(ctx.env[`RESET${i}`] || "", 10) || null,
    });
  }

  const BG_COLORS = [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }];
  const C_RED = { light: '#FF3B30', dark: '#FF453A' };
  const C_SUB = { light: '#8E8E93', dark: '#8E8E93' };
  const C_MAIN = { light: '#1C1C1E', dark: '#FFFFFF' };
  const C_EMPTY = { light: '#E5E5EA', dark: '#2C2C2E' };

  const THEME_COLORS = [
    { light: '#5AC8FA', dark: '#64D2FF' }, { light: '#34C759', dark: '#30D158' }, 
    { light: '#FFCC00', dark: '#FFD60A' }, { light: '#AF52DE', dark: '#BF5AF2' }, 
    { light: '#007AFF', dark: '#0A84FF' }
  ];

  const results = await Promise.all(slots.map((s) => fetchSub(ctx, s)));
  
  // 🕒 获取更新时间
  const now = new Date();
  const updateTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // ⏲️ 计算 12 小时后的刷新时刻
  const refreshDate = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  return {
    type: "widget",
    refreshAfterDate: refreshDate, // 🚀 建议系统 12 小时后刷新
    padding: [12, 14, 10, 14], 
    backgroundGradient: { type: "linear", colors: BG_COLORS, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    children: [
      {
        type: "stack", direction: "row", alignItems: "center", marginBottom: 8,
        children: [
          { type: "text", text: " 订阅机场", font: { size: 13, weight: "heavy" }, textColor: C_RED },
          { type: "spacer" },
          { type: "text", text: `更新于 ${updateTime}`, font: { size: 9 }, textColor: C_SUB }
        ]
      },
      {
        type: "stack", direction: "column", gap: 6, 
        children: results.map((res, index) => {
          const baseColor = THEME_COLORS[index % THEME_COLORS.length];
          return buildRow(res, { baseColor, C_RED, C_SUB, C_MAIN, C_EMPTY });
        })
      },
      { type: "spacer" }
    ]
  };
}

// --- 辅助函数保持不变 ---
async function fetchSub(ctx, slot) {
  const uas = ["Quantumult%20X/1.5.2", "ClashNext/1.0", "Surge/5.0"];
  for (let ua of uas) {
    try {
      const resp = await ctx.http.get(slot.url, { headers: { "User-Agent": ua }, timeout: 5000 });
      const infoStr = resp.headers.get("subscription-userinfo") || resp.headers.get("Subscription-Userinfo") || "";
      if (infoStr) {
        const parse = (k) => parseFloat(infoStr.match(new RegExp(`${k}=([^;]+)`))?.[1] || 0);
        const total = parse("total");
        if (total > 0) {
          const used = (parse("upload") || 0) + (parse("download") || 0);
          return {
            name: slot.name, error: false, total, used,
            percent: Math.min((used / total) * 100, 100),
            dateMsg: parse("expire") ? formatDate(parse("expire")) : (slot.resetDay ? getResetDate(slot.resetDay) : "长期")
          };
        }
      }
    } catch (e) { continue; }
  }
  return { name: slot.name, error: true };
}

function buildRow(res, col) {
  if (res.error) {
    return {
      type: "stack", direction: "row", children: [
        { type: "text", text: `! ${res.name}`, font: { size: 10, weight: "bold" }, textColor: col.C_SUB },
        { type: "spacer" }, { type: "text", text: "获取失败", font: { size: 9 }, textColor: col.C_RED }
      ]
    };
  }
  const barColor = res.percent >= 85 ? col.C_RED : col.baseColor;
  const activeSegments = Math.round(res.percent / 10);
  return {
    type: "stack", direction: "column", gap: 3,
    children: [
      {
        type: "stack", direction: "row", alignItems: "center",
        children: [
          { type: "text", text: res.name, font: { size: 10.5, weight: "bold" }, textColor: col.C_MAIN, maxLines: 1 },
          { type: "spacer" },
          { type: "text", text: res.dateMsg, font: { size: 8.5, family: "Menlo" }, textColor: col.C_SUB }
        ]
      },
      {
        type: "stack", direction: "row", gap: 1.5, height: 4,
        children: Array.from({ length: 10 }).map((_, i) => ({
          type: "stack", flex: 1, height: 4, borderRadius: 1,
          backgroundColor: i < activeSegments ? barColor : col.C_EMPTY
        }))
      },
      {
        type: "stack", direction: "row",
        children: [
          { type: "text", text: fmtFlow(res.used, res.total), font: { size: 8.5, family: "Menlo" }, textColor: col.C_SUB },
          { type: "spacer" },
          { type: "text", text: `${res.percent.toFixed(1)}%`, font: { size: 9, weight: "heavy" }, textColor: barColor }
        ]
      }
    ]
  };
}

function fmtFlow(used, total) {
  const units = ["B", "K", "M", "G", "T"];
  const i = total > 0 ? Math.floor(Math.log(total) / Math.log(1024)) : 0;
  const div = Math.pow(1024, i);
  return `${(used/div).toFixed(1)}${units[i]}/${(total/div).toFixed(1)}${units[i]}`;
}

function formatDate(ts) {
  const d = new Date(ts > 10000000000 ? ts : ts * 1000);
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

function getResetDate(day) {
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), day);
  if (now.getDate() >= day) next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return `${next.getMonth() + 1}-${next.getDate()}重置`;
}
