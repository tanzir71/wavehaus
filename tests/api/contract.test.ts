import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { startDemo,stopDemo,demoRequest } from './demo-shim';
// Vite supplies BASE_URL='/' internally; only an absolute URL selects HTTP.
const base=/^https?:\/\//.test(process.env.BASE_URL||'')?process.env.BASE_URL!.replace(/\/$/,''):undefined;
async function request(path:string,method='GET',body?:unknown){if(!base)return demoRequest(path,method,body);const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Wavehaus':'1'},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,headers:Object.fromEntries(res.headers),body:await res.json()};}
beforeAll(async()=>{if(!base)await startDemo();});afterAll(async()=>{if(!base)await stopDemo();});
describe('M0 API contract',()=>{
 it('reports schema, backend, version and setup state',async()=>{const r=await request('/api/health');expect(r.status).toBe(200);expect(r.body).toMatchObject({ok:true,schema:1,needsSetup:false});expect(['demo','php','worker']).toContain(r.body.backend);});
 it('advertises private defaults and upload limits',async()=>{const r=await request('/api/config');expect(r.status).toBe(200);expect(r.body.maxChunkBytes).toBeGreaterThan(0);expect(r.body.maxFileBytes).toBeGreaterThan(r.body.maxChunkBytes);expect(r.body.registrationMode).toBe('closed');});
 it('returns schema-shaped rows, generated peaks and private music',async()=>{const r=await request('/api/library?since=0');expect(r.status).toBe(200);expect(r.body.items.albums).toHaveLength(3);expect(r.body.items.tracks).toHaveLength(12);for(const t of r.body.items.tracks){expect(t.visibility).toBe('private');expect(t.duration_ms).toBeGreaterThanOrEqual(30000);expect(atob(t.peaks)).toHaveLength(1000);}expect(r.body.hidden).toEqual({tracks:[],albums:[],playlists:[]});});
 it('paginates without losing rows',async()=>{const first=await request('/api/library?since=0&limit=2');expect(first.body.more).toBe(true);expect(Object.values(first.body.items).flat()).toHaveLength(2);const second=await request(`/api/library?since=${first.body.rev}&limit=2000`);expect(second.body.rev).toBeGreaterThan(first.body.rev);expect(second.body.more).toBe(false);});
 it('rejects invalid sync cursors with structured errors',async()=>{const r=await request('/api/library?since=-1');expect(r.status).toBe(400);expect(r.body.error.code).toBe('invalid_cursor');});
 it('returns an empty delta at the latest revision',async()=>{const initial=await request('/api/library?since=0');const r=await request(`/api/library?since=${initial.body.rev}`);expect(Object.values(r.body.items).flat()).toHaveLength(0);});
 it('persists player state through the adapter',async()=>{const value={queue:[],index:0,positionMs:12000,shuffle:false,repeat:'off',autoplay:true,updatedAt:Date.now()};expect((await request('/api/player-state','PUT',value)).status).toBe(200);expect((await request('/api/player-state')).body).toEqual(value);});
 it('rejects an invalid upload before storing parts',async()=>{const r=await request('/api/uploads','POST',{filename:'test.wav',size:10,sha256:'bad',mime:'audio/wav'});expect(r.status).toBe(400);expect(r.body.error.code).toBe('invalid_hash');});
});
