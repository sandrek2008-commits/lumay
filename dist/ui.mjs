const PATHS={
 up:'M12 20V4M6 10l6-6 6 6',
 down:'M12 4v16m-6-6 6 6 6-6',
 palette:'M12 3a9 9 0 1 0 0 18h1.3a1.7 1.7 0 0 0 1.3-2.8 1.7 1.7 0 0 1 1.3-2.8H18a3 3 0 0 0 3-3c0-5.1-4-9.4-9-9.4ZM7 12h.01M9 7.5h.01m5-.5h.01m4 3h.01',
 check:'m5 12 4 4L19 6',
 close:'m6 6 12 12M18 6 6 18',
 move:'M12 3v18M3 12h18M9 6l3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
 axisx:'M3 12h18M6 9l-3 3 3 3m12-6 3 3-3 3',
 axisy:'M12 3v18M9 6l3-3 3 3m-6 12 3 3 3-3',
 shrinky:'M12 3v6m-3-3 3 3 3-3m-3 15v-6m-3 3 3-3 3 3',
 shrink:'M3 12h6m-3-3 3 3-3 3m15-3h-6m3-3-3 3 3 3',
 adjustmesh:'M4 4h16v16H4zM4 12h16M12 4v16m-2-10h4v4h-4z',
 shield:'m12 3 7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6Zm-3 9 2 2 4-4',
 target:'M12 3v4m0 10v4M3 12h4m10 0h4m-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 arrow:'M4 12h15m-6-6 6 6-6 6',
 back:'m11 5-7 7 7 7M4 12h16',
 rings:'M14 9a5 5 0 1 0-10 0 5 5 0 1 0 10 0Zm6 0a5 5 0 1 0-10 0 5 5 0 1 0 10 0Zm-3 6a5 5 0 1 0-10 0 5 5 0 1 0 10 0Z',
 face:'M20 10c0 6-3 10-8 10s-8-4-8-10a8 8 0 1 1 16 0ZM8 10h.01M16 10h.01m-7 5q3 3 6 0',
 lipstick:'M8 13V7l7-4v10m-8 0h9v8H7zM7 16h9',
 body:'M7 3c4 5 4 8 0 12-2 2-2 4-2 6M17 3c-4 5-4 8 0 12 2 2 2 4 2 6M8 16q4 2 8 0',
 curve:'M4 4v16h16M6 17c6 0 4-10 12-10M17 6h2v2h-2z',
 folder:'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9H3Z M3 10h18',
 undo:'M9 8 4 12l5 4 M4 12h11a4 4 0 0 1 0 8',
 redo:'m15 8 5 4-5 4 M20 12H9a4 4 0 0 0 0 8',
 compare:'M12 3v18M9 5H4v14h5m6-14h5v14h-5',
 stack:'m12 3 9 5-9 5-9-5z M3 12l9 5 9-5M3 16l9 5 9-5',
 batch:'M8 4h12v12H8z M4 8v12h12 M12 10h4m-2-2v4',
 export:'M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5',
 adjust:'M4 6h6m4 0h6M4 12h11m4 0h1M4 18h2m4 0h10 M10 4v4m5 2v4m-9 2v4',
 film:'M4 4h16v16H4zM8 4v16m8-16v16M4 9h4m8 0h4M4 15h4m8 0h4',
 crop:'M7 3v14h14M3 7h14v14',
 brush:'m9 15 8-11c1-2 4 0 3 2L12 17 M9 15c-3-1-4 1-4 3s-2 3-2 3c5 1 10-1 9-4z',
 sparkle:'M12 2c0 6 4 10 10 10-6 0-10 4-10 10 0-6-4-10-10-10 6 0 10-4 10-10ZM5 3v4M3 5h4',
 text:'M4 7V4h16v3M12 4v16m-4 0h8',
 shape:'M4 3h10v10H4z M15 10a5 5 0 1 1-4 4',
 frame:'M3 3h18v18H3zM7 7h10v10H7z',
 grid:'M3 3h18v18H3z M9 3v18m6-18v18M3 9h18m-18 6h18',
 expand:'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6',
 history:'M3 10a9 9 0 1 1 2 8M3 4v6h6m3-3v5l4 2',
 image:'M3 4h18v16H3z M3 17l6-6 4 4 3-3 5 5 M16 7h.01',
 reset:'M4 4v6h6m-6 0a8 8 0 1 1 0 5',
 help:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-3 6a3 3 0 1 1 4 3c-1 1-1 1-1 2m0 3h.01',
 eye:'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 lock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
 plus:'M12 4v16M4 12h16'
};
export const $=(selector,scope=document)=>scope.querySelector(selector);
export function el(tag,attrs={},...children){
  const node=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(v===undefined)return;
    if(k.startsWith('on'))node.addEventListener(k.slice(2),v);
    else if(k==='class')node.className=v;
    else if(k==='checked'||k==='disabled'||k==='value')node[k]=v;
    else node.setAttribute(k,v);
  });
  node.append(...children.flat().filter(v=>v!==null&&v!==undefined));
  return node;
}
export function icon(node,name){
  node.querySelector('svg')?.remove();
  if(!PATHS[name])return node;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const path=document.createElementNS(svg.namespaceURI,'path');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  path.setAttribute('d',PATHS[name]);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.6');path.setAttribute('stroke-linejoin','round');path.setAttribute('stroke-linecap','round');
  svg.append(path);node.prepend(svg);return node;
}
export const btn=(label,onclick,attrs={})=>el('button',{type:'button',onclick,...attrs},label);
export const hint=label=>el('p',{class:'hint'},label);
export const heading=label=>el('h2',{class:'group-title'},label);
export const fields=(...children)=>el('div',{class:'fields'},...children);
export const row=(...children)=>el('div',{class:'row'},...children);
export const labelled=(label,control)=>el('label',{},label,control);
export const tabs=(options,current,change)=>el('div',{class:'tabs'},options.map(([key,label])=>btn(label,()=>change(key),{'aria-pressed':key===current,class:key===current?'active':''})));
export function slider(label,value,min,max,initial,step,set,complete,unit=''){
  const number=el('output',{},value+unit);
  const track=el('input',{type:'range',min,max,step,value,'aria-label':label});
  const draw=()=>{
    const percent=(Number(track.value)-min)/(max-min)*100,baseline=min<0&&max>0?-min/(max-min)*100:0;
    track.style.setProperty('--start',Math.min(baseline,percent)+'%');track.style.setProperty('--fill',Math.max(baseline,percent)+'%');
    number.textContent=track.value+unit;
  };
  track.addEventListener('input',()=>{draw();set(Number(track.value))});
  track.addEventListener('change',()=>complete?.());
  const reset=()=>{track.value=initial;draw();set(initial);complete?.()};
  track.addEventListener('dblclick',reset);number.addEventListener('dblclick',reset);number.title='Doble clic para restablecer';
  draw();
  const resetButton=icon(btn('',reset,{class:'individual-reset quiet','aria-label':'Restablecer '+label,title:'Restablecer '+label}),'reset');
  return el('div',{class:'control'},el('span',{},label,number),track,resetButton);
}
export function select(label,options,value,change){
  const control=el('select',{onchange:e=>change(e.target.value)},options.map(option=>{
    const [key,text]=Array.isArray(option)?option:[option,option];
    return el('option',{value:key},text);
  }));
  control.value=value;
  return labelled(label,control);
}
export function input(label,type,value,change,attrs={}){
  return labelled(label,el('input',{type,value,onchange:e=>change(type==='number'?e.target.valueAsNumber:e.target.value),...attrs}));
}
export function check(label,value,change){
  return el('label',{class:'row'},el('input',{type:'checkbox',checked:value,onchange:e=>change(e.target.checked)}),label);
}
export function files(label,accept,multiple,change){
  const node=el('input',{type:'file',accept,...(multiple?{multiple:''}:{}),onchange:e=>change(Array.from(e.target.files))});
  return labelled(label,node);
}
