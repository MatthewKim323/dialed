import { useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
//  Protean Clouds by nimitz (twitter: @stormoid)
//  https://www.shadertoy.com/view/3l23Rh
//  License: CC Attribution-NonCommercial-ShareAlike 3.0
//
//  Adapted for WebGL2 / GLSL ES 3.00.
//  Color scheme modified from rainbow to natural cloud whites & sky blues.
//  Movement slowed for a calm, relaxing atmosphere.
// ─────────────────────────────────────────────────────────────────────────────

const VS = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FS = `#version 300 es
precision highp float;

uniform vec3  iResolution;
uniform float iTime;
uniform vec4  iMouse;

out vec4 fragColor;

// ── Global mutable state (set in main, read in map) ──
float prm1 = 0.0;
vec2  bsMo = vec2(0.0);

mat2 rot(in float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

const mat3 m3 = mat3(
   0.33338,  0.56034, -0.71817,
  -0.87887,  0.32651, -0.15323,
   0.15162,  0.69596,  0.61339
) * 1.93;

float mag2(vec2 p) { return dot(p, p); }
float linstep(in float mn, in float mx, in float x) {
  return clamp((x - mn) / (mx - mn), 0.0, 1.0);
}

vec2 disp(float t) {
  return vec2(sin(t * 0.22) * 1.0, cos(t * 0.175) * 1.0) * 2.0;
}

vec2 map(vec3 p) {
  vec3 p2 = p;
  p2.xy -= disp(p.z).xy;
  p.xy  *= rot(sin(p.z + iTime) * (0.1 + prm1 * 0.05) + iTime * 0.09);
  float cl = mag2(p2.xy);
  float d  = 0.0;
  p       *= 0.61;
  float z      = 1.0;
  float trk    = 1.0;
  float dspAmp = 0.1 + prm1 * 0.2;
  for (int i = 0; i < 5; i++) {
    p   += sin(p.zxy * 0.75 * trk + iTime * trk * 0.8) * dspAmp;
    d   -= abs(dot(cos(p), sin(p.yzx)) * z);
    z   *= 0.57;
    trk *= 1.4;
    p    = p * m3;
  }
  d = abs(d + prm1 * 3.0) + prm1 * 0.3 - 2.5 + bsMo.y;
  return vec2(d + cl * 0.2 + 0.25, cl);
}

vec4 render(in vec3 ro, in vec3 rd, float time) {
  vec4  rez  = vec4(0.0);
  float t    = 1.5;
  float fogT = 0.0;

  for (int i = 0; i < 80; i++) {
    if (rez.a > 0.99) break;

    vec3  pos = ro + t * rd;
    vec2  mpv = map(pos);
    float den = clamp(mpv.x - 0.3, 0.0, 1.0) * 1.12;
    float dn  = clamp(mpv.x + 2.0, 0.0, 3.0);

    vec4 col = vec4(0.0);

    if (mpv.x > 0.6) {
      // ── Natural cloud color ──────────────────────────────────────────
      // Vary shade gently with depth/position instead of rainbow cycling
      float shade = clamp(
        0.35 + sin(mpv.y * 0.45 + sin(pos.z * 0.22) * 0.35) * 0.38,
        0.0, 1.0
      );
      vec3 cloudLight  = vec3(0.96, 0.97, 1.00); // bright sunlit top
      vec3 cloudShadow = vec3(0.60, 0.72, 0.85); // cool shadowed underside
      col = vec4(mix(cloudShadow, cloudLight, shade), 0.08);

      col     *= den * den * den;
      col.rgb *= linstep(4.0, -2.5, mpv.x) * 2.3;

      float dif  = clamp((den - map(pos + 0.8 ).x) / 9.0,  0.001, 1.0);
            dif += clamp((den - map(pos + 0.35).x) / 2.5,  0.001, 1.0);

      // ── Sky-light + bright-white-sun lighting ────────────────────────
      col.xyz *= den * (vec3(0.06, 0.10, 0.20) + 2.5 * vec3(0.52, 0.54, 0.56) * dif);
    }

    // ── Sky-blue atmospheric fog ────────────────────────────────────────
    float fogC  = exp(t * 0.2 - 2.2);
    col.rgba   += vec4(0.52, 0.68, 0.88, 0.1) * clamp(fogC - fogT, 0.0, 1.0);
    fogT        = fogC;

    rez  = rez + col * (1.0 - rez.a);
    t   += clamp(0.5 - dn * dn * 0.05, 0.09, 0.3);
  }
  return clamp(rez, 0.0, 1.0);
}

float getsat(vec3 c) {
  float mi = min(min(c.x, c.y), c.z);
  float ma = max(max(c.x, c.y), c.z);
  return (ma - mi) / (ma + 1e-7);
}

void main() {
  vec2  q   = gl_FragCoord.xy / iResolution.xy;
  vec2  p   = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
  bsMo      = (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y;

  // Slowed time for a calm, drifting feel (original was *3.0)
  float time = iTime * 1.2;
  vec3  ro   = vec3(0.0, 0.0, time);

  // Gentle camera sway (reduced from original)
  ro += vec3(sin(iTime * 0.5) * 0.25, sin(iTime * 0.4) * 0.15, 0.0);

  float dspAmp = 0.85;
  ro.xy += disp(ro.z) * dspAmp;

  float tgtDst = 3.5;
  vec3  target   = normalize(ro - vec3(disp(time + tgtDst) * dspAmp, time + tgtDst));
  ro.x          -= bsMo.x * 2.0;
  vec3 rightdir  = normalize(cross(target, vec3(0.0, 1.0, 0.0)));
  vec3 updir     = normalize(cross(rightdir, target));
  rightdir       = normalize(cross(updir, target));
  vec3 rd        = normalize((p.x * rightdir + p.y * updir) * 1.0 - target);
  rd.xy         *= rot(-disp(time + 3.5).x * 0.2 + bsMo.x);

  // Reduced prm1 range (0 → ~0.35) keeps density variation subtle
  prm1 = smoothstep(-0.4, 0.4, sin(iTime * 0.3)) * 0.35;

  vec4 scn = render(ro, rd, time);
  vec3 col = scn.rgb;

  // ── No rainbow color-cycling — keep natural cloud palette ──────────
  // Soft gamma correction brightens clouds to a sunlit white
  col = pow(max(col, vec3(0.0)), vec3(0.46, 0.48, 0.50)) * vec3(1.04, 1.02, 1.00);

  // Gentle vignette from original
  col *= pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.10) * 0.65 + 0.35;

  fragColor = vec4(col, 1.0);
}`

// ── WebGL helpers ────────────────────────────────────────────────────────────
function compileShader(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER,   vsSrc)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc)
  if (!vs || !fs) return null
  const p = gl.createProgram()
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(p))
    return null
  }
  return p
}

export default function CloudBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas  = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return

    const program = createProgram(gl, VS, FS)
    if (!program) return

    // Fullscreen quad
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const vao     = gl.createVertexArray()
    const posLoc  = gl.getAttribLocation(program, 'aPos')
    gl.bindVertexArray(vao)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // Uniforms
    const uRes   = gl.getUniformLocation(program, 'iResolution')
    const uTime  = gl.getUniformLocation(program, 'iTime')
    const uMouse = gl.getUniformLocation(program, 'iMouse')

    // Mouse
    let mx = 0, my = 0
    const onMove = e => { mx = e.clientX; my = e.clientY }
    window.addEventListener('mousemove', onMove)

    // Resize — cap DPR at 1.25 for shader performance
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.25)
      canvas.width  = Math.floor(window.innerWidth  * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    window.addEventListener('resize', resize)
    resize()

    // Render loop
    const start = performance.now()
    let raf
    const render = () => {
      const t = (performance.now() - start) / 1000
      gl.useProgram(program)
      gl.uniform3f(uRes, canvas.width, canvas.height, 1.0)
      gl.uniform1f(uTime, t)
      gl.uniform4f(uMouse, mx * (canvas.width / window.innerWidth), 0, 0, 0)
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
