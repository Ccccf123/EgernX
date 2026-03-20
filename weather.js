export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  const apiKey = (env.KEY || '').trim();
  const apiHostRaw = (env.API_HOST || 'devapi.qweather.com').trim();
  const location = (env.LOCATION || '北京').trim();

  if (!apiKey) return renderError('请检查环境变量 KEY');
  const apiHost = normalizeHost(apiHostRaw);

  // ✅ 缓存 key（跟城市绑定）
  const CACHE_KEY = `weather_cache_${location}`;
  const CACHE_TTL = 2 * 60 * 60 * 1000; // 2小时

  try {
    // 读取缓存
    const cache = ctx.storage.get(CACHE_KEY);
    const nowTime = Date.now();

    if (cache && (nowTime - cache.time < CACHE_TTL)) {
      // ✅ 命中缓存
      return renderMedium(cache.data);
    }

    // ❗ 城市变化：旧缓存自然失效（key 已不同）

    // 1. 获取地理坐标
    const loc = await getLocation(ctx, location, apiKey, apiHost);

    // 2. 获取实时天气
    const now = await fetchWeatherNow(ctx, apiKey, loc.lon, loc.lat, apiHost);

    // 3. 预报
    let daily = { tempMax: '25', tempMin: '18' };
    try {
      const d = await fetchWeatherDaily(ctx, apiKey, loc.lon, loc.lat, apiHost);
      if (d) daily = d;
    } catch(e) {}

    // 4. 空气质量
    let air = { aqi: '50', category: '优', color: '#34C759' };
    try {
      const a = await fetchAirQuality(ctx, apiKey, loc.lon, loc.lat, apiHost);
      if (a && a.aqi !== 'N/A') air = a;
    } catch(e) {}

    const data = { now, daily, air, city: loc.city };

    // ✅ 写入缓存
    ctx.storage.set(CACHE_KEY, {
      time: nowTime,
      data
    });

    return renderMedium(data);

  } catch (e) {
    return renderError(`连接失败: ${e.message}`);
  }
}

// ────────────── 渲染布局 ──────────────

function renderMedium(data) {
  const { now, daily, air, city } = data;
  const iconInfo = getWeatherStyles(now.icon);
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

  const C_TEXT = { light: '#1C1C1E', dark: '#FFFFFF' };
  const C_SUB = { light: '#8E8E93', dark: '#8E8E93' };

  return {
    type: 'widget',
    padding: 18,
    backgroundGradient: { 
      type: "linear", 
      colors: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F2F2F7', dark: '#000000' }]
    },
    children: [
      // 顶部（✅ 改成系统图标）
      { type: 'stack', direction: 'row', alignItems: 'center', children: [
          { type: 'image', src: 'sf-symbol:location.fill', width: 14, height: 14, color: '#FF3B30' },
          { type: 'spacer', length: 4 },
          { type: 'text', text: city, font: { size: 14, weight: 'bold' }, textColor: C_TEXT },
          { type: 'spacer' },
          { type: 'text', text: timeStr, font: { size: 12 }, textColor: C_SUB }
      ]},

      { type: 'spacer', flex: 1 },

      // 中间
      { type: 'stack', direction: 'row', alignItems: 'center', children: [
          { type: 'spacer', flex: 1.2 }, 

          { type: 'stack', direction: 'column', spacing: 2, children: [
              { type: 'text', text: `MAX ${daily.tempMax}°`, font: { size: 13, weight: 'bold' }, textColor: '#FF3B30' },
              { type: 'text', text: `MIN ${daily.tempMin}°`, font: { size: 13, weight: 'bold' }, textColor: '#007AFF' }
          ]},

          { type: 'spacer', length: 15 },

          { type: 'image', src: `sf-symbol:${iconInfo.icon}`, width: 66, height: 66, color: iconInfo.color },

          { type: 'stack', direction: 'column', spacing: -6, children: [
              { type: 'text', text: `${now.temp}°`, font: { size: 56, weight: 'bold' }, textColor: C_TEXT },
              { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
                  { type: 'text', text: now.text, font: { size: 16, weight: 'medium' }, textColor: C_TEXT },
                  { type: 'text', text: air.category, font: { size: 14, weight: 'bold' }, textColor: air.color }
              ]}
          ]},

          { type: 'spacer', flex: 0.8 }
      ]},

      { type: 'spacer', flex: 1 },

      // 底部
      { type: 'stack', direction: 'row', children: [
          renderFooterItem('drop.fill', `${now.humidity}%`, '#007AFF', C_TEXT),
          { type: 'spacer' },
          renderFooterItem('wind', `${now.windScale}级`, '#5856D6', C_TEXT),
          { type: 'spacer' },
          renderFooterItem('speedometer', `${now.windSpeed}km/h`, '#34C759', C_TEXT),
          { type: 'spacer' },
          renderFooterItem('aqi.low', `AQI ${air.aqi}`, '#FF9500', C_TEXT)
      ]}
    ]
  };
}

