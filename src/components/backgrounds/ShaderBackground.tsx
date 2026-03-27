'use client';

import { memo, useEffect, useRef } from 'react';

const vsSource = `
  attribute vec4 aVertexPosition;
  void main() {
    gl_Position = aVertexPosition;
  }
`;

// Plasma lines shader — palette tuned to the Amwag design system
// lineColor   → --accent #3B82F6
// bgColor1/2  → --bg-primary #0A0A0F + deep indigo tint
const fsSource = `
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;

  const float overallSpeed       = 0.18;
  const float gridSmoothWidth    = 0.015;
  const float axisWidth          = 0.05;
  const float majorLineWidth     = 0.025;
  const float minorLineWidth     = 0.0125;
  const float majorLineFrequency = 5.0;
  const float minorLineFrequency = 1.0;
  const float scale              = 5.0;

  // Blue accent (#3B82F6 = 0.23, 0.51, 0.96) at low opacity so lines are subtle
  const vec4  lineColor          = vec4(0.23, 0.51, 0.96, 1.0);
  const float minLineWidth       = 0.01;
  const float maxLineWidth       = 0.18;
  const float lineSpeed          = 1.0 * overallSpeed;
  const float lineAmplitude      = 1.0;
  const float lineFrequency      = 0.2;
  const float warpSpeed          = 0.2 * overallSpeed;
  const float warpFrequency      = 0.5;
  const float warpAmplitude      = 1.0;
  const float offsetFrequency    = 0.5;
  const float offsetSpeed        = 1.33 * overallSpeed;
  const float minOffsetSpread    = 0.6;
  const float maxOffsetSpread    = 2.0;
  const int   linesPerGroup      = 16;

  #define drawCircle(pos, radius, coord)   smoothstep(radius + gridSmoothWidth, radius, length(coord - (pos)))
  #define drawSmoothLine(pos, hw, t)       smoothstep(hw, 0.0, abs(pos - (t)))
  #define drawCrispLine(pos, hw, t)        smoothstep(hw + gridSmoothWidth, hw, abs(pos - (t)))
  #define drawPeriodicLine(freq, width, t) drawCrispLine(freq / 2.0, width, abs(mod(t, freq) - (freq) / 2.0))

  float random(float t) {
    return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
  }

  float getPlasmaY(float x, float hFade, float offset) {
    return random(x * lineFrequency + iTime * lineSpeed) * hFade * lineAmplitude + offset;
  }

  void main() {
    vec2 uv    = gl_FragCoord.xy / iResolution.xy;
    vec2 space = (gl_FragCoord.xy - iResolution.xy * 0.5) / iResolution.x * 2.0 * scale;

    float hFade = 1.0 - (cos(uv.x * 6.28318) * 0.5 + 0.5);
    float vFade = 1.0 - (cos(uv.y * 6.28318) * 0.5 + 0.5);

    space.y += random(space.x * warpFrequency + iTime * warpSpeed) * warpAmplitude * (0.5 + hFade);
    space.x += random(space.y * warpFrequency + iTime * warpSpeed + 2.0) * warpAmplitude * hFade;

    vec4 lines = vec4(0.0);

    for (int l = 0; l < linesPerGroup; l++) {
      float nli    = float(l) / float(linesPerGroup);
      float offT   = iTime * offsetSpeed;
      float offPos = float(l) + space.x * offsetFrequency;
      float rand   = random(offPos + offT) * 0.5 + 0.5;
      float hw     = mix(minLineWidth, maxLineWidth, rand * hFade) * 0.5;
      float offset = random(offPos + offT * (1.0 + nli)) * mix(minOffsetSpread, maxOffsetSpread, hFade);
      float lineY  = getPlasmaY(space.x, hFade, offset);
      float line   = drawSmoothLine(lineY, hw, space.y) * 0.5
                   + drawCrispLine(lineY, hw * 0.15, space.y);

      float cx  = mod(float(l) + iTime * lineSpeed, 25.0) - 12.0;
      vec2  cp  = vec2(cx, getPlasmaY(cx, hFade, offset));
      float circ = drawCircle(cp, 0.01, space) * 4.0;

      lines += (line + circ) * lineColor * rand;
    }

    // Background: --bg-primary #0A0A0F → (0.039, 0.039, 0.059)
    //             subtle deep-indigo shift toward the right
    vec4 bgColor1 = vec4(0.05, 0.05, 0.08, 1.0);
    vec4 bgColor2 = vec4(0.07, 0.05, 0.16, 1.0);

    vec4 fragColor  = mix(bgColor1, bgColor2, uv.x);
    fragColor      *= vFade;
    fragColor.a     = 1.0;

    // Lines at 65% — visible but not overwhelming behind glass UI
    fragColor += lines * 0.65;

    gl_FragColor = fragColor;
  }
`;

function loadShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initShaderProgram(gl: WebGLRenderingContext) {
  const vs = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

function ShaderBackgroundBase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const program = initShaderProgram(gl);
    if (!program) return;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const posLoc = gl.getAttribLocation(program, 'aVertexPosition');
    const resLoc = gl.getUniformLocation(program, 'iResolution');
    const timeLoc = gl.getUniformLocation(program, 'iTime');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    const start = Date.now();
    let raf: number;

    const render = () => {
      const t = (Date.now() - start) / 1000;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, t);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(posLoc);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden="true"
    />
  );
}

export default memo(ShaderBackgroundBase);
