import { $,btn,el,icon } from './ui.mjs';

export const THEMES={
  silver:{label:'Cristal',page:'#0d0e0f',panel:'#202124',accent:'#d6d9de'},
  aurora:{label:'Aurora',page:'#0b1817',panel:'#1b322d',accent:'#87e5c4'},
  midnight:{label:'Medianoche',page:'#101321',panel:'#1e2a45',accent:'#9cbcff'},
  orchid:{label:'Orquídea',page:'#1e1125',panel:'#35223f',accent:'#e2aaff'},
  sunset:{label:'Atardecer',page:'#211417',panel:'#3a272a',accent:'#ffb29a'},
  citrus:{label:'Lima',page:'#171b11',panel:'#2b3420',accent:'#d3ef82'}
};
const key='lumay-theme-v1';
const roles=[['page','Fondo'],['panel','Cristal'],['accent','Acento']];
const valid=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
const rgb=hex=>hex.slice(1).match(/../g).map(channel=>parseInt(channel,16));
const hex=channels=>'#'+channels.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
function mix(a,b,fraction){
  const end=rgb(b);
  return hex(rgb(a).map((v,i)=>v+(end[i]-v)*fraction));
}
function luminance(color){
  return rgb(color).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
    .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
export function themePalette(preference){
  const preset=Object.hasOwn(THEMES,preference?.id)?THEMES[preference.id]:THEMES.silver;
  if(preference?.id!=='custom')return preset;
  const source=Object.fromEntries(roles.map(([role])=>[role,valid(preference[role])?preference[role]:preset[role]]));
  let accent=source.accent;
  while(luminance(accent)<.46)accent=mix(accent,'#f4f5f7',.16);
  return {page:mix(source.page,'#0d0e0f',.8),panel:mix(source.panel,'#202124',.83),accent};
}
function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(key));
    if(saved&&(saved.id==='custom'||Object.hasOwn(THEMES,saved.id)))return saved;
  }catch{ /* Private browsing can block storage. */ }
  return {id:'silver'};
}
export class ThemeSettings{
  constructor(dialogs){this.dialogs=dialogs;this.preference=load();this.apply()}
  apply(){
    const palette=themePalette(this.preference), style=document.documentElement.style;
    for(const [role] of roles)style.setProperty('--'+role,palette[role]);
    style.setProperty('--surface',mix(palette.panel,'#f4f5f7',.062));
    style.setProperty('--on-accent',luminance(palette.accent)>.179?'#000000':'#ffffff');
    $('meta[name="theme-color"]')?.setAttribute('content',palette.page);
  }
  save(preference){
    this.preference=preference;this.apply();
    try{localStorage.setItem(key,JSON.stringify(preference))}catch{ /* The current session still uses the choice. */ }
  }
  open(){
    const initial=themePalette(this.preference);
    const cards=Object.entries(THEMES).map(([id,palette])=>{
      const paint=el('span',{class:'theme-sample','aria-hidden':'true',
        style:'--tile-page:'+palette.page+';--tile-panel:'+palette.panel+';--tile-accent:'+palette.accent},
        el('i'),el('i'),el('i'));
      const card=btn('',()=>{
        this.save({id});
        roles.forEach(([role])=>inputs[role].value=palette[role]);
        updateSelection();
      },{class:'theme-card','data-theme-card':id,'aria-pressed':this.preference.id===id});
      card.append(paint,el('span',{},palette.label));return card;
    });
    const updateSelection=()=>cards.forEach(card=>card.setAttribute('aria-pressed',card.dataset.themeCard===this.preference.id));
    const inputs=Object.fromEntries(roles.map(([role,label])=>{
      const color=el('input',{type:'color',value:valid(this.preference[role])?this.preference[role]:initial[role],'aria-label':label,
        oninput:()=>{
          this.preference={id:'custom',...Object.fromEntries(roles.map(([name])=>[name,inputs[name].value]))};
          this.apply();updateSelection();
        },
        onchange:()=>this.save(this.preference)});
      return [role,color];
    }));
    this.dialogs.show('Ajustes de apariencia',
      el('div',{class:'theme-cards','aria-label':'Temas de Lumay'},cards),
      el('fieldset',{class:'theme-custom'},el('legend',{},'Personalizar'),
        el('div',{class:'theme-swatches'},roles.map(([role,label])=>el('label',{},inputs[role],label)))),
      el('div',{class:'theme-footer'},icon(btn('Listo',()=>{this.save(this.preference);this.dialogs.modal.close()},{class:'primary'}),'check')));
  }
}
