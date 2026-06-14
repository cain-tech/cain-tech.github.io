import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/*
 * 3D particle field that morphs between shapes as the page scrolls:
 * Earth globe (hero) → horse rider → snowboarder → MacBook.
 * The globe is built by sampling land pixels from an equirectangular
 * NASA Blue Marble texture (public/earth.jpg); the sport figures are built
 * by rasterizing emoji silhouettes to a canvas and sampling their pixels.
 * The globe spins continuously; the sport figures face the camera with a
 * gentle sway. Everything tilts toward the mouse.
 */

const COUNT = 4000;
const RADIUS = 2.6;

/* particles reserved for the jockey riding the 3D horse */
const RIDER_COUNT = 450;
const HORSE_SAMPLES = COUNT - RIDER_COUNT;

/* Generic pose → bake → surface-sample pipeline for the rigged humanoid.
   Applies additive bone rotations, computes the skinned vertex positions,
   and samples `count` area-weighted surface points centered on the hips.
   Also returns the posed hand positions (attachment anchors). */
function bakeAndSample(root, pose, count) {
  let mesh = null;
  root.traverse((o) => {
    if (o.isSkinnedMesh && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) {
      mesh = o;
    }
  });
  if (!mesh) return null;
  for (const [name, x, y, z] of pose) {
    const b = root.getObjectByName(name);
    if (!b) return null;
    b.rotation.x += x; b.rotation.y += y; b.rotation.z += z;
  }
  root.updateMatrixWorld(true);
  mesh.skeleton.update();

  const posAttr = mesh.geometry.attributes.position;
  const baked = new Float32Array(posAttr.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    mesh.applyBoneTransform(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    baked[i * 3] = v.x; baked[i * 3 + 1] = v.y; baked[i * 3 + 2] = v.z;
  }

  const idx = mesh.geometry.index ? mesh.geometry.index.array : null;
  const triCount = (idx ? idx.length : posAttr.count) / 3;
  const vi = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const cum = new Float64Array(triCount);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    A.fromArray(baked, vi(t, 0) * 3);
    B.fromArray(baked, vi(t, 1) * 3);
    C.fromArray(baked, vi(t, 2) * 3);
    ab.subVectors(B, A); ac.subVectors(C, A);
    total += ab.cross(ac).length() / 2;
    cum[t] = total;
  }
  if (!total) return null;

  const hips = new THREE.Vector3();
  root.getObjectByName("mixamorigHips").getWorldPosition(hips);
  const grab = (name) => {
    const b = root.getObjectByName(name);
    if (!b) return [0, 0, 0];
    const p = new THREE.Vector3();
    b.getWorldPosition(p);
    return [p.x - hips.x, p.y - hips.y, p.z - hips.z];
  };

  const pts = new Float32Array(count * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; cum[mid] < r ? (lo = mid + 1) : (hi = mid); }
    const r1 = Math.sqrt(Math.random()), r2 = Math.random();
    const u0 = 1 - r1, v0 = r1 * (1 - r2), w0 = r1 * r2;
    const ja = vi(lo, 0) * 3, jb = vi(lo, 1) * 3, jc = vi(lo, 2) * 3;
    pts[i * 3] = baked[ja] * u0 + baked[jb] * v0 + baked[jc] * w0 - hips.x;
    pts[i * 3 + 1] = baked[ja + 1] * u0 + baked[jb + 1] * v0 + baked[jc + 1] * w0 - hips.y;
    pts[i * 3 + 2] = baked[ja + 2] * u0 + baked[jb + 2] * v0 + baked[jc + 2] * w0 - hips.z;
    if (pts[i * 3 + 1] < minY) minY = pts[i * 3 + 1];
    if (pts[i * 3 + 1] > maxY) maxY = pts[i * 3 + 1];
  }
  return { pts, minY, maxY, lh: grab("mixamorigLeftHand"), rh: grab("mixamorigRightHand") };
}

/* Center a finished composition and scale it to the standard figure size. */
function fitShape(arr, maxDim = 6.2) {
  let nx = Infinity, ny = Infinity, nz = Infinity, mx = -Infinity, my = -Infinity, mz = -Infinity;
  for (let i = 0; i < arr.length; i += 3) {
    nx = Math.min(nx, arr[i]); mx = Math.max(mx, arr[i]);
    ny = Math.min(ny, arr[i + 1]); my = Math.max(my, arr[i + 1]);
    nz = Math.min(nz, arr[i + 2]); mz = Math.max(mz, arr[i + 2]);
  }
  const cx = (nx + mx) / 2, cy = (ny + my) / 2, cz = (nz + mz) / 2;
  const s = maxDim / Math.max(mx - nx, my - ny, mz - nz, 1e-6);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = (arr[i] - cx) * s;
    arr[i + 1] = (arr[i + 1] - cy) * s;
    arr[i + 2] = (arr[i + 2] - cz) * s;
  }
  return arr;
}

/* Riding pose for the rigged humanoid (Mixamo skeleton), applied as additive
   bone rotations on top of the T-pose: crouched spine, head up, thighs
   straddling forward, knees bent, arms lowered to the reins. */
const RIDER_POSE = [
  // classic riding seat: straight back with a slight forward lean, head up
  ["mixamorigSpine", 0.28, 0, 0],
  ["mixamorigSpine1", 0.18, 0, 0],
  ["mixamorigSpine2", 0.14, 0, 0],
  ["mixamorigNeck", -0.2, 0, 0],
  ["mixamorigHead", -0.15, 0, 0],
  // upper arms hang along the torso, elbows bent ~90° so the hands
  // reach low and forward toward the withers (rein position)
  ["mixamorigLeftArm", -0.35, 0, -1.25],
  ["mixamorigRightArm", -0.35, 0, 1.25],
  ["mixamorigLeftForeArm", -1.0, 0, 0],
  ["mixamorigRightForeArm", -1.0, 0, 0],
  // thighs ~45° down-forward, knees bent, lower legs back under the body
  ["mixamorigLeftUpLeg", -0.75, 0, 0.3],
  ["mixamorigRightUpLeg", -0.75, 0, -0.3],
  ["mixamorigLeftLeg", 1.1, 0, 0],
  ["mixamorigRightLeg", 1.1, 0, 0],
];

/* Pose the skinned humanoid, bake the skinned vertex positions, and sample
   RIDER_COUNT surface points → offsets relative to the hips, scaled so the
   rider is proportional to the horse (u = horse height in scene units).
   Returns null if anything is missing so the procedural rider stays. */
