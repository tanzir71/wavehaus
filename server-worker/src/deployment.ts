import build from '../../app/dist/deployment.json';
export const APP_BASE=build.base;
export function relativePath(path:string){if(APP_BASE==='/')return path;if(path===APP_BASE.slice(0,-1))return '/';return path.startsWith(APP_BASE)?'/'+path.slice(APP_BASE.length):null;}
