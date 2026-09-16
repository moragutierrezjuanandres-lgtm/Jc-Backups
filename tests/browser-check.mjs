import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('..','.qa','screenshots');fs.mkdirSync(dir,{recursive:true});
const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--disable-gpu'],defaultViewport:{width:1440,height:1100}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:5010',{waitUntil:'networkidle0'});
 await page.waitForSelector('input[autocomplete="username"]');
 await page.screenshot({path:path.join(dir,'01-acceso.png'),fullPage:true});
 await page.type('input[autocomplete="username"]','preview');
 await page.type('input[autocomplete="current-password"]','preview-only-2026');
 await page.click('button[type="submit"], .login-form-panel .btn-primary');
 await page.waitForSelector('.enterprise-dashboard');
 await page.screenshot({path:path.join(dir,'02-resumen.png'),fullPage:true});
 for(const [label,file] of [['Clientes','03-clientes'],['Centro de soporte','04-soporte'],['Proyectos','05-proyectos'],['Agenda','06-agenda'],['Respaldos','07-respaldos'],['Conocimiento','08-conocimiento'],['Reportes','09-reportes'],['Equipo','10-equipo'],['Auditoría','11-auditoria'],['Usuarios y permisos','12-usuarios']]) {
  await page.evaluate(text=>{const button=[...document.querySelectorAll('.sidebar-item')].find(e=>e.textContent.trim()===text);if(!button)throw Error('Missing menu '+text);button.click();},label);
  await new Promise(r=>setTimeout(r,450));
  const state=await page.evaluate(()=>({text:document.querySelector('.main-content')?.innerText?.slice(0,150),overflow:document.documentElement.scrollWidth>innerWidth,viewError:document.querySelector('.main-content')?.innerText?.includes('Error de Ejecución del Sistema')}));
  if(state.viewError) errors.push('Error de vista: '+label);
  await page.screenshot({path:path.join(dir,file+'.png'),fullPage:true});
  console.log(JSON.stringify({page:label,...state}));
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.waitForSelector('.sidebar-item');
 await page.evaluate(()=>[...document.querySelectorAll('.sidebar-item')].find(e=>e.textContent.trim()==='Resumen').click());
 await new Promise(r=>setTimeout(r,350));
 await page.screenshot({path:path.join(dir,'13-movil.png'),fullPage:true});
 console.log(JSON.stringify({mobileOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors}));
 if(errors.length)process.exitCode=1;
}finally{await browser.close();}