function buildRiderFromModel(gltf, u) {
  const root = gltf.scene;
  let mesh = null;
  root.traverse((o) => {
    // models like Xbot carry several skinned meshes (joint balls + body);
    // the body surface is the one with the most vertices
    if (o.isSkinnedMesh && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) {
      mesh = o;
    }
  });
  if (!mesh) return null;

  for (const [name, x, y, z] of RIDER_POSE) {
    const b = root.getObjectByName(name);
    if (!b) return null;
    b.rotation.x += x; b.rotation.y += y; b.rotation.z += z;
  }
  root.updateMatrixWorld(true);
  mesh.skeleton.update();

  // bake skinned vertices into world space
  const posAttr = mesh.geometry.attributes.position;
  const baked = new Float32Array(posAttr.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    mesh.applyBoneTransform(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    baked[i * 3] = v.x; baked[i * 3 + 1] = v.y; baked[i * 3 + 2] = v.z;
  }

  // area-weighted surface sampling on the baked mesh
  const idx = mesh.geometry.index ? mesh.geometry.index.array : null;
  const triCount = (idx ? idx.length : posAttr.count) / 3;
  const vi = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), C = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const cum = new Float64Array(triCount);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    A.fromArray(baked, vi(t, 0) * 3);
    Bv.fromArray(baked, vi(t, 1) * 3);
    C.fromArray(baked, vi(t, 2) * 3);
    ab.subVectors(Bv, A); ac.subVectors(C, A);
    total += ab.cross(ac).length() / 2;
    cum[t] = total;
  }
  if (!total) return null;

  const hips = root.getObjectByName("mixamorigHips");
  const hp = new THREE.Vector3();
  hips.getWorldPosition(hp);

  const pts = new Float32Array(RIDER_COUNT * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < RIDER_COUNT; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; cum[mid] < r ? (lo = mid + 1) : (hi = mid); }
    const r1 = Math.sqrt(Math.random()), r2 = Math.random();
    const u0 = 1 - r1, v0 = r1 * (1 - r2), w0 = r1 * r2;
    const ja = vi(lo, 0) * 3, jb = vi(lo, 1) * 3, jc = vi(lo, 2) * 3;
    const px = baked[ja] * u0 + baked[jb] * v0 + baked[jc] * w0 - hp.x;
    const py = baked[ja + 1] * u0 + baked[jb + 1] * v0 + baked[jc + 1] * w0 - hp.y;
    const pz = baked[ja + 2] * u0 + baked[jb + 2] * v0 + baked[jc + 2] * w0 - hp.z;
    // model faces +z, horse runs toward +x → same yaw mapping as the horse
    pts[i * 3] = pz;
    pts[i * 3 + 1] = py;
    pts[i * 3 + 2] = -px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  // scale so the seated rider stands ~62% of the horse's height
  const s = (0.62 * u) / Math.max(maxY - minY, 1e-6);
  for (let i = 0; i < pts.length; i++) pts[i] *= s;
  for (let i = 0; i < RIDER_COUNT; i++) {
    pts[i * 3 + 1] += 0.07 * u; // seat above the back line
  }
  return pts;
}

/* Sample a fully animated glTF character (all meshes, skinned or rigid)
   driven by its own AnimationMixer clips — the professional-asset path,
   same as the galloping horse. Returns an evaluator that re-samples the
   deforming meshes every frame. */
function setupClipFigure(gltf, count) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  let meshes = [];
  root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) meshes.push(o); });
  if (!meshes.length || !gltf.animations.length) return null;
  meshes.forEach((m) => m.isSkinnedMesh && m.skeleton.update());

  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const worldVert = (mesh, vi, out) => {
    out.fromBufferAttribute(mesh.geometry.attributes.position, vi);
    if (mesh.isSkinnedMesh) mesh.applyBoneTransform(vi, out);
    out.applyMatrix4(mesh.matrixWorld);
  };

  // drop ground-trail style props: paper-thin meshes much flatter than the
  // tallest mesh (the Onirix model ships the character's ski trail as a mesh)
  const ySizes = meshes.map((mesh) => {
    const pos = mesh.geometry.attributes.position;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.count; i += 5) {
      worldVert(mesh, i, v);
      if (v.y < lo) lo = v.y;
      if (v.y > hi) hi = v.y;
    }
    return hi - lo;
  });
  const maxY = Math.max(...ySizes);
  meshes = meshes.filter((_, i) => ySizes[i] > maxY * 0.08);

  // combined area-weighted triangle list across every mesh
  const triMesh = [], triA = [], triB = [], triC = [], cum = [];
  let total = 0;
  meshes.forEach((mesh, mi) => {
    const pos = mesh.geometry.attributes.position;
    const idx = mesh.geometry.index ? mesh.geometry.index.array : null;
    const tc = (idx ? idx.length : pos.count) / 3;
    for (let t = 0; t < tc; t++) {
      const a = idx ? idx[t * 3] : t * 3;
      const b = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const c = idx ? idx[t * 3 + 2] : t * 3 + 2;
      worldVert(mesh, a, v); worldVert(mesh, b, v2); worldVert(mesh, c, v3);
      e1.subVectors(v2, v); e2.subVectors(v3, v);
      const area = e1.cross(e2).length() / 2;
      if (area > 0) {
        total += area;
        triMesh.push(mi); triA.push(a); triB.push(b); triC.push(c); cum.push(total);
      }
    }
  });
  if (!total) return null;

  // samples with per-mesh unique-vertex caches
  const slotMaps = meshes.map(() => new Map());
  const sMesh = new Int32Array(count);
  const cLocal = new Int32Array(count * 3);
  const bu = new Float32Array(count), bv = new Float32Array(count), bw = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; cum[mid] < r ? (lo = mid + 1) : (hi = mid); }
    const r1 = Math.sqrt(Math.random()), r2 = Math.random();
    bu[i] = 1 - r1; bv[i] = r1 * (1 - r2); bw[i] = r1 * r2;
    sMesh[i] = triMesh[lo];
    const map = slotMaps[triMesh[lo]];
    [triA[lo], triB[lo], triC[lo]].forEach((vid, c) => {
      if (!map.has(vid)) map.set(vid, map.size);
      cLocal[i * 3 + c] = map.get(vid);
    });
  }
  const offsets = [];
  let slotTotal = 0;
  slotMaps.forEach((m) => { offsets.push(slotTotal); slotTotal += m.size; });
  const uVerts = new Int32Array(slotTotal);
  slotMaps.forEach((m, mi) => { for (const [vid, slot] of m) uVerts[offsets[mi] + slot] = vid; });
  const scratch = new Float32Array(slotTotal * 3);

  const mixer = new THREE.AnimationMixer(root);
  return {
    mixer,
    clips: gltf.animations,
    evalInto(out) {
      root.updateMatrixWorld(true);
      meshes.forEach((m) => m.isSkinnedMesh && m.skeleton.update());
      slotMaps.forEach((map, mi) => {
        const off = offsets[mi], mesh = meshes[mi];
        for (let s = 0; s < map.size; s++) {
          worldVert(mesh, uVerts[off + s], v);
          scratch[(off + s) * 3] = v.x;
          scratch[(off + s) * 3 + 1] = v.y;
          scratch[(off + s) * 3 + 2] = v.z;
        }
      });
      for (let i = 0; i < count; i++) {
        const off = offsets[sMesh[i]];
        const a3 = (off + cLocal[i * 3]) * 3, b3 = (off + cLocal[i * 3 + 1]) * 3, c3 = (off + cLocal[i * 3 + 2]) * 3;
        out[i * 3] = scratch[a3] * bu[i] + scratch[b3] * bv[i] + scratch[c3] * bw[i];
        out[i * 3 + 1] = scratch[a3 + 1] * bu[i] + scratch[b3 + 1] * bv[i] + scratch[c3 + 1] * bw[i];
        out[i * 3 + 2] = scratch[a3 + 2] * bu[i] + scratch[b3 + 2] * bv[i] + scratch[c3 + 2] * bw[i];
      }
    },
  };
}

