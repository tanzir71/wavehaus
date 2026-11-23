import { completionInput,coverHash,normalized,sniffAudio } from '../../shared/upload-input';
import { all,one,run,stmt,settings } from './db';
import { sha,ulid } from './crypto';
import { fail } from './http';
import { verifyObject } from './file-crypto';
import { albumRow,trackRow,type WireRow } from './library';
import { assemblyKey,clearParts,getUpload,mediaKey,partKey,parts,withUploadLease,type Upload } from './upload-store';
import type { Auth,Env,Statement } from './types';

const tint=(artist:string,album:string)=>coverHash(`${artist.toLowerCase()}|${album.toLowerCase()}`)%6;
async function completed(env:Env,upload:Upload){const track=await trackRow(env,upload.completed_track_id!);if(!track||track.deleted)fail('upload_closed','This completed track is no longer in the library.',409);await clearParts(env,upload).catch(()=>console.warn('Upload part cleanup deferred'));return {track,album:await albumRow(env,String(track.album_id)),changeId:upload.completed_change_id};}
export async function completeUpload(env:Env,auth:Auth,initial:Upload,raw:Record<string,unknown>){
 const input=completionInput(raw),cfg=await settings(env.DB);if(cfg.upload_visibility_locked===true&&input.visibility==='public')fail('forbidden','New uploads are locked to Private on this server.',403);
 return withUploadLease(env,initial,async(claim,renew)=>{
  const upload=await getUpload(env,auth,initial.id);if(upload.status==='complete'&&upload.completed_track_id)return completed(env,upload);
  if(upload.status!=='open'||upload.expires_at<Date.now())fail('upload_closed','This upload is no longer open.',409);
  const count=Math.ceil(upload.size_bytes/upload.chunk_bytes),list=await parts(env,upload.id);if(list.length!==count||list.some((p,i)=>p.part_no!==i+1||p.size_bytes!==Math.min(upload.chunk_bytes,upload.size_bytes-i*upload.chunk_bytes)))fail('incomplete','Some upload parts are missing.',409);
  if(input.album.existingAlbumId&&!await one(env.DB,'SELECT id FROM albums WHERE id=? AND owner_id=? AND deleted=0',input.album.existingAlbumId,auth.user.id))fail('forbidden','Choose an album that belongs to you.',403);
  const multipart=env.MEDIA.resumeMultipartUpload(assemblyKey(upload),upload.backend_ref),assembled=[];
  try{
   for(const part of list){await renew();const object=await env.MEDIA.get(partKey(upload,part));if(!object||object.size!==part.size_bytes)fail('incomplete','An upload part is missing.',409);assembled.push(await multipart.uploadPart(part.part_no,object.body));}
   await multipart.complete(assembled);
  }catch(error){
   // Completion may have succeeded before a disconnected request could record
   // it. The immutable object can be re-verified and committed on a retry.
   if(!await env.MEDIA.head(assemblyKey(upload)))throw error;
  }
  await renew();const verification=await verifyObject(env.MEDIA,assemblyKey(upload),upload.size_bytes,upload.sha256),mime=sniffAudio(verification.header,upload.filename),m=input.metadata,a=input.album;
  if(m.quickHash&&m.quickHash!==verification.quickHash)fail('hash_mismatch','The quick hash does not match the uploaded file.',409);
  const existing=await one<WireRow>(env.DB,'SELECT * FROM tracks WHERE owner_id=? AND sha256=? AND deleted=0',auth.user.id,upload.sha256);
  if(existing){await run(env.DB,"UPDATE uploads SET status='complete',completed_track_id=? WHERE id=?",existing.id,upload.id);await clearParts(env,upload).catch(()=>console.warn('Upload part cleanup deferred'));return {track:existing,album:await albumRow(env,String(existing.album_id)),changeId:null};}
  // Unverified bytes never reach the permanent content key, even if a caller
  // supplies another file's SHA. R2 promotion remains streamed and checksummed.
  if(await env.MEDIA.head(mediaKey(upload)))await verifyObject(env.MEDIA,mediaKey(upload),upload.size_bytes,upload.sha256);
  else{const object=await env.MEDIA.get(assemblyKey(upload));if(!object)fail('storage','The assembled upload is missing.',503);await env.MEDIA.put(mediaKey(upload),object.body,{sha256:upload.sha256,httpMetadata:{contentType:mime}});}
  const uid=auth.user.id,now=Date.now(),trackId=ulid(),albumId=ulid(),changeId=ulid(),trackArtistKey=normalized(m.artist),albumArtistKey=normalized(a.artistName),mergeKey=await sha(`${albumArtistKey}\x1f${normalized(a.title)}`);
  const condition='EXISTS(SELECT 1 FROM upload_claims WHERE upload_id=? AND claim_id=? AND quota_reserved=1)',guard=[upload.id,claim],bump=()=>stmt(env.DB,`UPDATE revs SET n=n+1 WHERE id=1 AND ${condition}`,...guard);
  const statements:Statement[]=[stmt(env.DB,`UPDATE upload_claims SET quota_reserved=1 WHERE upload_id=? AND claim_id=? AND EXISTS(SELECT 1 FROM uploads WHERE id=? AND user_id=? AND status='open') AND EXISTS(SELECT 1 FROM users WHERE id=? AND status='active' AND (quota_bytes IS NULL OR used_bytes+?<=quota_bytes)) AND (? IS NULL OR EXISTS(SELECT 1 FROM albums WHERE id=? AND owner_id=? AND deleted=0))`,upload.id,claim,upload.id,uid,uid,upload.size_bytes,a.existingAlbumId,a.existingAlbumId,uid)];
  const ensureArtist=(name:string,key:string)=>statements.push(bump(),stmt(env.DB,`INSERT OR IGNORE INTO artists(id,name,sort_name,tint,rev,name_key) SELECT ?,?,?,?,(SELECT n FROM revs WHERE id=1),? WHERE ${condition}`,ulid(),name,name,tint(name,a.title),key,...guard),stmt(env.DB,`UPDATE artists SET rev=(SELECT n FROM revs WHERE id=1) WHERE name_key=? AND deleted=0 AND ${condition}`,key,...guard));
  ensureArtist(m.artist,trackArtistKey);
  if(!a.existingAlbumId){ensureArtist(a.artistName,albumArtistKey);statements.push(bump(),stmt(env.DB,`INSERT OR IGNORE INTO albums(id,owner_id,title,artist_id,year,tint,visibility,folder_path,created_at,rev,merge_key) SELECT ?,?,?,(SELECT id FROM artists WHERE name_key=? AND deleted=0),?,?,?,?,?,(SELECT n FROM revs WHERE id=1),? WHERE ${condition}`,albumId,uid,a.title,albumArtistKey,a.year,tint(a.artistName,a.title),input.visibility,a.folderPath,now,mergeKey,...guard));}
  const values:Record<string,unknown>={id:trackId,owner_id:uid,title:m.title,artist_name:m.artist,album_artist:m.albumArtist,track_no:m.trackNo,disc_no:m.discNo,year:m.year,genre:m.genre,bpm:m.bpm,duration_ms:m.durationMs,codec:m.codec,container:m.container,bitrate:m.bitrate,sample_rate:m.sampleRate,bit_depth:m.bitDepth,channels:m.channels,replaygain_track_db:m.replaygainTrackDb,replaygain_album_db:m.replaygainAlbumDb,has_lyrics:m.lyrics!==null?1:0,lyrics:m.lyrics,lyrics_synced:m.lyricsSynced?1:0,peaks:input.peaks,storage_key:mediaKey(upload),size_bytes:upload.size_bytes,sha256:upload.sha256,quick_hash:verification.quickHash,original_name:upload.filename,original_path:m.originalPath,mime,organise_source:m.organiseSource,added_at:now,updated_at:now,deleted:0};
  const scalarColumns=Object.keys(values),dynamicColumns=['album_id','artist_id','album_title','visibility','rev'],columns=[...scalarColumns,...dynamicColumns],select=[...scalarColumns.map(()=>'?'),'a.id','(SELECT id FROM artists WHERE name_key=? AND deleted=0)','a.title',"CASE WHEN a.sync_visibility=1 THEN a.visibility ELSE ? END",'(SELECT n FROM revs WHERE id=1)'];
  const albumWhere=a.existingAlbumId?'a.id=?':'a.merge_key=?';statements.push(bump(),stmt(env.DB,`INSERT INTO tracks(${columns.join(',')}) SELECT ${select.join(',')} FROM albums a WHERE a.owner_id=? AND a.deleted=0 AND ${albumWhere} AND ${condition}`,...Object.values(values),trackArtistKey,input.visibility,uid,a.existingAlbumId||mergeKey,...guard),stmt(env.DB,`UPDATE users SET used_bytes=used_bytes+? WHERE id=? AND ${condition}`,upload.size_bytes,uid,...guard));
  // D1 permits 32 arguments per SQL function. json_set keeps null fields;
  // json_patch would silently remove them from the undo snapshot.
  const jsonRow=(alias:string,names:string[])=>{let value=`json_object(${names.slice(0,16).map(column=>`'${column}',${alias}.${column}`).join(',')})`;for(let at=16;at<names.length;at+=15)value=`json_set(${value},${names.slice(at,at+15).map(column=>`'$.${column}',${alias}.${column}`).join(',')})`;return value;},trackOps=`json_array(json_object('table','tracks','id',t.id,'before',NULL,'after',${jsonRow('t',columns)}))`,albumColumns=['id','owner_id','title','artist_id','year','art_source','art_key','tint','visibility','sync_visibility','folder_path','created_at','rev','deleted','merge_key'];
  const ops=`CASE WHEN EXISTS(SELECT 1 FROM albums WHERE id=?) THEN json_insert(${trackOps},'$[#]',json_object('table','albums','id',?,'before',NULL,'after',(SELECT ${jsonRow('a',albumColumns)} FROM albums a WHERE a.id=?))) ELSE ${trackOps} END`;
  statements.push(stmt(env.DB,`INSERT INTO changes(id,user_id,actor,session_label,summary,ops,created_at) SELECT ?,?,'web',?,?,${ops},? FROM tracks t WHERE t.id=? AND ${condition}`,changeId,uid,auth.session.device_label,`Uploaded ${m.title}`,albumId,albumId,albumId,now,trackId,...guard),stmt(env.DB,`UPDATE uploads SET status='complete',completed_track_id=?,completed_change_id=? WHERE id=? AND ${condition}`,trackId,changeId,upload.id,...guard));
  const committed=await env.DB.batch(statements);
  if(!committed[0].meta.changes){if(a.existingAlbumId&&!await one(env.DB,'SELECT id FROM albums WHERE id=? AND owner_id=? AND deleted=0',a.existingAlbumId,uid))fail('forbidden','Choose an album that belongs to you.',403);const user=await one<{quota_bytes:number|null;used_bytes:number}>(env.DB,'SELECT quota_bytes,used_bytes FROM users WHERE id=?',uid);if(user?.quota_bytes!==null&&user&&user.used_bytes+upload.size_bytes>user.quota_bytes)fail('quota','There is not enough space in your account.',413);fail('upload_busy','Another request resumed this upload. Try again.',409,5);}
  const track=await trackRow(env,trackId);if(!track)fail('storage','The track could not be committed. Retry completion.',503);await clearParts(env,upload).catch(()=>console.warn('Upload part cleanup deferred'));return {track,album:await albumRow(env,String(track.album_id)),changeId};
 });
}
