// 网络测速小组件 (Speedtest 完美还原版)
// 逻辑：API 真实提取 | 蓝色标题 | 橘色速度 | 底部彩色组 | 右上角详细信息

export default async function (ctx) {
  const mb = 10; 
  const bytes = Math.round(mb * 1024 * 1024);
  const deviceModel = "iPhone 16 Pro"; 

  const BG_GRADIENT = {
    type: "linear",
    colors: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 }
  };

  let speedMBs = "--";
  let speedMbps = "--";
  let ping = "--";
  let duration = "--";
  let usedData = "--"; 
  let timeLabel = "--";
  
  let nodeIp = "获取中...";
  let nodeFlag = "";
  let nodeLocation = "";
  let ispName = "";

  const getFlagEmoji = (countryCode) => {
    if (!countryCode) return "";
    return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt()));
  };

  try {
    // 1. 真实数据提取
    const ipInfoResp = await ctx.http.get("http://ip-api.com/json/?fields=status,countryCode,city,isp,query", { timeout: 5000 });
    const ipInfo = await ipInfoResp.json();

    if (ipInfo.status === "success") {
      nodeIp = ipInfo.query;
      nodeFlag = getFlagEmoji(ipInfo.countryCode);
      nodeLocation = ipInfo.city;
      ispName = ipInfo.isp;
    }

    // 2. 测速逻辑
    const pingStart = Date.now();
    await ctx.http.get("https://www.speedtest.net/generate_204", { timeout: 5000 });
    const rawPing = Date.now() - pingStart;

    const dlStart = Date.now();
    const dlResp = await ctx.http.get(`https://speed.cloudflare.com/__down?bytes=${bytes}&_=${Date.now()}`, { timeout: 15000 });
    await dlResp.arrayBuffer(); 

    const dlDuration = (Date.now() - dlStart) / 1000;
    speedMBs = (mb / dlDuration).toFixed(2);
    speedMbps = (speedMBs * 8).toFixed(1);
    ping = rawPing;
    duration = dlDuration.toFixed(2);
    usedData = mb.toFixed(1) + "MB";
    timeLabel = new Date().toTimeString().slice(0, 5);
  } catch (e) {
    nodeIp = "连接超时";
  }

  const C = {
    textMain:   { light: "#000000", dark: "#FFFFFF" },
    textSub:    { light: "#8E8E93", dark: "#AEAEB2" },
    titleBlue:  { light: "#003EB3", dark: "#00D2FF" }, 
    speedMain:  { light: "#FF9500", dark: "#FF9F0A" },
    speedMbps:  { light: "#FF9500CC", dark: "#FF9F0ACC" },
    c_ping:     { light: "#007AFF", dark: "#0A84FF" }, 
    c_duration: { light: "#8944AB", dark: "#BF5AF2" }, 
    c_data:     { light: "#248A3D", dark: "#30D158" }, 
    c_time:     { light: "#FF3B30", dark: "#FF453A" }, 
  };

  const statItem = (icon, value, color) => ({
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 4,
    children: [
      { type: "image", src: `sf-symbol:${icon}`, width: 11, height: 11, color: color },
      { type: "text", text: value, font: { size: 11, weight: "bold" }, textColor: C.textMain },
    ],
  });

  return {
    type: "widget",
    padding: [16, 16, 16, 16],
    backgroundGradient: BG_GRADIENT,
    refreshAfter: new Date(Date.now() + 60 * 1000).toISOString(),
    children: [
      // 第一层：左右结构 (标题 vs 详细信息)
      {
        type: "stack",
        direction: "row",
        alignItems: "start",
        children: [
          { type: "text", text: "Speedtest", font: { size: 14, weight: "heavy" }, textColor: C.titleBlue },
          { type: "spacer" },
          // 右侧详细信息堆栈
          {
            type: "stack",
            direction: "column",
            alignItems: "end",
            gap: 1,
            children: [
              { type: "text", text: `${nodeIp}${nodeFlag}`, font: { size: 12, weight: "bold" }, textColor: C.textSub },
              { type: "text", text: nodeLocation ? `${nodeLocation} | ${ispName}` : "", font: { size: 10, weight: "bold" }, textColor: C.textSub },
              { type: "text", text: deviceModel, font: { size: 10, weight: "bold" }, textColor: C.textSub },
            ]
          }
        ],
      },

      { type: "spacer" },

      // 第二层：核心速度显示 (橘色)
      {
        type: "stack",
        direction: "row",
        alignItems: "end",
        gap: 6,
        children: [
          { type: "text", text: `${speedMBs}`, font: { size: 42, weight: "semibold" }, textColor: C.speedMain },
          {
            type: "stack",
            direction: "column",
            alignItems: "start",
            padding: [0, 0, 8, 0],
            children: [
              { type: "text", text: "MB/s", font: { size: 14, weight: "bold" }, textColor: C.speedMain },
              { type: "text", text: `${speedMbps} Mbps`, font: { size: 11, weight: "medium" }, textColor: C.speedMbps },
            ],
          },
        ],
      },

      { type: "spacer" },

      // 第三层：底部彩色参数
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          statItem("timer", ping !== "--" ? `${ping}ms` : "--", C.c_ping),
          { type: "spacer" },
          statItem("hourglass", duration !== "--" ? `${duration}s` : "--", C.c_duration),
          { type: "spacer" },
          statItem("arrow.down.circle", usedData, C.c_data),
          { type: "spacer" },
          statItem("clock", timeLabel, C.c_time),
        ],
      },
    ],
  };
}
