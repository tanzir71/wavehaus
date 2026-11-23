import { createStore,get,set } from 'idb-keyval';
import { emptyLibrary,type Library,type User } from '../api/types';
export interface DemoState extends Library { rev:number; user:User; settings:Record<string,unknown>; uploads:Record<string,{id:string;filename:string;size:number;sha256:string;mime:string;partsReceived:number[];chunkBytes:number;status:string}>; changes:Record<string,unknown>[]; playerState:unknown; plays:unknown[] }
const store=createStore('wh-demo-v1','state');
let serial=Promise.resolve();
export function readState():Promise<DemoState|undefined>{return get('database',store);}
export async function writeState(state:DemoState){await set('database',state,store);}
export function mutate<T>(fn:(state:DemoState)=>T|Promise<T>):Promise<T>{
 const operation=async()=>{const state=await readState();if(!state)throw new Error('Demo library is not ready');const result=await fn(state);await writeState(state);return result;};
 const next=serial.then(async()=>navigator.locks?await navigator.locks.request('wh-demo-write',operation):await operation());serial=next.then(()=>{},()=>{});return next;
}
export const freshState=():DemoState=>({...emptyLibrary(),rev:0,user:{id:'01D3M000000000000000000000',username:'demo',display_name:'Demo',role:'owner',used_bytes:0,quota_bytes:null},settings:{server_name:'Wavehaus',registration_mode:'closed',default_visibility:'private',members_can_upload:true},uploads:{},changes:[],playerState:null,plays:[]});
