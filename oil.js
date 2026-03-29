export default async function(ctx){
  const regionParam = ctx.env.region || "jiangsu/suzhou";

  const BG_COLORS = [{ light:'#FFFFFF', dark:'#1C1C1E' }, { light:'#F4F5F9', dark:'#000000' }];
  const CARD_BG   = { light:'#F2F2F7', dark:'#2C2C2E' };
  const TEXT_MAIN = { light:'#000000', dark:'#FFFFFF' };
  const TEXT_SUB  = { light:'#666666', dark:'#999999' };
  const TITLE_COLOR = { light:'#007AFF', dark:'#0A84FF' };

  const C = {
    bg: BG_COLORS,
    card: CARD_BG,
    main: TEXT_MAIN,
    muted: TEXT_SUB,
    gold:'#FF9F0A',
    red:'#FF3B30',
    teal:'#30D158',
    blue:'#007AFF',
    divider: { light:'#E5E5EA', dark:'#38383A' }
  };

  const widgetFamily = ctx.widgetFamily || "systemMedium";

  const now = new Date();
  const P = n=>String(n).padStart(2,'0');
  const updateTimeStr = `${P(now.getMonth()+1)}.${P(now.getDate())} ${P(now.getHours())}:${P(now.getMinutes())}`;

  let prices = {p92:null,p95:null,p98:null,diesel:null};
  let regionName = "苏州";
  let trendLabel="调价趋势: ", trendInfo="暂无数据", trendColor=C.muted;

  try{
    const resp = await ctx.http.get(`http://m.qiyoujiage.com/${regionParam}.shtml`, {timeout:8000});
    const html = await resp.text();

    for(const m of html.matchAll(/<dt>(.*?)<\/dt>[\s\S]*?<dd>([\d.]+)\(元\)<\/dd>/g)){
      const val=parseFloat(m[2]);
      if(isNaN(val)) continue;
      if(m[1].includes("92")) prices.p92=val;
      else if(m[1].includes("95")) prices.p95=val;
      else if(m[1].includes("98")) prices.p98=val;
      else if(m[1].includes("柴")||m[1].includes("0号")) prices.diesel=val;
    }

    const tm = html.match(/<div class="tishi">[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<br\/>([\s\S]+?)<br\/>/);
    if(tm){
      const [, timeText, priceText] = tm;
      const rd = timeText.match(/(\d{1,2})月(\d{1,2})日(\d{1,2})时/);
      const adjustDate = rd ? `${P(rd[1])}.${P(rd[2])} ${P(rd[3])}:00` : "未知时间";
      const isUp=/上调|上涨|涨/.test(priceText);
      const isDown=/下调|下跌|降|跌/.test(priceText);
      const amounts = (priceText.match(/[\d.]+\s*元\/升/g)||[]).map(p=>p.match(/[\d.]+/)[0]);
      const amountStr = amounts.length>=2?`${amounts[0]}-${amounts[1]}元/L`:amounts[0]?`${amounts[0]}元/L`:"";
      trendInfo=`${adjustDate}, ${isUp?"▲":isDown?"▼":"-"} ${amountStr}`.trim();
      trendColor=isUp?C.red:isDown?C.teal:C.muted;
    }
  }catch(_){}

  const mkText=(text,size,weight,color,opts={})=>({type:"text",text:String(text),font:{size,weight,monospacedDigits:false},textColor:color,...opts});
  const mkRow=(children,gap=4)=>({type:"stack",direction:"row",alignItems:"center",gap,children});
  const mkSpacer=()=>({type:"spacer"});

  // 价格卡片：字体调小，weight从heavy改为medium
  const priceCard=({label,val,color})=>({
    type:"stack",
    direction:"column",
    alignItems:"center",
    justifyContent:"center",
    flex:1,
    backgroundColor:C.card,
    borderRadius:12,
    padding:[10,6,10,6],
    children:[
      mkText(label,11,"medium",color),      // 标签字体略小
      mkText(val.toFixed(2),22,"medium",C.main)  // 数据字体调小，weight中等
    ]
  });

  // 小组件模式：只显示图标 + 城市名 + 92号油价
  if(widgetFamily === "systemSmall"){
    return {
      type:"widget",
      padding:12,
      backgroundGradient:{type:"linear",colors:C.bg,startPoint:{x:0,y:0},endPoint:{x:1,y:1}},
      children:[
        mkRow([
          {type:"image",src:"sf-symbol:fuelpump.circle.fill",width:16,height:16,color:TITLE_COLOR},
          mkText(`${regionName}油价`,18,"heavy",TITLE_COLOR),
          priceCard({label:"92号", val:prices.p92||0, color:C.gold})
        ],6)
      ]
    };
  }

  // 中/大组件
  const PRICE_ITEMS = [
    {label:"92号", key:"p92", color:C.gold},
    {label:"95号", key:"p95", color:C.red},
    {label:"98号", key:"p98", color:C.blue},
    {label:"柴油", key:"diesel", color:C.teal}
  ].map(i=>({...i,val:prices[i.key]})).filter(i=>i.val!==null);

  return {
    type:"widget",
    padding:12,
    backgroundGradient:{type:"linear",colors:C.bg,startPoint:{x:0,y:0},endPoint:{x:1,y:1}},
    children:[
      mkRow([
        {type:"image",src:"sf-symbol:fuelpump.circle.fill",width:16,height:16,color:TITLE_COLOR},
        mkText(`${regionName}油价`,18,"heavy",TITLE_COLOR),
        mkSpacer(),
        mkRow([
          mkText(trendLabel,11,"medium",C.muted),
          mkText(trendInfo,11,"medium",trendColor,{lineLimit:1,minScale:0.7})
        ],4)
      ],4),

      {type:"stack",direction:"row",gap:6,children:PRICE_ITEMS.map(priceCard)},

      mkSpacer(),

      {type:"stack",height:0.5,backgroundColor:C.divider},

      mkSpacer(),

      mkRow([mkText(updateTimeStr,11,"bold",C.muted)])
    ]
  };
}