import { useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
//  Volume sampling clouds — Huw Bowles & Daniel Zimmermann
//  https://www.shadertoy.com/view/XdfXzn  |  MIT License
//
//  Adapted for WebGL2 / GLSL ES 3.00.
//  Bug fixes vs. original ShaderToy:
//   1. firstT() read `t` before writing it (out param = UB in GLSL ES 3.00).
//      Fixed: use 0.0 explicitly as the ray-start offset for forward-pinning.
//   2. Noise LUT: G channel = R shifted by (-37,-17) so z-slice interpolation
//      is C0 continuous (mix(G,R,f.z) lands on the correct next slice value).
// ─────────────────────────────────────────────────────────────────────────────

const VS = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FS = `#version 300 es
precision highp float;

#define SAMPLE_COUNT 28
#define DIST_MAX     128.0
#define ADAPTIVITY   0.2

uniform vec3      iResolution;
uniform float     iTime;
uniform vec4      iMouse;
uniform sampler2D iChannel0;

out vec4 fragColor;

// ── Globals set in main(), read by helpers ────────────────────────────────
bool  useNewApproach   = true;
vec3  lookDir          = vec3(-1.0, 0.0, 0.0);
vec3  camVel           = vec3(-0.8, 0.0, 0.0);
float samplesCurvature = 0.0;
// Pre-computed normalize(-1,0,-1)
vec3  sundir = vec3(-0.70710678118, 0.0, -0.70710678118);

// ── LUT-based 3D value noise ──────────────────────────────────────────────
// iChannel0 is a 256×256 RGBA texture where:
//   R[x][y] = random value for this (x,y) slot
//   G[x][y] = R[(x−37+256)%256][(y−17+256)%256]   ← next z-slice value
// So mix(G, R, f.z) gives continuous z-interpolation.
float noise(in vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);                     // smoothstep
  vec2 uv = (p.xy + vec2(37.0, 17.0) * p.z) + f.xy;
  vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx; // .yx = (G, R)
  return mix(rg.x, rg.y, f.z);                      // G=cur slice, R=next slice
}

// ── Cloud density + colour ────────────────────────────────────────────────
vec4 map(in vec3 p) {
  float d = 0.1 + 0.8 * sin(0.6 * p.z) * sin(0.5 * p.x) - p.y;
  vec3  q = p;
  float f;
  f  = 0.5000 * noise(q); q = q * 2.02;
  f += 0.2500 * noise(q); q = q * 2.03;
  f += 0.1250 * noise(q); q = q * 2.01;
  f += 0.0625 * noise(q);
  d += 2.75 * f;
  d  = clamp(d, 0.0, 1.0);

  vec4 res = vec4(d);
  vec3 col = 1.15 * vec3(1.0, 0.95, 0.8);
  col += vec3(1.0, 0.0, 0.0) * exp2(res.x * 10.0 - 10.0);
  res.xyz = mix(col, vec3(0.88, 0.87, 0.86), res.x);
  return res;
}

// ── Adaptive sampling ─────────────────────────────────────────────────────
float spacing(float t) {
  t = max(t, 0.0);
  float pdf  = 1.0 / (ADAPTIVITY * t + 1.0);
  float norm = (1.0 / ADAPTIVITY) * log(1.0 + ADAPTIVITY * DIST_MAX);
  pdf /= norm;
  return 1.0 / (float(SAMPLE_COUNT) * pdf);
}

// Forward-pinning: mod that keeps sample positions stationary in world space
float mov_mod(float x, float y) {
  float offset = useNewApproach ? dot(camVel * iTime, lookDir) : 0.0;
  return mod(x + offset, y);
}

bool on_boundary(float x, float y) {
  return mov_mod(x + y * 0.25, y) < y * 0.5;
}

// FIX: original reads t (an out-param) before writing -- UB in GLSL ES 3.00.
// The correct starting offset for forward-pinning is 0.0 (ray start distance).
void firstT(out float t, out float dt, out float wt, out bool even) {
  dt   = exp2(floor(log2(spacing(0.0))));
  t    = dt - mov_mod(0.0, dt);    // ← was mov_mod(t,dt); t was undefined
  even = on_boundary(t, 2.0 * dt);
  wt   = 1.0;
}

void nextT(inout float t, inout float dt, inout float wt, inout bool even) {
  float s = spacing(t);
  if (s < dt) {
    dt /= 2.0; even = true;
  } else if (even && s > 2.0 * dt) {
    dt *= 2.0; wt = 1.0; even = on_boundary(t, 2.0 * dt);
  }
  if (even) wt = clamp(2.0 - s / dt, 0.0, 1.0);
  t   += dt;
  even = !even;
}

float sampleWt(float wt, bool even) {
  return even ? (2.0 - wt) : wt;
}

// ── Volume ray march ──────────────────────────────────────────────────────
vec4 raymarch(in vec3 ro, in vec3 rd) {
  vec4  sum = vec4(0.0);
  float t, dt, wt; bool even;
  firstT(t, dt, wt, even);

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    if (sum.a > 0.99) continue;

    vec3 pos = ro + t * rd;
    vec4 col = map(pos);

    float dif = clamp((col.w - map(pos + 0.6 * sundir).w) / 0.6, 0.0, 1.0);
    vec3  lin = vec3(0.58, 0.60, 0.68) * 1.45 + 0.55 * vec3(0.85, 0.57, 0.3) * dif;
    col.xyz *= lin;
    col.xyz = pow(col.xyz, vec3(1.7));
    col.a   *= 0.35;
    col.rgb *= col.a;

    float fadeout = 1.0 - clamp((t / (DIST_MAX * 0.3) - 0.85) / 0.15, 0.0, 1.0);
    float thisDt  = dt * sampleWt(wt, even);
    thisDt        = sqrt(thisDt / 5.0) * 5.0;
    sum += thisDt * col * (1.0 - sum.a) * fadeout;

    nextT(t, dt, wt, even);
  }

  sum.xyz /= (0.001 + sum.w);
  return clamp(sum, 0.0, 1.0);
}

// ── Sky + sun ─────────────────────────────────────────────────────────────
vec3 sky(vec3 rd) {
  vec3  col  = vec3(0.0);
  float hort = 1.0 - clamp(abs(rd.y), 0.0, 1.0);
  col += 0.50 * vec3(0.99, 0.50, 0.00) * exp2(hort * 8.0  - 8.0);
  col += 0.10 * vec3(0.50, 0.90, 1.00) * exp2(hort * 3.0  - 3.0);
  col += 0.55 * vec3(0.60, 0.60, 0.90);
  float sun = clamp(dot(sundir, rd), 0.0, 1.0);
  col += 0.20 * vec3(1.0,  0.30, 0.20) * pow(sun,   2.0);
  col += 0.50 * vec3(1.0,  0.90, 0.90) * exp2(sun * 650.0 - 650.0);
  col += 0.10 * vec3(1.0,  1.00, 0.10) * exp2(sun * 100.0 - 100.0);
  col += 0.30 * vec3(1.0,  0.70, 0.00) * exp2(sun *  50.0 -  50.0);
  col += 0.50 * vec3(1.0,  0.30, 0.05) * exp2(sun *  10.0 -  10.0);

  // High-freq cloud wisps via noise LUT
  float ax  = atan(rd.y, length(rd.xz));
  float ay  = atan(rd.z, rd.x) * 0.5;
  float st  = texture(iChannel0, vec2(ax, ay)).x;
  float st2 = texture(iChannel0, 0.25 * vec2(ax, ay)).x;
  st *= st2;
  st  = smoothstep(0.65, 0.9, st);
  col = mix(col, col + 1.8 * st, clamp(1.0 - 1.1 * length(col), 0.0, 1.0));
  return col;
}

// ── Entry point ───────────────────────────────────────────────────────────
void main() {
  if (iMouse.z > 0.0) useNewApproach = false;

  vec2 q = gl_FragCoord.xy / iResolution.xy;
  vec2 p = -1.0 + 2.0 * q;
  p.x   *= iResolution.x / iResolution.y;

  vec3 ro = vec3(0.0, 1.9, 0.0) + iTime * camVel;
  vec3 ta = ro + lookDir;
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3 vv = normalize(cross(ww, uu));
  vec3 rd = normalize(p.x * uu + 1.2 * p.y * vv + 1.5 * ww);

  vec3 col = sky(rd);

  vec3 rd_layout = rd / mix(dot(rd, ww), 1.0, samplesCurvature);
  vec4 clouds    = raymarch(ro, rd_layout);
  col = mix(col, clouds.xyz, clouds.w);

  col  = clamp(col, 0.0, 1.0);
  col  = smoothstep(0.0, 1.0, col);
  col *= pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.12); // vignette

  fragColor = vec4(col, 1.0);
}`

// ── WebGL helpers ─────────────────────────────────────────────────────────
function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:\n', gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

function makeProgram(gl, vsSrc, fsSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER,   vsSrc)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc)
  if (!vs || !fs) return null
  const p = gl.createProgram()
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('Program link error:\n', gl.getProgramInfoLog(p))
    return null
  }
  return p
}

