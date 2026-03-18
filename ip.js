export default async function(ctx) {
  const C = {
    bg: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }],
    main: { light: '#000000', dark: '#FFFFFF' },
    sub: { light: '#1C1C1E', dark: '#F2F2F7' }, 
    muted: { light: '#8E8E93', dark: '#8E8E93' },
    gold: { light: '#FF9500', dark: '#FFD700' },     
    orange: { light: '#FF6B00', dark: '#FF8800' }, 
    red: { light: '#FF3B30', dark: '#FF453A' },      
    teal: { light: '#34C759', dark: '#30D158' },     
    blue: { light: '#007AFF', dark: '#0A84FF' },     
    purple: { light: '#AF52DE', dark: '#BF5AF2' },   
    cyan: { light: '#5AC8FA', dark: '#64D2FF' }
  };

  const httpGet = async (url) => {
    try {
      const start = Date.now();
      const resp = await ctx.http.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 6000 });
      const text = await resp.text();
      const json = JSON.parse(text);
      return { data: json.data || json, ping: Date.now() - start }; 
    } catch (e) { return { data: {}, ping: 0 }; }
  };

  const getFlagEmoji = (cc) => {
    if (!cc) return "";
    const str = String(cc).toUpperCase();
    if (!/^[A-Z]{2}$/.test(str)) return "";
    return String.fromCodePoint(...[...str].map(c => 127397 + c.charCodeAt(0)));
  };

  const fmtISP = (isp) => {
    if (!isp) return "未知";
    const s = String(isp).toLowerCase();
    const raw = String(isp).replace(/\s*\(中国\)\s*/, "").replace(/\s+/g, " ").trim();
    if (/(^|[\s-])(cmcc|cmnet|cmi|mobile)\b|移动/.test(s)) return "中国移动";
    if (/(^|[\s-])(chinanet|telecom|ctcc|ct)\b|电信/.test(s)) return "中国电信";
    if (/(^|[\s-])(unicom|cncgroup|netcom|link)\b|联通/.test(s)) return "中国联通";
    if (/(^|[\s-])(cbn|broadcast)\b|广电/.test(s)) return "中国广电";
    return raw || "未知";
  };

  try {
    const d = ctx.device || {};
    const internalIP = d.ipv4?.address || "未连接";
    const gatewayIP = d.ipv4?.gateway;
    const wifiSsid = d.wifi?.ssid || "";
    const cellularRadio = d.cellular?.radio || "";

    const [localResp, nodeResp, pureResp] = await Promise.all([
      httpGet('https://myip.ipip.net/json'), 
      httpGet('http://ip-api.com/json/?lang=zh-CN'),
      httpGet('https://my.ippure.com/v1/info')
    ]);

    const { data: local = {}, ping: localPing } = localResp;
    const { data: node = {}, ping: nodePing } = nodeResp;
    const pure = pureResp.data || {}; 

    const pingMs = nodePing || localPing || 0;

    const rawISP = (Array.isArray(local.location) ? local.location[local.location.length-1] : "") || node?.isp || node?.org || "";
    let currentISP = wifiSsid || fmtISP(rawISP);

    // ⭐ 仅新增：电信显示网络制式
    if (!wifiSsid && currentISP.includes("电信") && cellularRadio) {
      const map = { GPRS:"2G", EDGE:"2G", LTE:"4G", "LTE-CA":"4G+", NR:"5G" };
      currentISP = `${currentISP} ${map[cellularRadio] || cellularRadio}`;
    }

    const ispColor = currentISP.includes("电信") ? C.blue : C.main;

    const r1Content = [internalIP, gatewayIP !== internalIP ? gatewayIP : null].filter(Boolean).join(" / ");

    let province = '';
    let city = '';
    if (Array.isArray(local.location)) {
      province = local.location[0] || '';
      city = local.location[1] || '';
    }
    const locStr = city ? `${province}.${city}` : province;
    const r2Content = [local.ip || "获取中...", locStr].filter(Boolean).join(" / ");

    const nodeLoc = [getFlagEmoji(node.countryCode), node.country, node.city].filter(Boolean).join(" ");
    const asnStr = node.as ? String(node.as).split(' ')[0] : "";
    const r3Content = [node.query || node.ip || "获取中...", nodeLoc, asnStr].filter(Boolean).join(" / ");

    const nativeText = pure.isResidential === true ? "家宽" : (pure.isResidential === false ? "机房" : "未知属性");
    const risk = pure.fraudScore || 0;
    let riskColor = C.teal;
    let riskLevel = "低危";
    if (risk >= 80) { riskLevel = "极高危"; riskColor = C.red; }
    else if (risk >= 70) { riskLevel = "高危"; riskColor = C.orange; }
    else if (risk >= 40) { riskLevel = "中危"; riskColor = C.gold; }

    const mediaServices = {
      GPT: true,       
      Netflix: false,
      Disney: true,
      YouTube: true
    };

    const buildRow = (icon, label, content, color) => ({
      type: 'stack', direction: 'row', alignItems: 'center', gap: 10, children: [
        { type: 'image', src: `sf-symbol:${icon}`, color: color || C.sub, width: 14, height: 14 },
        { type: 'text', text: label, font: { size: 12.5, weight: 'regular', lineHeight: 14 }, textColor: C.sub },
        { type: 'stack', direction: 'row', gap: 4, children: content }
      ]
    });

    const mediaContent = Object.entries(mediaServices).map(([name, ok]) => ({
      type: 'text',
      text: ok ? `${name} ✅` : `${name} 🚫`,
      font: { size: 12.5, weight: 'regular', lineHeight: 14 },
      textColor: ok ? C.teal : C.red
    }));

    const widgetConfig = {
      type: 'widget', padding: [14,16,12,16],
      backgroundGradient: { colors: C.bg, direction: 'topToBottom' },
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
            { type: 'image', src: wifiSsid ? 'sf-symbol:wifi' : (cellularRadio ? 'sf-symbol:antenna.radiowaves.left.and.right' : 'sf-symbol:wifi.slash'), color: C.main, width: 16, height: 16 },
            { type: 'text', text: currentISP, font: { size: 17, weight: 'heavy' }, textColor: ispColor, maxLines: 1, minScale: 0.7 },
            { type: 'spacer' },
            { type: 'stack', direction: 'row', alignItems: 'center', gap: 2, children: [
                { type: 'image', src: 'sf-symbol:timer', color: C.sub, width: 12, height: 12 },
                { type: 'text', text: pingMs > 0 ? `${pingMs}ms` : "--", font: { size: 12, weight: 'regular' }, textColor: C.sub }
            ]}
        ]},
        { type: 'spacer', length: 12 },
        { type: 'stack', direction: 'column', alignItems: 'start', gap: 4, children: [
            buildRow('house.fill','内网', [{type:'text', text:r1Content, font:{size:12.5,weight:'regular'}, textColor:C.teal}], C.teal),
            buildRow('location.circle.fill','本地', [{type:'text', text:r2Content, font:{size:12.5,weight:'regular'}, textColor:C.blue}], C.blue),
            buildRow('map.fill','落地', [{type:'text', text:r3Content, font:{size:12.5,weight:'regular'}, textColor:C.purple}], C.purple),
            buildRow('shield.lefthalf.filled','属性', [{type:'text', text:`${nativeText} / ${risk} (${riskLevel})`, font:{size:12.5,weight:'regular'}, textColor:riskColor}], riskColor),
            buildRow('play.tv','解锁', mediaContent, C.orange)
        ]},
        { type: 'spacer' }
      ]
    };

    return widgetConfig;

  } catch(err) {
    return {
      type: 'widget', padding: 12,
      backgroundGradient: { colors: C.bg, direction: 'topToBottom' },
      children: [
        { type: 'text', text: '小组件崩溃 ⚠️', font: { size: 14, weight: 'heavy' }, textColor: C.red.light },
        { type: 'spacer', length: 4 },
        { type: 'text', text: String(err.message || err), font: { size: 11 }, textColor: C.muted.light, maxLines: 5 }
      ]
    };
  }
}