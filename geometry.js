export const TAU = Math.PI * 2;
export const SHAPES = ['knot', 'bloom', 'orbit'];
export const PALETTES = ['violet', 'gold', 'pearl', 'ocean'];
export const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize = a => { const d = Math.hypot(...a) || 1; return a.map(v => v/d); };

function knotPath(t) {
  return [(1.05 + .33*Math.cos(3*t))*Math.cos(2*t), (1.05 + .33*Math.cos(3*t))*Math.sin(2*t), .46*Math.sin(3*t)];
}

export function surface(shape, u, v) {
  if (shape === 'knot') {
    const p = knotPath(u);
    const tangent = normalize(sub(knotPath(u+.001), knotPath(u-.001)));
    const normal = normalize(cross(tangent, [0, 0, 1]));
    const binormal = normalize(cross(tangent, normal));
    const r = .31 * (1 + .035*Math.cos(14*v + 6*u));
    return p.map((x, i) => x + r*(Math.cos(v)*normal[i] + Math.sin(v)*binormal[i]));
  }
  if (shape === 'orbit') {
    const tube = .43 * (1 + .10*Math.cos(6*v + 4*u));
    return [(1+ tube*Math.cos(v))*Math.cos(u), (1+tube*Math.cos(v))*Math.sin(u), tube*Math.sin(v)];
  }
  // A closed, softly folded sphere. The small polar offset avoids degenerate normals.
  const lat = .0001 + (Math.PI-.0002)*v/TAU;
  const r = 1.16 + .22*Math.cos(6*u + 3*lat)*Math.pow(Math.sin(lat), 2) + .10*Math.sin(7*lat);
  return [r*Math.sin(lat)*Math.cos(u), r*Math.cos(lat), r*Math.sin(lat)*Math.sin(u)];
}

export function createGeometry(shape, rows = 192, cols = 48) {
  if (!SHAPES.includes(shape)) throw new Error('Unknown sculpture');
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 8 || cols < 8 || (rows+1)*(cols+1)>65535) throw new Error('Invalid mesh resolution');
  const vertices = [], normals = [], triangles = [], lines = [];
  for (let i=0; i<=rows; i++) for (let j=0; j<=cols; j++) {
    const u = TAU*i/rows, v = TAU*j/cols;
    const p = surface(shape, u, v);
    const du = sub(surface(shape, u+.0001, v), surface(shape, u-.0001, v));
    const dv = sub(surface(shape, u, v+.0001), surface(shape, u, v-.0001));
    const n = normalize(cross(du,dv));
    vertices.push(...p); normals.push(...n);
    if (i<rows && j<cols) {
      const a=i*(cols+1)+j, b=a+cols+1;
      triangles.push(a,b,a+1,b,b+1,a+1);
      if (i%3 === 0) lines.push(a,a+1);
      if (j%3 === 0) lines.push(a,b);
    }
  }
  return { vertices:new Float32Array(vertices), normals:new Float32Array(normals), triangles:new Uint16Array(triangles), lines:new Uint16Array(lines) };
}

export function rotationMatrix(x,y,z) {
  const cx=Math.cos(x), sx=Math.sin(x), cy=Math.cos(y), sy=Math.sin(y), cz=Math.cos(z), sz=Math.sin(z);
  return new Float32Array([cy*cz,cy*sz,-sy,0, sx*sy*cz-cx*sz,sx*sy*sz+cx*cz,sx*cy,0, cx*sy*cz+sx*sz,cx*sy*sz-sx*cz,cx*cy,0, 0,0,0,1]);
}
export function projectionMatrix(aspect, distance) {
  const f=1/Math.tan(Math.PI/8), near=.1, far=30;
  // Projection multiplied by a camera translation along the Z axis.
  const a=(far+near)/(near-far), b=2*far*near/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,a,-1,0,0,b-a*distance,distance]);
}
export function parseView(hash) {
  const p=new URLSearchParams(hash.replace(/^#/, ''));
  return {shape:SHAPES.includes(p.get('shape'))?p.get('shape'):'knot', palette:PALETTES.includes(p.get('finish'))?p.get('finish'):'violet'};
}
