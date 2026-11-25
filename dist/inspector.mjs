import { BASIC,BLENDS,BLEND_NAMES,COLORS,FILTERS,RATIOS,clamp,curveTables,frameDefaults,identityTransform,colorState,makeLayer,readCube } from './model.mjs';
import { BRUSH_DEFAULT,STROKES } from './render.mjs';
import { $,btn,check,el,fields,files,heading,hint,icon,input,labelled,row,select,slider,tabs } from './ui.mjs';
export const CATEGORIES=[
 ['adjust','Ajustar','Luz, color y detalle','adjust'],['filter','Filtros','Estilos cromáticos y LUT','rings'],
 ['retouch','Retoque','Textura y retoque manual','face'],['makeup','Maquillaje','Color aplicado a pincel','lipstick'],
 ['body','Cuerpo','Deformación manual con bordes protegidos','body'],['transform','Recortar','Geometría y perspectiva','crop'],
 ['pro','Color Pro','Control preciso de tonos y canales','curve'],['effects','Efectos','Texturas y superposiciones','sparkle'],
 ['text','Texto','Tipografía y firma','text'],['shapes','Stickers','Formas e imágenes','shape'],
 ['brush','Pincel','Pintura y máscaras','brush'],['layout','Collage y Marcos','Cuadrículas y acabados','grid'],
 ['library','Presets y Lotes','Ajustes guardados y herramientas de lote','batch']
];
const LAYERS=['layers','Capas','Composición y modos de fusión','stack'];
export const BRUSH_GROUPS={
 retouch:['smooth','dodge','tone','clone','heal','whiten','push','inflate','pinch','clockwise','reverse','restore','mesh'],
 makeup:['rubor','contour','highlight','shadow','liner','brows','lip','mask','unmask'],
 body:['mesh','push','stretch-x','stretch-y','squeeze-x','squeeze-y','inflate','pinch','clockwise','reverse','restore'],
 brush:['paint','dodge','erase','mask','unmask']
};
const EFFECTS=[['leak','Fuga de luz'],['dust','Polvo y rayones'],['glitch','Glitch RGB'],['aberration','Aberración radial'],['lateral','Aberración lateral'],['gobo','Sombras gobo'],['halo','Halo'],['paper','Papel / lienzo'],['prism','Prisma'],['vapor','Niebla'],['scanlines','Líneas CRT'],['bokeh','Bokeh']];
const shapes=[['rect','Rectángulo'],['circle','Círculo'],['line','Línea'],['arrow','Flecha'],['polygon','Polígono'],['star','Estrella'],['heart','Corazón']];
const modes=BLENDS.map((b,i)=>[b,BLEND_NAMES[i]]);
const textDefaults={text:'Texto',size:9,font:'sans-serif',bold:false,italic:false,align:'center',leading:120,spacing:0,color:'#f8e9dc',secondary:'#322723',gradient:false,shadow:false,box:false,stroke:0,arc:0};
export const textLayer=(text)=>makeLayer('text','Texto',{...textDefaults,text});
const defaultShape=(shape='rect')=>makeLayer('shape',shapes.find(([key])=>key===shape)[1],{shape,color:'#b59a82',secondary:'#241b16',stroke:0});
const presets={
 'Lineal':[[0,0],[1,1]],
 'Contraste en S':[[0,0],[.25,.17],[.72,.82],[1,1]],
 'Mate':[[0,.12],[.3,.26],[.74,.78],[1,.95]],
 'Aclarado':[[0,0],[.3,.47],[.75,.86],[1,1]]
};
const pct='%';
export class Inspector{
  constructor(editor){this.ed=editor;this.tab='light';this.channel=0;this.band=0;this.tone=0;this.effect=0}
  get state(){return this.ed.state}
  slide(label,value,min,max,initial,step,change,unit){
    return slider(label,value,min,max,initial,step,change,()=>this.ed.finish(),unit);
  }
  change(part,key,value,live=false){
    this.ed.update({...this.state,[part]:{...this.state[part],[key]:value}},live);
  }
  field(part,key,label,type='color'){
    return input(label,type,this.state[part][key],v=>this.change(part,key,v));
  }
  range(part,key,label,min,max,initial,step=1,unit=pct){
    return this.slide(label,this.state[part][key],min,max,initial,step,v=>this.change(part,key,v,true),unit);
  }
  render(){
    if(!this.ed.category)return;
    const data=[...CATEGORIES,LAYERS].find(([key])=>key===this.ed.category);
    $('#section-title').textContent=data[1];$('#section-subtitle').textContent=data[2];
    const body=$('#inspector-body'),key=this.ed.category;
    const offsets=[...body.querySelectorAll('.subtools,.film')].map(node=>node.scrollLeft);
    const focusKey=document.activeElement?.dataset.inspectorChoice;
    body.replaceChildren(...(this.state?this[key]():[hint('Abre una imagen para comenzar.')]));
    body.querySelectorAll('.subtools,.film').forEach((node,i)=>node.scrollLeft=offsets[i]??0);
    if(focusKey)[...body.querySelectorAll('[data-inspector-choice]')].find(node=>node.dataset.inspectorChoice===focusKey)?.focus({preventScroll:true});
  }
  choices(items,current,change){
    return el('div',{class:'subtools'},items.map(([key,label,symbol='adjust'])=>{
      const button=btn('',()=>change(key),{'aria-pressed':key===current,'data-inspector-choice':key});
      button.append(el('span',{class:'subtool-content'},icon(el('span',{}),symbol),label));
      return button;
    }));
  }
  histogram(){
    const c=el('canvas',{id:'hist',width:256,height:52,'aria-label':'Histograma RGB'});requestAnimationFrame(()=>this.ed.histogram(c));
    return el('div',{class:'histogram'},el('div',{class:'hist-head'},el('b',{},'Histograma'),el('span',{},'RGB')),c);
  }
  adjust(){
    return [...this[this.tab](),this.choices([['light','Luz','adjust'],['color','Color','rings'],['detail','Detalle','sparkle']],this.tab,key=>{this.tab=key;this.render()})];
  }
  pro(){
    const active=this.proTab??'curve';
    return [this.histogram(),...this[active](),this.choices([['curve','Curvas','curve'],['hsl','HSL','rings'],['grade','Gradación','adjust']],active,key=>{this.proTab=key;this.render()})];
  }
  layout(){
    const active=this.layoutTab??'collage';
    return [...this[active](),this.choices([['collage','Collage','grid'],['frame','Marcos','frame']],active,key=>{this.layoutTab=key;this.render()})];
  }
  library(){
    return [this.choices([['presets','Mis presets','stack'],['batch','Procesar lote','batch']],null,key=>this.ed.dialogs[key]())];
  }
  makeup(){return this.retouch()}
  body(){
    const ed=this.ed,b=ed.brush,t=b.type;
    const symbols={mesh:'adjustmesh',push:'move','stretch-x':'axisx','stretch-y':'axisy','squeeze-x':'shrink','squeeze-y':'shrinky',inflate:'expand',pinch:'shrink',clockwise:'redo',reverse:'undo',restore:'reset'};
    const tips={
      mesh:'Selecciona o arrastra un nodo interior. Los bordes de la malla quedan fijos.',
      push:'Arrastra para desplazar los píxeles alrededor del pincel.',
      'stretch-x':'Estira la zona de izquierda a derecha.', 'stretch-y':'Estira la zona de arriba abajo.',
      'squeeze-x':'Comprime la zona en el eje horizontal.', 'squeeze-y':'Comprime la zona en el eje vertical.',
      inflate:'Expande desde el centro del pincel.',pinch:'Acerca los píxeles al centro.',
      clockwise:'Gira el área en sentido horario.',reverse:'Gira el área en sentido antihorario.',
      restore:'Recupera el área de la foto original con el pincel.'
    };
    const toolbar=this.choices(BRUSH_GROUPS.body.map(key=>[key,STROKES.find(([id])=>id===key)[1],symbols[key]]),t,type=>{
      ed.brush={...ed.brush,type};ed.setMode(0);ed.setCursor();this.render();
    });
    const controls=el('div',{class:'body-actions'},
      icon(btn('Comparar',()=>{ed.setMode(ed.mode===3?0:3);this.render()},{'aria-pressed':ed.mode!==0}),'compare'),
      icon(btn('Deshacer',()=>ed.step(),{disabled:!ed.history.past.length&&!ed.pending}),'undo'),
      icon(btn('Limpiar trazos',()=>{
        ed.update({...this.state,strokes:this.state.strokes.filter(s=>s.scope!=='body'&&!s.brush.protectEdges)});this.render();
      },{disabled:!this.state.strokes.some(s=>s.scope==='body'||s.brush.protectEdges)}),'reset'));
    const description=hint(ed.mode?'Pulsa Comparar otra vez para editar.':tips[t]);
    if(t==='mesh'){
      const nodes=[6,7,8,11,12,13,16,17,18];
      const current=nodes.includes(ed.meshNode)?ed.meshNode:12;
      const arrows=[['Izquierda',-.005,0,'back'],['Arriba',0,-.005,'up'],['Abajo',0,.005,'down'],['Derecha',.005,0,'arrow']];
      const chooser=el('div',{class:'node-board',role:'group','aria-label':'Nodos de malla'},nodes.map((id,i)=>
        icon(btn('',()=>{ed.meshNode=id;ed.updateMesh();this.render()},{'aria-label':'Nodo '+(i+1),title:'Nodo '+(i+1),'aria-pressed':id===current}),'target')));
      const movement=el('div',{class:'row'},arrows.map(([label,x,y,symbol])=>icon(btn('',()=>{
        const [a,b]=ed.state.mesh?.[current]??[(current%5)/4,Math.floor(current/5)/4];ed.moveMeshNode(current,a+x,b+y);this.render();
      },{class:'round','aria-label':label,title:label,disabled:!ed.meshEnabled()}),symbol)));
      return [toolbar,el('div',{class:'body-mesh'},chooser,el('div',{class:'fields'},movement,
        icon(btn('Restablecer malla',()=>{ed.update({...this.state,mesh:null});this.render()},{disabled:!this.state.mesh}),'reset'))),
        controls,ed.meshEnabled()||ed.mode?description:hint('Devuelve el recorte, giro y marco a su posición inicial para editar la malla.')];
    }
    const sliders=[['size','Tamaño',1,38],['strength','Intensidad',1,100],['hardness','Dureza',0,100],
      ['opacity','Opacidad',1,100],['flow','Flujo',1,100],['smoothing','Suavidad del trazo',0,90]];
    return [toolbar,...sliders.filter(([key])=>t!=='restore'||key!=='strength').map(([key,label,min,max])=>
      slider(label,b[key],min,max,BRUSH_DEFAULT[key],1,value=>{ed.brush={...ed.brush,[key]:value}},null,pct)),
      el('div',{class:'body-actions'},t!=='restore'?icon(btn('Proteger bordes',()=>{ed.brush={...ed.brush,edge:!b.edge};this.render()},{'aria-pressed':b.edge}),'shield'):null,
        t==='push'?this.choices([['free','Libre','move'],['x','Horizontal','axisx'],['y','Vertical','axisy']],b.direction,value=>{ed.brush={...ed.brush,direction:value};this.render()}):null),
      controls,description];
  }
  brush(){return this.retouch()}
  basics(items,title){
    const state=this.state.color;
    return [heading(title),...BASIC.filter(([k])=>items.includes(k)).map(([id,label,lo,hi,initial,step=1])=>
      this.slide(label,state.basic[id],lo,hi,initial,step,val=>this.change('color','basic',{...this.state.color.basic,[id]:val},true),id==='exposure'?' EV':''))];
  }
  light(){return this.basics(['exposure','brightness','contrast','highlights','shadows','whites','blacks'],'Luz y contraste')}
  color(){return this.basics(['temperature','tint','saturation','vibrance'],'Color')}
  detail(){return [...this.basics(['clarity','sharpness','structure','vignette','blur','grain','grainSize','roughness'],'Detalle y textura'),
    fields(select('Tipo de desenfoque',[['gaussian','Gaussiano'],['lens','Lente'],['radial','Radial']],this.state.color.blurType,v=>this.change('color','blurType',v)))];}
  curve(){
    const graph=el('canvas',{class:'curves',width:320,height:214,'aria-label':'Editor de curva. Arrastra nodos y usa clic secundario para borrarlos.'});
    const ch=this.channel;
    const draw=()=>{
      const ctx=graph.getContext('2d'),w=graph.width,h=graph.height,p=9,ww=w-p*2,hh=h-p*2,nodes=this.state.color.curves[ch];
      ctx.clearRect(0,0,w,h);
      const bins=this.ed.bins?.[ch?ch-1:1];
      if(bins){
        ctx.fillStyle='#a8948040';const peak=Math.max(1,...bins);
        bins.forEach((n,i)=>ctx.fillRect(p+i/64*ww,h-p-n/peak*hh,ww/64+1,n/peak*hh));
      }
      ctx.strokeStyle='#ffffff21';
      for(let i=0;i<=4;i++){
        ctx.beginPath();ctx.moveTo(p+i*ww/4,p);ctx.lineTo(p+i*ww/4,h-p);ctx.moveTo(p,p+i*hh/4);ctx.lineTo(w-p,p+i*hh/4);ctx.stroke();
      }
      ctx.strokeStyle=['#ead2bc','#ec847b','#8bcba1','#8da9e2'][ch];ctx.lineWidth=2;ctx.beginPath();
      curveTables([nodes])[0].forEach((v,i)=>ctx.lineTo(p+i/255*ww,p+(1-v)*hh));ctx.stroke();
      ctx.fillStyle=ctx.strokeStyle;
      nodes.forEach(([x,y])=>{ctx.beginPath();ctx.arc(p+x*ww,p+(1-y)*hh,4,0,Math.PI*2);ctx.fill()});
    };
    const coords=e=>{
      const r=graph.getBoundingClientRect(),p=9;
      return [clamp(((e.clientX-r.left)/r.width*graph.width-p)/(graph.width-2*p)),clamp(1-((e.clientY-r.top)/r.height*graph.height-p)/(graph.height-2*p))];
    };
    const closest=(nodes,x,y)=>nodes.findIndex(([a,b])=>Math.hypot(a-x,b-y)<.066);
    const set=(nodes,live=false)=>{
      this.change('color','curves',this.state.color.curves.map((row,i)=>i===ch?nodes:row),live);
      draw();
    };
    let active=-1;
    graph.onpointerdown=e=>{
      if(e.button!==0)return;
      const [x,y]=coords(e),nodes=this.state.color.curves[ch].map(v=>[...v]);active=closest(nodes,x,y);
      if(active<0){
        if(nodes.some(([a])=>Math.abs(a-x)<.023)||nodes.length>=20)return;
        active=nodes.findIndex(([a])=>a>x);nodes.splice(active,0,[x,y]);set(nodes,true);
      }
      graph.setPointerCapture(e.pointerId);
    };
    graph.onpointermove=e=>{
      if(active<0)return;
      const [x,y]=coords(e),nodes=this.state.color.curves[ch].map(v=>[...v]);
      const xx=active===0?0:active===nodes.length-1?1:clamp(x,nodes[active-1][0]+.012,nodes[active+1][0]-.012);
      nodes[active]=[xx,y];set(nodes,true);
    };
    graph.onlostpointercapture=()=>{active=-1;this.ed.finish()};
    graph.oncontextmenu=e=>{
      e.preventDefault();const nodes=this.state.color.curves[ch],active=closest(nodes,...coords(e));
      if(active>0&&active<nodes.length-1)set(nodes.filter((_,i)=>i!==active));
    };
    requestAnimationFrame(draw);
    return [tabs(['RGB','R','G','B'].map((k,i)=>[i,k]),ch,i=>{this.channel=i;this.render()}),graph,hint('Clic para añadir. Arrastra para ajustar. Clic secundario para eliminar.'),fields(select('Preset de curva',[['','Personalizada'],...Object.keys(presets)],'',v=>{if(v)set(presets[v])}))];
  }
  hsl(){
    const k=this.band;
    const swatches=['#ed626b','#f89e65','#f0d56e','#70d093','#62dbd6','#7d9bf6','#aa85eb','#e87fd1'];
    return [el('div',{class:'color-bands','aria-label':'Rangos de color'},COLORS.map((label,i)=>{
      const button=btn(label,()=>{this.band=i;this.render()},{'aria-pressed':i===k,'data-inspector-choice':'hsl-'+i});
      button.prepend(el('span',{class:'color-chip',style:'--swatch:'+swatches[i],'aria-hidden':'true'}));return button;
    })),
      row(icon(btn('Muestrear color',()=>this.ed.enablePicker('hsl')),'target')),
      ...[['Tono',180,'°'],['Saturación',100,pct],['Luminancia',100,pct]].map(([label,max,unit],i)=>
        this.slide(label,this.state.color.hsl[k][i],-max,max,0,1,v=>{
          const next=this.state.color.hsl.map((vs,j)=>j===k?vs.map((n,z)=>i===z?v:n):vs);
          this.change('color','hsl',next,true);
        },unit))];
  }
  grade(){
    const options=['Sombras','Medios','Luces'],k=this.tone;
    return [tabs(options.map((label,i)=>[i,label]),k,i=>{this.tone=i;this.render()}),
      ...[['Tono',0,360,'°'],['Saturación',0,100,pct],['Luminancia',-100,100,pct]].map(([label,min,max,unit],i)=>
        this.slide(label,this.state.color.grade[k][i],min,max,0,1,v=>{
          this.change('color','grade',this.state.color.grade.map((vs,j)=>j===k?vs.map((n,z)=>i===z?v:n):vs),true);
        },unit)),this.range('color','balance','Balance',-100,100,0)];
  }
  filter(){
    this.ed.makeFilm();
    const s=this.state.color,groups=[...new Set(FILTERS.map(f=>f[2]))];
    const cards=FILTERS.filter(f=>!this.family||this.family==='Todas'||f[2]===this.family).map(([id,label])=>{
      const card=btn('',()=>{this.change('color','filter',id);this.render()},{class:'film-item','aria-pressed':s.filter===id});
      card.append(el('img',{src:this.ed.thumbnails.get(id),alt:''}),el('span',{},label));
      return card;
    });
    return [this.range('color','filterMix','Intensidad',0,100,100),
      fields(select('Familia',['Todas',...groups],this.family??'Todas',v=>{this.family=v;this.render()})),
      el('div',{class:'film','aria-label':'Catálogo de filtros'},cards),heading('LUT 3D'),
      fields(files('Importar .cube','.cube',false,async ([file])=>{
        if(!file)return;
        const session=this.ed.session;
        try{const lut=readCube(await file.text());if(this.ed.session!==session)return;this.change('color','lut',{...lut,name:file.name});this.render()}catch(e){this.ed.message(e.message)}
      })),
      s.lut?row(el('span',{class:'badge'},s.lut.name??'LUT'),btn('Quitar',()=>{this.change('color','lut',null);this.render()})):null,
      this.range('color','lutMix','Intensidad LUT',0,100,100)].filter(Boolean);
  }
  transform(){
    const t=this.state.transform;
    const toggle=k=>{this.change('transform',k,!this.state.transform[k]);this.render()};
    const rotate=angle=>{this.change('transform','rotation',((t.rotation+angle+540)%360)-180);this.render()};
    return [this.choices(RATIOS.map(ratio=>[ratio,ratio,'frame']),t.ratio,value=>this.ed.changeRatio(value)),
      row(icon(btn('Dibujar recorte',()=>this.ed.enableCrop(),{'aria-pressed':this.ed.cropMode}),'crop'),
        icon(btn('Reencuadrar',()=>{this.change('transform','crop',[0,0,1,1]);this.render()}),'expand')),
      row(icon(btn('90°',()=>rotate(-90),{'aria-label':'Girar 90 grados a la izquierda'}),'undo'),
        icon(btn('90°',()=>rotate(90),{'aria-label':'Girar 90 grados a la derecha'}),'redo')),
      this.range('transform','rotation','Rotación / horizonte',-180,180,0,.1,'°'),
      row(btn('Voltear H',()=>toggle('flipX'),{'aria-pressed':t.flipX}),btn('Voltear V',()=>toggle('flipY'),{'aria-pressed':t.flipY})),
      this.range('transform','skewX','Perspectiva horizontal',-55,55,0),this.range('transform','skewY','Perspectiva vertical',-55,55,0)];
  }
  retouch(){
    const ed=this.ed,b=ed.brush,t=b.type;
    const setter=(key,v)=>{ed.brush={...ed.brush,[key]:v}};
    const group=BRUSH_GROUPS[ed.category];
    const choice=this.choices(group.map(key=>[key,STROKES.find(([id])=>id===key)[1],key==='mesh'?'grid':'brush']),t,v=>{setter('type',v);ed.setMode(0);ed.setCursor();this.render()});
    if(t==='mesh')return [fields(choice),hint('Arrastra los nodos interiores para deformar la región. La malla se ajusta sobre la imagen sin recorte ni marco.'),
      btn('Restablecer malla',()=>ed.update({...this.state,mesh:null}),{disabled:!this.state.mesh})];
    return [fields(input('Color de pincel','color',b.color,v=>setter('color',v)),row(btn('Cuentagotas',()=>ed.enablePicker('brush')),
      ...['#e6c6a6','#b47d79','#8b514f','#65433e'].map(color=>btn('●',()=>{setter('color',color);this.render()},{title:color,style:'color:'+color,'aria-label':'Muestra '+color}))),
      ...[['size','Tamaño',1,38],['hardness','Dureza',0,100],['opacity','Opacidad',1,100],['flow','Flujo',1,100],['smoothing','Suavizado de trazo',0,90],['strength','Fuerza / radio',1,100]].map(([key,label,min,max])=>
        slider(label,b[key],min,max,BRUSH_DEFAULT[key],1,v=>setter(key,v),null,pct)),
      ['clone','heal'].includes(t)?row(btn('Definir origen',()=>ed.enablePicker('anchor')),hint(ed.anchor?'Origen fijado':'Alt / Option + clic para muestrear.')):hint('Pinta directamente sobre la imagen. Usa Espacio para mover el lienzo.')),choice];
  }
  effects(){
    const ed=this.ed,list=this.state.effects;
    const update=(key,value,live=false)=>ed.update({...this.state,effects:this.state.effects.map((fx,i)=>i===this.effect?{...fx,[key]:value}:fx)},live);
    const current=list[this.effect];
    const add=type=>{
      this.effect=list.length;
      const blend=['glitch','aberration','lateral','gobo'].includes(type)?'source-over':type==='scanlines'?'multiply':'screen';
      ed.update({...this.state,effects:[...list,{type,opacity:55,x:.5,y:.5,scale:1,rotation:0,blend}]});this.render();
    };
    return [current?fields(select('Efecto activo',list.map((f,i)=>[String(i),EFFECTS.find(([type])=>type===f.type)[1]+' '+(i+1)]),String(this.effect),v=>{this.effect=Number(v);this.render()}),
      ...[['opacity','Opacidad',0,100,55],['scale','Escala',.1,3,1,.01],['x','Posición X',0,1,.5,.01],['y','Posición Y',0,1,.5,.01],['rotation','Rotación',-180,180,0]].map(([k,label,min,max,initial,step=1])=>
        this.slide(label,current[k],min,max,initial,step,v=>update(k,v,true))),
      select('Fusión',modes,current.blend,v=>update('blend',v)),btn('Eliminar efecto',()=>{
        ed.update({...this.state,effects:list.filter((_,i)=>i!==this.effect)});this.effect=0;this.render();
      })):hint('Añade una superposición a la imagen.'),this.choices(EFFECTS.map(([key,label])=>[key,label,'sparkle']),current?.type,add)];
  }
  selected(kind){return this.state.layers.find(l=>l.id===this.ed.selected&&(!kind||l.type===kind))}
  patchLayer(id,key,value,live=false){
    this.ed.update({...this.state,layers:this.state.layers.map(layer=>layer.id===id?{...layer,[key]:value}:layer)},live);
  }
  addLayer(layer){
    this.ed.selected=layer.id;
    this.ed.update({...this.state,layers:[...this.state.layers,layer]});this.render();
  }
  layerParams(layer){
    const set=(k,v,live)=>this.patchLayer(layer.id,k,v,live);
    return [input('Nombre','text',layer.label,v=>{set('label',v);this.render()}),
      ...[['opacity','Opacidad',0,100,100],['x','Posición X',0,1,.5,.01],['y','Posición Y',0,1,.5,.01],['scale','Escala',.05,4,1,.01],['rotation','Rotación',-180,180,0]].filter(([k])=>layer.type!=='paint'||k==='opacity').map(([k,label,min,max,initial,step=1])=>this.slide(label,layer[k],min,max,initial,step,v=>set(k,v,true))),
      select('Modo de fusión',modes,layer.blend,v=>set('blend',v))];
  }
  layers(){
    const ed=this.ed,layers=this.state.layers,selected=this.selected();
    const reorder=(id,offset=null,target=null)=>{
      const next=[...this.state.layers],i=next.findIndex(l=>l.id===id);
      if(i<0)return;
      const adjust=target===null?clamp(i+offset,0,next.length-1):next.findIndex(l=>l.id===target);
      if(adjust<0||i===adjust)return;
      next.splice(adjust,0,next.splice(i,1)[0]);ed.update({...this.state,layers:next});this.render();
    };
    const list=el('div',{class:'layer-list'},[...layers].reverse().map(layer=>el('div',{class:'layer-row '+(layer===selected?'selected':''),draggable:'true',
      ondragstart:e=>e.dataTransfer.setData('text/plain',layer.id),
      ondragover:e=>e.preventDefault(),ondrop:e=>{e.preventDefault();e.stopPropagation();reorder(e.dataTransfer.getData('text/plain'),null,layer.id)}},
      btn(layer.label,()=>{ed.selected=layer.id;this.render()}),
      icon(btn('',()=>{this.patchLayer(layer.id,'visible',!layer.visible);this.render()},{'aria-label':'Cambiar visibilidad','aria-pressed':layer.visible,title:'Visibilidad'}),'eye'),
      icon(btn('',()=>{this.patchLayer(layer.id,'locked',!layer.locked);this.render()},{'aria-label':'Bloquear o desbloquear','aria-pressed':layer.locked,title:'Bloqueo'}),'lock'))));
    const buttons=row(btn('Pintura',()=>this.addLayer(makeLayer('paint','Pintura'))),btn('Texto',()=>this.addLayer(textLayer('Texto'))),btn('Forma',()=>this.addLayer(defaultShape())));
    const actions=selected?row(btn('↑',()=>reorder(selected.id,1),{'aria-label':'Subir capa'}),btn('↓',()=>reorder(selected.id,-1),{'aria-label':'Bajar capa'}),
      btn('Duplicar',()=>{
        const copy={...selected,id:crypto.randomUUID(),label:selected.label+' copia'};
        ed.selected=copy.id;
        ed.update({...this.state,layers:[...layers,copy],strokes:[...this.state.strokes,...this.state.strokes.filter(s=>s.layer===selected.id).map(s=>({...s,layer:copy.id}))]});this.render();
      }),btn('Eliminar',()=>{
        ed.update({...this.state,layers:layers.filter(l=>l!==selected),strokes:this.state.strokes.filter(s=>s.layer!==selected.id)});
        ed.selected=null;this.render();
      },{disabled:selected.locked})):null;
    return [buttons,fields(files('Añadir capa de imagen','image/*',false,async ([file])=>{
      if(!file)return;
      const session=ed.session;
      try{const id=await ed.addAsset(file);if(ed.session!==session){ed.release(id);return}this.addLayer(makeLayer('image',file.name,{asset:id}))}catch(e){ed.message(e.message)}
    })),heading('Pila de capas'),list,actions,selected?(selected.locked?hint('Capa bloqueada.'):fields(...this.layerParams(selected))):hint('Elige un tipo para añadir una capa.')].filter(Boolean);
  }
  text(){
    const layer=this.selected('text'),controls=[btn('Añadir texto',()=>this.addLayer(textLayer('Texto')),{class:'primary'})];
    if(!layer||layer.locked)return [...controls,hint(layer?.locked?'Desbloquea la capa en Capas.':'Selecciona una capa de texto para editarla.')];
    const set=(k,v,live)=>this.patchLayer(layer.id,k,v,live);
    return [...controls,fields(labelled('Contenido',el('textarea',{rows:3,value:layer.text,onchange:e=>set('text',e.target.value)})),
      select('Tipografía',[['sans-serif','Sans serif'],['serif','Serif'],['monospace','Monoespaciada'],['Georgia','Georgia'],['Verdana','Verdana'],['Arial','Arial']],layer.font,v=>set('font',v)),
      row(check('Negrita',layer.bold,v=>set('bold',v)),check('Cursiva',layer.italic,v=>set('italic',v))),
      select('Alineación',[['left','Izquierda'],['center','Centro'],['right','Derecha']],layer.align,v=>set('align',v)),
      ...[['size','Tamaño',1,35,9],['leading','Interlineado',60,240,120],['spacing','Espaciado',-20,50,0],['stroke','Trazo',0,18,0],['arc','Arco',-175,175,0]].map(([k,label,min,max,initial])=>
        this.slide(label,layer[k],min,max,initial,1,v=>set(k,v,true))),
      input('Color de texto','color',layer.color,v=>set('color',v)),input('Color secundario','color',layer.secondary,v=>set('secondary',v)),
      row(check('Degradado',layer.gradient,v=>set('gradient',v)),check('Sombra',layer.shadow,v=>set('shadow',v)),check('Fondo',layer.box,v=>set('box',v))),
      ...this.layerParams(layer))];
  }
  shapes(){
    const layer=this.selected('shape')??this.selected('image');
    const controls=fields(files('Importar imagen como sticker','image/*',false,async ([file])=>{
      if(!file)return;
      const session=this.ed.session;
      try{
        const id=await this.ed.addAsset(file);
        if(this.ed.session!==session){this.ed.release(id);return}
        this.addLayer(makeLayer('image',file.name,{asset:id}));
      }catch(e){this.ed.message(e.message)}
    }),select('Añadir forma o sticker',[['','Seleccionar…'],...shapes],'',shape=>{if(shape)this.addLayer(defaultShape(shape))}));
    if(!layer||layer.locked)return [controls,hint(layer?.locked?'Desbloquea la capa en Capas.':'Elige una forma para editar sus atributos.')];
    if(layer.type==='image')return [controls,...this.layerParams(layer)];
    const set=(k,v,live)=>this.patchLayer(layer.id,k,v,live);
    return [controls,fields(input('Relleno','color',layer.color,v=>set('color',v)),input('Contorno','color',layer.secondary,v=>set('secondary',v)),
      this.slide('Grosor del trazo',layer.stroke,0,45,0,1,v=>set('stroke',v,true)),...this.layerParams(layer))];
  }
  collage(){
    const ed=this.ed,c=this.state.collage;
    const selectImages=files('Añadir fotos al collage','image/*',true,async photos=>{
      const session=ed.session;
      try{
        const assets=await Promise.allSettled(photos.map(file=>ed.addAsset(file)));
        const ids=assets.filter(item=>item.status==='fulfilled').map(item=>item.value);
        if(ed.session!==session){ids.forEach(id=>ed.release(id));return}
        if(assets.some(item=>item.status==='rejected'))ed.message('No se pudieron abrir todas las fotos del collage.');
        if(!ids.length)return;
        const base=this.state.collage??{cols:2,ratio:'1:1',gap:3,radius:7,background:'#292322',pattern:false,assets:[this.state.source]};
        ed.update({...this.state,collage:{...base,assets:[...base.assets,...ids]},transform:identityTransform()});this.render();
      }catch(e){ed.message(e.message)}
    });
    return [fields(selectImages,c?fields(select('Columnas',[1,2,3,4,5,6].map(n=>[String(n),String(n)]),String(c.cols),v=>this.change('collage','cols',Number(v))),
      select('Proporción del lienzo',RATIOS.slice(1),c.ratio,v=>this.change('collage','ratio',v)),
      this.range('collage','gap','Separación',0,12,3),this.range('collage','radius','Radio',0,45,7),this.field('collage','background','Fondo'),
      check('Patrón punteado',c.pattern,v=>this.change('collage','pattern',v)),
      ...c.assets.map((id,i)=>row(hint(ed.assets.get(id).name),btn('Quitar',()=>{
        ed.update({...this.state,collage:{...this.state.collage,assets:this.state.collage.assets.filter((_,j)=>j!==i)}});this.render();
      },{disabled:c.assets.length===1})))):hint('Añade fotos a una cuadrícula o monta un collage libre con capas de imagen.'),btn('Retirar cuadrícula',()=>{
        ed.update({...this.state,collage:null,transform:identityTransform()});this.render();
      },{disabled:!c}))];
  }
  frame(){
    return [fields(select('Estilo',[['none','Sin marco'],['solid','Borde'],['polaroid','Polaroid'],['blur','Desenfoque exterior']],this.state.frame.style,v=>this.change('frame','style',v)),this.field('frame','color','Color')),
      this.range('frame','width','Grosor',0,21,5),this.range('frame','radius','Radio interior',0,48,0),
      heading('Bordes individuales'),...['Superior','Derecho','Inferior','Izquierdo'].map((label,i)=>this.slide(label,this.state.frame.edges[i],0,1.5,1,.01,v=>{
        this.change('frame','edges',this.state.frame.edges.map((n,j)=>j===i?v:n),true);
      }))];
  }
  reset(){
    const ed=this.ed,state=this.state,fresh=colorState();
    if(!state)return;
    let next={...state};
    const category=ed.category==='layout'?(this.layoutTab??'collage'):ed.category;
    if(category==='pro'){
      const key={curve:'curves',hsl:'hsl',grade:'grade'}[this.proTab??'curve'];
      next.color={...state.color,[key]:fresh[key]};if(key==='grade')next.color.balance=0;
    }else if(category==='adjust'){
      const keys={light:BASIC.slice(0,7),color:BASIC.slice(7,11),detail:BASIC.slice(11)};
      next.color={...state.color};
      if(keys[this.tab]){
        next.color.basic={...state.color.basic};
        for(const [k] of keys[this.tab])next.color.basic[k]=fresh.basic[k];
        if(this.tab==='detail')next.color.blurType=fresh.blurType;
      }else{const key={curve:'curves',hsl:'hsl',grade:'grade'}[this.tab];next.color[key]=fresh[key];if(key==='grade')next.color.balance=0}
    }else if(category==='transform')next.transform=identityTransform();
    else if(category==='frame')next.frame=frameDefaults();
    else if(category==='filter')next.color={...state.color,filter:'original',filterMix:100,lut:null,lutMix:100};
    else if(BRUSH_GROUPS[category]){ed.brush={...BRUSH_DEFAULT,type:BRUSH_GROUPS[category][0]};ed.anchor=null;this.render();return}
    else if(category==='collage'){next.collage=null;next.transform=identityTransform()}
    else if(category==='effects')next.effects=[];
    else if(['layers','text','shapes'].includes(category)){
      const layer=this.selected();
      if(!layer||layer.locked)return;
      const basis=layer.type==='text'?textLayer(layer.text):layer.type==='shape'?defaultShape(layer.shape):makeLayer(layer.type,layer.label);
      next.layers=next.layers.map(l=>l===layer?{...l,...basis,id:l.id,label:l.label}:l);
    }
    ed.update(next);this.render();
  }
}
