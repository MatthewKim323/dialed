#version 300 es
precision highp float;

#define _in(T) const in T
#define _inout(T) inout T
#define _out(T) out T
#define _begin(type) type(
#define _end )
#define _mutable(T) T
#define _constant(T) const T
#define mul(a, b) (a) * (b)

#define SHADERTOY
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;

#define u_res iResolution
#define u_time iTime
#define u_mouse iMouse

out vec4 outColor;

// ═══════════════════════════════════════════════════════════════════════════
// Planet shader — based on https://www.shadertoy.com/view/ldyXRw
// ═══════════════════════════════════════════════════════════════════════════

#define PI 3.14159265359

struct ray_t {
	vec3 origin;
	vec3 direction;
};
#define BIAS 1e-4

struct sphere_t {
	vec3 origin;
	float radius;
	int material;
};

struct plane_t {
	vec3 direction;
	float distance;
	int material;
};

struct hit_t {
	float t;
	int material_id;
	vec3 normal;
	vec3 origin;
};
#define max_dist 1e8
_constant(hit_t) no_hit = _begin(hit_t)
	float(max_dist + 1e1),
	-1,
	vec3(0., 0., 0.),
	vec3(0., 0., 0.)
_end;

// ── Utilities ─────────────────────────────────────────────────────────────

ray_t get_primary_ray(
	_in(vec3) cam_local_point,
	_inout(vec3) cam_origin,
	_inout(vec3) cam_look_at
){
	vec3 fwd = normalize(cam_look_at - cam_origin);
	vec3 up = vec3(0, 1, 0);
	vec3 right = cross(up, fwd);
	up = cross(fwd, right);

	ray_t r = _begin(ray_t)
		cam_origin,
		normalize(fwd + up * cam_local_point.y + right * cam_local_point.x)
	_end;
	return r;
}

_constant(mat3) mat3_ident = mat3(1, 0, 0, 0, 1, 0, 0, 0, 1);

mat2 rotate_2d(_in(float) angle_degrees){
	float angle = radians(angle_degrees);
	float _sin = sin(angle);
	float _cos = cos(angle);
	return mat2(_cos, -_sin, _sin, _cos);
}

mat3 rotate_around_z(_in(float) angle_degrees){
	float angle = radians(angle_degrees);
	float _sin = sin(angle);
	float _cos = cos(angle);
	return mat3(_cos, -_sin, 0, _sin, _cos, 0, 0, 0, 1);
}

mat3 rotate_around_y(_in(float) angle_degrees){
	float angle = radians(angle_degrees);
	float _sin = sin(angle);
	float _cos = cos(angle);
	return mat3(_cos, 0, _sin, 0, 1, 0, -_sin, 0, _cos);
}

mat3 rotate_around_x(_in(float) angle_degrees){
	float angle = radians(angle_degrees);
	float _sin = sin(angle);
	float _cos = cos(angle);
	return mat3(1, 0, 0, 0, _cos, -_sin, 0, _sin, _cos);
}

vec3 linear_to_srgb(_in(vec3) color){
	const float p = 1. / 2.2;
	return vec3(pow(color.r, p), pow(color.g, p), pow(color.b, p));
}

vec3 srgb_to_linear(_in(vec3) color){
	const float p = 2.2;
	return vec3(pow(color.r, p), pow(color.g, p), pow(color.b, p));
}

float checkboard_pattern(_in(vec2) pos, _in(float) scale){
	vec2 pattern = floor(pos * scale);
	return mod(pattern.x + pattern.y, 2.0);
}

float band(_in(float) start, _in(float) peak, _in(float) end, _in(float) t){
	return smoothstep(start, peak, t) * (1. - smoothstep(peak, end, t));
}

void fast_orthonormal_basis(_in(vec3) n, _out(vec3) f, _out(vec3) r){
	float a = 1. / (1. + n.z);
	float b = -n.x*n.y*a;
	f = vec3(1. - n.x*n.x*a, b, -n.x);
	r = vec3(b, 1. - n.y*n.y*a, -n.y);
}

// ── Sphere intersection ──────────────────────────────────────────────────

