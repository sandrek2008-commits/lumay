export const BASIC = [
  ['exposure','Exposición',-4,4,0,.01],['brightness','Brillo',-100,100,0],['contrast','Contraste',-100,100,0],
  ['highlights','Altas luces',-100,100,0],['shadows','Sombras',-100,100,0],['whites','Blancos',-100,100,0],['blacks','Negros',-100,100,0],
  ['temperature','Calidez',-100,100,0],['tint','Matiz',-100,100,0],['saturation','Saturación',-100,100,0],['vibrance','Intensidad',-100,100,0],
  ['clarity','Claridad',-100,100,0],['sharpness','Nitidez',0,100,0],['structure','Estructura',-100,100,0],['vignette','Viñeta',-100,100,0],
  ['blur','Desenfoque',0,100,0],['grain','Grano',0,100,0],['grainSize','Tamaño del grano',1,12,2],['roughness','Rugosidad',0,100,50]
];
export const COLORS=['Rojos','Naranjas','Amarillos','Verdes','Cianes','Azules','Púrpuras','Magentas'];
export const HUES=[0,30,60,120,180,225,270,315];
export const BLENDS=['source-over','multiply','screen','overlay','soft-light','hard-light','color-dodge','color-burn','darken','lighten','difference','exclusion'];
export const BLEND_NAMES=['Normal','Multiplicar','Trama','Superponer','Luz suave','Luz fuerte','Sobreexponer color','Subexponer color','Oscurecer','Aclarar','Diferencia','Exclusión'];
export const RATIOS=['Libre','1:1','4:5','3:4','9:16','16:9','2:3','3:2','5:4','4:3'];
export const FILTERS=[
  ['original','Original','Original',{}],['noir','Noir','Blanco y negro',{saturation:-100,contrast:32,blacks:-9}],['amber','Ámbar','Cine',{temperature:41,saturation:-16,shadows:12,contrast:15}],['alpine','Alpino','Naturaleza',{temperature:-24,saturation:23,clarity:20}],['faded','Mate','Retro / Vintage',{contrast:-27,blacks:19,saturation:-21,temperature:14}],['silver','Plata','Editorial',{saturation:-78,temperature:-13,highlights:20,contrast:16}],
  ['35mm','35 mm','Película analógica',{grain:40,contrast:15,saturation:9,temperature:17}],['copper','Cobre','Urbano',{temperature:29,saturation:-26,contrast:28,shadows:-9}],['soft','Luz suave','Retrato',{contrast:-13,shadows:18,temperature:8,clarity:-16}],['dusk','Crepúsculo','Cine',{temperature:-30,tint:32,contrast:7,blacks:-13}],['forest','Bosque','Naturaleza',{saturation:25,vibrance:30,tint:-20,whites:-18}],['mono','Alto contraste','Blanco y negro',{saturation:-100,contrast:55}],
  ['ember','Brasa','Cine',{temperature:31,contrast:25,shadows:-14,saturation:-10}],
  ['mist','Niebla azul','Editorial',{temperature:-29,contrast:-25,blacks:13,highlights:-17}],
  ['sepia','Sepia','Retro / Vintage',{temperature:53,saturation:-65,blacks:9,contrast:7}],
  ['jade','Jade','Naturaleza',{tint:-29,temperature:-7,vibrance:24,shadows:9}],
  ['chalk','Tiza','Blanco y negro',{saturation:-100,exposure:.3,contrast:-10,whites:23}],
  ['chrome','Cromo','Película analógica',{saturation:29,contrast:31,grain:12,highlights:-16}],
  ['velvet','Terciopelo','Retrato',{saturation:-18,shadows:17,clarity:-25,temperature:16}],
  ['neon','Medianoche','Urbano',{tint:23,temperature:-34,vibrance:41,blacks:-20}]
];
export const defaults=()=>Object.fromEntries(BASIC.map(([key,,,,value])=>[key,value]));
export function colorState(){
  return {basic:defaults(),blurType:'gaussian',curves:Array.from({length:4},()=>[[0,0],[1,1]]),
    hsl:Array.from({length:8},()=>[0,0,0]),grade:Array.from({length:3},()=>[0,0,0]),balance:0,
    filter:'original',filterMix:100,lut:null,lutMix:100};
}
export const identityTransform=()=>({crop:[0,0,1,1],rotation:0,flipX:false,flipY:false,skewX:0,skewY:0,ratio:'Libre'});
export const frameDefaults=()=>({style:'none',color:'#e8ded2',width:5,radius:0,edges:[1,1,1,1]});
export function makeProject(source){
  return {source,color:colorState(),transform:identityTransform(),frame:frameDefaults(),layers:[],strokes:[],mesh:null,effects:[],collage:null};
}
export function makeLayer(type,label,data){
  return {id:crypto.randomUUID(),type,label,visible:true,locked:false,opacity:100,blend:'source-over',x:.5,y:.5,scale:1,rotation:0,...data};
}
export const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
export class History{
  constructor(){this.past=[];this.future=[];this.snapshots=[];this.state=null}
  open(state){this.past=[];this.future=[];this.snapshots=[];this.state=state}
  replace(state){this.state=state}
  commit(state,previous=this.state){
    if(state===previous)return;
    this.past.push(previous);this.future=[];this.state=state;
  }
  undo(){if(this.past.length){this.future.push(this.state);this.state=this.past.pop()}}
  redo(){if(this.future.length){this.past.push(this.state);this.state=this.future.pop()}}
  snapshot(name){this.snapshots.push({name,state:this.state})}
}
export function effectiveBasic(state){
  const filtered=FILTERS.find(([id])=>id===state.filter)?.[3]??{};
  return Object.fromEntries(BASIC.map(([id,,lo,hi])=>[id,clamp(state.basic[id]+(filtered[id]??0)*state.filterMix/100,lo,hi)]));
}
export function readCube(text){
  let size=0,min=[0,0,0],max=[1,1,1];
  const values=[];
  for(const line of text.split(/\r?\n/)){
    const fields=line.split('#')[0].trim().split(/\s+/);
    if(!fields[0]||fields[0]==='TITLE')continue;
    if(fields[0]==='LUT_3D_SIZE'){size=Number(fields[1]);continue}
    if(fields[0]==='DOMAIN_MIN'){min=fields.slice(1).map(Number);continue}
    if(fields[0]==='DOMAIN_MAX'){max=fields.slice(1).map(Number);continue}
    if(fields.length!==3||fields.some(field=>!Number.isFinite(Number(field))))throw new Error('Se requiere un archivo .cube 3D válido.');
    values.push(...fields.map(Number));
  }
  if(!Number.isInteger(size)||size<2||size>128||values.length!==size**3*3||min.length!==3||max.length!==3||min.some((v,i)=>!Number.isFinite(v)||!Number.isFinite(max[i])||v>=max[i]))throw new Error('Tablas LUT o dominios inválidos.');
  return {size,min,max,values};
}
export function curveTables(curves){
  return curves.map(nodes=>{
    let i=1;
    const slopes=nodes.slice(1).map(([x,y],n)=>(y-nodes[n][1])/(x-nodes[n][0]));
    const tangents=nodes.map((_,n)=>{
      if(n===0)return slopes[0];
      if(n===nodes.length-1)return slopes[n-1];
      const a=slopes[n-1],b=slopes[n];
      return a*b>0?2*a*b/(a+b):0;
    });
    return Array.from({length:256},(_,n)=>{
      const x=n/255;
      while(i<nodes.length-1&&x>nodes[i][0])i++;
      const [ax,ay]=nodes[i-1],[bx,by]=nodes[i],d=bx-ax,t=clamp((x-ax)/d),q=t*t,r=q*t;
      return clamp((2*r-3*q+1)*ay+(r-2*q+t)*d*tangents[i-1]+(-2*r+3*q)*by+(r-q)*d*tangents[i]);
    });
  });
}
export function ratioCrop(w,h,ratio){
  if(ratio==='Libre')return [0,0,1,1];
  const [x,y]=ratio.split(':').map(Number),aspect=x/y;
  const cw=Math.min(1,h*aspect/w),ch=Math.min(1,w/aspect/h);
  return [(1-cw)/2,(1-ch)/2,cw,ch];
}

export const meshGrid=()=>Array.from({length:25},(_,i)=>[(i%5)/4,Math.floor(i/5)/4]);
