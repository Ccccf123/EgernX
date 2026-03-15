/**
 * 🌤️ 和风天气 - Egern 小组件
 *
 * ⚠️ 重要提示
 * 环境变量：
 * KEY: 和风天气 API Key（必填）
 * API_HOST: 你的个人API Host（必填！从控制台获取）
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

function normalizeHost(host) {
  let h = host;
  if (!/^https?:\/\//i.test(h)) h = 'https://' + h;
  return h.replace(/\/+$/, '');
}

function isAccessoryFamily(family) {
  return family.startsWith('accessory');
}

/* 位置预设（原样保留） */

async function getLocation(ctx, locName, key, host) {

  const presets = {
    '北京': { lon: '116.4074', lat: '39.9042' },
    '上海': { lon: '121.4737', lat: '31.2304' },
    '广州': { lon: '113.2644', lat: '23.1291' },
    '深圳': { lon: '114.0579', lat: '22.5431' }
  };

  if (presets[locName]) {
    return { ...presets[locName], city: locName };
  }

  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(locName)}&key=${key}&number=1&lang=zh`;
    const resp = await ctx.http.get(url);
    const data = await resp.json();

    if (data.code === '200' && data.location?.[0]) {
      const loc = data.location[0];
      return {
        lon: loc.lon,
        lat: loc.lat,
        city: loc.name || locName
      };
    }
  } catch {}

  return { lon: '116.4074', lat: '39.9042', city: locName || '北京' };
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {

  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();

  if (data.code !== '200') {
    throw new Error(data.msg || `天气接口返回 ${data.code}`);
  }

  const now = data.now;

  return {
    temp: now.temp,
    text: now.text,
    icon: now.icon,
    humidity: now.humidity,
    windDir: now.windDir || '--',
    windScale: now.windScale || '--',
    windSpeed: now.windSpeed || '--'
  };
}

async function fetchAirQuality(ctx, key, lon, lat, host) {

  try {
    const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
    const resp = await ctx.http.get(url);
    const data = await resp.json();

    if (data.code === '200' && data.now?.aqi) {

      const val = Number(data.now.aqi);

      return {
        aqi: val,
        category: data.now.category,
        color: getAQICategory(val).color
      };
    }

  } catch {}

  return { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

function getAQICategory(val) {

  const n = Number(val);

  if (n <= 50) return { color: { light: '#4CD964', dark: '#34C759' } };
  if (n <= 100) return { color: { light: '#FFCC00', dark: '#FF9F0A' } };
  if (n <= 150) return { color: { light: '#FF9500', dark: '#FF9500' } };
  if (n <= 200) return { color: { light: '#FF3B30', dark: '#FF453A' } };

  return { color: { light: '#AF52DE', dark: '#BF5AF2' } };
}

function getWeatherIcon(code) {

  const map = {
    '100': 'sun.max.fill',
    '101': 'cloud.sun.fill',
    '102': 'cloud.fill',
    '300': 'cloud.drizzle.fill',
    '305': 'cloud.rain.fill',
    '400': 'snowflake',
    '500': 'cloud.fog.fill'
  };

  return map[code] || 'cloud.fill';
}

function getWeatherColor(code) {

  const n = Number(code);

  if (n >= 100 && n <= 104) return { light: '#FF9500', dark: '#FFB340' };
  if (n >= 300 && n <= 399) return { light: '#007AFF', dark: '#0A84FF' };

  return { light: '#FF9500', dark: '#FFB340' };
}

function renderSmall(now, city) {

  const icon = getWeatherIcon(now.icon);
  const color = getWeatherColor(now.icon);

  return {
    type: 'widget',
    padding: 14,
    backgroundColor: { light: '#FFFFFF', dark: '#000000' },

    children: [

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 10,

        children: [

          { type: 'image', src: `sf-symbol:${icon}`, width: 40, height: 40, color },

          {
            type: 'stack',
            direction: 'column',

            children: [
              { type: 'text', text: `${now.temp}°`, font: { size: 'title2', weight: 'bold' } },
              { type: 'text', text: now.text, font: { size: 'caption1' } }
            ]
          }
        ]
      }
    ]
  };
}

function renderMedium(now, air, city) {

  const icon = getWeatherIcon(now.icon);
  const iconColor = getWeatherColor(now.icon);
  const aqiColor = air.color;

  return {
    type: 'widget',
    padding: 16,
    backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },

    children: [

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',

        children: [

          { type: 'text', text: city, font: { size: 'title3', weight: 'bold' } },

          { type: 'spacer' },

          {
            type: 'text',
            text: `AQI ${air.aqi}`,
            font: { size: 'caption1', weight: 'semibold' },
            textColor: aqiColor
          }
        ]
      },

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 16,

        children: [

          { type: 'image', src: `sf-symbol:${icon}`, width: 64, height: 64, color: iconColor },

          {
            type: 'stack',
            direction: 'column',
            flex: 1,

            children: [

              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' } },

              { type: 'text', text: now.text, font: { size: 'title3' } }
            ]
          },

          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',

            children: [

              { type: 'spacer', size: 2 },

              { type: 'text', text: air.category, font: { size: 'title3', weight: 'bold' }, textColor: aqiColor }
            ]
          }
        ]
      },

      {
        type: 'stack',
        direction: 'row',
        gap: 12,

        children: [

          createInfoItem('drop.fill',   '', `${now.humidity}%`, '#007AFF'),

          createInfoItem('wind', '', `${now.windDir} ${now.windScale}级`, '#5856D6'),

          createInfoItem('gauge.medium', '', `${now.windSpeed}km/h`, '#FF9500')
        ]
      }
    ]
  };
}

function createInfoItem(icon, label, value, iconColor) {

  return {

    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,

    children: [

      { type: 'image', src: `sf-symbol:${icon}`, width: 20, height: 20, color: { light: iconColor, dark: iconColor } },

      {
        type: 'stack',
        direction: 'column',

        children: [

          { type: 'text', text: label, font: { size: 'caption2' } },

          { type: 'text', text: value, font: { size: 'title3', weight: 'semibold' } }
        ]
      }
    ]
  };
}

function renderAccessoryCompact(now, city, family) {

  const icon = getWeatherIcon(now.icon);

  return {

    type: 'widget',
    padding: 8,
    backgroundColor: { light: '#FFFFFF', dark: '#000000' },

    children: [

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 6,

        children: [

          { type: 'image', src: `sf-symbol:${icon}`, width: 24, height: 24 },

          { type: 'text', text: `${now.temp}° ${city.slice(0,4)}` }
        ]
      }
    ]
  };
}

function renderError(msg) {

  return {

    type: 'widget',
    padding: 16,

    children: [

      {
        type: 'text',
        text: msg,
        textColor: { light: '#FF3B30', dark: '#FF453A' }
      }
    ]
  };
}