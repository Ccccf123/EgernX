/**
 * 🌤️ 和风天气 - Egern 小组件
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

    if (widgetFamily === 'systemSmall') {
      return renderSmall(now, city);
    } else {
      return renderMedium(now, air, city);
    }

  } catch (e) {
    return renderError(`请求失败：${e.message.slice(0, 60)}`);
  }
}

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
    background: {
      type: 'linear-gradient',
      colors: ['#4FACFE', '#00F2FE'],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
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
          // ✅ 图标缩小
          { type: 'image', src: `sf-symbol:${icon}`, width: 56, height: 56, color: iconColor },

          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            gap: 2,
            children: [
              // ✅ 温度缩小
              { type: 'text', text: `${now.temp}°C`, font: { size: 30, weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } },
              { type: 'text', text: now.text, font: { size: 18 }, textColor: { light: '#444', dark: '#CCC' } }
            ]
          },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            gap: 2,
            children: [
              // ✅ AQI缩小
              { type: 'text', text: air.category, font: { size: 15, weight: 'bold' }, textColor: aqiColor }
            ]
          }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 10,
        children: [
          createInfoItem('drop.fill',   `${now.humidity}%`, '#007AFF'),
          createInfoItem('wind',        `${now.windDir} ${now.windScale}级`, '#5856D6'),
          createInfoItem('gauge.medium',`${now.windSpeed}km/h`, '#FF9500')
        ]
      }
    ]
  };
}

function createInfoItem(icon, value, iconColor) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 5,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 20, height: 20, color: { light: iconColor, dark: iconColor } },
      { type: 'text', text: value, font: { size: 15, weight: 'semibold' }, textColor: { light: '#000', dark: '#FFF' }, lineLimit: 1 }
    ]
  };
}

function normalizeHost(host) {
  let h = host;
  if (!/^https?:\/\//i.test(h)) h = 'https://' + h;
  return h.replace(/\/+$/, '');
}

function isAccessoryFamily(family) {
  return family.startsWith('accessory');
}

async function getLocation(ctx, locName) {
  return { lon: '116.4074', lat: '39.9042', city: locName };
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();
  return data.now;
}

async function fetchAirQuality(ctx, key, lon, lat, host) {
  try {
    const url = `${host}/airquality/v1/current/${lat}/${lon}?key=${key}`;
    const resp = await ctx.http.get(url);
    const data = await resp.json();
    const aqi = data.indexes?.[0]?.aqi || '--';
    const category = data.indexes?.[0]?.category || '--';
    return { aqi, category, color: { light: '#34C759', dark: '#30D158' } };
  } catch {
    return { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
  }
}

function getWeatherIcon(code) {
  const map = { '100': 'sun.max.fill', '101': 'cloud.sun.fill', '104': 'cloud.fill' };
  return map[code] || 'cloud.fill';
}

function getWeatherColor(code) {
  return { light: '#FF9500', dark: '#FFB340' };
}

function renderSmall(now, city) {
  return {
    type: 'widget',
    padding: 14,
    background: {
      type: 'linear-gradient',
      colors: ['#4FACFE', '#00F2FE'],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    children: [
      { type: 'text', text: city },
      { type: 'text', text: `${now.temp}°` }
    ]
  };
}

function renderError(msg) {
  return {
    type: 'widget',
    children: [{ type: 'text', text: msg }]
  };
}