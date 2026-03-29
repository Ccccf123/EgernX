/**
 * 🌤️ 和风天气 - Egern 小组件（网络背景版）
 *
 * ⚠️ 环境变量：
 * KEY: 和风天气 API Key（必填）
 * API_HOST: 个人 API Host（必填）
 * LOCATION: 城市名，如"北京"
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

// 大组件
function renderMedium(now, air, city) {
  const icon = getWeatherIcon(now.icon);
  const iconColor = getWeatherColor(now.icon);
  const aqiColor = air.color;
  const time = new Date();
  const timeStr = `${time.getMonth()+1}/${time.getDate()} ${time.getHours()}:${String(time.getMinutes()).padStart(2,'0')}`;

  return {
    type: 'widget',
    padding: 16,
    gap: 12,
    // ✅ 背景色和网络组件一致
    backgroundColor: { light: '#F9F9F9', dark: '#1E1E1E' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 8,
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 4,
            children: [
              { type: 'image', src: 'sf-symbol:location.fill', width: 14, height: 14, color: { light: '#FF3B30', dark: '#FF453A' } },
              { type: 'text', text: city, font: { size: 18, weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } }
            ]
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `AQI ${air.aqi}`,
            font: { size: 14, weight: 'semibold' },
            textColor: aqiColor
          },
          { type: 'text', text: timeStr, font: { size: 11 }, textColor: { light: '#8E8E93', dark: '#8E8E93' } }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 16,
        children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 50, height: 50, color: iconColor }, // 图标变小
          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            gap: 2,
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 30, weight: 'medium' }, textColor: { light: '#000', dark: '#FFF' } },
              { type: 'text', text: now.text, font: { size: 18 }, textColor: { light: '#444', dark: '#CCC' } }
            ]
          },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            gap: 2,
            children: [
              { type: 'text', text: air.category, font: { size: 18, weight: 'bold' }, textColor: aqiColor } // 只显示数值
            ]
          }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 10,
        children: [
          createInfoItem('drop.fill', `${now.humidity}%`, '#007AFF'),
          createInfoItem('wind', `${now.windDir} ${now.windScale}级`, '#5856D6'),
          createInfoItem('gauge.medium', `${now.windSpeed}km/h`, '#FF9500')
        ]
      }
    ]
  };
}

// 底部信息只显示数值，去掉文字
function createInfoItem(icon, value, iconColor) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 5,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 20, height: 20, color: { light: iconColor, dark: iconColor } },
      { type: 'text', text: value, font: { size: 15, weight: 'semibold' }, textColor: { light: '#000', dark: '#FFF' } }
    ]
  };
}

// 小组件
function renderSmall(now, city) {
  const icon = getWeatherIcon(now.icon);
  return {
    type: 'widget',
    padding: 14,
    backgroundColor: { light: '#F9F9F9', dark: '#1E1E1E' },
    children: [
      { type: 'text', text: city, font: { size: 14, weight: 'bold' } },
      { type: 'image', src: `sf-symbol:${icon}`, width: 34, height: 34 },
      { type: 'text', text: `${now.temp}°`, font: { size: 28, weight: 'bold' } }
    ]
  };
}

function renderAccessoryCompact(now, city, family) {
  return { type: 'widget', children: [{ type: 'text', text: `${now.temp}° ${city}` }] };
}

function renderError(msg) {
  return { type: 'widget', padding: 16, children: [{ type: 'text', text: msg, textColor: { light: '#FF3B30', dark: '#FF453A' } }] };
}

// 工具函数
function normalizeHost(host) {
  let h = host;
  if (!/^https?:\/\//i.test(h)) h = 'https://' + h;
  return h.replace(/\/+$/, '');
}

function isAccessoryFamily(family) {
  return family.startsWith('accessory');
}

async function getLocation(ctx, locName, key, host) {
  const presets = { '北京': { lon: '116.4074', lat: '39.9042' }, '上海': { lon: '121.4737', lat: '31.2304' }, '苏州': { lon: '120.5853', lat: '31.2989' } };
  if (presets[locName]) return { ...presets[locName], city: locName };
  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(locName)}&key=${key}&number=1&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 6000 });
    const data = await resp.json();
    if (data.code === '200' && data.location?.[0]) {
      const loc = data.location[0];
      return { lon: loc.lon, lat: loc.lat, city: loc.name || locName };
    }
  } catch {}
  return { lon: '116.4074', lat: '39.9042', city: locName || '北京' };
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();
  if (data.code !== '200') throw new Error(data.msg || `接口返回 ${data.code}`);
  return { temp: data.now.temp, text: data.now.text, icon: data.now.icon, humidity: data.now.humidity, windDir: data.now.windDir || '--', windScale: data.now.windScale || '--', windSpeed: data.now.windSpeed || '--' };
}

async function fetchAirQuality(ctx, key, lon, lat, host) {
  let aqiData = null;
  try {
    const url = `${host}/airquality/v1/current/${lat}/${lon}?key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();
    if (data.indexes && data.indexes.length > 0) {
      const cnMee = data.indexes.find(i => i.code === 'cn-mee') || data.indexes[0];
      aqiData = { aqi: Math.round(Number(cnMee.aqi)), category: cnMee.category || getAQICategory(cnMee.aqi).text, color: getAQICategory(cnMee.aqi).color };
    }
  } catch (e) {}
  return aqiData || { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

function getAQICategory(val) {
  const n = Number(val);
  if (isNaN(n)) return { text: '--', color: { light: '#999999', dark: '#888888' } };
  if (n <=  50) return { text: '优', color: { light: '#4CD964', dark: '#34C759' } };
  if (n <= 100) return { text: '良', color: { light: '#FFCC00', dark: '#FF9F0A' } };
  return { text: '轻度', color: { light: '#FF9500', dark: '#FF9500' } };
}

function getWeatherIcon(code) {
  const map = { '100': 'sun.max.fill', '101': 'cloud.sun.fill', '104': 'cloud.fill', '305': 'cloud.rain.fill' };
  return map[code] || 'cloud.fill';
}

function getWeatherColor(code) {
  const n = Number(code);
  if (n >= 100 && n <= 104) return { light: '#FF9500', dark: '#FFB340' };
  return { light: '#007AFF', dark: '#0A84FF' };
}