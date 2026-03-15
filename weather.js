/**
 * 🌤️ 和风天气 - Egern 小组件 (修复 AQI 逻辑，保持原版视觉)
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

// ────────────────────────────────────────────────
// 核心修复：AQI 获取函数
// ────────────────────────────────────────────────

async function fetchAirQuality(ctx, key, lon, lat, host) {
  // 1. 尝试通用的 V7 接口（大多数 Key 都有此权限）
  try {
    const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();

    if (data.code === '200' && data.now) {
      const val = Number(data.now.aqi);
      return {
        aqi: Math.round(val),
        category: data.now.category || getAQICategory(val).text,
        color: getAQICategory(val).color
      };
    }
  } catch (e) {
    console.log('AQI V7 尝试失败');
  }

  // 2. Fallback: 尝试 Air Quality V1 接口
  try {
    const url = `${host}/airquality/v1/current/${lat},${lon}?key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();

    if (data.code === '200' && data.indexes?.length > 0) {
      const cnMee = data.indexes.find(i => i.code === 'cn-mee') || data.indexes[0];
      const val = Number(cnMee.aqi);
      return {
        aqi: Math.round(val),
        category: cnMee.category || getAQICategory(val).text,
        color: getAQICategory(val).color
      };
    }
  } catch (e) {}

  // 兜底返回
  return { aqi: '--', category: '--', color: { light: '#999', dark: '#888' } };
}

// ────────────────────────────────────────────────
// 辅助函数 (保持原样)
// ────────────────────────────────────────────────

function normalizeHost(host) {
  let h = host;
  if (!/^https?:\/\//i.test(h)) h = 'https://' + h;
  return h.replace(/\/+$/, '');
}

function isAccessoryFamily(family) {
  return family.startsWith('accessory');
}

async function getLocation(ctx, locName, key, host) {
  const presets = {
    '北京': { lon: '116.407396', lat: '39.904211' },
    '上海': { lon: '121.473701', lat: '31.230416' },
    '广州': { lon: '113.264435', lat: '23.129112' },
    '深圳': { lon: '114.057868', lat: '22.543099' },
    '杭州': { lon: '120.15507',  lat: '30.274084' },
    '成都': { lon: '104.065735', lat: '30.659462' },
    '昆山': { lon: '120.980737', lat: '31.384649' }
  };

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
  if (data.code !== '200') throw new Error(data.msg || `天气接口返回 ${data.code}`);
  
  return {
    temp: data.now.temp,
    text: data.now.text,
    icon: data.now.icon,
    humidity: data.now.humidity,
    windDir: data.now.windDir || '--',
    windScale: data.now.windScale || '--',
    windSpeed: data.now.windSpeed || '--'
  };
}

function getAQICategory(val) {
  const n = Number(val);
  if (isNaN(n)) return { text: '--', color: { light: '#999999', dark: '#888888' } };
  if (n <=  50) return { text: '优',   color: { light: '#4CD964', dark: '#34C759' } };
  if (n <= 100) return { text: '良',   color: { light: '#FFCC00', dark: '#FF9F0A' } };
  if (n <= 150) return { text: '轻度污染', color: { light: '#FF9500', dark: '#FF9500' } };
  if (n <= 200) return { text: '中度污染', color: { light: '#FF3B30', dark: '#FF453A' } };
  return               { text: '重度污染', color: { light: '#AF52DE', dark: '#BF5AF2' } };
}

function getWeatherIcon(code) {
  const map = {
    '100': 'sun.max.fill', '101': 'cloud.sun.fill', '102': 'cloud.fill', '103': 'cloud.sun.fill', '104': 'cloud.fill',
    '300': 'cloud.drizzle.fill', '305': 'cloud.rain.fill', '307': 'cloud.heavyrain.fill', '501': 'cloud.fog.fill'
  };
  return map[code] || 'cloud.fill';
}

function getWeatherColor(code) {
  const n = Number(code);
  if (n >= 100 && n <= 104) return { light: '#FF9500', dark: '#FFB340' };
  if (n >= 300 && n <= 399) return { light: '#007AFF', dark: '#0A84FF' };
  return { light: '#8E8E93', dark: '#98989D' };
}

// ────────────────────────────────────────────────
// 渲染函数 (保持原样排版)
// ────────────────────────────────────────────────

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
    backgroundColor: { light: '#F9F9F9', dark: '#1C1C1E' },
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
            gap: 6,
            children: [
              { type: 'image', src: 'sf-symbol:location.fill', width: 14, height: 14, color: { light: '#FF3B30', dark: '#FF453A' } },
              { type: 'text', text: city, font: { size: 'title3', weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } }
            ]
          },
          { type: 'spacer' },
          {
            type: 'text',
            text: `AQI ${air.aqi} • ${air.category}`,
            font: { size: 'caption1', weight: 'semibold' },
            textColor: aqiColor
          },
          { type: 'text', text: timeStr, font: { size: 'caption2' }, textColor: { light: '#8E8E93', dark: '#8E8E93' } }
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
            gap: 4,
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' }, textColor: { light: '#000', dark: '#FFF' } },
              { type: 'text', text: now.text, font: { size: 'title3' }, textColor: { light: '#444', dark: '#CCC' } }
            ]
          },
          {
            type: 'stack',
            direction: 'column',
            alignItems: 'center',
            gap: 2,
            children: [
              { type: 'text', text: '空气质量', font: { size: 'caption2' }, textColor: { light: '#666', dark: '#AAA' } },
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
          createInfoItem('drop.fill',   '湿度',   `${now.humidity}%`,   '#007AFF'),
          createInfoItem('wind',        '风力',   `${now.windDir} ${now.windScale}级`, '#5856D6'),
          createInfoItem('gauge.medium','风速',   `${now.windSpeed}km/h`,'#FF9500')
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
          { type: 'text', text: label, font: { size: 'caption2' }, textColor: { light: '#666', dark: '#AAA' } },
          { type: 'text', text: value,  font: { size: 'title3', weight: 'semibold' }, textColor: { light: '#000', dark: '#FFF' } }
        ]
      }
    ]
  };
}

function renderSmall(now, city) {
  const icon = getWeatherIcon(now.icon);
  const color = getWeatherColor(now.icon);
  return {
    type: 'widget',
    padding: 14,
    gap: 6,
    children: [
      { type: 'text', text: city, font: { size: 'caption1', weight: 'bold' } },
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: 10,
        children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 40, height: 40, color },
          { type: 'text', text: `${now.temp}°`, font: { size: 'title2', weight: 'bold' } }
        ]
      },
      { type: 'text', text: now.text, font: { size: 'caption1' } }
    ]
  };
}

function renderAccessoryCompact(now, city) {
  return {
    type: 'widget',
    children: [{ type: 'text', text: `${now.temp}° ${city}` }]
  };
}

function renderError(msg) {
  return {
    type: 'widget',
    padding: 16,
    children: [{ type: 'text', text: msg, textColor: { light: '#FF3B30', dark: '#FF453A' } }]
  };
}
