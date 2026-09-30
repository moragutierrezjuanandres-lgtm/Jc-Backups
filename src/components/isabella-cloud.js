import * as THREE from 'three';

export const emotionLabels = { idle: 'En reposo', guiding: 'Te acompaño a configurar el respaldo', working: 'Protegiendo tus archivos', alert: 'Necesito tu atención', success: 'Copia verificada' };
const moods = {
  idle: { color: '#b3b6be', activity: .6, spread: 1 },
  guiding: { color: '#b4c8d8', activity: .9, spread: 1.02 },
  working: { color: '#c1cbd5', activity: 1.6, spread: .97 },
  alert: { color: '#c39798', activity: 1.15, spread: 1.04 },
  success: { color: '#b7cec3', activity: .75, spread: 1.06 },
};

// Shared by the portal and the offline bundle embedded in the Windows agent.
export class IsabellaCloud {
  constructor(container, state = 'idle') {
    this.container = container;
    this.state = state;
    this.disposed = false;
    this.frame = 0;
    this.elapsed = 0;
    this.lastFrame = 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.pointer = new THREE.Vector2();
    this.targetColor = new THREE.Color();
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, .1, 20);
    this.camera.position.z = 6;
    this.geometry = new THREE.BufferGeometry();
    const count = 3600;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    // A wide silhouette of intersecting lobes with a quiet dust fringe, never a ball.
    const lobes = [[-1.12, -.12, .55], [-.62, .26, .66], [.02, .48, .75], [.76, .12, .72], [1.24, -.18, .46], [.3, -.37, .64], [-.58, -.38, .58]];
    for (let i = 0; i < count; i++) {
      const [x, y, radius] = lobes[i % lobes.length];
      const angle = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const ring = Math.sqrt(1 - z * z);
      const r = Math.cbrt(Math.random()) * radius;
      positions.set([x + r * ring * Math.cos(angle), y + r * ring * Math.sin(angle), r * z * .65], i * 3);
      sizes[i] = 8 + Math.random() * 24;
      seeds[i] = Math.random() * 6.28;
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: { time: { value: 0 }, activity: { value: .6 }, color: { value: new THREE.Color(moods.idle.color) }, pixelRatio: { value: this.renderer.getPixelRatio() } },
      vertexShader: `uniform float time; uniform float activity; uniform float pixelRatio;
        attribute float size; attribute float seed; varying float shade;
        void main() { vec3 p = position;
          p.x += sin(time*.55 + p.y*3. + seed*.2)*.055*activity;
          p.y += cos(time*.48 + p.x*2.6 + seed*.2)*.065*activity;
          p.z += sin(time*.35 + seed)*.05*activity;
          shade = .72 + .28*sin(seed + p.y);
          vec4 mv = modelViewMatrix*vec4(p,1.);
          gl_PointSize = size * pixelRatio / -mv.z;
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `uniform vec3 color; varying float shade;
        void main() { float d=length(gl_PointCoord-vec2(.5)); if(d>.5) discard;
          float alpha=(1.-smoothstep(.05,.5,d))*.64;
          gl_FragColor=vec4(color*shade,alpha);
        }`,
    });
    this.cloud = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.cloud);
    this.move = event => {
      if (this.reduced.matches) return;
      const rect = container.getBoundingClientRect();
      this.pointer.set((event.clientX - rect.left) / Math.max(1, rect.width) - .5, (event.clientY - rect.top) / Math.max(1, rect.height) - .5);
    };
    this.leave = () => this.pointer.set(0, 0);
    this.visibility = () => { cancelAnimationFrame(this.frame); this.frame = 0; this.lastFrame = 0; if (!document.hidden) this.schedule(); };
    this.motion = () => { this.leave(); this.schedule(); };
    this.contextLost = event => { event.preventDefault(); this.container.dataset.unavailable = 'true'; cancelAnimationFrame(this.frame); this.frame = 0; };
    this.contextRestored = () => { delete this.container.dataset.unavailable; this.schedule(); };
    this.resize = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.position.z = this.camera.aspect < 1.3 ? 6.5 : 5.8;
      this.camera.updateProjectionMatrix();
      this.schedule();
    });
    this.resize.observe(container);
    container.addEventListener('pointermove', this.move);
    container.addEventListener('pointerleave', this.leave);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored);
    document.addEventListener('visibilitychange', this.visibility);
    this.reduced.addEventListener('change', this.motion);
    this.schedule();
  }
  setEmotion(state) { this.state = moods[state] ? state : 'idle'; this.schedule(); }
  schedule() { if (!this.disposed && !document.hidden && !this.frame) this.frame = requestAnimationFrame(time => this.render(time)); }
  render(time) {
    this.frame = 0;
    if (this.disposed || document.hidden) return;
    // 30 fps, stopped altogether for hidden tabs or reduced-motion preferences.
    if (!this.reduced.matches && this.lastFrame && time - this.lastFrame < 32) { this.schedule(); return; }
    const delta = this.lastFrame ? Math.min((time - this.lastFrame) / 1000, .1) : 0;
    this.lastFrame = time;
    const mood = moods[this.state] || moods.idle;
    const blend = this.reduced.matches ? 1 : .1;
    if (!this.reduced.matches) this.elapsed += delta;
    this.material.uniforms.time.value = this.elapsed;
    this.material.uniforms.activity.value += (mood.activity - this.material.uniforms.activity.value) * blend;
    this.material.uniforms.color.value.lerp(this.targetColor.set(mood.color), blend);
    const scale = this.reduced.matches ? 1 : mood.spread + Math.sin(this.elapsed * .65) * .015;
    this.cloud.scale.lerp(new THREE.Vector3(scale, scale, 1), blend);
    this.cloud.rotation.y += (this.pointer.x * .28 - this.cloud.rotation.y) * blend;
    this.cloud.rotation.x += (-this.pointer.y * .18 - this.cloud.rotation.x) * blend;
    this.renderer.render(this.scene, this.camera);
    if (!this.reduced.matches) this.schedule();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.container.removeEventListener('pointermove', this.move);
    this.container.removeEventListener('pointerleave', this.leave);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored);
    document.removeEventListener('visibilitychange', this.visibility);
    this.reduced.removeEventListener('change', this.motion);
    this.geometry.dispose(); this.material.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
