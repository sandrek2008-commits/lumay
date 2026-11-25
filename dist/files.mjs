export async function decode(file){
  try{return await createImageBitmap(file,{imageOrientation:'from-image'})}
  catch(error){
    const url=URL.createObjectURL(file),img=new Image();
    try{img.src=url;await img.decode();return img}
    finally{URL.revokeObjectURL(url)}
  }
}
export const safeName=name=>(name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|\x00-\x1f]+/g,'-').trim()||'lumay');
export function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function encode(canvas,type,quality){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(!blob)return reject(new Error('El navegador no pudo codificar estas dimensiones.'));
      if(blob.type!==type)return reject(new Error('Este navegador no exporta el formato seleccionado.'));
      resolve(blob);
    },type,quality);
  });
}
const word=(data,start,count=4)=>String.fromCharCode(...data.slice(start,start+count));
const pngHeader=[137,80,78,71,13,10,26,10];
const exifHeader=new Uint8Array([69,120,105,102,0,0]);
const bytes=text=>new TextEncoder().encode(text);
function findExif(data){
  if(data[0]===255&&data[1]===216){
    for(let i=2;data[i]===255&&i+4<data.length;){
      const marker=data[i+1],size=data[i+2]*256+data[i+3];
      if(marker===0xda||marker===0xd9||size<2||i+size+2>data.length)break;
      if(marker===0xe1&&word(data,i+4,6)==='Exif\0\0')return data.slice(i+10,i+size+2);
      i+=size+2;
    }
  }else if(pngHeader.every((value,i)=>data[i]===value)){
    const view=new DataView(data.buffer,data.byteOffset,data.length);
    for(let i=8;i+12<=data.length;){
      const size=view.getUint32(i),end=i+12+size;
      if(end>data.length)break;
      if(word(data,i+4)==='eXIf')return data.slice(i+8,end-4);
      i=end;
    }
  }else if(word(data,0)==='RIFF'&&word(data,8)==='WEBP'){
    const view=new DataView(data.buffer,data.byteOffset,data.length);
    for(let i=12;i+8<=data.length;){
      const size=view.getUint32(i+4,true),end=i+8+size;
      if(end>data.length)break;
      if(word(data,i)==='EXIF')return data.slice(i+8+(word(data,i+8,6)==='Exif\0\0'?6:0),end);
      i=end+(size%2);
    }
  }
  return null;
}
function normalizeTiff(data,w,h){
  const view=new DataView(data.buffer,data.byteOffset,data.length),order=view.getUint16(0),le=order===0x4949;
  if((!le&&order!==0x4d4d)||view.getUint16(2,le)!==42)return false;
  const main=view.getUint32(4,le);
  let sub;
  const apply=offset=>{
    const count=view.getUint16(offset,le);
    if(offset+2+count*12+4>data.length)throw new Error('EXIF inválido');
    for(let i=0;i<count;i++){
      const p=offset+2+i*12,tag=view.getUint16(p,le),type=view.getUint16(p+2,le);
      if(view.getUint32(p+4,le)!==1)continue;
      if(tag===0x8769&&type===4)sub=view.getUint32(p+8,le);
      const value=({274:1,256:w,257:h,40962:w,40963:h})[tag];
      if(value===undefined)continue;
      if(type===3&&value<=65535)view.setUint16(p+8,value,le);
      else if(type===4||type===3){view.setUint16(p+2,4,le);view.setUint32(p+8,value,le)}
    }
    return offset+2+count*12;
  };
  view.setUint32(apply(main),0,le);
  if(sub&&sub!==main)apply(sub);
  return true;
}
function riffChunk(name,data){
  const head=new Uint8Array(8);head.set(bytes(name));
  new DataView(head.buffer).setUint32(4,data.length,true);
  return new Blob(data.length%2?[head,data,new Uint8Array(1)]:[head,data]);
}
async function addWebpExif(blob,exif,w,h){
  const header=new Uint8Array(await blob.slice(0,30).arrayBuffer());
  if(word(header,0)!=='RIFF'||word(header,8)!=='WEBP')return null;
  let hasAlpha=word(header,12)==='VP8L'&&Boolean(header[24]&16);
  let tail=blob.slice(12),extended=new Uint8Array(10);
  if(word(header,12)==='VP8X'){
    extended=header.slice(20,30);tail=blob.slice(30);hasAlpha=Boolean(extended[0]&16);
  }
  extended[0]|=8+(hasAlpha?16:0);
  for(let i=0;i<3;i++){extended[4+i]=(w-1)>>(i*8);extended[7+i]=(h-1)>>(i*8)}
  const ext=riffChunk('VP8X',extended),meta=riffChunk('EXIF',exif),head=new Uint8Array(12);
  head.set(bytes('RIFF'));head.set(bytes('WEBP'),8);
  new DataView(head.buffer).setUint32(4,4+ext.size+tail.size+meta.size,true);
  return new Blob([head,ext,tail,meta],{type:blob.type});
}
export async function keepExif(blob,source,width,height){
  if(!source)return {blob,retained:false};
  try{
    const data=new Uint8Array(await source.arrayBuffer()),exif=findExif(data);
    if(!exif||!normalizeTiff(exif,width,height))return {blob,retained:false};
    if(blob.type==='image/jpeg'){
      const size=exif.length+8;
      if(size>65535)return {blob,retained:false};
      const marker=new Uint8Array([255,225,size>>8,size&255]);
      return {blob:new Blob([blob.slice(0,2),marker,exifHeader,exif,blob.slice(2)],{type:blob.type}),retained:true};
    }
    if(blob.type==='image/png'){
      const chunk=new Uint8Array(exif.length+12),view=new DataView(chunk.buffer);
      view.setUint32(0,exif.length);chunk.set(bytes('eXIf'),4);chunk.set(exif,8);view.setUint32(chunk.length-4,crc32(chunk.subarray(4,-4)));
      return {blob:new Blob([blob.slice(0,33),chunk,blob.slice(33)],{type:blob.type}),retained:true};
    }
    const webp=await addWebpExif(blob,exif,width,height);
    if(webp)return {blob:webp,retained:true};
  }catch{ /* Malformed metadata does not invalidate the encoded image. */ }
  return {blob,retained:false};
}
const crcTable=Uint32Array.from({length:256},(_,i)=>{
  for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;
  return i>>>0;
});
export function crc32(bytes){
  let crc=0xffffffff;
  for(const n of bytes)crc=crcTable[(crc^n)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
export async function zip(files){
  if(files.length>65535)throw new Error('Demasiados archivos para un ZIP estándar.');
  const parts=[],central=[];
  const block=n=>{const data=new Uint8Array(n);return [data,new DataView(data.buffer)]};
  let offset=0,centralSize=0;
  for(const file of files){
    const name=new TextEncoder().encode(file.name),size=file.blob.size;
    if(offset+size+name.length+30>0xffffffff)throw new Error('El lote supera el tamaño de un ZIP estándar.');
    const crc=crc32(new Uint8Array(await file.blob.arrayBuffer())),[local,v]=block(30),[entry,c]=block(46);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);
    v.setUint32(14,crc,true);v.setUint32(18,size,true);v.setUint32(22,size,true);v.setUint16(26,name.length,true);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);
    c.setUint32(16,crc,true);c.setUint32(20,size,true);c.setUint32(24,size,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
    parts.push(local,name,file.blob);central.push(entry,name);centralSize+=entry.length+name.length;offset+=local.length+name.length+size;
  }
  if(offset+centralSize+22>0xffffffff)throw new Error('El lote supera el tamaño de un ZIP estándar.');
  const [end,e]=block(22);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
  e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
