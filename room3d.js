/* 3-D general X-ray room for X Marks the Spot (three.js, procedural - no external models).
   window.SCG_ROOM3D(THREE, host) -> { setPose(), setSID(), setField(), expose(), view(), start(), stop(), snap() }
   World axes: +y up, the erect chest stand (wall bucky) against the back wall with its detector face at z = DZ,
   facing +z; the ceiling-suspended tube sits on the +z side at the chosen SID with a horizontal beam toward -z.
   The collimator's light-beam diaphragm is a projected-texture spotlight carrying the field and its cross-wires. */
window.SCG_ROOM3D = function(THREE, host){
  "use strict";
  var V3 = THREE.Vector3;

  "use strict";
  var V3 = THREE.Vector3;

  /* ---------------- renderer / scene ---------------- */
  var renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9dedb);
  scene.fog = new THREE.Fog(0xd9dedb, 8, 16);

  /* image-based lighting from a simple bright clinical room */
  (function(){
    var env = new THREE.Scene();
    var room = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), new THREE.MeshBasicMaterial({ color:0x8c918e, side:THREE.BackSide }));
    room.position.y = 2.5; env.add(room);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color:0x6f736f }));
    floor.rotation.x = -Math.PI/2; floor.position.y = 0.01; env.add(floor);
    var pm = new THREE.MeshBasicMaterial({ color:new THREE.Color(5, 5, 4.8) });
    [[-2,-1.2],[0,-1.2],[2,-1.2],[-2,1.4],[0,1.4],[2,1.4]].forEach(function(p){
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), pm);
      m.rotation.x = Math.PI/2; m.position.set(p[0], 4.95, p[1]); env.add(m);
    });
    var side = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), new THREE.MeshBasicMaterial({ color:new THREE.Color(1.6, 1.7, 1.75) }));
    side.position.set(0, 2.2, 5.9); side.rotation.y = Math.PI; env.add(side);
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();
  })();

  var camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);

  var hemi = new THREE.HemisphereLight(0xffffff, 0x8f938f, 0.35);
  scene.add(hemi);
  var key = new THREE.DirectionalLight(0xfffaf2, 2.9);
  key.position.set(-1.2, 5.0, 2.6);
  key.target.position.set(0.2, 0.8, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  var sc = key.shadow.camera; sc.left = -3.2; sc.right = 3.2; sc.top = 2.6; sc.bottom = -2.6; sc.near = 1; sc.far = 12;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.radius = 3.5;
  scene.add(key, key.target);
  var fill = new THREE.DirectionalLight(0xe8f0ff, 0.55);
  fill.position.set(3.5, 2.2, 3.5); scene.add(fill);

  /* ---------------- helpers ---------------- */
  function canvasTex(w, h, draw, repeat){
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if(repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  function noise(g, w, h, n, a, col){
    for(var i=0;i<n;i++){ g.fillStyle = col.replace("A", (Math.random()*a).toFixed(3)); g.fillRect(Math.random()*w, Math.random()*h, 1+Math.random()*1.5, 1+Math.random()*1.5); }
  }
  function rrShape(w, h, r){
    var s = new THREE.Shape(), x = -w/2, y = -h/2;
    s.moveTo(x+r, y); s.lineTo(x+w-r, y); s.quadraticCurveTo(x+w, y, x+w, y+r);
    s.lineTo(x+w, y+h-r); s.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    s.lineTo(x+r, y+h); s.quadraticCurveTo(x, y+h, x, y+h-r);
    s.lineTo(x, y+r); s.quadraticCurveTo(x, y, x+r, y);
    return s;
  }
  /* rounded box: w along x, h along y, d along z */
  function rbox(w, h, d, r, mat, seg){
    r = Math.min(r, w/2-1e-3, h/2-1e-3, d/2-1e-3);
    var g = new THREE.ExtrudeGeometry(rrShape(w-2*r, h-2*r, Math.max(0.0008, r*0.6)),
      { depth:Math.max(0.0005, d-2*r), bevelEnabled:true, bevelThickness:r, bevelSize:r, bevelSegments:seg||4, curveSegments:6 });
    g.center();
    var m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function limb(a, b, r, mat){
    var dir = new V3().subVectors(b, a), len = dir.length();
    var m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 20), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new V3(0,1,0), dir.normalize());
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function taper(a, b, r0, r1, mat){             // tapered limb segment with rounded ends
    var g = new THREE.Group(), dir = new V3().subVectors(b, a), len = dir.length();
    var cyl = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 28, 4), mat);
    cyl.position.copy(a).addScaledVector(dir, 0.5);
    cyl.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.clone().normalize());
    var ea = new THREE.Mesh(new THREE.SphereGeometry(r0, 24, 16), mat); ea.position.copy(a);
    var eb = new THREE.Mesh(new THREE.SphereGeometry(r1, 24, 16), mat); eb.position.copy(b);
    [cyl, ea, eb].forEach(function(m){ m.castShadow = m.receiveShadow = true; g.add(m); });
    return g;
  }
  function ellipsoid(rx, ry, rz, mat, seg){
    var m = new THREE.Mesh(new THREE.SphereGeometry(1, seg||40, (seg||40)*3/4|0), mat);
    m.scale.set(rx, ry, rz); m.castShadow = m.receiveShadow = true;
    return m;
  }
  function gridGeo(nu, nv, fn){
    var pos = [], uv = [], idx = [], i, j;
    for(i=0;i<=nu;i++) for(j=0;j<=nv;j++){ var p = fn(i/nu, j/nv); pos.push(p[0], p[1], p[2]); uv.push(i/nu, j/nv); }
    for(i=0;i<nu;i++) for(j=0;j<nv;j++){ var a = i*(nv+1)+j, b = a+nv+1; idx.push(a, b, a+1, b, b+1, a+1); }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function prof(pts, u){                   // smooth piecewise interpolation of [u, value] pairs
    if(u <= pts[0][0]) return pts[0][1];
    for(var i=1;i<pts.length;i++) if(u <= pts[i][0]){
      var t = (u-pts[i-1][0])/(pts[i][0]-pts[i-1][0]); t = t*t*(3-2*t);
      return pts[i-1][1] + (pts[i][1]-pts[i-1][1])*t;
    }
    return pts[pts.length-1][1];
  }

  function g2(x, y, sx, sy){ return Math.exp(-(x*x)/(sx*sx) - (y*y)/(sy*sy)); }
  function sstep(e0, e1, x){ var t = Math.max(0, Math.min(1, (x - e0)/(e1 - e0))); return t*t*(3 - 2*t); }
  /* sculpted head: displaced sphere. Canonical frame: +Y = crown, +Z = face, +X = patient's left. */
  function headShape(p){                          // p on the unit sphere -> displaced point
    var x = p.x, y = p.y, z = p.z, f = Math.max(0, z), d = 0;
    d += 0.055*f*g2(x, y - 0.3, 0.55, 0.1);                                    // brow ridge
    d -= 0.07*f*(g2(x - 0.32, y - 0.1, 0.15, 0.09) + g2(x + 0.32, y - 0.1, 0.15, 0.09));  // eye sockets
    d += 0.11*f*g2(x, y + 0.06, 0.065, 0.2);                                   // nasal bridge
    d += 0.13*f*g2(x, y + 0.27, 0.085, 0.07);                                  // nose tip
    d += 0.045*f*(g2(x - 0.11, y + 0.3, 0.06, 0.05) + g2(x + 0.11, y + 0.3, 0.06, 0.05)); // alae
    d += 0.035*f*(g2(x - 0.45, y + 0.1, 0.18, 0.14) + g2(x + 0.45, y + 0.1, 0.18, 0.14)); // cheekbones
    d += 0.03*f*g2(x, y + 0.47, 0.2, 0.045) - 0.02*f*g2(x, y + 0.53, 0.2, 0.018) + 0.022*f*g2(x, y + 0.58, 0.17, 0.04); // lips
    d += 0.06*f*g2(x, y + 0.82, 0.24, 0.1);                                    // chin
    d += 0.05*Math.max(0, -z)*g2(x, y - 0.1, 0.7, 0.5);                       // occiput
    var q = new V3(x, y, z).multiplyScalar(1 + d);
    if(y < -0.2){ var t = Math.min(1, (-y - 0.2)/0.8); q.x *= 1 - 0.2*t; q.z += 0.1*t*Math.max(0, z); }   // jaw taper
    if(y > 0.2 && z > 0) q.z *= 1 - 0.07*(y - 0.2);                            // sloping forehead
    return q;
  }
  function headGeo(){
    var g = new THREE.SphereGeometry(1, 128, 96), p = g.attributes.position, v = new V3(), col = [];
    var skin = new THREE.Color(0xcf9a7c), hairC = new THREE.Color(0x1e1610), browC = new THREE.Color(0x3a2a20),
        lipC = new THREE.Color(0xb46e62), c = new THREE.Color();
    for(var i=0;i<p.count;i++){
      v.fromBufferAttribute(p, i).normalize();
      var x = v.x, y = v.y, z = v.z, f = Math.max(0, z);
      var line = -0.55*y + 0.835*z;
      var w = sstep(0.24, 0.17, line);
      w *= 1 - sstep(-0.35, -0.6, y)*sstep(-0.2, 0.2, z);
      var q = headShape(v);
      var lift = 1 + 0.028*w;
      p.setXYZ(i, q.x*0.074*lift, q.y*0.108*lift, q.z*0.094*lift);
      c.copy(skin);
      c.lerp(lipC, 0.65*f*g2(x, y + 0.53, 0.2, 0.06));
      c.lerp(browC, 0.85*f*(g2(x - 0.3, y - 0.25, 0.17, 0.035) + g2(x + 0.3, y - 0.25, 0.17, 0.035)));
      c.lerp(browC, 0.6*f*(g2(x - 0.32, y - 0.07, 0.11, 0.012) + g2(x + 0.32, y - 0.07, 0.11, 0.012)));  // closed lids
      c.lerp(hairC, w);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  var HEAD_GEO = headGeo();

  /* ---------------- materials ---------------- */
  var M = {
    shell:  new THREE.MeshPhysicalMaterial({ color:0xf3f4f2, roughness:0.3, clearcoat:0.7, clearcoatRoughness:0.22 }),
    trim:   new THREE.MeshStandardMaterial({ color:0xb4bbc0, roughness:0.35, metalness:0.25 }),
    steel:  new THREE.MeshStandardMaterial({ color:0xc9cfd3, roughness:0.25, metalness:0.75 }),
    dark:   new THREE.MeshStandardMaterial({ color:0x3a3f44, roughness:0.55 }),
    carbon: new THREE.MeshPhysicalMaterial({ color:0x2a2e33, roughness:0.32, clearcoat:0.8, clearcoatRoughness:0.15 }),
    skin:   new THREE.MeshPhysicalMaterial({ color:0xcf9a7c, roughness:0.58, sheen:0.4, sheenColor:new THREE.Color(0xffd6bf), sheenRoughness:0.6 }),
    hair:   new THREE.MeshStandardMaterial({ color:0x2a2018, roughness:0.85 }),
    wall:   new THREE.MeshStandardMaterial({ color:0xe6e9e6, roughness:0.92 }),
    trouser:new THREE.MeshStandardMaterial({ color:0x2f3f57, roughness:0.85 }),
    shoe:   new THREE.MeshStandardMaterial({ color:0x24262a, roughness:0.5 }),
    sole:   new THREE.MeshStandardMaterial({ color:0xe9e9e6, roughness:0.7 }),
    lamp:   new THREE.MeshBasicMaterial({ color:new THREE.Color(1.6, 0.25, 0.15), toneMapped:false }),
    lampOff:new THREE.MeshStandardMaterial({ color:0x5a2a26, roughness:0.4 })
  };
  M.gown = new THREE.MeshStandardMaterial({ roughness:0.92, side:THREE.DoubleSide, map:canvasTex(256, 256, function(g, w, h){
    g.fillStyle = "#a9c8d8"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#7ea5bb";
    for(var y=8; y<h; y+=32) for(var x=8 + ((y/32)%2)*16; x<w; x+=32){
      g.beginPath(); g.moveTo(x, y-5); g.lineTo(x+5, y); g.lineTo(x, y+5); g.lineTo(x-5, y); g.closePath(); g.fill();
    }
    noise(g, w, h, 5000, 0.08, "rgba(40,60,80,A)");
  }, [4, 3]) });
  M.floor = new THREE.MeshStandardMaterial({ roughness:0.5, map:canvasTex(512, 512, function(g, w, h){
    g.fillStyle = "#cfd4d1"; g.fillRect(0, 0, w, h);
    noise(g, w, h, 26000, 0.12, "rgba(70,80,75,A)");
    g.strokeStyle = "rgba(120,130,125,.35)"; g.lineWidth = 2;
    for(var i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*w/4, 0); g.lineTo(i*w/4, h); g.stroke(); g.beginPath(); g.moveTo(0, i*h/4); g.lineTo(w, i*h/4); g.stroke(); }
  }, [5, 5]) });
  // detector face: carbon cover with the centre cross and the three AEC chamber outlines
  M.detFace = new THREE.MeshPhysicalMaterial({ roughness:0.35, clearcoat:0.6, map:canvasTex(512, 512, function(g, w, h){
    g.fillStyle = "#2e3338"; g.fillRect(0, 0, w, h);
    noise(g, w, h, 9000, 0.06, "rgba(255,255,255,A)");
    g.strokeStyle = "rgba(235,240,245,.75)"; g.lineWidth = 3;
    var s = w/430;                                  // 430 mm detector
    [[-85, -55], [85, -55], [0, 25]].forEach(function(c){ g.strokeRect(w/2 + (c[0]-28)*s, h/2 + (c[1]-38)*s, 56*s, 76*s); });
    g.lineWidth = 2; g.beginPath(); g.moveTo(w/2, h/2-30); g.lineTo(w/2, h/2+30); g.moveTo(w/2-30, h/2); g.lineTo(w/2+30, h/2); g.stroke();
    g.strokeStyle = "rgba(235,240,245,.35)"; g.strokeRect(6, 6, w-12, h-12);
  }) });

  /* ---------------- room ---------------- */
  var DZ = -0.92;                                   // detector front face (z)
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), M.floor);
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
  var wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 4.5), M.wall);
  wall.position.set(0, 2.25, -1.25); wall.receiveShadow = true; scene.add(wall);
  var side = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.5), M.wall);
  side.rotation.y = Math.PI/2; side.position.set(-2.3, 2.25, 2); side.receiveShadow = true; scene.add(side);
  [[0, 0.05, -1.24, 16, 0.02, 0], [-2.29, 0.05, 2, 0.02, 10, 1]].forEach(function(s){
    var k = new THREE.Mesh(new THREE.BoxGeometry(s[5] ? 0.02 : s[3], 0.1, s[5] ? s[4] : 0.02), M.dark); k.position.set(s[0], s[1], s[2]); scene.add(k);
  });
  // control-room window on the side wall
  var winFrame = rbox(0.08, 0.85, 1.6, 0.02, M.trim); winFrame.position.set(-2.27, 1.6, 1.4); scene.add(winFrame);
  var winGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 0.73), new THREE.MeshPhysicalMaterial({ roughness:0.06, clearcoat:1, map:canvasTex(512, 252, function(g, w, h){
    var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#56656f"); gr.addColorStop(1, "#2b343a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1a2025"; g.fillRect(0, h*0.72, w, h*0.28);
    [[70, 160], [210, 160], [350, 160]].forEach(function(p, i){
      g.fillStyle = "#0e1215"; g.fillRect(p[0], p[1]-78, 100, 70);
      g.fillStyle = i === 1 ? "#d8d8d8" : "#2f4d63"; g.fillRect(p[0]+5, p[1]-74, 90, 60);
      if(i === 1){ g.fillStyle = "#333"; g.fillRect(p[0]+30, p[1]-70, 30, 52); }
      g.fillStyle = "#0e1215"; g.fillRect(p[0]+46, p[1]-8, 8, 12);
    });
    g.fillStyle = "rgba(255,255,255,.07)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(w*0.35, 0); g.lineTo(w*0.15, h); g.lineTo(0, h); g.fill();
  }) }));
  winGlass.rotation.y = Math.PI/2; winGlass.position.set(-2.22, 1.6, 1.4); scene.add(winGlass);
  // radiation warning sign + exposure lamp on the back wall
  var sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ toneMapped:false, map:canvasTex(250, 100, function(g, w, h){
    g.fillStyle = "#ffd21f"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#111"; g.beginPath(); g.arc(46, 50, 30, 0, 7); g.fill();
    g.fillStyle = "#ffd21f"; g.beginPath(); g.arc(46, 50, 7, 0, 7); g.fill();
    for(var i=0;i<3;i++){ var a = -Math.PI/2 + i*2*Math.PI/3; g.beginPath(); g.moveTo(46, 50); g.arc(46, 50, 27, a - 0.5, a + 0.5); g.closePath(); g.fill(); }
    g.fillStyle = "#111"; g.beginPath(); g.arc(46, 50, 10, 0, 7); g.fill(); g.fillStyle = "#ffd21f"; g.beginPath(); g.arc(46, 50, 6, 0, 7); g.fill();
    g.fillStyle = "#111"; g.font = "bold 19px Segoe UI, Arial"; g.fillText("X-RAY", 92, 42); g.font = "bold 13px Segoe UI, Arial"; g.fillText("CONTROLLED AREA", 92, 64);
  }) }));
  sign.position.set(1.25, 2.25, -1.24); scene.add(sign);
  var lamp = rbox(0.28, 0.09, 0.05, 0.02, M.lampOff); lamp.position.set(1.25, 2.5, -1.22); scene.add(lamp);

  /* ---------------- erect chest stand (wall bucky) ---------------- */
  var DH = 1.22;                                    // detector centre height (follows the central ray)
  var standBase = rbox(0.86, 0.04, 0.34, 0.015, M.dark); standBase.position.set(0, 0.02, -1.08); scene.add(standBase);
  [-0.36, 0.36].forEach(function(x){
    var col = rbox(0.09, 2.15, 0.12, 0.02, M.shell); col.position.set(x, 1.095, -1.1); scene.add(col);
    var slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.0, 0.004), M.dark); slot.position.set(x + (x < 0 ? 0.03 : -0.03), 1.1, -1.039); scene.add(slot);
  });
  var cap = rbox(0.86, 0.06, 0.14, 0.02, M.shell); cap.position.set(0, 2.2, -1.1); scene.add(cap);
  var det = new THREE.Group(); scene.add(det);
  (function(){
    var house = rbox(0.6, 0.6, 0.1, 0.03, M.shell); house.position.z = -0.97; det.add(house);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), M.detFace); face.position.z = DZ + 0.0005; det.add(face);
    var rim = rbox(0.62, 0.035, 0.12, 0.015, M.trim); rim.position.set(0, -0.31, -0.97); det.add(rim);
    var lab = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.035), new THREE.MeshBasicMaterial({ toneMapped:false, map:canvasTex(160, 35, function(g, w, h){
      g.fillStyle = "#e9ecef"; g.fillRect(0, 0, w, h); g.fillStyle = "#3a4048"; g.font = "bold 16px Segoe UI, Arial"; g.fillText("DR 43 × 43", 10, 24);
    }) })); lab.position.set(0, 0.272, DZ + 0.001); det.add(lab);
    // overhead hand-grip for the lateral
    var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.56, 16), M.steel); bar.rotation.z = Math.PI/2; bar.position.set(0, 0.5, -0.83); det.add(bar);
    [-0.27, 0.27].forEach(function(x){ var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 12), M.steel);
      arm.rotation.x = Math.PI/2; arm.position.set(x, 0.5, -0.92); det.add(arm);
      var up = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 12), M.steel); up.position.set(x, 0.4, -1.0); det.add(up); });
  })();

  /* ---------------- ceiling-suspended tube ---------------- */
  var tube = new THREE.Group(); scene.add(tube);
  var CEIL = 2.95;
  [-0.38, 0.38].forEach(function(x){ var r = rbox(0.08, 0.07, 5.2, 0.015, M.trim); r.position.set(x, CEIL, 1.3); scene.add(r); });
  var bridge = rbox(0.95, 0.08, 0.22, 0.02, M.shell); scene.add(bridge);
  var colTop = rbox(0.16, 0.6, 0.16, 0.025, M.shell); tube.add(colTop);
  var colLow = rbox(0.12, 1.0, 0.12, 0.02, M.trim); tube.add(colLow);
  (function(){
    var hs = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.44, 40), M.shell); hs.rotation.z = Math.PI/2; hs.castShadow = true; tube.add(hs);
    [-0.23, 0.23].forEach(function(x){ var e = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 40), M.trim); e.rotation.z = Math.PI/2; e.position.x = x; tube.add(e); });
    var coll = rbox(0.24, 0.24, 0.17, 0.025, M.shell); coll.position.z = -0.19; tube.add(coll);
    var win = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), new THREE.MeshPhysicalMaterial({ color:0x9fb3bf, roughness:0.05, clearcoat:1, transparent:true, opacity:0.7 }));
    win.rotation.y = Math.PI; win.position.z = -0.276; tube.add(win);
    [-1, 1].forEach(function(s){ var k = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 20), M.dark); k.rotation.z = Math.PI/2; k.position.set(s*0.132, 0.03, -0.19); tube.add(k); });
    var handle = rbox(0.34, 0.05, 0.05, 0.02, M.dark); handle.position.set(0, -0.15, 0.04); tube.add(handle);
    var disp = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), M.sid = new THREE.MeshBasicMaterial({ toneMapped:false }));
    disp.position.set(0, 0.0, 0.106); tube.add(disp);
  })();
  var sidCv = document.createElement("canvas"); sidCv.width = 120; sidCv.height = 70;
  M.sid.map = new THREE.CanvasTexture(sidCv); M.sid.map.colorSpace = THREE.SRGBColorSpace;
  function drawSID(cm){
    var g = sidCv.getContext("2d"); g.fillStyle = "#07120c"; g.fillRect(0, 0, 120, 70);
    g.fillStyle = "#5fe08a"; g.font = "bold 28px Segoe UI, Arial"; g.fillText(cm + "", 12, 38);
    g.font = "14px Segoe UI, Arial"; g.fillStyle = "#9fe7b8"; g.fillText("cm SID", 66, 37); g.fillText("ERECT  ◄", 12, 60);
    M.sid.map.needsUpdate = true;
  }

  /* light-beam diaphragm: a projected-texture spotlight with the field and its cross-wires */
  var LF_H0 = 0.3;                                  // map half-width (m) at the detector plane
  var lfCv = document.createElement("canvas"); lfCv.width = lfCv.height = 512;
  var lfTex = new THREE.CanvasTexture(lfCv); lfTex.colorSpace = THREE.SRGBColorSpace;
  var spot = new THREE.SpotLight(0xfff3d6, 0, 0, 0.3, 0, 1);
  spot.map = lfTex; spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004;
  scene.add(spot, spot.target);
  var FIELD = null;
  function drawField(){
    var g = lfCv.getContext("2d"), n = 512; g.fillStyle = "#000"; g.fillRect(0, 0, n, n);
    if(!FIELD) return;
    var sx = n/(2*LF_H0), w = FIELD.w*sx, h = FIELD.h*sx;
    g.fillStyle = "#fff"; g.fillRect(n/2 - w/2, n/2 - h/2, w, h);
    g.fillStyle = "#000"; g.fillRect(n/2 - w/2, n/2 - 1.5, w, 3); g.fillRect(n/2 - 1.5, n/2 - h/2, 3, h);
    lfTex.needsUpdate = true;
  }

  /* ---------------- patient (standing) ---------------- */
  /* Local frame: anterior +z, patient's LEFT +x, up +y, feet on y = 0. setPose() rebuilds the arms and head and
     turns/places the whole patient against the detector:
       PA  - facing the detector, chin up on the detector top;  AP - back to the detector;
       LAT - left (or right) side against the detector.
     Arms: "hips" (backs of the hands on the hips, elbows and shoulders rolled forward), "side" (hanging by the
     side), "up" (raised, forearms resting on the head). */
  var patient = new THREE.Group(); scene.add(patient);
  var body = new THREE.Group(); patient.add(body);
  var limbs = null;
  var T7 = 1.22;
  function torsoGeo(){
    var y0 = 0.62, y1 = 1.47;
    var RX = [[0, 0.19], [0.22, 0.175], [0.3, 0.16], [0.47, 0.13], [0.62, 0.138], [0.8, 0.155], [0.9, 0.166], [0.955, 0.15], [1, 0.07]];
    var RZ = [[0, 0.125], [0.22, 0.11], [0.47, 0.092], [0.62, 0.098], [0.8, 0.104], [0.9, 0.09], [0.955, 0.075], [1, 0.052]];
    return gridGeo(70, 56, function(u, v){
      var y = y0 + u*(y1 - y0), a = v*Math.PI*2, c = Math.cos(a), s = Math.sin(a);
      var rx = prof(RX, u), rz = prof(RZ, u);
      var x = rx*Math.sign(s)*Math.pow(Math.abs(s), 0.8), z = rz*Math.sign(c)*Math.pow(Math.abs(c), 0.85);
      if(z > 0) z += 0.032*(g2(x - 0.075, y - 1.235, 0.06, 0.055) + g2(x + 0.075, y - 1.235, 0.06, 0.055));   // bust
      z -= 0.012*g2(x, y - 1.26, 0.05, 0.3)*(z < 0 ? 1 : 0);                                                 // spinal groove
      var fold = (u < 0.3 ? 0.004*Math.sin(v*44 + u*8) : 0.0015*Math.sin(u*70 + v*20));
      if(u < 0.02){ var k = u/0.02; x *= 0.97 + 0.03*k; z *= 0.97 + 0.03*k; }
      return [x*(1 + fold), y, z*(1 + fold)];
    });
  }
  (function buildBody(){
    var torso = new THREE.Mesh(torsoGeo(), M.gown); torso.castShadow = torso.receiveShadow = true; body.add(torso);
    // legs in scrub trousers, shoes
    [-1, 1].forEach(function(s){
      body.add(taper(new V3(s*0.085, 0.8, 0), new V3(s*0.092, 0.47, 0.012), 0.082, 0.056, M.trouser));
      body.add(taper(new V3(s*0.092, 0.47, 0.012), new V3(s*0.095, 0.1, -0.01), 0.056, 0.04, M.trouser));
      var shoe = rbox(0.095, 0.07, 0.25, 0.03, M.shoe); shoe.position.set(s*0.097, 0.04, 0.035); body.add(shoe);
      var sole = rbox(0.1, 0.018, 0.26, 0.008, M.sole); sole.position.set(s*0.097, 0.009, 0.035); body.add(sole);
    });
    var neck = limb(new V3(0, 1.43, -0.012), new V3(0, 1.535, 0.0), 0.05, M.skin); body.add(neck);
  })();
  var POSE = null;
  /* back (optional): the way the BACK of the hand faces; the hand is then rolled so its palm faces away from it.
     Hand local frame: +x along the fingers, +y = back of the hand, thumb on +z (tz = -1 puts it on -z). */
  function arm(sh, el, wr, hdir, side, back, tz){
    limbs.add(taper(sh, el, 0.046, 0.036, M.skin));
    limbs.add(taper(sh, sh.clone().lerp(el, 0.38), 0.058, 0.05, M.gown));          // sleeve
    var cap = ellipsoid(0.066, 0.06, 0.064, M.gown, 28); cap.position.copy(sh).add(new V3(side*0.004, 0.012, 0)); limbs.add(cap);
    limbs.add(taper(el, wr, 0.036, 0.025, M.skin));
    var j = ellipsoid(0.037, 0.035, 0.037, M.skin, 20); j.position.copy(el); limbs.add(j);
    var hand = new THREE.Group(); hand.position.copy(wr); limbs.add(hand);
    var hx = hdir.clone().normalize();
    if(back){
      var hy = back.clone().addScaledVector(hx, -back.dot(hx)).normalize(), hz = new V3().crossVectors(hx, hy);
      hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(hx, hy, hz));
    } else hand.quaternion.setFromUnitVectors(new V3(1, 0, 0), hx);
    tz = tz || 1;
    var palm = ellipsoid(0.048, 0.016, 0.038, M.skin, 24); palm.position.x = 0.046; hand.add(palm);
    var fing = ellipsoid(0.046, 0.012, 0.034, M.skin, 24); fing.position.set(0.108, -0.004, 0); fing.rotation.z = -0.35; hand.add(fing);
    hand.add(taper(new V3(0.014, 0, 0.03*tz), new V3(0.07, -0.006, 0.05*tz), 0.012, 0.009, M.skin));
  }
  function buildPose(p){
    if(limbs){ body.remove(limbs); limbs.traverse(function(c){ if(c.isMesh && c.geometry !== HEAD_GEO) c.geometry.dispose(); }); }
    limbs = new THREE.Group(); body.add(limbs);
    [-1, 1].forEach(function(s){
      var sh = new V3(s*0.185, 1.385, -0.008);
      if(p.arms === "hips"){        // backs of the hands on the hips, elbows forward -> scapulae rotated out
        // fingers point back and down over the iliac crest, back of the hand against the hip (palm faces out)
        arm(sh, new V3(s*0.29, 1.16, 0.115), new V3(s*0.172, 1.0, -0.01), new V3(-s*0.08, -0.84, -0.53), s, new V3(-s, 0, 0.1), s);
      } else if(p.arms === "up"){   // raised, forearms resting on the head
        arm(sh, new V3(s*0.15, 1.69, 0.045), new V3(-s*0.07, 1.79, 0.055), new V3(-s*1, 0.15, 0), s);
      } else {                      // hanging by the side
        arm(sh, new V3(s*0.215, 1.115, -0.02), new V3(s*0.232, 0.86, 0.025), new V3(0.05*s, -1, 0.1), s);
      }
    });
    var head = new THREE.Group(); head.position.set(0, 1.62, 0.012);
    head.rotation.x = p.chin === "up" ? -0.26 : (p.chin === "down" ? 0.32 : 0);
    var hm = new THREE.Mesh(HEAD_GEO, M.head); hm.castShadow = hm.receiveShadow = true; hm.position.y = -0.0; head.add(hm);
    [-1, 1].forEach(function(s){ var ear = ellipsoid(0.009, 0.024, 0.014, M.skin, 20); ear.position.set(s*0.072, -0.02, -0.012); ear.rotation.x = -0.15; head.add(ear); });
    var bun = ellipsoid(0.052, 0.045, 0.04, M.hair, 28); bun.position.set(0, 0.03, -0.1); head.add(bun);
    var hairBack = ellipsoid(0.078, 0.09, 0.07, M.hair, 36); hairBack.position.set(0, 0.012, -0.03); head.add(hairBack);
    limbs.add(head);
  }
  M.head = M.skin.clone(); M.head.color.set(0xffffff); M.head.vertexColors = true;

  /* ---------------- pose / geometry state ---------------- */
  var SID = 1.8, SHIFT = 0;
  function place(){
    var p = POSE, rot = 0, depth = 0.148;
    if(p.proj === "pa"){ rot = p.face === "ap" ? 0 : Math.PI; depth = p.face === "ap" ? 0.112 : 0.152; }
    else { rot = p.side === "R" ? -Math.PI/2 : Math.PI/2; depth = p.arms === "side" ? 0.255 : 0.17; }
    patient.rotation.y = rot;
    patient.position.set(SHIFT, 0, DZ + depth);
    det.position.y = DH; det.position.x = 0;
    var zT = DZ + SID;
    tube.position.set(0, DH, zT);
    var span = CEIL - 0.04 - (DH + 0.1);           // ceiling to the top of the tube housing
    colTop.scale.y = 1; colTop.position.set(0, span - 0.3 + 0.1, 0);
    colLow.scale.y = Math.max(0.2, (span - 0.55)/1.0); colLow.position.set(0, 0.1 + (span - 0.55)/2, 0);
    bridge.position.set(0, CEIL - 0.05, zT);
    drawSID(Math.round(SID*100));
    spot.position.set(0, DH, zT - 0.26); spot.target.position.set(0, DH, DZ);
    spot.angle = Math.atan(LF_H0/(SID - 0.26));
    spot.intensity = FIELD ? 9 : 0; spot.distance = 0;
    drawField();
    kick();
  }

  /* ---------------- camera (drag to orbit) ---------------- */
  var camera3 = camera;
  var TGT = new V3(0, 1.2, -0.15), YAW = 1.12, PITCH = 0.17, DIST = 4.3;
  function setCam(){
    var c = Math.cos(PITCH);
    camera3.position.set(TGT.x + DIST*c*Math.sin(YAW), TGT.y + DIST*Math.sin(PITCH), TGT.z + DIST*c*Math.cos(YAW));
    camera3.lookAt(TGT);
  }
  (function(){
    var el = renderer.domElement, d = null;
    el.style.touchAction = "none"; el.style.cursor = "grab";
    el.addEventListener("pointerdown", function(e){ d = { x:e.clientX, y:e.clientY, yaw:YAW, pitch:PITCH }; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing"; });
    el.addEventListener("pointermove", function(e){ if(!d) return;
      YAW = Math.max(-0.2, Math.min(1.75, d.yaw - (e.clientX - d.x)*0.006));
      PITCH = Math.max(0.02, Math.min(0.7, d.pitch + (e.clientY - d.y)*0.004)); setCam(); kick(); });
    function up(){ d = null; el.style.cursor = "grab"; }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  })();

  /* ---------------- exposure: beam flash + room lamp ---------------- */
  var beamMat = new THREE.MeshBasicMaterial({ color:new THREE.Color(0.55, 0.8, 1.6), transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, toneMapped:false });
  var beam = new THREE.Mesh(new THREE.BufferGeometry(), beamMat); scene.add(beam); beam.visible = false;
  function beamGeo(){
    var f = FIELD || { w:0.35, h:0.35 }, zT = DZ + SID, a = new V3(0, DH, zT - 0.05);
    var c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function(k){ return new V3(k[0]*f.w/2, DH + k[1]*f.h/2, DZ + 0.002); });
    var pos = [];
    for(var i=0;i<4;i++){ var b = c[i], d = c[(i + 1)%4]; pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z); }
    beam.geometry.dispose(); beam.geometry = new THREE.BufferGeometry(); beam.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  }
  var flash = null;

  /* ---------------- render loop ---------------- */
  var running = false, raf = 0;
  function resize(){
    var w = host.clientWidth || 600, h = host.clientHeight || 600;
    renderer.setSize(w, h, false); camera3.aspect = w/h;
    camera3.fov = w/h < 0.9 ? 44 : 32; camera3.updateProjectionMatrix();
  }
  function frame(now){
    raf = 0;
    if(flash){
      var t = (now - flash.t0)/1000;
      if(t < 0.5){ beam.visible = true; beamMat.opacity = 0.32*Math.sin(Math.min(1, t/0.5)*Math.PI); lamp.material = M.lamp; spot.intensity = 0; }
      else if(t < 1.1){ beam.visible = false; lamp.material = t < 0.9 ? M.lamp : M.lampOff; }
      else { beam.visible = false; lamp.material = M.lampOff; spot.intensity = FIELD ? 9 : 0; var cb = flash.cb; flash = null; if(cb) cb(); }
    }
    renderer.render(scene, camera3);
    if(flash) raf = requestAnimationFrame(frame);
  }
  function kick(){ if(!raf) raf = requestAnimationFrame(frame); }
  var ro = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(function(){ resize(); kick(); }) : null;
  if(ro) ro.observe(host);
  resize();

  POSE = { proj:"pa", face:"pa", arms:"side", chin:"neutral", side:"L" };
  buildPose(POSE); setCam(); place();

  return {
    setPose:function(p){
      var old = POSE; POSE = Object.assign({}, POSE, p);
      if(!old || old.arms !== POSE.arms || old.chin !== POSE.chin) buildPose(POSE);
      place();
    },
    setSID:function(cm){ SID = cm/100; place(); },
    /* f = { w, h } metres at the detector, dx = central ray minus the patient's reference point (world x, m),
       dy = central-ray height above T7 (m). null switches the light off. */
    setField:function(f){
      if(f){ FIELD = { w:f.w, h:f.h }; SHIFT = -(f.dx || 0); DH = T7 + (f.dy || 0); }
      else { FIELD = null; SHIFT = 0; DH = T7; }
      place();
    },
    expose:function(cb){ beamGeo(); flash = { t0:performance.now(), cb:cb }; kick(); },
    view:function(name){
      if(name === "tube"){ YAW = 0.3; PITCH = 0.3; DIST = 3.4; TGT.set(0, 1.25, -0.75); }
      else if(name === "side"){ YAW = 1.45; PITCH = 0.14; DIST = 4.0; TGT.set(0, 1.2, -0.1); }
      else { YAW = 1.12; PITCH = 0.17; DIST = 4.3; TGT.set(0, 1.2, -0.15); }
      setCam(); kick();
    },
    orbit:function(yaw, pitch, dist, t){ YAW = yaw; PITCH = pitch; DIST = dist; TGT.set(t[0], t[1], t[2]); setCam(); kick(); },   // debug
    start:function(){ running = true; resize(); kick(); },
    stop:function(){ running = false; if(raf){ cancelAnimationFrame(raf); raf = 0; } },
    snap:function(w, h){
      renderer.setSize(w, h, false); camera3.aspect = w/h; camera3.fov = 32; camera3.updateProjectionMatrix();
      renderer.render(scene, camera3); var u = renderer.domElement.toDataURL("image/png"); resize(); kick(); return u;
    },
    renderer:renderer
  };
};
