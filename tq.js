// 和风天气小组件 for Egern
// 环境变量（在 widgets env 中配置）：
//   QW_HOST     - 你的 API Host，例如 abcxyz.qweatherapi.com
//   QW_KEY      - 你的 API Key
//   LOCATION    - 支持：城市名（如"北京"）、LocationID（如"101010100"）
//                       或经纬度坐标（如"116.41,39.92"，格式为"经度,纬度"）
//   CITY_NAME   - （可选）覆盖显示的城市名称，不填则自动使用 GeoAPI 返回的城市名

export default async function (ctx) {
  const host = ctx.env.QW_HOST;
  const key = ctx.env.QW_KEY;
  const locationInput = ctx.env.LOCATION || "北京";
  const cityNameOverride = ctx.env.CITY_NAME || "";

  const headers = { "X-QW-Api-Key": key };

  // ── 错误 UI 工厂 ──────────────────────────────────────────
  function errorWidget(msg) {
    return {
      type: "widget",
      backgroundColor: "#1C1C1E",
      padding: 16,
      children: [
        {
          type: "image",
          src: "sf-symbol:exclamationmark.triangle.fill",
          color: "#FF9F0A",
          width: 24,
          height: 24,
        },
        { type: "spacer", length: 8 },
        {
          type: "text",
          text: msg,
          font: { size: "footnote" },
          textColor: "#EBEBF599",
          maxLines: 3,
        },
      ],
    };
  }

  // ── GeoAPI：解析 LOCATION → LocationID + 经纬度 + 城市名 ──
  // 缓存 key 基于 locationInput，避免每次刷新都调 GeoAPI
  const geoCacheKey = `qw_geo_${locationInput}`;
  let geoInfo = ctx.storage.getJSON(geoCacheKey);

  if (!geoInfo) {
    let geoResp;
    try {
      geoResp = await ctx.http.get(
        `https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(locationInput)}&number=1&lang=zh`,
        { headers }
      );
    } catch (e) {
      return errorWidget("GeoAPI 请求失败：" + e.message);
    }
    const geoData = await geoResp.json();
    if (geoData.code !== "200" || !geoData.location || geoData.location.length === 0) {
      return errorWidget(`城市解析失败（${geoData.code}）：找不到"${locationInput}"`);
    }
    const loc = geoData.location[0];
    geoInfo = {
      id:   loc.id,        // LocationID，用于天气接口
      lat:  loc.lat,       // 纬度，用于空气质量接口
      lon:  loc.lon,       // 经度，用于空气质量接口
      name: loc.name,      // 城市名
      adm1: loc.adm1,      // 一级行政区（省/直辖市）
    };
    // GeoAPI 结果缓存 24 小时（城市信息基本不变）
    ctx.storage.setJSON(geoCacheKey, geoInfo);
  }

  // CITY_NAME 有配置则优先使用，否则用 GeoAPI 返回的城市名
  const cityName = cityNameOverride || geoInfo.name;

  // ── 并发获取天气 + 空气质量 ───────────────────────────────
  // 天气接口：用 LocationID（精确）
  // 空气质量接口：用经纬度（该接口只支持坐标）
  let weather, air;
  try {
    const [wResp, aResp] = await Promise.all([
      ctx.http.get(
        `https://${host}/v7/weather/now?location=${geoInfo.id}&lang=zh`,
        { headers }
      ),
      ctx.http.get(
        `https://${host}/airquality/v1/current/${geoInfo.lat}/${geoInfo.lon}?lang=zh`,
        { headers }
      ),
    ]);
    weather = await wResp.json();
    air = await aResp.json();
  } catch (e) {
    return errorWidget("天气请求失败：" + e.message);
  }

  if (weather.code !== "200") {
    return errorWidget(`天气 API 错误 ${weather.code}`);
  }

  const now = weather.now;

  // AQI：cn-mee 为中国实时标准（优先）→ cn-mee-1h 次之 → 第一条兜底
  const aqiIndex =
    (air.indexes || []).find((i) => i.code === "cn-mee") ||
    (air.indexes || []).find((i) => i.code === "cn-mee-1h") ||
    (air.indexes || [])[0];
  const aqiVal = aqiIndex ? aqiIndex.aqiDisplay : "—";
  // lang=zh 时 API 直接返回中文 category，无需手动映射
  const aqiCategory = aqiIndex ? aqiIndex.category : "";
  const aqiColor = aqiIndex
    ? `rgba(${aqiIndex.color.red},${aqiIndex.color.green},${aqiIndex.color.blue},1)`
    : "#8E8E93";

  // 风力等级术语（按蒲福风级文档，0-17级完整映射）
  function windLevelName(scale) {
    const map = {
      0: "无风", 1: "软风", 2: "轻风", 3: "微风",
      4: "和风", 5: "清风", 6: "强风", 7: "疾风",
      8: "大风", 9: "烈风", 10: "狂风", 11: "暴风",
      12: "飓风", 13: "台风", 14: "强台风", 15: "强台风",
      16: "超强台风", 17: "超强台风",
    };
    const n = parseInt(scale, 10);
    return map[n] ?? `${scale}级`;
  }

  // 和风天气图标代码 → SF Symbol 完整映射
  function weatherSFSymbol(iconCode) {
    const code = parseInt(iconCode, 10);
    const map = {
      // 晴
      100: "sun.max.fill",
      150: "moon.stars.fill",
      // 多云 / 少云 / 晴间多云
      101: "cloud.sun.fill",
      102: "cloud.sun.fill",
      103: "cloud.sun.fill",
      151: "cloud.moon.fill",
      152: "cloud.moon.fill",
      153: "cloud.moon.fill",
      // 阴
      104: "cloud.fill",
      // 阵雨（白天/夜间）
      300: "cloud.sun.rain.fill",
      301: "cloud.heavyrain.fill",
      350: "cloud.moon.rain.fill",
      351: "cloud.heavyrain.fill",
      // 雷阵雨
      302: "cloud.bolt.rain.fill",
      303: "cloud.bolt.rain.fill",
      // 雷阵雨伴冰雹
      304: "cloud.hail.fill",
      // 小雨 / 毛毛雨
      305: "cloud.drizzle.fill",
      309: "cloud.drizzle.fill",
      // 中雨 / 大雨
      306: "cloud.rain.fill",
      307: "cloud.heavyrain.fill",
      308: "cloud.heavyrain.fill",
      // 暴雨系列
      310: "cloud.heavyrain.fill",
      311: "cloud.heavyrain.fill",
      312: "cloud.heavyrain.fill",
      // 冻雨
      313: "cloud.sleet.fill",
      // 小到中 / 中到大 / 大到暴
      314: "cloud.rain.fill",
      315: "cloud.rain.fill",
      316: "cloud.heavyrain.fill",
      317: "cloud.heavyrain.fill",
      318: "cloud.heavyrain.fill",
      // 雨（通用）
      399: "cloud.rain.fill",
      // 小雪 / 中雪 / 大雪 / 暴雪
      400: "cloud.snow.fill",
      401: "cloud.snow.fill",
      402: "cloud.snow.fill",
      403: "cloud.snow.fill",
      // 雨夹雪
      404: "cloud.sleet.fill",
      405: "cloud.sleet.fill",
      406: "cloud.sleet.fill",
      456: "cloud.sleet.fill",
      // 阵雪
      407: "cloud.snow.fill",
      457: "cloud.snow.fill",
      // 小到中雪 / 中到大雪 / 大到暴雪
      408: "cloud.snow.fill",
      409: "cloud.snow.fill",
      410: "cloud.snow.fill",
      // 雪（通用）
      499: "cloud.snow.fill",
      // 雾
      500: "cloud.fog.fill",
      501: "cloud.fog.fill",
      509: "cloud.fog.fill",
      510: "cloud.fog.fill",
      514: "cloud.fog.fill",
      515: "cloud.fog.fill",
      // 霾
      502: "sun.haze.fill",
      511: "sun.haze.fill",
      512: "sun.haze.fill",
      513: "sun.haze.fill",
      // 扬沙 / 浮尘
      503: "sun.dust.fill",
      504: "sun.dust.fill",
      // 沙尘暴
      507: "tornado",
      508: "tornado",
      // 热 / 冷
      900: "thermometer.sun.fill",
      901: "thermometer.snowflake",
      // 未知
      999: "cloud.fill",
    };
    return map[code] || "cloud.fill";
  }

  const refreshTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const weatherIconSrc = `sf-symbol:${weatherSFSymbol(now.icon)}`;

  // ── accessoryRectangular（锁定屏幕矩形）────────────────────
  if (ctx.widgetFamily === "accessoryRectangular") {
    return {
      type: "widget",
      refreshAfter: refreshTime,
      padding: [2, 4, 2, 4],
      gap: 2,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: weatherIconSrc,
              color: "#FFD60A",
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: `${cityName}  ${now.temp}°`,
              font: { size: "headline", weight: "semibold" },
              maxLines: 1,
            },
          ],
        },
        {
          type: "text",
          text: `${now.text}  湿度 ${now.humidity}%  AQI ${aqiVal}`,
          font: { size: "caption1" },
          maxLines: 1,
        },
      ],
    };
  }

  // ── accessoryCircular（锁定屏幕圆形）──────────────────────
  if (ctx.widgetFamily === "accessoryCircular") {
    return {
      type: "widget",
      refreshAfter: refreshTime,
      children: [
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          gap: 2,
          children: [
            {
              type: "image",
              src: weatherIconSrc,
              color: "#FFD60A",
              width: 20,
              height: 20,
            },
            {
              type: "text",
              text: `${now.temp}°`,
              font: { size: "title3", weight: "bold" },
            },
          ],
        },
      ],
    };
  }

  // ── systemSmall ────────────────────────────────────────────
  if (ctx.widgetFamily === "systemSmall") {
    return {
      type: "widget",
      refreshAfter: refreshTime,
      backgroundGradient: {
        type: "linear",
        colors: [
          { light: "#3A7BD5", dark: "#1A3A6E" },
          { light: "#6AAFE6", dark: "#0F2A55" },
        ],
        stops: [0, 1],
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 0, y: 1 },
      },
      padding: 14,
      gap: 4,
      children: [
        {
          type: "text",
          text: cityName,
          font: { size: "footnote", weight: "semibold" },
          textColor: "#FFFFFFCC",
          maxLines: 1,
        },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: weatherIconSrc,
              color: "#FFFFFF",
              width: 28,
              height: 28,
            },
            {
              type: "text",
              text: `${now.temp}°`,
              font: { size: "title", weight: "bold" },
              textColor: "#FFFFFF",
            },
          ],
        },
        {
          type: "text",
          text: now.text,
          font: { size: "subheadline" },
          textColor: "#FFFFFFCC",
        },
        { type: "spacer" },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 4,
          children: [
            {
              type: "image",
              src: "sf-symbol:aqi.low",
              color: aqiColor,
              width: 12,
              height: 12,
            },
            {
              type: "text",
              text: `AQI ${aqiVal}  ${aqiCategory}`,
              font: { size: "caption2" },
              textColor: "#FFFFFFAA",
              maxLines: 1,
            },
          ],
        },
      ],
    };
  }

  // ── systemMedium / systemLarge（默认）─────────────────────
  const isLarge = ctx.widgetFamily === "systemLarge";

  const mainChildren = [
    // 顶部：城市 + 当前时间
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 4,
          flex: 1,
          children: [
            {
              type: "image",
              src: "sf-symbol:location.fill",
              color: "#AADEFC",
              width: 12,
              height: 12,
            },
            {
              type: "text",
              text: cityName,
              font: { size: "subheadline", weight: "semibold" },
              textColor: "#FFFFFFDD",
              maxLines: 1,
            },
          ],
        },
        {
          type: "text",
          text: weather.updateTime.slice(11, 16),
          font: { size: "caption2" },
          textColor: "#FFFFFF66",
        },
      ],
    },
    { type: "spacer", length: 6 },
    // 中部：大温度 + 图标
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 12,
      children: [
        {
          type: "image",
          src: weatherIconSrc,
          color: "#FFFFFF",
          width: 52,
          height: 52,
        },
        {
          type: "stack",
          direction: "column",
          gap: 2,
          children: [
            {
              type: "text",
              text: `${now.temp}°C`,
              font: { size: "largeTitle", weight: "bold" },
              textColor: "#FFFFFF",
              maxLines: 1,
              minScale: 0.7,
            },
            {
              type: "text",
              text: now.text,
              font: { size: "subheadline" },
              textColor: "#FFFFFFCC",
            },
            {
              type: "text",
              text: `体感 ${now.feelsLike}°`,
              font: { size: "footnote" },
              textColor: "#FFFFFF88",
            },
          ],
        },
      ],
    },
    { type: "spacer" },
    // 底部详情行：湿度 / 风力 / AQI / 能见度
    {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 0,
      children: [
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 3,
          children: [
            {
              type: "image",
              src: "sf-symbol:humidity.fill",
              color: "#AADEFC",
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: `${now.humidity}%`,
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF",
            },
            {
              type: "text",
              text: "湿度",
              font: { size: "caption2" },
              textColor: "#FFFFFF66",
            },
          ],
        },
        { type: "stack", width: 1, height: 36, backgroundColor: "#FFFFFF22" },
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 3,
          children: [
            {
              type: "image",
              src: "sf-symbol:wind",
              color: "#A8F0C0",
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: windLevelName(now.windScale),
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF",
            },
            {
              type: "text",
              text: `${now.windDir} ${now.windSpeed}km/h`,
              font: { size: "caption2" },
              textColor: "#FFFFFF66",
            },
          ],
        },
        { type: "stack", width: 1, height: 36, backgroundColor: "#FFFFFF22" },
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 3,
          children: [
            {
              type: "image",
              src: "sf-symbol:aqi.medium",
              color: aqiColor,
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: aqiVal,
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF",
            },
            {
              type: "text",
              text: aqiCategory || "AQI",
              font: { size: "caption2" },
              textColor: "#FFFFFF66",
              maxLines: 1,
            },
          ],
        },
        { type: "stack", width: 1, height: 36, backgroundColor: "#FFFFFF22" },
        {
          type: "stack",
          direction: "column",
          alignItems: "center",
          flex: 1,
          gap: 3,
          children: [
            {
              type: "image",
              src: "sf-symbol:eye.fill",
              color: "#FFE680",
              width: 16,
              height: 16,
            },
            {
              type: "text",
              text: `${now.vis}km`,
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF",
            },
            {
              type: "text",
              text: "能见度",
              font: { size: "caption2" },
              textColor: "#FFFFFF66",
            },
          ],
        },
      ],
    },
  ];

  // Large 额外追加降水 & 气压卡片
  if (isLarge) {
    mainChildren.push(
      { type: "spacer", length: 12 },
      {
        type: "stack",
        direction: "row",
        gap: 8,
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            flex: 1,
            gap: 6,
            backgroundColor: "#FFFFFF12",
            borderRadius: 10,
            padding: [8, 10, 8, 10],
            children: [
              {
                type: "image",
                src: "sf-symbol:cloud.rain.fill",
                color: "#AADEFC",
                width: 18,
                height: 18,
              },
              {
                type: "stack",
                direction: "column",
                gap: 1,
                children: [
                  {
                    type: "text",
                    text: `${now.precip} mm`,
                    font: { size: "footnote", weight: "semibold" },
                    textColor: "#FFFFFF",
                  },
                  {
                    type: "text",
                    text: "过去1小时降水",
                    font: { size: "caption2" },
                    textColor: "#FFFFFF66",
                  },
                ],
              },
            ],
          },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            flex: 1,
            gap: 6,
            backgroundColor: "#FFFFFF12",
            borderRadius: 10,
            padding: [8, 10, 8, 10],
            children: [
              {
                type: "image",
                src: "sf-symbol:gauge.medium",
                color: "#FFE680",
                width: 18,
                height: 18,
              },
              {
                type: "stack",
                direction: "column",
                gap: 1,
                children: [
                  {
                    type: "text",
                    text: `${now.pressure} hPa`,
                    font: { size: "footnote", weight: "semibold" },
                    textColor: "#FFFFFF",
                  },
                  {
                    type: "text",
                    text: "大气压强",
                    font: { size: "caption2" },
                    textColor: "#FFFFFF66",
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: "spacer", length: 8 },
      {
        type: "stack",
        direction: "row",
        gap: 8,
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            flex: 1,
            gap: 6,
            backgroundColor: "#FFFFFF12",
            borderRadius: 10,
            padding: [8, 10, 8, 10],
            children: [
              {
                type: "image",
                src: "sf-symbol:cloud.fill",
                color: "#AADEFC",
                width: 18,
                height: 18,
              },
              {
                type: "stack",
                direction: "column",
                gap: 1,
                children: [
                  {
                    type: "text",
                    text: now.cloud != null && now.cloud !== "" ? `${now.cloud}%` : "—",
                    font: { size: "footnote", weight: "semibold" },
                    textColor: "#FFFFFF",
                  },
                  {
                    type: "text",
                    text: "云量",
                    font: { size: "caption2" },
                    textColor: "#FFFFFF66",
                  },
                ],
              },
            ],
          },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            flex: 1,
            gap: 6,
            backgroundColor: "#FFFFFF12",
            borderRadius: 10,
            padding: [8, 10, 8, 10],
            children: [
              {
                type: "image",
                src: "sf-symbol:thermometer.medium",
                color: "#A8F0C0",
                width: 18,
                height: 18,
              },
              {
                type: "stack",
                direction: "column",
                gap: 1,
                children: [
                  {
                    type: "text",
                    text: now.dew != null && now.dew !== "" ? `${now.dew}°` : "—",
                    font: { size: "footnote", weight: "semibold" },
                    textColor: "#FFFFFF",
                  },
                  {
                    type: "text",
                    text: "露点温度",
                    font: { size: "caption2" },
                    textColor: "#FFFFFF66",
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: "spacer" },
      {
        type: "text",
        text: "数据来源：和风天气",
        font: { size: "caption2" },
        textColor: "#FFFFFF44",
        textAlign: "right",
      }
    );
  }

  return {
    type: "widget",
    refreshAfter: refreshTime,
    backgroundGradient: {
      type: "linear",
      colors: [
        { light: "#2E86C1", dark: "#0D1F3C" },
        { light: "#5DADE2", dark: "#112844" },
        { light: "#85C1E9", dark: "#163352" },
      ],
      stops: [0, 0.5, 1],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 0, y: 1 },
    },
    padding: 16,
    gap: 0,
    children: mainChildren,
  };
}