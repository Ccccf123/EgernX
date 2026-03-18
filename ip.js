export default async function(ctx) {
  // ===================== 1. 统一背景与配色方案 =====================
  const C = {
    // 渐变背景：深浅模式自动切换
    bg: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }],
    // 文字颜色：高对比度
    main: { light: '#000000', dark: '#FFFFFF' },
    sub: { light: '#48484A', dark: '#D1D1D6' },
    muted: { light: '#8E8E93', dark: '#8E8E93' },
    // 语义化图标颜色
    gold: { light: '#FF9500', dark: '#FFD700' },     
    red: { light: '#FF3B30', dark: '#FF453A' },      
    teal: { light: '#34C759', dark: '#30D158' },     
    blue: { light: '#007AFF', dark: '#0A84FF' },     
    purple: { light: '#AF52DE', dark: '#BF5AF2' },   
    cyan: { light: '#5AC8FA', dark: '#64D2FF' }      
  };

  const httpGet = async (url) => {
    try {
      const start = Date.now();
      const resp = await ctx.http.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 8000 });
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
    
    const rawRadio = cellularRadio ? String(cellularRadio).toUpperCase().trim() : "";
    const radioType = { "GPRS": "2.5G", "EDGE": "2.75G", "WCDMA": "3G", "LTE": "4G", "NR": "5G", "NRNSA": "5G" }[rawRadio] || rawRadio;
    const jumpUrl = { "中国移动": "leadeon://", "中国电信": "ctclient://", "中国联通": "chinaunicom://" }[currentISP] || "";

    const r1Content = [internalIP || "未连接", gatewayIP !== internalIP ? gatewayIP : null].filter(Boolean).join(" / ");
    const locStr = Array.isArray(local.location) ? local.location.slice(0, 3).join('').trim() : '';
    const r2Content = [local.ip || "获取中...", locStr].filter(Boolean).join(" / ");
    const nodeLoc = [getFlagEmoji(node.countryCode), node.country, node.city].filter(Boolean).join(" ");
    const asnStr = node.as ? String(node.as).split(' ')[0] : "";
    const r3Content = [node.query || node.ip || "获取中...", nodeLoc, asnStr].filter(Boolean).join(" / ");

    const risk = pure.fraudScore;
    const riskTxt = risk === undefined ? "未知风险" : (risk >= 80 ? `极高危(${risk})` : risk >= 70 ? `高危(${risk})` : risk >= 40 ? `中危(${risk})` : `低危(${risk})`);
    const nativeText = pure.isResidential === true ? "原生住宅" : (pure.isResidential === false ? "商业机房" : "未知属性");
    const r4Content = `${nativeText} / ${riskTxt}`;

    const buildRow = (icon, color, label, content) => ({
      type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 2, width: 45, children: [
            { type: 'image', src: `sf-symbol:${icon}`, color, width: 13, height: 13 },
            { type: 'text', text: label, font: { size: 12, weight: 'heavy' }, textColor: color }
        ]},
        { type: 'text', text: content, font: { size: 12, weight: 'medium' }, textColor: C.sub, maxLines: 1, flex: 1 }
      ]
    });

    const widgetConfig = {
      type: 'widget', padding: 12, 
      // 统一背景渐变方向为 topToBottom（更稳重）
      backgroundGradient: { colors: C.bg, direction: 'topToBottom' },
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
            { type: 'image', src: wifiSsid ? 'sf-symbol:wifi' : (cellularRadio ? 'sf-symbol:antenna.radiowaves.left.and.right' : 'sf-symbol:wifi.slash'), color: C.main, width: 16, height: 16 },
            { type: 'text', text: `${currentISP} · ${wifiSsid || radioType || "未连接"}`, font: { size: 15, weight: 'heavy' }, textColor: C.main, maxLines: 1, minScale: 0.7 },
            { type: 'spacer' },
            { type: 'stack', direction: 'row', alignItems: 'center', gap: 2, children: [
                { type: 'image', src: 'sf-symbol:timer', color: pingColor, width: 12, height: 12 },
                { type: 'text', text: pingMs > 0 ? `${pingMs}` : "--", font: { size: 12, weight: 'bold' }, textColor: pingColor },
                { type: 'text', text: 'ms', font: { size: 10, weight: 'medium' }, textColor: pingColor }
            ]}
        ]},
        { type: 'spacer', length: 8 }, 
        { type: 'stack', direction: 'column', alignItems: 'start', gap: 8, children: [
            buildRow('house.fill', C.teal, '内网', r1Content),
            buildRow('location.circle.fill', C.blue, '本地', r2Content),
            buildRow('network', C.purple, '节点', r3Content),
            buildRow('shield.lefthalf.filled', C.cyan, '属性', r4Content)
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
