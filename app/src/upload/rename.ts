import {stripJunk,titleCase} from './organise';
export const patternTokens=['track','disc','artist','albumartist','album','year','title','genre','*'] as const;
type Token=typeof patternTokens[number];
type Piece={token:Token}|{literal:string};
export type RenameFields=Partial<Record<Exclude<Token,'*'>,string|number|null>>;
export class PatternError extends Error {}
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const literalRegex=(text:string,anchored=false)=>new RegExp((anchored?'^':'')+text.split(/(\s+)/).map(part=>/^\s+$/.test(part)?text.trim()?'\\s*':'\\s+':escape(part)).join(''),'iu');
function pieces(pattern:string):Piece[]{
 if(!pattern.trim()||pattern.length>300)throw new PatternError('Use a pattern from 1 to 300 characters.');
 const parts:Piece[]=[],used=new Set<string>();let at=0;
 for(const match of pattern.matchAll(/\{([^{}]+)\}/g)){
  const literal=pattern.slice(at,match.index);if(/[{}]/.test(literal))throw new PatternError('Close each token with a brace.');if(literal)parts.push({literal});
  const token=match[1].toLowerCase() as Token;if(!patternTokens.includes(token))throw new PatternError(`Unknown token: {${match[1]}}.`);
  if(token!=='*'&&used.has(token))throw new PatternError(`Use {${token}} once per pattern.`);used.add(token);
  if(parts.at(-1)&&'token'in parts.at(-1)!)throw new PatternError('Put a separator between tokens.');parts.push({token});at=match.index!+match[0].length;
 }
 const tail=pattern.slice(at);if(/[{}]/.test(tail))throw new PatternError('Use a known token inside each pair of braces.');if(tail)parts.push({literal:tail});
 if(!parts.some(p=>'token'in p)||parts.filter(p=>'token'in p).length>16)throw new PatternError('Use between 1 and 16 tokens.');return parts;
}
/** A linear delimiter parser: user patterns never become a backtracking regex. */
export function parsePattern(pattern:string,source:string):RenameFields|null{
 const parts=pieces(pattern);if(source.length>2000)return null;let rest=source.trim().replace(/\.(?:mp3|flac|m4a|alac|ogg|opus|wav|aiff?)(?:\.(?:mp3|flac|m4a|alac|ogg|opus|wav|aiff?))*$/i,''),result:RenameFields={};
 for(let i=0;i<parts.length;i++){
  const part=parts[i];if('literal'in part){const match=literalRegex(part.literal,true).exec(rest);if(!match)return null;rest=rest.slice(match[0].length);continue;}
  const next=parts[i+1];let capture=rest;
  if(next&&'literal'in next){const match=literalRegex(next.literal).exec(rest);if(!match)return null;capture=rest.slice(0,match.index);}
  rest=rest.slice(capture.length);capture=capture.trim();if(part.token==='*')continue;if(!capture)return null;
  if(['track','disc','year'].includes(part.token)){if(!/^\d{1,4}$/.test(capture))return null;const value=Number(capture),max=part.token==='track'?9999:part.token==='disc'?999:2999;if(value<1||value>max)return null;result[part.token as 'track'|'disc'|'year']=value;}
  else{const value=titleCase(stripJunk(capture));if(!value||[...value].length>500)return null;result[part.token]=value;}
 }return rest.trim()?null:result;
}
export function formatPattern(pattern:string,fields:RenameFields){
 return pieces(pattern).map(part=>{
  if('literal'in part)return part.literal;if(part.token==='*')return '';const value=fields[part.token];if(value===null||value===undefined)return '';
  return part.token==='track'?String(value).padStart(2,'0'):String(value);
 }).join('').trim().replace(/\s+/g,' ');
}
export type QuickFix='titleCase'|'stripJunk'|'removeNumbers'|'mergeFeaturing';
export function quickFix(title:string,artist:string,fix:QuickFix){
 if(fix==='titleCase')return {title:titleCase(title),artist:titleCase(artist)};
 if(fix==='stripJunk')return {title:stripJunk(title),artist:stripJunk(artist)};
 if(fix==='removeNumbers')return {title:title.replace(/^\d{1,3}[\s._-]+/,'').trim(),artist};
 const match=/\s*\(?(?:\bfeat\.?|\bft\.?|\bfeaturing)\s+([^()[\]]+)\)?/i.exec(title);
 if(!match)return {title,artist};const guest=match[1].trim(),name=artist.trim();
 return {title:(title.slice(0,match.index)+' '+title.slice(match.index+match[0].length)).trim().replace(/\s+/g,' '),artist:name?`${name}, ${guest}`:guest};
}
