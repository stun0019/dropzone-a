import * as THREE from 'three';

// Shared, deterministic textures: generated once, without external downloads.
const textures = new Map();
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
