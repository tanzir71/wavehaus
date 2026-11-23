import {describe,it,expect} from 'vitest';
import {parsePattern,formatPattern,quickFix,PatternError} from '../../app/src/upload/rename';
describe('rename patterns',()=>{
 it('parses the design example before cleaning captured fields',()=>{
  expect(parsePattern('{track}_{artist}-{title}','02_mira okafor-neon harbour (official audio).mp3')).toEqual({track:2,artist:'Mira Okafor',title:'Neon Harbour'});
 });
 it('parses every available token and treats regex metacharacters literally',()=>{
  expect(parsePattern('[{disc}]. {track} + {artist} - {title} ({year}) [{genre}]','[2]. 03 + Halden - Arrival (2024) [Ambient].flac')).toEqual({disc:2,track:3,artist:'Halden',title:'Arrival',year:2024,genre:'Ambient'});
  expect(parsePattern('{albumartist} :: {album} :: {title}','The Collective :: Collected :: Shore')).toEqual({albumartist:'The Collective',album:'Collected',title:'Shore'});
 });
 it('supports ignored fields and deliberate whitespace differences',()=>{
  expect(parsePattern('{*} - {artist} - {title}','junk - Halden - Arrival')).toEqual({artist:'Halden',title:'Arrival'});
  expect(parsePattern('{track} - {title}','01-Arrival.wav')).toEqual({track:1,title:'Arrival'});
  expect(parsePattern('{track} {title}','02 Night Ferry.wav')).toEqual({track:2,title:'Night Ferry'});
 });
 it('returns an unmatched preview without inventing fields',()=>{
  expect(parsePattern('{track} - {title}','Halden - Arrival')).toBeNull();expect(parsePattern('{disc} - {title}','1000 - Arrival')).toBeNull();expect(parsePattern('{year} - {title}','9999 - Arrival')).toBeNull();expect(parsePattern('{track} - {title}','01 - ')).toBeNull();
 });
 it('rejects malformed, ambiguous or unknown patterns',()=>{
  for(const pattern of ['{unknown}','{artist}{title}','{title} - {title}','{title','title','{title}}','{*}'.repeat(50)])expect(()=>parsePattern(pattern,'anything')).toThrow(PatternError);
 });
 it('handles adversarial delimiters without creating a regex from tokens',()=>{
  const source='x-'.repeat(900)+'end';expect(parsePattern('{*}-{*}-{*}-{*}-{*}-{track}',source)).toBeNull();
 });
 it('formats titles without evaluating field contents or dropping leading zeroes',()=>{
  expect(formatPattern('{track} - {artist} - {title}',{track:2,artist:'Halden',title:'{year} $&'})).toBe('02 - Halden - {year} $&');
  expect(formatPattern('{disc}.{track} {title} {*}',{disc:2,track:3,title:'Shore'})).toBe('2.03 Shore');
 });
 it('prepares five hundred unique preview titles without modifying the source rows',()=>{
  const rows=Array.from({length:500},(_,i)=>({track:i+1,title:'Song '+(i+1),artist:'Artist'})),before=structuredClone(rows);
  const result=rows.map(row=>formatPattern('{track} - {title}',row));expect(result).toHaveLength(500);expect(new Set(result).size).toBe(500);expect(result[499]).toBe('500 - Song 500');expect(rows).toEqual(before);
 });
});
describe('quick fixes',()=>{
 it('preserves mixed case and meaningful suffixes while cleaning download noise',()=>{
  expect(quickFix('song (Live Remix) [HQ]','DJ iPhone','stripJunk')).toEqual({title:'song (Live Remix)',artist:'DJ iPhone'});
  expect(quickFix('LOW SUN','MIRA OKAFOR','titleCase')).toEqual({title:'Low Sun',artist:'Mira Okafor'});
 });
 it('moves featuring artists while retaining a live/remix qualifier',()=>{
  expect(quickFix('Arrival (feat. Mira & Halden) (Live)','Nils','mergeFeaturing')).toEqual({title:'Arrival (Live)',artist:'Nils, Mira & Halden'});
  expect(quickFix('Arrival feat. Mira (Remix)','Nils','mergeFeaturing')).toEqual({title:'Arrival (Remix)',artist:'Nils, Mira'});
  expect(quickFix('Arrival','Nils','mergeFeaturing')).toEqual({title:'Arrival',artist:'Nils'});
 });
 it('removes a numeric prefix only when a separator follows it',()=>{
  expect(quickFix('03 - Arrival','Halden','removeNumbers').title).toBe('Arrival');expect(quickFix('1999','Halden','removeNumbers').title).toBe('1999');
 });
});
