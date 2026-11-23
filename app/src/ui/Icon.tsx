import sprite from './icons.svg?raw';
export function IconSprite(){return <div hidden aria-hidden="true" dangerouslySetInnerHTML={{__html:sprite}}/>;}
export function Icon({name,size=24}:{name:string;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href={`#icon-${name}`}/></svg>;}