/* Sample a static (unanimated) glTF model: gather every mesh's triangles in
   world space, area-weighted sample `count` surface points, normalize with
   fitShape. `weightOf(mesh)` scales a mesh's sampling density so small
   design details (logo, keycaps) read instead of drowning in the chassis. */
function sampleStaticModel(gltf, count, weightOf) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const verts = [], cum = [];
  let total = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const weight = weightOf ? weightOf(mesh) : 1;
    if (weight <= 0) return;
    const pos = mesh.geometry.attributes.position;
    const idx = mesh.geometry.index ? mesh.geometry.index.array : null;
    const tc = (idx ? idx.length : pos.count) / 3;
    for (let t = 0; t < tc; t++) {
      v.fromBufferAttribute(pos, idx ? idx[t * 3] : t * 3).applyMatrix4(mesh.matrixWorld);
      v2.fromBufferAttribute(pos, idx ? idx[t * 3 + 1] : t * 3 + 1).applyMatrix4(mesh.matrixWorld);
      v3.fromBufferAttribute(pos, idx ? idx[t * 3 + 2] : t * 3 + 2).applyMatrix4(mesh.matrixWorld);
      e1.subVectors(v2, v); e2.subVectors(v3, v);
      const area = e1.cross(e2).length() / 2;
      if (area > 0) {
        total += area * weight;
        verts.push(v.x, v.y, v.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
        cum.push(total);
      }
    }
  });
  if (!total) return null;
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; cum[mid] < r ? (lo = mid + 1) : (hi = mid); }
    const r1 = Math.sqrt(Math.random()), r2 = Math.random();
    const u0 = 1 - r1, v0 = r1 * (1 - r2), w0 = r1 * r2;
    const j = lo * 9;
    pts[i * 3] = verts[j] * u0 + verts[j + 3] * v0 + verts[j + 6] * w0;
    pts[i * 3 + 1] = verts[j + 1] * u0 + verts[j + 4] * v0 + verts[j + 7] * w0;
    pts[i * 3 + 2] = verts[j + 2] * u0 + verts[j + 5] * v0 + verts[j + 8] * w0;
  }
  return fitShape(pts);
}

/* ---- snowboarder: wide carving stance facing the camera, board below ---- */
const SNOW_POSE = [
  ["mixamorigSpine", 0.28, 0, 0.12],
  ["mixamorigSpine1", 0.16, 0, 0.08],
  ["mixamorigNeck", -0.25, 0, -0.1],
  ["mixamorigHead", -0.18, 0, 0],
  ["mixamorigLeftArm", -0.15, 0, -0.1],   // arms out for balance
  ["mixamorigRightArm", -0.15, 0, 0.55],
  ["mixamorigLeftForeArm", -0.25, 0, 0],
  ["mixamorigRightForeArm", -0.25, 0, 0],
  ["mixamorigLeftUpLeg", -0.3, 0, 0.5],   // wide sideways stance
  ["mixamorigRightUpLeg", -0.3, 0, -0.5],
  ["mixamorigLeftLeg", 0.95, 0, 0],
  ["mixamorigRightLeg", 0.95, 0, 0],
];

const SNOW_HUMAN = 2900, SNOW_BOARD = 1100; // = COUNT

/* Set up a rigged humanoid for LIVE skeletal animation: applies the base
   stance, captures per-bone rest rotations, builds area-weighted surface
   samples, and exposes skinInto() to re-evaluate the deforming body every
   frame — the same realtime technique as the galloping horse. */
