import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=new URL('../dist/',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const photo=(await readFile(new URL('assets/sample.jpg',root))).toString('base64');
const mark=encodeURIComponent(await read('assets/mark.svg'));
const css=(await read('style.css')).replace('./assets/mark.svg','data:image/svg+xml,'+mark);
const modules=['model','ui','files','presets','color','render','inspector','dialogs','themes','app'];
const bundle=[];
for(const name of modules){
  const exports=[];
  const code=(await read(name+'.mjs'))
    .replace(/^import \{([^}]+)\} from '\.\/([^']+)\.mjs';$/gm,(_,names,dependency)=>'const {'+names+'} = modules['+JSON.stringify(dependency)+'];')
    .replace(/^export (const|class|function|async function) ([\w$]+)/gm,(_,kind,key)=>{exports.push(key);return kind+' '+key});
  bundle.push('modules['+JSON.stringify(name)+'] = (() => {\n'+code+'\nreturn { '+exports.join(', ')+' };\n})();');
}
const html=(await read('index.html'))
  .replaceAll('./assets/mark.svg','data:image/svg+xml,'+mark)
  .replace('./assets/sample.jpg','data:image/jpeg;base64,'+photo)
  .replace('<link rel="stylesheet" href="./style.css">',()=>'<style>\n'+css+'\n</style>')
  .replace('<script type="module" src="./app.mjs"></script>',()=>'<script>\n"use strict";\n(() => { const modules = {};\n'+bundle.join('\n')+'\n})();\n</script>');
const target=resolve(process.argv[2]??'Lumay.html');
await writeFile(target,html);
console.log(target);