void intersect_sphere(
	_in(ray_t) ray,
	_in(sphere_t) sphere,
	_inout(hit_t) hit
){
	vec3 rc = sphere.origin - ray.origin;
	float radius2 = sphere.radius * sphere.radius;
	float tca = dot(rc, ray.direction);
	if (tca < 0.) return;

	float d2 = dot(rc, rc) - tca * tca;
	if (d2 > radius2) return;

	float thc = sqrt(radius2 - d2);
	float t0 = tca - thc;
	float t1 = tca + thc;

	if (t0 < 0.) t0 = t1;
	if (t0 > hit.t) return;

	vec3 impact = ray.origin + ray.direction * t0;

	hit.t = t0;
	hit.material_id = sphere.material;
	hit.origin = impact;
	hit.normal = (impact - sphere.origin) / sphere.radius;
}

// ── Volume utilities ─────────────────────────────────────────────────────

struct volume_sampler_t {
	vec3 origin;
	vec3 pos;
	float height;
	float coeff_absorb;
	float T;
	vec3 C;
	float alpha;
};

volume_sampler_t begin_volume(_in(vec3) origin, _in(float) coeff_absorb){
	volume_sampler_t v = _begin(volume_sampler_t)
		origin, origin, 0.,
		coeff_absorb, 1.,
		vec3(0., 0., 0.), 0.
	_end;
	return v;
}

float illuminate_volume(_inout(volume_sampler_t) vol, _in(vec3) V, _in(vec3) L);

void integrate_volume(
	_inout(volume_sampler_t) vol,
	_in(vec3) V,
	_in(vec3) L,
	_in(float) density,
	_in(float) dt
){
	float T_i = exp(-vol.coeff_absorb * density * dt);
	vol.T *= T_i;
	vol.C += vol.T * illuminate_volume(vol, V, L) * density * dt;
	vol.alpha += (1. - T_i) * (1. - vol.alpha);
}

// ── Noise ────────────────────────────────────────────────────────────────

float hash(_in(float) n){
	return fract(sin(n)*753.5453123);
}

float noise_iq(_in(vec3) x){
	vec3 p = floor(x);
	vec3 f = fract(x);
	f = f*f*(3.0 - 2.0*f);

	float n = p.x + p.y*157.0 + 113.0*p.z;
	return mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
	               mix( hash(n+157.0), hash(n+158.0),f.x),f.y),
	           mix(mix( hash(n+113.0), hash(n+114.0),f.x),
	               mix( hash(n+270.0), hash(n+271.0),f.x),f.y),f.z);
}

#define noise(x) noise_iq(x)

// ── FBM ──────────────────────────────────────────────────────────────────

#define DECL_FBM_FUNC(_name, _octaves, _basis) float _name(_in(vec3) pos, _in(float) lacunarity, _in(float) init_gain, _in(float) gain) { vec3 p = pos; float H = init_gain; float t = 0.; for (int i = 0; i < _octaves; i++) { t += _basis * H; p *= lacunarity; H *= gain; } return t; }

DECL_FBM_FUNC(fbm, 4, noise(p))

// ── Planet ───────────────────────────────────────────────────────────────

_constant(sphere_t) planet = _begin(sphere_t)
	vec3(0, 0, 0), 1., 0
_end;

#define max_height .4
#define max_ray_dist (max_height * 4.)

vec3 background(_in(ray_t) eye){
	_constant(vec3) sun_color = vec3(1., .9, .55);
	float sun_amount = dot(eye.direction, vec3(0, 0, 1));

	vec3 sky = mix(
		vec3(.0, .05, .2),
		vec3(.15, .3, .4),
		1.0 - eye.direction.y);
	sky += sun_color * min(pow(sun_amount, 30.0) * 5.0, 1.0);
	sky += sun_color * min(pow(sun_amount, 10.0) * .6, 1.0);

	return sky;
}

void setup_scene(){}

void setup_camera(_inout(vec3) eye, _inout(vec3) look_at){
	eye = vec3(0, 0, -2.5);
	look_at = vec3(0, 0, 2);
}

// ── Clouds ───────────────────────────────────────────────────────────────
#define CLOUDS

#define anoise (abs(noise(p) * 2. - 1.))
DECL_FBM_FUNC(fbm_clouds, 4, anoise)

#define vol_coeff_absorb 30.034
_mutable(volume_sampler_t) cloud;

float illuminate_volume(
	_inout(volume_sampler_t) cloud,
	_in(vec3) V,
	_in(vec3) L
){
	return exp(cloud.height) / .055;
}

void clouds_map(_inout(volume_sampler_t) cloud, _in(float) t_step){
	float dens = fbm_clouds(
		cloud.pos * 3.2343 + vec3(.35, 13.35, 2.67),
		2.0276, .5, .5);

	#define cld_coverage .29475675
	#define cld_fuzzy .0335
	dens *= smoothstep(cld_coverage, cld_coverage + cld_fuzzy, dens);
	dens *= band(.2, .35, .65, cloud.height);

	integrate_volume(cloud, cloud.pos, cloud.pos, dens, t_step);
}

