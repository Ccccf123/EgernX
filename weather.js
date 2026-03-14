/**
 * 🌤️ 和风天气 - Egern 小组件
 * 修复 + 稳定优化版
 */

export default async function(ctx) {

  const env = ctx.env || {}
  const widgetFamily = ctx.widgetFamily || "systemMedium"

  const apiKey = env.KEY
  const location = env.LOCATION || "北京"
  const apiHost = env.API_HOST

  if (!apiKey) return renderError("⚠️ 请配置 KEY")
  if (!apiHost) return renderError("⚠️ 请配置 API_HOST")

  try {

    const host = normalizeHost(apiHost)

    const { lon, lat, city } = await getLocation(ctx, location, apiKey, host)

    const now = await fetchWeatherNow(ctx, apiKey, lon, lat, host)

    let air = null

    if (widgetFamily !== "systemSmall") {
      air = await fetchAirQuality(ctx, apiKey, lon, lat, host)
    }

    if (widgetFamily === "systemSmall") {
      return renderSmall(now, city)
    }

    return renderMedium(now, air, city)

  } catch (e) {

    return renderError(`❌ ${e.message}`)

  }

}

/* HOST */

function normalizeHost(host) {

  let h = (host || "").trim()

  if (!h.startsWith("http")) {
    h = "https://" + h
  }

  return h.replace(/\/$/, "")

}

/* 城市 */

async function getLocation(ctx, location, apiKey, apiHost) {

  const preset = {
    北京:{lon:"116.4074",lat:"39.9042"},
    上海:{lon:"121.4737",lat:"31.2304"}
  }

  const cityName = location || "北京"

  if (preset[cityName]) {
    return { ...preset[cityName], city: cityName }
  }

  try {

    const url = `${apiHost}/geo/v2/city/lookup?location=${encodeURIComponent(cityName)}&key=${apiKey}&number=1&lang=zh`

    const r = await ctx.http.get(url)

    const j = await r.json()

    if (j.code == 200 || j.code === "200" || j.code === "ok") {

      const loc = j.location?.[0]

      if (loc) {
        return {
          lon: loc.lon,
          lat: loc.lat,
          city: loc.name
        }
      }

    }

  } catch(e){}

  return { lon:"116.4074",lat:"39.9042",city:cityName }

}

/* 当前天气 */

async function fetchWeatherNow(ctx,key,lon,lat,apiHost){

  const url=`${apiHost}/v7/weather/now?location=${lon},${lat}&key=${key}&lang=zh`

  const r=await ctx.http.get(url)

  const j=await r.json()

  if(!(j.code==200||j.code==="200"||j.code==="ok")){
    throw new Error("天气获取失败")
  }

  const n=j.now

  return{
    temp:Number(n.temp),
    text:n.text,
    icon:n.icon,
    humidity:Number(n.humidity),
    windDir:n.windDir,
    windScale:n.windScale,
    windSpeed:Number(n.windSpeed)
  }

}

/* 空气质量 */

async function fetchAirQuality(ctx,key,lon,lat,apiHost){

  let aqi=null

  let categoryText="--"

  let categoryColor={light:"#999",dark:"#888"}

  try{

    const url=`${apiHost}/airquality/v1/current/${lat}/${lon}?key=${key}&lang=zh`

    const r=await ctx.http.get(url)

    const j=await r.json()

    if(j.code==200||j.code==="200"||j.code==="ok"){

      const info=j.indexes?.[0]

      if(info?.aqi!=null){

        aqi=Number(info.aqi)

        const c=getAQICategory(aqi)

        categoryText=c.text
        categoryColor=c.color

      }

    }

  }catch(e){}

  if(aqi!=null){

    return{
      aqi:Math.round(aqi),
      category:{text:categoryText,color:categoryColor}
    }

  }

  return{
    aqi:"--",
    category:{text:"--",color:categoryColor}
  }

}

/* AQI分类 */

function getAQICategory(aqi){

  const num=parseInt(aqi)

  if(isNaN(num))
    return{text:"--",color:{light:"#999",dark:"#888"}}

  if(num<=50)
    return{text:"优",color:{light:"#30D158",dark:"#34C759"}}

  if(num<=100)
    return{text:"良",color:{light:"#FF9500",dark:"#FF9F0A"}}

  if(num<=150)
    return{text:"轻度",color:{light:"#FF6B35",dark:"#FF7A3E"}}

  if(num<=200)
    return{text:"中度",color:{light:"#FF3B30",dark:"#FF453A"}}

  if(num<=300)
    return{text:"重度",color:{light:"#AF52DE",dark:"#BF5AF2"}}

  return{text:"严重",color:{light:"#7E3C9E",dark:"#8E5FC9"}}

}

/* 天气图标 */

function getWeatherIcon(code){

  const map={

    "100":"sun.max.fill",
    "101":"cloud.sun.fill",
    "102":"cloud.fill",
    "103":"cloud.sun.fill",
    "104":"cloud.fill",

    "300":"cloud.rain.fill",

    "400":"cloud.snow.fill",

    "500":"cloud.fog.fill",

    "153":"cloud.fog.fill",
    "154":"cloud.fog.fill",

    "800":"wind",

    "999":"exclamationmark.triangle.fill"

  }

  return map[code]||"cloud.fill"

}

/* 小组件 SMALL */

function renderSmall(now,city){

  const icon=getWeatherIcon(now.icon)

  const wind=Math.round(now.windSpeed*3.6)

  return{

    type:"widget",

    backgroundColor:{light:"#FFFFFF",dark:"#1C1C1E"},

    children:[

      {type:"text",text:city},

      {
        type:"image",
        src:`sf-symbol:${icon}`,
        width:40,
        height:40
      },

      {type:"text",text:`${now.temp}°`},

      {type:"text",text:now.text},

      {type:"text",text:`风速 ${wind}km/h`}

    ]

  }

}

/* MEDIUM */

function renderMedium(now,air,city){

  const icon=getWeatherIcon(now.icon)

  const wind=Math.round(now.windSpeed*3.6)

  return{

    type:"widget",

    backgroundColor:{light:"#FFFFFF",dark:"#1C1C1E"},

    children:[

      {type:"text",text:city},

      {
        type:"image",
        src:`sf-symbol:${icon}`,
        width:56,
        height:56
      },

      {type:"text",text:`${now.temp}°C`},

      {type:"text",text:now.text},

      {
        type:"text",
        text:`AQI ${air?.aqi||"--"} • ${air?.category.text||"--"}`,
        textColor:air?.category.color
      },

      {type:"text",text:`湿度 ${now.humidity}%`},

      {type:"text",text:`风力 ${now.windDir} ${now.windScale}级`},

      {type:"text",text:`风速 ${wind}km/h`}

    ]

  }

}

/* 错误 */

function renderError(msg){

  return{

    type:"widget",

    backgroundColor:{light:"#fff",dark:"#1C1C1E"},

    children:[

      {
        type:"text",
        text:msg,
        textAlign:"center"
      }

    ]

  }

}