import MiniSearch from 'minisearch';
export interface SearchDocument {id:string;title:string;artist:string;album:string;albumArtist:string;folder:string;genre:string;momentLabels:string;visibility:string;downloaded:boolean}
const fields=['title','artist','album','albumArtist','folder','genre','momentLabels'],index=new MiniSearch<SearchDocument>({fields,storeFields:['visibility','downloaded']}),documents=new Map<string,SearchDocument>();
self.onmessage=(event:MessageEvent<{id:number;type:string;upserts?:SearchDocument[];removed?:string[];query?:string;privateOnly?:boolean;downloadedOnly?:boolean}>)=>{
 const message=event.data;try{if(message.type==='sync'){for(const id of message.removed||[]){const previous=documents.get(id);if(previous){index.remove(previous);documents.delete(id);}}for(const doc of message.upserts||[]){const previous=documents.get(doc.id);if(previous)index.remove(previous);index.add(doc);documents.set(doc.id,doc);}self.postMessage({id:message.id,ready:true});return;}
 const query=message.query||'',results=query?index.search(query,{prefix:true,fuzzy:.2,combineWith:'AND',boost:{title:3,artist:2,album:2,albumArtist:1.5,folder:1,genre:1,momentLabels:1},filter:result=>(!message.privateOnly||result.visibility==='private')&&(!message.downloadedOnly||result.downloaded)}).slice(0,500).map(result=>({id:String(result.id),score:result.score})):[];self.postMessage({id:message.id,results});
 }catch(error){self.postMessage({id:message.id,error:(error as Error).message,results:[]});}
};
