import { render,Component,type ComponentChildren } from 'preact';
import { effect } from '@preact/signals';
import { lazy,Suspense } from 'preact/compat';
import { api } from '@backend';
import { bootLibrary,busy,library,notice,toast } from './library/store';
import { restore,engineError,configureUser,updateLibrary } from './engine/player';
import { authStatus,user } from './library/session';
import { navigate } from './ui/router';
import { Avatar } from './ui/Avatar';
import { finishSignOut } from './ui/sessionActions';
import { FileDrop } from './ui/FileDrop';
import { captureSharedIntake,pendingShare } from './library/share';
import { route,href } from './ui/router';
import { Icon,IconSprite } from './ui/Icon';
import { Cover } from './ui/Cover';
import { Player } from './ui/Player';
import { Home,Library,Search,Collection,Settings } from './routes/Core';
import { NowPlaying,Queue } from './routes/Playback';
import { BackgroundPlay } from './routes/BackgroundPlay';
import logo from '../../handover/assets/brand/wavehaus-mark.svg?raw';
import './ui/tokens.css';
import './ui/app.css';
import './ui/playback.css';
const Upload=lazy(()=>import('./routes/Upload'));
const Auth=lazy(()=>import('./routes/Auth').then(module=>({default:module.AuthScreen})));
const nav=[['Home','home','/'],['Search','search','/search'],['Your library','library','/library'],['Settings','settings','/settings']] as const;
function Sidebar(){return <aside class="sidebar"><a class="brand" href={href('/')}><span class="brand-mark" aria-hidden="true" dangerouslySetInnerHTML={{__html:logo}}/>wavehaus</a><nav aria-label="Main navigation">{nav.map(([name,icon,path])=><a class={path==='/'?route.value==='/'?'selected':'':route.value.startsWith(path)?'selected':''} href={href(path)}><Icon name={icon}/><span>{name}</span></a>)}</nav><a class="button upload-button" href={href('/upload')}><Icon name="plus" size={20}/><span>Upload music</span></a><div class="sidebar-library"><div class="section-heading"><span class="eyebrow">Your playlists</span><a href={href('/library')} aria-label="View playlists"><Icon name="plus" size={18}/></a></div><a href={href('/playlist/liked')}><span class="liked-tile"><Icon name="heart-fill"/></span><span>Liked songs<small>{library.value.likes.length} songs</small></span></a>{library.value.playlists.map(p=><a href={href(`/playlist/${p.id}`)}><Cover title={p.name} artist="Wavehaus" size={40}/><span>{p.name}<small>Private playlist</small></span></a>)}</div><div class="storage-card"><Icon name="server" size={20}/><strong>Your music. Your server.</strong><p>{api.demo?'Browser demo · local storage':'Self-hosted · Private by default'}</p><a href="https://tanzir71.github.io/wavehaus/docs/">Self-host Wavehaus ↗</a></div></aside>;}
function MobileNav(){return <nav class="bottom-nav" aria-label="Mobile navigation">{[...nav.slice(0,3).map(([name,icon,path])=>[name==='Your library'?'Library':name,icon,path]),['Upload','upload','/upload']].map(([name,icon,path])=><a class={route.value===path?'selected':''} href={href(path)}><span><Icon name={icon} size={22}/></span>{name}</a>)}</nav>;}
function CurrentRoute(){const path=route.value.split('?')[0],parts=path.split('/').filter(Boolean);if(path==='/')return <Home/>;if(parts[0]==='upload')return <Upload/>;if(parts[0]==='library')return <Library/>;if(parts[0]==='search')return <Search/>;if(['album','playlist','artist'].includes(parts[0]))return <Collection kind={parts[0]} id={parts[1]}/>;if(parts[0]==='now-playing')return <NowPlaying/>;if(parts[0]==='queue')return <Queue/>;if(parts[0]==='background-play')return <BackgroundPlay/>;if(parts[0]==='settings')return <Settings section={parts[1]}/>;return <div class="empty"><h1>A little off track.</h1><p>This page is not here yet.</p><a class="button" href={href('/')}>Back to Home</a></div>;}
class Boundary extends Component<{children:ComponentChildren},{error:string}>{state={error:''};componentDidCatch(error:Error){this.setState({error:error.message});}render(){return this.state.error?<section class="empty"><h1>Something interrupted your music.</h1><p>{this.state.error}</p><button class="button" onClick={()=>location.reload()}>Try again</button></section>:this.props.children;}}
function App(){
 const authentication=/^\/(sign-in|setup|pair|join)(\/|$)/.test(route.value)||authStatus.value!=='signedIn';
 const message=notice.value||engineError.value;
 if(busy.value)return <><IconSprite/><main id="main"><div class="loading" role="status"><span class="loading-mark">∿</span><h1>{api.demo?'Preparing demo library…':'Opening Wavehaus…'}</h1><p>{api.demo?'Making a little original music. Everything stays here.':'Your music, at home.'}</p></div></main></>;
 if(authentication)return <><IconSprite/>{api.demo&&<div class="demo-banner">Demo mode: everything stays in this browser.</div>}<Boundary><Suspense fallback={<p class="loading" role="status">Opening…</p>}>{authStatus.value==='loading'?<main class="empty"><h1>Could not open Wavehaus.</h1><p>{message}</p><button class="button" onClick={()=>location.reload()}>Try again</button></main>:<Auth key={route.value} path={route.value}/>}</Suspense></Boundary>{message&&<div class="toast" role="status">{message}</div>}</>;
 return <><IconSprite/><a class="skip-link" href="#main">Skip to content</a><FileDrop/><Sidebar/><div class="app-body">{api.demo&&<div class="demo-banner">Demo mode: everything stays in this browser.</div>}<div class="topbar"><div class="topbar-history"><button class="icon-button" aria-label="Go back" onClick={()=>history.back()}><Icon name="chevron-left"/></button><button class="icon-button" aria-label="Go forward" onClick={()=>history.forward()}><Icon name="chevron-right"/></button></div><a class="top-search" href={href('/search')}><Icon name="search" size={18}/><span>Search songs, albums, folders, moments</span><kbd>/</kbd></a><Avatar/></div><main id="main" tabIndex={-1} class={route.value==='/now-playing'?'now-route':route.value==='/queue'?'queue-route':''}><Boundary><Suspense fallback={<p role="status">Opening…</p>}><CurrentRoute/></Suspense></Boundary></main></div><Player/><MobileNav/>{message&&<div class="toast" role="status">{message}</div>}</>;
}
async function serviceWorker(){if(!('serviceWorker'in navigator))return;const reg=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL,type:'module'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});}
const root=document.getElementById('app')!;root.textContent='';render(<App/>,root);
captureSharedIntake();
effect(()=>{const data=library.value;updateLibrary(data.tracks,data.albums);});
serviceWorker().then(bootLibrary).then(async()=>{if(authStatus.value==='setup'&&route.value!=='/setup/reset')navigate('/setup');else if(authStatus.value==='signedOut'&&!/^\/(sign-in|pair|join|setup\/reset)(\/|$)/.test(route.value))navigate('/sign-in');if(user.value){configureUser(user.value.id);await restore(library.value.tracks);const shared=pendingShare();if(shared)navigate(`/upload?shared=${encodeURIComponent(shared)}`);}}).catch(e=>{busy.value=false;document.body.dataset.busy='false';toast(e.message);});
addEventListener('wh-unauthenticated',()=>{if(authStatus.value==='signedIn')finishSignOut();});
if('BroadcastChannel'in window){const channel=new BroadcastChannel('wh-session');channel.onmessage=event=>{if(event.data==='signedOut'&&authStatus.value==='signedIn')finishSignOut(false);};}
addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes((e.target as Element).tagName)){e.preventDefault();location.assign(href('/search'));}});
