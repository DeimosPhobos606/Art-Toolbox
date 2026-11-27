import {Workspace,empty} from "./core.js?v=043";
export const SCRATCH="__scratch__";
export class MemoryStore{
 constructor(){this.data=new Map();}
 async read(store,key){let v=this.data.get(store+":"+key);return v===undefined?undefined:structuredClone(v);}
 async commit(ops){let m=new Map(this.data);for(let o of ops){let k=o.store+":"+o.key;if(o.remove)m.delete(k);else m.set(k,structuredClone(o.value));}this.data=m;}
}
export function demoOBJ(){let p=[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1]],faces=[[1,2,3,4],[6,5,8,7],[5,1,4,8],[2,6,7,3],[4,3,7,8],[5,6,2,1]],lines=["o Demo_cube",...p.map(v=>"v "+v.join(" "))];for(let i=0;i<6;i++){let x=(i%3)/3+.025,y=Math.floor(i/3)/2+.035,w=1/3-.05,h=.43;for(let u of [[x,y],[x+w,y],[x+w,y+h],[x,y+h]])lines.push("vt "+u.join(" "));}for(let i=0;i<6;i++)lines.push("f "+faces[i].map((v,j)=>v+"/"+(i*4+j+1)).join(" "));return new Blob([lines.join("\n")],{type:"text/plain"});}
async function png(w,h,fn){let c=document.createElement("canvas");c.width=w;c.height=h;let ctx=c.getContext("2d"),im=ctx.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)im.data.set(fn(x/(w-1||1),y/(h-1||1)),(y*w+x)*4);ctx.putImageData(im,0,0);return new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(Error("Demo image unavailable")),"image/png"));}
export async function createScratch(){let s=empty();s.projects=[{id:SCRATCH,name:"Demo"}];s.assets=[{id:SCRATCH,projectId:SCRATCH,name:"Свободный режим"}];s.active=SCRATCH;let w=new Workspace(new MemoryStore(),s);
 await w.put(SCRATCH,"mesh",demoOBJ(),{kind:"mesh",name:"Demo_cube.obj",meta:{demo:true}});
 const grey=g=>[g,g,g,255],maps=[["bake:light","Demo_Light.png",(u,v)=>grey(50+180*(.5+.5*Math.sin(u*18)*Math.cos(v*12)))],["bake:ao","Demo_AO.png",(u,v)=>grey(255-100*Math.pow(Math.abs(Math.sin(u*15)*Math.sin(v*12)),6))],["bake:curv","Demo_Curvature.png",(u,v)=>grey(128+70*Math.sin(u*30)*Math.cos(v*24))]];
 for(let [slot,name,fn] of maps)await w.put(SCRATCH,slot,await png(128,128,fn),{kind:"texture",name,meta:{demo:true}});
 await w.put(SCRATCH,"gradient:palette",await png(256,1,u=>[35+185*u,43+180*u,58+155*u,255]),{kind:"gradient",name:"Demo_Gradient.png",meta:{demo:true}});
 return w;
}