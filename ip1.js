/**
 * 🌐 Network Info Panel (位置显示专项优化版)
 */

export default async function(ctx) {
  const C = {
    bg: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }],
    main: { light: '#007AFF', dark: '#5AC8FA' },
    sub: { light: '#1C1C1E', dark: '#F2F2F7' }, 
    gold: '#FFCC00', orange: '#FF9500', red: '#FF3B30', teal: '#34C759',
    blue: '#007AFF', purple: '#AF52DE', cyan: '#5AC8FA'
  };

  const BASE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";

  const httpGet = async (url) => {
    try {
      const resp = await ctx.http.get(url, { headers: { "User-Agent": BASE_UA }, timeout: 5000 });
      const text = await resp.text();
      let data = {};
      try { data = JSON.parse(text); } catch { data = text; }
      return { data: data.data || data }; 
    } catch (e) { return { data: {} }; }
  };

  const getFlagEmoji = (cc) => {
    if (!cc) return "";
    const str = String(cc).toUpperCase();
    return String.fromCodePoint(...[...str].map(c => 127397 + c.charCodeAt(0)));
  };

  // 运营商提取核心
  const getISPName = (isp) => {
    if (!isp) return "";
    if (isp.includes("电信")) return "电信";
    if (isp.includes("移动")) return "移动";
    if (isp.includes("联通")) return "联通";
    return "";
  };

  try {
    const d = ctx.device || {};
    const internalIP = d.ipv4?.address || "127.0.0.1";
    const wifiSsid = d.wifi?.ssid || "";

    const nodeStart = Date.now();
    const [localResp, nodeResp, pureResp, cfTrace, nf, gpt, gem, tiktok] = await Promise.all([
      httpGet('https://myip.ipip.net/json'), 
      httpGet('http://ip-api.com/json/?lang=zh-CN'),
      httpGet('https://my.ippure.com/v1/info'),
      httpGet('https://cloudflare.com/cdn-cgi/trace'),
      checkNetflix(ctx), checkGPT(ctx), checkGemini(ctx), checkTikTok(ctx)
    ]);
    const nodePing = Date.now() - nodeStart;

    const local = localResp.data || {};
    const node = nodeResp.data || {};
    const pure = pureResp.data || {};
    const trace = {};
    if (typeof cfTrace.data === 'string') {
        cfTrace.data.split('\n').forEach(line => { const [k, v] = line.split('='); if(k) trace[k] = v; });
    }

    // --- 🚀 核心位置逻辑优化 ---
    const locArr = local.location || [];
    // 过滤掉中国、IP、局域网等无关词
    const cleanLoc = locArr.filter(item => item && !/中国|IP|数据中心|局域网|运营商/i.test(item));
    const isp = getISPName(locArr.join(''));
    const province = cleanLoc[0] || "";
    const city = cleanLoc[1] || "";

    let finalLocDisplay = "";
    if (wifiSsid) {
      // 无线网络：只显示 江苏.苏州
      finalLocDisplay = city ? `${province}.${city}` : province;
    } else {
      // 蜂窝网络：只显示 电信.江苏
      finalLocDisplay = isp ? `${isp}.${province}` : province;
    }

    // 顶部标题逻辑
    let currentISPHead = wifiSsid || (isp ? `中国${isp}` : "移动网络");

    const r1Content = `${internalIP} / ${local.ip || '--'} / ${finalLocDisplay}`;
    const entranceColo = trace.colo || "未知";
    const r2Content = `中转节点 (${entranceColo}) / AS13335`;

    const nodeFlag = getFlagEmoji(node.countryCode);
    const nodeAsn = node.as ? node.as.split(' ')[0] : "N/A";
    const r3Content = `${node.query || '--'} / ${nodeFlag}${node.country || ''} ${node.city || ''} / ${nodeAsn}`;
    
    const riskScore = parseInt(pure.fraudScore) || 0;
    let riskLevel = "纯净", riskColor = C.teal;
    if (riskScore > 70) { riskLevel = "高危"; riskColor = C.red; }
    else if (riskScore > 40) { riskLevel = "中危"; riskColor = C.orange; }
    else if (riskScore > 10) { riskLevel = "低危"; riskColor = C.gold; }

    const nativeText = pure.isResidential === true ? "家宽" : (pure.isResidential === false ? "机房" : "未知");
    const tlsVer = trace.tls || "TLS 1.3";
    const r4Content = `${nativeText} / ${tlsVer} / ${riskScore} (${riskLevel})`;

    const buildRow = (icon, label, content, color) => ({
      type: 'stack', direction: 'row', alignItems: 'start', gap: 8, children: [
        { type: 'image', src: `sf-symbol:${icon}`, color: color || C.sub, width: 13, height: 13, paddingTop: 2 },
        { type: 'text', text: label, font: { size: 12.5 }, textColor: C.sub, width: 32 },
        { type: 'text', text: content, font: { size: 12.5 }, textColor: color || C.main, lineLimit: 0, flex: 1 }
      ]
    });

    const mediaServices = [
      { name: 'GPT', ok: gpt }, { name: 'NF', ok: nf }, { name: 'TikTok', ok: tiktok }, { name: 'Gemini', ok: gem }
    ];

    return {
      type: 'widget', padding: [14, 16, 12, 16],
      backgroundGradient: { colors: C.bg, direction: 'topToBottom' },
      children: [
        { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
            { type: 'image', src: wifiSsid ? 'sf-symbol:wifi' : 'sf-symbol:antenna.radiowaves.left.and.right', color: C.main, width: 16, height: 16 },
            { type: 'text', text: currentISPHead, font: { size: 17, weight: 'heavy' }, textColor: C.main },
            { type: 'spacer' },
            { type: 'text', text: nodePing > 0 ? `${nodePing}ms` : "--", font: { size: 12 }, textColor: C.sub }
        ]},
        { type: 'spacer', length: 12 },
        { type: 'stack', direction: 'column', alignItems: 'start', gap: 8, children: [
            buildRow('house.fill', '本地', r1Content, C.blue),
            buildRow('arrow.right.circle.fill', '入口', r2Content, C.cyan),
            buildRow('globe', '落地', r3Content, C.purple),
            buildRow('shield.fill', '属性', r4Content, riskColor),
            {
              type: 'stack', direction: 'row', alignItems: 'center', gap: 8, children: [
                { type: 'image', src: 'sf-symbol:play.tv', color: C.orange, width: 13, height: 13 },
                { type: 'text', text: '解锁', font: { size: 12.5 }, textColor: C.sub, width: 32 },
                { type: 'stack', direction: 'row', gap: 8, children: mediaServices.map(m => ({
                    type: 'text', text: `${m.name}${m.ok ? '✅' : '🚫'}`, font: { size: 12.5 }, textColor: m.ok ? C.teal : C.red
                }))}
              ]
            }
        ]},
        { type: 'spacer' }
      ]
    };
  } catch(err) {
    return { type: 'widget', children: [{ type: 'text', text: err.message }] };
  }
}

async function checkNetflix(ctx) { try { const res = await ctx.http.get("https://www.netflix.com/title/81280792", { timeout: 4000 }); return res.status === 200; } catch { return false; } }
async function checkGPT(ctx) { try { await ctx.http.get("https://chatgpt.com", { timeout: 4000 }); return true; } catch { return false; } }
async function checkGemini(ctx) { try { const res = await ctx.http.get("https://gemini.google.com", { timeout: 4000 }); return res.status === 200; } catch { return false; } }
async function checkTikTok(ctx) { try { await ctx.http.get("https://www.tiktok.com", { timeout: 4000 }); return true; } catch { return false; } }
