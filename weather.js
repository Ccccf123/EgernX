/**
 * 🌤️ 和风天气 - Egern 小组件 测试版
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  const apiKey = env.KEY;
  const location = env.LOCATION || '北京';
  const apiHost = env.API_HOST;

  if (!apiKey) {
    return renderError('⚠️ 请配置 KEY 环境变量');
  }

  if (!apiHost) {
    return renderError('⚠️ 请配置 API_HOST 环境变量');
  }

  try {
    const host = normalizeHost(apiHost);
    const { lon, lat, city } = await getLocation(ctx, location, apiKey, host);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, host);

    let air = null;
    if (widgetFamily !== 'systemSmall') {
      air = await fetchAirQuality(ctx, apiKey, lon, lat, host);
    }

    if (widgetFamily === 'systemSmall') {
      return renderSmall(now, city);
    } else {
      return renderMedium(now, air, city);
    }

  } catch (e) {
    return renderError(`❌ ${e.message}`);
  }
}

function normalizeHost(host) {
  let h = (host || '').trim();
  if (!h.startsWith('http://') && !h.startsWith('https://')) {
    h = 'https://' + h;
  }
  return h.replace(/\/$/, '');
}

async function getLocation(ctx, location, apiKey, apiHost) {

  const presetLocations = {
    '北京': { lon: '116.4074', lat: '39.9042' },
    '上海': { lon: '121.4737', lat: '31.2304' }
  };

  const cityName = location && location !== 'auto' ? location : '北京';

  if (presetLocations[cityName]) {
    return { ...presetLocations[cityName], city: cityName };
  }

  try {
    const geoUrl = `${apiHost}/geo/v2/city/lookup?location=${encodeURIComponent(cityName)}&key=${apiKey}&number=1&lang=zh`;
    const geoResp = await ctx.http.get(geoUrl);
    const geoData = await geoResp.json();

    if (geoData.code == 200 && geoData.location?.[0]) {
      const loc = geoData.location[0];
      return { lon: loc.lon, lat: loc.lat, city: loc.name || cityName };
    }
  } catch (e) {}

  return { lon: '116.4074', lat: '39.9042', city: cityName };
}

async function fetchWeatherNow(ctx, key, lon, lat, apiHost) {

  const url = `${apiHost}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();

  if (data.code != 200 && data.code !== '200' && data.code !== 'ok') {
    throw new Error(data.msg || '天气获取失败');
  }

  const now = data.now;

  return {
    temp: now.temp,
    text: now.text,
    icon: now.icon,
    humidity: now.humidity,
    windDir: now.windDir,
    windScale: now.windScale,
    windSpeed: now.windSpeed
  };
}

async function fetchAirQuality(ctx, key, lon, lat, apiHost) {

  let aqi = null;
  let categoryText = '--';
  let categoryColor = { light: '#999999', dark: '#888888' };

  try {

    const urlV1 = `${apiHost}/airquality/v1/current/${lat}/${lon}?key=${key}&lang=zh`;
    const respV1 = await ctx.http.get(urlV1);
    const dataV1 = await respV1.json();

    if (dataV1.code == 200 || dataV1.code === '200' || dataV1.code === 'ok') {

      if (Array.isArray(dataV1.indexes) && dataV1.indexes.length > 0) {

        const info = dataV1.indexes[0];

        if (info && info.aqi != null) {

          aqi = Number(info.aqi);

          const cat = getAQICategory(aqi);
          categoryText = info.category || cat.text;
          categoryColor = cat.color;

        }
      }
    }

  } catch (e) {}

  if (aqi != null && !isNaN(aqi)) {

    return {
      aqi: Math.round(aqi),
      category: { text: categoryText, color: categoryColor }
    };

  } else {

    return { aqi: '--', category: { text: '--', color: categoryColor } };

  }

}

function getAQICategory(aqi) {

  const num = parseInt(aqi);

  if (isNaN(num)) return { text: '--', color: { light: '#999999', dark: '#888888' } }; // FIX

  if (num <= 50) return { text: '优', color: { light: '#30D158', dark: '#34C759' } };
  if (num <= 100) return { text: '良', color: { light: '#FF9500', dark: '#FF9F0A' } };
  if (num <= 150) return { text: '轻度', color: { light: '#FF6B35', dark: '#FF7A3E' } };
  if (num <= 200) return { text: '中度', color: { light: '#FF3B30', dark: '#FF453A' } };
  if (num <= 300) return { text: '重度', color: { light: '#AF52DE', dark: '#BF5AF2' } };

  return { text: '严重', color: { light: '#7E3C9E', dark: '#8E5FC9' } };

}

function getWeatherIcon(iconCode) {

  const map = {

    '100': 'sun.max.fill',
    '101': 'cloud.sun.fill',
    '102': 'cloud.fill',
    '103': 'cloud.sun.fill',
    '104': 'cloud.fill',

    '300': 'cloud.bolt.rain.fill',
    '301': 'cloud.rain.fill',

    '400': 'cloud.snow.fill',

    '500': 'cloud.fog.fill',

    '153': 'cloud.fog.fill', // FIX
    '154': 'cloud.fog.fill', // FIX

    '800': 'wind',
    '999': 'exclamationmark.triangle.fill'

  };

  return map[iconCode] || 'cloud.fill';

}

function renderSmall(now, city) {

  const icon = getWeatherIcon(now.icon);

  const windKmh = Math.round(now.windSpeed * 3.6); // FIX

  return {

    type: 'widget',

    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },

    children: [

      { type: 'text', text: city },

      {
        type: 'image',
        src: `sf-symbol:${icon}`,
        width: 40,
        height: 40
      },

      { type: 'text', text: `${now.temp}°` },

      { type: 'text', text: now.text },

      { type: 'text', text: `风速 ${windKmh}km/h` }

    ]

  };

}

function renderMedium(now, air, city) {

  const icon = getWeatherIcon(now.icon);

  const windKmh = Math.round(now.windSpeed * 3.6); // FIX

  return {

    type: 'widget',

    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },

    children: [

      { type: 'text', text: city },

      {
        type: 'image',
        src: `sf-symbol:${icon}`,
        width: 56,
        height: 56
      },

      { type: 'text', text: `${now.temp}°C` },

      { type: 'text', text: now.text },

      {
        type: 'text',
        text: `AQI ${air?.aqi || '--'} • ${air?.category.text || '--'}`,
        textColor: air?.category.color
      },

      { type: 'text', text: `湿度 ${now.humidity}%` },

      { type: 'text', text: `风力 ${now.windDir} ${now.windScale}级` },

      { type: 'text', text: `风速 ${windKmh}km/h` }

    ]

  };

}

function renderError(msg) {

  return {

    type: 'widget',

    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },

    children: [
      {
        type: 'text',
        text: msg,
        textAlign: 'center'
      }
    ]

  };

}