import { GradePipeline } from './color.mjs';
import { clamp,meshGrid } from './model.mjs';

export const canvas=(width=1,height=1)=>Object.assign(document.createElement('canvas'),{width,height});
const sized=(c,w,h)=>{c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c.getContext('2d')};
export const STROKES=[
 ['mesh','Malla de puntos'],['paint','Pintar'],['erase','Borrar'],['mask','Ocultar con máscara'],['unmask','Revelar máscara'],['clone','Clonar'],['heal','Corrección de textura'],['smooth','Suavizar'],
 ['dodge','Iluminar'],['tone','Corregir tono'],['whiten','Aclarar tono dental'],['push','Empujar'],['inflate','Expandir'],['pinch','Contraer'],
 ['stretch-x','Estirar horizontal'],['stretch-y','Estirar vertical'],['squeeze-x','Comprimir horizontal'],['squeeze-y','Comprimir vertical'],
 ['clockwise','Remolino horario'],['reverse','Remolino antihorario'],['restore','Restaurar'],['rubor','Rubor'],['contour','Contorno'],
 ['highlight','Iluminador'],['shadow','Sombra de ojos'],['liner','Delineado / pestañas'],['brows','Cejas'],['lip','Labial']
];
export const BRUSH_DEFAULT={type:'paint',size:6,hardness:35,opacity:70,flow:65,strength:55,smoothing:25,edge:true,direction:'free',color:'#b47d79'};
const AXIS_WARP=['stretch-x','stretch-y','squeeze-x','squeeze-y'];
const WARP=['push','inflate','pinch','clockwise','reverse',...AXIS_WARP];
const PAINT=['paint','erase','mask','unmask','tone','rubor','contour','highlight','shadow','liner','brows','lip'];
function radialDab(ctx,x,y,r,brush,color){
  const gradient=ctx.createRadialGradient(x,y,r*brush.hardness/105,x,y,r);
  gradient.addColorStop(0,color);gradient.addColorStop(1,'transparent');
  ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
}
function pixelBrush(ctx,original,source,x,y,r,brush,delta,anchor){
  const w=ctx.canvas.width,h=ctx.canvas.height;
  const x0=Math.max(0,Math.floor(x-r)),y0=Math.max(0,Math.floor(y-r));
  const x1=Math.min(w,Math.ceil(x+r)),y1=Math.min(h,Math.ceil(y+r));
  if(x1<=x0||y1<=y0)return;
  const {type}=brush,warp=WARP.includes(type),directional=AXIS_WARP.includes(type);
  const needsSample=warp||type==='heal'||type==='smooth';
  const margin=Math.ceil(r*.52)+4,xs=Math.max(0,x0-margin),ys=Math.max(0,y0-margin);
  const sample=needsSample?ctx.getImageData(xs,ys,Math.min(w,x1+margin)-xs,Math.min(h,y1+margin)-ys):null;
  const data=ctx.getImageData(x0,y0,x1-x0,y1-y0);
  const strength=brush.strength/100,opacity=brush.opacity*brush.flow/10000;
  const smoothRadius=Math.max(1,Math.round(r*.14*strength));
  const from=type==='restore'?original.getImageData(x0,y0,data.width,data.height):null;
  const at=(sx,sy,c)=>{
    const a=clamp(sx-xs,0,sample.width-1),b=clamp(sy-ys,0,sample.height-1),u=Math.floor(a),v=Math.floor(b);
    const u1=Math.min(u+1,sample.width-1),v1=Math.min(v+1,sample.height-1),dx=a-u,dy=b-v;
    const top=sample.data[(v*sample.width+u)*4+c]*(1-dx)+sample.data[(v*sample.width+u1)*4+c]*dx;
    const bottom=sample.data[(v1*sample.width+u)*4+c]*(1-dx)+sample.data[(v1*sample.width+u1)*4+c]*dx;
    return top*(1-dy)+bottom*dy;
  };
  const area=(sx,sy,c)=>(at(sx,sy,c)+at(sx+smoothRadius,sy,c)+at(sx-smoothRadius,sy,c)+at(sx,sy+smoothRadius,c)+at(sx,sy-smoothRadius,c))/5;
  const offset=anchor??[0,0];
  const cloneX=clamp(x0+offset[0],0,w-data.width),cloneY=clamp(y0+offset[1],0,h-data.height);
  const clone=['clone','heal'].includes(type)?source.getImageData(cloneX,cloneY,data.width,data.height):null;
  const radius2=r*r;
  for(let j=0;j<data.height;j++)for(let i=0;i<data.width;i++){
    const xx=x0+i,yy=y0+j;
    const dx=xx-x,dy=yy-y,d2=dx*dx+dy*dy;
    if(d2>=radius2)continue;
    const d=Math.sqrt(d2/radius2);
    const edge=brush.protectEdges&&warp?clamp(Math.min(xx,yy,w-1-xx,h-1-yy)/Math.max(1,r*.48)):1;
    const f=clamp((1-d)/(1-brush.hardness/105))**2*edge;
    const p=(j*data.width+i)*4;
    let sx=xx,sy=yy;
    if(type==='push'){
      if(brush.direction!=='y')sx-=delta[0]*f*strength;
      if(brush.direction!=='x')sy-=delta[1]*f*strength;
    }
    if(directional){
      const shift=(type.startsWith('stretch')?-1:1)*f*strength*.31;
      if(type.endsWith('-x'))sx+=dx*shift;else sy+=dy*shift;
    }
    if(type==='inflate'||type==='pinch'){
      const s=(type==='inflate'?-1:1)*f*strength*.32;
      sx+=dx*s;sy+=dy*s;
    }
    if(type==='clockwise'||type==='reverse'){
      const t=(type==='clockwise'?-1:1)*f*strength*.45;
      sx=x+dx*Math.cos(t)-dy*Math.sin(t);sy=y+dx*Math.sin(t)+dy*Math.cos(t);
    }
    const mix=warp?opacity:opacity*f;
    const lum=type==='whiten'?data.data[p]*.2126+data.data[p+1]*.7152+data.data[p+2]*.0722:0;
    for(let c=0;c<4;c++){
      const old=data.data[p+c];
      let value=old;
      if(warp)value=at(sx,sy,c);
      else if(type==='restore')value=from.data[p+c];
      else if(type==='clone')value=clone.data[p+c];
      else if(type==='heal'&&c<3){
        const next=(j*data.width+Math.min(i+2,data.width-1))*4+c,prev=(j*data.width+Math.max(0,i-2))*4+c;
        value=area(xx,yy,c)+clone.data[p+c]-(clone.data[next]+clone.data[prev]+clone.data[p+c])/3;
      }else if(type==='smooth'&&c<3)value=area(xx,yy,c);
      else if(type==='dodge'&&c<3)value=old+(255-old)*strength*.3;
      else if(type==='whiten'&&c<3)value=old+(lum-old)*strength*.8+(255-lum)*strength*.26;
      data.data[p+c]=old+(value-old)*mix;
    }
  }
  ctx.putImageData(data,x0,y0);
}
function trace(stroke,w,h,apply){
  const {points,brush}=stroke;
  if(!points.length)return;
  const r=Math.max(1,brush.size/200*Math.min(w,h));
  const first=points[0];
  apply(first[0]*w,first[1]*h,0,0,first[2],r);
  for(let k=1;k<points.length;k++){
    const [ax,ay]=points[k-1],[bx,by,p]=points[k],dx=(bx-ax)*w,dy=(by-ay)*h;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(1,r*.34)));
    for(let q=1;q<=steps;q++)apply(ax*w+dx*q/steps,ay*h+dy*q/steps,dx/steps,dy/steps,p,r);
  }
}
function drawStrokes(original,strokes,layers,target){
  const ctx=target.getContext('2d',{willReadFrequently:true}),backup=original.getContext('2d',{willReadFrequently:true});
  const w=target.width,h=target.height;
  for(const layer of layers){
    if(!layer.visible||!layer.opacity)continue;
    for(const stroke of strokes){
      const {brush,points}=stroke;
      if(stroke.layer!==layer.id||PAINT.includes(brush.type)||!points.length)continue;
      const offset=stroke.anchor?[Math.round((stroke.anchor[0]-points[0][0])*w),Math.round((stroke.anchor[1]-points[0][1])*h)]:null;
      let source=backup;
      if(brush.type==='clone'||brush.type==='heal'){
        const copy=canvas(w,h);
        source=copy.getContext('2d',{willReadFrequently:true});source.drawImage(target,0,0);
      }
      trace(stroke,w,h,(x,y,dx,dy,pressure,r)=>{
        const active={...brush,opacity:brush.opacity*pressure*layer.opacity/100};
        pixelBrush(ctx,backup,source,x,y,r,active,[dx,dy],offset);
      });
    }
  }
}
function paintLayer(strokes,w,h){
  const painting=canvas(w,h),paint=painting.getContext('2d');
  let mask;
  for(const stroke of strokes){
    const {brush}=stroke;
    let ctx=paint;
    if(brush.type==='mask'||brush.type==='unmask'){
      mask??=canvas(w,h);
      ctx=mask.getContext('2d');
    }
    ctx.globalCompositeOperation=['erase','unmask'].includes(brush.type)?'destination-out':'source-over';
    trace(stroke,w,h,(x,y,_dx,_dy,pressure,r)=>{
      ctx.globalAlpha=brush.opacity*brush.flow*pressure/10000;
      radialDab(ctx,x,y,r,brush,brush.color);
    });
  }
  if(mask){
    paint.globalAlpha=1;paint.globalCompositeOperation='destination-out';paint.drawImage(mask,0,0);
  }
  return painting;
}
function warpMesh(ctx,mesh){
  const w=ctx.canvas.width,h=ctx.canvas.height;
  const ref=ctx.getImageData(0,0,w,h),out=ctx.createImageData(w,h),start=meshGrid();
  out.data.set(ref.data);
  const paintTriangle=(ia,ib,ic)=>{
    const [i,j,k]=[ia,ib,ic], [a,b,c]=[mesh[i],mesh[j],mesh[k]].map(([x,y])=>[x*(w-1),y*(h-1)]);
    const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    if(Math.abs(det)<1e-8)return;
    const x0=Math.floor(Math.min(a[0],b[0],c[0])),x1=Math.ceil(Math.max(a[0],b[0],c[0]));
    const y0=Math.floor(Math.min(a[1],b[1],c[1])),y1=Math.ceil(Math.max(a[1],b[1],c[1]));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const v=((x-a[0])*(c[1]-a[1])-(y-a[1])*(c[0]-a[0]))/det;
      const z=((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]))/det,u=1-v-z;
      if(Math.min(u,v,z)<-1e-6)continue;
      const sx=clamp((start[i][0]*u+start[j][0]*v+start[k][0]*z)*(w-1),0,w-1);
      const sy=clamp((start[i][1]*u+start[j][1]*v+start[k][1]*z)*(h-1),0,h-1);
      const xx=Math.floor(sx),yy=Math.floor(sy),dx=sx-xx,dy=sy-yy;
      const startRow=(yy*w+xx)*4,nextRow=(Math.min(h-1,yy+1)*w+xx)*4,nextCol=xx<w-1?4:0;
      const p=(y*w+x)*4;
      for(let channel=0;channel<4;channel++){
        const top=ref.data[startRow+channel]*(1-dx)+ref.data[startRow+nextCol+channel]*dx;
        const bottom=ref.data[nextRow+channel]*(1-dx)+ref.data[nextRow+nextCol+channel]*dx;
        out.data[p+channel]=top*(1-dy)+bottom*dy;
      }
    }
  };
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const i=y*5+x;paintTriangle(i,i+1,i+5);paintTriangle(i+6,i+5,i+1);
  }
  ctx.putImageData(out,0,0);
}
function cover(ctx,img,x,y,w,h){
  const scale=Math.max(w/img.width,h/img.height);
  const sw=w/scale,sh=h/scale;
  ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);
}
function shiftChannels(ctx,fx,w,h){
  const pixels=ctx.getImageData(0,0,w,h),out=canvas(w,h),dest=out.getContext('2d'),shifted=dest.createImageData(w,h);
  const angle=fx.rotation*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle);
  const distance=Math.max(w,h)*.023*fx.scale,radial=fx.type==='aberration';
  const at=(x,y,c)=>pixels.data[(clamp(Math.round(x),0,w-1)+clamp(Math.round(y),0,h-1)*w)*4+c];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const px=x/w-fx.x,py=y/h-fx.y,axis=py*ca-px*sa;
    const p=(y*w+x)*4;
    const d=radial?distance*Math.hypot(px,py):fx.type==='glitch'?distance*Math.sin(Math.floor(axis*83)*89.71):distance*(px*ca+py*sa);
    const dx=d*(radial?px*2:ca),dy=d*(radial?py*2:sa);
    shifted.data[p]=at(x+dx,y+dy,0);
    shifted.data[p+1]=pixels.data[p+1];
    shifted.data[p+2]=at(x-dx,y-dy,2);
    shifted.data[p+3]=pixels.data[p+3];
  }
  dest.putImageData(shifted,0,0);ctx.save();
  ctx.globalAlpha=fx.opacity/100;ctx.globalCompositeOperation=fx.blend;ctx.drawImage(out,0,0);ctx.restore();
}
function overlay(ctx,fx,w,h){
  if(!fx.opacity)return;
  if(['glitch','aberration','lateral'].includes(fx.type)){shiftChannels(ctx,fx,w,h);return}
  ctx.save();
  ctx.translate(w*fx.x,h*fx.y);ctx.rotate(fx.rotation*Math.PI/180);
  const d=Math.max(w,h)*fx.scale;
  ctx.globalAlpha=fx.opacity/100;ctx.globalCompositeOperation=fx.blend;
  if(['leak','halo'].includes(fx.type)){
    const g=ctx.createRadialGradient(0,0,0,0,0,d*.6);
    g.addColorStop(0,fx.type==='leak'?'#ffa058':'transparent');
    g.addColorStop(.47,fx.type==='leak'?'#e7613264':'#ffe7b4ad');
    g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-d,-d,2*d,2*d);
  }else if(fx.type==='gobo'){
    ctx.fillStyle='#020204a0';
    for(let i=-8;i<=8;i++)ctx.fillRect(i*d/8,-2*d,d*.055,4*d);
  }else if(fx.type==='prism'){
    const gradient=ctx.createLinearGradient(-d*.33,0,d*.33,0);
    for(const [at,color] of [[0,'#ff382500'],[.23,'#ff544893'],[.42,'#ffc05378'],[.56,'#71ffac75'],[.72,'#8c84ff7c'],[1,'#541cff00']])gradient.addColorStop(at,color);
    ctx.fillStyle=gradient;ctx.fillRect(-d*.33,-d*2,d*.66,d*4);
  }else if(fx.type==='vapor'){
    const gradient=ctx.createLinearGradient(0,-d*.45,0,d*.45);
    gradient.addColorStop(0,'#babde000');gradient.addColorStop(.5,'#dde6f2a0');gradient.addColorStop(1,'#f5c6af00');
    ctx.fillStyle=gradient;ctx.fillRect(-d*2,-d*.45,d*4,d*.9);
  }else if(fx.type==='scanlines'){
    ctx.fillStyle='#1416259e';const pitch=Math.max(3,d/115);
    for(let y=-d*2;y<d*2;y+=pitch)ctx.fillRect(-d*2,y,d*4,pitch*.38);
  }else if(fx.type==='bokeh'){
    const spots=[[-.36,-.18,.078],[-.19,.29,.047],[.16,-.28,.059],[.38,.16,.10],[.02,.08,.045],[-.31,.37,.061]];
    spots.forEach(([x,y,r],i)=>{
      const cx=x*d,cy=y*d,radius=r*d;
      const gradient=ctx.createRadialGradient(cx,cy,radius*.56,cx,cy,radius);
      gradient.addColorStop(0,i%2?'#ffe3b981':'#f7c28198');gradient.addColorStop(1,'#f9bca000');
      ctx.fillStyle=gradient;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
    });
  }else{
    let seed=9407;
    const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    const count=fx.type==='paper'?3500:170;
    for(let i=0;i<count;i++){
      const x=(rnd()-.5)*d*3,y=(rnd()-.5)*d*3;
      const radius=(rnd()+.2)*d/(fx.type==='paper'?520:330);
      ctx.fillStyle=rnd()>.48?'#fff6e780':'#130a065c';
      ctx.fillRect(x,y,radius,fx.type==='dust'&&i%15===0?radius*25:radius);
    }
  }
  ctx.restore();
}
function textLayer(ctx,layer,w,h){
  const size=Math.min(w,h)*layer.size/100;
  ctx.font=[layer.italic?'italic':'normal',layer.bold?'700':'400',size+'px',layer.font].join(' ');
  ctx.textBaseline='middle';ctx.textAlign=layer.align;
  ctx.letterSpacing=(layer.spacing*size/100)+'px';
  const lines=layer.text.split('\n'),height=size*layer.leading/100;
  let gradient=layer.color;
  if(layer.gradient){
    gradient=ctx.createLinearGradient(-size*2,-size,size*2,size);gradient.addColorStop(0,layer.color);gradient.addColorStop(1,layer.secondary);
  }
  const width=Math.max(...lines.map(line=>ctx.measureText(line).width));
  const offset=layer.align==='left'?0:layer.align==='right'?-width:-width/2;
  if(layer.box&&width){
    ctx.fillStyle=layer.secondary;ctx.beginPath();ctx.roundRect(offset-size*.2,-lines.length*height/2-size*.12,width+size*.4,lines.length*height+size*.24,size*.2);ctx.fill();
  }
  if(layer.shadow){ctx.shadowColor='#000a';ctx.shadowOffsetY=size*.08;ctx.shadowBlur=size*.11}
  ctx.fillStyle=gradient;ctx.strokeStyle=layer.secondary;ctx.lineWidth=size*layer.stroke/100;ctx.lineJoin='round';
  lines.forEach((line,i)=>{
    const y=(i-(lines.length-1)/2)*height;
    if(!layer.arc){if(layer.stroke)ctx.strokeText(line,0,y);ctx.fillText(line,0,y);return}
    const chars=Array.from(line), total=ctx.measureText(line).width,curve=layer.arc*Math.PI/180;
    const radius=Math.max(size,Math.abs(total/curve)),sign=Math.sign(curve);
    let advance=-total/2;
    ctx.textAlign='center';
    for(const char of chars){
      const width=ctx.measureText(char).width,angle=(advance+width/2)/radius;
      ctx.save();ctx.translate(Math.sin(angle)*radius,y+sign*(1-Math.cos(angle))*radius);ctx.rotate(angle*sign);
      if(layer.stroke)ctx.strokeText(char,0,0);
      ctx.fillText(char,0,0);ctx.restore();advance+=width;
    }
  });
}
function graphic(ctx,layer,assets,w,h){
  if(!layer.visible||layer.type==='paint')return;
  ctx.save();
  ctx.translate(layer.x*w,layer.y*h);ctx.rotate(layer.rotation*Math.PI/180);ctx.scale(layer.scale,layer.scale);
  ctx.globalAlpha=layer.opacity/100;ctx.globalCompositeOperation=layer.blend;
  if(layer.type==='text')textLayer(ctx,layer,w,h);
  else if(layer.type==='image'){
    const image=assets.get(layer.asset)?.image;
    if(image){
      const s=.8*Math.min(w/image.width,h/image.height),ww=image.width*s,hh=image.height*s;
      ctx.drawImage(image,-ww/2,-hh/2,ww,hh);
    }
  }else if(layer.type==='shape'){
    const r=Math.min(w,h)*.17;
    ctx.fillStyle=layer.color;ctx.strokeStyle=layer.secondary;ctx.lineWidth=r*layer.stroke/100;ctx.beginPath();
    if(layer.shape==='circle')ctx.arc(0,0,r,0,Math.PI*2);
    else if(layer.shape==='rect')ctx.roundRect(-r,-r*.7,r*2,r*1.4,r*.11);
    else{
      const paths={line:[[-1,0],[1,0]],arrow:[[-1,-.2],[.28,-.2],[.28,-.65],[1,0],[.28,.65],[.28,.2],[-1,.2]],polygon:[[-1,.45],[-.6,-.85],[.6,-.85],[1,.45],[0,1]],star:[[0,-1],[.27,-.3],[.98,-.3],[.42,.15],[.63,.9],[0,.48],[-.63,.9],[-.42,.15],[-.98,-.3],[-.27,-.3]],heart:[[0,.9],[-.95,-.05],[-.95,-.55],[-.58,-.9],[0,-.52],[.58,-.9],[.95,-.55],[.95,-.05]]};
      paths[layer.shape].forEach(([x,y],i)=>i?ctx.lineTo(x*r,y*r):ctx.moveTo(x*r,y*r));
      if(layer.shape!=='line')ctx.closePath();
    }
    if(layer.shape==='line'){ctx.strokeStyle=layer.color;ctx.lineWidth=Math.max(1,ctx.lineWidth);ctx.stroke()}
    else {ctx.fill();if(layer.stroke)ctx.stroke()}
  }
  ctx.restore();
}
export function transformedSize(w,h,t){
  const [, ,cw,ch]=t.crop,angle=t.rotation*Math.PI/180;
  const x=w*cw,y=h*ch,a=Math.abs(Math.cos(angle)),b=Math.abs(Math.sin(angle));
  return [Math.max(1,Math.round(x*a+y*b)),Math.max(1,Math.round(y*a+x*b))];
}
function perspective(ctx,img,sx,sy,sw,sh,kx,ky) {
  if(!kx&&!ky){ctx.drawImage(img,sx,sy,sw,sh,-sw/2,-sh/2,sw,sh);return}
  const divisions=16;
  const position=(x,y)=> {
    const z=1+(x-.5)*kx/90+(y-.5)*ky/90;
    return [(x-.5)*sw/z,(y-.5)*sh/z];
  };
  const triangle=(points,uv)=>{
    const [a,b,c]=points,[[u,v],[s],[,t]]=uv;
    const dx=s-u,dy=t-v;
    const ex=(b[0]-a[0])/dx,ey=(b[1]-a[1])/dx,fx=(c[0]-a[0])/dy,fy=(c[1]-a[1])/dy;
    ctx.save();ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...c);ctx.closePath();ctx.clip();
    ctx.transform(ex,ey,fx,fy,a[0]-ex*u-fx*v,a[1]-ey*u-fy*v);
    ctx.drawImage(img,sx,sy,sw,sh,0,0,1,1);ctx.restore();
  };
  for(let y=0;y<divisions;y++)for(let x=0;x<divisions;x++){
    const u=x/divisions,v=y/divisions,s=(x+1)/divisions,t=(y+1)/divisions;
    const a=position(u,v),b=position(s,v),c=position(u,t),d=position(s,t);
    triangle([a,b,c],[[u,v],[s,v],[u,t]]);
    triangle([d,c,b],[[s,t],[u,t],[s,v]]);
  }
}
function frameImage(ctx,image,frame,w,h){
  if(frame.style==='none'){ctx.drawImage(image,0,0,w,h);return}
  const n=Math.min(w,h)*frame.width/100;
  const [top,right,bottom,left]=frame.edges.map((v,i)=>n*v*(frame.style==='polaroid'&&i===2?2.2:1));
  const bw=Math.max(1,w-left-right),bh=Math.max(1,h-top-bottom);
  ctx.fillStyle=frame.color;ctx.fillRect(0,0,w,h);
  if(frame.style==='blur'){ctx.filter='blur('+Math.max(w,h)*.022+'px)';ctx.drawImage(image,-n,-n,w+2*n,h+2*n);ctx.filter='none'}
  ctx.save();ctx.beginPath();ctx.roundRect(left,top,bw,bh,Math.min(bw,bh)*frame.radius/100);ctx.clip();
  ctx.drawImage(image,left,top,bw,bh);ctx.restore();
}