function setupAnimatedFigure(gltf, pose, count) {
  const root = gltf.scene;
  let mesh = null;
  root.traverse((o) => {
    if (o.isSkinnedMesh && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) {
      mesh = o;
    }
  });
  if (!mesh) return null;
  for (const [name, x, y, z] of pose) {
    const b = root.getObjectByName(name);
    if (!b) return null;
    b.rotation.x += x; b.rotation.y += y; b.rotation.z += z;
  }
  const rig = {}, rest = {};
  root.traverse((o) => { if (o.isBone) { rig[o.name] = o; rest[o.name] = o.rotation.clone(); } });
  root.updateMatrixWorld(true);
  mesh.skeleton.update();

  // area-weighted triangle sampling (positions evaluated per frame)
  const posAttr = mesh.geometry.attributes.position;
  const idx = mesh.geometry.index ? mesh.geometry.index.array : null;
  const triCount = (idx ? idx.length : posAttr.count) / 3;
  const vi = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const cum = new Float64Array(triCount);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    A.fromBufferAttribute(posAttr, vi(t, 0));
    B.fromBufferAttribute(posAttr, vi(t, 1));
    C.fromBufferAttribute(posAttr, vi(t, 2));
    ab.subVectors(B, A); ac.subVectors(C, A);
    total += ab.cross(ac).length() / 2;
    cum[t] = total;
  }
  if (!total) return null;

  // unique skinned vertices shared across samples (skin each once per frame)
  const corners = new Int32Array(count * 3);
  const bu = new Float32Array(count), bv = new Float32Array(count), bw = new Float32Array(count);
  const slotOf = new Map();
  for (let i = 0; i < count; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; cum[mid] < r ? (lo = mid + 1) : (hi = mid); }
    const r1 = Math.sqrt(Math.random()), r2 = Math.random();
    bu[i] = 1 - r1; bv[i] = r1 * (1 - r2); bw[i] = r1 * r2;
    for (let c = 0; c < 3; c++) {
      const vid = vi(lo, c);
      if (!slotOf.has(vid)) slotOf.set(vid, slotOf.size);
      corners[i * 3 + c] = slotOf.get(vid);
    }
  }
  const uVerts = new Int32Array(slotOf.size);
  for (const [vid, slot] of slotOf) uVerts[slot] = vid;
  const scratch = new Float32Array(slotOf.size * 3);
  const hipsB = root.getObjectByName("mixamorigHips");
  const v = new THREE.Vector3(), hp = new THREE.Vector3();

  const fig = {
    h: 1,
    pose(name, dx, dy, dz) {
      const b = rig[name], r0 = rest[name];
      if (b && r0) b.rotation.set(r0.x + dx, r0.y + dy, r0.z + dz);
    },
    refresh() {
      root.updateMatrixWorld(true);
      mesh.skeleton.update();
    },
    skinInto(out) {
      hipsB.getWorldPosition(hp);
      for (let s = 0; s < uVerts.length; s++) {
        v.fromBufferAttribute(posAttr, uVerts[s]);
        mesh.applyBoneTransform(uVerts[s], v);
        v.applyMatrix4(mesh.matrixWorld);
        scratch[s * 3] = v.x; scratch[s * 3 + 1] = v.y; scratch[s * 3 + 2] = v.z;
      }
      for (let i = 0; i < count; i++) {
        const a3 = corners[i * 3] * 3, b3 = corners[i * 3 + 1] * 3, c3 = corners[i * 3 + 2] * 3;
        out[i * 3] = scratch[a3] * bu[i] + scratch[b3] * bv[i] + scratch[c3] * bw[i] - hp.x;
        out[i * 3 + 1] = scratch[a3 + 1] * bu[i] + scratch[b3 + 1] * bv[i] + scratch[c3 + 1] * bw[i] - hp.y;
        out[i * 3 + 2] = scratch[a3 + 2] * bu[i] + scratch[b3 + 2] * bv[i] + scratch[c3 + 2] * bw[i] - hp.z;
      }
    },
    hand(name) {
      const b = root.getObjectByName(name);
      hipsB.getWorldPosition(hp);
      const p = new THREE.Vector3();
      b.getWorldPosition(p);
      return [p.x - hp.x, p.y - hp.y, p.z - hp.z];
    },
  };

  // measure rest height
  const tmp = new Float32Array(count * 3);
  fig.skinInto(tmp);
  let mn = Infinity, mx = -Infinity;
  for (let i = 1; i < tmp.length; i += 3) {
    if (tmp[i] < mn) mn = tmp[i];
    if (tmp[i] > mx) mx = tmp[i];
  }
  fig.h = mx - mn;
  fig.minY = mn;
  return fig;
}

/* Procedural crouched jockey, built from capsule segments. Coordinates are
   fractions of the horse's height (u); forward = -x (the horse runs left).
   Origin sits at the saddle anchor point on the horse's back. */
function makeRiderOffsets(u) {
  const k = u * 0.55;
  const S = [
    { a: [0, 0.02, 0], b: [-0.22, 0.34, 0], r: 0.09, w: 0.32 },        // torso, crouched forward
    { a: [-0.27, 0.42, 0], b: [-0.28, 0.44, 0], r: 0.09, w: 0.14 },    // head, tucked low
    { a: [-0.20, 0.30, 0.07], b: [-0.46, 0.06, 0.09], r: 0.04, w: 0.10 },   // arm L (reins)
    { a: [-0.20, 0.30, -0.07], b: [-0.46, 0.06, -0.09], r: 0.04, w: 0.10 }, // arm R
    { a: [0, 0.02, 0.12], b: [-0.13, -0.18, 0.15], r: 0.055, w: 0.09 },     // thigh L
    { a: [0, 0.02, -0.12], b: [-0.13, -0.18, -0.15], r: 0.055, w: 0.09 },   // thigh R
    { a: [-0.13, -0.18, 0.15], b: [-0.02, -0.40, 0.16], r: 0.045, w: 0.08 },// shin L
    { a: [-0.13, -0.18, -0.15], b: [-0.02, -0.40, -0.16], r: 0.045, w: 0.08 },// shin R
  ];
  let acc = 0;
  const cums = S.map((s) => (acc += s.w));
  const arr = new Float32Array(RIDER_COUNT * 3);
  for (let i = 0; i < RIDER_COUNT; i++) {
    const r = Math.random() * acc;
    const s = S[cums.findIndex((c) => r <= c)];
    const t = Math.random();
    for (let c = 0; c < 3; c++) {
      let val =
        (s.a[c] + (s.b[c] - s.a[c]) * t + (Math.random() - 0.5) * 2 * s.r) * k;
      if (c === 0) val = -val; // the horse gallops toward +x; lean with it
      arr[i * 3 + c] = val;
    }
    arr[i * 3 + 1] -= 0.08 * k; // sink the hips onto the back
  }
  return arr;
}

function makeSphere() {
  const arr = new Float32Array(COUNT * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    arr[i * 3] = Math.cos(theta) * r * RADIUS;
    arr[i * 3 + 1] = y * RADIUS;
    arr[i * 3 + 2] = Math.sin(theta) * r * RADIUS;
  }
  return arr;
}

/* Sample land pixels from the equirectangular earth texture and project
   them onto a sphere, so the particles draw the continents. */
function makeGlobe(img) {
  const W = 360, H = 180;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.drawImage(img, 0, 0, W, H);
  const data = cx.getImageData(0, 0, W, H).data;

  const land = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isOcean = (b > r * 1.12 && b > 28) || r + g + b < 50;
      if (!isOcean) land.push(x, y);
    }
  }
  if (land.length < 200) return null; // classification failed — keep plain sphere

  const arr = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    // rejection-sample by cos(lat) so poles aren't oversampled
    let px, py, lat;
    for (let tries = 0; tries < 12; tries++) {
      const k = (Math.random() * (land.length / 2)) | 0;
      px = land[k * 2] + Math.random() - 0.5;
      py = land[k * 2 + 1] + Math.random() - 0.5;
      lat = Math.PI * (0.5 - py / H);
      if (Math.random() < Math.cos(lat)) break;
    }
    const lon = (px / W) * Math.PI * 2 - Math.PI;
    const R = RADIUS * (1 + (Math.random() - 0.5) * 0.02);
    arr[i * 3] = R * Math.cos(lat) * Math.cos(lon);
    arr[i * 3 + 1] = R * Math.sin(lat);
    arr[i * 3 + 2] = -R * Math.cos(lat) * Math.sin(lon);
  }
  return arr;
}

