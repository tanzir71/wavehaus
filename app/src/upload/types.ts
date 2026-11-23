import type { organise } from './organise';
export interface Analysis {
 hash:string;mime:string;metadata:ReturnType<typeof organise>&{durationMs:number;codec?:string;container?:string;sampleRate?:number;bitrate?:number;bitDepth?:number;channels?:number;bpm?:number;replaygainTrackDb?:number;replaygainAlbumDb?:number;originalPath:string;lyrics?:string;lyricsSynced?:boolean;quickHash?:string};
 album:{title:string;artistName:string;year?:number;folderPath:string;existingAlbumId?:string;importKey?:string};picture?:Blob;peaks?:string|null;warning?:string;
}
export interface PickedFile {file:File;path:string}
