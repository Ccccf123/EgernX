/**
 * 🌤️ 和风天气 - 2026 个人 Host 简洁修复版
 * * 环境变量配置（必填）：
 * KEY: 和风天气 API Key
 * API_HOST: 控制台获取的个人 API Host（如: xxx.qweather.com）
 * LOCATION: 城市名（如: 昆山）
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  const apiKey = (env.KEY || '').trim();
  const apiHost = (env.API_HOST || '').trim();
  const location = (env.LOCATION || '北京').trim();

  if (!apiKey || !apiHost) {
    return renderError('⚠️ 请检查 KEY 和 API_HOST 环境变量');
  }

  try {
    const { lon, lat, city } = await getLocation(ctx, location, apiKey, apiHost);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);

    let air = { aqi: '--', category: { text: '--', color: { light: '#999', dark: '#888' } } };
    if (widgetFamily !== 'systemSmall') {
      air = await fetchAirNow(ctx, apiKey, lon, lat, apiHost);
    }

    if (widgetFamily === 'systemSmall') {
      return renderSmall(now, city);
    } else {
      return renderMedium(now, air, city);
    }

  } catch (e) {
    return renderError(`获取失败: ${e.message}`);
  }
}

// --- 核心逻辑：获取空气质量（适配个人 Host） ---
async function fetchAirNow(ctx, key, lon, lat, apiHost) {
  const host = normalizeHost(apiHost);
  const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}`;
  const resp = await ctx.http.get(url, { timeout: 8000 });
  const data = await resp.json();
  
  if (data.code !== '200') return { aqi: '--', category: { text: '--', color: '#999' } };
  
  let aqiValue = '--';
  // 逻辑：兼容多种数据返回路径
  if (data.now?.aqi) {
    aqiValue = data.now.aqi;
  } else if (data.indexes?.[0]?.aqi) {
    aqiValue = data.indexes[0].aqi;
  }
  
  return { aqi: aqiValue, category: getAQICategory(aqiValue) };
}

// --- 数据获取与格式化 ---
function normalizeHost(host) {
  let h = host.trim();
  if (!h.startsWith('http')) h = 'https://' + h;
  return h.replace(/\/$/, '');
}

async function getLocation(ctx, location, key, apiHost) {
  const host = normalizeHost(apiHost);
  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(location)}&key=${key}&number=1`;
    const resp = await ctx.http.get(url);
    const data = await resp.json();
    if (data.code === '200' && data.location?.[0]) {
      return { lon: data.location[0].lon, lat: data.location[0].lat, city: data.location[0].name };
    }
  } catch {}
  return { lon: '116.40', lat: '39.90', city: location };
}

async function fetchWeatherNow(ctx, key, lon, lat, apiHost) {
  const host = normalizeHost(apiHost);
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();
  return data.now;
}

function getAQICategory(aqi) {
  const num = parseInt(aqi);
  if (isNaN(num)) return { text: '--', color: { light: '#999', dark: '#888' } };
  if (num <= 50)  return { text: '优', color: { light: '#30D158', dark: '#34C759' } };
  if (num <= 100) return { text: '良', color: { light: '#FF9500', dark: '#FF9F0A' } };
  return { text: '污染', color: { light: '#FF3B30', dark: '#FF453A' } };
}

// --- 渲染逻辑：保持经典排版 + 纯净数据 ---
function renderMedium(now, air, city) {
  const nowTime = new Date();
  const timeStr = `${nowTime.getHours()}:${String(nowTime.getMinutes()).padStart(2, '0')}`;

  return {
    type: 'widget',
    padding: 16,
    gap: 12,
    backgroundColor: { light: '#FFFFFF', dark: '#1C1C1E' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'text', text: `📍 ${city}`, font: { size: 'title3', weight: 'bold' } },
          { type: 'spacer' },
          { type: 'text', text: `AQI ${air.aqi}`, font: { size: 'caption1', weight: 'bold' }, textColor: air.category.color },
          { type: 'text', text: `  ${timeStr}`, font: { size: 'caption2' }, textColor: '#888' }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 12,
        children: [
          { type: 'image', src: `sf-symbol:cloud.fill`, width: 56, height: 56, color: '#FF9F0A' },
          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' } },
              { type: 'text', text: now.text, font: { size: 'title3' }, textColor: '#666' }
            ]
          },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            children: [
              { type: 'text', text: '空气质量', font: { size: 'caption2' }, textColor: '#999' },
              { type: 'text', text: air.category.text, font: { size: 'title3', weight: 'bold' }, textColor: air.category.color }
            ]
          }
        ]
      },
      // 底部简洁栏：只留图标和数值
      {
        type: 'stack',
        direction: 'row',
        gap: 16,
        children: [
          renderInfoItem('drop.fill', `${now.humidity}%`, '#007AFF'),
          renderInfoItem('wind', `${now.windScale}级`, '#5856D6'),
          renderInfoItem('gauge.medium', `${now.windSpeed}km/h`, '#FF9500')
        ]
      }
    ]
  };
}

function renderInfoItem(icon, value, color) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 18, height: 18, color: color },
      { type: 'text', text: value, font: { size: 'title3', weight: 'semibold' } }
    ]
  };
}

function renderSmall(now, city) {
  return { type: 'widget', padding: 12, children: [{ type: 'text', text: city }, { type: 'text', text: `${now.temp}°` }] };
}

function renderError(msg) {
  return { type: 'widget', padding: 16, children: [{ type: 'text', text: msg, textColor: '#FF3B30' }] };
}
