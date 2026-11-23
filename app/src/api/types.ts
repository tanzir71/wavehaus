export type Visibility = 'private'|'public';
export interface Row { id:string; rev:number; deleted:number; hidden_rev?:number }
export interface Track extends Row {
 owner_id:string; album_id:string; artist_id:string; title:string; artist_name:string; album_artist?:string; album_title:string;
 track_no?:number|null; disc_no?:number|null; year?:number|null; genre?:string|null; duration_ms:number; codec:string|null; container:string|null; mime:string;
 peaks:string|null; storage_key:string; size_bytes:number; sha256:string; quick_hash:string; original_name:string; original_path:string|null;
 visibility:Visibility; organise_source:string; added_at:number; updated_at:number; lyrics?:string|null; sample_rate?:number|null; bitrate?:number|null;
}
export interface Album extends Row { owner_id:string; title:string; artist_id:string; artist_name:string; year?:number|null; tint:number; art_source:string; art_key?:string|null; visibility:Visibility; sync_visibility:number; folder_path?:string|null; created_at:number; merge_key?:string|null; identity_key?:string|null }
export interface Artist extends Row { name:string; sort_name:string; tint:number }
export interface Playlist extends Row { owner_id:string; name:string; description?:string; visibility:Visibility; sync_visibility:number; created_at:number; updated_at:number }
export interface PlaylistItem { playlist_id:string; track_id:string; position:number; added_at:number; rev:number; deleted:number }
export interface Like { user_id:string; track_id:string; liked_at:number; rev:number; deleted:number }
export interface Moment extends Row { user_id:string; track_id:string; at_ms:number; label:string; created_at:number }
export interface Library { tracks:Track[]; albums:Album[]; artists:Artist[]; playlists:Playlist[]; playlistItems:PlaylistItem[]; likes:Like[]; moments:Moment[] }
export interface LibraryDelta { rev:number; items:Library; hidden:{tracks:string[];albums:string[];playlists:string[]}; more:boolean }
export interface User { id:string; username:string; display_name:string; role:'owner'|'admin'|'uploader'|'listener'; used_bytes:number; quota_bytes:number|null }
export interface Api {
 request<T>(path:string,init?:RequestInit):Promise<T>;
 mediaUrl(track:Track):string;
 artUrl(album:Album,size?:number):string;
 readonly demo:boolean;
}
export const emptyLibrary=():Library=>({tracks:[],albums:[],artists:[],playlists:[],playlistItems:[],likes:[],moments:[]});
export class ApiError extends Error { constructor(public code:string,message:string,public status:number,public retryAfter?:number){super(message);} }
export const json=(value:unknown,method='POST'):RequestInit=>({method,headers:{'Content-Type':'application/json','X-Wavehaus':'1'},body:JSON.stringify(value)});
