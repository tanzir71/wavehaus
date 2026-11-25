import {afterEach,expect,it,vi} from 'vitest';
import {PlaybackPersistence} from '../../app/src/engine/persistence';
import type {Api} from '../../app/src/api/types';
import type {PlayerSnapshot} from '../../shared/playback-input';

const storage=new Map<string,string>(),instances:PlaybackPersistence[]=[];
function fixture(base='/wavehaus/app/'){
 vi.stubGlobal('addEventListener',vi.fn());vi.stubGlobal('removeEventListener',vi.fn());
 vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)});
 const request=vi.fn(),persistence=new PlaybackPersistence({demo:false,request} as unknown as Api,base);instances.push(persistence);persistence.configure(null);return {persistence,request};
}
const snapshot:PlayerSnapshot={queue:['01J00000000000000000000001'],index:0,positionMs:4500,updatedAt:1,shuffle:false,repeat:'off',autoplay:false};
afterEach(()=>{instances.splice(0).forEach(value=>value.dispose());storage.clear();vi.unstubAllGlobals();});

it('saves and restores guest position in localStorage without contacting the server',async()=>{
 const{persistence,request}=fixture();expect(await persistence.read()).toBe(null);persistence.write(snapshot,true,true);const second=fixture();expect(await second.persistence.read()).toEqual(snapshot);expect(request).not.toHaveBeenCalled();expect(second.request).not.toHaveBeenCalled();
});
it('separates guest snapshots by deployment path and ignores malformed saved data',async()=>{
 const{persistence}=fixture();persistence.write(snapshot);expect(await fixture('/other/').persistence.read()).toBe(null);storage.set('wh-player-guest:/wavehaus/app/','{bad JSON');expect(await persistence.read()).toBe(null);storage.set('wh-player-guest:/wavehaus/app/',JSON.stringify({...snapshot,queue:['invalid']}));expect(await persistence.read()).toBe(null);
});
