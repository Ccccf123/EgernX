/**
 * 📌 网络·代理·IP纯净度 - 并行优化版
 */
export default async function(ctx) {
  // ✨ 统一极客渐变背景配置
  const BG_COLORS = [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }];
  
  // 统一配色方案
  const C_MAIN = { light: '#000000', dark: '#FFFFFF' };
  const C_SUB = { light: '#666666', dark: '#999999' };
  const C_TITLE = { light: '#007AFF', dark: '#0A84FF' };
  const C_GREEN = { light: '#34C759', dark: '#30D158' };

  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = isp.toLowerCase();
    if (/移动|mobile|cmcc/i.test(s)) return "中国移动";
    if (/电信|telecom|chinanet/i.test(s)) return "中国电信";
    if (/联通|unicom/i.test(s)) return "中国联通";
    if (/广电|broadcast|cbn/i.test(s)) return "中国广电";
    return isp; 
  };

  const d = ctx.device || {};
  const isWifi = !!d.wifi?.ssid;
  
  let netName = "未连接", netIcon = "antenna.radiowaves.left.and.right";
  if (isWifi) {
    netName = d.wifi.ssid; 
    netIcon = "wifi";
  } else if (d.cellular?.radio) {
    const radioMap = { 
      "GPRS": "2.5G", "EDGE": "2.75G", "WCDMA": "3G", 
      "LTE": "4G", "NR": "5G (NR)", "NRNSA": "5G (NR)" 
    };
    const rawRadio = d.cellular.radio.toUpperCase().replace(/\s+/g, "");
    netName = `蜂窝: ${radioMap[rawRadio] || rawRadio}`;
  }

  const localIp = d.ipv4?.address || "获取失败";

  // 🚀 并行请求三个外部接口
  let pubIp = "获取失败", pubLoc = "未知位置", pubIsp = "未知运营商";
  let nIp = "获取失败", nLoc = "未知位置", asnInfo = "未知";
  let ipData = {}, costTime = 0;

  try {
    const start = Date.now();
    const [resIpip, resIpinfo, resPure] = await Promise.all([
      ctx.http.get('https://myip.ipip.net/json', { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }),
      ctx.http.get('https://ipinfo.io/json', { timeout: 5000 }),
      ctx.http.get('https://my.ippure.com/v1/info', { timeout: 4000 })
    ]);
    costTime = Date.now() - start;

    // ipip.net
    const body = JSON.parse(await resIpip.text());
    if (body?.data) {
      pubIp = body.data.ip || "获取失败";
      const locArr = body.data.location || [];
      pubLoc = `🇨🇳 ${locArr[1] || ""} ${locArr[2] || ""}`.trim() || "未知位置";
      pubIsp = fmtISP(locArr[4] || locArr[3]);
    }

    // ipinfo.io
    const data = JSON.parse(await resIpinfo.text());
    nIp = data.ip || "获取失败";
    const code = data.country || "";
    const flag = code ? String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt())) : "🌐";
    nLoc = `${flag} ${data.region || ""} ${data.city || ""}`.trim();
    if (data.org) {
      const parts = data.org.split(" ");
      const asn = parts[0]; // 例如 AS4134
      const name = parts.slice(1).join(" ");
      asnInfo = `${asn} ${name}`;
    }

    // ippure.com
    ipData = JSON.parse(await resPure.text());
  } catch(e) {}

  const nativeText = ipData.isResidential ? "🏠 原生住宅" : ipData.isResidential === false ? "🏢 商业机房" : "未知";
  const nodeIpWithNative = `${nIp} ${nativeText}`;

  const risk = ipData.fraudScore;
  let riskTxt = "获取失败", riskCol = C_SUB, riskIc = "questionmark.shield.fill";
  if (risk != null) {
    if (risk >= 80) { riskTxt = `极高风险 (${risk})`; riskCol = { light: '#FF3B30', dark: '#FF3B30' }; riskIc = "xmark.shield.fill"; }
    else if (risk >= 70) { riskTxt = `高风险 (${risk})`; riskCol = { light: '#FF9500', dark: '#FF9500' }; riskIc = "exclamationmark.shield.fill"; }
    else if (risk >= 40) { riskTxt = `中等风险 (${risk})`; riskCol = { light: '#FFD60A', dark: '#FFD60A' }; riskIc = "exclamationmark.shield.fill"; }
    else { riskTxt = `纯净低危 (${risk})`; riskCol = C_GREEN; riskIc = "checkmark.shield.fill"; }
  }

  const delayText = costTime > 0 ? `${costTime}ms` : "超时";
  let delayColor = C_GREEN;
  if (costTime > 100 && costTime <= 300) delayColor = { light: '#FFCC00', dark: '#FFCC00' };
  else if (costTime > 300) delayColor = { light: '#FF3B30', dark: '#FF3B30' };

  const Row = (ic, icCol, label, val, valCol) => ({
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 5,
    children: [
      { type: 'image', src: `sf-symbol:${ic}`, color: icCol, width: 12, height: 12 },
      { type: 'text', text: label, font: { size: 10 }, textColor: C_SUB },
      { type: 'spacer' },
      { type: 'text', text: val, font: { size: 10, weight: 'bold', family: 'Menlo' }, textColor: valCol, maxLines: 1 }
    ]
  });

  return {
    type: 'widget',
    padding: [6, 10],
    backgroundGradient: { type: 'linear', colors: BG_COLORS, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 5,
        children: [
          { type: 'image', src: `sf-symbol:${netIcon}`, color: C_TITLE, width: 14, height: 14 },
          { type: 'text', text: netName, font: { size: 12, weight: 'bold' }, textColor: C_TITLE },
          { type: 'spacer' },
          { type: 'text', text: delayText, font: { size: 12, weight: 'bold' }, textColor: delayColor }
        ]
      },
      { type: 'spacer', length: 4 },
      {
        type: 'stack',
        direction: 'column',
        gap: 2,
        children: [
          Row("iphone", C_GREEN, "内网IP", localIp, C_MAIN),
          Row("globe", C_TITLE, "直连IP", pubIp, C_MAIN),
          Row("antenna.radiowaves.left.and.right", C_TITLE, "运营商", pubIsp, C_MAIN),
          Row("mappin.and.ellipse", C_TITLE, "位置", pubLoc, C_MAIN),
          Row("paperplane.fill", { light: '#FF3B30', dark: '#FF3B30' }, "落地IP", nodeIpWithNative, C_MAIN),
          Row("mappin.and.ellipse", { light: '#FF3B30', dark: '#FF3B30' }, "位置", nLoc, C_MAIN),
          Row("number.square.fill", { light: '#FF3B30', dark: '#FF3B30' }, "ASN信息", asnInfo, C_MAIN),
          Row(riskIc, riskCol, "风险", riskTxt, riskCol)
        ]
      }
    ]
  };
}
