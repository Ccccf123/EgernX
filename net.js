/**
 * 🌤️ 和风天气 - Egern 小组件 (背景统一 & 去除标签版)
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  const apiKey     = (env.KEY || '').trim();
  const apiHostRaw = (env.API_HOST || '').trim();
  const location   = (env.LOCATION || '北京').trim();

  // ✨ 统一极客渐变背景配置
  const BG_GRADIENT = { 
    type: 'linear', 
    colors: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }], 
    startPoint: { x: 0, y: 0 }, 
    endPoint: { x: 1, y: 1 } 
  };

  if (!apiKey)     return renderError('缺少 KEY 环境变量');
  if (!apiHostRaw) return renderError('缺少 API_HOST 环境变量');

  const apiHost = normalizeHost(apiHostRaw);

  try {
    const { lon, lat, city } = await getLocation(ctx, location, apiKey, apiHost);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);

    let air = null;
    if (widgetFamily !== 'systemSmall' && !isAccessoryFamily(widgetFamily)) {
      air = await fetchAirQuality(ctx, apiKey, lon, lat, apiHost);
    }

    let widget;
    if (isAccessoryFamily(widgetFamily)) {
      widget = renderAccessoryCompact(now, city, widgetFamily);
    } else if (widgetFamily === 'systemSmall') {
      widget = renderSmall(now, city);
    } else {
      widget = renderMedium(now, air, city);
    }

    return { ...widget, backgroundGradient: BG_GRADIENT };

  } catch (e) {
    return renderError(`请求失败：${e.message.slice(0, 60)}`);
  }
}

function normalizeHost(host) { let h = host; if (!/^https?:\/\//i.test(h)) h = 'https://' + h; return h.replace(/\/+$/, ''); }
function isAccessoryFamily(family) { return family.startsWith('accessory'); }

async function getLocation(ctx, locName, key, host) {
  const presets = { '北京': { lon: '116.4074', lat: '39.9042' }, '上海': { lon: '121.4737', lat: '31.2304' }, '广州': { lon: '113.2644', lat: '23.1291' }, '深圳': { lon: '114.0579', lat: '22.5431' }, '成都': { lon: '104.0657', lat: '30.6595' } };
  if (presets[locName]) return { ...presets[locName], city: locName };
  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(locName)}&key=${key}&number=1&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 6000 });
    const data = await resp.json();
    if (data.code === '200' && data.location?.[0]) return { lon: data.location[0].lon, lat: data.location[0].lat, city: data.location[0].name };
  } catch {}
  return { lon: '116.4074', lat: '39.9042', city: locName || '北京' };
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();
  return { temp: data.now.temp, text: data.now.text, icon: data.now.icon, humidity: data.now.humidity, windDir: data.now.windDir || '--', windScale: data.now.windScale || '--', windSpeed: data.now.windSpeed || '--' };
}

async function fetchAirQuality(ctx, key, lon, lat, host) {
  try {
    const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();
    if (data.code === '200' && data.now?.aqi) return { aqi: data.now.aqi, category: data.now.category, color: getAQIColor(data.now.aqi) };
  } catch {}
  return { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

function getAQIColor(val) {
  const n = Number(val);
  if (n <= 50) return { light: '#4CD964', dark: '#34C759' };
  if (n <= 100) return { light: '#FFCC00', dark: '#FF9500' };
  return { light: '#FF3B30', dark: '#FF453A' };
}

function getWeatherIcon(code) {
  const map = { '100': 'sun.max.fill', '101': 'cloud.sun.fill', '104': 'cloud.fill', '300': 'cloud.drizzle.fill', '306': 'cloud.rain.fill', '400': 'snowflake' };
  return map[code] || 'cloud.fill';
}

function renderSmall(now, city) {
  return { type: 'widget', padding: 14, children: [{ type: 'text', text: city, font: { size: 'caption1' } }, { type: 'text', text: `${now.temp}°`, font: { size: 'title2', weight: 'bold' } }] };
}

function renderMedium(now, air, city) {
  const timeStr = `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2,'0')}`;
  return { type: 'widget', padding: 16, gap: 12, children: [
    { type: 'stack', direction: 'row', children: [{ type: 'text', text: city, font: { size: 'title3', weight: 'bold' } }, { type: 'spacer' }, { type: 'text', text: `${air.aqi}`, textColor: air.color }] },
    { type: 'stack', direction: 'row', alignItems: 'center', gap: 10, children: [
      { type: 'image', src: `sf-symbol:${getWeatherIcon(now.icon)}`, width: 40, height: 40 },
      { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' } }
    ]},
    { type: 'stack', direction: 'row', children: [
      { type: 'text', text: `${now.humidity}%`, font: { size: 'caption1' } },
      { type: 'spacer' },
      { type: 'text', text: `${now.windScale}级`, font: { size: 'caption1' } }
    ]}
  ]};
}

function renderAccessoryCompact(now, city, family) { return { type: 'widget', padding: 8, children: [{ type: 'text', text: `${now.temp}°` }] }; }
function renderError(msg) { return { type: 'widget', padding: 16, children: [{ type: 'text', text: msg, textColor: '#FF3B30' }] }; }
