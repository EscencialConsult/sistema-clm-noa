import { useEffect, useMemo, useRef, useState } from "react"

// Fondo animado con WebGL2 (shader de ruido + swirl), pensado como alternativa
// profesional a una foto de stock. Preset propio "Institucional" en vez de
// los presets vívidos originales (Lava/Plasma/Vortex): colores de marca,
// velocidad baja, distorsión mínima — se mueve, pero no compite con la card.
// Ver DESIGN.md: respeta prefers-reduced-motion (congela el primer frame).

const FORMAS = { Checks: 0, Stripes: 1, Edge: 2 }

const PRESET_INSTITUCIONAL = {
  color1: "#0B2545", // azul institucional
  color2: "#0066CC", // azul corporativo
  color3: "#0B2545",
  rotation: 20,
  proportion: 45,
  scale: 0.35,
  speed: 8, // bien lento — "suave", no un efecto de producto de consumo
  distortion: 3,
  swirl: 20,
  swirlIterations: 6,
  softness: 100,
  offset: 0,
  shape: "Edge",
  shapeSize: 60,
}

function hexToRgba(hex) {
  let r = 0,
    g = 0,
    b = 0,
    a = 1
  if (hex.startsWith("#")) {
    const c = hex.slice(1)
    r = parseInt(c.slice(0, 2), 16) / 255
    g = parseInt(c.slice(2, 4), 16) / 255
    b = parseInt(c.slice(4, 6), 16) / 255
    if (c.length === 8) a = parseInt(c.slice(6, 8), 16) / 255
  }
  return [r, g, b, a]
}

const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;
    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);
    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);
    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float t = .5 * u_time;
    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv /= u_pixelRatio;
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);
    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * u_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);
    fragColor = vec4(color_mix.rgb, color_mix.a);
}
`

export default function FondoAnimado({ className }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [montado, setMontado] = useState(false)

  useEffect(() => setMontado(true), [])

  const reducido = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !montado) return

    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: true })
    if (!gl) return // sin WebGL2: el div se queda con el fondo azul plano del className

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vertexShader, VERTEX_SHADER)
    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("FondoAnimado — error vertex shader:", gl.getShaderInfoLog(vertexShader))
      return
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fragmentShader, FRAGMENT_SHADER)
    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("FondoAnimado — error fragment shader:", gl.getShaderInfoLog(fragmentShader))
      return
    }

    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("FondoAnimado — error link program:", gl.getProgramInfoLog(program))
      return
    }
    gl.useProgram(program)

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    const positionLocation = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const u = {
      time: gl.getUniformLocation(program, "u_time"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
      scale: gl.getUniformLocation(program, "u_scale"),
      rotation: gl.getUniformLocation(program, "u_rotation"),
      color1: gl.getUniformLocation(program, "u_color1"),
      color2: gl.getUniformLocation(program, "u_color2"),
      color3: gl.getUniformLocation(program, "u_color3"),
      proportion: gl.getUniformLocation(program, "u_proportion"),
      softness: gl.getUniformLocation(program, "u_softness"),
      shape: gl.getUniformLocation(program, "u_shape"),
      shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
      distortion: gl.getUniformLocation(program, "u_distortion"),
      swirl: gl.getUniformLocation(program, "u_swirl"),
      swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
    }

    function resize() {
      const width = container.clientWidth
      const height = container.clientHeight
      const pixelRatio = window.devicePixelRatio || 1
      canvas.width = width * pixelRatio
      canvas.height = height * pixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    const p = PRESET_INSTITUCIONAL
    const c1 = hexToRgba(p.color1)
    const c2 = hexToRgba(p.color2)
    const c3 = hexToRgba(p.color3)
    let frameId

    function dibujarFrame(elapsed) {
      const speed = (p.speed / 100) * 5
      gl.uniform1f(u.time, elapsed * speed + p.offset * 0.01)
      gl.uniform2f(u.resolution, canvas.width, canvas.height)
      gl.uniform1f(u.pixelRatio, window.devicePixelRatio || 1)
      gl.uniform1f(u.scale, p.scale)
      gl.uniform1f(u.rotation, (p.rotation * Math.PI) / 180)
      gl.uniform4f(u.color1, ...c1)
      gl.uniform4f(u.color2, ...c2)
      gl.uniform4f(u.color3, ...c3)
      gl.uniform1f(u.proportion, p.proportion / 100)
      gl.uniform1f(u.softness, p.softness / 100)
      gl.uniform1f(u.shape, FORMAS[p.shape])
      gl.uniform1f(u.shapeScale, p.shapeSize / 100)
      gl.uniform1f(u.distortion, p.distortion / 50)
      gl.uniform1f(u.swirl, p.swirl / 100)
      gl.uniform1f(u.swirlIterations, p.swirl === 0 ? 0 : p.swirlIterations)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    if (reducido) {
      // Reduced motion: un solo frame estático, nada de requestAnimationFrame en loop
      dibujarFrame(0)
    } else {
      const start = performance.now()
      const animar = (time) => {
        dibujarFrame((time - start) / 1000)
        frameId = requestAnimationFrame(animar)
      }
      frameId = requestAnimationFrame(animar)
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteBuffer(positionBuffer)
    }
  }, [montado, reducido])

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
