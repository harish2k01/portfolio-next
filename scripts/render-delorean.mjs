// Offline, orthographic sprite renderer. No 3D library is shipped to visitors.
// Source model and adaptation credit: THIRD_PARTY_ASSETS.md.
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const file = await fs.readFile(
  new URL("./assets/delorean-source.glb", import.meta.url),
);
const jsonLength = file.readUInt32LE(12);
const model = JSON.parse(file.subarray(20, 20 + jsonLength));
const binary = file.subarray(28 + jsonLength);
const triangles = [];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const unit = (a) => {
  const l = Math.hypot(...a);
  return a.map((v) => v / (l || 1));
};
function accessor(index) {
  const a = model.accessors[index],
    v = model.bufferViews[a.bufferView];
  const length = a.type === "VEC3" ? 3 : 1;
  const bytes = a.componentType === 5126 || a.componentType === 5125 ? 4 : 2;
  const stride = v.byteStride || length * bytes;
  return Array.from({ length: a.count }, (_, i) =>
    Array.from({ length }, (_, k) => {
      const offset =
        (v.byteOffset || 0) + (a.byteOffset || 0) + i * stride + k * bytes;
      return a.componentType === 5126
        ? binary.readFloatLE(offset)
        : bytes === 4
          ? binary.readUInt32LE(offset)
          : binary.readUInt16LE(offset);
    }),
  );
}
function add(a, b, c, color) {
  triangles.push({ p: [a, b, c], color });
}
const palette = (name) =>
  name === "Chasis"
    ? [151, 169, 189]
    : name === "glass"
      ? [37, 57, 81]
      : name === "black"
        ? [25, 33, 46]
        : name.startsWith("tire")
          ? [29, 36, 48]
          : name.startsWith("trim")
            ? [142, 162, 190]
            : name === "Red_lights"
              ? [163, 80, 79]
              : name === "ambar_lights"
                ? [168, 130, 86]
                : [199, 213, 234];
for (const mesh of model.meshes) {
  const bounds = model.accessors[mesh.primitives[0].attributes.POSITION];
  const center = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
  for (const primitive of mesh.primitives) {
    const points = accessor(primitive.attributes.POSITION).map((p) => {
      if (mesh.name.startsWith("Wheel")) {
        const sign = Math.sign(center[0]);
        p = [
          sign * 1.36 - sign * (p[1] - center[1]),
          -0.46 + sign * (p[0] - center[0]),
          p[2],
        ];
      }
      return [p[0], p[1], p[2] - 0.51];
    });
    const indices = accessor(primitive.indices).flat();
    const color = palette(model.materials[primitive.material].name);
    for (let i = 0; i < indices.length; i += 3)
      add(...indices.slice(i, i + 3).map((n) => points[n]), color);
  }
}
function box(x, y, z, w, h, d, color, lean = 0) {
  const points = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ].map(([a, b, c]) => [
    x + (a * w) / 2,
    y + (b * h) / 2,
    z + (c * d) / 2 + (b > 0 ? lean : 0),
  ]);
  for (const face of [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 4, 7, 3],
    [1, 2, 6, 5],
    [3, 7, 6, 2],
    [0, 1, 5, 4],
  ]) {
    add(...face.slice(0, 3).map((n) => points[n]), color);
    add(...[face[0], face[2], face[3]].map((n) => points[n]), color);
  }
}
// Twin cooling vents, rear equipment, Mr. Fusion, and subdued time-circuit rails.
for (const side of [-1, 1]) {
  box(side * 0.72, 0.64, -2.13, 0.5, 0.78, 0.62, [49, 66, 87], -0.15);
  for (let i = 0; i < 4; i++)
    box(
      side * 0.72,
      0.37 + i * 0.16,
      -2.47 - i * 0.03,
      0.43,
      0.055,
      0.04,
      [16, 24, 36],
    );
  box(side * 1.19, 0.16, -0.16, 0.055, 0.07, 3.6, [114, 145, 188]);
  box(side * 1.29, -0.4, 1.6, 0.35, 0.08, 0.13, [103, 122, 146]);
  box(side * 1.29, -0.4, -1.5, 0.35, 0.08, 0.13, [103, 122, 146]);
}
box(0, 0.34, -1.97, 0.85, 0.22, 0.85, [62, 78, 96]);
function cylinder(x, y, z, r, h, color) {
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6;
    const p = [x + Math.cos(a) * r, y - h / 2, z + Math.sin(a) * r],
      q = [x + Math.cos(b) * r, y - h / 2, z + Math.sin(b) * r];
    const t = [p[0], y + h / 2, p[2]],
      u = [q[0], y + h / 2, q[2]];
    add(p, q, t, color);
    add(q, u, t, color);
    add([x, y + h / 2, z], t, u, color);
  }
}
cylinder(0, 0.75, -1.82, 0.17, 0.65, [181, 191, 201]);
cylinder(0, 1.09, -1.82, 0.19, 0.08, [66, 79, 98]);