function makeTorusKnot() {
  const arr = new Float32Array(COUNT * 3);
  const p = 2, q = 3, scale = 0.78;
  for (let i = 0; i < COUNT; i++) {
    const t = (i / COUNT) * Math.PI * 2;
    const r = Math.cos(q * t) + 2;
    const jx = (Math.random() - 0.5) * 0.22;
    const jy = (Math.random() - 0.5) * 0.22;
    const jz = (Math.random() - 0.5) * 0.22;
    arr[i * 3] = (r * Math.cos(p * t)) * scale + jx;
    arr[i * 3 + 1] = (r * Math.sin(p * t)) * scale + jy;
    arr[i * 3 + 2] = -Math.sin(q * t) * scale * 1.6 + jz;
  }
  return arr;
}

function makeGalaxy() {
  const arr = new Float32Array(COUNT * 3);
  const ARMS = 3;
  for (let i = 0; i < COUNT; i++) {
    const arm = i % ARMS;
    const rad = Math.pow(Math.random(), 0.6) * RADIUS * 1.25;
    const spin = rad * 1.9;
    const angle = (arm / ARMS) * Math.PI * 2 + spin + (Math.random() - 0.5) * 0.45;
    const lift = (Math.random() - 0.5) * (1 - rad / (RADIUS * 1.25)) * 0.9;
    arr[i * 3] = Math.cos(angle) * rad;
    arr[i * 3 + 1] = lift;
    arr[i * 3 + 2] = Math.sin(angle) * rad;
  }
  return arr;
}

/* Rasterize a drawing (emoji silhouettes) and turn its opaque pixels into
   a thin 3D slab of particles. Falls back if nothing rendered. */
