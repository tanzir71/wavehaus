import { chromium,type Browser,type Page } from '@playwright/test';
import { createServer,type ViteDevServer } from 'vite';
let browser:Browser,page:Page,server:ViteDevServer;
export async function startDemo(){server=await createServer({configFile:'app/vite.config.ts',mode:'demo',server:{port:5188,host:'127.0.0.1',strictPort:true}});await server.listen();browser=await chromium.launch();page=await browser.newPage();await page.goto('http://127.0.0.1:5188');await page.waitForFunction(()=>document.body.dataset.busy==='false',undefined,{timeout:120000});await page.addScriptTag({type:'module',content:"import { demoFetch } from '/src/demo/index.ts'; window.__whFetch = demoFetch;"});await page.waitForFunction(()=>typeof (window as any).__whFetch==='function');}
export async function stopDemo(){await browser?.close();await server?.close();}
export async function demoRequest(path:string,method='GET',body?:unknown,csrf=true){return page.evaluate(async({path,method,body,csrf})=>{
 const init:RequestInit={method,headers:{...csrf?{'X-Wavehaus':'1'}:{},'Content-Type':'application/json'}};if(body!==undefined)init.body=JSON.stringify(body);const res=await (window as any).__whFetch(path,init);return {status:res.status,headers:Object.fromEntries(res.headers),body:await res.json()};
 },{path,method,body,csrf});}
