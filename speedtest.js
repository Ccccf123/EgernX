// 网络测速小组件 (精准运营商缩写 + IP 字段版)

export default async function (ctx) {
  const mb = 10; 
  const bytes = Math.round(mb * 1024 * 1024);

  // --- 1. 核心逻辑：精准判断网络状态，蜂窝统一显示英文缩写 ---
  const netInfo = ctx.device?.network || {};
  const internalIP = ctx.device?.ipv4?.address || netInfo.ip || "127.0.0.1";
  const radio = (netInfo.radio || "").toLowerCase();
  
  const getNetTag = () => {
    if (radio === "wifi" || ctx.device?.wifi?.ssid) return "Wi-Fi";
    
    // 基于 MNC (移动网络码) 的精准映射为英文缩写
    const carrier = (netInfo.carrier || "").toLowerCase();
    let opCode = "CELL"; // 默认缩写

    if (carrier.includes("ct") || /46003|46005|46011/.test(carrier)) {
      opCode = "CT";
    } else if (carrier.includes("cu") || /46001|46006|46009/.test(carrier)) {
      opCode = "CU";
    } else if (carrier.includes("cm") || /46000|46002|46007|46008/.test(carrier)) {
      opCode = "CM";
    } else if (carrier.includes("cb") || /46015/.test(carrier)) {
      opCode = "CB";
    }
    
    const rat = radio.toUpperCase() || "LTE";
    return `${opCode} ${rat}`;
  };
  const netTag = getNetTag();

  const BG_GRADIENT = {
    type: "linear",
    colors: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 }
  };

  let speedMBs = "--", speedMbps = "--", ping = "--", duration = "--", usedData = "--", timeLabel = "--";
  let nodeIp = "获取中...", nodeFlag = "", nodeLocation = "", ispName = "";

  const getFlagEmoji = (cc) => {
    if (!cc) return "";
    return cc.toUpperCase().replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt()));
  };

  try {
    const ipInfoResp = await ctx.http.get("http://ip-api.com/json/?fields=status,countryCode,city,isp,query", { timeout: 5000 });
    const ipInfo = await ipInfoResp.json();
    if (ipInfo.status === "success") {
      nodeIp = ipInfo.query;
      nodeFlag = getFlagEmoji(ipInfo.countryCode);
      nodeLocation = ipInfo.city;
      ispName = ipInfo.isp;
    }

    const pingStart = Date.now();
    await ctx.http.get("https://www.speedtest.net/generate_204", { timeout: 5000 });
    ping = Date.now() - pingStart;

    const dlStart = Date.now();
    const dlResp = await ctx.http.get(`https://speed.cloudflare.com/__down?bytes=${bytes}&_=${Date.now()}`, { timeout: 15000 });
    await dlResp.arrayBuffer(); 

    const dlDuration = (Date.now() - dlStart) / 1000;
    speedMBs = (mb / dlDuration).toFixed(2);
    speedMbps = (speedMBs * 8).toFixed(1);
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
    tagGray:    { light: "#666666", dark: "#888888" },
    speedMain:  { light: "#FF9500", dark: "#FF9F0A" },
    speedMbps:  { light: "#FF9500CC", dark: "#FF9F0ACC" },
    c_ping:     { light: "#007AFF", dark: "#0A84FF" }, 
    c_duration: { light: "#8944AB", dark: "#BF5AF2" }, 
    c_data:     { light: "#248A3D", dark: "#30D158" }, 
    c_time:     { light: "#FF3B30", dark: "#FF453A" }, 
  };

  const statItem = (icon, value, color) => ({
    type: "stack", direction: "row", alignItems: "center", gap: 4,
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
      {
        type: "stack",
        direction: "row",
        alignItems: "start",
        children: [
          {
            type: "stack", direction: "row", alignItems: "end", gap: 6,
            children: [
              { type: "text", text: "Speedtest", font: { size: 14, weight: "heavy" }, textColor: C.titleBlue },
              { type: "text", text: netTag, font: { size: 9, weight: "bold" }, textColor: C.tagGray, padding: [0, 0, 1, 0] },
            ]
          },
          { type: "spacer" },
          {
            type: "stack", direction: "column", alignItems: "end", gap: 1,
            children: [
              { type: "text", text: `${nodeIp}${nodeFlag}`, font: { size: 12, weight: "bold" }, textColor: C.textSub },
              { type: "text", text: nodeLocation ? `${nodeLocation} | ${ispName}` : "", font: { size: 10, weight: "bold" }, textColor: C.textSub },
              { type: "text", text: `IP: ${internalIP}`, font: { size: 10, weight: "bold" }, textColor: C.textSub },
            ]
          }
        ],
      },
      { type: "spacer" },
      {
        type: "stack", direction: "row", alignItems: "end", gap: 6,
        children: [
          { type: "text", text: `${speedMBs}`, font: { size: 42, weight: "semibold" }, textColor: C.speedMain },
          {
            type: "stack", direction: "column", alignItems: "start", padding: [0, 0, 8, 0],
            children: [
              { type: "text", text: "MB/s", font: { size: 14, weight: "bold" }, textColor: C.speedMain },
              { type: "text", text: `${speedMbps} Mbps`, font: { size: 11, weight: "medium" }, textColor: C.speedMbps },
            ],
          },
        ],
      },
      { type: "spacer" },
      {
        type: "stack", direction: "row", alignItems: "center",
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
