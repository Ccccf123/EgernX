/**
 * ✈️ 机场订阅流量监控（绿点版·剩余流量·连贯进度条）
 */

// 标题图标
const networkIcon = (color, size = 13) => ({
  type: 'image',
  src: 'sf-symbol:network',
  color,
  width: size,
  height: size,
});

// 绿色小圆点（替换原图标）
const greenDot = (size = 8) => ({
  type: "stack",
  width: size,
  height: size,
  borderRadius: size / 2,
  backgroundColor: "#34C759",
  opacity: 0.9
});

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
    padding: [10, 14, 10, 14],
    backgroundGradient: {
      type: "linear",
      colors: BG_COLORS,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        marginBottom: 6,
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: 3,
            children: [
              networkIcon(BLUE, 13),
              { type: "text", text: "订阅机场", font: { size: 14, weight: "heavy" }, textColor: BLUE }
            ]
          },
          { type: "spacer" },
          { type: "text", text: `更新于 ${updateTime}`, font: { size: 9 }, textColor: C_SUB }
        ]
      },
      {
        type: "stack",
        direction: "column",
        gap: 5,
        children: results.map((res, index) => {
          const baseColor = THEME_COLORS[index % THEME_COLORS.length];
          return buildRow(res, { baseColor, C_RED, C_SUB, C_MAIN, C_EMPTY });
        })
      }
    ]
  };
}

// --- 获取订阅 ---
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
            remain: total - used,
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
          {
            type:"stack",
            direction:"row",
            alignItems:"center",
            gap:4,
            children:[
              greenDot(8), // ✅ 小图标
              { type:"text", text:res.name, font:{size:11, weight:"bold"}, textColor:col.C_MAIN, maxLines:1 }
            ]
          },
          { type:"spacer" },
          { type:"text", text:res.dateMsg, font:{size:9, family:"Menlo"}, textColor:col.C_SUB }
        ]
      },
      {
        // 🔧 连续进度条修复：只在外层加圆角，内部不加
        type:"stack", direction:"row", height:6, borderRadius:3, overflow:"hidden",
        children:[
          { type:"stack", flex:res.percent, height:6, backgroundColor:barColor },
          { type:"stack", flex:100-res.percent, height:6, backgroundColor:col.C_EMPTY }
        ]
      },
      {
        type:"stack", direction:"row",
        children:[
          { type:"text", text:fmtFlow(res.used,res.total), font:{size:9, family:"Menlo"}, textColor:col.C_SUB },
          { type:"spacer" },
          { type:"text", text:`剩余 ${fmtGB(res.remain)}`, font:{size:9, weight:"heavy"}, textColor:barColor }
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

function fmtGB(val){
  return (val / 1024 / 1024 / 1024).toFixed(1) + "G";
}

function getResetDate(day){
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), day);
  if(now.getDate() >= day) next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
}