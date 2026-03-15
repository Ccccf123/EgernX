/**
 * 🌤️ 和风天气 - 最终精简版
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

    let air = null;
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
    return renderError(`请求失败：${e.message.slice(0, 60)}`);
  }
}

function normalizeHost(host) {
  let h = host;
  if (!/^https?:\/\//i.test(h)) h = 'https://' + h;
  return h.replace(/\/+$/, '');
}

function isAccessoryFamily(family) {
  return family.startsWith('accessory');
}

async function getLocation(ctx, locName, key, host) {
  const presets = { '北京': { lon: '116.4074', lat: '39.9042' }, '上海': { lon: '121.4737', lat: '31.2304' }, '广州': { lon: '113.2644', lat: '23.1291' }, '深圳': { lon: '114.0579', lat: '22.5431' }, '苏州': { lon: '120.5853', lat: '31.2989' } };
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
  if (data.code !== '200') throw new Error(`天气接口返回 ${data.code}`);
  return { temp: data.now.temp, text: data.now.text, icon: data.now.icon, humidity: data.now.humidity, windDir: data.now.windDir || '--', windScale: data.now.windScale || '--', windSpeed: data.now.windSpeed || '--' };
}

async function fetchAirQuality(ctx, key, lon, lat, host) {
  try {
    const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();
    if (data.code === '200' && data.now?.aqi) {
      const val = Number(data.now.aqi);
      return { aqi: Math.round(val), category: data.now.category || getAQICategory(val).text, color: getAQICategory(val).color };
    }
  } catch {}
  return { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

function getAQICategory(val) {
  const n = Number(val);
  if (n <= 50) return { text: '优', color: { light: '#4CD964', dark: '#34C759' } };
  if (n <= 100) return { text: '良', color: { light: '#FF9500', dark: '#FF9F0A' } };
  return { text: '污染', color: { light: '#FF3B30', dark: '#FF453A' } };
}

function getWeatherIcon(code) {
  const map = { '100': 'sun.max.fill', '101': 'cloud.sun.fill', '102': 'cloud.fill', '300': 'cloud.drizzle.fill', '400': 'snowflake', '500': 'cloud.fog.fill', '800': 'wind' };
  return map[code] || 'cloud.fill';
}

function getWeatherColor(code) {
  return { light: '#FF9500', dark: '#FFB340' };
}

function renderMedium(now, air, city) {
  const icon = getWeatherIcon(now.icon);
  const timeStr = `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2,'0')}`;
  return {
    type: 'widget',
    padding: 16,
    gap: 12,
    backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 8, children: [{ type: 'text', text: city, font: { size: 'title3', weight: 'bold' } }, { type: 'spacer' }, { type: 'text', text: `AQI ${air.aqi}`, font: { size: 'caption1', weight: 'semibold' }, textColor: air.color }, { type: 'text', text: timeStr, font: { size: 'caption2' }, textColor: '#888' }] },
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 16, children: [{ type: 'image', src: `sf-symbol:${icon}`, width: 64, height: 64, color: getWeatherColor(now.icon) }, { type: 'stack', direction: 'column', flex: 1, children: [{ type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' } }, { type: 'text', text: now.text, font: { size: 'title3' } }] }, { type: 'text', text: air.category, font: { size: 'title3', weight: 'bold' }, textColor: air.color }] },
      { type: 'stack', direction: 'row', gap: 16, children: [createInfoItem('drop.fill', `${now.humidity}%`, '#007AFF'), createInfoItem('wind', `${now.windScale}级`, '#5856D6'), createInfoItem('gauge.medium', `${now.windSpeed}km/h`, '#FF9500')] }
    ]
  };
}

// 这里 label 传空字符串，且函数内直接忽略 label 参数，实现去掉汉字但不改逻辑
function createInfoItem(icon, value, iconColor) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 18, height: 18, color: { light: iconColor, dark: iconColor } },
      { type: 'text', text: value, font: { size: 'title3', weight: 'semibold' } }
    ]
  };
}

function renderSmall(now, city) { return { type: 'widget', padding: 14, children: [{ type: 'text', text: city }, { type: 'text', text: `${now.temp}°` }] }; }
function renderAccessoryCompact(now, city) { return { type: 'widget', children: [{ type: 'text', text: `${now.temp}°` }] }; }
function renderError(msg) { return { type: 'widget', padding: 16, children: [{ type: 'text', text: msg, textColor: '#F00' }] }; }
