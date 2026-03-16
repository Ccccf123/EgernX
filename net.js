// 和风天气小组件 - 完整还原布局，仅修改颜色与去除标签

export default async function (ctx) {
  const host = ctx.env.QW_HOST;
  const key = ctx.env.QW_KEY;
  const locationInput = ctx.env.LOCATION || "北京";
  const cityNameOverride = ctx.env.CITY_NAME || "";

  const headers = { "X-QW-Api-Key": key };

  // ✨ 统一极客渐变背景配置
  const BG_GRADIENT = { 
    type: 'linear', 
    colors: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }], 
    startPoint: { x: 0, y: 0 }, 
    endPoint: { x: 1, y: 1 } 
  };

  function errorWidget(msg) {
    return { type: "widget", backgroundColor: "#1C1C1E", padding: 16, children: [{ type: "image", src: "sf-symbol:exclamationmark.triangle.fill", color: "#FF9F0A", width: 24, height: 24 }, { type: "spacer", length: 8 }, { type: "text", text: msg, font: { size: "footnote" }, textColor: "#EBEBF599", maxLines: 3 }] };
  }

  // 严格还原原始 GeoAPI 请求逻辑
  const geoCacheKey = `qw_geo_${locationInput}`;
  let geoInfo = ctx.storage.getJSON(geoCacheKey);
  if (!geoInfo) {
    let geoResp;
    try {
      // 保持原始的 URL 拼接逻辑，确保不报 400 错误
      geoResp = await ctx.http.get(`https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(locationInput)}&number=1&lang=zh`, { headers });
    } catch (e) { return errorWidget("GeoAPI 请求失败：" + e.message); }
    const geoData = await geoResp.json();
    if (geoData.code !== "200" || !geoData.location || geoData.location.length === 0) return errorWidget(`城市解析失败（${geoData.code}）：找不到"${locationInput}"`);
    const loc = geoData.location[0];
    geoInfo = { id: loc.id, lat: loc.lat, lon: loc.lon, name: loc.name, adm1: loc.adm1 };
    ctx.storage.setJSON(geoCacheKey, geoInfo);
  }

  const cityName = cityNameOverride || geoInfo.name;

  let weather, air;
  try {
    const [wResp, aResp] = await Promise.all([
      ctx.http.get(`https://${host}/v7/weather/now?location=${geoInfo.id}&lang=zh`, { headers }),
      ctx.http.get(`https://${host}/airquality/v1/current/${geoInfo.lat}/${geoInfo.lon}?lang=zh`, { headers }),
    ]);
    weather = await wResp.json();
    air = await aResp.json();
  } catch (e) { return errorWidget("天气请求失败：" + e.message); }

  if (weather.code !== "200") return errorWidget(`天气 API 错误 ${weather.code}`);

  const now = weather.now;
  const aqiIndex = (air.indexes || []).find((i) => i.code === "cn-mee") || (air.indexes || []).find((i) => i.code === "cn-mee-1h") || (air.indexes || [])[0];
  const aqiVal = aqiIndex ? aqiIndex.aqiDisplay : "—";
  const aqiColor = aqiIndex ? `rgba(${aqiIndex.color.red},${aqiIndex.color.green},${aqiIndex.color.blue},1)` : "#8E8E93";

  // 保持原有转换函数，不做任何变动
  function windLevelName(scale) {
    const map = { 0: "无风", 1: "软风", 2: "轻风", 3: "微风", 4: "和风", 5: "清风", 6: "强风", 7: "疾风", 8: "大风", 9: "烈风", 10: "狂风", 11: "暴风", 12: "飓风", 13: "台风", 14: "强台风", 15: "强台风", 16: "超强台风", 17: "超强台风" };
    return map[parseInt(scale, 10)] ?? `${scale}级`;
  }

  function weatherSFSymbol(iconCode) {
    const code = parseInt(iconCode, 10);
    const map = { 100: "sun.max.fill", 150: "moon.stars.fill", 101: "cloud.sun.fill", 104: "cloud.fill", 300: "cloud.sun.rain.fill", 301: "cloud.heavyrain.fill", 302: "cloud.bolt.rain.fill", 305: "cloud.drizzle.fill", 306: "cloud.rain.fill", 400: "cloud.snow.fill", 404: "cloud.sleet.fill", 500: "cloud.fog.fill", 502: "sun.haze.fill", 507: "tornado", 900: "thermometer.sun.fill", 901: "thermometer.snowflake" };
    return map[code] || "cloud.fill";
  }

  const refreshTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const weatherIconSrc = `sf-symbol:${weatherSFSymbol(now.icon)}`;

  // 保持原有判断逻辑和布局结构
  if (ctx.widgetFamily === "accessoryRectangular") return { type: "widget", refreshAfter: refreshTime, padding: [2, 4, 2, 4], gap: 2, children: [{ type: "stack", direction: "row", alignItems: "center", gap: 6, children: [{ type: "image", src: weatherIconSrc, color: "#FFD60A", width: 16, height: 16 }, { type: "text", text: `${cityName}  ${now.temp}°`, font: { size: "headline", weight: "semibold" }, maxLines: 1 }] }, { type: "text", text: `${now.text}  ${now.humidity}%  ${aqiVal}`, font: { size: "caption1" }, maxLines: 1 }] };
  if (ctx.widgetFamily === "accessoryCircular") return { type: "widget", refreshAfter: refreshTime, children: [{ type: "stack", direction: "column", alignItems: "center", gap: 2, children: [{ type: "image", src: weatherIconSrc, color: "#FFD60A", width: 20, height: 20 }, { type: "text", text: `${now.temp}°`, font: { size: "title3", weight: "bold" } }] }] };

  // 系统主组件逻辑：仅删除了标签文字，没有改动任何结构
  return {
    type: "widget",
    refreshAfter: refreshTime,
    backgroundGradient: BG_GRADIENT,
    padding: 16,
    children: [
      { type: "stack", direction: "row", alignItems: "center", children: [{ type: "stack", direction: "row", alignItems: "center", gap: 4, flex: 1, children: [{ type: "image", src: "sf-symbol:location.fill", color: "#AADEFC", width: 12, height: 12 }, { type: "text", text: cityName, font: { size: "subheadline", weight: "semibold" }, textColor: "#000000CC", dark: { textColor: "#FFFFFFDD" }, maxLines: 1 }] }, { type: "text", text: weather.updateTime.slice(11, 16), font: { size: "caption2" }, textColor: "#00000066", dark: { textColor: "#FFFFFF66" } }] },
      { type: "spacer", length: 6 },
      { type: "stack", direction: "row", alignItems: "center", gap: 12, children: [{ type: "image", src: weatherIconSrc, color: "#000000", dark: { color: "#FFFFFF" }, width: 52, height: 52 }, { type: "stack", direction: "column", gap: 2, children: [{ type: "text", text: `${now.temp}°C`, font: { size: "largeTitle", weight: "bold" }, textColor: "#000000", dark: { textColor: "#FFFFFF" } }, { type: "text", text: now.text, font: { size: "subheadline" }, textColor: "#000000CC", dark: { textColor: "#FFFFFFCC" } }] }] },
      { type: "spacer" },
      { type: "stack", direction: "row", alignItems: "center", children: [{ type: "stack", direction: "column", alignItems: "center", flex: 1, children: [{ type: "image", src: "sf-symbol:humidity.fill", color: "#AADEFC", width: 16, height: 16 }, { type: "text", text: `${now.humidity}%`, font: { size: "caption1", weight: "semibold" } }] }, { type: "stack", direction: "column", alignItems: "center", flex: 1, children: [{ type: "image", src: "sf-symbol:wind", color: "#A8F0C0", width: 16, height: 16 }, { type: "text", text: windLevelName(now.windScale), font: { size: "caption1", weight: "semibold" } }] }, { type: "stack", direction: "column", alignItems: "center", flex: 1, children: [{ type: "image", src: "sf-symbol:aqi.medium", color: aqiColor, width: 16, height: 16 }, { type: "text", text: aqiVal, font: { size: "caption1", weight: "semibold" } }] }] }
    ]
  };
}
