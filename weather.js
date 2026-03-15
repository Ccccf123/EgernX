/**
 * 🌤️ 和风天气 - 纯净数据版 (保留布局，精简标签)
 */

// ... (此处保持之前所有获取数据和地理位置的逻辑不变，仅更新渲染函数)

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
    backgroundColor: { light: '#FFFFFF', dark: '#2C2C2E' },
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
            text: `AQI ${air.aqi}`,
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
            type: 'text',
            text: air.category,
            font: { size: 'title3', weight: 'bold' },
            textColor: aqiColor
          }
        ]
      },
      // 底部简洁栏：去掉了“湿度/风力”等小字，仅保留图标和数值
      {
        type: 'stack',
        direction: 'row',
        gap: 16,
        children: [
          { type: 'stack', direction: 'row', alignItems: 'center', flex: 1, gap: 6, children: [{ type: 'image', src: 'sf-symbol:drop.fill', width: 18, height: 18, color: '#007AFF' }, { type: 'text', text: `${now.humidity}%`, font: { size: 'title3', weight: 'semibold' } }] },
          { type: 'stack', direction: 'row', alignItems: 'center', flex: 1, gap: 6, children: [{ type: 'image', src: 'sf-symbol:wind', width: 18, height: 18, color: '#5856D6' }, { type: 'text', text: `${now.windScale}级`, font: { size: 'title3', weight: 'semibold' } }] },
          { type: 'stack', direction: 'row', alignItems: 'center', flex: 1, gap: 6, children: [{ type: 'image', src: 'sf-symbol:gauge.medium', width: 18, height: 18, color: '#FF9500' }, { type: 'text', text: `${now.windSpeed}km/h`, font: { size: 'title3', weight: 'semibold' } }] }
        ]
      }
    ]
  };
}
