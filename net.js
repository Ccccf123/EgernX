/**
 * 🌤️ 和风天气 - Egern 小组件 (还原版)
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  const apiKey     = (env.KEY || '').trim();
  const apiHostRaw = (env.API_HOST || '').trim();
  const location   = (env.LOCATION || '北京').trim();

  // ✨ 统一极客渐变背景配置
  const BG_GRADIENT = { 
    type: 'linear', 
    colors: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }], 
    startPoint: { x: 0, y: 0 }, 
    endPoint: { x: 1, y: 1 } 
  };

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
      return { ...renderAccessoryCompact(now, city, widgetFamily), backgroundGradient: BG_GRADIENT };
    }

    if (widgetFamily === 'systemSmall') {
      return { ...renderSmall(now, city), backgroundGradient: BG_GRADIENT };
    } else {
      return { ...renderMedium(now, air, city), backgroundGradient: BG_GRADIENT };
    }

  } catch (e) {
    console.error(e);
    return renderError(`请求失败：${e.message.slice(0, 60)}`);
  }
}

// ────────────────────────────────────────────────
// 辅助函数保持原样
// ────────────────────────────────────────────────
function normalizeHost(host) { let h = host; if (!/^https?:\/\//i.test(h)) h = 'https://' + h; return h.replace(/\/+$/, ''); }
function isAccessoryFamily(family) { return family.startsWith('accessory'); }
async function getLocation(ctx, locName, key, host) { /* 原有逻辑 */ }
async function fetchWeatherNow(ctx, key, lon, lat, host) { /* 原有逻辑 */ }
async function fetchAirQuality(ctx, key, lon, lat, host) { /* 原有逻辑 */ }
function getAQICategory(val) { /* 原有逻辑 */ }
function getWeatherIcon(code) { /* 原有逻辑 */ }
function getWeatherColor(code) { /* 原有逻辑 */ }

// ────────────────────────────────────────────────
// 渲染函数：仅去除标签字，布局和逻辑完全保持原样
// ────────────────────────────────────────────────

function renderSmall(now, city) { /* 原有逻辑 */ }

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
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 8, children: [
          { type: 'stack', direction: 'row', alignItems: 'center', gap: 6, children: [
              { type: 'image', src: 'sf-symbol:location.fill', width: 14, height: 14, color: { light: '#FF3B30', dark: '#FF453A' } },
              { type: 'text', text: city, font: { size: 'title3', weight: 'bold' } }
            ] },
          { type: 'spacer' },
          { type: 'text', text: `${air.aqi}`, font: { size: 'caption1', weight: 'semibold' }, textColor: aqiColor },
          { type: 'text', text: timeStr, font: { size: 'caption2' } }
        ] },
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 16, children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 64, height: 64, color: iconColor },
          { type: 'stack', direction: 'column', flex: 1, gap: 4, children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' } },
              { type: 'text', text: now.text, font: { size: 'title3' } }
            ] },
          { type: 'stack', direction: 'column', alignItems: 'center', gap: 2, children: [
              { type: 'text', text: air.category, font: { size: 'title3', weight: 'bold' }, textColor: aqiColor }
            ] }
        ] },
      { type: 'stack', direction: 'row', gap: 12, children: [
          createInfoItem('drop.fill', `${now.humidity}%`, '#007AFF'),
          createInfoItem('wind', `${now.windDir} ${now.windScale}级`, '#5856D6'),
          createInfoItem('gauge.medium', `${now.windSpeed}km/h`, '#FF9500')
        ] }
    ]
  };
}

function createInfoItem(icon, value, iconColor) {
  return { type: 'stack', direction: 'row', alignItems: 'center', flex: 1, gap: 8, children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 20, height: 20, color: { light: iconColor, dark: iconColor } },
      { type: 'text', text: value, font: { size: 'title3', weight: 'semibold' } }
    ] };
}

function renderAccessoryCompact(now, city, family) { /* 原有逻辑 */ }
function renderError(msg) { /* 原有逻辑 */ }
