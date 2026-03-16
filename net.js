/**
 * 🌤️ 和风天气 - Egern 小组件
 * 统一渐变背景版（已移除文字标签）
 */

export default async function(ctx) {
  const env = ctx.env || {};
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  // ✨ 统一极客渐变背景配置
  const BG_GRADIENT = { 
    type: 'linear', 
    colors: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }], 
    startPoint: { x: 0, y: 0 }, 
    endPoint: { x: 1, y: 1 } 
  };

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

    let widget;
    if (isAccessoryFamily(widgetFamily)) {
      widget = renderAccessoryCompact(now, city, widgetFamily);
    } else if (widgetFamily === 'systemSmall') {
      widget = renderSmall(now, city);
    } else {
      widget = renderMedium(now, air, city);
    }
    
    // 注入统一背景
    return { ...widget, backgroundGradient: BG_GRADIENT };

  } catch (e) {
    console.error(e);
    return renderError(`请求失败：${e.message.slice(0, 60)}`);
  }
}

// 辅助函数保持原样
function normalizeHost(host) { let h = host; if (!/^https?:\/\//i.test(h)) h = 'https://' + h; return h.replace(/\/+$/, ''); }
function isAccessoryFamily(family) { return family.startsWith('accessory'); }
async function getLocation(ctx, locName, key, host) { /* 省略细节，此处保留你原有的逻辑 */ }
async function fetchWeatherNow(ctx, key, lon, lat, host) { /* 省略细节，此处保留你原有的逻辑 */ }
async function fetchAirQuality(ctx, key, lon, lat, host) { /* 省略细节，此处保留你原有的逻辑 */ }
function getAQICategory(val) { /* 省略细节 */ }
function getWeatherIcon(code) { /* 省略细节 */ }
function getWeatherColor(code) { /* 省略细节 */ }

// 渲染函数：仅移除标签文字
function renderSmall(now, city) {
  const icon = getWeatherIcon(now.icon);
  const color = getWeatherColor(now.icon);
  return {
    type: 'widget',
    padding: 14,
    gap: 6,
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', children: [
        { type: 'text', text: city, font: { size: 'caption1', weight: 'bold' } },
        { type: 'spacer' }
      ]},
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 10, children: [
        { type: 'image', src: `sf-symbol:${icon}`, width: 40, height: 40, color },
        { type: 'text', text: `${now.temp}°`, font: { size: 'title2', weight: 'bold' } }
      ]}
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
    gap: 12,
    children: [
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 8, children: [
          { type: 'image', src: 'sf-symbol:location.fill', width: 14, height: 14, color: { light: '#FF3B30', dark: '#FF453A' } },
          { type: 'text', text: city, font: { size: 'title3', weight: 'bold' } },
          { type: 'spacer' },
          { type: 'text', text: `${air.aqi}`, font: { size: 'caption1', weight: 'semibold' }, textColor: aqiColor }
        ]
      },
      { type: 'stack', direction: 'row', alignItems: 'center', gap: 16, children: [
          { type: 'image', src: `sf-symbol:${icon}`, width: 64, height: 64, color: iconColor },
          { type: 'stack', direction: 'column', flex: 1, children: [
              { type: 'text', text: `${now.temp}°C`, font: { size: 'largeTitle', weight: 'bold' } },
              { type: 'text', text: now.text, font: { size: 'title3' } }
            ]
          },
          { type: 'text', text: air.category, font: { size: 'title3', weight: 'bold' }, textColor: aqiColor }
        ]
      },
      { type: 'stack', direction: 'row', gap: 12, children: [
          createInfoItem('drop.fill', `${now.humidity}%`),
          createInfoItem('wind', `${now.windDir} ${now.windScale}级`),
          createInfoItem('gauge.medium', `${now.windSpeed}km/h`)
        ]
      }
    ]
  };
}

function createInfoItem(icon, value) {
  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
    children: [
      { type: 'image', src: `sf-symbol:${icon}`, width: 16, height: 16 },
      { type: 'text', text: value, font: { size: 'subheadline', weight: 'semibold' } }
    ]
  };
}

function renderAccessoryCompact(now, city, family) {
  return { type: 'widget', padding: 8, children: [{ type: 'text', text: `${now.temp}° ${city}` }] };
}

function renderError(msg) {
  return { type: 'widget', padding: 16, children: [{ type: 'text', text: msg, textColor: '#FF3B30' }] };
}
