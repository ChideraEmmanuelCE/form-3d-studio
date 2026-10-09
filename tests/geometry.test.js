import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeometry, surface, SHAPES, TAU, rotationMatrix, projectionMatrix, parseView} from '../geometry.js';

for(const shape of SHAPES) {
  test(`${shape}: bounded, valid indexed mesh with unit normals`,()=>{
    const mesh=createGeometry(shape,144,48), count=mesh.vertices.length/3;
    assert.equal(mesh.triangles.length,144*48*6);
    assert.ok(count<65536);
    for(const array of Object.values(mesh))for(const n of array)assert.ok(Number.isFinite(n));
    for(const index of [...mesh.triangles,...mesh.lines])assert.ok(index>=0&&index<count);
    for(let i=0;i<mesh.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i,i+3))-1)<.0001);
    for(let i=0;i<mesh.vertices.length;i+=3)assert.ok(Math.hypot(...mesh.vertices.slice(i,i+3))<2);
  });
  test(`${shape}: longitude seam is closed`,()=>{
    for(let v=0;v<=TAU;v+=.1){const a=surface(shape,0,v),b=surface(shape,TAU,v);assert.ok(Math.hypot(...a.map((x,i)=>x-b[i]))<.0001);}
  });
}
test('rotation preserves vector length at arbitrary angles',()=>{
  for(const [x,y,z] of [[0,0,0],[.4,-.7,1.2],[9,7,-5]]){
    const m=rotationMatrix(x,y,z),v=[2,3,4];
    const result=[0,1,2].map(row=>m[row]*v[0]+m[row+4]*v[1]+m[row+8]*v[2]);
    assert.ok(Math.abs(Math.hypot(...result)-Math.hypot(...v))<.00001);
  }
});
test('camera projects the center into the visible depth range',()=>{
  const m=projectionMatrix(1.5,5.2);assert.ok(m[14]/m[15]>-1&&m[14]/m[15]<1);assert.ok(m.every(Number.isFinite));
});
test('shared links accept only known shapes and finishes',()=>{
  assert.deepEqual(parseView('#shape=bloom&finish=gold'),{shape:'bloom',palette:'gold'});
  assert.deepEqual(parseView('#shape=unknown&finish=invalid'),{shape:'knot',palette:'violet'});
  assert.deepEqual(parseView(''),{shape:'knot',palette:'violet'});
});
test('mesh resolution cannot overflow WebGL 16-bit indices',()=>{
  assert.throws(()=>createGeometry('knot',512,512));assert.throws(()=>createGeometry('knot',0,48));assert.throws(()=>createGeometry('invalid'));
});
