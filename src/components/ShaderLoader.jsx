import { useRef, useEffect, useState } from 'react'
import fragSrc from '../shaders/planet.frag?raw'
import './ShaderLoader.css'

const VERT_SRC = `#version 300 es
in vec4 position;
void main() { gl_Position = position; }
`

function compileShader(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('Shader compile error:', gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

function linkProgram(gl, vs, fs) {
  const p = gl.createProgram()
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('Program link error:', gl.getProgramInfoLog(p))
    gl.deleteProgram(p)
    return null
  }
  return p
}

const CANVAS_SIZE = 260

export default function ShaderLoader({ onFadeStart, onComplete }) {
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState('active') // active → fading → done

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) { onComplete?.(); return }

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false })
    if (!gl) { onComplete?.(); return }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
    if (!vs || !fs) { onComplete?.(); return }

    const program = linkProgram(gl, vs, fs)
    if (!program) { onComplete?.(); return }

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(program, 'iResolution')
    const uTime = gl.getUniformLocation(program, 'iTime')
    const uMouse = gl.getUniformLocation(program, 'iMouse')

    gl.useProgram(program)
    gl.uniform3f(uRes, canvas.width, canvas.height, 1.0)
    gl.uniform4f(uMouse, 0, 0, 0, 0)

    const t0 = performance.now()
    let raf

    const render = () => {
      const elapsed = (performance.now() - t0) / 1000.0
      gl.uniform1f(uTime, elapsed)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    // t=2.2s: planet/glow start fading
    const fadeTimer = setTimeout(() => {
      setPhase('fading')
    }, 2200)

    // t=3s: planet gone — start rendering landing page underneath
    const readyTimer = setTimeout(() => {
      onFadeStart?.()
    }, 3000)

    // t=4s: background fully faded — remove loader from DOM
    const doneTimer = setTimeout(() => {
      setPhase('done')
      onComplete?.()
    }, 4000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(readyTimer)
      clearTimeout(doneTimer)
      cancelAnimationFrame(raf)
      gl.deleteBuffer(buf)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div className={`sl ${phase === 'fading' ? 'sl--fading' : ''}`}>
      <div className="sl-inner">
        <div className="sl-glow" />
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="sl-canvas"
        />
      </div>
    </div>
  )
}