// ── RGBA noise LUT — 256×256 ──────────────────────────────────────────────
// The noise() function does 3D value noise via a 2D texture trick:
//   uv = p.xy + vec2(37,17)*floor(p.z) + fract(p.xy) [smoothstepped]
//   rg = texture(uv).yx   →  rg = vec2(G_at_uv, R_at_uv)
//   return mix(G, R, fract(p.z))
//
// For C0 z-continuity at integer z boundaries we need:
//   R[x][y]  =  G[(x+37)%256][(y+17)%256]
// i.e. G[x][y]  =  R[(x−37+256)%256][(y−17+256)%256]
//
// Then as f.z→1: returns R[uv_z]
//      as f.z→0 for z+1: returns G[uv_z+(37,17)] = R[uv_z]  ✓ continuous
function buildNoiseLUT(gl) {
  const SIZE = 256
  const data = new Uint8Array(SIZE * SIZE * 4)

  // R channel: independent random values
  const rnd = new Uint8Array(SIZE * SIZE)
  for (let i = 0; i < rnd.length; i++) rnd[i] = (Math.random() * 256) | 0

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const gx = (x - 37 + SIZE) % SIZE   // G = R shifted by (-37, -17)
      const gy = (y - 17 + SIZE) % SIZE
      const i  = (y * SIZE + x) * 4
      data[i + 0] = rnd[y * SIZE + x]        // R = noise for this z-slice
      data[i + 1] = rnd[gy * SIZE + gx]      // G = noise for PREVIOUS z-slice
      data[i + 2] = (Math.random() * 256) | 0
      data[i + 3] = (Math.random() * 256) | 0
    }
  }

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.generateMipmap(gl.TEXTURE_2D)
  return tex
}

