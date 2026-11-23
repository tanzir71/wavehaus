import type { Database,Statement } from './types';
export const stmt=(db:Database,sql:string,...params:unknown[]):Statement=>db.prepare(sql).bind(...params);
export const one=<T=Record<string,unknown>>(db:Database,sql:string,...params:unknown[])=>stmt(db,sql,...params).first<T>();
export async function all<T=Record<string,unknown>>(db:Database,sql:string,...params:unknown[]){return (await stmt(db,sql,...params).all<T>()).results;}
export const run=(db:Database,sql:string,...params:unknown[])=>stmt(db,sql,...params).run();
export async function settings(db:Database){const rows=await all<{key:string;value:string}>(db,'SELECT key,value FROM settings');return Object.fromEntries(rows.map(r=>[r.key,JSON.parse(r.value)]));}
