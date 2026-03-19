// 网络测速小组件 (Speedtest Pro - 多彩图标版)
// 逻辑：同步和风背景 + 橘色主速度 + 底部彩色状态组

export default async function (ctx) {
  const mb = 10; 
  const bytes = Math.round(mb * 1024 * 1024);

  // 背景色配置 (同步和风天气)
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
  let nodeLocation = "";

  try {
    const traceResp = await ctx.http.get("https://speed.cloudflare.com/cdn-cgi/trace", { timeout: 3000 });
    const traceText = await traceResp.text();
    const ipMatch = traceText.match(/ip=(.*)/);
    const locMatch = traceText.match(/loc=(.*)/);
    nodeIp = ipMatch ? ipMatch[1] : "未知IP";
    nodeLocation = locMatch ? ` (${locMatch[1].toUpperCase()})` : "";

    const pingStart = Date.now();
    await ctx.http.get("https://www.speedtest.net/generate_204", { timeout: 5000 });
    const pingEnd = Date.now();
    const rawPing = pingEnd - pingStart;

    const dlStart = Date.now();
    const dlResp = await ctx.http.get(
      `https://speed.cloudflare.com/__down?bytes=${bytes}&_=${Date.now()}`,
      { timeout: 15000 } 
    );
    await dlResp.arrayBuffer(); 

    const dlEnd = Date.now();
    const dlDuration = (dlEnd - dlStart) / 1000;
    const rawMBs = mb / dlDuration;
    const rawMbps = rawMBs * 8;

    speedMBs = rawMBs.toFixed(2);
    speedMbps = rawMbps.toFixed(1);
    ping = rawPing;
    duration = dlDuration.toFixed(2);
    usedData = mb.toFixed(1) + "MB";
    timeLabel = new Date().toTimeString().slice(0, 5);
  } catch (e) {
    nodeIp = "连接超时";
  }

  // 颜色定义 (兼容深浅模式)
  const C = {
    textMain:   { light: "#000000", dark: "#FFFFFF" },
    textSub:    { light: "#8E8E93", dark: "#AEAEB2" },
    // 速度颜色：橘色
    speedMain:  { light: "#FF9500", dark: "#FF9F0A" },
    speedMbps:  { light: "#FF9500CC", dark: "#FF9F0ACC" },
    // 底部彩色组
    c_ping:     { light: "#32ADE6", dark: "#64D2FF" }, // 蓝色 (延迟)
    c_duration: { light: "#AF52DE", dark: "#BF5AF2" }, // 紫色 (耗时)
    c_data:     { light: "#34C759", dark: "#30D158" }, // 绿色 (流量)
    c_time:     { light: "#FF3B30", dark: "#FF453A" }, // 红色 (时间)
  };

  // 底部统计项组件 (支持独立颜色)
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
      // 第一层：标题与位置
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        children: [
          { type: "text", text: "Speedtest Pro", font: { size: 14, weight: "heavy" }, textColor: C.textMain },
          { type: "spacer" },
          { type: "text", text: `${nodeIp}${nodeLocation}`, font: { size: 10 }, textColor: C.textSub },
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
