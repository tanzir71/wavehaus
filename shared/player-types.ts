export type RepeatMode='off'|'all'|'one';
export type QueueSource='context'|'queue'|'autoplay';
export interface SavedQueue {
 context:string[];remaining:string[];manual:string[];automatic:string[];
 history:{id:string;source:QueueSource}[];current:string|null;currentSource:QueueSource;
 contextLabel:string;contextType:string;shuffle:boolean;repeat:RepeatMode;autoplay:boolean;
}
export type PlayerSnapshot={queue:string[];index:number;positionMs:number;shuffle:boolean;repeat:RepeatMode;autoplay:boolean;updatedAt:number;sections?:SavedQueue};
export type PlayInput={id?:string;trackId:string;startedAt:number;msPlayed:number;completed:boolean;skipped:boolean;context:string|null;deviceLabel:string|null};
