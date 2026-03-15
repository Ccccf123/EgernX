/**
 * 🌤️ 和风天气 - Egern 小组件 (AQI 强效修复版)
 * * 环境变量说明：
 * KEY: 和风天气 Web API Key
 * API_HOST: devapi.qweather.com (免费版) 或 api.qweather.com (订阅版)
 * LOCATION: 城市名 (如: 昆山)
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  const apiKey     = (env.KEY || '').trim();
  const apiHostRaw = (env.API_HOST || 'devapi.qweather.com').trim();
  const location   = (env.LOCATION || '北京').trim();

  if (!apiKey) return renderError('缺少 KEY');
  const apiHost = apiHostRaw.startsWith('http') ? apiHostRaw : `https://${apiHostRaw}`;

  try {
    const { lon, lat, city } = await getLocation(ctx, location, apiKey, apiHost);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);

    // 只有中尺寸显示空气质量
    let air = { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
    if (widgetFamily === 'systemMedium') {
      air = await fetchAirQuality(ctx, apiKey, lon, lat, apiHost);
    }

    if (widgetFamily === 'systemSmall') {
      return renderSmall(now, city);
    } else {
      return renderMedium(now, air, city);
    }

  } catch (e) {
    console.error(e);
    return renderError("请求失败");
  }
}

// ────────────────────────────────────────────────
// 核心修复：多路径 AQI 获取
// ────────────────────────────────────────────────

async function fetchAirQuality(ctx, key, lon, lat, host) {
  const timeout = 5000;
  
  // 路径 A: V7 实时空气质量 (最常用)
  try {
    const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}`;
    const resp = await ctx.http.get(url, { timeout });
    const data = await resp.json();
    if (data.code === '200' && data.now?.aqi) {
      return parseAQI(data.now.aqi, data.now.category);
    }
  } catch (e) {}

  // 路径 B: V1 空气质量 (部分新 Key 默认路径)
  try {
    const url = `${host}/airquality/v1/current/${lat},${lon}?key=${key}`;
    const resp = await ctx.http.get(url, { timeout });
    const data = await resp.json();
    const index = data.indexes?.find(i => i.code === 'cn-mee') || data.indexes?.[0];
    if (data.code === '200' && index?.aqi) {
      return parseAQI(index.aqi, index.category);
    }
  } catch (e) {}

  return { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

function parseAQI(val, cat) {
  const n = Number(val);
  let color = { light: '#4CD964', dark: '#34C759' }; // 优
  if (n > 50)  color = { light: '#FFCC00', dark: '#FF9F0A' }; // 良
  if (n > 100) color = { light: '#FF9500', dark: '#FF9500' }; // 中
  if (n > 150) color = { light: '#FF3B30', dark: '#FF453A' }; // 差
  return { aqi: n, category: cat || '未知', color };
}

// ────────────────────────────────────────────────
// 天气与地理 (精简稳定版)
// ────────────────────────────────────────────────

async function getLocation(ctx, name, key, host) {
  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(name)}&key=${key}&number=1`;
    const resp = await ctx.http.get(url);
    const data = await resp.json();
    if (data.code === '200' && data.location?.[0]) {
      return { lon: data.location[0].lon, lat: data.location[0].lat, city: data.location[0].name };
    }
  } catch {}
  return { lon: '120.98', lat: '31.38', city: name }; // 默认昆山坐标
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();
  return data.now;
}

// ────────────────────────────────────────────────
// 渲染逻辑 (保持你要的排版)
// ────────────────────────────────────────────────

function renderMedium(now, air, city) {
  const time = new Date();
  const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2,'0')}`;
  return {
    type: 'widget',
    padding: 16,
    gap: 12,
    backgroundColor: { light: '#FFF', dark: '#1C1C1E' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'image', src: 'sf-symbol:location.fill', width: 14, height: 14, color: { light: '#FF3B30', dark: '#FF453A' } },
          { type: 'text', text: city, font: { size: 'title3', weight: 'bold' } },
          { type: 'spacer' },
          { type: 'text', text: `AQI ${air.aqi}`, font: { size: 'caption1', weight: 'bold' }, textColor: air.color },
          { type: 'text', text: `  ${timeStr}`, font: { size: 'caption2' }, textColor: { light: '#999', dark: '#666' } }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 16,
        children: [
          { type: 'image', src: `sf-symbol:cloud.fill`, width: 64, height: 64, color: { light: '#8E8E93', dark: '#AEAEB2' } },
          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' } },
              { type: 'text', text: now.text, font: { size: 'title3' }, textColor: { light: '#666', dark: '#AAA' } }
            ]
          },
          { type: 'text', text: air.category, font: { size: 'title3', weight: 'bold' }, textColor: air.color }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 12,
        children: [
          { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, flex: 1, children: [{ type: 'image', src: 'sf-symbol:drop.fill', width: 18, height: 18, color: '#007AFF' }, { type: 'text', text: `${now.humidity}%`, font: { size: 'title3', weight: 'semibold' } }] },
          { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, flex: 1, children: [{ type: 'image', src: 'sf-symbol:wind', width: 18, height: 18, color: '#5856D6' }, { type: 'text', text: `${now.windScale}级`, font: { size: 'title3', weight: 'semibold' } }] },
          { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, flex: 1, children: [{ type: 'image', src: 'sf-symbol:gauge.medium', width: 18, height: 18, color: '#FF9500' }, { type: 'text', text: `${now.windSpeed}k/h`, font: { size: 'title3', weight: 'semibold' } }] }
        ]
      }
    ]
  };
}

function renderSmall(now, city) {
  return { type: 'widget', padding: 16, children: [{ type: 'text', text: city }, { type: 'text', text: `${now.temp}°` }] };
}

function renderError(msg) {
  return { type: 'widget', padding: 16, children: [{ type: 'text', text: msg, textColor: '#F00' }] };
}