// ── React component ───────────────────────────────────────────────────────
export default function CloudBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return

    const program = makeProgram(gl, VS, FS)
    if (!program) return

    // Fullscreen quad VAO
    const vao    = gl.createVertexArray()
    const buf    = gl.createBuffer()
    const posLoc = gl.getAttribLocation(program, 'aPos')
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // Uniforms
    const uRes   = gl.getUniformLocation(program, 'iResolution')
    const uTime  = gl.getUniformLocation(program, 'iTime')
    const uMouse = gl.getUniformLocation(program, 'iMouse')
    const uCh0   = gl.getUniformLocation(program, 'iChannel0')

    const noiseTex = buildNoiseLUT(gl)

    // Mouse — only track position, never set z (z>0 disables forward-pinning)
    let mx = 0, my = 0
    const onMove = e => { mx = e.clientX; my = e.clientY }
    window.addEventListener('mousemove', onMove)

    // Resize — cap DPR for shader perf
    const resize = () => {
      const dpr   = Math.min(window.devicePixelRatio, 1.25)
      canvas.width  = (window.innerWidth  * dpr) | 0
      canvas.height = (window.innerHeight * dpr) | 0
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    window.addEventListener('resize', resize)
    resize()

    // Render loop
    const start = performance.now()
    let raf
    const render = () => {
      const t   = (performance.now() - start) / 1000
      const dpr = canvas.width / window.innerWidth
      gl.useProgram(program)
      gl.uniform3f(uRes,   canvas.width, canvas.height, 1.0)
      gl.uniform1f(uTime,  t)
      gl.uniform4f(uMouse, mx * dpr, my * dpr, 0, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, noiseTex)
      gl.uniform1i(uCh0, 0)
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        display: 'block',
      }}
    />
  )
}
