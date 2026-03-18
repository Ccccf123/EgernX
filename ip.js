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
    const [internalIP, gatewayIP, wifiSsid, cellularRadio] = [d.ipv4?.address, d.ipv4?.gateway, d.wifi?.ssid, d.cellular?.radio];

    const [localResp, nodeResp, pureResp] = await Promise.all([
      httpGet('https://myip.ipip.net/json'), 
      httpGet('http://ip-api.com/json/?lang=zh-CN'),
      httpGet('https://my.ippure.com/v1/info')
    ]);

    const { data: local, ping: localPing } = localResp;
    const { data: node, ping: nodePing } = nodeResp;
    const pure = pureResp.data || {}; 

    const pingMs = nodePing || localPing || 0;
    const pingColor = pingMs === 0 ? C.muted : (pingMs < 100 ? C.teal : (pingMs < 200 ? C.gold : C.red));

    const rawISP = (Array.isArray(local.location) ? local.location[local.location.length - 1] : "") || node?.isp || node?.org;
    const currentISP = fmtISP(rawISP);
    
    const ispColor = currentISP === "中国电信" ? C.blue : C.main;

    const rawRadio = cellularRadio ? String(cellularRadio).toUpperCase().trim() : "";
    const radioType = { "GPRS": "2G", "EDGE": "2.75G", "LTE": "4G", "LTE-CA": "4G+", "NR": "5G" }[rawRadio] || rawRadio;
    const jumpUrl = { "中国移动": "leadeon://", "中国电信": "ctclient://", "中国联通": "chinaunicom://" }[currentISP] || "";

    const r1Content = [internalIP || "未连接", gatewayIP !== internalIP ? gatewayIP : null].filter(Boolean).join(" / ");

    // 本地地址使用 ipip.net 显示省.市
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

    const risk = pure.fraudScore;
    let riskColor = C.sub;
    let riskTxt = "未知风险";
    if (risk !== undefined) {
      if (risk >= 80) { riskTxt = `极高危(${risk})`; riskColor = C.red; }
      else if (risk >= 70) { riskTxt = `高危(${risk})`; riskColor = C.orange; }
      else if (risk >= 40) { riskTxt = `中危(${risk})`; riskColor = C.gold; }
      else { riskTxt = `低危(${risk})`; riskColor = C.teal; }
    }
    const nativeText = pure.isResidential === true ? "原生住宅" : (pure.isResidential === false ? "商业机房" : "未知属性");

    const buildRow = (icon, color, label, content, contentColor) => ({
      type: 'stack', direction: 'row', alignItems: 'center', gap: 10, children: [ 
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 5, width: 56, children: [
            { type: 'image', src: `sf-symbol:${icon}`, color, width: 13, height: 13 },
            { type: 'text', text: label, font: { size: 13, weight: 'heavy' }, textColor: color }
        ]},
        { type: 'text', text: content, font: { size: 12.5, weight: 'regular', lineHeight: 14 }, textColor: contentColor || C.sub, maxLines: 1, flex: 1 }
      ]
    });

    const widgetConfig = {
      type: 'widget', padding: [14, 16, 12, 16], 
      backgroundGradient: { colors: C.bg, direction: 'topToBottom' },
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
            { type: 'image', src: wifiSsid ? 'sf-symbol:wifi' : (cellularRadio ? 'sf-symbol:antenna.radiowaves.left.and.right' : 'sf-symbol:wifi.slash'), color: C.main, width: 16, height: 16 },
            { type: 'text', text: `${currentISP} · ${wifiSsid || radioType || "未连接"}`, font: { size: 17, weight: 'heavy' }, textColor: ispColor, maxLines: 1, minScale: 0.7 },
            { type: 'spacer' },
            { type: 'stack', direction: 'row', alignItems: 'center', gap: 2, children: [
                { type: 'image', src: 'sf-symbol:timer', color: pingColor, width: 12, height: 12 },
                { type: 'text', text: pingMs > 0 ? `${pingMs}` : "--", font: { size: 12, weight: 'regular' }, textColor: pingColor },
                { type: 'text', text: 'ms', font: { size: 10, weight: 'regular' }, textColor: pingColor }
            ]}
        ]},
        { type: 'spacer', length: 12 }, 
        { type: 'stack', direction: 'column', alignItems: 'start', gap: 4, children: [
            buildRow('house.fill', C.teal, '内网', r1Content),
            buildRow('location.circle.fill', C.blue, '本地', r2Content),
            buildRow('network', C.purple, '节点', r3Content),
            buildRow('shield.lefthalf.filled', C.cyan, '属性', `${nativeText} / ${riskTxt}`, riskColor)
        ]},
        { type: 'spacer' } 
      ]
    };
    
    if (jumpUrl) widgetConfig.url = jumpUrl;
    return widgetConfig;

  } catch (err) {
    return {
      type: 'widget', padding: 12, 
      backgroundGradient: { colors: C.bg, direction: 'topToBottom' },
      children: [
        { type: 'text', text: '小组件崩溃 ⚠️', font: { size: 14, weight: 'heavy' }, textColor: '#FF453A' },
        { type: 'spacer', length: 4 },
        { type: 'text', text: String(err.message || err), font: { size: 11 }, textColor: '#8E8E93', maxLines: 5 }
      ]
    };
  }
}