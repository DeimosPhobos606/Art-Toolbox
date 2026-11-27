// Shared libraries live in reserved assets, using the existing revision store and
// backup schema. Resources are copied to an asset on use, not linked remotely.
export const GLOBAL_PROJECT="__at_global_project__",GLOBAL_ASSET="__at_global_library__";
export const isLibraryAsset=a=>!!a&&(a.id===GLOBAL_ASSET||a.id.startsWith("__at_project_library__:"));
export const isLibraryProject=p=>p?.id===GLOBAL_PROJECT;
export const libraryAsset=(scope,projectId)=>scope==="global"?GLOBAL_ASSET:"__at_project_library__:"+projectId;
export async function ensureLibrary(w,scope,projectId){let a=libraryAsset(scope,projectId);if(w.state.assets.some(x=>x.id===a))return a;
 await w.transact(s=>{if(s.assets.some(x=>x.id===a))return;let p=scope==="global"?GLOBAL_PROJECT:projectId;if(scope==="global"&&!s.projects.some(x=>x.id===p))s.projects.push({id:p,name:"Global Library",internal:true,created:Date.now()});if(!s.projects.some(x=>x.id===p))throw Error("Выбери проект");s.assets.push({id:a,projectId:p,name:scope==="global"?"Global Library":"Project Library",internal:true,created:Date.now()});});return a;}
export function libraryKind(file){let ext=file.name.toLowerCase().split(".").pop();if(["obj","glb","fbx"].includes(ext))return "mesh";if(["png","jpg","jpeg","webp"].includes(ext))return "texture";if(ext==="json")return "preset";throw Error("Поддерживаются изображения, OBJ/GLB/FBX и JSON");}
export async function copyResource(from,to,sourceAsset,resourceId,targetAsset,slot){let {resource:r,blob}=await from.get(sourceAsset,resourceId);let meta={...r.meta,libraryOrigin:{asset:sourceAsset,id:r.id,revision:r.revision}};delete meta.meshRev;delete meta.sourceId;let dest=slot||(r.kind==="mesh"?"mesh":"library:"+r.id);return to.put(targetAsset,dest,blob,{name:r.name,kind:r.kind,meta});}
