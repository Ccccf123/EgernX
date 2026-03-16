/**
 * 🌤️ 和风天气 - Egern 小组件（精简标签版）
 */

// ===== 配置 =====
const apiKey = '你的KEY';
const apiHost = 'https://devapi.qweather.com';

// ===== 主函数 =====
async function main(ctx) {

  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  const lon = ctx.query.lon || '116.40';
  const lat = ctx.query.lat || '39.90';
  const city = ctx.query.city || '北京';

  const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);
  const air = await fetchAir(ctx, apiKey, lon, lat, apiHost);
  const daily = await fetchWeatherDaily(ctx, apiKey, lon, lat, apiHost);

  if (widgetFamily && isAccessoryFamily(widgetFamily)) {
    return renderAccessory(now);
  }

  return renderMedium(now, air, city, daily);
}

// ===== 当前天气 =====
async function fetchWeatherNow(ctx, key, lon, lat, host) {

  const url = `${host}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();

  return data.now || {};
}

// ===== 空气质量 =====
async function fetchAir(ctx, key, lon, lat, host) {

  try {
    const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}`;
    const resp = await ctx.http.get(url);
    const data = await resp.json();

    return data.now || {};
  } catch {
    return {};
  }
}

// ===== 新增：最高/最低温 =====
async function fetchWeatherDaily(ctx, key, lon, lat, host) {

  const url = `${host}/v7/weather/3d?location=${lon},${lat}&key=${key}&lang=zh`;
  const resp = await ctx.http.get(url);
  const data = await resp.json();

  if (data.code === '200' && data.daily?.[0]) {
    return {
      tempMax: data.daily[0].tempMax,
      tempMin: data.daily[0].tempMin
    };
  }

  return { tempMax: '--', tempMin: '--' };
}

// ===== 中号组件 =====
function renderMedium(now, air, city, daily) {

  const icon = 'cloud.sun.fill';
  const iconColor = { light: '#333', dark: '#FFF' };

  return {
    type: 'container',
    padding: 16,
    children: [

      // 顶部城市
      {
        type: 'text',
        text: (city || '').slice(0, 4),
        font: { size: 'caption1' },
        textColor: { light: '#666', dark: '#AAA' }
      },

      { type: 'spacer', size: 8 },

      // ===== 核心布局（已调整）=====
      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        children: [

          // 左：天气
          {
            type: 'stack',
            direction: 'column',
            justifyContent: 'center',
            children: [
              { type: 'text', text: now.text, font: { size: 'title3' } }
            ]
          },

          // 中：温度
          {
            type: 'stack',
            direction: 'column',
            flex: 1,
            alignItems: 'center',
            gap: 2,
            children: [

              {
                type: 'text',
                text: `${now.temp}°`,
                font: { size: 48, weight: 'bold' }
              },

              {
                type: 'text',
                text: `${daily.tempMax}° / ${daily.tempMin}°`,
                font: { size: 'caption1' },
                textColor: { light: '#666', dark: '#AAA' }
              }
            ]
          },

          // 右：图标
          {
            type: 'image',
            src: `sf-symbol:${icon}`,
            width: 48,
            height: 48,
            color: iconColor
          }
        ]
      },

      { type: 'spacer' },

      // ===== 底部信息（已去标签）=====
      {
        type: 'stack',
        direction: 'row',
        justifyContent: 'space-between',
        children: [

          createInfoItem('drop.fill', '', `${now.humidity}%`, '#007AFF'),

          createInfoItem('wind', '', `${now.windDir} ${now.windScale}级`, '#5856D6'),

          createInfoItem('gauge.medium', '', `${now.windSpeed}km/h`, '#FF9500')
        ]
      }
    ]
  };
}

// ===== 小组件信息项 =====
function createInfoItem(icon, label, value, color) {

  return {
    type: 'stack',
    direction: 'row',
    alignItems: 'center',
    gap: 4,
    children: [

      {
        type: 'image',
        src: `sf-symbol:${icon}`,
        width: 14,
        height: 14,
        color
      },

      {
        type: 'text',
        text: value,
        font: { size: 'caption2' }
      }
    ]
  };
}

// ===== 锁屏组件 =====
function renderAccessory(now) {
  return {
    type: 'text',
    text: `${now.temp}°`
  };
}

// ===== 判断类型 =====
function isAccessoryFamily(family) {
  return family && family.startsWith('accessory');
}

// ===== 运行 =====
module.exports = { main };