/**
 * ==========================================
 * 📌 代码名称: ✈️ 机场订阅流量监控 (12h 连续进度条版·蓝色标题·完整日期)
 * ✨ 特色功能: 12小时刷新；标题栏（蓝色“订阅机场”）；更新时间；连贯进度条；字体/间距优化
 * ⏱️ 更新时间: 2026.03.18
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
  const BLUE = { light: '#007AFF', dark: '#0A84FF' };

  const THEME_COLORS = [
    { light: '#5AC8FA', dark: '#64D2FF' },
    { light: '#34C759', dark: '#30D158' },
    { light: '#FFCC00', dark: '#FFD60A' },
    { light: '#AF52DE', dark: '#BF5AF2' },
    BLUE
  ];

  const results = await Promise.all(slots.map((s) => fetchSub(ctx, s)));

  const now = new Date();
  const updateTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const refreshDate = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  return {
    type: "widget",
    refreshAfterDate: refreshDate,
    padding: [12, 14, 12, 14],
    backgroundGradient: { type: "linear", colors: BG_COLORS, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    children: [
      {
        type: "stack", direction: "row", alignItems: "center", gap: 6, marginBottom: 8,
        children: [
          { type: "text", text: " 🌐订阅机场", font: { size: 14, weight: "heavy" }, textColor: BLUE },
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

// --- 获取订阅信息 ---
async function fetchSub(ctx, slot) {
  const uas = ["Quantumult%20X/1.5.2","ClashNext/1.0","Surge/5.0"];
  for (let ua of uas) {
    try {
      const resp = await ctx.http.get(slot.url,{ headers:{ "User-Agent": ua }, timeout:5000 });
      const infoStr = resp.headers.get("subscription-userinfo") || resp.headers.get("Subscription-Userinfo") || "";
      if (infoStr) {
        const parse = k => parseFloat(infoStr.match(new RegExp(`${k}=([^;]+)`))?.[1] || 0);
        const total = parse("total");
        if (total>0) {
          const used = (parse("upload")||0) + (parse("download")||0);

          // ⚡ 日期统一为 YYYY-MM-DD
          let dateMsg = "";
          if(parse("expire")) {
            const expireTs = parse("expire");
            const d = new Date(expireTs > 10000000000 ? expireTs : expireTs*1000);
            dateMsg = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          } else if(slot.resetDay) {
            dateMsg = getResetDate(slot.resetDay);
          } else {
            dateMsg = "长期";
          }

          return {
            name: slot.name,
            error: false,
            total,
            used,
            percent: Math.min((used/total)*100,100),
            dateMsg
          };
        }
      }
    } catch(e){continue;}
  }
  return { name: slot.name, error:true };
}

// --- 连续进度条 ---
function buildRow(res, col){
  if(res.error){
    return {
      type:"stack", direction:"row", children:[
        { type:"text", text:`! ${res.name}`, font:{size:11, weight:"bold"}, textColor:col.C_SUB },
        { type:"spacer" },
        { type:"text", text:"获取失败", font:{size:9}, textColor:col.C_RED }
      ]
    };
  }

  const barColor = res.percent>=85 ? col.C_RED : col.baseColor;

  return {
    type:"stack", direction:"column", gap:4,
    children:[
      {
        type:"stack", direction:"row", alignItems:"center",
        children:[
          { type:"text", text:res.name, font:{size:11, weight:"bold"}, textColor:col.C_MAIN, maxLines:1 },
          { type:"spacer" },
          { type:"text", text:res.dateMsg, font:{size:9, family:"Menlo"}, textColor:col.C_SUB }
        ]
      },
      {
        type:"stack", direction:"row", height:6, borderRadius:3,
        children:[
          { type:"stack", flex:res.percent, height:6, borderRadius:3, backgroundColor:barColor },
          { type:"stack", flex:100-res.percent, height:6, borderRadius:3, backgroundColor:col.C_EMPTY }
        ]
      },
      {
        type:"stack", direction:"row",
        children:[
          { type:"text", text:fmtFlow(res.used,res.total), font:{size:9, family:"Menlo"}, textColor:col.C_SUB },
          { type:"spacer" },
          { type:"text", text:`${res.percent.toFixed(1)}%`, font:{size:9, weight:"heavy"}, textColor:barColor }
        ]
      }
    ]
  };
}

function fmtFlow(used,total){
  const units=["B","K","M","G","T"];
  const i = total>0 ? Math.floor(Math.log(total)/Math.log(1024)) : 0;
  const div = Math.pow(1024,i);
  return `${(used/div).toFixed(1)}${units[i]}/${(total/div).toFixed(1)}${units[i]}`;
}

// --- 重置日期完整格式 YYYY-MM-DD ---
function getResetDate(day){
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), day);
  if(now.getDate() >= day) next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
}