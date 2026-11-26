// Stable node evaluator v1. Each node evaluates to RGBA bytes or a gradient LUT.
export const VERSION=1;
const clamp=(x,a=0,b=255)=>Math.max(a,Math.min(b,x));
export const ports={texture:[],gradient:[],color:[],gradientMap:["image","gradient"],levels:["image"],blend:["base","layer"],invert:["image"],grayscale:["image"],threshold:["image"],convexity:["image"],concavity:["image"],hsl:["image"],output:["image","roughness","metallic","normal","emission"]};
export function evaluate(graph,resources,size,options={}){if(graph.version!==1)throw Error("Unsupported material graph version");let byId=new Map(graph.nodes.map(n=>[n.id,n])),memo=new Map(),visiting=new Set(),N=size*size*4;const solid=(r,g,b)=>{let x=new Uint8ClampedArray(N);for(let i=0;i<N;i+=4){x[i]=r;x[i+1]=g;x[i+2]=b;x[i+3]=255;}return x;};
function get(id){if(memo.has(id))return memo.get(id);if(visiting.has(id))throw Error("Cycle in node graph");let n=byId.get(id);if(!n)throw Error("Missing input connection");visiting.add(id);let a,b,o,p=n.params||{},input=k=>get(n.inputs?.[k]);switch(n.type){
case "texture":case "gradient": {let r=resources.get(p.resource);if(!r)throw Error("Choose a resource for "+n.type);if(r.kind!==n.type)throw Error("Wrong resource type");o=r.data;break;}
case "color":{let h=p.color||"#808080";o=solid(parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16));break;}
case "gradientMap":a=input("image");b=input("gradient");if(a.length!==N||b.length!==1024)throw Error("Gradient Map input types");o=new Uint8ClampedArray(N);for(let i=0;i<N;i+=4){let g=clamp(Math.round(.2126*a[i]+.7152*a[i+1]+.0722*a[i+2]))*4;for(let j=0;j<3;j++)o[i+j]=b[g+j];o[i+3]=a[i+3];}break;
case "levels":a=input("image");if(a.length!==N)throw Error("Levels requires texture");o=new Uint8ClampedArray(a);let black=clamp(p.black??0,0,254),white=Math.max(black+1,clamp(p.white??255)),gamma=clamp(p.gamma??1,.1,5);for(let i=0;i<N;i+=4)for(let j=0;j<3;j++)o[i+j]=255*Math.pow(clamp((a[i+j]-black)/(white-black),0,1),1/gamma);break;
case "blend":a=input("base");b=input("layer");if(a.length!==N||b.length!==N)throw Error("Blend requires textures");o=new Uint8ClampedArray(a);let opacity=clamp(p.opacity??100,0,100)/100;for(let i=0;i<N;i+=4){let t=opacity*b[i+3]/255;for(let j=0;j<3;j++){let x=a[i+j]/255,y=b[i+j]/255,v=p.mode==="Multiply"?x*y:p.mode==="Overlay"?(x<.5?2*x*y:1-2*(1-x)*(1-y)):p.mode==="Screen"?1-(1-x)*(1-y):p.mode==="Add"?Math.min(1,x+y):p.mode==="Subtract"?Math.max(0,x-y):p.mode==="Color Dodge"?Math.min(1,x/Math.max(.001,1-y)):y;o[i+j]=255*(x*(1-t)+v*t);}}break;
case "output":o=input(n.id===graph.output?(options.channel||"image"):"image");if(o.length!==N)throw Error("Output requires a texture");break;
case "invert":case "grayscale":case "threshold":case "convexity":case "concavity":case "hsl":{
 a=input("image");if(a.length!==N)throw Error("Image required");o=new Uint8ClampedArray(a);let cutoff=clamp(p.threshold??128);
 for(let i=0;i<N;i+=4){
 let g=.2126*a[i]+.7152*a[i+1]+.0722*a[i+2];
 if(n.type==="hsl"){let rgb=[a[i],a[i+1],a[i+2]].map(v=>v/255),max=Math.max(...rgb),min=Math.min(...rgb),d=max-min,L=(max+min)/2,H=0,S=d?d/(1-Math.abs(2*L-1)):0;if(d)H=max===rgb[0]?((rgb[1]-rgb[2])/d+6)%6:max===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4;H=((H+(p.hue??0)/60)%6+6)%6;S=clamp(S+(p.saturation??0)/100,0,1);L=clamp(L+(p.lightness??0)/100,0,1);let C=(1-Math.abs(2*L-1))*S,X=C*(1-Math.abs(H%2-1)),m=L-C/2,v=[[C,X,0],[X,C,0],[0,C,X],[0,X,C],[X,0,C],[C,0,X]][Math.floor(H)];for(let j=0;j<3;j++)o[i+j]=255*(v[j]+m);}
 else if(n.type==="invert")for(let j=0;j<3;j++)o[i+j]=255-a[i+j];
 else {let v=n.type==="grayscale"?g:n.type==="threshold"?(g>=cutoff?255:0):n.type==="convexity"?clamp((g-128)*255/127):clamp((128-g)*255/128);o[i]=o[i+1]=o[i+2]=v;}
 }break;}
default:throw Error("Unknown node type");}
visiting.delete(id);memo.set(id,o);return o;}
if(options.collect){let results=new Map(),errors=new Map();for(let n of graph.nodes){try{results.set(n.id,get(n.id));}catch(e){errors.set(n.id,e.message);visiting.clear();}}return {results,errors};}return get(options.nodeId||graph.output);}
export function canConnect(graph,source,dest,port){let a=graph.nodes.find(n=>n.id===source),b=graph.nodes.find(n=>n.id===dest);if(!a||!b||a===b||a.type==="output"||!ports[b.type]?.includes(port))return false;if((a.type==="gradient")!==(b.type==="gradientMap"&&port==="gradient"))return false;const seen=new Set();function depends(id){if(id===dest)return true;if(seen.has(id))return false;seen.add(id);let n=graph.nodes.find(n=>n.id===id);return Object.values(n?.inputs||{}).filter(Boolean).some(depends);}return !depends(source);}

