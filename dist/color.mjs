import { BASIC,HUES,clamp,curveTables,effectiveBasic } from './model.mjs';

export const cssColor=(hex)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function hueOf(r,g,b){
  const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;
  if(!d)return 0;
  return ((hi===r?(g-b)/d:hi===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;
}
const blend=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const weights=[30,30,60,60,60,45,45,45];
const intensity=(key,value)=>key==='exposure'||key==='grainSize'?value:value/100;
const rgbHue=h=>[0,4,2].map(n=>clamp(Math.abs(((h*6+n)%6+6)%6-3)-1));
function sampleLut(lut,rgb){
  const {size,min,max,values}=lut,n=size-1;
  const p=rgb.map((val,i)=>clamp((val-min[i])/(max[i]-min[i]))*n);
  const [r,g,b]=p.map(Math.floor),[x,y,z]=p.map(v=>v%1);
  const go=(rr,gg,bb,c)=>values[(Math.min(rr,n)+size*(Math.min(gg,n)+size*Math.min(bb,n)))*3+c];
  return [0,1,2].map(c=>blend(
    blend(blend(go(r,g,b,c),go(r+1,g,b,c),x),blend(go(r,g+1,b,c),go(r+1,g+1,b,c),x),y),
    blend(blend(go(r,g,b+1,c),go(r+1,g,b+1,c),x),blend(go(r,g+1,b+1,c),go(r+1,g+1,b+1,c),x),y),z));
}
export function fallbackColor(source,target,state){
  const {width:w,height:h}=source;
  target.width=w;target.height=h;
  const ctx=target.getContext('2d',{willReadFrequently:true}), raw=effectiveBasic(state);
  const a=Object.fromEntries(Object.entries(raw).map(([key,val])=>[key,intensity(key,val)]));
  if(a.blur&&state.blurType==='gaussian')ctx.filter='blur('+a.blur*14*w/1200+'px)';
  ctx.drawImage(source,0,0);ctx.filter='none';
  if(a.blur&&state.blurType!=='gaussian'){
    const count=10;
    for(let i=1;i<=count;i++){
      ctx.globalAlpha=1/(i+1);
      if(state.blurType==='radial'){
        const factor=1+a.blur*i/count*.18,sw=w*factor,sh=h*factor;
        ctx.drawImage(source,(w-sw)/2,(h-sh)/2,sw,sh);
      }else{
        const angle=i*2.39996,r=Math.max(w,h)*a.blur*.014*Math.sqrt(i/count);
        ctx.drawImage(source,Math.cos(angle)*r,Math.sin(angle)*r);
      }
    }
    ctx.globalAlpha=1;
  }
  const image=ctx.getImageData(0,0,w,h),{data}=image,c=curveTables(state.curves);
  const hsl=state.hsl.map(([x,y,z])=>[x/360,y/100,z/100]);
  const grade=state.grade.map(([x,y,z])=>[rgbHue(x/360),y/100,z/100]);
  const useHsl=hsl.some(row=>row.some(Boolean)),useGrade=grade.some(([,s,l])=>s||l);
  const exposure=2**(a.exposure/2.2),contrast=1+a.contrast*.85;
  const detail=a.sharpness*2.2+a.structure*1.6,clarity=a.clarity*1.3;
  const reference=detail||clarity?new Uint8ClampedArray(data):null;
  const cross=(x,y,d,c)=>(reference[(y*w+Math.max(0,x-d))*4+c]+reference[(y*w+Math.min(w-1,x+d))*4+c]+reference[(Math.max(0,y-d)*w+x)*4+c]+reference[(Math.min(h-1,y+d)*w+x)*4+c])/1020;
  for(let p=0;p<data.length;p+=4){
    let r=data[p]/255,g=data[p+1]/255,b=data[p+2]/255;
    const idx=p/4,x=idx%w,y=Math.floor(idx/w);
    if(reference){
      r+=detail*(r-cross(x,y,2,0))+clarity*(r-cross(x,y,8,0));
      g+=detail*(g-cross(x,y,2,1))+clarity*(g-cross(x,y,8,1));
      b+=detail*(b-cross(x,y,2,2))+clarity*(b-cross(x,y,8,2));
    }
    let l=.2126*r+.7152*g+.0722*b;
    const tone=a.brightness*.32+a.highlights*.45*smooth(.45,1,l)+a.shadows*.44*(1-smooth(0,.55,l))+a.whites*.30*smooth(.72,1,l)+a.blacks*.30*(1-smooth(0,.28,l));
    r=(r*exposure-.5)*contrast+.5+tone+a.temperature*.14+a.tint*.05;
    g=(g*exposure-.5)*contrast+.5+tone-a.tint*.08;
    b=(b*exposure-.5)*contrast+.5+tone-a.temperature*.14+a.tint*.05;
    const sat=1+a.saturation+a.vibrance*(1-clamp(Math.max(r,g,b)-Math.min(r,g,b)));
    l=.2126*r+.7152*g+.0722*b;r=blend(l,r,sat);g=blend(l,g,sat);b=blend(l,b,sat);
    if(useHsl){
      const hue=hueOf(r,g,b);let dh=0,ds=0,dl=0;
      for(let j=0;j<8;j++){
        const d=Math.abs(hue-HUES[j]),k=1-smooth(0,weights[j],Math.min(d,360-d));
        dh+=k*hsl[j][0];ds+=k*hsl[j][1];dl+=k*hsl[j][2];
      }
      const hi=Math.max(r,g,b),lo=Math.min(r,g,b),ch=clamp((hi-lo)*(1+ds)),m=(hi+lo-ch)/2+dl*.35;
      const k=rgbHue(hue/360+dh);r=m+k[0]*ch;g=m+k[1]*ch;b=m+k[2]*ch;
    }
    r=c[1][Math.round(c[0][Math.round(clamp(r)*255)]*255)];
    g=c[2][Math.round(c[0][Math.round(clamp(g)*255)]*255)];
    b=c[3][Math.round(c[0][Math.round(clamp(b)*255)]*255)];
    if(useGrade){
      l=clamp(.2126*r+.7152*g+.0722*b+state.balance/250);
      const sh=1-smooth(0,.55,l),hi=smooth(.45,1,l),ws=[sh,Math.max(0,1-sh-hi),hi];
      for(let j=0;j<3;j++){
        const [color,sat,lum]=grade[j], k=ws[j];
        r+=k*((color[0]-.5)*sat*.3+lum*.25);g+=k*((color[1]-.5)*sat*.3+lum*.25);b+=k*((color[2]-.5)*sat*.3+lum*.25);
      }
    }
    if(state.lut&&state.lutMix){const m=state.lutMix/100;const v=sampleLut(state.lut,[r,g,b]);r=blend(r,v[0],m);g=blend(g,v[1],m);b=blend(b,v[2],m)}
    const v=a.vignette*smooth(.23,.72,Math.hypot(x/w-.5,y/h-.5))*.55;
    const hash=Math.imul(Math.floor(x/a.grainSize)+1,198491317)^Math.imul(Math.floor(y/a.grainSize)+1,6542989);
    const noise=((Math.imul(hash^(hash>>>12),2246822519)>>>0)/4294967295-.5)*a.grain*(.08+a.roughness*.22);
    data[p]=(r-v+noise)*255;data[p+1]=(g-v+noise)*255;data[p+2]=(b-v+noise)*255;
  }
  ctx.putImageData(image,0,0);
}

const vertex=`#version 300 es
out vec2 uv;
void main(){
  vec2 p=vec2(float(gl_VertexID & 1),float(gl_VertexID >> 1));
  uv=vec2(p.x,1.-p.y);
  gl_Position=vec4(p*2.-1.,0.,1.);
}`;
const fragment=`#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
out vec4 outColor;
uniform sampler2D photo, curves;
uniform sampler3D lut;
uniform vec3 lutMin,lutMax;
uniform float lutSize,lutMix,balance;
uniform vec2 px;
uniform int blurType;
uniform float a[19];
uniform vec3 hsl[8], grading[3];
const vec3 Y=vec3(.2126,.7152,.0722);
const float centers[8]=float[8](0.,30.,60.,120.,180.,225.,270.,315.);
const float widths[8]=float[8](30.,30.,60.,60.,60.,45.,45.,45.);
vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
vec3 fetchRGB(vec2 p){return texture(photo,p).rgb;}
vec3 crossBlur(vec2 p,float d){vec2 x=px*d;return (fetchRGB(p+vec2(x.x,0.))+fetchRGB(p-vec2(x.x,0.))+fetchRGB(p+vec2(0.,x.y))+fetchRGB(p-vec2(0.,x.y)))*.25;}
float curve(float x,int channel){return texture(curves,vec2((clamp(x,0.,1.)*255.+.5)/256.,(float(channel)+.5)*.25)).r;}
void main(){
  vec4 raw=texture(photo,uv);
  vec3 c=raw.rgb;
  if(a[15]>0.){
    vec3 soft=vec3(0.);float total=0.;
    for(int i=0;i<12;i++){
      float k=float(i),t=k/11.;
      vec2 delta=blurType==2?(uv-.5)*(t-.5)*a[15]*.48:vec2(cos(k*2.39996),sin(k*2.39996))*sqrt(t)*a[15]*.032;
      float w=blurType==0?exp(-t*2.5):1.;
      soft+=fetchRGB(uv+delta)*w;total+=w;
    }
    c=soft/total;
  }
  if(abs(a[11])+a[12]+abs(a[13])>0.){
    vec3 detail=c-crossBlur(uv,1.+a[12]*2.);
    c+=detail*(a[12]*2.2+a[13]*1.6)+(c-crossBlur(uv,8.))*a[11]*1.3;
  }
  float l=dot(c,Y);
  float tone=a[1]*.32+a[3]*.45*smoothstep(.45,1.,l)+a[4]*.44*(1.-smoothstep(0.,.55,l))+a[5]*.30*smoothstep(.72,1.,l)+a[6]*.30*(1.-smoothstep(0.,.28,l));
  c=(c*exp2(a[0]/2.2)-.5)*(1.+a[2]*.85)+.5+tone+vec3(a[7]*.14+a[8]*.05,-a[8]*.08,-a[7]*.14+a[8]*.05);
  l=dot(c,Y);float hi=max(c.r,max(c.g,c.b)),lo=min(c.r,min(c.g,c.b));
  c=mix(vec3(l),c,1.+a[9]+a[10]*(1.-clamp(hi-lo,0.,1.)));
  hi=max(c.r,max(c.g,c.b));lo=min(c.r,min(c.g,c.b));float d=hi-lo;
  if(d>.00001){
    float h=mod((hi==c.r?(c.g-c.b)/d:hi==c.g?(c.b-c.r)/d+2.:(c.r-c.g)/d+4.)*60.+360.,360.);
    vec3 adjust=vec3(0.);
    for(int i=0;i<8;i++){
      float dist=abs(h-centers[i]);adjust+=hsl[i]*(1.-smoothstep(0.,widths[i],min(dist,360.-dist)));
    }
    if(any(notEqual(adjust,vec3(0.)))){
      float ch=clamp(d*(1.+adjust.y),0.,1.);
      c=hue(h/360.+adjust.x)*ch+(hi+lo-ch)*.5+adjust.z*.35;
    }
  }
  c=vec3(curve(curve(c.r,0),1),curve(curve(c.g,0),2),curve(curve(c.b,0),3));
  l=clamp(dot(c,Y)+balance,0.,1.);
  float sh=1.-smoothstep(0.,.55,l), hh=smoothstep(.45,1.,l);
  vec3 ws=vec3(sh,max(0.,1.-sh-hh),hh);
  for(int i=0;i<3;i++)c+=ws[i]*((hue(grading[i].x)-.5)*grading[i].y*.30+grading[i].z*.25);
  if(lutMix>0.){
    vec3 loc=clamp((c-lutMin)/(lutMax-lutMin),0.,1.);
    c=mix(c,texture(lut,(loc*(lutSize-1.)+.5)/lutSize).rgb,lutMix);
  }
  c-=a[14]*smoothstep(.23,.72,length(uv-.5))*.55;
  vec2 pos=floor(uv/px/a[17]);
  float n=fract(sin(dot(pos,vec2(12.9898,78.233)))*43758.5453)-.5;
  c+=n*a[16]*(.08+a[18]*.22);
  outColor=vec4(clamp(c,0.,1.),raw.a);
}`;
function compile(gl,type,code){
  const sh=gl.createShader(type);gl.shaderSource(sh,code);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}
export class GradePipeline{
  constructor(){
    this.canvas=document.createElement('canvas');
    this.gl=this.canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false});
    const gl=this.gl;
    if(!gl)return;
    try{
      const program=gl.createProgram();this.program=program;
      gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertex));
      gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      this.textures=[gl.createTexture(),gl.createTexture(),gl.createTexture()];
      for(let i=0;i<3;i++){
        const target=i===2?gl.TEXTURE_3D:gl.TEXTURE_2D;
        gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(target,this.textures[i]);
        for(const p of [gl.TEXTURE_MAG_FILTER,gl.TEXTURE_MIN_FILTER])gl.texParameteri(target,p,gl.LINEAR);
        for(const p of i===2?[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R]:[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(target,p,gl.CLAMP_TO_EDGE);
      }
      this.uniform=Object.fromEntries(['photo','curves','lut','lutMin','lutMax','lutMix','lutSize','balance','px','blurType','a','hsl','grading'].map(k=>[k,gl.getUniformLocation(program,k)]));
      ['photo','curves','lut'].forEach((key,i)=>gl.uniform1i(this.uniform[key],i));
      gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
      gl.texImage3D(gl.TEXTURE_3D,0,gl.RGB8,1,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0]));
    }catch(error){console.warn('WebGL 2',error);this.gl=null}
  }
  get accelerated(){return Boolean(this.gl&&!this.gl.isContextLost())}
  draw(source,version,state,target){
    const gl=this.gl,w=source.width,h=source.height;
    if(!this.accelerated||Math.max(w,h)>gl.getParameter(gl.MAX_TEXTURE_SIZE)||Math.max(w,h)>Math.min(...gl.getParameter(gl.MAX_VIEWPORT_DIMS))){
      fallbackColor(source,target,state);
      return false;
    }
    if(this.canvas.width!==w)this.canvas.width=w;
    if(this.canvas.height!==h)this.canvas.height=h;
    if(gl.drawingBufferWidth!==w||gl.drawingBufferHeight!==h){fallbackColor(source,target,state);return false}
    const u=this.uniform;
    gl.viewport(0,0,w,h);
    if(this.version!==version){
      gl.activeTexture(gl.TEXTURE0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);this.version=version;
    }
    if(this.curves!==state.curves){
      const values=Uint8Array.from(curveTables(state.curves).flat(),v=>Math.round(v*255));
      gl.activeTexture(gl.TEXTURE1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,256,4,0,gl.RED,gl.UNSIGNED_BYTE,values);
      this.curves=state.curves;
    }
    const lut=state.lut;
    if(lut&&this.lut!==lut){
      gl.activeTexture(gl.TEXTURE2);
      gl.texImage3D(gl.TEXTURE_3D,0,gl.RGB8,lut.size,lut.size,lut.size,0,gl.RGB,gl.UNSIGNED_BYTE,Uint8Array.from(lut.values,v=>Math.round(clamp(v)*255)));
      this.lut=lut;
    }
    if(lut){gl.uniform3fv(u.lutMin,lut.min);gl.uniform3fv(u.lutMax,lut.max);gl.uniform1f(u.lutSize,lut.size)}
    const b=effectiveBasic(state);
    gl.uniform1fv(u.a,BASIC.map(([key])=>intensity(key,b[key])));
    gl.uniform3fv(u.hsl,state.hsl.flatMap(([h,s,l])=>[h/360,s/100,l/100]));
    gl.uniform3fv(u.grading,state.grade.flatMap(([h,s,l])=>[h/360,s/100,l/100]));
    gl.uniform1f(u.balance,state.balance/250);gl.uniform1f(u.lutMix,lut?state.lutMix/100:0);
    gl.uniform2f(u.px,1/w,1/h);gl.uniform1i(u.blurType,['gaussian','lens','radial'].indexOf(state.blurType));
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    target.width=w;target.height=h;target.getContext('2d').drawImage(this.canvas,0,0);
    return true;
  }
}
