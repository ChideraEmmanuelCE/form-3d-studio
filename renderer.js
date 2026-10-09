import {createGeometry, rotationMatrix, projectionMatrix, clamp} from './geometry.js';

const vertexSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uProjection;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vPosition = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uProjection * world;
}`;
const fragmentSource = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vPosition;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uDistance;
uniform float uWire;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 view = normalize(vec3(0.0,0.0,uDistance)-vPosition);
  vec3 light = normalize(vec3(-3.0,4.5,5.0));
  vec3 rimLight = normalize(vec3(4.0,-1.0,2.0));
  float facing = max(dot(n,view),0.0);
  float fresnel = pow(1.0-facing,2.2);
  float diffuse = max(dot(n,light),0.0);
  float secondary = max(dot(n,rimLight),0.0);
  float iridescence = .5+.5*sin(n.y*3.8+n.x*2.8+facing*3.0);
  vec3 base = mix(uColorA,uColorB,iridescence);
  vec3 color = base*(.15+diffuse*.70+secondary*.23);
  vec3 halfVector = normalize(light+view);
  float spec = pow(max(dot(n,halfVector),0.0),72.0);
  float broadSpec = pow(max(dot(n,halfVector),0.0),15.0);
  float sideSpec = pow(max(dot(n,normalize(rimLight+view)),0.0),52.0);
  color += vec3(.95,.91,1.0)*(spec*.94+broadSpec*.23);
  color += uColorB*sideSpec*.75;
  color += mix(uColorB,vec3(.8,.82,1.0),.25)*fresnel*.72;
  color = mix(color, mix(uColorA,uColorB,.5)*.7+vec3(.25),uWire);
  color = pow(color,vec3(.83));
  gl_FragColor = vec4(color,1.0);
}`;

export const FINISHES = {
  violet:{name:'Ultraviolet', a:[.38,.12,.91], b:[.90,.55,.43]},
  gold:{name:'Liquid gold', a:[.67,.27,.055], b:[1,.83,.44]},
  pearl:{name:'Porcelain', a:[.54,.61,.67], b:[.94,.94,.85]},
  ocean:{name:'Deep ocean', a:[.02,.35,.52], b:[.23,.91,.72]}
};

