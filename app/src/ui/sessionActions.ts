import {clearDownloads} from '../library/downloads';
import { clearPlayer } from '../engine/player';
import { clearLibrary } from '../library/store';
import { authStatus,user } from '../library/session';
import { navigate } from './router';
export async function finishSignOut(broadcast=true){clearPlayer();clearLibrary();user.value=null;authStatus.value='signedOut';navigate('/sign-in');if(broadcast&&'BroadcastChannel'in window){const channel=new BroadcastChannel('wh-session');channel.postMessage('signedOut');channel.close();}await clearDownloads(true);}
