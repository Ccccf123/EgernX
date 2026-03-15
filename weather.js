/**
 * 🌤️ 和风天气 - Egern 小组件 (简洁版)
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  const apiKey     = (env.KEY || '').trim();
  const apiHostRaw = (env.API_HOST || '').trim();
  const location   = (env.LOCATION || '北京').trim();

  if (!apiKey)     return renderError('缺少 KEY 环境变量');
  if (!apiHostRaw) return renderError('缺少 API_HOST 环境变量');

  const apiHost = normalizeHost(apiHostRaw);

  try {
    const { lon, lat, city } = await getLocation(ctx, location, apiKey, apiHost);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);

    let air = { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
    if (widgetFamily !== 'systemSmall' && !isAccessoryFamily(widgetFamily)) {
      air = await fetchAirQuality(ctx, apiKey, lon, lat, apiHost);
    }

    if (isAccessoryFamily(widgetFamily)) {
      return renderAccessoryCompact(now, city, widgetFamily);
    }

    if (widgetFamily === 'systemSmall') {
      return renderSmall(now, city);
    } else {
      return renderMedium(now, air, city);
    }
  } catch (e) {
    console.error(e);
    return renderError(`请求失败`);
  }
}

// ────────────────────────────────────────────────
// 核心函数 (保留原有逻辑)
// ────────────────────────────────────────────────

async function fetchAirQuality(ctx, key, lon, lat, host) {
  try {
    const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();
    if (data.code === '200' && data.now) {
      const val = Number(data.now.aqi);
      return { aqi: Math.round(val), category: data.now.category, color: getAQICategory(val).color };
    }
  } catch {}
  return { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

async function getLocation(ctx, locName, key, host) {
  const presets = { '北京': { lon: '116.407396', lat: '39.904211' }, '上海': { lon: '121.473701', lat: '31.230416' }, '昆山': { lon: '120.980737', lat: '31.384649' } };
  if (presets[locName]) return { ...presets[locName], city: locName };
  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(locName)}&key=${key}&number=1&lang=zh`;
    const resp = await ctx.http.get(url);
    const data = await resp.json();
    if (data.code === '200' && data.location?.[0]) return { lon: data.location[0].lon, lat: data.location[0].lat, city: data.location[0].name };
  } catch {}
  return { lon: '116.4074', lat: '39.9042', city: locName };
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();
  if (data.code !== '200') throw new Error();
  return { temp: data.now.temp, text: data.now.text, icon: data.now.icon, humidity: data.now.humidity, windDir: data.now.windDir, windScale: data.now.windScale, windSpeed: data.now.windSpeed };
}

// ────────────────────────────────────────────────
// 渲染函数 (已去除文字标签)
// ────────────────────────────────────────────────

function renderMedium(now, air, city) {
  const time = new Date();
  const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2,'0')}`;

  return {
    type: 'widget',
    padding: 16,
    gap: 16,
    backgroundColor: { light: '#F9F9F9', dark: '#1C1C1E' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
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
        gap: 20,
        children: [
          { type: 'image', src: `sf-symbol:${getWeatherIcon(now.icon)}`, width: 50, height: 50, color: getWeatherColor(now.icon) },
          { type: 'text', text: `${now.temp}°`, font: { size: 'largeTitle', weight: 'bold' } },
          { type: 'text', text: now.text, font: { size: 'title3' }, textColor: { light: '#666', dark: '#AAA' } }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 24,
        children: [
          { type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [{ type: 'image', src: 'sf-symbol:drop.fill', width: 14, height: 14, color: { light: '#007AFF', dark: '#0A84FF' } }, { type: 'text', text: `${now.humidity}%`, font: { size: 'subheadline', weight: 'semibold' } }] },
          { type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [{ type: 'image', src: 'sf-symbol:wind', width: 14, height: 14, color: { light: '#5856D6', dark: '#5E5CE6' } }, { type: 'text', text: `${now.windScale}级`, font: { size: 'subheadline', weight: 'semibold' } }] },
          { type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [{ type: 'image', src: 'sf-symbol:gauge.medium', width: 14, height: 14, color: { light: '#FF9500', dark: '#FFB340' } }, { type: 'text', text: `${now.windSpeed}km/h`, font: { size: 'subheadline', weight: 'semibold' } }] }
        ]
      }
    ]
  };
}

// ────────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────────

function normalizeHost(host) { return host.startsWith('http') ? host : `https://${host}`; }
function isAccessoryFamily(family) { return family.startsWith('accessory'); }
function getAQICategory(n) { return n <= 50 ? { color: { light: '#4CD964', dark: '#34C759' } } : { color: { light: '#FFCC00', dark: '#FF9F0A' } }; }
function getWeatherIcon(code) { const map = { '100': 'sun.max.fill', '101': 'cloud.sun.fill', '305': 'cloud.rain.fill', '501': 'cloud.fog.fill' }; return map[code] || 'cloud.fill'; }
function getWeatherColor(code) { return { light: '#FF9500', dark: '#FFB340' }; }
function renderSmall(now, city) { return { type: 'widget', children: [{ type: 'text', text: `${now.temp}° ${now.text}` }] }; }
function renderAccessoryCompact(now, city) { return { type: 'widget', children: [{ type: 'text', text: `${now.temp}° ${city}` }] }; }
function renderError(msg) { return { type: 'widget', children: [{ type: 'text', text: '!' }] }; }
