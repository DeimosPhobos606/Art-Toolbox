const clamp=(x,a,b)=>Math.max(a,Math.min(Math.max(a,b),x));
function read(key){try{return JSON.parse(localStorage.getItem("art-toolbox.layout."+key)||"{}")}catch{return {}}}
function write(key,v){try{localStorage.setItem("art-toolbox.layout."+key,JSON.stringify(v))}catch{}}
export function splitLayout(root,key,{columns=[],rows=[],heightPanel=null}={}){
 if(!root)return;let state=read(key),defaults=Object.fromEntries(columns.map(c=>[c.id,c.size]));for(let r of rows)defaults[r.id]=r.size;if(heightPanel)defaults[heightPanel.id]=heightPanel.size;
 let handles=[],mobile=()=>innerWidth<=850;
 function apply(){if(columns.length){if(mobile())root.style.removeProperty("grid-template-columns");else{let width=root.clientWidth||innerWidth,remaining=width-180-5*columns.length,vals={};for(let c of columns){let v=state[c.id]??c.size;vals[c.id]=v===0?0:clamp(v,Math.min(c.min,remaining),Math.min(c.max,remaining));remaining-=vals[c.id];}root.style.gridTemplateColumns=columns.length===2?vals[columns[0].id]+"px 5px minmax(0,1fr) 5px "+vals[columns[1].id]+"px":columns[0].side==="right"?"minmax(0,1fr) 5px "+vals[columns[0].id]+"px":vals[columns[0].id]+"px 5px minmax(0,1fr)";for(let c of columns)c.panel.style.visibility=vals[c.id]===0?"hidden":"";}}
 if(mobile())for(let c of columns)c.panel.style.visibility="";
 if(heightPanel){let h=state[heightPanel.id]??heightPanel.size;heightPanel.panel.style.height=clamp(h,150,Math.max(150,innerHeight-120))+"px";heightPanel.panel.style.flex="none";}
 }
 function handle(cfg,axis){let h=document.createElement("div");h.className="at-split";h.dataset.axis=axis;h.tabIndex=0;h.setAttribute("role","separator");h.setAttribute("aria-orientation",axis==="x"?"vertical":"horizontal");h.dataset.tooltip="Перетащить границу · двойной клик — свернуть / развернуть";cfg.side==="right"?cfg.panel.before(h):cfg.panel.after(h);let drag=null;
 const value=()=>state[cfg.id]??cfg.size,delta=(d)=>{let sign=cfg.side==="right"?-1:1;state[cfg.id]=clamp((value()||cfg.size)+d*sign,cfg.min,cfg.max);apply();write(key,state);};
 h.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag=axis==="x"?e.clientX:e.clientY;h.setPointerCapture(e.pointerId);h.classList.add("dragging");};
 h.onpointermove=e=>{if(drag===null)return;let x=axis==="x"?e.clientX:e.clientY;delta(x-drag);drag=x;};h.onpointerup=h.onpointercancel=h.onlostpointercapture=()=>{drag=null;h.classList.remove("dragging");};
 h.ondblclick=()=>{state[cfg.id]=axis==="x"?(value()===0?cfg.size:0):cfg.size;apply();write(key,state);};
 h.onkeydown=e=>{let d=e.key==="ArrowLeft"||e.key==="ArrowUp"?-16:e.key==="ArrowRight"||e.key==="ArrowDown"?16:0;if(d){e.preventDefault();delta(d);}};handles.push(h);
 }
 for(let c of columns)handle(c,"x");if(heightPanel)handle(heightPanel,"y");window.addEventListener("resize",apply);apply();
 let reset=()=>{state={...defaults};apply();write(key,state);};return {reset};
}
export function contextMenu(e,items){e.preventDefault();document.querySelector(".at-context-menu")?.remove();let menu=document.createElement("div");menu.className="at-context-menu";for(let [label,fn] of items){let b=document.createElement("button");b.textContent=label;b.onclick=()=>{menu.remove();fn();};menu.append(b);}document.body.append(menu);let r=menu.getBoundingClientRect();menu.style.left=Math.max(0,Math.min(e.clientX,innerWidth-r.width))+"px";menu.style.top=Math.max(0,Math.min(e.clientY,innerHeight-r.height))+"px";const close=()=>menu.remove();setTimeout(()=>document.addEventListener("pointerdown",close,{once:true}),0);}
