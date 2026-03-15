/**
 * 🌤️ 和风天气 - Egern 小组件 (修复 AQI 增强版)
 * * 环境变量：
 * KEY       和风天气 API Key (必填)
 * API_HOST  域名，如 devapi.qweather.com (必填)
 * LOCATION  城市名，如 昆山 (可选，默认北京)
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

    // 只有中尺寸及以上才请求空气质量，节省额度
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
    console.error('脚本运行错误:', e);
    return renderError(`请求失败：${e.message.slice(0, 60)}`);
  }
}

// ────────────────────────────────────────────────
// 数据获取函数
// ────────────────────────────────────────────────

async function fetchAirQuality(ctx, key, lon, lat, host) {
  // 尝试 V7 接口（最稳妥的实时空气质量接口）
  try {
    const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();

    console.log(`AQI 接口返回状态码: ${data.code}`);

    if (data.code === '200' && data.now) {
      const val = Number(data.now.aqi);
      return {
        aqi: val,
        category: data.now.category || getAQICategory(val).text,
        color: getAQICategory(val).color
      };
    } else if (data.code === '403') {
      console.error('AQI 接口 403：您的 KEY 权限不足以访问此接口');
    }
  } catch (e) {
    console.error('AQI 接口请求异常:', e.message);
  }

  // 返回空状态兜底
  return { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

async function getLocation(ctx, locName, key, host) {
  const presets = {
    '北京': { lon: '116.407396', lat: '39.904211' },
    '上海': { lon: '121.473701', lat: '31.230416' },
    '广州': { lon: '113.264435', lat: '23.129112' },
    '深圳': { lon: '114.057868', lat: '22.543099' },
    '昆山': { lon: '120.980737', lat: '31.384649' }
  };

  if (presets[locName]) return { ...presets[locName], city: locName };

  try {
    const url = `${host}/geo/v2/city/lookup?location=${encodeURIComponent(locName)}&key=${key}&number=1`;
    const resp = await ctx.http.get(url);
    const data = await resp.json();
    if (data.code === '200' && data.location?.[0]) {
      return { lon: data.location[0].lon, lat: data.location[0].lat, city: data.location[0].name };
    }
  } catch {}
  return { lon: '116.4074', lat: '39.9042', city: locName };
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();
  if (data.code !== '200') throw new Error(`天气接口错误: ${data.code}`);
  return {
    temp: data.now.temp,
    text: data.now.text,
    icon: data.now.icon,
    humidity: data.now.humidity,
    windDir: data.now.windDir,
    windScale: data.now.windScale,
    windSpeed: data.now.windSpeed
  };
}

// ────────────────────────────────────────────────
// 工具 & 渲染函数
// ────────────────────────────────────────────────

function normalizeHost(host) {
  let h = host.startsWith('http') ? host : `https://${host}`;
  return h.replace(/\/+$/, '');
}

function isAccessoryFamily(family) { return family.startsWith('accessory'); }

function getAQICategory(val) {
  const n = Number(val);
  if (isNaN(n))  return { text: '--', color: { light: '#999', dark: '#888' } };
  if (n <= 50)  return { text: '优',   color: { light: '#4CD964', dark: '#34C759' } };
  if (n <= 100) return { text: '良',   color: { light: '#FFCC00', dark: '#FF9F0A' } };
  if (n <= 150) return { text: '轻度', color: { light: '#FF9500', dark: '#FF9500' } };
  return { text: '污染', color: { light: '#FF3B30', dark: '#FF453A' } };
}

function getWeatherIcon(code) {
  const map = { '100': 'sun.max.fill', '101': 'cloud.sun.fill', '104': 'cloud.fill', '305': 'cloud.rain.fill', '501': 'cloud.fog.fill' };
  return map[code] || 'cloud.fill';
}

function getWeatherColor(code) {
  const n = Number(code);
  if (n === 100) return { light: '#FF9500', dark: '#FFB340' };
  if (n >= 300 && n < 400) return { light: '#007AFF', dark: '#0A84FF' };
  return { light: '#8E8E93', dark: '#AEAEB2' };
}

function renderMedium(now, air, city) {
  const time = new Date();
  const timeStr = `${time.getMonth()+1}/${time.getDate()} ${time.getHours()}:${String(time.getMinutes()).padStart(2,'0')}`;
  
  return {
    type: 'widget',
    padding: 16,
    backgroundColor: { light: '#FFF', dark: '#1C1C1E' },
    children: [
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [
          { type: 'text', text: `📍 ${city}`, font: { size: 'headline', weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } },
          { type: 'spacer' },
          { type: 'text', text: `AQI ${air.aqi} · ${air.category}`, font: { size: 'caption1' }, textColor: air.color },
          { type: 'text', text: `  ${timeStr}`, font: { size: 'caption2' }, textColor: { light: '#999', dark: '#666' } }
        ]
      },
      { type: 'spacer' },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 12,
        children: [
          { type: 'image', src: `sf-symbol:${getWeatherIcon(now.icon)}`, width: 60, height: 60, color: getWeatherColor(now.icon) },
          {
            type: 'stack',
            direction: 'column',
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } },
              { type: 'text', text: now.text, font: { size: 'title3' }, textColor: { light: '#666', dark: '#AAA' } }
            ]
          },
          { type: 'spacer' },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            children: [
              { type: 'text', text: '空气质量', font: { size: 'caption2' }, textColor: { light: '#999', dark: '#999' } },
              { type: 'text', text: air.category, font: { size: 'title3', weight: 'bold' }, textColor: air.color }
            ]
          }
        ]
      },
      { type: 'spacer' },
      {
        type: 'stack',
        direction: 'row',
        children: [
          { type: 'text', text: `💧 湿度 ${now.humidity}%`, font: { size: 'caption1' }, flex: 1 },
          { type: 'text', text: `🌬️ ${now.windDir} ${now.windScale}级`, font: { size: 'caption1' }, flex: 1.5 },
          { type: 'text', text: `🧭 风速 ${now.windSpeed}km/h`, font: { size: 'caption1' }, flex: 1 }
        ]
      }
    ]
  };
}

function renderSmall(now, city) {
  return {
    type: 'widget',
    padding: 12,
    children: [
      { type: 'text', text: city, font: { size: 'caption1', weight: 'bold' } },
      { type: 'image', src: `sf-symbol:${getWeatherIcon(now.icon)}`, width: 30, height: 30, color: getWeatherColor(now.icon) },
      { type: 'text', text: `${now.temp}°`, font: { size: 'title1', weight: 'bold' } },
      { type: 'text', text: now.text, font: { size: 'caption1' } }
    ]
  };
}

function renderAccessoryCompact(now, city, family) {
  return {
    type: 'widget',
    children: [{ type: 'text', text: `${now.temp}° ${city}` }]
  };
}

function renderError(msg) {
  return {
    type: 'widget',
    padding: 20,
    children: [{ type: 'text', text: msg, textColor: { light: '#F00', dark: '#F00' } }]
  };
}
