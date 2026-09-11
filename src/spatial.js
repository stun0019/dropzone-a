export class SpatialGrid {
  constructor(size = 8) { this.size=size; this.cells=new Map(); }
  rebuild(actors) {
    this.cells.clear();
    for (const actor of actors) {
      if (actor.dead) continue;
      const p=actor.mesh.position, key=`${Math.floor(p.x/this.size)},${Math.floor(p.z/this.size)}`;
      if (!this.cells.has(key)) this.cells.set(key,[]);
      this.cells.get(key).push(actor);
    }
  }
  *near(p, radius) {
    for (let x=Math.floor((p.x-radius)/this.size); x<=Math.floor((p.x+radius)/this.size); x++)
      for (let z=Math.floor((p.z-radius)/this.size); z<=Math.floor((p.z+radius)/this.size); z++)
        for (const actor of this.cells.get(`${x},${z}`) || []) yield actor;
  }
}
