import * as THREE from 'three';

// Shared, deterministic textures: generated once, without external downloads.
const textures = new Map();
export function terrainTexture(desert = false) {
  const key = desert ? 'terrain-desert' : 'terrain-town';
  if (textures.has(key)) return textures.get(key);
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=desert?'#b99460':'#7d8c63'; ctx.fillRect(0,0,1024,1024);
  let seed=8317;
  const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const colors=desert?['#b79870','#c0a078','#a78960','#c4a16e']:['#85856a','#78836c','#6e7f58','#a19270'];
  for(let i=0;i<1800;i++) {
    const x=random()*1024,y=random()*1024;
    ctx.globalAlpha=.08+random()*.18;
    ctx.fillStyle=colors[(x>512?1:0)+(y>512?2:0)];
    ctx.beginPath(); ctx.ellipse(x,y,8+random()*50,4+random()*25,random()*6.28,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=.16; ctx.strokeStyle=desert?'#5f503c':'#414b36'; ctx.lineWidth=1;
  for(let i=0;i<1800;i++) {
    const x=random()*1024,y=random()*1024;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*6-3,y-3-random()*4);ctx.stroke();
  }
  ctx.globalAlpha=1;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  textures.set(key,texture);return texture;
}
export function surfaceTexture(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  let seed = 7341;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = kind === 'road' ? '#9b9c99' : '#c5bdab';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    const shade = Math.floor(70 + random() * 160);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.08 + random() * 0.2})`;
    const size = 1 + random() * 4;
    ctx.fillRect(random() * 256, random() * 256, size, size);
  }
  if (kind === 'road') {
    ctx.strokeStyle = '#656762';
    ctx.lineWidth = 1;
    for (let n = 0; n < 7; n++) {
      let x = random() * 256, y = random() * 256;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 0; i < 7; i++) { x += random() * 24 - 12; y += random() * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'road' ? 5 : 22, kind === 'road' ? 5 : 22);
  textures.set(kind, texture);
  return texture;
}

export function addRoadPaint(scene, world) {
  const material = new THREE.MeshStandardMaterial({color: 0xd6c69a, roughness: 1});
  const geometry = new THREE.PlaneGeometry(0.14, 2.4);
  const positions = [];
  for (let z = -world + 4; z < world; z += 5) {
    if (Math.abs(z) < 7) continue;
    positions.push([-.22, z], [.22, z]);
  }
  const stripes = new THREE.InstancedMesh(geometry, material, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach(([x,z], i) => {
    dummy.position.set(x, .028, z); dummy.rotation.x = -Math.PI / 2;
    dummy.updateMatrix(); stripes.setMatrixAt(i, dummy.matrix);
  });
  stripes.receiveShadow = true;
  scene.add(stripes);
}
