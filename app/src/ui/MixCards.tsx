import {mixes,recommendationsReady} from '../library/recommendations';
import {Cover} from './Cover';
import {href} from './router';
export function MixCards(){return <div class="album-grid mix-grid">{mixes.value.map(mix=><a key={mix.id} class="album-card" href={href('/mix/'+mix.id)}><Cover title={mix.name} artist={mix.artist} size={184}/><strong>{mix.name}</strong><small>{mix.subtitle}</small></a>)}{!mixes.value.length&&<p class="muted">{recommendationsReady.value?'Add music to make your first mix.':'Preparing your mixes…'}</p>}</div>;}
