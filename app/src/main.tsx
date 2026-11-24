import { render,Component,type ComponentChildren } from 'preact';
import { effect } from '@preact/signals';
import { lazy,Suspense } from 'preact/compat';
import { api } from '@backend';
import {trackUpdates} from './library/updates';
import {reconcileDownloads,offlineMode} from './library/downloads';
import { bootLibrary,clearLibrary,busy,library,sync,notice,toast,undoAction } from './library/store';
import { restore,engineError,configureUser,updateLibrary } from './engine/player';
import { authStatus,user,loadSession } from './library/session';
import { navigate } from './ui/router';
import { canVisitSignedOut, isPublicGuide } from './ui/public-route';
import { Avatar } from './ui/Avatar';
import { finishSignOut } from './ui/sessionActions';
import {installScrollClickGuard} from './ui/touch-intent';
import { FileDrop } from './ui/FileDrop';
import {SelectionBar} from './ui/SelectionBar';
import { captureSharedIntake,pendingShare } from './library/share';
import { route,href } from './ui/router';
import { Icon,IconSprite } from './ui/Icon';
import { Cover } from './ui/Cover';
import { Player } from './ui/Player';
import { Home,Settings } from './routes/Core';
import { NowPlaying,Queue } from './routes/Playback';
import { BackgroundPlay } from './routes/BackgroundPlay';
import logo from '../../handover/assets/brand/wavehaus-mark.svg?raw';
import './ui/tokens.css';
import './ui/app.css';
import './ui/playback.css';
import './ui/desktop-density.css';
const removeScrollClickGuard=installScrollClickGuard(document);if(import.meta.hot)import.meta.hot.dispose(removeScrollClickGuard);
const Storage=lazy(()=>import('./routes/Storage'));
const Upload=lazy(()=>import('./routes/Upload'));
const Library=lazy(()=>import('./routes/Library'));
const Search=lazy(()=>import('./routes/Search'));
const Collection=lazy(()=>import('./routes/Collection'));
const BulkEdit=lazy(()=>import('./routes/BulkEdit'));
const ReviewImport=lazy(()=>import('./routes/ReviewImport'));
const Auth=lazy(()=>import('./routes/Auth').then(module=>({default:module.AuthScreen})));
const nav=[['Home','home','/'],['Search','search','/search'],['Your library','library','/library'],['Settings','settings','/settings']] as const;
function Sidebar(){return <aside class="sidebar"><a class="brand" href={href('/')}><span class="brand-mark" aria-hidden="true" dangerouslySetInnerHTML={{__html:logo}}/>wavehaus</a><nav aria-label="Main navigation">{nav.map(([name,icon,path])=><a class={path==='/'?route.value==='/'?'selected':'':route.value.startsWith(path)?'selected':''} href={href(path)}><Icon name={icon}/><span>{name}</span></a>)}</nav><a class="button upload-button" href={href('/upload')}><Icon name="plus" size={20}/><span>Upload music</span></a><div class="sidebar-library"><div class="section-heading"><span class="eyebrow">{user.value?'Your playlists':'Public playlists'}</span><a href={href('/library?tab=Playlists&create=1')} aria-label="Create playlist"><Icon name="plus" size={18}/></a></div><a href={href('/playlist/liked')}><span class="liked-tile"><Icon name="heart-fill"/></span><span>Liked songs<small>{library.value.likes.length} songs</small></span></a>{library.value.playlists.map(p=><a href={href(`/playlist/${p.id}`)}><Cover title={p.name} artist="Wavehaus" size={40}/><span>{p.name}<small>{p.visibility==='public'?'Public':'Private'} playlist</small></span></a>)}</div><div class="storage-card"><Icon name="server" size={20}/><strong>Your music. Your server.</strong><p>{api.demo?'Browser demo · local storage':'Self-hosted · Private by default'}</p><a href="https://tanzir71.github.io/wavehaus/docs/">Self-host Wavehaus ↗</a></div></aside>;}
function MobileNav(){return <nav class="bottom-nav" aria-label="Mobile navigation">{[...nav.slice(0,3).map(([name,icon,path])=>[name==='Your library'?'Library':name,icon,path]),['Upload','upload','/upload']].map(([name,icon,path])=><a aria-current={route.value===path?'page':undefined} class={route.value===path?'selected':''} href={href(path)}><span><Icon name={icon} size={22}/></span>{name}</a>)}</nav>;}
function Toast({message}:{message:string}){return <div class="toast" role="status">{message}{undoAction.value&&<button class="button" onClick={()=>{const id=undoAction.value;if(id)void import('./library/edits').then(module=>module.undoChange(id)).catch(error=>toast(error.message));}}>Undo</button>}</div>;}
function CurrentRoute(){const path=route.value.split('?')[0],parts=path.split('/').filter(Boolean);if(path==='/')return <Home/>;if(parts[0]==='upload')return <Upload/>;if(['bulk-edit','bulk'].includes(parts[0]))return <BulkEdit/>;if(parts[0]==='review')return <ReviewImport/>;if(parts[0]==='downloads')return <Storage downloads/>;if(parts[0]==='library')return <Library/>;if(parts[0]==='search')return <Search/>;if(['album','playlist','artist','folder','mix'].includes(parts[0]))return <Collection key={path} kind={parts[0]} id={parts[1]}/>;if(parts[0]==='now-playing')return <NowPlaying/>;if(parts[0]==='queue')return <Queue/>;if(parts[0]==='background-play')return <BackgroundPlay/>;if(parts[0]==='settings')return <Settings section={parts[1]}/>;return <div class="empty"><h1>A little off track.</h1><p>This page is not here yet.</p><a class="button" href={href('/')}>Back to Home</a></div>;}
class Boundary extends Component<{children:ComponentChildren},{error:string}>{state={error:''};componentDidCatch(error:Error){this.setState({error:error.message});}render(){return this.state.error?<section class="empty"><h1>Something interrupted your music.</h1><p>{this.state.error}</p><button class="button" onClick={()=>location.reload()}>Try again</button></section>:this.props.children;}}
function App(){
 const publicGuide=isPublicGuide(route.value);
 const authentication=!publicGuide&&(/^\/(sign-in|setup|pair|join)(\/|$)/.test(route.value)||authStatus.value==='setup'||authStatus.value==='loading'||authStatus.value==='signedOut'&&!canVisitSignedOut(route.value));
 const message=notice.value||engineError.value;
 if(busy.value)return <><IconSprite/><main id="main"><div class="loading" role="status"><span class="loading-mark">∿</span><h1>{api.demo?'Preparing demo library…':'Opening Wavehaus…'}</h1><p>{api.demo?'Making a little original music. Everything stays here.':'Your music, at home.'}</p></div></main></>;
 if(publicGuide&&authStatus.value!=='signedIn')return <><IconSprite/><main id="main" class="public-guide"><a class="button" href={href('/sign-in')}>Sign in to Wavehaus</a><BackgroundPlay/></main>{message&&<Toast message={message}/>}</>;
 if(authentication)return <><IconSprite/>{api.demo&&<div class="demo-banner">Demo mode: everything stays in this browser.</div>}<Boundary><Suspense fallback={<p class="loading" role="status">Opening…</p>}>{authStatus.value==='loading'?<main class="empty"><h1>Could not open Wavehaus.</h1><p>{message}</p><button class="button" onClick={()=>location.reload()}>Try again</button></main>:<Auth key={route.value} path={route.value}/>}</Suspense></Boundary>{message&&<Toast message={message}/>}</>;
 return <><IconSprite/><a class="skip-link" href="#main">Skip to content</a>{user.value&&<FileDrop/>}<Sidebar/><div class="app-body">{api.demo&&<div class="demo-banner">Demo mode: everything stays in this browser.</div>}{offlineMode.value&&<div role="status" class="offline-banner">Offline · downloaded music is available.</div>}<div class="topbar"><div class="topbar-history"><button class="icon-button" aria-label="Go back" onClick={()=>history.back()}><Icon name="chevron-left"/></button><button class="icon-button" aria-label="Go forward" onClick={()=>history.forward()}><Icon name="chevron-right"/></button></div><a class="top-search" href={href('/search')}><Icon name="search" size={18}/><span>Search songs, albums, folders, moments</span><kbd>/</kbd></a><Avatar/></div><main id="main" tabIndex={-1} class={route.value==='/now-playing'?'now-route':route.value==='/queue'?'queue-route':''}><Boundary><Suspense fallback={<p role="status">Opening…</p>}><CurrentRoute/></Suspense></Boundary></main></div><Player/><MobileNav/><SelectionBar/>{message&&<Toast message={message}/>}</>;
}
async function serviceWorker(){if(!('serviceWorker'in navigator))return;const reg=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL,type:'module'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));trackUpdates(reg);}
const root=document.getElementById('app')!;root.textContent='';render(<App/>,root);
captureSharedIntake();
effect(()=>{const data=library.value;updateLibrary(data.tracks,data.albums);if(user.value&&!busy.value)void reconcileDownloads(user.value.id,data.tracks,data.albums).catch(()=>{});});
serviceWorker().then(bootLibrary).then(async()=>{if(authStatus.value==='setup'&&route.value!=='/setup/reset'&&!isPublicGuide(route.value))navigate('/setup');else if(!api.demo&&authStatus.value==='signedIn'&&route.value==='/setup')navigate('/');else if(authStatus.value==='signedOut'&&!canVisitSignedOut(route.value))navigate('/sign-in');if(user.value){configureUser(user.value.id);await restore(library.value.tracks);const shared=pendingShare();if(shared)navigate(`/upload?shared=${encodeURIComponent(shared)}`);}}).catch(e=>{busy.value=false;document.body.dataset.busy='false';toast(e.message);});
addEventListener('wh-unauthenticated',()=>{if(authStatus.value==='signedIn')finishSignOut();});
if('BroadcastChannel'in window){const channel=new BroadcastChannel('wh-session');channel.onmessage=event=>{if(event.data==='signedOut'&&authStatus.value==='signedIn')finishSignOut(false);};}
addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes((e.target as Element).tagName)){e.preventDefault();navigate('/search');setTimeout(()=>document.querySelector<HTMLInputElement>('[data-testid=music-search]')?.focus(),0);}});

addEventListener('online',()=>{const wasSignedIn=!!user.peek();void loadSession().then(()=>{if(wasSignedIn&&!user.peek())return finishSignOut();return sync();}).catch(error=>toast(error.message));});

addEventListener('offline',()=>{offlineMode.value=true;});
