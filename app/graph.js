// Stable node evaluator v1. Each node evaluates to RGBA bytes or a gradient LUT.
export const VERSION=1;
const clamp=(x,a=0,b=255)=>Math.max(a,Math.min(b,x));
export const ports={texture:[],gradient:[],color:[],gradientMap:["image","gradient"],levels:["image"],blend:["base","layer"],output:["image"]};
export function evaluate(graph,resources,size){if(graph.version!==1)throw Error("Unsupported material graph version");let byId=new Map(graph.nodes.map(n=>[n.id,n])),memo=new Map(),visiting=new Set(),N=size*size*4;const solid=(r,g,b)=>{let x=new Uint8ClampedArray(N);for(let i=0;i<N;i+=4){x[i]=r;x[i+1]=g;x[i+2]=b;x[i+3]=255;}return x;};
function get(id){if(memo.has(id))return memo.get(id);if(visiting.has(id))throw Error("Cycle in node graph");let n=byId.get(id);if(!n)throw Error("Missing input connection");visiting.add(id);let a,b,o,p=n.params||{},input=k=>get(n.inputs?.[k]);switch(n.type){
case "texture":case "gradient": {let r=resources.get(p.resource);if(!r)throw Error("Choose a resource for "+n.type);if(r.kind!==n.type)throw Error("Wrong resource type");o=r.data;break;}
case "color":{let h=p.color||"#808080";o=solid(parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16));break;}
case "gradientMap":a=input("image");b=input("gradient");if(a.length!==N||b.length!==1024)throw Error("Gradient Map input types");o=new Uint8ClampedArray(N);for(let i=0;i<N;i+=4){let g=clamp(Math.round(.2126*a[i]+.7152*a[i+1]+.0722*a[i+2]))*4;for(let j=0;j<3;j++)o[i+j]=b[g+j];o[i+3]=a[i+3];}break;
case "levels":a=input("image");if(a.length!==N)throw Error("Levels requires texture");o=new Uint8ClampedArray(a);let black=clamp(p.black??0,0,254),white=Math.max(black+1,clamp(p.white??255)),gamma=clamp(p.gamma??1,.1,5);for(let i=0;i<N;i+=4)for(let j=0;j<3;j++)o[i+j]=255*Math.pow(clamp((a[i+j]-black)/(white-black),0,1),1/gamma);break;
case "blend":a=input("base");b=input("layer");if(a.length!==N||b.length!==N)throw Error("Blend requires textures");o=new Uint8ClampedArray(a);let opacity=clamp(p.opacity??100,0,100)/100;for(let i=0;i<N;i+=4){let t=opacity*b[i+3]/255;for(let j=0;j<3;j++){let x=a[i+j]/255,y=b[i+j]/255,v=p.mode==="Multiply"?x*y:p.mode==="Overlay"?(x<.5?2*x*y:1-2*(1-x)*(1-y)):p.mode==="Screen"?1-(1-x)*(1-y):p.mode==="Add"?Math.min(1,x+y):p.mode==="Subtract"?Math.max(0,x-y):p.mode==="Color Dodge"?Math.min(1,x/Math.max(.001,1-y)):y;o[i+j]=255*(x*(1-t)+v*t);}}break;
case "output":o=input("image");if(o.length!==N)throw Error("Output requires a texture");break;
default:throw Error("Unknown node type");}
visiting.delete(id);memo.set(id,o);return o;}
return get(graph.output);}