const W = 144,
  H = 96,
  COLUMNS = 24,
  ROWS = 16,
  COUNT = COLUMNS * ROWS;
const projectionScale = W * (27 / 192);
const elevation = 0.36;
function project([x, y, z], angle) {
  const a = x * Math.cos(angle) + z * Math.sin(angle),
    b = -x * Math.sin(angle) + z * Math.cos(angle);
  return [
    W / 2 + a * projectionScale,
    H * 0.59 -
      (y * Math.cos(elevation) - b * Math.sin(elevation)) * projectionScale,
    y * Math.sin(elevation) + b * Math.cos(elevation),
  ];
}
const frames = [];
for (let frame = 0; frame < COUNT; frame++) {
  const angle = -0.82 + (frame / COUNT) * Math.PI * 2;
  const faces = triangles
    .map(({ p, color }) => {
      const points = p.map((v) => project(v, angle));
      const n = unit(
        cross(sub(points[1], points[0]), sub(points[2], points[0])),
      );
      const light = 0.7 + 0.3 * Math.abs(n[2]);
      return {
        points,
        visible: n[2] < 0,
        depth: points.reduce((s, p) => s + p[2], 0) / 3,
        color: color.map((v) => Math.round(v * light)),
      };
    })
    .filter((face) => face.visible)
    .sort((a, b) => a.depth - b.depth);
  // Depth-buffered rasterization keeps intersecting glass/body and vent surfaces clean.
  const scale = 2,
    width = W * scale,
    height = H * scale;
  const pixels = Buffer.alloc(width * height * 4);
  const depth = new Float32Array(width * height).fill(-Infinity);
  for (const face of faces) {
    const [a, b, c] = face.points.map((p) => [
      p[0] * scale,
      p[1] * scale,
      p[2],
    ]);
    const denominator =
      (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-8) continue;
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))),
      maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))),
      maxY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const u =
          ((b[1] - c[1]) * (x + 0.5 - c[0]) +
            (c[0] - b[0]) * (y + 0.5 - c[1])) /
          denominator;
        const v =
          ((c[1] - a[1]) * (x + 0.5 - c[0]) +
            (a[0] - c[0]) * (y + 0.5 - c[1])) /
          denominator;
        const w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const z = u * a[2] + v * b[2] + w * c[2],
          index = y * width + x;
        if (z <= depth[index]) continue;
        depth[index] = z;
        for (let channel = 0; channel < 3; channel++)
          pixels[index * 4 + channel] = face.color[channel];
        pixels[index * 4 + 3] = 255;
      }
  }
  const image = await sharp(pixels, { raw: { width, height, channels: 4 } })
    .resize(W, H)
    .png()
    .toBuffer();
  frames.push({
    input: image,
    left: (frame % COLUMNS) * W,
    top: Math.floor(frame / COLUMNS) * H,
  });
}
await sharp({
  create: {
    width: W * COLUMNS,
    height: H * ROWS,
    channels: 4,
    background: "#00000000",
  },
})
  .composite(frames)
  .webp({ quality: 80, alphaQuality: 90, effort: 6 })
  .toFile(
    fileURLToPath(
      new URL("../src/assets/delorean-turntable.webp", import.meta.url),
    ),
  );
console.log(
  `Rendered ${COUNT} views into a ${W * COLUMNS}×${H * ROWS} sprite sheet.`,
);
