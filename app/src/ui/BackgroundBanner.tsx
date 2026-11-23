import {useEffect,useState} from 'preact/hooks';
import {isBrave,platform,openInBraveUrl} from '../engine/brave';
import {savedBackgroundResult} from '../engine/background-check';
import {href} from './router';
import {Icon} from './Icon';
const key='wh-bg-prompt:'+import.meta.env.BASE_URL;
export function BackgroundBanner(){
 const [brave,setBrave]=useState<boolean|null>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{if(platform()==='desktop')return;let live=true;const update=async()=>{const detected=await isBrave();if(!live)return;setBrave(detected);if(detected){let dismissed=0;try{dismissed=JSON.parse(localStorage.getItem(key)||'{}').dismissed||0;}catch{}setVisible(!savedBackgroundResult()?.pass&&Date.now()-dismissed>=7*86400000);return;}let policy:{count:number;dismissed:number;session?:string}={count:0,dismissed:0};try{policy={...policy,...JSON.parse(localStorage.getItem(key)||'{}')};}catch{}const session=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,session);if(Date.now()-policy.dismissed<7*86400000||policy.count>=3&&policy.session!==session){setVisible(false);return;}if(policy.session!==session){policy.count++;policy.session=session;localStorage.setItem(key,JSON.stringify(policy));}setVisible(true);};void update();addEventListener('wh-background-result',update);return()=>{live=false;removeEventListener('wh-background-result',update);};},[]);
 if(!visible||brave===null)return null;const dismiss=()=>{let policy={};try{policy=JSON.parse(localStorage.getItem(key)||'{}');}catch{}localStorage.setItem(key,JSON.stringify({...policy,dismissed:Date.now()}));setVisible(false);};
 return <aside class="brave-banner" aria-label="Background play setup"><Icon name="moon"/><span><strong>{brave?'Set up background play':'Background play works best in Brave.'}</strong><small>{brave?'Follow the checklist to keep playing with the screen off.':'Keep music going when you lock your phone or switch apps.'}</small><span class="background-banner-actions">{!brave&&<a href={openInBraveUrl()} class="text-link">Open in Brave</a>}<a href={href('/background-play')}>{brave?'Setup checklist':'How it works'}</a></span></span><button class="icon-button" aria-label="Dismiss background play hint" onClick={dismiss}><Icon name="x" size={16}/></button></aside>;
}