function makeFromCanvas(draw, fallback) {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  draw(ctx, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  const pts = [];
  for (let y = 0; y < S; y += 2) {
    for (let x = 0; x < S; x += 2) {
      if (data[(y * S + x) * 4 + 3] > 120) pts.push(x, y);
    }
  }
  if (pts.length < 200) return fallback();
  const arr = new Float32Array(COUNT * 3);
  const scale = 6.2 / S;
  for (let i = 0; i < COUNT; i++) {
    const k = ((Math.random() * pts.length) / 2 | 0) * 2;
    const px = pts[k] + (Math.random() - 0.5) * 2;
    const py = pts[k + 1] + (Math.random() - 0.5) * 2;
    arr[i * 3] = (px - S / 2) * scale;
    arr[i * 3 + 1] = (S / 2 - py) * scale;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.42;
  }
  return arr;
}

const drawEmoji = (ctx, emoji, x, y, size) => {
  ctx.font = `${size}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, x, y);
};

const makeSnowboarder = () =>
  makeFromCanvas((ctx, S) => drawEmoji(ctx, "🏂", S / 2, S / 2, S * 0.78), makeTorusKnot);

const makeHorseRider = () =>
  makeFromCanvas((ctx, S) => drawEmoji(ctx, "🏇", S / 2, S / 2, S * 0.8), makeGalaxy);

const makeLaptop = () =>
  makeFromCanvas((ctx, S) => drawEmoji(ctx, "💻", S / 2, S / 2, S * 0.78), makeTorusKnot);

const smoothstep = (t) => t * t * (3 - 2 * t);

/* Scroll ranges where each shape holds FULLY FORMED (plateaus).
   Between ranges the particles transition. Tuned to the page sections:
   globe = hero, horse = about, snowboarder = stack/partners,
   MacBook = contact. */
const FORMED = [
  [0.0, 0.08],  // Earth globe
  [0.20, 0.42], // horse rider
  [0.54, 0.74], // snowboarder
  [0.86, 1.01], // MacBook
];

function shapeBlend(p) {
  for (let i = 0; i < FORMED.length; i++) {
    const [start, end] = FORMED[i];
    if (p <= end) {
      if (p >= start || i === 0) return [i, 0];
      const prevEnd = FORMED[i - 1][1];
      return [i - 1, smoothstep((p - prevEnd) / (start - prevEnd))];
    }
  }
  return [FORMED.length - 1, 0];
}

export default function MorphField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    THREE.Cache.enabled = true; // rider.glb is parsed twice (jockey, snowboarder fallback)
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    camera.position.z = 7;

    const shapes = [makeSphere(), makeHorseRider(), makeSnowboarder(), makeLaptop()];

    // upgrade the plain sphere to the Earth globe once the texture loads —
    // particles visibly drift from the sphere into the continents
    const earthImg = new Image();
    earthImg.src = import.meta.env.BASE_URL + "earth.jpg";
    earthImg.onload = () => {
      const globe = makeGlobe(earthImg);
      if (globe) shapes[0] = globe;
    };

    /* ---- real 3D animated horse (morph-target glTF) ----
       We sample fixed points on the mesh surface once (area-weighted, with
       barycentric coords), then every frame evaluate the animated vertex
       positions and move the same samples — the particle cloud becomes a
       genuinely galloping 3D horse. Until it loads, the emoji silhouette
       stays as the morph target. */
    let horse = null; // { mixer, mesh, basePos, morphArrays, samples, center, scale }
    const HORSE_ROT_Y = Math.PI / 2; // side profile toward the camera

    new GLTFLoader().load(import.meta.env.BASE_URL + "horse.glb", (gltf) => {
      let mesh = null;
      gltf.scene.traverse((o) => {
        if (!mesh && o.isMesh && o.morphTargetInfluences) mesh = o;
      });
      if (!mesh || !gltf.animations.length) return;

      const geom = mesh.geometry;
      const posAttr = geom.attributes.position;
      const idx = geom.index ? geom.index.array : null;
      const triCount = (idx ? idx.length : posAttr.count) / 3;
      const vi = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);

      // area-weighted triangle sampling so particle density is even
      const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
      const ab = new THREE.Vector3(), ac = new THREE.Vector3();
      const cum = new Float64Array(triCount);
      let total = 0;
      for (let t = 0; t < triCount; t++) {
        vA.fromBufferAttribute(posAttr, vi(t, 0));
        vB.fromBufferAttribute(posAttr, vi(t, 1));
        vC.fromBufferAttribute(posAttr, vi(t, 2));
        ab.subVectors(vB, vA);
        ac.subVectors(vC, vA);
        total += ab.cross(ac).length() / 2;
        cum[t] = total;
      }
      const samples = { ia: new Int32Array(HORSE_SAMPLES), ib: new Int32Array(HORSE_SAMPLES), ic: new Int32Array(HORSE_SAMPLES),
                        u: new Float32Array(HORSE_SAMPLES), v: new Float32Array(HORSE_SAMPLES), w: new Float32Array(HORSE_SAMPLES) };
      for (let i = 0; i < HORSE_SAMPLES; i++) {
        const r = Math.random() * total;
        let lo = 0, hi = triCount - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; cum[mid] < r ? (lo = mid + 1) : (hi = mid); }
        const r1 = Math.sqrt(Math.random()), r2 = Math.random();
        samples.ia[i] = vi(lo, 0); samples.ib[i] = vi(lo, 1); samples.ic[i] = vi(lo, 2);
        samples.u[i] = 1 - r1; samples.v[i] = r1 * (1 - r2); samples.w[i] = r1 * r2;
      }

      // robust normalization: stray vertices inflate the raw bounding box,
      // so measure 2nd–98th percentile bounds of the sampled surface points
      const bp = posAttr.array;
      const xs = new Float32Array(HORSE_SAMPLES), ys = new Float32Array(HORSE_SAMPLES), zs = new Float32Array(HORSE_SAMPLES);
      for (let i = 0; i < HORSE_SAMPLES; i++) {
        const ja = samples.ia[i] * 3, jb = samples.ib[i] * 3, jc = samples.ic[i] * 3;
        const u = samples.u[i], v = samples.v[i], w = samples.w[i];
        xs[i] = bp[ja] * u + bp[jb] * v + bp[jc] * w;
        ys[i] = bp[ja + 1] * u + bp[jb + 1] * v + bp[jc + 1] * w;
        zs[i] = bp[ja + 2] * u + bp[jb + 2] * v + bp[jc + 2] * w;
      }
      const robust = (arr) => {
        const s = Float32Array.from(arr).sort();
        return [s[(s.length * 0.02) | 0], s[(s.length * 0.98) | 0]];
      };
      const [x0, x1] = robust(xs), [y0, y1] = robust(ys), [z0, z1] = robust(zs);
      const center = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      const scale = 5.6 / Math.max(x1 - x0, y1 - y0, z1 - z0);

      // saddle anchor: highest surface point in the middle band of the body
      // (along whichever horizontal axis is the horse's length)
      const lenArr = z1 - z0 >= x1 - x0 ? zs : xs;
      const [l0, l1] = z1 - z0 >= x1 - x0 ? [z0, z1] : [x0, x1];
      // saddle = topmost surface point at the exact middle of the body —
      // a wide band would snap to the withers (the back rises toward them)
      let saddle = 0, saddleY = -Infinity, withers = 0, withersY = -Infinity;
      for (let i = 0; i < HORSE_SAMPLES; i++) {
        const f01 = (lenArr[i] - l0) / (l1 - l0);
        if (Math.abs(f01 - 0.5) < 0.04 && ys[i] > saddleY) { saddleY = ys[i]; saddle = i; }
        if (f01 > 0.66 && f01 < 0.80 && ys[i] > withersY) { withersY = ys[i]; withers = i; }
      }
      const riderLocal = makeRiderOffsets((y1 - y0) * scale);

      const mixer = new THREE.AnimationMixer(mesh);
      mixer.clipAction(gltf.animations[0]).play();

      const live = new Float32Array(shapes[1]); // start from current silhouette
      shapes[1] = live;
      horse = {
        mixer, mesh, live, samples, center, scale, saddle, withers, riderLocal,
        basePos: posAttr.array,
        morphArrays: (geom.morphAttributes.position || []).map((a) => a.array),
        cos: Math.cos(HORSE_ROT_Y), sin: Math.sin(HORSE_ROT_Y),
      };

      // upgrade the capsule jockey to a real posed humanoid (rigged mesh)
      const horseH = (y1 - y0) * scale;
      new GLTFLoader().load(import.meta.env.BASE_URL + "rider.glb", (g2) => {
        try {
          const ridden = buildRiderFromModel(g2, horseH);
          if (ridden && horse) horse.riderLocal = ridden;
        } catch {
          /* keep the procedural rider */
        }
      });
    });

    // live-animated snowboarder — skeleton driven every frame
    let snowAnim = null;
    const sportLoader = new GLTFLoader();

    // MacBook finale (Ranguel, CC-BY): static model, sampled once —
    // the emoji silhouette stays as the target until it loads.
    // Density boosts per material make the design touches read: the Apple
    // logo, the keycap grid, touchpad, camera notch, speaker grilles and
    // side ports glow denser than the plain aluminum chassis.
    const MAC_DETAIL = {
      Apple_logo: 60,
      Keycap: 9,
      Keycap_transparent_plastic: 9,
      Touchpad_glass: 4,
      Speaker_mesh: 4,
      Camera_frame: 8,
      Camera_lens: 8,
      Display_frame: 4,
      USBC_port: 3,
      Magsafe_port: 3,
      Gold_pads: 0,    // internal hardware — noise inside the slab
      Steel_sheet: 0,
      Jack_port: 0,
    };
    sportLoader.load(import.meta.env.BASE_URL + "macbook/scene.gltf", (g) => {
      try {
        const mac = sampleStaticModel(g, COUNT, (m) => MAC_DETAIL[m.material?.name] ?? 1);
        if (mac) shapes[3] = mac;
      } catch { /* keep the emoji silhouette */ }
    });

    // snowboarder: real animated character (Onirix, CC-BY) with carve clips;
    // falls back to the posed humanoid if the model is missing
    let snowClip = null;
    sportLoader.load(import.meta.env.BASE_URL + "snowboarder/scene.gltf", (g) => {
      try {
        const fig = setupClipFigure(g, COUNT);
        if (!fig) return;
        const byName = (n) => fig.clips.find((c) => c.name === n);
        const left = byName("Turn_Left") || fig.clips[0];
        const right = byName("Turn_Right") || left;
        const aL = fig.mixer.clipAction(left), aR = fig.mixer.clipAction(right);
        fig.mixer.timeScale = 0.5; // relaxed carve, paced like the horse
        aL.play();
        snowClip = {
          fig, aL, aR, current: aL, lastSwitch: 0,
          live: new Float32Array(shapes[2]), fit: null,
        };
        shapes[2] = snowClip.live;
      } catch { /* fall back below */ }
    }, undefined, () => {
      // model missing — keep the procedural skeletal snowboarder
      sportLoader.load(import.meta.env.BASE_URL + "rider.glb", (g) => {
        try {
          const fig = setupAnimatedFigure(g, SNOW_POSE, SNOW_HUMAN);
          if (!fig) return;
          const board = new Float32Array(SNOW_BOARD * 3);
          for (let i = 0; i < SNOW_BOARD; i++) {
            const x = (Math.random() - 0.5) * 3.6;
            board[i * 3] = x;
            board[i * 3 + 1] = Math.pow(Math.abs(x) / 1.8, 4) * 0.4 + (Math.random() - 0.5) * 0.09;
            board[i * 3 + 2] = (Math.random() - 0.5) * 0.46;
          }
          const live = new Float32Array(shapes[2]);
          snowAnim = {
            fig, s: 3.2 / fig.h, board,
            buf: new Float32Array(SNOW_HUMAN * 3), live, fit: null,
          };
          shapes[2] = live;
        } catch { /* keep the emoji silhouette */ }
      });
    });

    /* real snowboarder: plays Turn_Left / Turn_Right mocap clips,
       crossfading between carves every few seconds */
    const tickSnowClip = (time, dt) => {
      const sc = snowClip;
      if (!sc.lastSwitch) sc.lastSwitch = time;
      if (time - sc.lastSwitch > 4) {
        const next = sc.current === sc.aL ? sc.aR : sc.aL;
        next.reset().play();
        sc.current.crossFadeTo(next, 0.7, false);
        sc.current = next;
        sc.lastSwitch = time;
      }
      sc.fig.mixer.update(dt);
      sc.fig.evalInto(sc.live);
      // the turn clips carry root motion — re-center on the live centroid
      // every frame so the figure stays on stage; scale locks on first frame
      const live = sc.live;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < live.length; i += 3) { cx += live[i]; cy += live[i + 1]; cz += live[i + 2]; }
      const inv = 3 / live.length;
      cx *= inv; cy *= inv; cz *= inv;
      if (!sc.fit) {
        // robust HEIGHT (2nd–98th percentile of y) drives the scale —
        // torso-heavy density makes radius-based metrics undersize the figure
        const ys = new Float32Array(live.length / 3);
        for (let i = 1, j = 0; i < live.length; i += 3, j++) ys[j] = live[i];
        ys.sort();
        const h = ys[(ys.length * 0.98) | 0] - ys[(ys.length * 0.02) | 0];
        sc.fit = { fs: 4.2 / Math.max(h, 1e-6) };
      }
      // the model travels along its z axis — yaw 90° into side profile
      const fs = sc.fit.fs;
      for (let i = 0; i < live.length; i += 3) {
        const px = live[i] - cx, py = live[i + 1] - cy, pz = live[i + 2] - cz;
        live[i] = pz * fs;
        live[i + 1] = py * fs;
        live[i + 2] = -px * fs;
      }
    };

    const lockFit = (anim, margin) => {
      const live = anim.live;
      let nx = Infinity, ny = Infinity, mx = -Infinity, my = -Infinity;
      for (let i = 0; i < live.length; i += 3) {
        nx = Math.min(nx, live[i]); mx = Math.max(mx, live[i]);
        ny = Math.min(ny, live[i + 1]); my = Math.max(my, live[i + 1]);
      }
      const fs = (6.2 / Math.max(mx - nx, my - ny, 1e-6)) * margin;
      anim.fit = { cx: (nx + mx) / 2, cy: (ny + my) / 2, fs };
    };
    const applyFit = (anim) => {
      const { cx, cy, fs } = anim.fit, live = anim.live;
      for (let i = 0; i < live.length; i += 3) {
        live[i] = (live[i] - cx) * fs;
        live[i + 1] = (live[i + 1] - cy) * fs;
        live[i + 2] = live[i + 2] * fs;
      }
    };

    /* snowboarder: carves edge to edge — body banks, knees pump,
       torso counter-rotates, the board stays glued to his feet */
    const tickSnow = (time) => {
      const sa = snowAnim;
      if (!sa) return;
      const { fig, s, live } = sa;
      const ph = Math.sin(time * 1.4);
      fig.pose("mixamorigSpine", 0.08 * ph, 0.2 * ph, 0);
      fig.pose("mixamorigSpine1", 0.05 * ph, 0.12 * ph, 0);
      fig.pose("mixamorigLeftLeg", 0.25 * Math.max(ph, 0), 0, 0);
      fig.pose("mixamorigRightLeg", 0.25 * Math.max(-ph, 0), 0, 0);
      fig.pose("mixamorigLeftArm", 0, 0, -0.12 * ph);
      fig.pose("mixamorigRightArm", 0, 0, -0.12 * ph);
      fig.refresh();
      fig.skinInto(sa.buf);

      const lean = -0.05 + 0.3 * ph, lc = Math.cos(lean), ls = Math.sin(lean);
      const bob = 0.12 * Math.cos(time * 2.8);
      let n = 0;
      for (let i = 0; i < SNOW_HUMAN; i++, n++) {
        const x = sa.buf[i * 3] * s, y = sa.buf[i * 3 + 1] * s;
        live[n * 3] = x * lc - y * ls;
        live[n * 3 + 1] = x * ls + y * lc + bob;
        live[n * 3 + 2] = sa.buf[i * 3 + 2] * s;
      }
      const footY = fig.minY * s - 0.14;
      for (let i = 0; i < SNOW_BOARD; i++, n++) {
        const x = sa.board[i * 3], y = footY + sa.board[i * 3 + 1];
        live[n * 3] = x * lc - y * ls;
        live[n * 3 + 1] = x * ls + y * lc + bob;
        live[n * 3 + 2] = sa.board[i * 3 + 2];
      }
      if (!sa.fit) lockFit(sa, 0.9);
      applyFit(sa);
    };

    const updateHorse = (dt) => {
      if (!horse) return;
      horse.mixer.update(dt);
      const inf = horse.mesh.morphTargetInfluences;
      const active = [];
      for (let k = 0; k < inf.length; k++) if (inf[k] > 0.001) active.push(k);
      const { live, samples, basePos, morphArrays, center, scale, cos, sin } = horse;
      for (let i = 0; i < HORSE_SAMPLES; i++) {
        let x = 0, y = 0, z = 0;
        for (let c = 0; c < 3; c++) {
          const vIdx = c === 0 ? samples.ia[i] : c === 1 ? samples.ib[i] : samples.ic[i];
          const bw = c === 0 ? samples.u[i] : c === 1 ? samples.v[i] : samples.w[i];
          const j = vIdx * 3;
          let vx = basePos[j], vy = basePos[j + 1], vz = basePos[j + 2];
          for (let m = 0; m < active.length; m++) {
            const k = active[m], arr = morphArrays[k], w = inf[k];
            vx += arr[j] * w; vy += arr[j + 1] * w; vz += arr[j + 2] * w;
          }
          x += vx * bw; y += vy * bw; z += vz * bw;
        }
        x = (x - center.x) * scale; y = (y - center.y) * scale; z = (z - center.z) * scale;
        const k3 = i * 3;
        live[k3] = x * cos + z * sin;
        live[k3 + 1] = y;
        live[k3 + 2] = -x * sin + z * cos;
      }
      // jockey rides the saddle anchor; he pitches with the slope of the
      // horse's back (saddle → withers) so he rocks naturally with the gallop
      const sj = horse.saddle * 3, wj = horse.withers * 3;
      const sx = live[sj], sy = live[sj + 1], sz = live[sj + 2];
      let dx = live[wj] - sx, dy = live[wj + 1] - sy;
      if (dx < 0) { dx = -dx; dy = -dy; }
      const pitch = Math.atan2(dy, dx) * 0.35; // softened lean
      const pc = Math.cos(pitch), ps = Math.sin(pitch);
      const rl = horse.riderLocal;
      for (let r = 0; r < RIDER_COUNT; r++) {
        const o = (HORSE_SAMPLES + r) * 3, j = r * 3;
        const ox = rl[j], oy = rl[j + 1];
        live[o] = sx + ox * pc - oy * ps;
        live[o + 1] = sy + ox * ps + oy * pc;
        live[o + 2] = sz + rl[j + 2];
      }
    };

    const positions = new Float32Array(shapes[0]);
    const colors = new Float32Array(COUNT * 3);
    const cyan = new THREE.Color("#00e5ff");
    const violet = new THREE.Color("#8b5cf6");
    const magenta = new THREE.Color("#f0abfc");
    const tmp = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const f = i / COUNT;
      if (f < 0.5) tmp.lerpColors(cyan, violet, f * 2);
      else tmp.lerpColors(violet, magenta, (f - 0.5) * 2);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // soft round glow sprite for each particle
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = spriteCanvas.height = 64;
    const sctx = spriteCanvas.getContext("2d");
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(spriteCanvas);

    const mat = new THREE.PointsMaterial({
      size: 0.085,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.rotation.x = 0.25;
    scene.add(points);

    // theme-aware particles: additive glow on dark, solid (darkened) on light
    // so the shapes stay visible against a bright background
    const applyTheme = (t) => {
      const light = t === "light";
      mat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      mat.opacity = light ? 0.95 : 0.8;
      mat.color.setRGB(light ? 0.42 : 1, light ? 0.38 : 1, light ? 0.62 : 1);
      mat.needsUpdate = true;
    };
    applyTheme(document.documentElement.dataset.theme || "dark");
    const onThemeChange = (e) => applyTheme(e.detail);
    addEventListener("themechange", onThemeChange);

    let mx = 0, my = 0;
    const onMouse = (e) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
    };

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      // shrink the whole particle field on narrow screens so figures
      // (max dim ~6.6 units) always fit the visible width
      const visibleW = 2 * camera.position.z * Math.tan(Math.PI / 6) * camera.aspect;
      points.scale.setScalar(Math.min(1, (visibleW * 0.92) / 6.6));
    };

    addEventListener("mousemove", onMouse, { passive: true });
    addEventListener("resize", onResize);
    onResize();

    let raf;
    const pos = geo.attributes.position.array;
    let lastT = performance.now();
    let yBase = null; // fixed rotation base while inside the sport zone

    const frame = () => {
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      // scroll progress drives which shape the cloud is morphing toward
      const max = document.documentElement.scrollHeight - innerHeight;
      const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      const [i0, f] = shapeBlend(progress);
      const a = shapes[i0], b = shapes[Math.min(i0 + 1, shapes.length - 1)];

      // advance whichever figure is visible; track the moving target tightly
      // while it is formed (loose lerp would smear the motion)
      const wHorse = i0 === 1 ? 1 - f : i0 === 0 ? f : 0;
      const wSnow = i0 === 2 ? 1 - f : i0 === 1 ? f : 0;
      const wMac = i0 === 3 ? 1 : i0 === 2 ? f : 0;
      const tSec = now * 0.001;
      if (wHorse > 0.01) updateHorse(dt);
      if (wSnow > 0.01) (snowClip ? tickSnowClip(tSec, dt) : tickSnow(tSec));
      const k = 0.07 + 0.3 * Math.max(wHorse, wSnow);

      for (let i = 0; i < pos.length; i++) {
        const target = a[i] + (b[i] - a[i]) * f;
        pos[i] += (target - pos[i]) * k;
      }
      geo.attributes.position.needsUpdate = true;

      // globe spins freely; sport silhouettes settle facing the camera with a sway
      const sportZone = progress > 0.16;
      if (sportZone) {
        const TWO_PI = Math.PI * 2;
        // capture the rotation base ONCE on entering the zone — re-rounding
        // it every frame near a half-turn boundary made the figure spin forever
        if (yBase === null) yBase = Math.round(points.rotation.y / TWO_PI) * TWO_PI;
        const sway = Math.sin(performance.now() * 0.0006) * 0.22 + mx * 0.5;
        // scroll-linked turntable: each figure does a full 3D revolution
        // across its plateau, settling in its hero view mid-way
        const spin =
          (wHorse * ((progress - 0.31) / 0.22) +
            wSnow * ((progress - 0.64) / 0.20) +
            wMac * ((progress - 0.935) / 0.15)) * TWO_PI;
        points.rotation.y += (yBase + sway + spin - points.rotation.y) * 0.05;
      } else {
        yBase = null;
        points.rotation.y += 0.0014;
      }
      // product-shot tilt while the MacBook is formed: look slightly down
      // onto the deck so the keyboard, touchpad and logo read during the spin
      const baseTilt = sportZone ? wMac * 0.3 : 0.25;
      const tiltStrength = 0.55; // mouse tilt reacts the same on every figure
      points.rotation.x += (baseTilt + my * tiltStrength - points.rotation.x) * 0.04;
      camera.position.x += (mx * 1.6 - camera.position.x) * 0.04;
      camera.position.y += (-my * 0.9 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      renderer.render(scene, camera);
    } else {
      frame();
    }

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("mousemove", onMouse);
      removeEventListener("resize", onResize);
      removeEventListener("themechange", onThemeChange);
      geo.dispose();
      mat.dispose();
      sprite.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} id="particles" aria-hidden="true" />;
}
