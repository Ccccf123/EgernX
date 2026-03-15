/**
 * 🌤️ 和风天气 - 深度兼容对比修正版 (2026)
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';
  const apiKey = (env.KEY || '').trim();
  const apiHost = (env.API_HOST || '').trim();
  const location = (env.LOCATION || '北京').trim();

  if (!apiKey || !apiHost) return renderError('缺少 KEY 或 HOST');

  try {
    const { lon, lat, city } = await getLocation(ctx, location, apiKey, apiHost);
    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);
    
    // 空气质量抓取：这是对比修正的核心部分
    let air = { aqi: '--', category: { text: '--', color: { light: '#999', dark: '#888' } } };
    if (widgetFamily !== 'systemSmall') {
      air = await fetchAirNow(ctx, apiKey, lon, lat, apiHost);
    }

    return widgetFamily === 'systemSmall' ? renderSmall(now, city) : renderMedium(now, air, city);
  } catch (e) {
    return renderError(`失败: ${e.message}`);
  }
}

// --- 对比修正后的 AQI 获取逻辑 ---
async function fetchAirNow(ctx, key, lon, lat, apiHost) {
  const host = apiHost.startsWith('http') ? apiHost : `https://${apiHost}`;
  const url = `${host.replace(/\/$/, '')}/v7/air/now?location=${lon},${lat}&key=${key}`;
  
  try {
    const resp = await ctx.http.get(url, { timeout: 8000 });
    const data = await resp.json();
    
    // 对比发现：不同账号返回结构不同，这里进行全路径扫描
    let aqi = null;
    let cat = null;

    // 路径 1: 个人 Host 标准路径
    if (data.now && data.now.aqi) {
      aqi = data.now.aqi;
      cat = data.now.category;
    } 
    // 路径 2: 某些新版 Key 的索引路径
    else if (data.indexes && data.indexes.length > 0) {
      const target = data.indexes.find(i => i.code === 'cn-mee' || i.name === 'AQI') || data.indexes[0];
      aqi = target.aqi;
      cat = target.category;
    }
    // 路径 3: 顶层直发路径
    else if (data.aqi) {
      aqi = data.aqi;
      cat = data.category;
    }

    if (!aqi || aqi === 'undefined') return { aqi: '--', category: { text: '--', color: '#999' } };

    return { aqi, category: getAQIInfo(aqi, cat) };
  } catch (e) {
    return { aqi: '--', category: { text: '--', color: '#999' } };
  }
}

// --- 修正后的等级与颜色函数 ---
function getAQIInfo(aqi, cat) {
  const n = parseInt(aqi);
  if (isNaN(n)) return { text: cat || '--', color: { light: '#999', dark: '#888' } };
  
  if (n <= 50)  return { text: '优', color: { light: '#30D158', dark: '#34C759' } };
  if (n <= 100) return { text: '良', color: { light: '#FF9500', dark: '#FF9F0A' } };
  if (n <= 150) return { text: '轻度', color: { light: '#FF6B35', dark: '#FF7A3E' } };
  return { text: '中/重度', color: { light: '#FF3B30', dark: '#FF453A' } };
}

// --- 其他核心逻辑 (保持精简) ---
async function getLocation(ctx, location, key, apiHost) {
  const host = apiHost.startsWith('http') ? apiHost : `https://${apiHost}`;
  const url = `${host.replace(/\/$/, '')}/geo/v2/city/lookup?location=${encodeURIComponent(location)}&key=${key}&number=1`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();
  return data.location?.[0] ? { lon: data.location[0].lon, lat: data.location[0].lat, city: data.location[0].name } : { lon: '116.4', lat: '39.9', city: location };
}

async function fetchWeatherNow(ctx, key, lon, lat, apiHost) {
  const host = apiHost.startsWith('http') ? apiHost : `https://${apiHost}`;
  const url = `${host.replace(/\/$/, '')}/v7/weather/now?location=${lon},${lat}&key=${key}`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();
  return data.now;
}

// --- 渲染部分：去掉冗余文字，保持整洁排版 ---
function renderMedium(now, air, city) {
  const timeStr = `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  return {
    type: 'widget',
    padding: 16,
    gap: 12,
    backgroundColor: { light: '#FFF', dark: '#1C1C1E' },
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
        gap: 16,
        children: [
          { type: 'image', src: `sf-symbol:cloud.sun.fill`, width: 56, height: 56, color: '#FF9F0A' },
          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' } },
              { type: 'text', text: now.text, font: { size: 'title3' }, textColor: '#666' }
            ]
          },
          { type: 'text', text: air.category.text, font: { size: 'title3', weight: 'bold' }, textColor: air.category.color }
        ]
      },
      {
        type: 'stack',
        direction: 'row',
        gap: 16,
        children: [
          renderItem('drop.fill', `${now.humidity}%`, '#007AFF'),
          renderItem('wind', `${now.windScale}级`, '#5856D6'),
          renderItem('gauge.medium', `${now.windSpeed}k/h`, '#FF9500')
        ]
      }
    ]
  };
}

function renderItem(icon, val, col) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 18, height: 18, color: col },
      { type: 'text', text: val, font: { size: 'title3', weight: 'semibold' } }
    ]
  };
}

function renderSmall(now, city) { return { type: 'widget', children: [{ type: 'text', text: `${now.temp}°` }] }; }
function renderError(msg) { return { type: 'widget', padding: 16, children: [{ type: 'text', text: msg, textColor: '#F33' }] }; }
