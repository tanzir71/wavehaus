import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import type { Album,Api,Track } from '../../app/src/api/types';
import { NativeMediaSession } from '../../app/src/engine/media-session';
const images:FakeImage[]=[];
class FakeImage {src='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;constructor(){images.push(this);}}
class Metadata {title:string;artwork:MediaImage[];constructor(init:MediaMetadataInit){this.title=init.title||'';this.artwork=init.artwork||[];}}
const native={metadata:null as Metadata|null,playbackState:'none',setPositionState:vi.fn()};
const api:Api={demo:false,request:async<T>()=>undefined as T,mediaUrl:t=>'/media/'+t.id,artUrl:(a,size)=>`/art/${a.id}/${a.art_source==='generated'?'generated-512.png':`${size}.webp`}?v=${a.rev}`};
const album={id:'album',rev:1,art_source:'generated'}as Album;
const track=(title:string)=>({id:title,album_id:'album',title,artist_name:'Artist',album_title:'Album'}as Track);
beforeEach(()=>{images.length=0;native.metadata=null;native.playbackState='none';vi.stubGlobal('navigator',{mediaSession:native});vi.stubGlobal('location',{href:'https://example.test/music/'});vi.stubGlobal('MediaMetadata',Metadata);vi.stubGlobal('Image',FakeImage);});
afterEach(()=>vi.unstubAllGlobals());
it('keeps a valid fallback until the generated album image has loaded',()=>{
 const media=new NativeMediaSession(api,'/music/');media.setAlbums([album]);media.track(track('A'));
 expect(native.metadata?.artwork[0].src).toBe('https://example.test/music/icons/icon-512.png');expect(images).toHaveLength(1);images[0].onload!();
 expect(native.metadata?.artwork).toEqual([{src:'https://example.test/art/album/generated-512.png?v=1',sizes:'512x512',type:'image/png'}]);
});
it('applies a pending shared cover to the latest track after a fast advance',()=>{
 const media=new NativeMediaSession(api,'/music/');media.setAlbums([album]);media.track(track('A'));media.track(track('B'));expect(images).toHaveLength(1);images[0].onload!();
 expect(native.metadata?.title).toBe('B');expect(native.metadata?.artwork[0].src).toContain('generated-512.png');
});
it('publishes real 600/96 WebP artwork as each size becomes available',()=>{
 const media=new NativeMediaSession(api,'/music/');media.setAlbums([{...album,art_source:'embedded'}]);media.track(track('A'));expect(images).toHaveLength(2);images[1].onload!();expect(native.metadata?.artwork.map(a=>a.sizes)).toEqual(['96x96']);images[0].onload!();
 expect(native.metadata?.artwork.map(a=>[a.sizes,a.type])).toEqual([['600x600','image/webp'],['96x96','image/webp']]);
});
it('does not restore private lock-screen metadata after a session has cleared',()=>{
 const media=new NativeMediaSession(api,'/music/');media.setAlbums([album]);media.track(track('A'));media.track(null);images[0].onload!();expect(native.metadata).toBeNull();expect(native.playbackState).toBe('none');
});
it('keeps an active media session playing while the next stream buffers',()=>{
 const media=new NativeMediaSession(api,'/music/');media.track(track('A'));media.state('playing');media.state('loading');expect(native.playbackState).toBe('playing');media.state('paused');expect(native.playbackState).toBe('paused');
});
