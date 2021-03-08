### Ray Marching Source and Helper Functions for Hydra-Synth

![Example Image](/example-images/top-image.png)

This fork adds a setRaymarcher function to Hydra-Synth, which allows users to easily create ray marching fragment shaders within the Hydra editor. The resulting fragment shader can be referenced as a source and used similarly to existing sources like gradient, noise, osc, etc. In addition to the setRaymarcher function, a collection of glsl signed distance functions is included, which can be used when creating the ray marching shader.

### Set Up 

- Clone this repository along with the original [hydra](https://github.com/ojack/hydra) repo
- Place the cloned hydra-synth folder into the hydra folder
- In hydra/package.json replace the hydra dependency with ` "hydra-synth": "file:hydra-synth/hydra-synth-1.3.5.tgz" `
- In the hydra folder run ` npm install ` then ` npm run build-main `
- After this you can run ` npm run start `, navigate to https://localhost:8000, and use setRayMarcher within Hydra

NOTE: If you are placing this forked version of hydra-synth in an existing hydra folder, you may need to delete /node_modules/hydra-synth and package-lock.json before running ` npm install ` and ` npm run build-main `

### Using setRaymarcher()

setRaymarcher() operates similarly to setFunction(), but includes prebuilt glsl functions needed for raymarching and extra propertiess for editing those functions.

To create a default raymarching source, which will render a sphere, you can run the code below:
```
  setRaymarcher({
    name: 'rm'
  })

  rm().out()
```

#### Fragment Shader

The resulting default fragment shader is based off of [Martijn Steinrucken's raymarching tutorial](https://youtu.be/PGtv-dBi2wE) with minor changes like the addition of ambient light. To explore how the fragment shader is built, look in [src/raymarching/raymarch-glsl.js](https://github.com/jocrob/hydra-synth/blob/master/src/raymarching/raymarch-glsl.js). The fragment shader is shown below:

```
${sdfs}

${this.addGLSL ? this.addGLSL : ''}

#define MAX_STEPS 100
#define MAX_DIST 100.
#define SURF_DIST .01

float GetDist(vec3 p) {
    ${this.distFunc ? this.distFunc : `
    vec4 s = vec4(0, 1, 6, 1);
    
    float sphereDist =  length(p-s.xyz)-s.w;
    
    float d = sphereDist;
    return d;
    `}
}

float RayMarch(vec3 ro, vec3 rd) {
    ${this.rayMarchFunc ? this.rayMarchFunc : `
    float dO=0.;

    for(int i=0; i<MAX_STEPS; i++) {
        vec3 p = ro + rd*dO;
        float dS = GetDist(p);
        dO += dS;
        if(dO>MAX_DIST || dS<SURF_DIST) break;
    }
    
    return dO;
    `}
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
    ${this.lightFunc ? this.lightFunc : `
    vec3 lightPos = ${this.lightPos};
    vec3 l = normalize(lightPos-p);
    vec3 n = GetNormal(p);
    
    float dif = clamp(dot(n, l), 0., 1.);
    float d = RayMarch(p+n*SURF_DIST*2., l);
    if(d<length(lightPos-p)) dif *= .1;
    
    return dif;
    `}
}

vec4 rm(vec2 _st) {
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
}
```

#### Properties of setRaymarcher()

The functions and values in this default fragment shader can be edited by adding properties to the object sent to setRaymarcher.

- **inputs**: allows you to declare uniform values within the fragment shader, and is used like the inputs property in hydra's setFunction().
  - ex:
      ```
      setRaymarcher({
        name: "rm",
        inputs: [
          {
            name: "light",
            type: "vec3",
            default: () => [
              a.fft[0] * 5,
              1 - a.fft[0] * 5,
              0,
            ],
          },
          {
            name: "uTime",
            type: "float",
            default: () => time,
          },
        ]
      }
      ```
  - If no arguments are sent when calling rm(), the default values declared for each input will be used. Otherwise the arguments sent to rm() will be assigned to each input. For example, `rm([0, 0, 0], () => a.fft[0]) ` will set the 'light' uniform equal to vec3(0,0,0) and uTime equal to the value of the first audio bin.

- **lightPos**: takes a string and allows you to set the position of the light in the ray marched scene. The string is interpreted as GLSL so you must use GLSL syntax when assigning the position. 
  - ex: `lightPos: 'vec3(0,5,5)'`

- **distFunc**: takes a string, and replaces the contents of `float GetDist(vec3 p)` in the fragment shader. The string is interpreted as GLSL so you must use GLSL syntax. You would use this property to specify the signed distance functions that get rendered.

- **rayMarchFunc**: takes a string, and replaces the contents of `float RayMarch(vec3 ro, vec3 rd)` in the fragment shader. The string is interpreted as GLSL so you must use GLSL syntax.

- **lightFunc**: takes a string, and replaces the contents of `float GetLight(vec3 p)` in the fragment shader. The string is interpreted as GLSL so you must use GLSL syntax.

- **addGLSL**: takes a string and adds it to the top of the fragment shader as GLSL. This can be used to add aditional functions to the shader, which you can reference in GetDist, RayMarch, etc.

#### Example

![Example Image](/example-images/raymarch-example.png)

```
setRaymarcher({
  name: "rm",
  inputs: [
    {
      name: "light",
      type: "vec3",
      default: () => [
        a.fft[0] * 5,
        1 - a.fft[0] * 5,
        0,
      ],
    },
    {
      name: "uTime",
      type: "float",
      default: () => time,
    },
  ],
  lightPos: "light",
  distFunc: `
		p -= vec3(0,1,6);
		mat3 rMat = rotateY(uTime*3.);
		p *= rMat;
		p += vec3(0,1,6);
		float octDist = sdOctahedron(p-vec3(0,1,6), 1.);
        float d = octDist;
		return d;
	`,
});

rm().scale(3, 2, 1).repeat(8, 4).out();

```

### Helper Functions (SDF's etc.)

Helper functions that can be used within the fragment shader can be found in [src/raymarching/sdf-funcs.js](https://github.com/jocrob/hydra-synth/blob/master/src/raymarching/sdf-funcs.js). Most of these functions come from [Inigo Quilez's article on signed distance functions](https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm), where you can find more information on how they are used. 




### Hydra-Synth

Video synth engine for [hydra](https://github.com/ojack/hydra).

Currently experimental / in-progress.

This is the main logic of hydra packaged as a javascript module, intended for use within javascript projects. If you are looking to get started with hydra quickly, visit the [web editor](https://hydra.ojack.xyz) or the [main repo](https://github.com/ojack/hydra). To use hydra within atom, follow the instructions at https://github.com/ojack/hydra-examples.

### To install:


```
npm install hydra-synth
```

### To develop:
```
npm run example
```
Sets up an example using hydra-synth that is automatically updated when source files are updated. It is possible to write test code by editing /example/index.js or by writing hydra code into the developer console.

#### To use:
```
const Hydra = require('hydra-synth')


window.onload = function () {
  const hydra = new Hydra()

  // by default, hydra makes everything global.
  // see options to change parameters
  osc().out()
}
```

#### API:
```
hydra = new Hydra([opts])
```
create a new hydra instance

If `opts` is specified, the default options (shown below) will be overridden.

```
{
  canvas: null, // canvas element to render to. If none is supplied, a canvas will be created and appended to the screen

  autoLoop: true, // if true, will automatically loop using requestAnimationFrame.If set to false, you must implement your own loop function using the tick() method (below)

  makeGlobal: true, // if false, will not pollute global namespace

  numSources: 4, // number of source buffers to create initially

  detectAudio = true,

  numOutputs: 4, // number of output buffers to use. Note: untested with numbers other than 4. render() method might behave unpredictably

  extendTransforms: [] // An array of transforms to be added to the synth, or an object representing a single transform

  precision: 'mediump' // precision of shaders, can also be 'highp'
}

```

set the resolution of the hydra canvas (note: this changes the underlying resolution. To change appearance on the screen, you should edit the css)
```
hydra.setResolution(width, height)
```

render an oscillator with parameters frequency, sync, and rgb offset:
```
osc(20, 0.1, 0.8).out()
```

rotate the oscillator 1.5 radians:
```
osc(20, 0.1, 0.8).rotate(0.8).out()
```
pixelate the output of the above function:
```
osc(20, 0.1, 0.8).rotate(0.8).pixelate(20, 30).out()
```
show webcam output:
```
s0.initCam() //initialize a webcam in source buffer s0
src(s0).out() //render source buffer s0
```

webcam kaleidoscope:
```
s0.initCam() //initialize a webcam in source buffer s0
src(s0).kaleid(4).out() //render the webcam to a kaleidoscope
```

use a video as a source:
```
s0.initVideo("https://media.giphy.com/media/AS9LIFttYzkc0/giphy.mp4")
src(s0).out()
```


use an image as a source:
```
s0.initImage("https://upload.wikimedia.org/wikipedia/commons/2/25/Hydra-Foto.jpg")
src(s0).out()
```

By default, the environment contains four separate output buffers that can each render different graphics.  The outputs are accessed by the variables o0, o1, o2, and o3.
to render to output buffer o1:
```
osc().out(o1)
render(o1) //render the contents of o1
```

to show all render buffers at once:
```
render()
```

The output buffers can then be mixed and composited to produce what is shown on the screen.
```
s0.initCam() //initialize a webcam in source buffer s0
src(s0).out(o0) //set the source of o0 to render the buffer containing the webcam
osc(10, 0.2, 0.8).diff(o0).out(o1) //initialize a gradient in output buffer o1, composite with the contents of o0
render(o1) // render o1 to the screen
```

The composite functions blend(), diff(), mult(), and add() perform arithmetic operations to combine the input texture color with the base texture color, similar to photoshop blend modes.

modulate(texture, amount) uses the red and green channels of the input texture to modify the x and y coordinates of the base texture. More about modulation at: https://lumen-app.com/guide/modulation/
```
osc(21, 0).modulate(o1).out(o0)
osc(40).rotate(1.57).out(o1)
```

#### Passing functions as variables
Each parameter can be defined as a function rather than a static variable. For example,
```
osc(function(t){return 100*Math.sin(t*0.1)}).out()
```
modifies the oscillator frequency as a function of time. This can be written more concisely using es6 syntax:
```
osc((t) => (100*Math.sin(t*0.1))).out()
```

#### Using Custom Sources
Any canvas, video, or image element can serve as a source in addition to the built-in source functions for sharing camera, screen capture, and remote streams. Video and images must be fully loaded before being passed to hydra.

Add a custom source:

```
s0.init({
  src: <canvas, video, or image element>,
  dynamic: true // optional parameter. Set to false if using a static image or something that will not change
})
```

You can add new source buffers once hydra has been initialized:
```
let src = hydra.newSource()
src.init({ src: canvasEl})
```

Clear a source buffer:
```
s0.clear()
```


#### Non-global mode [in progress]
If makeGlobal is set to false, buffers and functions can be accessed via the synth property of the hydra instance. Note that sources and buffers are contained in an array and accessed by index. E.g.:
```
let synth = hydra.synth
synth.osc().out()
synth.s0.initCam()
```

#### Custom render loop
You can use your own render loop for triggering hydra updates, instead of the automatic looping. To use, set autoLoop to false, and call
```
hydra.tick(dt)
```
where dt is the time elapsed in milliseconds since the last update

### Directly using shader code
You can get access to the hydra shader code without rendering using hydra. For example,
```
osc().rotate().glsl()
```
returns a fragment shader string and list of uniforms. For vertex shader and attribute implentation, see https://github.com/ojack/hydra-synth/blob/master/src/output.js.

#### Adding/editing transformation functions

All of the available functions for transforming coordinates and color, as well as compositing textures, correspond directly to a snippet of fragment shader code. These transformations are defined in the file hydra/hydra-server/app/src/composable-glsl-transforms.js. When running locally, you can edit this file to change the available functions, and refresh the page to see changes.


#### Desktop capture
To use screen capture or a browser tab as an input texture, you must first install the chrome extension for screensharing, and restart chrome. Desktop capture can be useful for inputing graphics from another application, or a video or website in another browser tab. It can also be used to create interesting feedback effects.

To install, go to http://chrome://extensions/
Click "Load unpacked extension", and select the "extensions" folder in "screen-capture-extension" in this repo. Restart chrome. The extension should work from now on without needing to reinstall.

select a screen tab to use as input texture:
```
s0.initScreen()
```

render screen tab:
```
s0.initScreen()
o0.src(s0)
```
