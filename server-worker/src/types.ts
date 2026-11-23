export interface Statement { bind(...values:unknown[]):Statement; first<T=Record<string,unknown>>():Promise<T|null>; all<T=Record<string,unknown>>():Promise<{results:T[]}>; run():Promise<Result> }
export interface Result { success:boolean; meta:{changes:number}; results?:Record<string,unknown>[] }
export interface Database { prepare(sql:string):Statement; batch(statements:Statement[]):Promise<Result[]> }
export interface Env { DB:Database; ASSETS:{fetch(request:Request):Promise<Response>}; APP_SECRET:string; RESET_OWNER?:string; PBKDF2_ITERATIONS?:string }
export type User={id:string;username:string;display_name:string;password_hash:string;role:string;status:string;used_bytes:number;quota_bytes:number|null;invites_left:number;created_at:number};
export type Session={id:string;user_id:string;device_label:string;created_at:number;last_seen_at:number;expires_at:number};
export type Auth={user:Omit<User,'password_hash'>;session:Session};
export type Settings=Record<string,unknown>;