void clouds_march(
	_in(ray_t) eye,
	_inout(volume_sampler_t) cloud,
	_in(float) max_travel,
	_in(mat3) rot
){
	const int steps = 75;
	const float t_step = max_ray_dist / float(steps);
	float t = 0.;

	for (int i = 0; i < steps; i++) {
		if (t > max_travel || cloud.alpha >= 1.) return;

		vec3 o = cloud.origin + t * eye.direction;
		cloud.pos = mul(rot, o - planet.origin);
		cloud.height = (length(cloud.pos) - planet.radius) / max_height;
		t += t_step;
		clouds_map(cloud, t_step);
	}
}

void clouds_shadow_march(
	_in(vec3) dir,
	_inout(volume_sampler_t) cloud,
	_in(mat3) rot
){
	const int steps = 5;
	const float t_step = max_height / float(steps);
	float t = 0.;

	for (int i = 0; i < steps; i++) {
		vec3 o = cloud.origin + t * dir;
		cloud.pos = mul(rot, o - planet.origin);
		cloud.height = (length(cloud.pos) - planet.radius) / max_height;
		t += t_step;
		clouds_map(cloud, t_step);
	}
}

// ── Terrain ──────────────────────────────────────────────────────────────
#define TERR_STEPS 120
#define TERR_EPS .005
#define rnoise (1. - abs(noise(p) * 2. - 1.))

DECL_FBM_FUNC(fbm_terr, 3, noise(p))
DECL_FBM_FUNC(fbm_terr_r, 3, rnoise)
DECL_FBM_FUNC(fbm_terr_normals, 7, noise(p))
DECL_FBM_FUNC(fbm_terr_r_normals, 7, rnoise)

vec2 sdf_terrain_map(_in(vec3) pos){
	float h0 = fbm_terr(pos * 2.0987, 2.0244, .454, .454);
	float n0 = smoothstep(.35, 1., h0);

	float h1 = fbm_terr_r(pos * 1.50987 + vec3(1.9489, 2.435, .5483), 2.0244, .454, .454);
	float n1 = smoothstep(.6, 1., h1);

	float n = n0 + n1;
	return vec2(length(pos) - planet.radius - n * max_height, n / max_height);
}

vec2 sdf_terrain_map_detail(_in(vec3) pos){
	float h0 = fbm_terr_normals(pos * 2.0987, 2.0244, .454, .454);
	float n0 = smoothstep(.35, 1., h0);

	float h1 = fbm_terr_r_normals(pos * 1.50987 + vec3(1.9489, 2.435, .5483), 2.0244, .454, .454);
	float n1 = smoothstep(.6, 1., h1);

	float n = n0 + n1;
	return vec2(length(pos) - planet.radius - n * max_height, n / max_height);
}

vec3 sdf_terrain_normal(_in(vec3) p){
#define F(t) sdf_terrain_map_detail(t).x
	vec3 dt = vec3(0.001, 0, 0);
	return normalize(vec3(
		F(p + dt.xzz) - F(p - dt.xzz),
		F(p + dt.zxz) - F(p - dt.zxz),
		F(p + dt.zzx) - F(p - dt.zzx)
	));
#undef F
}

// ── Lighting ─────────────────────────────────────────────────────────────

vec3 setup_lights(_in(vec3) L, _in(vec3) normal){
	vec3 diffuse = vec3(0, 0, 0);
	vec3 c_L = vec3(7, 5, 3);
	diffuse += max(0., dot(L, normal)) * c_L;
	float hemi = clamp(.25 + .5 * normal.y, .0, 1.);
	diffuse += hemi * vec3(.4, .6, .8) * .2;
	float amb = clamp(.12 + .8 * max(0., dot(-L, normal)), 0., 1.);
	diffuse += amb * vec3(.4, .5, .6);
	return diffuse;
}

