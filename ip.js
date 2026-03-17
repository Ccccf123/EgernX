/**
 * 🚀 全功能网络看板 Pro (极客配色回归版)
 * 恢复最初版的稳定逻辑，仅合入渐变背景与统一配色方案
 */
export default async function(ctx) {
  // ===================== 1. 统一极客配色与渐变 =====================
  const BG_COLORS = [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }];
  
  const C_MAIN    = { light: '#000000', dark: '#FFFFFF' };
  const C_SUB     = { light: '#666666', dark: '#999999' };
  const C_TITLE   = { light: '#007AFF', dark: '#0A84FF' }; // 系统蓝
  const C_GREEN   = { light: '#34C759', dark: '#30D158' };
  const C_YELLOW  = { light: '#FF9500', dark: '#FFD700' };
  const C_RED     = { light: '#FF3B30', dark: '#FF453A' };
  
  const IC_BLUE   = { light: '#007AFF', dark: '#0A84FF' }; 
  const IC_PURPLE = { light: '#AF52DE', dark: '#BF5AF2' }; 

  // ===================== 2. 辅助函数 =====================
  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    if (/移动|mobile|cmcc/i.test(s)) return "中国移动";
    if (/电信|telecom|chinanet/i.test(s)) return "中国电信";
    if (/联通|unicom/i.test(s)) return "中国联通";
    if (/广电|broadcast|cbn/i.test(s)) return "中国广电";
    return isp; 
  };

  const getFlag = (code) => {
    if (!code || code.toUpperCase() === 'TW') return '🇨🇳';
    if (code.toUpperCase() === 'XX' || code === 'OK') return '✅';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  };

  const d = ctx.device || {};
  const isWifi = !!d.wifi?.ssid;
  let netName = isWifi ? d.wifi.ssid : (d.cellular?.radio || "Cellular");
  let netIcon = isWifi ? "wifi" : "antenna.radiowaves.left.and.right";

  // ===================== 3. 检测核心逻辑 =====================
  const commonHeaders = { "User-Agent": "Mozilla/5.0 (iPhone; CPU OS 17_0) AppleWebKit/605.1.15" };

  const checkNetflix = async () => {
    try {
      const res = await ctx.http.get("https://www.netflix.com/title/80018499", { headers: commonHeaders, timeout: 3500, followRedirect: false });
      if (res.status >= 200 && res.status < 400) {
        const reg = res.headers["x-netflix-originating-env"] || res.headers["X-Netflix-Originating-Env"];
        return { name: "NF", region: reg ? reg.split(',')[0].toUpperCase() : "OK" };
      }
      const basicRes = await ctx.http.get("https://www.netflix.com/title/81215567", { headers: commonHeaders, timeout: 3500, followRedirect: false });
      return { name: "NF", region: (basicRes.status >= 200 && basicRes.status < 400) ? "🍿" : "❌" };
    } catch (e) { return { name: "NF", region: "❌" }; }
  };

  const checkUnlock = async (name, url, checkFn) => {
    try {
      const res = await ctx.http.get(url, { headers: commonHeaders, timeout: 3500, followRedirect: false });
      return { name, region: (await checkFn(res)) ? "OK" : "❌" };
    } catch (e) { return { name, region: "❌" }; }
  };

  const globalStart = Date.now();
  let realTcpDelay = 0;

  const [pingTask, lResRaw, nResRaw, pureResRaw, ...unlockResults] = await Promise.all([
    ctx.http.get("http://connectivitycheck.gstatic.com/generate_204", { timeout: 2000 })
      .then(() => { realTcpDelay = Date.now() - globalStart; }).catch(() => {}),
    ctx.http.get('https://myip.ipip.net/json', { timeout: 4000 }).catch(() => null),
    ctx.http.get('http://ip-api.com/json/?lang=zh-CN', { timeout: 4000 }).catch(() => null),
    ctx.http.get('https://my.ippure.com/v1/info', { timeout: 4000 }).catch(() => null),
    checkUnlock("GPT", "https://chatgpt.com/", async (res) => res.status === 200 || res.status === 403),
    checkNetflix(),
    checkUnlock("TK", "https://www.tiktok.com/", async (res) => res.status >= 200 && res.status < 400),
    checkUnlock("GMNI", "https://gemini.google.com/", async (res) => res.status >= 200 && res.status < 400),
    checkUnlock("D+", "https://www.disneyplus.com/", async (res) => res.status >= 200 && res.status < 400)
  ]);

  // ===================== 4. 数据解析 =====================
  let lIp = "N/A", lLoc = "—", lIsp = "—";
  try { if (lResRaw) {
    const body = JSON.parse(await lResRaw.text());
    lIp = body.data.ip;
    lLoc = `🇨🇳 ${body.data.location[1]} ${body.data.location[2]}`.trim();
    lIsp = fmtISP(body.data.location[4] || body.data.location[3]);
  }} catch (e) {}

  let nIp = "失败", nLoc = "—", nIsp = "—", nCountryCode = "XX";
  try { if (nResRaw) {
    const nData = JSON.parse(await nResRaw.text());
    nIp = nData.query; nIsp = fmtISP(nData.isp); nCountryCode = nData.countryCode;
    nLoc = `${getFlag(nCountryCode)} ${nData.country} ${nData.city}`.trim();
  }} catch (e) {}

  let pureData = {};
  try { if (pureResRaw) pureData = JSON.parse(await pureResRaw.text()); } catch (e) {}
  const risk = pureData.fraudScore;
  let riskTxt = "超时", riskCol = C_SUB, riskIc = "questionmark.shield.fill";
  if (risk !== undefined) {
    if (risk >= 75) { riskTxt = `高风险 (${risk})`; riskCol = C_RED; riskIc = "xmark.shield.fill"; }
    else if (risk >= 35) { riskTxt = `中风险 (${risk})`; riskCol = C_YELLOW; riskIc = "exclamationmark.shield.fill"; }
    else { riskTxt = `低风险 (${risk})`; riskCol = C_GREEN; riskIc = "checkmark.shield.fill"; }
  }
  const nativeText = pureData.isResidential === true ? "🏠 住宅" : (pureData.isResidential === false ? "🏢 机房" : "🌐 代理");

  const unlockText = unlockResults.map(r => {
    if (r.region === "❌") return `${r.name}:🚫`;
    if (r.region === "🍿") return `${r.name}:🍿`;
    const finalReg = (r.region && r.region !== "OK") ? r.region : nCountryCode;
    return `${r.name}:${getFlag(finalReg)}`;
  }).join(" · ");

  let delayColor = C_SUB;
  if (realTcpDelay > 0) {
    if (realTcpDelay < 150) delayColor = C_GREEN;
    else if (realTcpDelay <= 350) delayColor = C_YELLOW;
    else delayColor = C_RED;
  }

  // ===================== 5. UI 组件 =====================
  const Row = (ic, icCol, label, val, valCol) => ({
    type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
    children: [
      { type: 'image', src: `sf-symbol:${ic}`, color: icCol, width: 13, height: 13 },
      { type: 'text', text: label, font: { size: 11 }, textColor: C_SUB },
      { type: 'spacer' },
      { type: 'text', text: val, font: { size: 11, weight: 'bold', family: 'Menlo' }, textColor: valCol, maxLines: 1, minScale: 0.6 }
    ]
  });

  return {
    type: 'widget', 
    padding: 14,
    backgroundGradient: { colors: [BG_COLORS[0], BG_COLORS[1]], direction: 'topToBottom' },
    refreshPolicy: { onNetworkChange: true, onEnter: true, timeout: 10 },
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
          { type: 'image', src: `sf-symbol:${netIcon}`, color: C_TITLE, width: 16, height: 16 },
          { type: 'text', text: netName, font: { size: 14, weight: 'heavy' }, textColor: C_TITLE },
          { type: 'spacer' },
          { type: 'text', text: realTcpDelay > 0 ? `${realTcpDelay}ms` : '--', font: { size: 11, weight: 'bold', family: 'Menlo' }, textColor: delayColor }
      ]},
      { type: 'spacer', length: 12 },
      { type: 'stack', direction: 'column', gap: 4, children: [
          Row("house.fill", IC_BLUE, "本地 IP", lIp, C_MAIN),
          Row("map.fill", IC_BLUE, "本地位置", `${lLoc} ${lIsp}`, C_MAIN),
          { type: 'spacer', length: 2 },
          Row("network", IC_PURPLE, "落地 IP", `${nIp} (${nativeText.split(' ')[1]})`, C_MAIN),
          Row("mappin.and.ellipse", IC_PURPLE, "落地位置", `${nLoc} ${nIsp}`, C_MAIN),
          { type: 'spacer', length: 2 },
          Row(riskIc, riskCol, "风险评级", riskTxt, riskCol),
          Row("play.tv.fill", C_MAIN, "流媒体", unlockText, C_MAIN) 
      ]},
      { type: 'spacer' }
    ]
  };
}
