import {rowIds} from './edit-input';
import {UploadError} from './upload-input';
export const trackReadColumns=['id','owner_id','album_id','artist_id','title','artist_name','album_artist','album_title','track_no','disc_no','year','genre','duration_ms','codec','container','mime','original_name','original_path','visibility','rev','added_at','updated_at','size_bytes'] as const;
export function readLimit(raw:string|null,fallback=100,max=500){if(raw===null)return fallback;const value=Number(raw);if(!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(value)||value>max)throw new UploadError('validation','Use a valid result limit.');return value;}
export function readQuery(raw:string|null){if(raw&&raw.length>200)throw new UploadError('validation','Use a search of up to 200 characters.');return (raw||'').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0,12);}
export const likeValue=(value:string)=>'%'+value.replace(/[\\%_]/g,'\\$&')+'%';

export function readTrackIds(raw:string){const ids=rowIds(raw.split(','));if(ids.length>500)throw new UploadError('validation','Read up to 500 tracks at once.');return ids;}
