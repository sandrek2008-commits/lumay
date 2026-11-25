import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASIC,History,colorState,curveTables,effectiveBasic,makeProject,ratioCrop,readCube } from '../dist/model.mjs';
import { crc32,keepExif,zip } from '../dist/files.mjs';
import { normalizePreset } from '../dist/presets.mjs';
import { transformedSize } from '../dist/render.mjs';

test('los 19 controles usan sus valores iniciales y la curva maestra es identidad',()=>{
  const neutral=colorState();
  for(const [id,,,,initial] of BASIC)assert.equal(effectiveBasic(neutral)[id],initial);
  assert.deepEqual(curveTables(neutral.curves)[0].map(v=>Math.round(v*255)),Array.from({length:256},(_,i)=>i));
});
test('historial agrupa la edición en curso y retiene un snapshot independiente',()=>{
  const h=new History(),initial=makeProject('photo');
  h.open(initial);h.snapshot('Inicio');
  h.replace({...initial,color:{...initial.color,filter:'noir'}});
  h.commit(h.state,initial);
  h.undo();assert.equal(h.state,initial);
  h.redo();assert.equal(h.state.color.filter,'noir');
  assert.equal(h.snapshots[0].state.color.filter,'original');
  h.undo();h.commit({...initial,color:{...initial.color,filter:'amber'}});
  assert.equal(h.future.length,0);
});
test('recorte y giros conservan la proporción de salida',()=>{
  const t=makeProject('image').transform;
  assert.deepEqual(ratioCrop(1200,800,'1:1'),[(1-2/3)/2,0,2/3,1]);
  assert.deepEqual(transformedSize(1200,800,{...t,rotation:90}),[800,1200]);
  assert.deepEqual(transformedSize(1200,800,{...t,crop:[0,0,.5,1]}),[600,800]);
});
test('LUT y presets validan el esquema',()=>{
  const cube='LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1';
  const lut=readCube(cube),color=colorState();
  assert.equal(lut.values.length,24);assert.throws(()=>readCube(cube+'\n1 0 0'));
  color.basic.exposure=15;color.lut=lut;
  const p=normalizePreset({version:1,name:'Paisaje',tags:['cálido'],color});
  assert.equal(p.color.basic.exposure,4);assert.deepEqual(p.tags,['cálido']);assert.equal(p.color.lut.size,2);
  assert.throws(()=>normalizePreset({version:2,name:'Paisaje',color}));
});
const jpeg=(...parts)=>new Blob([new Uint8Array([255,216]),...parts,new Uint8Array([255,217])],{type:'image/jpeg'});
function exifSegment(){
  const tiff=new Uint8Array(8+2+12+4),v=new DataView(tiff.buffer);
  tiff.set([73,73,42,0]);v.setUint32(4,8,true);v.setUint16(8,1,true);
  v.setUint16(10,274,true);v.setUint16(12,3,true);v.setUint32(14,1,true);v.setUint16(18,6,true);
  return [new Uint8Array([255,225,0,tiff.length+8,69,120,105,102,0,0]),tiff];
}
test('EXIF normaliza orientación y puede escribirse en JPEG, PNG y WebP',async()=>{
  const source=jpeg(...exifSegment()),result=await keepExif(jpeg(),source,640,480);
  assert.equal(result.retained,true);
  let data=await result.blob.arrayBuffer();
  assert.equal(new DataView(data).getUint16(30,true),1);
  const png=new Blob([new Uint8Array(33)],{type:'image/png'}),encoded=await keepExif(png,source,1,1);
  data=new Uint8Array(await encoded.blob.arrayBuffer());
  assert.equal(String.fromCharCode(...data.slice(37,41)),'eXIf');
  assert.equal(new DataView(data.buffer).getUint32(data.length-4),crc32(data.slice(37,-4)));
  const riff=new Uint8Array([82,73,70,70,14,0,0,0,87,69,66,80,86,80,56,76,1,0,0,0,47,0]);
  const webp=await keepExif(new Blob([riff],{type:'image/webp'}),source,320,200);
  const resultBytes=new Uint8Array(await webp.blob.arrayBuffer());
  assert.equal(String.fromCharCode(...resultBytes.slice(12,16)),'VP8X');
  assert.equal(resultBytes[20]&8,8);
  assert.equal((await keepExif(jpeg(),jpeg(),1,1)).retained,false);
});
test('ZIP escribe nombres UTF-8, CRC y directorio central',async()=>{
  const blob=await zip([{name:'foto-á.txt',blob:new Blob(['123456789'])}]);
  const bytes=new Uint8Array(await blob.arrayBuffer()),v=new DataView(bytes.buffer);
  assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint16(6,true),0x800);
  assert.equal(v.getUint32(14,true),0xcbf43926);
  assert.equal(v.getUint32(bytes.length-22,true),0x06054b50);
  assert.equal(new TextDecoder().decode(bytes.slice(30,30+v.getUint16(26,true))),'foto-á.txt');
});
