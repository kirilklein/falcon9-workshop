export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const hash = s => { let h = 5381; for (const c of s) h = (h * 33 + c.codePointAt(0)) >>> 0; return h.toString(36); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Critically damped spring (velocity kept on the object), so a goal can change
// at any moment and the motion continues smoothly from where it is.
export function damp(obj, key, target, smoothTime, dt) {
  const vk = '_v_' + key;
  const v = obj[vk] || 0;
  const o = 2 / smoothTime, x = o * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = obj[key] - target;
  const tmp = (v + o * ch) * dt;
  obj[vk] = (v - o * tmp) * e;
  obj[key] = target + (ch + tmp) * e;
}

// Monotone cubic keyframe track: keys = [[t, value], ...]
export function track(keys) {
  const n = keys.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] > 0 ? (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]) : 0;
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (t > keys[i + 1][0]) i++;
    const h = keys[i + 1][0] - keys[i][0], s = (t - keys[i][0]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * keys[i][1] + (s3 - 2 * s2 + s) * h * m[i] +
      (-2 * s3 + 3 * s2) * keys[i + 1][1] + (s3 - s2) * h * m[i + 1];
  };
}
