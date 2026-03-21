export default async function (ctx) {
  const regionParam = ctx.env.region || "hainan/haikou";
  const SHOW_TREND = (ctx.env.SHOW_TREND || "true").trim() !== "false";

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const refreshTime = new Date(Date.now() + 6*60*60*1000).toISOString();

  // 🔹 背景和字体颜色保留最初版本
  const BG_COLORS = [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }];
  const BLOCK_BG = { light: '#F2F2F7', dark: '#2C2C2E' };
  const TEXT_MAIN = { light: '#000000', dark: '#FFFFFF' };
  const TEXT_SUB = { light: '#666666', dark: '#999999' };
  const TITLE_COLOR = { light: '#007AFF', dark: '#0A84FF' };

  const COLORS = {
    p92: { light: "#FF9F0A", dark: "#FFB347" },
    p95: { light: "#FF6B35", dark: "#FF8A5C" },
    p98: { light: "#FF3B30", dark: "#FF6B6B" },
    diesel: { light: "#30D158", dark: "#5CD67D" },
    trend: TEXT_SUB,
  };

  const CACHE_KEY = `qiyoujiage_oil_${regionParam}`;
  let prices = {p92:null, p95:null, p98:null, diesel:null};
  let regionName = "";
  let trendInfo = "";
  let hasCache = false;

  try {
    const cached = ctx.storage.getJSON(CACHE_KEY);
    if (cached && cached.prices) {
      prices = cached.prices;
      regionName = cached.regionName || "";
      trendInfo = cached.trendInfo || "";
      hasCache = true;
    }
  } catch(_) {}

  let fetchError = false;
  let errorMsg = "";

  try {
    const queryAddr = `http://m.qiyoujiage.com/${regionParam}.shtml`;
    const resp = await ctx.http.get(queryAddr, {
      headers: {
        'referer': 'http://m.qiyoujiage.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });
    
    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}: 页面不存在`);

    const html = await resp.text();

    // 地区名
    const titleMatch = html.match(/<title>([^_]+)_/);
    if (titleMatch && titleMatch[1]) {
      regionName = titleMatch[1].trim().replace(/(油价|实时|今日|最新|查询|价格)/g, '').trim();
    }

    // 油价解析
    const regPrice = /<dl>[\s\S]+?<dt>(.*油)<\/dt>[\s\S]+?<dd>(.*)\(元\)<\/dd>/gm;
    let priceList = [], m=null;
    while ((m = regPrice.exec(html)) !== null) {
      if (m.index === regPrice.lastIndex) regPrice.lastIndex++;
      priceList.push({ name: m[1].trim(), value: m[2].trim() });
    }

    if (priceList.length >= 3) {
      const nameMap = { 
        "92 号": "p92", "92": "p92",
        "95 号": "p95", "95": "p95",
        "98 号": "p98", "98": "p98",
        "0 号": "diesel", "柴油": "diesel"
      };
      prices = {p92:null, p95:null, p98:null, diesel:null};
      priceList.forEach(item => {
        const key = Object.keys(nameMap).find(k => item.name.includes(k));
        if (key) {
          const priceVal = parseFloat(item.value);
          if (!isNaN(priceVal)) prices[nameMap[key]] = priceVal;
        }
      });

      // 下轮调价解析
      if (SHOW_TREND) {
        const nextMatch = html.match(
          /预计下次油价调整时间[^：:\n]*[:：]\s*([\d\s月日]+)\s*[，,]\s*([上调下调搁浅\d\.\-~元\/\s]+)/
        );
        if (nextMatch) {
          const rawDate = nextMatch[1].trim();
          const rawText = nextMatch[2].trim();
          const dateParts = rawDate.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2})?/);
          if (dateParts) {
            const year = now.getFullYear();
            const month = dateParts[1].padStart(2,'0');
            const day = dateParts[2].padStart(2,'0');
            const hour = (dateParts[3] || '24').padStart(2,'0');
            const dateStr = `${year}/${month}/${day} ${hour}:00:00`;
            let symbol = "-";
            if (rawText.includes("上调")) symbol="↑";
            else if (rawText.includes("下调")) symbol="↓";
            const rangeMatch = rawText.match(/([\d\.\-~]+)\s*元\/升/);
            const rangeStr = rangeMatch ? rangeMatch[1]+"元/L" : "";
            trendInfo = `${dateStr} ${symbol} ${rangeStr}`;
          }
        }
      }

      ctx.storage.setJSON(CACHE_KEY, { prices, regionName, trendInfo });
      fetchError = false;
    } else if (!hasCache) {
      fetchError = true;
      errorMsg = "解析失败";
    }

  } catch(e) {
    if (!hasCache) {
      fetchError = true;
      errorMsg = e.message;
    }
  }

  const titleText = regionName ? `${regionName}实时油价` : "实时油价";

  const rows = [
    {label:"92 号", price:prices.p92, color:COLORS.p92},
    {label:"95 号", price:prices.p95, color:COLORS.p95},
    {label:"98 号", price:prices.p98, color:COLORS.p98},
    {label:"柴油", price:prices.diesel, color:COLORS.diesel},
  ].filter(r => r.price !== null);

  function priceCard(row){
    return {
      type:"stack",
      direction:"column",
      alignItems:"center",
      justifyContent:"center",
      flex:1,
      padding:[8,4,8,4],
      backgroundColor: BLOCK_BG,
      borderRadius:12,
      children:[
        {
          type:"text",
          text:row.label,
          font:{size:"caption2",weight:"bold"},
          textColor: row.color,
          textAlign:"center"
        },
        {
          type:"text",
          text:row.price !== null ? row.price.toFixed(2) : "--",
          font:{size:20,weight:"semibold"}, // 🔹 油价数字加大
          textColor: TEXT_MAIN,
          textAlign:"center",
          lineLimit:1,
          minScale:0.7
        }
      ]
    }
  }

  return {
    type:"widget",
    padding:[10,8,10,8],
    gap:5,
    backgroundGradient:{type:'linear', colors:BG_COLORS, startPoint:{x:0,y:0}, endPoint:{x:1,y:1}},
    refreshAfter:refreshTime,
    children:[
      {
        type:"stack",
        direction:"row",
        alignItems:"center",
        gap:4,
        padding:[0,4,0,4],
        children:[
          {type:"image",src:"sf-symbol:fuelpump.fill",width:15,height:15,color:TITLE_COLOR},
          {type:"text",text:titleText,font:{size:18,weight:"heavy"},textColor:TITLE_COLOR}, // 🔹 标题加大
          {type:"spacer"},
          ...(SHOW_TREND && trendInfo ? [{
            type:"text",
            text: trendInfo,
            font:{size:"caption2"},
            textColor: COLORS.trend,
            textAlign:"right",
            lineLimit:1,
            minScale: 0.8
          }] : []),
          ...(fetchError ? [{
            type:"text",text:errorMsg,font:{size:"caption2"},textColor:COLORS.p98
          }] : [])
        ].filter(Boolean)
      },
      rows.length > 0 ? {
        type:"stack",
        direction:"row",
        alignItems:"center",
        justifyContent:"space-between",
        gap:6,
        padding:[6,0,6,0],
        children: rows.map(priceCard)
      } : {
        type:"stack",
        direction:"column",
        alignItems:"center",
        justifyContent:"center",
        padding:[20,10,20,10],
        children:[
          {type:"image",src:"sf-symbol:exclamationmark.triangle.fill",width:24,height:24,color:COLORS.p98},
          {type:"text",text:fetchError?"数据获取失败":"暂无数据",font:{size:"body"},textColor:TEXT_SUB}
        ]
      },
      {
        type:"stack",
        direction:"row",
        alignItems:"center",
        padding:[0,4,0,4],
        children:[
          {type:"text",text:`${timeStr} 更新`,font:{size:"caption2"},textColor:TEXT_SUB},
          {type:"spacer"},
          {type:"text",text:"元/升",font:{size:"caption2"},textColor:TEXT_SUB}
        ]
      }
    ]
  }
}