vec3 illuminate(
	_in(vec3) pos,
	_in(vec3) eye,
	_in(mat3) local_xform,
	_in(vec2) df
){
	float h = df.y;
	vec3 w_normal = normalize(pos);

#define LIGHT
#ifdef LIGHT
	vec3 normal = sdf_terrain_normal(pos);
	float N = dot(normal, w_normal);
#else
	float N = w_normal.y;
#endif

	#define c_water vec3(.015, .110, .455)
	#define c_grass vec3(.086, .132, .018)
	#define c_beach vec3(.153, .172, .121)
	#define c_rock  vec3(.080, .050, .030)
	#define c_snow  vec3(.600, .600, .600)

	#define l_water .05
	#define l_shore .17
	#define l_grass .211
	#define l_rock .351

	float s = smoothstep(.4, 1., h);
	vec3 rock = mix(c_rock, c_snow, smoothstep(1. - .3*s, 1. - .2*s, N));
	vec3 grass = mix(c_grass, rock, smoothstep(l_grass, l_rock, h));
	vec3 shoreline = mix(c_beach, grass, smoothstep(l_shore, l_grass, h));
	vec3 water = mix(c_water / 2., c_water, smoothstep(0., l_water, h));

#ifdef LIGHT
	vec3 L = mul(local_xform, normalize(vec3(1, 1, 0)));
	shoreline *= setup_lights(L, normal);
	vec3 ocean = setup_lights(L, w_normal) * water;
#else
	vec3 ocean = water;
#endif

	return mix(ocean, shoreline, smoothstep(l_water, l_shore, h));
}

// ── Rendering ────────────────────────────────────────────────────────────

vec3 render(_in(ray_t) eye, _in(vec3) point_cam){
	mat3 rot_y = rotate_around_y(27.);
	mat3 rot = mul(rotate_around_x(u_time * -12.), rot_y);
	mat3 rot_cloud = mul(rotate_around_x(u_time * 8.), rot_y);
	if (u_mouse.z > 0.) {
		rot = rotate_around_y(-u_mouse.x);
		rot_cloud = rotate_around_y(-u_mouse.x);
		rot = mul(rot, rotate_around_x(u_mouse.y));
		rot_cloud = mul(rot_cloud, rotate_around_x(u_mouse.y));
	}

	sphere_t atmosphere = planet;
	atmosphere.radius += max_height;

	hit_t hit = no_hit;
	intersect_sphere(eye, atmosphere, hit);
	if (hit.material_id < 0) {
		return background(eye);
	}

	float t = 0.;
	vec2 df = vec2(1, max_height);
	vec3 pos;
	float max_cld_ray_dist = max_ray_dist;

	for (int i = 0; i < TERR_STEPS; i++) {
		if (t > max_ray_dist) break;
		vec3 o = hit.origin + t * eye.direction;
		pos = mul(rot, o - planet.origin);
		df = sdf_terrain_map(pos);
		if (df.x < TERR_EPS) {
			max_cld_ray_dist = t;
			break;
		}
		t += df.x * .4567;
	}

#ifdef CLOUDS
	cloud = begin_volume(hit.origin, vol_coeff_absorb);
	clouds_march(eye, cloud, max_cld_ray_dist, rot_cloud);
#endif

	if (df.x < TERR_EPS) {
		vec3 c_terr = illuminate(pos, eye.direction, rot, df);
		vec3 c_cld = cloud.C;
		float alpha = cloud.alpha;
		float shadow = 1.;

#ifdef CLOUDS
		pos = mul(transpose(rot), pos);
		cloud = begin_volume(pos, vol_coeff_absorb);
		vec3 local_up = normalize(pos);
		clouds_shadow_march(local_up, cloud, rot_cloud);
		shadow = mix(.7, 1., step(cloud.alpha, 0.33));
#endif

		return mix(c_terr * shadow, c_cld, alpha);
	} else {
		return mix(background(eye), cloud.C, cloud.alpha);
	}
}

// ── Main image ───────────────────────────────────────────────────────────

#define FOV tan(radians(30.))

void mainImage(_out(vec4) fragColor, vec2 fragCoord){
	vec2 aspect_ratio = vec2(u_res.x / u_res.y, 1);
	vec3 color = vec3(0, 0, 0);

	vec3 eye, look_at;
	setup_camera(eye, look_at);
	setup_scene();

	vec2 point_ndc = fragCoord.xy / u_res.xy;
	vec3 point_cam = vec3(
		(2.0 * point_ndc - 1.0) * aspect_ratio * FOV,
		-1.0);

	ray_t ray = get_primary_ray(point_cam, eye, look_at);
	color += render(ray, point_cam);

	fragColor = vec4(linear_to_srgb(color), 1);
}

// ── Entry point ──────────────────────────────────────────────────────────

void main(){
	vec4 col;
	mainImage(col, gl_FragCoord.xy);
	outColor = col;
}
