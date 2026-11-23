import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  PerspectiveCamera,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer,
} from "three";

/**
 * Points drawn as surface-aligned discs whose radius is each point's Voronoi
 * coverage radius (lib/pointFeatures), with a paraboloid depth offset: where
 * discs overlap, the one whose center is nearest the pixel wins. Each point
 * therefore fills exactly its Voronoi cell — no gaps, no blending, crisp
 * colors — instead of a square of one global size.
 *
 * Discs are intersected per pixel with the view ray (perspective-correct, so
 * oblique discs become ellipses); points without a normal use camera-facing
 * discs. Sub-pixel discs keep a ~1 px footprint.
 */

const vertexShader = /* glsl */ `
  attribute float radius;       // coverage radius (m)

  uniform float uSizeScale;
  uniform float uProjScale;     // (bufferHeight / 2) · P[1][1]
  uniform float uMaxPointSize;

  varying vec3 vCenter;
  varying vec3 vNormal;
  varying float vRadius;
  varying float vPointSize;
  varying vec3 vColor;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 3% margin so rounding at Voronoi vertices can't open pinholes.
    vRadius = radius * uSizeScale * 1.03;
    vCenter = mv.xyz;
    vNormal = dot(normal, normal) > 0.25 ? normalize(normalMatrix * normal) : -normalize(mv.xyz);
    gl_PointSize = clamp(2.2 * vRadius * uProjScale / -mv.z, 1.0, uMaxPointSize);
    vPointSize = gl_PointSize;
    vColor = color;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec2 uResolution;
  uniform vec2 uProjXY;    // P[0][0], P[1][1]
  uniform vec2 uDepthAB;   // P[2][2], P[3][2]
  uniform float uParaboloid;

  varying vec3 vCenter;
  varying vec3 vNormal;
  varying float vRadius;
  varying float vPointSize;
  varying vec3 vColor;

  void main() {
    vec2 ndc = gl_FragCoord.xy / uResolution * 2.0 - 1.0;
    vec3 dir = vec3(ndc.x / uProjXY.x, ndc.y / uProjXY.y, -1.0);
    float denom = dot(dir, vNormal);
    vec3 hit = vCenter;
    float r2 = 0.0;
    bool onDisc = false;
    if (abs(denom) > 1e-5) {
      float t = dot(vCenter, vNormal) / denom;
      hit = dir * t;
      r2 = dot(hit - vCenter, hit - vCenter) / (vRadius * vRadius);
      onDisc = t > 0.0 && r2 <= 1.0;
    }
    if (!onDisc) {
      if (length(gl_PointCoord - 0.5) * vPointSize > 0.7) discard;
      hit = vCenter;
      r2 = 0.0;
    }
    // Paraboloid depth: farther toward the rim, so the nearest center wins.
    float z = hit.z - uParaboloid * vRadius * r2;
    gl_FragDepth = ((uDepthAB.x * z + uDepthAB.y) / -z) * 0.5 + 0.5;
    gl_FragColor = vec4(vColor, 1.0);
    #include <colorspace_fragment>
  }
`;

export class DiscPointsMaterial {
  readonly material: ShaderMaterial;
  readonly geometry = new BufferGeometry();
  private readonly bufferSize = new Vector2();
  private hwMaxPointSize = 0;

  constructor(source: BufferGeometry, radius: Float32Array, normals: Float32Array) {
    this.geometry.setAttribute("position", source.getAttribute("position"));
    this.geometry.setAttribute("color", source.getAttribute("color"));
    this.geometry.setAttribute("radius", new BufferAttribute(radius, 1));
    this.geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    if (!source.boundingSphere) source.computeBoundingSphere();
    this.geometry.boundingSphere = source.boundingSphere!.clone();

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      vertexColors: true,
      toneMapped: false, // scanned colors are already final; skip ACES
      uniforms: {
        uSizeScale: { value: 1 },
        uProjScale: { value: 1 },
        uMaxPointSize: { value: 64 },
        uResolution: { value: new Vector2(1, 1) },
        uProjXY: { value: new Vector2(1, 1) },
        uDepthAB: { value: new Vector2(-1, -0.2) },
        uParaboloid: { value: 1 },
      },
    });
  }

  setSizeScale(scale: number) {
    this.material.uniforms.uSizeScale.value = scale;
  }

  /** Per-frame: viewport and projection-dependent uniforms. */
  update(gl: WebGLRenderer, camera: Camera) {
    gl.getDrawingBufferSize(this.bufferSize);
    const p = (camera as PerspectiveCamera).projectionMatrix.elements;
    const u = this.material.uniforms;
    u.uResolution.value.copy(this.bufferSize);
    u.uProjScale.value = (this.bufferSize.y / 2) * p[5];
    u.uProjXY.value.set(p[0], p[5]);
    u.uDepthAB.value.set(p[10], p[14]);
    if (!this.hwMaxPointSize) {
      const ctx = gl.getContext();
      this.hwMaxPointSize = (ctx.getParameter(ctx.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1];
    }
    u.uMaxPointSize.value = Math.min(this.hwMaxPointSize, 64 * gl.getPixelRatio());
  }

  dispose() {
    this.material.dispose();
    this.geometry.dispose();
  }
}
