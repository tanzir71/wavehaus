import { describe,it,expect } from 'vitest';
import { rangeResponse } from '../../app/public/runtime/media.js';
describe('shared media byte ranges',()=>{
 const blob=new Blob(['0123456789'],{type:'audio/wav'});
 const request=(range?:string,method='GET')=>new Request('https://wavehaus.test/media/id',{method,headers:range?{Range:range}:{}});
 it('serves the full object and MIME',async()=>{const r=rangeResponse(blob,request());expect(r.status).toBe(200);expect(r.headers.get('Content-Length')).toBe('10');expect(r.headers.get('Content-Type')).toBe('audio/wav');expect(await r.text()).toBe('0123456789');});
 it('returns an inclusive 206 slice',async()=>{const r=rangeResponse(blob,request('bytes=2-5'));expect(r.status).toBe(206);expect(r.headers.get('Content-Range')).toBe('bytes 2-5/10');expect(await r.text()).toBe('2345');});
 it('supports suffix and open-ended seeking',async()=>{expect(await rangeResponse(blob,request('bytes=-3')).text()).toBe('789');expect(await rangeResponse(blob,request('bytes=7-')).text()).toBe('789');});
 it('clamps the end to the media size',async()=>{const r=rangeResponse(blob,request('bytes=8-99'));expect(r.headers.get('Content-Range')).toBe('bytes 8-9/10');expect(await r.text()).toBe('89');});
 it.each(['bytes=10-','bytes=5-2','bytes=-0','bytes=','bytes=0-1,3-4','garbage'])('rejects unsatisfiable or malformed %s',range=>{const r=rangeResponse(blob,request(range));expect(r.status).toBe(416);expect(r.headers.get('Content-Range')).toBe('bytes */10');});
 it('HEAD returns identical range headers without a body',async()=>{const r=rangeResponse(blob,request('bytes=2-5','HEAD'));expect(r.status).toBe(206);expect(r.headers.get('Content-Length')).toBe('4');expect(await r.text()).toBe('');});
});
