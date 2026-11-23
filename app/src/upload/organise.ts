export function stripJunk(value:string){return value.replace(/\.(mp3|wav|flac|m4a|ogg|opus|aiff?)(?:\.\1)*$/i,'').replace(/\[(official|lyric|audio|video|hq|hd|320|flac|mp3|free download)[^\]]*\]/gi,'').replace(/\((official\s*)?(music\s*)?(video|audio|lyrics?)\)/gi,'').replace(/ - Copy|\(\d+\)(?=\s*$)|www\.[\w.-]+\.com/gi,'').replace(/_/g,' ').replace(/\s+/g,' ').trim();}
export function titleCase(s:string){if(s!==s.toLowerCase()&&s!==s.toUpperCase())return s;return s.replace(/\b[\w']+\b/g,w=>/^(dj|mc|ep|lp|uk|usa|[ivxlcdm]+)$/i.test(w)?w.toUpperCase():w[0].toUpperCase()+w.slice(1).toLowerCase());}
export function organise(filename:string,path=filename,tags:Record<string,unknown>={}){
 const segments=path.replace(/\\/g,'/').split('/'),folders=segments.slice(0,-1);let disc:number|undefined;const discFolder=folders.at(-1)?.match(/^(?:CD|Disc\s*)(\d+)(?:\s+of\s+\d+)?$/i);if(discFolder){disc=Number(discFolder[1]);folders.pop();}
 const clean=stripJunk(filename);let guessedTitle=clean,guessedArtist='',track:number|undefined;let match;
 if((match=/^(\d)(\d{2})\s+(.+)$/.exec(clean))){disc=Number(match[1]);track=Number(match[2]);guessedTitle=match[3];}
 else if((match=/^(\d{1,3})[\s._-]+(.+?)\s+-\s+(.+)$/.exec(clean))){track=Number(match[1]);guessedArtist=match[2];guessedTitle=match[3];}
 else if((match=/^(.+?)\s+-\s+(\d{1,3})\s+-\s+(.+)$/.exec(clean))){guessedArtist=match[1];track=Number(match[2]);guessedTitle=match[3];}
 else if((match=/^(\d{1,3})[\s._-]+(.+)$/.exec(clean))){track=Number(match[1]);guessedTitle=match[2];}
 else if((match=/^(.+?)\s+-\s+(.+)$/.exec(clean))){guessedArtist=match[1];guessedTitle=match[2];}
 let album=String(tags.album||folders.at(-1)||''),artist=String(tags.artist||guessedArtist||folders.at(-2)||'Unknown artist'),year=Number(tags.year)||undefined;
 const folderPattern=folders.at(-1)?.match(/^(.+?)\s+-\s+(.+?)(?:\s*\((\d{4})\))?$/);if(!tags.album&&folderPattern){artist=String(tags.artist||folderPattern[1]);album=folderPattern[2];year=year||Number(folderPattern[3])||undefined;}
 const recording=/^(Recording\s*\d+|PTT[-_]|AUD[-_])/i.test(filename);if(recording)album='Recordings';if(!album)album=artist==='Unknown artist'?'Unsorted':`Singles · ${artist}`;
 return {title:titleCase(stripJunk(String(tags.title||guessedTitle))),artist:titleCase(stripJunk(artist)),albumArtist:String(tags.albumartist||artist),album:titleCase(stripJunk(album)),year,genre:Array.isArray(tags.genre)?tags.genre.join(', '):String(tags.genre||''),trackNo:(tags.track as {no?:number})?.no||track,discNo:(tags.disk as {no?:number})?.no||disc||1,organiseSource:tags.title&&tags.artist&&tags.album?'tags':folders.length?'folder':'filename'};
}
