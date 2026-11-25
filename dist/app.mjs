import { FILTERS,HUES,History,clamp,identityTransform,makeLayer,makeProject,meshGrid,ratioCrop } from './model.mjs';
import { fallbackColor,hueOf } from './color.mjs';
import { decode } from './files.mjs';
import { BRUSH_DEFAULT,Renderer,canvas,transformedSize } from './render.mjs';
import { BRUSH_GROUPS,CATEGORIES,Inspector } from './inspector.mjs';
import { Dialogs } from './dialogs.mjs';
import { ThemeSettings } from './themes.mjs';
import { $,btn,el,icon } from './ui.mjs';

const viewport=$('#viewport'),photo=$('#photo'),out=$('#output'),original=$('#original'),line=$('#compare-line'),guides=$('#guides'),cropbox=$('#cropbox');
class Editor{
  constructor(){
    this.history=new History();this.assets=new Map();this.renderer=new Renderer(this.assets);
    this.category=null;this.thumbnails=new Map();this.touches=new Map();this.inspector=new Inspector(this);this.dialogs=new Dialogs(this);this.themes=new ThemeSettings(this.dialogs);this.brush={...BRUSH_DEFAULT};
    this.zoom=1;this.pan=[0,0];this.mode=0;this.split=.5;this.grid=0;this.manualGuides=[];
    this.histCanvas=canvas(160,100);
  }
  get state(){return this.history.state}
  message(text){
    const target=$('#welcome').hidden?$('#message'):$('#home-feedback');
    target.textContent=text;
    clearTimeout(this.messageTimer);this.messageTimer=setTimeout(()=>target.textContent='',6500);
  }
  async addAsset(file){
    const image=await decode(file),id=crypto.randomUUID();
    if(!image.width||!image.height)throw new Error('La imagen no tiene dimensiones válidas.');
    this.assets.set(id,{image,file,name:file.name});
    return id;
  }
  async open(file,token={}){
    this.openToken=token;
    try{
      const id=await this.addAsset(file);
      if(this.openToken!==token){this.release(id);return}
      for(const key of this.assets.keys())if(key!==id)this.release(key);
      this.history.open(makeProject(id));this.pending=null;this.session=null;this.category=null;this.touches.clear();this.pinch=null;this.refreshDock();
      this.anchor=null;this.selected=null;this.compareKey=null;this.reference=null;this.manualGuides=[];this.gesture=null;this.cropMode=false;this.picker=null;
      this.pan=[0,0];this.zoom=1;this.mode=0;
      $('#filename').textContent=file.name;
      this.thumbnails.clear();this.syncButtons();this.setHome(false);
    }catch{if(this.openToken===token)this.message('No se pudo abrir esa imagen. Prueba con PNG, JPEG o WebP.')}
  }
  release(id){this.assets.get(id)?.image.close?.();this.assets.delete(id)}
  finish(){
    if(this.pending){this.history.commit(this.state,this.pending);this.pending=null;this.syncButtons()}
  }
  update(next,live=false){
    if(live){if(!this.pending)this.pending=this.state;this.history.replace(next)}
    else{this.finish();this.history.commit(next)}
    this.syncButtons();this.request();
  }
  step(redo=false){
    this.finish();
    if(redo)this.history.redo();else this.history.undo();
    if(!this.state?.layers.some(layer=>layer.id===this.selected))this.selected=null;
    this.inspector.render();this.syncButtons();this.request();
  }
  syncButtons(){
    $('#undo').disabled=!this.history.past.length&&!this.pending;$('#redo').disabled=!this.history.future.length;
  }
  setHome(active){
    const changed=$('#welcome').hidden===active;
    $('#welcome').hidden=!active;
    $('#editor-header').hidden=active;
    $('#editor').hidden=active;
    $('#resume').hidden=!this.state;
    document.body.classList.toggle('at-home',active);
    $('#message').textContent='';
    $('#home-feedback').textContent='';
    if(!active)this.request();
    if(changed)(active?$('#welcome-title'):viewport).focus({preventScroll:true});
  }
  replaceFromHome(load){
    if($('#welcome').hidden||!(this.history.past.length||this.history.snapshots.length)){
      load();return;
    }
    this.dialogs.show('¿Abrir otra foto?',
      el('p',{},'La edición abierta solo se conserva en esta sesión. Si abres otra foto, se perderán los cambios y las instantáneas.'),
      el('div',{class:'row'},
        btn('Conservar edición',()=>this.dialogs.modal.close(),{autofocus:''}),
        btn('Abrir otra foto',()=>{this.dialogs.modal.close();load()},{class:'primary'})));
  }
  async openSample(){
    const token={};this.openToken=token;
    const button=$('#open-sample');
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    this.message('Abriendo la foto de muestra…');
    try{
      const response=await fetch($('#sample-image').src);
      if(!response.ok)throw new Error('Muestra no disponible');
      const blob=await response.blob();
      if(this.openToken===token)await this.open(new File([blob],'Lago de montaña.jpg',{type:'image/jpeg'}),token);
    }catch{
      if(this.openToken===token)this.message('No se pudo cargar la muestra. Vuelve a intentarlo o abre una foto.');
    }finally{
      button.disabled=false;
      button.removeAttribute('aria-busy');
    }
  }
  refreshDock(){
    for(const button of $('#categories').children)button.setAttribute('aria-pressed',button.dataset.category===this.category);
    $('#tool-panel').hidden=!this.category;
    $('#show-layers').setAttribute('aria-expanded',this.category==='layers');
    $('#reset-tool').disabled=this.category==='library';
  }
  closeCategory(apply=true){
    const session=this.session;
    if(!session)return;
    this.pointerUp(!apply);this.finish();
    if(!apply){
      this.history.replace(session.state);this.history.past=session.past;this.history.future=session.future;
      this.brush=session.brush;this.selected=session.selected;this.anchor=session.anchor;
    }else if(this.state!==session.state&&this.history.past.includes(session.state)){
      this.history.past=[...session.past,session.state];
    }
    this.session=null;this.category=null;this.cropMode=false;this.picker=null;
    this.refreshDock();this.syncButtons();this.setCursor();this.request();
  }
  selectCategory(key){
    if(!this.state){this.message('Abre una foto para editar.');return}
    const wasActive=this.category===key;
    this.closeCategory();
    if(wasActive)return;
    this.setHome(false);this.category=key;
    this.session={state:this.state,past:[...this.history.past],future:[...this.history.future],brush:this.brush,selected:this.selected,anchor:this.anchor};
    if(BRUSH_GROUPS[key]&&!BRUSH_GROUPS[key].includes(this.brush.type))this.brush={...this.brush,type:BRUSH_GROUPS[key][0]};
    if(key==='transform'&&this.grid===0)this.grid=1;
    if(BRUSH_GROUPS[key])this.setMode(0);
    this.refreshDock();this.inspector.render();$('#inspector-body').scrollTop=0;this.setCursor();this.layout();
  }
  makeFilm(){
    if(this.thumbnails.size)return;
    const source=canvas(144,92),target=canvas(),ctx=source.getContext('2d'),image=this.assets.get(this.state.source).image;
    const scale=Math.max(source.width/image.width,source.height/image.height);
    ctx.drawImage(image,(source.width-image.width*scale)/2,(source.height-image.height*scale)/2,image.width*scale,image.height*scale);
    this.thumbnails.clear();
    for(const [filter] of FILTERS){
      fallbackColor(source,target,{...this.state.color,filter});
      this.thumbnails.set(filter,target.toDataURL('image/jpeg',.8));
    }
  }
  request(){
    if(this.queued)return;
    this.queued=requestAnimationFrame(()=>{
      this.queued=0;if(!this.state)return;
      try{this.render()}catch(e){console.error(e);this.message('Error al dibujar: '+e.message)}
    });
  }
  render(){
    const state=this.state,[w,h]=this.renderer.layout(state);
    this.renderer.draw(state,out,{limit:this.renderer.pipeline.accelerated?1536:960});
    if(this.mode){
      const key=JSON.stringify([state.source,state.transform,state.collage,out.width,out.height]);
      const limit=this.renderer.pipeline.accelerated?1536:960;
      if(this.reference){
        if(this.drawnReference!==this.reference||this.compareKey!==key){
          this.renderer.draw(this.reference.state,original,{limit,dimensions:[out.width,out.height]});
          this.drawnReference=this.reference;this.compareKey=key;
        }
      }else if(key!==this.compareKey||this.drawnReference){
        this.renderer.draw(state,original,{limit,original:true});this.compareKey=key;this.drawnReference=null;
      }
    }
    const [ow,oh]=transformedSize(w,h,state.transform);
    $('#dimensions').textContent=ow+' × '+oh+' px';
    $('#render-status').textContent=this.renderer.lastAccelerated?'WebGL 2 + Canvas 2D':'Canvas 2D';
    this.layout();this.histogram();
  }
  layout(){
    if(!this.state||!$('#welcome').hidden)return;
    const w=out.width,h=out.height,side=this.mode===2?2:1;
    const inset=viewport.clientWidth<500?24:44;
    const sx=(viewport.clientWidth-inset)/(w*side),sy=(viewport.clientHeight-inset)/h;
    const fit=Math.min(sx,sy),factor=Math.max(.02,fit)*this.zoom;
    photo.style.width=w*factor*side+'px';photo.style.height=h*factor+'px';
    photo.style.gridArea='1 / 1';photo.style.transform='translate('+this.pan[0]+'px, '+this.pan[1]+'px)';
    photo.dataset.mode=this.mode;
    original.hidden=this.mode===0;line.hidden=this.mode!==1;
    $('.comparison-tags').hidden=this.mode!==1&&this.mode!==2;
    $('.comparison-tags span').textContent=this.reference?this.reference.name:'ANTES';
    original.style.clipPath=this.mode===1?'inset(0 '+((1-this.split)*100)+'% 0 0)':'none';
    line.style.left=this.split*100+'%';
    $('#view-status').textContent=['Vista editada','Comparación dividida','Lado a lado',this.reference?'Snapshot':'Vista original'][this.mode];
    $('#compare').setAttribute('aria-pressed',this.mode!==0);
    $('#zoom').textContent=Math.round(this.zoom*100)+'%';
    this.updateGuides();this.updateMesh();
  }
  meshEnabled(){
    const t=this.state.transform;
    return Boolean(BRUSH_GROUPS[this.category])&&this.brush.type==='mesh'&&this.mode===0&&!t.rotation&&!t.skewX&&!t.skewY&&!t.flipX&&!t.flipY&&t.crop[2]===1&&t.crop[3]===1&&this.state.frame.style==='none';
  }
  moveMeshNode(index,x,y,live=false){
    if(!this.meshEnabled())return;
    const baseline=meshGrid(),[bx,by]=baseline[index];
    const nodes=(this.state.mesh??baseline).map((node,k)=>k===index?[clamp(x,bx-.102,bx+.102),clamp(y,by-.102,by+.102)]:node);
    this.meshNode=index;
    this.update({...this.state,mesh:nodes},live);
  }
  updateMesh(){
    const surface=$('#mesh-ui');
    surface.hidden=!this.meshEnabled();
    if(surface.hidden)return;
    const points=this.state.mesh??meshGrid();
    const lines=[];
    for(let n=0;n<5;n++){
      lines.push(points.slice(n*5,n*5+5),points.filter((_,i)=>i%5===n));
    }
    surface.querySelector('path').setAttribute('d',lines.map(group=>group.map(([x,y],i)=>(i?'L':'M')+x*100+' '+y*100).join(' ')).join(' '));
    surface.querySelectorAll('circle').forEach(node=>{
      const id=Number(node.dataset.node),[x,y]=points[id];
      node.setAttribute('cx',x*100);node.setAttribute('cy',y*100);
      node.classList.toggle('selected',id===(this.meshNode??12));
    });
  }
  updateGuides(){
    const pixels=this.grid===3?Math.max(2,photo.clientWidth/out.width):0;
    const signature=JSON.stringify([this.grid,pixels,this.gesture?.type==='layer',this.manualGuides]);
    if(signature===this.guideSignature)return;
    this.guideSignature=signature;
    guides.replaceChildren();guides.className='';
    if(this.grid===3){
      guides.classList.add('pixel');guides.style.backgroundSize=pixels+'px '+pixels+'px';
    }else if(this.grid||this.gesture?.type==='layer'){
      for(const pos of this.grid<=1?[33.333,66.667]:[38.196,61.804]){
        guides.append(el('i',{class:'vertical',style:'left:'+pos+'%'}),el('i',{class:'horizontal',style:'top:'+pos+'%'}));
      }
    }
    for(const [axis,position] of this.manualGuides)guides.append(el('i',{class:'alignment '+axis,style:(axis==='vertical'?'left':'top')+':'+position+'%'}));
    $('#grid').title=['Sin cuadrícula','Regla de tercios','Proporción áurea','Cuadrícula de píxeles'][this.grid]+' · Mayús + clic añade una guía';
    $('#grid').setAttribute('aria-pressed',this.grid!==0);
  }
  histogram(renderTo=$('#hist')){
    if(!this.state)return;
    if(!renderTo&&this.inspector.tab!=='curve')return;
    const sample=this.histCanvas.getContext('2d',{willReadFrequently:true}),w=this.histCanvas.width,h=this.histCanvas.height;
    sample.clearRect(0,0,w,h);sample.drawImage(out,0,0,w,h);
    const pixels=sample.getImageData(0,0,w,h).data,bins=Array.from({length:3},()=>new Uint32Array(64));
    for(let p=0;p<pixels.length;p+=4)if(pixels[p+3])for(let j=0;j<3;j++)bins[j][pixels[p+j]>>2]++;
    this.bins=bins;
    if(!renderTo)return;
    const target=renderTo.getContext('2d'),peak=Math.max(1,...bins.flatMap(v=>Array.from(v)));
    target.clearRect(0,0,256,52);
    target.strokeStyle='#ffffff20';for(let x=0;x<256;x+=64){target.beginPath();target.moveTo(x,0);target.lineTo(x,52);target.stroke()}
    bins.forEach((values,i)=>{
      target.fillStyle=['#d7726777','#69ba9677','#729bde77'][i];target.strokeStyle=['#e88b83','#77bb9e','#89abe3'][i];
      target.beginPath();target.moveTo(0,52);
      values.forEach((n,j)=>target.lineTo(j*256/63,52-Math.sqrt(n/peak)*47));
      target.lineTo(256,52);target.closePath();target.fill();target.stroke();
    });
  }
  setZoom(value){this.zoom=clamp(value,.1,8);if(this.zoom===1)this.pan=[0,0];this.layout()}
  setMode(mode){this.mode=mode;this.setCursor();this.request();this.layout()}
  changeRatio(ratio){
    const [w,h]=this.renderer.layout(this.state);
    const crop=ratioCrop(w,h,ratio);
    this.update({...this.state,transform:{...this.state.transform,ratio,crop}});this.inspector.render();
  }
  enablePicker(type){
    if(!this.state)return;
    this.picker=type;this.cropMode=false;this.setMode(0);
    this.message(type==='anchor'?'Haz clic en el origen del pincel.':'Haz clic en la imagen para muestrear.');this.setCursor();
  }
  enableCrop(){
    const t=this.state.transform;
    if(t.rotation||t.skewX||t.skewY||t.flipX||t.flipY){
      this.message('Para dibujar el recorte, devuelve giro, perspectiva y volteos a sus valores iniciales.');return;
    }
    this.cropMode=!this.cropMode;this.picker=null;this.setMode(0);this.inspector.render();this.setCursor();
    if(this.cropMode)this.message('Arrastra sobre la foto para definir el recorte.');
  }
  setCursor(){
    if(this.category!=='body'||this.brush.type==='mesh'||this.mode||this.space)$('#brush-outline').hidden=true;
    viewport.style.cursor=this.gesture?.type==='pan'?'grabbing':this.space?'grab':this.picker||this.cropMode||Boolean(BRUSH_GROUPS[this.category])?'crosshair':'default';
  }
  screenPoint(event){
    const r=out.getBoundingClientRect();
    return [clamp((event.clientX-r.left)/r.width),clamp((event.clientY-r.top)/r.height)];
  }
  brushPoint(event){
    let [x,y]=this.screenPoint(event);const t=this.state.transform;
    const [w,h]=this.renderer.layout(this.state),cw=w*t.crop[2],ch=h*t.crop[3],[tw,th]=transformedSize(w,h,t);
    const frame=this.state.frame,n=Math.min(tw,th)*frame.width/100;
    if(frame.style!=='none'){
      const [top,right,bottom,left]=frame.edges.map((v,i)=>n*v*(frame.style==='polaroid'&&i===2?2.2:1));
      x=(x*tw-left)/Math.max(1,tw-left-right);y=(y*th-top)/Math.max(1,th-top-bottom);
    }
    const r=t.rotation*Math.PI/180,xx=(x-.5)*tw,yy=(y-.5)*th;
    let u=(xx*Math.cos(r)+yy*Math.sin(r))*(t.flipX?-1:1)/cw;
    let v=(-xx*Math.sin(r)+yy*Math.cos(r))*(t.flipY?-1:1)/ch;
    const z=1-u*t.skewX/90-v*t.skewY/90;u=u/z+.5;v=v/z+.5;
    return [clamp(t.crop[0]+u*t.crop[2]),clamp(t.crop[1]+v*t.crop[3]),event.pointerType==='pen'?Math.max(.03,event.pressure):1];
  }
  pointerDown(event){
    if(!this.state||!$('#welcome').hidden||this.gesture||event.button>1)return;
    if(event.target===line||line.contains(event.target)){
      this.gesture={type:'split'};event.preventDefault();
    }else if(this.space||event.button===1||!photo.contains(event.target)){
      this.gesture={type:'pan',start:[event.clientX,event.clientY],pan:[...this.pan]};event.preventDefault();
    }else if(event.shiftKey&&this.mode===0&&!this.cropMode&&!this.picker){
      const [x,y]=this.screenPoint(event),horizontal=event.altKey;
      this.manualGuides.push([horizontal?'horizontal':'vertical',(horizontal?y:x)*100]);this.updateGuides();return;
    }else if(this.picker||Boolean(BRUSH_GROUPS[this.category])&&event.altKey){
      const type=this.picker??'anchor';this.picker=null;
      if(type==='anchor'){this.anchor=this.brushPoint(event).slice(0,2);this.message('Origen definido.');}
      else{
        const [x,y]=this.screenPoint(event),pixel=out.getContext('2d').getImageData(Math.min(out.width-1,Math.floor(x*out.width)),Math.min(out.height-1,Math.floor(y*out.height)),1,1).data;
        if(type==='brush')this.brush={...this.brush,color:'#'+Array.from(pixel.slice(0,3),v=>v.toString(16).padStart(2,'0')).join('')};
        else{
          const h=hueOf(...pixel.slice(0,3)),d=HUES.map(v=>Math.min(Math.abs(v-h),360-Math.abs(v-h)));
          this.inspector.band=d.indexOf(Math.min(...d));
        }
      }
      this.inspector.render();this.setCursor();return;
    }else if(this.cropMode){
      this.gesture={type:'crop',start:this.screenPoint(event),end:this.screenPoint(event)};this.cropBox();
    }else if(Boolean(BRUSH_GROUPS[this.category])&&this.mode===0){
      const brush=this.brush;
      if(brush.type==='mesh'){
        if(!this.meshEnabled()){this.message('Desactiva recorte, transformación y marco para editar la malla.');return}
        if(event.target.dataset.node===undefined)return;
        this.gesture={type:'mesh',index:Number(event.target.dataset.node)};
        viewport.setPointerCapture(event.pointerId);return;
      }
      if(['clone','heal'].includes(brush.type)&&!this.anchor){this.message('Define el origen con Alt / Option + clic.');return}
      const isBody=this.category==='body',paintable=l=>l.type==='paint'&&(isBody?l.scope==='body':l.scope!=='body');
      let layer=this.state.layers.find(l=>l.id===this.selected&&paintable(l))??this.state.layers.find(l=>paintable(l)&&!l.locked&&l.visible);
      if(layer?.locked||layer?.visible===false){this.message('Activa y desbloquea la capa de pintura.');return}
      const layers=layer?this.state.layers:[...this.state.layers,layer=makeLayer('paint',isBody?'Deformación local':'Retoque manual',{scope:isBody?'body':'retouch'})];
      const stroke={scope:this.category,brush:{...brush,protectEdges:isBody&&brush.edge},layer:layer.id,points:[this.brushPoint(event)],anchor:this.anchor};
      this.selected=layer.id;this.gesture={type:'stroke',stroke};
      this.update({...this.state,layers,strokes:[...this.state.strokes,stroke]},true);
    }else{
      const layer=['layers','text','shapes'].includes(this.category)&&this.mode===0&&this.state.layers.find(item=>item.id===this.selected&&item.type!=='paint'&&!item.locked&&item.visible);
      this.gesture=layer?{type:'layer',layer,start:this.screenPoint(event)}:{type:'pan',start:[event.clientX,event.clientY],pan:[...this.pan]};
    }
    viewport.setPointerCapture(event.pointerId);this.setCursor();
  }
  pointerMove(event){
    const g=this.gesture;if(!g)return;
    if(g.type==='pan'){
      this.pan=[g.pan[0]+event.clientX-g.start[0],g.pan[1]+event.clientY-g.start[1]];this.layout();
    }else if(g.type==='layer'){
      const [x,y]=this.screenPoint(event),[a,b]=g.start,{layer}=g;
      const snap=value=>[1/3,.5,2/3].find(guide=>Math.abs(value-guide)<.016)??clamp(value);
      this.update({...this.state,layers:this.state.layers.map(item=>item.id===layer.id?{...item,x:snap(layer.x+x-a),y:snap(layer.y+y-b)}:item)},true);
    }else if(g.type==='split'){this.split=clamp(this.screenPoint(event)[0],.02,.98);this.layout()}
    else if(g.type==='crop'){g.end=this.screenPoint(event);this.cropBox()}
    else if(g.type==='mesh'){
      this.moveMeshNode(g.index,...this.screenPoint(event),true);
    }else{
      const point=this.brushPoint(event),last=g.stroke.points.at(-1),s=g.stroke.brush.smoothing/130;
      point[0]+=(last[0]-point[0])*s;point[1]+=(last[1]-point[1])*s;
      if(Math.hypot(point[0]-last[0],point[1]-last[1])<.0007)return;
      g.stroke={...g.stroke,points:[...g.stroke.points,point]};
      this.update({...this.state,strokes:[...this.state.strokes.slice(0,-1),g.stroke]},true);
    }
  }
  cropRect(){
    const {start,end}=this.gesture;
    const [a,b]=start,[x,y]=end,ratio=this.state.transform.ratio;
    let width=Math.abs(x-a),height=Math.abs(y-b);
    if(ratio!=='Libre'){
      const [rw,rh]=ratio.split(':').map(Number),target=rw/rh*out.height/out.width;
      if(width/height>target)width=height*target;else height=width/target;
    }
    return [a-(x<a?width:0),b-(y<b?height:0),width,height];
  }
  cropBox(){
    const [x,y,w,h]=this.cropRect();
    Object.assign(cropbox.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});cropbox.hidden=false;
  }
  pointerUp(cancel=false){
    const g=this.gesture;if(!g)return;
    if(g.type==='crop'){
      const [x,y,w,h]=this.cropRect(),t=this.state.transform,[a,b,c,d]=t.crop;
      cropbox.hidden=true;this.cropMode=false;
      if(!cancel&&w>.015&&h>.015)this.update({...this.state,transform:{...t,crop:[a+x*c,b+y*d,w*c,h*d]}});
      this.inspector.render();
    }
    if(['stroke','mesh','layer'].includes(g.type)){
      if(cancel&&this.pending){this.history.replace(this.pending);this.pending=null;this.syncButtons();this.request()}
      else this.finish();
      if(g.type!=='stroke'||this.category==='body')this.inspector.render();
    }
    this.gesture=null;this.setCursor();if(g.type==='layer')this.updateGuides();
  }
}
const editor=new Editor();
document.querySelectorAll('[data-icon]').forEach(node=>icon(node,node.dataset.icon));
for(const [key,label,,symbol] of CATEGORIES){
  const b=icon(btn(label,()=>editor.selectCategory(key),{'data-category':key}),symbol);$('#categories').append(b);
}
editor.refreshDock();editor.syncButtons();
const fileInput=$('#image-input');
$('#open').onclick=()=>fileInput.click();
fileInput.onchange=()=>{const file=fileInput.files[0];fileInput.value='';if(file)editor.replaceFromHome(()=>editor.open(file))};
$('#undo').onclick=()=>editor.step();
$('#redo').onclick=()=>editor.step(true);
$('#compare').onclick=()=>editor.setMode((editor.mode+1)%4);
$('#grid').onclick=e=>{if(e.shiftKey)editor.manualGuides=[];else editor.grid=(editor.grid+1)%4;editor.updateGuides()};
$('#minus').onclick=()=>editor.setZoom(editor.zoom/1.25);$('#plus').onclick=()=>editor.setZoom(editor.zoom*1.25);$('#fit').onclick=()=>editor.setZoom(1);
$('#show-layers').onclick=()=>editor.selectCategory('layers');
$('#reset-tool').onclick=()=>editor.inspector.reset();
$('#cancel-tool').onclick=()=>editor.closeCategory(false);
$('#apply-tool').onclick=()=>editor.closeCategory();
$('#back-home').onclick=()=>{editor.closeCategory();editor.setHome(true)};
$('#welcome-open').onclick=()=>fileInput.click();
$('#open-sample').onclick=()=>editor.replaceFromHome(()=>editor.openSample());
$('#resume').onclick=()=>{editor.openToken={};editor.setHome(false)};
$('#home-help').onclick=()=>editor.dialogs.help();
$('#home-settings').onclick=()=>editor.themes.open();
$('#quick-export').onclick=()=>editor.dialogs.export(true);
for(const key of ['export','snapshots','help'])$('#'+key).onclick=()=>editor.dialogs[key]();
const touchDistance=()=>{const [a,b]=editor.touches.values();return Math.hypot(a[0]-b[0],a[1]-b[1])};
viewport.onpointerdown=e=>{
  if(e.pointerType==='touch'){
    editor.touches.set(e.pointerId,[e.clientX,e.clientY]);
    viewport.setPointerCapture(e.pointerId);
    if(editor.touches.size===2){editor.pointerUp(true);editor.pinch={distance:touchDistance(),zoom:editor.zoom}}
    if(editor.pinch||!$('#welcome').hidden)return;
  }
  editor.pointerDown(e);
};
const brushOutline=$('#brush-outline');
viewport.onpointerleave=()=>{brushOutline.hidden=true};
viewport.onpointermove=e=>{
  if(editor.category==='body'&&!editor.mode&&editor.brush.type!=='mesh'&&!editor.space&&!editor.pinch&&e.pointerType!=='touch'){
    const rect=out.getBoundingClientRect();
    brushOutline.hidden=e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom;
    if(!brushOutline.hidden){
      const diameter=editor.brush.size/100*Math.min(rect.width,rect.height);
      Object.assign(brushOutline.style,{left:(e.clientX-rect.left)+'px',top:(e.clientY-rect.top)+'px',width:diameter+'px',height:diameter+'px'});
    }
  }else brushOutline.hidden=true;

  if(editor.touches.has(e.pointerId))editor.touches.set(e.pointerId,[e.clientX,e.clientY]);
  if(editor.pinch){
    if(editor.touches.size>=2)editor.setZoom(editor.pinch.zoom*touchDistance()/Math.max(1,editor.pinch.distance));
    return;
  }
  editor.pointerMove(e);
};
function finishPointer(e,cancel=false){
  if(editor.touches.delete(e.pointerId)&&editor.pinch){
    if(!editor.touches.size)editor.pinch=null;
    return;
  }
  editor.pointerUp(cancel);
}
viewport.onpointerup=e=>finishPointer(e);
viewport.onpointercancel=e=>finishPointer(e,true);
viewport.onlostpointercapture=e=>finishPointer(e,true);
viewport.addEventListener('wheel',e=>{e.preventDefault();if($('#welcome').hidden)editor.setZoom(editor.zoom*Math.exp(-e.deltaY*.002))},{passive:false});
new ResizeObserver(()=>editor.layout()).observe(viewport);
const homeDrop=$('#home-drop'),editorDrop=$('#drop-message');
document.addEventListener('dragover',e=>{
  if(!e.dataTransfer.types.includes('Files'))return;
  e.preventDefault();
  if(!$('#welcome').hidden)homeDrop.hidden=false;
  else if(viewport.contains(e.target))editorDrop.hidden=false;
});
viewport.addEventListener('dragleave',e=>{if(!viewport.contains(e.relatedTarget))editorDrop.hidden=true});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)homeDrop.hidden=true});
document.addEventListener('drop',e=>{
  if(!e.dataTransfer.files.length)return;
  e.preventDefault();homeDrop.hidden=true;editorDrop.hidden=true;
  if($('#dialog').open)return;
  const file=e.dataTransfer.files[0];if(file)editor.replaceFromHome(()=>editor.open(file));
});
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select')||$('#dialog').open)return;
  const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(mod&&key==='o'){e.preventDefault();fileInput.click()}
  if(!$('#welcome').hidden)return;
  if(mod&&(key==='z'||key==='y')){e.preventDefault();editor.step(key==='y'||e.shiftKey)}
  if(e.code==='Space'&&!e.target.closest('button')){e.preventDefault();editor.space=true;editor.setCursor()}
  if(key==='b'&&!mod)editor.setMode(editor.mode===3?0:3);
  if(key==='escape'){if(editor.gesture)editor.pointerUp(true);else if(editor.picker||editor.cropMode){editor.picker=null;editor.cropMode=false;editor.setCursor()}else editor.closeCategory(false)}
});
document.addEventListener('keyup',e=>{if(e.code==='Space'){editor.space=false;editor.setCursor()}});
window.addEventListener('blur',()=>{editor.space=false;editor.setCursor()});
