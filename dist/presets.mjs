import { BASIC,FILTERS,clamp,colorState,frameDefaults } from './model.mjs';

const number=(v,min,max,initial=0)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,min,max):initial;
const text=(v,limit)=>typeof v==='string'?v.trim().slice(0,limit):'';
export function normalizePreset(raw){
  if(!raw||typeof raw!=='object'||raw.version!==1||!raw.color||!text(raw.name,120))throw new Error('Este JSON no es un preset Lumay v1.');
  const color=colorState(),f=frameDefaults(),r=raw.color;
  color.basic=Object.fromEntries(BASIC.map(([key,,lo,hi,initial])=>[key,number(r.basic?.[key],lo,hi,initial)]));
  color.blurType=['gaussian','lens','radial'].includes(r.blurType)?r.blurType:'gaussian';
  if(Array.isArray(r.curves))color.curves=color.curves.map((base,i)=>{
    const row=r.curves[i];
    if(!Array.isArray(row)||row.length<2||row.length>20)return base;
    const n=row.map(point=>Array.isArray(point)?point.slice(0,2).map(v=>number(v,0,1,NaN)):[NaN,NaN]);
    return n[0][0]===0&&n.at(-1)[0]===1&&n.every(([x,y],i)=>Number.isFinite(y)&&(!i||x-n[i-1][0]>=.01))?n:base;
  });
  color.hsl=color.hsl.map((row,i)=>row.map((_,j)=>number(r.hsl?.[i]?.[j],j===0?-180:-100,j===0?180:100)));
  color.grade=color.grade.map((row,i)=>row.map((_,j)=>number(r.grade?.[i]?.[j],j===2?-100:0,j===0?360:100)));
  color.balance=number(r.balance,-100,100);
  color.filter=FILTERS.some(([id])=>id===r.filter)?r.filter:'original';
  color.filterMix=number(r.filterMix,0,100,100);
  color.lutMix=number(r.lutMix,0,100,100);
  const lut=r.lut;
  if(lut){
    if(!Number.isInteger(lut.size)||lut.size<2||lut.size>128||!Array.isArray(lut.values)||lut.values.length!==lut.size**3*3||!lut.values.every(Number.isFinite)||
      !Array.isArray(lut.min)||!Array.isArray(lut.max)||lut.min.length!==3||lut.max.length!==3||
      !lut.min.every((v,i)=>Number.isFinite(v)&&Number.isFinite(lut.max[i])&&v<lut.max[i]))throw new Error('La LUT incluida en el preset es inválida.');
    color.lut={size:lut.size,values:lut.values,min:lut.min,max:lut.max,name:text(lut.name,160)};
  }
  const b=raw.frame??{};
  f.style=['solid','blur','polaroid'].includes(b.style)?b.style:'none';
  f.color=typeof b.color==='string'&&/^#[0-9a-f]{6}$/i.test(b.color)?b.color:f.color;
  f.width=number(b.width,0,21,5);f.radius=number(b.radius,0,48);
  f.edges=f.edges.map((_,i)=>number(b.edges?.[i],0,1.5,1));
  return {id:crypto.randomUUID(),version:1,name:text(raw.name,120),tags:Array.isArray(raw.tags)?raw.tags.slice(0,25).map(tag=>text(tag,40)).filter(Boolean):[],color,frame:f};
}
export function presetDatabase(){
  return new Promise((resolve,reject)=>{
    // Preserve the existing storage key so saved presets survive the rename.
    const open=indexedDB.open('hypic-studio',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('presets',{keyPath:'id'});
    open.onsuccess=()=>resolve(open.result);
    open.onerror=()=>reject(new Error('No se pudo abrir la biblioteca local de presets.'));
  });
}
export async function presetOp(operation,value){
  const db=await presetDatabase();
  return new Promise((resolve,reject)=>{
    const write=operation!=='getAll';
    const tx=db.transaction('presets',write?'readwrite':'readonly');
    const store=tx.objectStore('presets'),req=store[operation](...(write?[value]:[]));
    tx.oncomplete=()=>{db.close();resolve(req.result)};
    tx.onabort=()=>{db.close();reject(new Error('La biblioteca local no pudo guardar el cambio.'))};
  });
}
