// Geometry-only import. Lazy-load pinned local FBXLoader; no CDN or external textures.
const MAX_BYTES=80*1024*1024, MAX_TRIANGLES=1500000;
let loaderPromise;
export async function importMesh(file,parsers={}){
 if(file.size>MAX_BYTES)throw Error("Модель больше 80 МБ");
 let ext=file.name.toLowerCase().split(".").pop();
 if(ext==="obj"&&parsers.obj)return parsers.obj(await file.text());
 if(ext==="glb"&&parsers.glb)return parsers.glb(await file.arrayBuffer());
 if(ext==="fbx")return importFBX(file);
 throw Error("Поддерживаемые форматы: OBJ, GLB, FBX");
}
export async function importFBX(file){
 if(file.size>MAX_BYTES)throw Error("Модель больше 80 МБ");
 loaderPromise||=import("../vendor/three-r180/examples/jsm/loaders/FBXLoader.js").catch(e=>{loaderPromise=null;throw Error("Не удалось загрузить FBXLoader: "+e.message);});
 const {FBXLoader}=await loaderPromise;
 let root;
 try{root=new FBXLoader().parse(await file.arrayBuffer(),"");return flattenFBX(root);}
 finally{if(root)root.traverse(o=>{o.geometry?.dispose();for(let m of (Array.isArray(o.material)?o.material:[o.material]))m?.dispose();});}
}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((x,i)=>x-b[i]);
const unit=(a,fallback)=>{let d=Math.hypot(...a);return d>1e-12&&Number.isFinite(d)?a.map(x=>x/d):fallback;};
export function flattenFBX(root){
 root.updateMatrixWorld(true);
 let items=[],total=0,names=[],nameIndex=new Map(),materialNames=[],materialIndex=new Map(),missingNormals=0,skinnedMeshes=0;
 root.traverse(o=>{
  if(!o.isMesh||!o.geometry)return;
  let g=o.geometry,p=g.getAttribute("position"),n=g.getAttribute("normal"),uv=g.getAttribute("uv"),index=g.getIndex(),count=index?index.count:p?.count||0;
  if(!count)return;
  if(!p||p.itemSize<3||count%3)throw Error("FBX: нужна треугольная геометрия");
  if(!uv||uv.itemSize<2||uv.count!==p.count)throw Error("FBX: отсутствует UV0 у меша "+(o.userData?.originalName||o.name||"без имени"));
  if(n&&n.count!==p.count)throw Error("FBX: некорректные нормали");
  total+=count/3;if(total>MAX_TRIANGLES)throw Error("FBX: лимит 1,5 млн треугольников");
  let name=o.userData?.originalName||o.name||"Mesh_"+items.length;
  if(!nameIndex.has(name)){nameIndex.set(name,names.length);names.push(name);}
  if(!n)missingNormals++;if(o.isSkinnedMesh)skinnedMeshes++;
  let m=o.matrixWorld.elements,a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],A=cross(b,c),B=cross(c,a),C=cross(a,b),det=dot(a,A);
  if(!Number.isFinite(det)||Math.abs(det)<1e-30)throw Error("FBX: вырожденная трансформация "+name);
  items.push({o,g,p,n,uv,index,count,group:nameIndex.get(name),m,A,B,C,sign:det<0?-1:1});
 });
 if(!total)throw Error("FBX: нет полигональных мешей");
 let data=new Float32Array(total*24),groups=new Int32Array(total),materials=new Int32Array(total),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],out=0,face=0;
 // World-space bounds before float32 quantization, preserving precision.
 const pos=(m,p,i)=>{let x=p.getX(i),y=p.getY(i),z=p.getZ(i);return [0,1,2].map(j=>m[j]*x+m[j+4]*y+m[j+8]*z+m[j+12]);};
 for(let {m,p,index,count} of items)for(let k=0;k<count;k++){let i=index?index.getX(k):k;if(!Number.isInteger(i)||i<0||i>=p.count)throw Error("FBX: неверный индекс вершины");let v=pos(m,p,i);for(let j=0;j<3;j++){if(!Number.isFinite(v[j]))throw Error("FBX: некорректная геометрия");lo[j]=Math.min(lo[j],v[j]);hi[j]=Math.max(hi[j],v[j]);}}
 let center=lo.map((v,j)=>(v+hi[j])/2),scale=2/(Math.max(...hi.map((v,j)=>v-lo[j]))||1);
 for(let {o,g,p,n,uv,index,count,group,m,A,B,C,sign} of items){
  let normal=(i,fallback)=>{if(!n)return fallback;let x=n.getX(i),y=n.getY(i),z=n.getZ(i);return unit(A.map((v,j)=>sign*(v*x+B[j]*y+C[j]*z)),fallback);};
  let ranges=(g.groups||[]).slice().sort((a,b)=>a.start-b.start),range=0,slots=Array.isArray(o.material)?o.material:[o.material];
  for(let k=0;k<count;k+=3){
   let ids=[k,k+1,k+2].map(i=>index?index.getX(i):i);if(sign<0)[ids[1],ids[2]]=[ids[2],ids[1]];
   let ps=ids.map(i=>pos(m,p,i).map((v,j)=>(v-center[j])*scale)),fn=unit(cross(sub(ps[1],ps[0]),sub(ps[2],ps[0])),[0,1,0]);
   while(range<ranges.length&&k>=ranges[range].start+ranges[range].count)range++;
   let r=ranges[range],slot=r&&k>=r.start?r.materialIndex||0:0,mat=slots[slot],key=mat||names[group]+":"+slot;
   if(!materialIndex.has(key)){materialIndex.set(key,materialNames.length);materialNames.push(mat?.name||"Material_"+slot);}
   groups[face]=group;materials[face++]=materialIndex.get(key);
   for(let j=0;j<3;j++){let N=normal(ids[j],fn),u=uv.getX(ids[j]),w=uv.getY(ids[j]);if(![...N,u,w].every(Number.isFinite))throw Error("FBX: некорректные нормали или UV");data.set([...ps[j],...N,u,w],out);out+=8;}
  }
 }
 data.groups=groups;data.groupNames=names;data.materialIds=materials;data.materialNames=materialNames;data.importInfo={format:"fbx",missingNormals,skinnedMeshes};return data;
}