// ────────────── 其余函数（完全未动） ──────────────

function renderFooterItem(icon, label, iconColor, textColor) {
  return {
    type: 'stack', direction: 'row', alignItems: 'center', gap: 4, children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 12, height: 12, color: { light: iconColor, dark: iconColor } },
      { type: 'text', text: label, font: { size: 11, weight: 'semibold' }, textColor: textColor }
    ]
  };
}

async function fetchAirQuality(ctx, key, lon, lat, host) {
  const res = await ctx.http.get(`${host}/v7/air/now?location=${lon},${lat}&key=${key}`);
  const data = await res.json();
  if (data && data.now) {
    return { 
      aqi: data.now.aqi || '--', 
      category: data.now.category || '', 
      color: getAQIColor(data.now.aqi) 
    };
  }
  return null;
}

async function fetchWeatherDaily(ctx, key, lon, lat, host) {
  const res = await ctx.http.get(`${host}/v7/weather/3d?location=${lon},${lat}&key=${key}`);
  const data = await res.json();
  if (data && data.daily && data.daily[0]) {
    return { tempMax: data.daily[0].tempMax, tempMin: data.daily[0].tempMin };
  }
  return null;
}

async function fetchWeatherNow(ctx, key, lon, lat, host) {
  const res = await ctx.http.get(`${host}/v7/weather/now?location=${lon},${lat}&key=${key}`);
  const data = await res.json();
  if (data.code !== '200') throw new Error(`错误码:${data.code}`);
  return data.now;
}

function getAQIColor(val) {
  const n = parseInt(val);
  if (n <= 50) return '#34C759';
  if (n <= 100) return '#FFCC00';
  return '#FF3B30';
}

function getWeatherStyles(code) {
  const n = parseInt(code);
  if (n === 100 || n === 101) return { icon: 'sun.max.fill', color: '#FF9500' };
  if (n <= 150) return { icon: 'cloud.sun.fill', color: '#FF9500' };
  if (n >= 300 && n <= 399) return { icon: 'cloud.rain.fill', color: '#007AFF' };
  return { icon: 'cloud.fill', color: '#007AFF' };
}

function normalizeHost(host) {
  return host.includes('http') ? host.replace(/\/+$/, '') : `https://${host.replace(/\/+$/, '')}`;
}

async function getLocation(ctx, locName, key, host) {
  const res = await ctx.http.get(`${host}/geo/v2/city/lookup?location=${encodeURIComponent(locName)}&key=${key}&number=1`);
  const data = await res.json();
  if (data && data.location && data.location[0]) {
    return { lon: data.location[0].lon, lat: data.location[0].lat, city: data.location[0].name };
  }
  throw new Error('定位失败');
}

function renderError(msg) {
  return { type: 'widget', children: [{ type: 'text', text: msg, textColor: '#FF3B30' }] };
}