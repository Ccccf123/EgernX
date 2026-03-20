/**
 * 🌤️ 和风天气 - Egern 小组件（缓存 5 小时 + 中间区域居中显示）
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

  // 缓存配置
  const CACHE_KEY = 'weather_cache_v1';
  const CACHE_TTL = 5 * 60 * 60 * 1000; // 5 小时

  try {
    const nowTime = Date.now();
    let data;

    // 读取缓存
    const cache = ctx.storage.getJSON(CACHE_KEY);

    if (cache && (nowTime - cache.time < CACHE_TTL)) {
      data = cache.data; // 命中缓存
    } else {
      // 缓存过期才请求
      const { lon, lat, city } = await getLocation(ctx, location, apiKey, apiHost);
      const now = await fetchWeatherNow(ctx, apiKey, lon, lat, apiHost);

      let air = null;
      if (widgetFamily !== 'systemSmall' && !isAccessoryFamily(widgetFamily)) {
        air = await fetchAirQuality(ctx, apiKey, lon, lat, apiHost);
      }

      data = { now, air, city };

      // 写入缓存
      ctx.storage.setJSON(CACHE_KEY, { time: nowTime, data });
    }

    const { now, air, city } = data;

    if (isAccessoryFamily(widgetFamily)) {
      return renderAccessoryCompact(now, city);
    }

    if (widgetFamily === 'systemSmall') {
      return renderSmall(now, city, BG_GRADIENT, C_TEXT, C_SUB);
    } else {
      return renderMedium(now, air, city, BG_GRADIENT, C_TEXT, C_SUB);
    }

  } catch (e) {
    console.error(e);
    return renderError(`请求失败：${e.message.slice(0,60)}`);
  }
}

// ────────────── 常量与辅助函数 ──────────────
const BG_GRADIENT = { 
  type: "linear", 
  colors: [{ light: '#FFFFFF', dark: '#1C1C1E' }, { light: '#F4F5F9', dark: '#000000' }],
  startPoint: { x: 0, y: 0 }, 
  endPoint: { x: 1, y: 1 } 
};
const C_TEXT = { light: '#000000', dark: '#FFFFFF' };
const C_SUB  = { light: '#8E8E93', dark: '#AEAEB2' };

function normalizeHost(host) {
  let h = host;
  if (!/^https?:\/\//i.test(h)) h = 'https://' + host;
  return h.replace(/\/+$/, '');
}

function isAccessoryFamily(family) {
  return family.startsWith('accessory');
}

// ────────────── 数据请求 ──────────────
async function getLocation(ctx, locName, key, host) {
  const presets = { '北京': { lon: '116.4074', lat: '39.9042' }, '上海': { lon: '121.4737', lat: '31.2304' } };
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
  if (data.code !== '200') throw new Error(data.msg || `状态码 ${data.code}`);
  const now = data.now;
  return { temp: now.temp, text: now.text, icon: now.icon, humidity: now.humidity, windDir: now.windDir||'--', windScale: now.windScale||'--', windSpeed: now.windSpeed||'--' };
}

async function fetchAirQuality(ctx, key, lon, lat, host) {
  let aqiData = null;
  try {
    const url = `${host}/airquality/v1/current/${lat}/${lon}?key=${key}&lang=zh`;
    const resp = await ctx.http.get(url, { timeout: 7000 });
    const data = await resp.json();
    if (data.indexes && data.indexes.length > 0) {
      const cnMee = data.indexes.find(i=>i.code==='cn-mee') || data.indexes[0];
      if(cnMee?.aqi!=null) aqiData = { aqi: Math.round(Number(cnMee.aqi)), category: cnMee.category || getAQICategory(cnMee.aqi).text, color: getAQICategory(cnMee.aqi).color };
    }
  } catch(e){}
  if(!aqiData){
    try {
      const url = `${host}/v7/air/now?location=${lon},${lat}&key=${key}&lang=zh`;
      const resp = await ctx.http.get(url, { timeout: 7000 });
      const data = await resp.json();
      if(data.code==='200' && data.now?.aqi){
        const val = Number(data.now.aqi);
        aqiData = { aqi: Math.round(val), category: data.now.category || getAQICategory(val).text, color: getAQICategory(val).color };
      }
    } catch {}
  }
  return aqiData || { aqi:'--', category:'--', color:{light:'#999', dark:'#888'} };
}

function getAQICategory(val){
  const n = Number(val);
  if(isNaN(n)) return { text:'--', color:{light:'#999999', dark:'#888888'} };
  if(n<=50) return { text:'优', color:{light:'#4CD964', dark:'#34C759'} };
  if(n<=100) return { text:'良', color:{light:'#FFCC00', dark:'#FF9F0A'} };
  return { text:'污染', color:{light:'#FF3B30', dark:'#FF453A'} };
}

function getWeatherIcon(code){ const map={'100':'sun.max.fill','101':'cloud.sun.fill','102':'cloud.fill','104':'cloud.fill','305':'cloud.rain.fill'}; return map[code]||'cloud.fill'; }
function getWeatherColor(code){ const n=Number(code); if(n>=100&&n<=104)return {light:'#FF9500', dark:'#FFB340'}; return {light:'#007AFF', dark:'#0A84FF'}; }

// ────────────── 渲染函数 ──────────────
function renderMedium(now, air, city, BG, C_T, C_S) {
  const icon = getWeatherIcon(now.icon);
  const iconColor = getWeatherColor(now.icon);
  const time = new Date();
  const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2,'0')}`;

  return {
    type: 'widget',
    padding: 16,
    backgroundGradient: BG,
    children: [
      { // 城市 + AQI + 时间
        type:'stack', direction:'row', alignItems:'center', children:[
          { type:'stack', direction:'row', alignItems:'center', gap:4, children:[
            { type:'image', src:'sf-symbol:location.fill', width:12, height:12, color:{ light:'#FF3B30', dark:'#FF453A' } },
            { type:'text', text:city, font:{size:'footnote', weight:'bold'}, textColor:C_T }
          ] },
          { type:'spacer' },
          { type:'text', text:`AQI ${air?.aqi||'--'}`, font:{size:'caption2', weight:'semibold'}, textColor:air?.color||C_SUB },
          { type:'spacer', length:6 },
          { type:'text', text:timeStr, font:{size:'caption2'}, textColor:C_SUB }
        ]
      },

      // 大幅上移中间行到组件中间
      { type:'spacer', flex:1 },

      { // 中间天气信息
        type:'stack', direction:'row', alignItems:'center', gap:12, children:[
          { type:'image', src:`sf-symbol:${icon}`, width:44, height:44, color:iconColor },
          { type:'stack', direction:'column', flex:1, children:[
            { type:'text', text:`${now.temp}°C`, font:{size:'title2', weight:'bold'}, textColor:C_T },
            { type:'text', text:now.text, font:{size:'footnote'}, textColor:C_T }
          ] },
          { type:'text', text:air?.category||'--', font:{size:'footnote', weight:'bold'}, textColor:air?.color||C_SUB }
        ]
      },

      { type:'spacer', flex:1 }, // 让中间行居中

      { // 底部三项沉底
        type:'stack', direction:'row', children:[
          createCompactItem('drop.fill', `${now.humidity}%`, '#007AFF', C_T),
          { type:'spacer' },
          createCompactItem('wind', `${now.windScale}级`, '#5856D6', C_T),
          { type:'spacer' },
          createCompactItem('gauge.medium', `${now.windSpeed}km/h`, '#FF9500', C_T)
        ]
      }
    ]
  };
}

function createCompactItem(icon, value, iconColor, C_T){
  return {
    type:'stack', direction:'row', alignItems:'center', gap:6, children:[
      { type:'image', src:`sf-symbol:${icon}`, width:16, height:16, color:{ light:iconColor, dark:iconColor } },
      { type:'text', text:value, font:{size:'footnote', weight:'semibold'}, textColor:C_T }
    ]
  };
}

function renderSmall(now, city, BG, C_T, C_S){
  return {
    type:'widget',
    padding:14,
    backgroundGradient:BG,
    children:[
      { type:'text', text:city, font:{size:'caption1', weight:'bold'}, textColor:C_T },
      { type:'spacer' },
      { type:'stack', direction:'row', alignItems:'center', gap:10, children:[
        { type:'image', src:`sf-symbol:${getWeatherIcon(now.icon)}`, width:40, height:40, color:getWeatherColor(now.icon) },
        { type:'text', text:`${now.temp}°`, font:{size:'title2', weight:'bold'}, textColor:C_T }
      ] }
    ]
  };
}

function renderAccessoryCompact(now, city){
  return { type:'widget', children:[{ type:'text', text:`${now.temp}° ${city.slice(0,4)}` }] };
}

function renderError(msg){
  return { type:'widget', padding:16, children:[{ type:'text', text:msg, textColor:{light:'#FF3B30', dark:'#FF453A'} }] };
}