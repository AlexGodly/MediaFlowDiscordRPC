(() => {
 'use strict';
 if (window.__MEDIAFLOW_RPC_CATALOG_V20__) return;
 window.__MEDIAFLOW_RPC_CATALOG_V20__=true;
 const IS_PLUS=location.pathname.startsWith('/MediaFlowPlus/');
 const edition=IS_PLUS?'plus':'personal';
 const MAX=120000,CHUNK=250;
 let lastSignature='',syncing=false;
 const clean=(v,n=200)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
 const message=(type,payload={})=>chrome.runtime.sendMessage({type:'MEDIAFLOW_RPC_CATALOG_'+type,edition,payload}).catch(()=>({ok:false}));
 const validUrl=url=>/^https:\/\/[^\s]+$/i.test(url)?url:'';
 function catalogFromSnapshot(){
  if(IS_PLUS)return null; // Never accidentally copy a Personal snapshot to Plus on github.io
  let best=null,newest=0;
  const candidates=[];
  try{
   const legacy=localStorage.getItem('mf_cloud_cache_v1');if(legacy)candidates.push(legacy);
   for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key?.startsWith('mf_cloud_cache_v2_'))continue;
    const value=localStorage.getItem(key);if(value)candidates.push(value);
   }
  }catch{return null;}
  for(const raw of candidates){
   try{
    const wrapped=JSON.parse(raw);
    const state=wrapped?.__mediaflowCacheV2===1?wrapped.state:wrapped;
    if(!Array.isArray(state?.library))continue;
    const at=Number(wrapped.cachedAt||state.savedAt||0);
    if(at>=newest){best=state;newest=at;}
   }catch{}
  }
  if(!best)return null;
  return {source:'Personal account snapshot',rows:best.library,signature:String(newest)+'-'+best.library.length};
 }
 function catalogFromDOM(){
  const root=document.getElementById('view-root')||document.body;
  const nodes=[...root.querySelectorAll('[data-title-id], .lib-card, .library-card, .media-cover, .cover-card, .title-card, .lib-row')].slice(0,MAX);
  const rows=[];
  for(const el of nodes){
   const label=clean(el.getAttribute('data-title')||el.querySelector('.title-name,.cover-title,.lib-title,.media-title,.card-title')?.textContent||
    el.querySelector('img')?.alt||'',240);
   if(!label)continue;
   const img=el.querySelector('img');
   rows.push({id:clean(el.getAttribute('data-title-id')||el.getAttribute('data-id')||'',128),
     title:label,cover:validUrl(img?.currentSrc||img?.src||''),
     category:clean(el.getAttribute('data-category')||'',90),
     status:clean(el.getAttribute('data-status')||'',60)});
  }
  return {source:'Visible page only (partial)',rows,signature:String(rows.length)+'-'+location.pathname};
 }
 function normalize(item){
  if(!item||typeof item!=='object')return null;
  const title=clean(item.title||item.name,240);
  if(!title)return null;
  return {id:clean(item.id,128),title,
   cover:validUrl(clean(item.coverUrl||item.cover||item.posterUrl||item.poster||item.image||'',2048)),
   category:clean(item.category||item.categoryName,90),
   status:clean(item.status,60),
   progress:Number(item.progress)||0,total:Number(item.total)||0};
 }
 async function sync(){
  if(syncing||document.hidden)return;
  const policy=await message('POLICY');
  if(!policy?.enabled)return;
  const source=catalogFromSnapshot()||catalogFromDOM();
  if(!source||!source.rows.length)return;
  const siteVersion=clean(document.querySelector('meta[name="mediaflow-version"]')?.content,20)||'unknown';
  const signature=[edition,siteVersion,source.signature,source.source].join(':');
  if(signature===lastSignature)return;
  syncing=true;
  try{
   const rows=source.rows.slice(0,MAX).map(normalize).filter(Boolean);
   const batchId=String(Date.now())+'-'+Math.random().toString(36).slice(2);
   let answer=await message('BEGIN',{batchId,total:rows.length,siteVersion,source:source.source});
   if(!answer?.ok)return;
   for(let offset=0;offset<rows.length;offset+=CHUNK){
    answer=await message('CHUNK',{batchId,offset,items:rows.slice(offset,offset+CHUNK)});
    if(!answer?.ok)return;
   }
   answer=await message('END',{batchId});
   if(answer?.ok)lastSignature=signature;
  }finally{syncing=false;}
 }
 setTimeout(()=>sync().catch(()=>{}),4000);
 setInterval(()=>sync().catch(()=>{}),120000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync().catch(()=>{});});
})();