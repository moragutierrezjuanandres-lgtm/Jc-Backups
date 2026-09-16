import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
const root=new URL('../src/',import.meta.url);
const glyphs=/[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
for(const folder of ['views','components']) {
 for(const file of fs.readdirSync(new URL(folder+'/',root)).filter(f=>f.endsWith('.jsx')&&!f.startsWith('Enterprise')&&!['LogoSvg.jsx','ImageLightbox.jsx','Backups.jsx','Layouts.jsx'].includes(f))) {
  const location=new URL(folder+'/'+file,root);let source=fs.readFileSync(location,'utf8');
  const ast=parse(source,{sourceType:'module',plugins:['jsx']});const edits=[];
  function visit(node,parent) {
   if(!node || typeof node!=='object')return;
   if(node.type==='JSXText' && glyphs.test(node.value)) {
    glyphs.lastIndex=0;
    const plain=node.value.replace(glyphs,'');
    // Preserve icon-only controls; remove decorative emojis when accompanied by text.
    if(plain.trim())edits.push([node.start,node.end,plain]);
   }
   glyphs.lastIndex=0;
   if(node.type==='JSXAttribute' && node.name?.name==='style' && node.value?.expression?.type==='ObjectExpression') {
    for(const p of node.value.expression.properties) {
     const key=p.key?.name;const v=p.value;
     if(key==='fontWeight' && v?.type==='NumericLiteral' && v.value>=700)edits.push([v.start,v.end,v.value>=900?'500':'600']);
     if(key==='fontWeight' && v?.type==='StringLiteral' && v.value==='bold')edits.push([v.start,v.end,'500']);
     if(key==='boxShadow' && v?.type==='StringLiteral' && !v.value.startsWith('var('))edits.push([v.start,v.end,"'none'"]);
     if(key==='background' && v?.type==='StringLiteral' && v.value.includes('gradient(')) {
      const white=node.value.expression.properties.some(p=>p.key?.name==='color'&&['#fff','#ffffff'].includes(p.value?.value));
      edits.push([v.start,v.end,white?"'var(--primary)'":"'var(--card-hover)'"]);
     }
    }
   }
   for(const [key,value] of Object.entries(node))if(!['loc','extra','comments'].includes(key)){if(Array.isArray(value))value.forEach(x=>visit(x,node));else if(value&&typeof value==='object')visit(value,node);}
  }
  visit(ast,null);
  for(const [a,b,text] of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,a)+text+source.slice(b);
  fs.writeFileSync(location,source);
 }
}
let file=new URL('views/Clients.jsx',root),s=fs.readFileSync(file,'utf8');
const start=s.indexOf('                  {/* Tarjeta Visual de Respaldos Automatizados');
const end=s.indexOf('\n                </div>\n              </>',start);
if(start<0||end<0)throw new Error('Client backup callout marker missing');
s=s.slice(0,start)+`                  <div className="backup-callout" style={{marginTop:20}}>
                    <div><span className="eyebrow">CONTINUIDAD OPERATIVA</span><h2>Respaldos del cliente</h2><p>Consulta la conexión, las ejecuciones y la integridad de las copias.</p></div>
                    <button className="btn btn-primary" onClick={() => setActiveSubTab('backups')}>Gestionar respaldos →</button>
                  </div>`+s.slice(end);
s=s.replace("label: 'Respaldos (A:\\\\Jce\\\\Jc-Backups)'","label: 'Respaldos'");
s=s.replace("triggerToast('Sincronizado localmente');","triggerToast('No se pudo actualizar. Comprueba la conexión con el servidor.');");
fs.writeFileSync(file,s);
