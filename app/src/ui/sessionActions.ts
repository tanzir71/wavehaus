import {clearDownloads} from '../library/downloads';
import { clearPlayer,restore } from '../engine/player';
import {sync,library} from '../library/store';
import { clearLibrary } from '../library/store';
import { authStatus,user } from '../library/session';
import { navigate } from './router';
export async function finishSignOut(broadcast=true){clearPlayer();clearLibrary();user.value=null;authStatus.value='signedOut';navigate('/');if(broadcast&&'BroadcastChannel'in window){const channel=new BroadcastChannel('wh-session');channel.postMessage('signedOut');channel.close();}await clearDownloads(true);await sync().then(()=>restore(library.value.tracks)).catch(()=>{});}