export class Renderer{
  constructor(assets){
    this.assets=assets;this.pipeline=new GradePipeline();this.base=canvas();this.raster=canvas();this.graded=canvas();this.geometry=canvas();
  }
  layout(state){
    const asset=this.assets.get(state.source);
    if(!asset)throw new Error('Abre una imagen.');
    if(state.collage){
      const [a,b]=state.collage.ratio.split(':').map(Number);
      const edge=Math.max(asset.image.width,asset.image.height);
      return [Math.round(edge*Math.min(1,a/b)),Math.round(edge*Math.min(1,b/a))];
    }
    return [asset.image.width,asset.image.height];
  }
  draw(state,target,{limit=Infinity,dimensions,original=false}={}){
    const asset=this.assets.get(state.source),image=asset.image;
    const [width,height]=this.layout(state);
    const scale=Math.min(1,limit/Math.max(width,height));
    const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
    const t=state.transform;
    const [tw,th]=transformedSize(w,h,t);
    if(this.asset!==asset||this.base.width!==w||this.base.height!==h||this.collage!==state.collage){
      const base=sized(this.base,w,h);
      if(state.collage){
        const c=state.collage,cols=c.cols,rows=Math.ceil(c.assets.length/cols),gap=Math.min(w,h)*c.gap/100;
        base.fillStyle=c.background;base.fillRect(0,0,w,h);
        if(c.pattern){base.fillStyle='#ffffff20';for(let x=0;x<w;x+=12)for(let y=0;y<h;y+=12)base.fillRect(x,y,2,2)}
        const cw=(w-gap*(cols+1))/cols,ch=(h-gap*(rows+1))/rows;
        for(const [i,key] of c.assets.entries()){
          const img=this.assets.get(key)?.image;
          if(!img)continue;
          const column=i%cols,row=Math.floor(i/cols),x=gap+column*(cw+gap),y=gap+row*(ch+gap);
          base.save();base.beginPath();base.roundRect(x,y,cw,ch,Math.min(cw,ch)*c.radius/100);base.clip();cover(base,img,x,y,cw,ch);base.restore();
        }
      }else base.drawImage(image,0,0,w,h);
      this.asset=asset;this.collage=state.collage;this.strokes=null;
    }
    const paintLayers=state.layers.filter(l=>l.type==='paint');
    const paintKey=JSON.stringify(paintLayers);
    if(!original&&(this.strokes!==state.strokes||this.paintLayers!==paintKey||this.mesh!==state.mesh)){
      const raster=sized(this.raster,w,h);raster.drawImage(this.base,0,0);
      if(state.strokes.length)drawStrokes(this.base,state.strokes,paintLayers,this.raster);
      if(state.mesh)warpMesh(raster,state.mesh);
      this.mesh=state.mesh;
      this.strokes=state.strokes;this.paintLayers=paintKey;this.version={};this.paintCache=new Map();
    }
    if(!original&&(this.gradedVersion!==this.version||this.gradedColor!==state.color)){
      this.lastAccelerated=this.pipeline.draw(this.raster,this.version,state.color,this.graded);
      this.gradedVersion=this.version;this.gradedColor=state.color;
    }
    const stage=sized(this.geometry,tw,th),[x,y,cw,ch]=t.crop;
    const project=(image,layer)=>{
      stage.save();
      if(layer){stage.globalAlpha=layer.opacity/100;stage.globalCompositeOperation=layer.blend}
      stage.translate(tw/2,th/2);stage.rotate(t.rotation*Math.PI/180);stage.scale(t.flipX?-1:1,t.flipY?-1:1);
      perspective(stage,image,x*w,y*h,cw*w,ch*h,t.skewX,t.skewY);
      stage.restore();
    };
    project(original?this.base:this.graded);
    const [outW,outH]=dimensions??[tw,th];
    const ctx=sized(target,outW,outH);ctx.scale(outW/tw,outH/th);
    if(original){ctx.drawImage(this.geometry,0,0);return}
    for(const fx of state.effects)overlay(stage,fx,tw,th);
    for(const layer of state.layers){
      if(layer.type!=='paint'){graphic(stage,layer,this.assets,tw,th);continue}
      if(!layer.visible||!layer.opacity)continue;
      let painting=this.paintCache.get(layer.id);
      if(!painting){
        const strokes=state.strokes.filter(s=>s.layer===layer.id&&PAINT.includes(s.brush.type));
        if(!strokes.length)continue;
        painting=paintLayer(strokes,w,h);this.paintCache.set(layer.id,painting);
      }
      project(painting,layer);
    }
    frameImage(ctx,this.geometry,state.frame,tw,th);
  }
}
