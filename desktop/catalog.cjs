'use strict';
// Privacy-first catalogue. Stores display metadata only; never credentials,
// notes, account tokens, history, or raw recovery snapshots.
const fs=require('node:fs'),path=require('node:path');
const LIMIT=120000,CHUNK=250,MAX_BYTES=2*1024*1024;
const string=(s,n)=>String(s??'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,n);
function normalize(item){
 if(!item||typeof item!=='object')return null;
 const title=string(item.title,240);if(!title)return null;
 const url=string(item.cover||'',2048);
 return {id:string(item.id,128),title,cover:/^https:\/\/[^\s]+$/i.test(url)?url:'',
  category:string(item.category,90),status:string(item.status,60),
  progress:Number.isFinite(Number(item.progress))?Number(item.progress):0,
  total:Number.isFinite(Number(item.total))?Number(item.total):0};
}
class Catalog{
 constructor(directory){this.dir=directory;this.list={personal:[],plus:[]};this.meta={personal:null,plus:null};this.pending=new Map();this.load();}
 load(){for(const ed of ['personal','plus']){try{
  const data=JSON.parse(fs.readFileSync(path.join(this.dir,ed+'.json'),'utf8'));
  if(Array.isArray(data.titles)){this.list[ed]=data.titles.slice(0,LIMIT).map(normalize).filter(Boolean);
  this.meta[ed]={at:data.at,siteVersion:data.siteVersion,count:this.list[ed].length,source:data.source||'cache'};}
 }catch{}}}
 begin(req){
  if(!['personal','plus'].includes(req.edition))throw Error('Unknown edition');
  const expected=Math.trunc(Number(req.total));if(!Number.isFinite(expected)||expected<0||expected>LIMIT)throw Error('Invalid catalogue size');
  const id=string(req.batchId,100);
  if(!/^[a-z0-9-]{8,100}$/i.test(id))throw Error('Invalid batch ID');
  this.pending.set(req.edition,{id,total:expected,items:[],at:Date.now(),siteVersion:string(req.siteVersion,30),source:string(req.source,30)});
  return {ok:true,batchId:id};
 }
 chunk(req){
  const p=this.pending.get(req.edition);
  if(!p||p.id!==req.batchId)throw Error('No matching active catalogue transfer');
  if(Date.now()-p.at>180000){this.pending.delete(req.edition);throw Error('Transfer expired');}
  if(!Array.isArray(req.items)||req.items.length>CHUNK)throw Error('Invalid chunk size');
  if(req.offset!==p.items.length)throw Error('Out-of-order chunk');
  const clean=req.items.map(normalize).filter(Boolean);
  if(p.items.length+clean.length>p.total)throw Error('Too many catalogue items');
  p.items.push(...clean);
  return {ok:true,received:p.items.length,expected:p.total};
 }
 finish(req){
  const p=this.pending.get(req.edition);
  if(!p||p.id!==req.batchId)throw Error('No matching catalogue transfer');
  if(p.items.length!==p.total)throw Error('Incomplete transfer: '+p.items.length+'/'+p.total);
  const unique=new Map();for(const item of p.items)unique.set(item.id||item.title.toLowerCase(),item);
  const titles=[...unique.values()];
  this.list[req.edition]=titles;this.meta[req.edition]={at:Date.now(),siteVersion:p.siteVersion,count:titles.length,source:p.source};
  this.pending.delete(req.edition);
  this.persist(req.edition);
  return {ok:true,count:titles.length};
 }
 import(edition,records,source='MediaFlow export'){
  if(!['personal','plus'].includes(edition))throw Error('Invalid edition');
  if(!Array.isArray(records)||records.length>LIMIT)throw Error('Invalid import size');
  const unique=new Map();
  for(const raw of records){const x=normalize(raw);if(x)unique.set(x.id||x.title.toLocaleLowerCase(),x);}
  const titles=[...unique.values()];
  this.list[edition]=titles;
  this.meta[edition]={at:Date.now(),siteVersion:'imported',count:titles.length,source:String(source).slice(0,100)};
  this.pending.delete(edition);this.persist(edition);return {ok:true,count:titles.length,edition,source:this.meta[edition].source};
 }
 persist(edition){
  fs.mkdirSync(this.dir,{recursive:true});
  const target=path.join(this.dir,edition+'.json'),tmp=target+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify({...this.meta[edition],titles:this.list[edition]}),'utf8');
  fs.renameSync(tmp,target);
 }
 search(options={}){
  const edition=['personal','plus'].includes(options.edition)?options.edition:'personal';
  const q=string(options.query,120).toLocaleLowerCase();
  const category=string(options.category,90).toLowerCase(),status=string(options.status,60).toLowerCase();
  const offset=Math.max(0,Math.trunc(Number(options.offset)||0));
  const limit=Math.min(100,Math.max(1,Math.trunc(Number(options.limit)||36)));
  const rows=this.list[edition].filter(x=>(!q||x.title.toLocaleLowerCase().includes(q))&&(!category||x.category.toLowerCase()===category)&&(!status||x.status.toLowerCase()===status));
  const categories=[...new Set(this.list[edition].map(x=>x.category).filter(Boolean))].sort();
  const statuses=[...new Set(this.list[edition].map(x=>x.status).filter(Boolean))].sort();
  return {edition,items:rows.slice(offset,offset+limit),total:rows.length,offset,limit,
   catalogCount:this.list[edition].length,meta:this.meta[edition],categories,statuses};
 }
 clear(edition){
  if(!['personal','plus'].includes(edition))throw Error('Invalid edition');
  this.pending.delete(edition);this.list[edition]=[];this.meta[edition]=null;
  try{fs.unlinkSync(path.join(this.dir,edition+'.json'));}catch{}return {ok:true};
 }
}
module.exports={Catalog,LIMIT,CHUNK,MAX_BYTES,normalize};