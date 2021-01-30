const sdfs = require('./sdf-funcs.js')

//single variable values like cameraPos should be set to defaults, code block values should be set to null and have checks in generate method
class raymarchGlsl {
    constructor({
        name = 'raymarcher',
        inputs = [],
        lightPos = 'vec3(0, 5, 6)',
        distFunc = null
    } = {}) {
        this.name = name
        this.inputs = inputs
        this.lightPos = lightPos
        this.distFunc = distFunc
        this.init()
    }

    init() {
        console.log(`new raymarcher: ${this.name}`)
    }

    srcObj() {
        return {name: this.name, type: 'src', inputs: this.inputs, raymarcher: true, allArgsUniform: true, helperGlsl: this.helperGlsl(), glsl: `
        vec2 uv = (_st*resolution.xy-.5*resolution.xy)/resolution.y;

        vec3 col = vec3(0);
        
        vec3 ro = vec3(0, 1, 0);
        vec3 rd = normalize(vec3(uv.x, uv.y, 1));

        float d = RayMarch(ro, rd);
        
        vec3 p = ro + rd * d;

        float ambient = 0.0;
        if(d < MAX_DIST) {
            ambient = 0.05;
        }
        
        float dif = clamp(GetLight(p) + ambient, 0., 1.);
        col = vec3(dif);
        
        col = pow(col, vec3(.4545));	// gamma correction
        
        vec4 frag = vec4(col,1.0);
        if(dif == 0.) { //setting background to transparent
            frag = vec4(col, 0.0);
        }

        return frag;
    `}
    }

    //add default func that allows someone to render a single sdf object and transform it
    helperGlsl() {
        return `
        ${sdfs}

        // "ShaderToy Tutorial - Ray Marching for Dummies!" 
        // by Martijn Steinrucken aka BigWings/CountFrolic - 2018
        // License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
        //
        // This shader is part of a tutorial on YouTube
        // https://youtu.be/PGtv-dBi2wE

        #define MAX_STEPS 100
        #define MAX_DIST 100.
        #define SURF_DIST .01

        float GetDist(vec3 p) {
            ${this.distFunc ? this.distFunc : `
            vec4 s = vec4(0, 1, 6, 1);
            
            //float sphereDist =  length(p-s.xyz)-s.w;
            float octDist = sdOctahedron(p-vec3(0,1,6), 1.);
            float d = octDist;
            
            //float d = sphereDist;
            return d;
            `}
        }

        float RayMarch(vec3 ro, vec3 rd) {
            float dO=0.;
            
            for(int i=0; i<MAX_STEPS; i++) {
                vec3 p = ro + rd*dO;
                float dS = GetDist(p);
                dO += dS;
                if(dO>MAX_DIST || dS<SURF_DIST) break;
            }
            
            return dO;
        }

        vec3 GetNormal(vec3 p) {
            float d = GetDist(p);
            vec2 e = vec2(.01, 0);
            
            vec3 n = d - vec3(
                GetDist(p-e.xyy),
                GetDist(p-e.yxy),
                GetDist(p-e.yyx));
            
            return normalize(n);
        }

        float GetLight(vec3 p) {
            vec3 lightPos = ${this.lightPos};
            vec3 l = normalize(lightPos-p);
            vec3 n = GetNormal(p);
            
            float dif = clamp(dot(n, l), 0., 1.);
            float d = RayMarch(p+n*SURF_DIST*2., l);
            if(d<length(lightPos-p)) dif *= .1;
            
            return dif;
        }
    `
    }
}

module.exports = raymarchGlsl