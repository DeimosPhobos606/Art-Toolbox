// Art Toolbox storage schema is independent of application releases.
export const SCHEMA=1;
export const empty=()=>({schema:SCHEMA,projects:[],assets:[],resources:[],active:null});
export function validate(s){if(!s||s.schema!==SCHEMA||!Array.isArray(s.projects)||!Array.isArray(s.assets)||!Array.isArray(s.resources))throw Error("Unsupported project schema");return s;}
export function nextResource(old,{assetId,slot,name,kind,meta={}},id,now){if(old&&old.assetId!==assetId)throw Error("Wrong asset");return {id:old?.id||id,assetId,slot,name,kind,meta,revision:(old?.revision||0)+1,updated:now};}
export const id=()=>crypto.randomUUID();
export function openDB(){return new Promise((ok,no)=>{let r=indexedDB.open("art-toolbox-projects",1);r.onupgradeneeded=()=>{for(const name of ["meta","blobs","sessions"])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>no(Error("Close other Art Toolbox tabs"));});}
export class LocalStore{
 constructor(db){this.db=db}
 read(store,key){return new Promise((ok,no)=>{let t=this.db.transaction(store),r=t.objectStore(store).get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
 commit(ops){return new Promise((ok,no)=>{let t=this.db.transaction([...new Set(ops.map(o=>o.store))],"readwrite");t.oncomplete=()=>ok();t.onabort=()=>no(t.error||Error("Save aborted"));try{for(let o of ops){let s=t.objectStore(o.store);if(o.remove)s.delete(o.key);else s.put(o.value,o.key);}}catch(e){t.abort();no(e);}});}
}
export class Workspace extends EventTarget{
 constructor(store,state){super();this.store=store;this.state=validate(state);this.tail=Promise.resolve();}
 static async open(){let store=new LocalStore(await openDB());return new Workspace(store,(await store.read("meta","workspace"))||empty());}
 transact(fn){let task=this.tail.then(async()=>{let draft=structuredClone(this.state),ops=[],result=await fn(draft,ops);ops.push({store:"meta",key:"workspace",value:draft});await this.store.commit(ops);this.state=draft;this.dispatchEvent(new Event("change"));return result;});this.tail=task.catch(()=>{});return task;}
 asset(s,a){let found=s.assets.find(x=>x.id===a);if(!found)throw Error("Asset not found");return found;}
 async project(name){return this.transact(s=>{let p={id:id(),name:name.trim()||"Project",created:Date.now()};s.projects.push(p);return p;});}
 async addAsset(projectId,name){return this.transact(s=>{if(!s.projects.some(p=>p.id===projectId))throw Error("Project not found");let a={id:id(),projectId,name:name.trim()||"Asset",created:Date.now()};s.assets.push(a);s.active=a.id;return a;});}
 async activate(assetId){return this.transact(s=>{this.asset(s,assetId);s.active=assetId;});}
 list(assetId){return this.state.resources.filter(r=>r.assetId===assetId);}
 async put(assetId,slot,blob,opts={}){if(!(blob instanceof Blob))throw Error("Expected Blob");return this.transact((s,ops)=>{this.asset(s,assetId);let old=s.resources.find(r=>r.assetId===assetId&&r.slot===slot),r=nextResource(old,{assetId,slot,name:opts.name||slot,kind:opts.kind||"texture",meta:opts.meta||{}},id(),Date.now());s.resources=s.resources.filter(x=>x.id!==r.id);s.resources.push(r);ops.push({store:"blobs",key:r.id+":"+r.revision,value:blob});return r;});}
 async get(assetId,resourceId,revision){await this.tail;let r=this.list(assetId).find(x=>x.id===resourceId);if(!r)throw Error("Resource not found");let blob=await this.store.read("blobs",r.id+":"+(revision||r.revision));if(!blob)throw Error("Missing resource file");return {resource:r,blob};}
 async session(assetId,tool){await this.tail;this.asset(this.state,assetId);return await this.store.read("sessions",assetId+":"+tool)||{};}
 async saveSession(assetId,tool,patch){return this.transact(async(s,ops)=>{this.asset(s,assetId);let key=assetId+":"+tool,old=await this.store.read("sessions",key)||{};ops.push({store:"sessions",key,value:{...old,...patch}});});}
}
// Cloud transport is intentionally not implemented yet. This is the future boundary.
export class CloudTransport{async upload(){throw Error("Cloud is not connected")}async download(){throw Error("Cloud is not connected")}}
