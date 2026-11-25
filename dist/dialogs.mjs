import { $,btn,check,el,fields,files,hint,input,labelled,row,select } from './ui.mjs';
import { makeProject,ratioCrop,RATIOS } from './model.mjs';
import { textLayer } from './inspector.mjs';
import { Renderer,canvas,transformedSize } from './render.mjs';
import { decode,download,encode,keepExif,safeName,zip } from './files.mjs';
import { normalizePreset,presetOp } from './presets.mjs';

const formats=[['image/png','PNG'],['image/jpeg','JPG'],['image/webp','WebP']];
const extension=type=>type==='image/jpeg'?'jpg':type.split('/')[1];
const options=()=>({type:'image/png',quality:92,scale:'1',width:1,height:1,exif:false});
const previewPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export class Dialogs{
  constructor(editor){
    this.ed=editor;this.modal=$('#dialog');this.body=$('#dialog-body');this.settings=options();
    $('#close-dialog').onclick=()=>this.modal.close();
  }
  show(title,...content){
    $('#dialog-title').textContent=title;this.body.replaceChildren(...content.filter(Boolean));
    if(!this.modal.open)this.modal.showModal();
  }
  hasImage(){if(!this.ed.state){this.ed.message('Abre una imagen para continuar.');return false}return true}
  formatControls(config,redraw){
    const exact=config.scale==='exact';
    return fields(select('Formato',formats,config.type,v=>{config.type=v;redraw()}),
      config.type!=='image/png'?input('Calidad (1–100)','number',config.quality,v=>config.quality=v,{min:1,max:100}):null,
      select('Escala',[['0.5','0.5×'],['1','1×'],['2','2×'],['3','3×'],['4','4×'],['4k','4K · lado largo 3840 px'],['exact','Dimensiones exactas']],config.scale,v=>{config.scale=v;redraw()}),
      exact?row(input('Ancho (px)','number',config.width,v=>config.width=v,{min:1,step:1}),input('Alto (px)','number',config.height,v=>config.height=v,{min:1,step:1})):null,
      check('Conservar metadatos EXIF',config.exif,v=>{config.exif=v;redraw()}),
      config.exif?hint('Si conservas EXIF, el archivo puede incluir la ubicación de captura.'):null);
  }
  async encodeState(renderer,state,config,target){
    const [baseW,baseH]=renderer.layout(state),[w,h]=transformedSize(baseW,baseH,state.transform);
    const scale=config.scale==='4k'?3840/Math.max(w,h):Number(config.scale);
    const [width,height]=config.scale==='exact'?[config.width,config.height]:[Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale))];
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw new Error('Introduce dimensiones enteras positivas.');
    if(config.type!=='image/png'&&(!Number.isFinite(config.quality)||config.quality<1||config.quality>100))throw new Error('Introduce una calidad de 1 a 100.');
    const limit=Math.ceil(Math.max(baseW,baseH)*Math.min(1,Math.max(width/w,height/h)));
    renderer.draw(state,target,{dimensions:[width,height],limit});
    const blob=await encode(target,config.type,config.quality/100);
    return config.exif?keepExif(blob,renderer.assets.get(state.source).file,width,height):{blob,retained:false};
  }
  export(quick=false){
    if(!this.hasImage())return;
    const ed=this.ed,cfg={...this.settings};
    const [w,h]=ed.renderer.layout(ed.state);if(cfg.scale!=='exact')[cfg.width,cfg.height]=transformedSize(w,h,ed.state.transform);
    const status=el('p',{class:'hint',role:'status'});
    const draw=()=>{
      const run=btn('Descargar imagen',async ()=>{
        run.disabled=true;status.textContent='Renderizando…';
        try{
          ed.finish();await previewPaint();
          const {blob,retained}=await this.encodeState(ed.renderer,ed.state,cfg,canvas());
          this.saveExportSettings(cfg);download(blob,'lumay_edit_'+safeName(ed.assets.get(ed.state.source).name)+'.'+extension(cfg.type));
          status.textContent=cfg.exif&&!retained?'Exportada. No se pudo transferir EXIF del original.':'Imagen exportada.';
        }catch(e){status.textContent=e.message}
        finally{run.disabled=false}
      },{class:'primary'});
      this.show(quick?'Resolución y formato':'Exportar imagen',this.formatControls(cfg,draw),
        quick?btn('Guardar opciones',()=>{this.saveExportSettings(cfg);this.modal.close()}):null,run,status);
    };
    draw();
  }
  saveExportSettings(cfg){
    this.settings={...cfg};
    $('#quick-export').textContent=(cfg.scale==='4k'?'4K':'HQ')+' · '+extension(cfg.type).toUpperCase();
  }
  snapshots(){
    if(!this.hasImage())return;
    const ed=this.ed,history=ed.history;
    const draw=()=>{
      const name=el('input',{type:'text',placeholder:'Nombre del snapshot',maxlength:120});
      const save=()=>{
        ed.finish();history.snapshot(name.value.trim()||'Snapshot '+(history.snapshots.length+1));draw();
      };
      const list=history.snapshots.map((snap,i)=>row(
        el('span',{},snap.name),
        btn('Comparar',()=>{ed.reference=snap;ed.setMode(1);this.modal.close()}),
        btn('Restaurar',()=>{ed.update(snap.state);ed.inspector.render();this.modal.close();ed.message('Snapshot restaurado.')}),
        btn('Quitar',()=>{history.snapshots.splice(i,1);draw()})));
      this.show('Historial y snapshots',row(name,btn('Capturar',save,{class:'primary'})),el('div',{class:'saved-list'},list),
        ...(ed.reference?[btn('Volver a comparar con el original',()=>{ed.reference=null;ed.setMode(1);this.modal.close()})]:[]),
        hint('Los snapshots se conservan mientras este proyecto está abierto.'),btn('Restablecer toda la edición',()=>{
          ed.closeCategory();ed.update(makeProject(ed.state.source));ed.selected=null;ed.anchor=null;
          this.modal.close();ed.message('Ajustes restablecidos. Puedes deshacer el cambio.');
        }));
    };
    draw();
  }
  async presets(){
    if(!this.hasImage())return;
    let list=[],current='';
    const ed=this.ed,status=el('p',{class:'hint',role:'status'}),records=el('div',{class:'saved-list'});
    const drawList=()=>{
      const entries=list.filter(p=>[p.name,...p.tags].join(' ').toLowerCase().includes(current));
      records.replaceChildren(...(entries.length?entries.map(p=>row(
        btn(p.name,()=>{
          ed.update({...ed.state,color:p.color,frame:p.frame});ed.inspector.render();this.modal.close();ed.message('Preset aplicado.');
        },{title:p.tags.join(', ')}),
        btn('JSON',()=>download(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),safeName(p.name)+'.json')),
        btn('×',()=>act(()=>presetOp('delete',p.id)),{'aria-label':'Eliminar preset '+p.name}))):[hint('Sin presets para esta búsqueda.')]));
    };
    const act=async fn=>{
      try{await fn();list=await presetOp('getAll');status.textContent='';drawList()}
      catch(e){status.textContent=e.message}
    };
    const name=el('input',{type:'text',maxlength:120,placeholder:'Paisaje cálido'}),tags=el('input',{type:'text',maxlength:250,placeholder:'paisaje, cine'});
    this.show('Biblioteca de presets',fields(labelled('Nombre',name),labelled('Etiquetas',tags),
      btn('Guardar ajustes actuales',()=>act(()=>presetOp('put',normalizePreset({version:1,name:name.value,tags:tags.value.split(','),color:ed.state.color,frame:ed.state.frame}))),{class:'primary'}),
      files('Importar preset JSON','.json,application/json',false,([file])=>{if(file)act(async()=>presetOp('put',normalizePreset(JSON.parse(await file.text()))))}),
      labelled('Buscar',el('input',{type:'search',placeholder:'Nombre o etiqueta',oninput:e=>{current=e.target.value.toLowerCase();drawList()}}))),
      status,records);
    await act(()=>Promise.resolve());
  }
  async batch(){
    const ed=this.ed;if(!this.hasImage())return;
    const choices=await presetOp('getAll').catch(()=>[]),queue={files:[],preset:'current',ratio:'Libre',signature:'',frame:true,working:false};
    const cfg={...options(),type:'image/jpeg'};
    const status=el('p',{class:'hint',role:'status'}),progress=el('progress',{max:1,value:0}),count=el('span',{},'0 imágenes');
    const setStatus=(text,value)=>{status.textContent=text;progress.value=value};
    const draw=()=>{
      this.show('Batch Studio',fields(
        files('Imágenes del lote','image/*',true,items=>{queue.files=items;count.textContent=items.length+' imágenes'}),
        count,select('Preset',[['current','Ajustes actuales'],['none','Original'],...choices.map(p=>[p.id,p.name])],queue.preset,v=>queue.preset=v),
        select('Recorte centrado',RATIOS,queue.ratio,v=>queue.ratio=v),
        input('Firma de texto opcional','text',queue.signature,v=>queue.signature=v),
        check('Aplicar marco seleccionado',queue.frame,v=>queue.frame=v)),
        this.formatControls(cfg,draw),btn('Procesar y descargar ZIP',()=>run(),{class:'primary',disabled:queue.working}),progress,status);
    };
    const run=async()=>{
      if(queue.working)return;
      if(!queue.files.length){setStatus('Selecciona una o más imágenes.',0);return}
      queue.working=true;
      const config={...cfg},job={...queue},project=ed.state,chosen=choices.find(p=>p.id===job.preset);
      const color=job.preset==='current'?project.color:chosen?.color;
      const frame=job.frame?(chosen?.frame??project.frame):null;
      const target=canvas(),assets=new Map(),renderer=new Renderer(assets),results=[],failures=[];
      setStatus('Preparando imágenes…',0);
      const action=Array.from(this.body.querySelectorAll('button,input,select')).filter(node=>!node.disabled);
      action.forEach(node=>node.disabled=true);
      try{
        for(const [i,file] of job.files.entries()){
          if(!this.modal.open)break;
          setStatus((i+1)+' / '+job.files.length+' · '+file.name,i/job.files.length);
          await previewPaint();
          let image;
          try{
            image=await decode(file);assets.set(i,{image,file,name:file.name});
            const state=makeProject(i);
            if(color)state.color=color;if(frame)state.frame=frame;
            state.transform={...state.transform,ratio:job.ratio,crop:ratioCrop(image.width,image.height,job.ratio)};
            if(job.signature.trim())state.layers=[{...textLayer(job.signature),size:4,y:.92}];
            const {blob}=await this.encodeState(renderer,state,config,target);
            results.push({name:'lumay_edit_'+String(i+1).padStart(3,'0')+'_'+safeName(file.name)+'.'+extension(config.type),blob});
          }catch(e){failures.push(file.name+' ('+e.message+')')}
          finally{image?.close?.();assets.delete(i)}
        }
        if(!this.modal.open)return;
        if(!results.length)throw new Error('No se pudo exportar ninguna imagen. '+failures.join(', '));
        const archive=await zip(results);
        download(archive,'lumay_edit_lote.zip');
        setStatus(results.length+' exportadas.'+(failures.length?' Fallaron '+failures.join(', '):''),1);
      }catch(e){setStatus(e.message,0)}
      finally{queue.working=false;action.forEach(node=>node.disabled=false)}
    };
    draw();
  }
  help(){
    this.show('Ayuda de Lumay',hint('Ctrl / ⌘ + O abre una imagen. También puedes arrastrarla al lienzo.'),
      hint('Ctrl / ⌘ + Z deshace. Ctrl / ⌘ + Mayús + Z o Ctrl / ⌘ + Y rehace.'),
      hint('Pellizca o usa la rueda para ampliar. Arrastra para mover el lienzo cuando no estés pintando. B alterna entre la vista de referencia y la editada.'),
      hint('Mayús + clic añade una guía vertical. Mayús + Alt + clic añade una horizontal. Mayús + clic en Cuadrícula borra las guías.'),
      hint('Usa Alt / Option + clic para fijar el origen de clonación o corrección. El borrador afecta a los trazos pintados.'));
  }
}