export class SculptureRenderer {
  constructor(canvas, {shape='knot',palette='violet',onActivity=()=>{}}={}) {
    this.canvas=canvas; this.onActivity=onActivity;
    this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
    this.software=!this.gl;
    if(this.software){this.context2d=canvas.getContext('2d');if(!this.context2d)throw new Error('Canvas rendering is unavailable');}
    this.shape=shape; this.palette=palette; this.x=-.24; this.y=-.28; this.z=.25;
    this.distance=5.2; this.wireframe=false; this.running=true; this.visible=true; this.dragging=false;
    this.last=0; this.frame=0; this.pointers=new Map(); this.bindings=[];
    if(!this.software)this.init(); this.setShape(shape); this.resize();
    this.observer=new ResizeObserver(()=>this.resize()); this.observer.observe(canvas);
    this.bindInput(); this.draw(); this.tick=this.tick.bind(this); this.frame=requestAnimationFrame(this.tick);
  }
  init() {
    const gl=this.gl;
    const compile=(type,source)=>{
      const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {const message=gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message);}
      return shader;
    };
    const vs=compile(gl.VERTEX_SHADER,vertexSource), fs=compile(gl.FRAGMENT_SHADER,fragmentSource);
    this.program=gl.createProgram(); gl.attachShader(this.program,vs); gl.attachShader(this.program,fs); gl.linkProgram(this.program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    this.locations={};
    ['uModel','uProjection','uColorA','uColorB','uDistance','uWire'].forEach(name=>this.locations[name]=gl.getUniformLocation(this.program,name));
    this.position=gl.getAttribLocation(this.program,'aPosition'); this.normal=gl.getAttribLocation(this.program,'aNormal');
    this.buffers={}; for(const key of ['vertices','normals','triangles','lines']) this.buffers[key]=gl.createBuffer();
    gl.enable(gl.DEPTH_TEST); gl.clearColor(0,0,0,0);
  }
  setShape(shape) {
    const gl=this.gl; this.shape=shape;
    const small=matchMedia('(max-width: 700px)').matches;
    const mesh=createGeometry(shape,this.software?80:(small?144:192),this.software?24:48);
    if(this.software){this.mesh=mesh;this.count=mesh.triangles.length;this.draw();return;}
    for(const key of ['vertices','normals','triangles','lines']) {
      const target=key==='vertices'||key==='normals'?gl.ARRAY_BUFFER:gl.ELEMENT_ARRAY_BUFFER;
      gl.bindBuffer(target,this.buffers[key]); gl.bufferData(target,mesh[key],gl.STATIC_DRAW);
    }
    this.count=mesh.triangles.length; this.lineCount=mesh.lines.length; this.draw();
  }
  setPalette(palette) {this.palette=palette; this.draw();}
  resize() {
    const rect=this.canvas.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,this.software?1.25:1.75);
    const width=Math.max(1,Math.round(rect.width*dpr)), height=Math.max(1,Math.round(rect.height*dpr));
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    this.draw();
  }
  draw() {
    if(this.software){this.drawSoftware();return;}
    const gl=this.gl;
    if(!this.count||gl.isContextLost())return;
    gl.viewport(0,0,this.canvas.width,this.canvas.height); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
    for(const [key,attribute] of [['vertices',this.position],['normals',this.normal]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[key]);gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,3,gl.FLOAT,false,0,0);
    }
    const colors=FINISHES[this.palette];
    gl.uniformMatrix4fv(this.locations.uModel,false,rotationMatrix(this.x,this.y,this.z));
    const aspect=this.canvas.width/this.canvas.height;
    gl.uniformMatrix4fv(this.locations.uProjection,false,projectionMatrix(aspect,this.distance*Math.max(1,1/aspect)));
    gl.uniform3fv(this.locations.uColorA,colors.a);gl.uniform3fv(this.locations.uColorB,colors.b);
    gl.uniform1f(this.locations.uDistance,this.distance);gl.uniform1f(this.locations.uWire,this.wireframe?1:0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.buffers[this.wireframe?'lines':'triangles']);
    gl.drawElements(this.wireframe?gl.LINES:gl.TRIANGLES,this.wireframe?this.lineCount:this.count,gl.UNSIGNED_SHORT,0);
  }
  drawSoftware() {
    if(!this.mesh)return;
    const ctx=this.context2d,w=this.canvas.width,h=this.canvas.height,m=rotationMatrix(this.x,this.y,this.z);
    const distance=this.distance*Math.max(1,h/w),scale=h*.5/Math.tan(Math.PI/8),mesh=this.mesh;
    ctx.clearRect(0,0,w,h);
    const transformed=[],normals=[],screen=[];
    const rotate=(a,i)=>[m[0]*a[i]+m[4]*a[i+1]+m[8]*a[i+2],m[1]*a[i]+m[5]*a[i+1]+m[9]*a[i+2],m[2]*a[i]+m[6]*a[i+1]+m[10]*a[i+2]];
    for(let i=0;i<mesh.vertices.length;i+=3){
      const p=rotate(mesh.vertices,i);transformed.push(p);normals.push(rotate(mesh.normals,i));
      const perspective=scale/(distance-p[2]);screen.push([w/2+p[0]*perspective,h/2-p[1]*perspective]);
    }
    const colors=FINISHES[this.palette];
    if(this.wireframe){
      ctx.strokeStyle=`rgb(${colors.b.map(v=>Math.round(v*220+25)).join(',')})`;ctx.lineWidth=.7;
      ctx.beginPath();for(let i=0;i<mesh.lines.length;i+=2){const a=screen[mesh.lines[i]],b=screen[mesh.lines[i+1]];ctx.moveTo(...a);ctx.lineTo(...b);}ctx.stroke();return;
    }
    const faces=[];
    for(let i=0;i<mesh.triangles.length;i+=6){
      const ids=[mesh.triangles[i],mesh.triangles[i+1],mesh.triangles[i+4],mesh.triangles[i+2]];
      faces.push({ids,z:ids.reduce((sum,id)=>sum+transformed[id][2],0)/4});
    }
    faces.sort((a,b)=>a.z-b.z);
    const unit=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d);}, dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const light=unit([-3,4.5,5]),rim=unit([4,-1,2]);
    for(const face of faces){
      const p=[0,0,0],n=[0,0,0];for(const id of face.ids)for(let j=0;j<3;j++){p[j]+=transformed[id][j]/4;n[j]+=normals[id][j]/4;}
      let normal=unit(n);const view=unit([-p[0],-p[1],distance-p[2]]);
      if(dot(normal,view)<0)normal=normal.map(v=>-v);
      const facing=Math.max(0,dot(normal,view)),fresnel=Math.pow(1-facing,2.2),diffuse=Math.max(0,dot(normal,light)),secondary=Math.max(0,dot(normal,rim));
      const mix=.5+.5*Math.sin(normal[1]*3.8+normal[0]*2.8+facing*3);
      const half=unit(light.map((v,i)=>v+view[i])),sideHalf=unit(rim.map((v,i)=>v+view[i]));
      const spec=Math.pow(Math.max(0,dot(normal,half)),72)*.94+Math.pow(Math.max(0,dot(normal,half)),15)*.23;
      const sideSpec=Math.pow(Math.max(0,dot(normal,sideHalf)),52)*.75;
      const color=colors.a.map((a,i)=>{
        const b=colors.b[i],base=a*(1-mix)+b*mix;
        const value=base*(.15+diffuse*.70+secondary*.23)+[.95,.91,1][i]*spec+b*sideSpec+(b*.75+[.8,.82,1][i]*.25)*fresnel*.72;
        return Math.round(clamp(Math.pow(Math.max(0,value),.83)*255,0,255));
      });
      ctx.fillStyle=`rgb(${color.join(',')})`;ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.7;
      ctx.beginPath();face.ids.forEach((id,index)=>index?ctx.lineTo(...screen[id]):ctx.moveTo(...screen[id]));ctx.closePath();ctx.fill();ctx.stroke();
    }
  }
  tick(now) {
    if(this.software&&this.last&&now-this.last<50){this.frame=requestAnimationFrame(this.tick);return;}
    const delta=Math.min((now-(this.last||now))/1000,.04);this.last=now;
    if(this.running&&this.visible&&!document.hidden&&!this.dragging) {this.y+=delta*.17; this.z+=delta*.024;this.draw();}
    this.frame=requestAnimationFrame(this.tick);
  }
  zoom(amount) {this.distance=clamp(this.distance+amount,3.9,7.5);this.draw();}
  reset() {this.x=-.24;this.y=-.28;this.z=.25;this.distance=5.2;this.draw();}
  bindInput() {
    const el=this.canvas;
    const listen=(target,event,fn,options)=>{target.addEventListener(event,fn,options);this.bindings.push(()=>target.removeEventListener(event,fn,options));};
    listen(el,'pointerdown',e=>{el.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.dragging=true;el.classList.add('grabbing');});
    listen(el,'pointermove',e=>{
      const p=this.pointers.get(e.pointerId);if(!p)return;
      if(this.pointers.size===2){
        const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)[1];
        const before=Math.hypot(p.x-other.x,p.y-other.y), after=Math.hypot(e.clientX-other.x,e.clientY-other.y);
        this.zoom((before-after)*.012);
      }else {this.y+=(e.clientX-p.x)*.008;this.x+=(e.clientY-p.y)*.008;}
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.draw();this.onActivity();
    });
    const release=e=>{this.pointers.delete(e.pointerId);this.dragging=this.pointers.size>0;if(!this.dragging)el.classList.remove('grabbing');};
    listen(el,'pointerup',release);listen(el,'pointercancel',release);listen(el,'lostpointercapture',release);
    listen(el,'wheel',e=>{if(document.activeElement!==el)return;e.preventDefault();this.zoom(e.deltaY*.003);},{passive:false});
    listen(el,'keydown',e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;
      e.preventDefault(); if(e.key==='ArrowLeft')this.y-=.12;if(e.key==='ArrowRight')this.y+=.12;
      if(e.key==='ArrowUp')this.x-=.12;if(e.key==='ArrowDown')this.x+=.12;
      if(e.key==='+'||e.key==='=')this.zoom(-.2);if(e.key==='-')this.zoom(.2);if(e.key==='0')this.reset();this.draw();
    });
    this.intersection=new IntersectionObserver(([entry])=>{this.visible=entry.isIntersecting;});this.intersection.observe(el);
  }
  async snapshot() {
    this.draw();
    const result=document.createElement('canvas');result.width=1600;result.height=1200;
    const ctx=result.getContext('2d');ctx.fillStyle='#101110';ctx.fillRect(0,0,1600,1200);
    const ratio=Math.min(1440/this.canvas.width,980/this.canvas.height);
    const w=this.canvas.width*ratio,h=this.canvas.height*ratio;
    ctx.drawImage(this.canvas,(1600-w)/2,(1200-h)/2-20,w,h);
    ctx.fillStyle='#e9e9df';ctx.font='bold 34px sans-serif';ctx.fillText('FORM.',80,82);
    ctx.font='18px sans-serif';ctx.fillStyle='#a7aa9e';ctx.fillText(`${this.shape.toUpperCase()} / ${FINISHES[this.palette].name.toUpperCase()}`,80,1125);
    ctx.textAlign='right';ctx.fillText('AN EXPERIMENT IN THREE DIMENSIONS',1520,1125);
    return new Promise((resolve,reject)=>result.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not export image')),'image/png'));
  }
  destroy() {cancelAnimationFrame(this.frame);this.observer.disconnect();this.intersection.disconnect();this.bindings.forEach(fn=>fn());if(this.gl){Object.values(this.buffers).forEach(b=>this.gl.deleteBuffer(b));this.gl.deleteProgram(this.program);}}
}
