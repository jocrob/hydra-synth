(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.HydraShaders = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const Generator = require('./src/generator-factory.js')
const Sandbox = require('./src/eval-sandbox.js')

const baseUniforms = ['s0', 's1', 's2', 's3', 'o0', 'o1', 'o2'] // names of uniforms usually used in hydra. These can be customized

class ShaderGenerator {
  constructor({ defaultUniforms = {time: 0, resolution: [1280, 720]}, customUniforms = baseUniforms, extendTransforms = []} = {}) {
    var self = this
    self.renderer = {}

    var generatorOpts = { defaultUniforms, extendTransforms }
    generatorOpts.changeListener = ({type, method, synth}) => {
        if (type === 'add') {
          self.renderer[method] = synth.generators[method]
        } else if (type === 'remove') {
        }
    }
    generatorOpts.defaultOutput = {
      render: (pass) => self.generatedCode = pass[0]
    }
    this.generator = new Generator(generatorOpts)
    this.sandbox = new Sandbox(this.renderer, false)

    this.initialCode = `
      ${customUniforms.map((name) => `const ${name} = () => {}`).join(';')}
    `
    console.log(this.initialCode)
  }

  eval(code) {
    this.sandbox.eval(`${this.initialCode}
          ${code}`)
    return this.generatedCode
  }
}

module.exports = ShaderGenerator

},{"./src/eval-sandbox.js":2,"./src/generator-factory.js":3}],2:[function(require,module,exports){
// handles code evaluation and attaching relevant objects to global and evaluation contexts

const Sandbox = require('./lib/sandbox.js')
const ArrayUtils = require('./lib/array-utils.js')

class EvalSandbox {
  constructor(parent, makeGlobal, userProps = []) {
    this.makeGlobal = makeGlobal
    this.sandbox = Sandbox(parent)
    this.parent = parent
    var properties = Object.keys(parent)
    properties.forEach((property) => this.add(property))
    this.userProps = userProps
  }

  add(name) {
    if(this.makeGlobal) window[name] = this.parent[name]
    this.sandbox.addToContext(name, `parent.${name}`)
  }

// sets on window as well as synth object if global (not needed for objects, which can be set directly)

  set(property, value) {
    if(this.makeGlobal) {
      window[property] = value
    }
    this.parent[property] = value
  }

  tick() {
    if(this.makeGlobal) {
      this.userProps.forEach((property) => {
        this.parent[property] = window[property]
      })
      //  this.parent.speed = window.speed
    } else {

    }
  }

  eval(code) {
    this.sandbox.eval(code)
  }
}

module.exports = EvalSandbox

},{"./lib/array-utils.js":8,"./lib/sandbox.js":10}],3:[function(require,module,exports){
const glslTransforms = require('./glsl/glsl-functions.js')
const GlslSource = require('./glsl-source.js')
const raymarchGlsl = require('./raymarching/raymarch-glsl')

class GeneratorFactory {
  constructor ({
      defaultUniforms,
      defaultOutput,
      extendTransforms = [],
      changeListener = (() => {})
    } = {}
    ) {
    this.defaultOutput = defaultOutput
    this.defaultUniforms = defaultUniforms
    this.changeListener = changeListener
    this.extendTransforms = extendTransforms
    this.generators = {}
    this.init()
  }
  init () {
    this.glslTransforms = {}
    this.generators = Object.entries(this.generators).reduce((prev, [method, transform]) => {
      this.changeListener({type: 'remove', synth: this, method})
      return prev
    }, {})

    this.sourceClass = (() => {
      return class extends GlslSource {
      }
    })()

    let functions = glslTransforms

    // add user definied transforms
    if (Array.isArray(this.extendTransforms)) {
      functions.concat(this.extendTransforms)
    } else if (typeof this.extendTransforms === 'object' && this.extendTransforms.type) {
      functions.push(this.extendTransforms)
    }

    return functions.map((transform) => this.setFunction(transform))
 }

 _addMethod (method, transform) {
   console.log("added a method");
   console.log(method);
    this.glslTransforms[method] = transform
    if (transform.type === 'src') {
      const func = (...args) => new this.sourceClass({
        name: method,
        transform: transform,
        userArgs: args,
        defaultOutput: this.defaultOutput,
        defaultUniforms: this.defaultUniforms,
        synth: this
      })
      this.generators[method] = func
      this.changeListener({type: 'add', synth: this, method})
      return func
    } else  {
      this.sourceClass.prototype[method] = function (...args) {
        this.transforms.push({name: method, transform: transform, userArgs: args})
        return this
      }
    }
    return undefined
  }

  setFunction(obj) {
    var processedGlsl = processGlsl(obj)
    if(processedGlsl) this._addMethod(obj.name, processedGlsl)
  }

  setRaymarcher(obj) {
    console.log("using jocrob hydra synth")
    const rm =  new raymarchGlsl(obj)
    this.setFunction(rm.srcObj())
  }
}

const typeLookup = {
  'src': {
    returnType: 'vec4',
    args: ['vec2 _st']
  },
  'coord': {
    returnType: 'vec2',
    args: ['vec2 _st']
  },
  'color': {
    returnType: 'vec4',
    args: ['vec4 _c0']
  },
  'combine': {
    returnType: 'vec4',
    args: ['vec4 _c0', 'vec4 _c1']
  },
  'combineCoord': {
    returnType: 'vec2',
    args: ['vec2 _st', 'vec4 _c0']
  }
}
// expects glsl of format
// {
//   name: 'osc', // name that will be used to access function as well as within glsl
//   type: 'src', // can be src: vec4(vec2 _st), coord: vec2(vec2 _st), color: vec4(vec4 _c0), combine: vec4(vec4 _c0, vec4 _c1), combineCoord: vec2(vec2 _st, vec4 _c0)
//   inputs: [
//     {
//       name: 'freq',
//       type: 'float', // 'float'   //, 'texture', 'vec4'
//       default: 0.2
//     },
//     {
//           name: 'sync',
//           type: 'float',
//           default: 0.1
//         },
//         {
//           name: 'offset',
//           type: 'float',
//           default: 0.0
//         }
//   ],
   //  glsl: `
   //    vec2 st = _st;
   //    float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
   //    float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
   //    float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
   //    return vec4(r, g, b, 1.0);
   // `
// }

// // generates glsl function:
// `vec4 osc(vec2 _st, float freq, float sync, float offset){
//  vec2 st = _st;
//  float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
//  float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
//  float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
//  return vec4(r, g, b, 1.0);
// }`

function processGlsl(obj) {
  let t = typeLookup[obj.type]
  if(t) {
  let baseArgs = t.args.map((arg) => arg).join(", ")
  // @todo: make sure this works for all input types, add validation
  let customArgs = obj.inputs.map((input) => `${input.type} ${input.name}`).join(', ')
  let args = `${baseArgs}${customArgs.length > 0 ? ', '+ customArgs: ''}`
//  console.log('args are ', args)

    let glslFunction =
`
  ${t.returnType} ${obj.name}(${args}) {
      ${obj.glsl}
  }
`

  // add extra input to beginning for backward combatibility @todo update compiler so this is no longer necessary
    if(obj.type === 'combine' || obj.type === 'combineCoord') obj.inputs.unshift({
        name: 'color',
        type: 'vec4'
      })
    return Object.assign({}, obj, { glsl: glslFunction})
  } else {
    console.warn(`type ${obj.type} not recognized`, obj)
  }

}

module.exports = GeneratorFactory

},{"./glsl-source.js":4,"./glsl/glsl-functions.js":6,"./raymarching/raymarch-glsl":11}],4:[function(require,module,exports){
const generateGlsl = require('./glsl-utils.js').generateGlsl
const formatArguments = require('./glsl-utils.js').formatArguments

// const glslTransforms = require('./glsl/composable-glsl-functions.js')
const utilityGlsl = require('./glsl/utility-functions.js')

var GlslSource = function (obj) {
  this.transforms = []
  this.transforms.push(obj)
  this.defaultOutput = obj.defaultOutput
  this.synth = obj.synth
  this.type = 'GlslSource'
  this.defaultUniforms = obj.defaultUniforms
  return this
}

GlslSource.prototype.addTransform = function (obj)  {
    this.transforms.push(obj)
}

GlslSource.prototype.out = function (_output) {
  var output = _output || this.defaultOutput
  var glsl = this.glsl(output)
  this.synth.currentFunctions = []
 // output.renderPasses(glsl)
  if(output) try{
    output.render(glsl)
  } catch (error) {
    console.log('shader could not compile', error)
  }
}

GlslSource.prototype.glsl = function () {
  //var output = _output || this.defaultOutput
  var self = this
  // uniforms included in all shaders
//  this.defaultUniforms = output.uniforms
  var passes = []
  var transforms = []
//  console.log('output', output)
  this.transforms.forEach((transform) => {
    if(transform.transform.type === 'renderpass'){
      // if (transforms.length > 0) passes.push(this.compile(transforms, output))
      // transforms = []
      // var uniforms = {}
      // const inputs = formatArguments(transform, -1)
      // inputs.forEach((uniform) => { uniforms[uniform.name] = uniform.value })
      //
      // passes.push({
      //   frag: transform.transform.frag,
      //   uniforms: Object.assign({}, self.defaultUniforms, uniforms)
      // })
      // transforms.push({name: 'prev', transform:  glslTransforms['prev'], synth: this.synth})
      console.warn('no support for renderpass')
    } else {
      transforms.push(transform)
    }
  })

  if (transforms.length > 0) passes.push(this.compile(transforms))

  return passes
}

GlslSource.prototype.compile = function (transforms) {

  console.log(`funcs passed to generate glsl: `);
  console.log(transforms);

  var shaderInfo = generateGlsl(transforms)
  var uniforms = {}
  shaderInfo.uniforms.forEach((uniform) => { uniforms[uniform.name] = uniform.value })

  var frag = `
  precision mediump float;
  ${Object.values(shaderInfo.uniforms).map((uniform) => {
    let type = uniform.type
    switch (uniform.type) {
      case 'texture':
        type = 'sampler2D'
        break
    }
    return `
      uniform ${type} ${uniform.name};`
  }).join('')}
  uniform float time;
  uniform vec2 resolution;
  varying vec2 uv;
  uniform sampler2D prevBuffer;

  ${Object.values(utilityGlsl).map((transform) => {
  //  console.log(transform.glsl)
    return `
            ${transform.glsl}
          `
  }).join('')}

  ${shaderInfo.glslFunctions.map((transform) => {
    if(transform.transform.raymarcher) {
      console.log('raymarcher found')
      return `
            ${transform.transform.helperGlsl}
          `
    }
  }).join('')}

  ${shaderInfo.glslFunctions.map((transform) => {
    return `
            ${transform.transform.glsl}
          `
  }).join('')}

  void main () {
    vec4 c = vec4(1, 0, 0, 1);
    vec2 st = gl_FragCoord.xy/resolution.xy;
    gl_FragColor = ${shaderInfo.fragColor};
  }
  `

  // console.log(frag);

  return {
    frag: frag,
    uniforms: Object.assign({}, this.defaultUniforms, uniforms)
  }

}

module.exports = GlslSource

},{"./glsl-utils.js":5,"./glsl/utility-functions.js":7}],5:[function(require,module,exports){
// converts a tree of javascript functions to a shader

// Add extra functionality to Array.prototype for generating sequences in time
const arrayUtils = require('./lib/array-utils.js')

// [WIP] how to treat different dimensions (?)
const DEFAULT_CONVERSIONS = {
  float: {
    'vec4': {name: 'sum', args: [[1, 1, 1, 1]]},
    'vec2': {name: 'sum', args: [[1, 1]]}
  }
}

module.exports = {
  generateGlsl: function (transforms) {
    var shaderParams = {
      uniforms: [], // list of uniforms used in shader
      glslFunctions: [], // list of functions used in shader
      fragColor: ''
    }

    var gen = generateGlsl(transforms, shaderParams)('st')
    shaderParams.fragColor = gen
    // remove uniforms with duplicate names
    let uniforms = {}
    shaderParams.uniforms.forEach((uniform) => uniforms[uniform.name] = uniform)
    shaderParams.uniforms = Object.values(uniforms)
    return shaderParams
  },
  formatArguments: formatArguments
}
// recursive function for generating shader string from object containing functions and user arguments. Order of functions in string depends on type of function
// to do: improve variable names
function generateGlsl (transforms, shaderParams) {

  // transform function that outputs a shader string corresponding to gl_FragColor
  var fragColor = () => ''
  // var uniforms = []
  // var glslFunctions = []
  transforms.forEach((transform) => {
    var inputs = formatArguments(transform, shaderParams.uniforms.length)
  //  console.log('inputs', inputs, transform)
    inputs.forEach((input) => {
      if(input.isUniform) shaderParams.uniforms.push(input)
    })

    // add new glsl function to running list of functions
    if(!contains(transform, shaderParams.glslFunctions)) shaderParams.glslFunctions.push(transform)

    // current function for generating frag color shader code
    var f0 = fragColor
    if (transform.transform.type === 'src') {
      fragColor = (uv) => `${shaderString(uv, transform.name, inputs, shaderParams)}`
    } else if (transform.transform.type === 'coord') {
      fragColor = (uv) => `${f0(`${shaderString(uv, transform.name, inputs, shaderParams)}`)}`
    } else if (transform.transform.type === 'color') {
      fragColor = (uv) =>  `${shaderString(`${f0(uv)}`, transform.name, inputs, shaderParams)}`
    } else if (transform.transform.type === 'combine') {
      // combining two generated shader strings (i.e. for blend, mult, add funtions)
      var f1 = inputs[0].value && inputs[0].value.transforms ?
      (uv) => `${generateGlsl(inputs[0].value.transforms, shaderParams)(uv)}` :
      (inputs[0].isUniform ? () => inputs[0].name : () => inputs[0].value)
      fragColor = (uv) => `${shaderString(`${f0(uv)}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`
    } else if (transform.transform.type === 'combineCoord') {
      // combining two generated shader strings (i.e. for modulate functions)
      var f1 = inputs[0].value && inputs[0].value.transforms ?
      (uv) => `${generateGlsl(inputs[0].value.transforms, shaderParams)(uv)}` :
      (inputs[0].isUniform ? () => inputs[0].name : () => inputs[0].value)
      fragColor = (uv) => `${f0(`${shaderString(`${uv}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`)}`


    }
  })
//  console.log(fragColor)
  //  break;
  return fragColor
}

// assembles a shader string containing the arguments and the function name, i.e. 'osc(uv, frequency)'
function shaderString (uv, method, inputs, shaderParams) {
  const str = inputs.map((input) => {
    if (input.isUniform) {
      return input.name
    } else if (input.value && input.value.transforms) {
      // this by definition needs to be a generator, hence we start with 'st' as the initial value for generating the glsl fragment
      return `${generateGlsl(input.value.transforms, shaderParams)('st')}`
    }
    return input.value
  }).reduce((p, c) => `${p}, ${c}`, '')

  return `${method}(${uv}${str})`
}

// merge two arrays and remove duplicates
function mergeArrays (a, b) {
  return a.concat(b.filter(function (item) {
    return a.indexOf(item) < 0;
  }))
}

// check whether array
function contains(object, arr) {
  for(var i = 0; i < arr.length; i++){
    if(object.name == arr[i].name) return true
  }
  return false
}

function fillArrayWithDefaults (arr, len) {
  // fill the array with default values if it's too short
  while (arr.length < len) {
    if (arr.length === 3) { // push a 1 as the default for .a in vec4
      arr.push(1.0)
    } else {
      arr.push(0.0)
    }
  }
  return arr.slice(0, len)
}

const ensure_decimal_dot = (val) => {
  val = val.toString()
  if (val.indexOf('.') < 0) {
    val += '.'
  }
  return val
}

function formatArguments (transform, startIndex) {
  //  console.log('processing args', transform, startIndex)
  const defaultArgs = transform.transform.inputs
  const userArgs = transform.userArgs
  const allArgsUniform = transform.transform.allArgsUniform
  return defaultArgs.map( (input, index) => {
    const typedArg = {
      value: input.default,
      type: input.type, //
      isUniform: false,
      name: input.name,
      vecLen: 0
      //  generateGlsl: null // function for creating glsl
    }

    if(typedArg.type === 'float' && !allArgsUniform) typedArg.value = ensure_decimal_dot(input.default)
    if (input.type.startsWith('vec')) {
      try {
        typedArg.vecLen = Number.parseInt(input.type.substr(3))
      } catch (e) {
        console.log(`Error determining length of vector input type ${input.type} (${input.name})`)
      }
    }

    //Converting arg values to functions so they'll be set as uniforms in the fragment shader
    if (allArgsUniform) {
      if (userArgs.length > index && typeof userArgs[index] !== 'function') {
        const val = userArgs[index]
        userArgs[index] = () => val
      }
      else if (userArgs.length <= index) {
        const val = typedArg.value
        if (typeof typedArg.value !== 'function') {
          userArgs.push(() => val)
        }
        else {
          userArgs.push(val)
        }
      }
    }

    // if user has input something for this argument
    if(userArgs.length > index) {
      typedArg.value = userArgs[index]
      // do something if a composite or transform

      if (typeof userArgs[index] === 'function') {
        if (typedArg.vecLen > 0) { // expected input is a vector, not a scalar
          typedArg.value = (context, props, batchId) => (fillArrayWithDefaults(userArgs[index](props), typedArg.vecLen))
        } else {
          typedArg.value = (context, props, batchId) => {
            try {
              return userArgs[index](props)
            } catch (e) {
              console.log('ERROR', e)
              return input.default
            }
          }
        }

        typedArg.isUniform = true
      } else if (userArgs[index].constructor === Array) {
        if (typedArg.vecLen > 0) { // expected input is a vector, not a scalar
          typedArg.isUniform = true
          typedArg.value = fillArrayWithDefaults(typedArg.value, typedArg.vecLen)
        } else {
          //  console.log("is Array")
          typedArg.value = (context, props, batchId) => arrayUtils.getValue(userArgs[index])(props)
          typedArg.isUniform = true
        }
      }
    }

    if(startIndex< 0){
    } else {
      if (typedArg.value && typedArg.value.transforms) {
        const final_transform = typedArg.value.transforms[typedArg.value.transforms.length - 1]

        if (final_transform.transform.glsl_return_type !== input.type) {
          const defaults = DEFAULT_CONVERSIONS[input.type]
          if (typeof defaults !== 'undefined') {
            const default_def = defaults[final_transform.transform.glsl_return_type]
            if (typeof default_def !== 'undefined') {
              const {name, args} = default_def
              typedArg.value = typedArg.value[name](...args)
            }
          }
        }

        typedArg.isUniform = false
      } else if (typedArg.type === 'float' && typeof typedArg.value === 'number') {
        typedArg.value = ensure_decimal_dot(typedArg.value)
      } else if (typedArg.type.startsWith('vec') && typeof typedArg.value === 'object' && Array.isArray(typedArg.value)) {
        typedArg.isUniform = false
        typedArg.value = `${typedArg.type}(${typedArg.value.map(ensure_decimal_dot).join(', ')})`
      } else if (input.type === 'sampler2D') {
        // typedArg.tex = typedArg.value
        var x = typedArg.value
        typedArg.value = () => (x.getTexture())
        typedArg.isUniform = true
      } else {
        // if passing in a texture reference, when function asks for vec4, convert to vec4
        if (typedArg.value.getTexture && input.type === 'vec4') {
          var x1 = typedArg.value
          typedArg.value = src(x1)
          typedArg.isUniform = false
        }
      }

      // add tp uniform array if is a function that will pass in a different value on each render frame,
      // or a texture/ external source

      if(typedArg.isUniform && !allArgsUniform) {
        typedArg.name += startIndex
        //  shaderParams.uniforms.push(typedArg)
      }
    }
    return typedArg
  })
}

},{"./lib/array-utils.js":8}],6:[function(require,module,exports){
/*
Format for adding functions to hydra. For each entry in this file, hydra automatically generates a glsl function and javascript function with the same name. You can also ass functions dynamically using setFunction(object).

{
  name: 'osc', // name that will be used to access function in js as well as in glsl
  type: 'src', // can be 'src', 'color', 'combine', 'combineCoords'. see below for more info
  inputs: [
    {
      name: 'freq',
      type: 'float',
      default: 0.2
    },
    {
      name: 'sync',
      type: 'float',
      default: 0.1
    },
    {
      name: 'offset',
      type: 'float',
      default: 0.0
    }
  ],
    glsl: `
      vec2 st = _st;
      float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
      float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
      float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
      return vec4(r, g, b, 1.0);
   `
}

// The above code generates the glsl function:
`vec4 osc(vec2 _st, float freq, float sync, float offset){
 vec2 st = _st;
 float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
 float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
 float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
 return vec4(r, g, b, 1.0);
}`


Types and default arguments for hydra functions.
The value in the 'type' field lets the parser know which type the function will be returned as well as default arguments.

const types = {
  'src': {
    returnType: 'vec4',
    args: ['vec2 _st']
  },
  'coord': {
    returnType: 'vec2',
    args: ['vec2 _st']
  },
  'color': {
    returnType: 'vec4',
    args: ['vec4 _c0']
  },
  'combine': {
    returnType: 'vec4',
    args: ['vec4 _c0', 'vec4 _c1']
  },
  'combineCoord': {
    returnType: 'vec2',
    args: ['vec2 _st', 'vec4 _c0']
  }
}

*/

module.exports = [
  {
  name: 'noise',
  type: 'src',
  inputs: [
    {
      type: 'float',
      name: 'scale',
      default: 10,
    },
{
      type: 'float',
      name: 'offset',
      default: 0.1,
    }
  ],
  glsl:
`   return vec4(vec3(_noise(vec3(_st*scale, offset*time))), 1.0);`
},
{
  name: 'voronoi',
  type: 'src',
  inputs: [
    {
      type: 'float',
      name: 'scale',
      default: 5,
    },
{
      type: 'float',
      name: 'speed',
      default: 0.3,
    },
{
      type: 'float',
      name: 'blending',
      default: 0.3,
    }
  ],
  glsl:
`   vec3 color = vec3(.0);
   // Scale
   _st *= scale;
   // Tile the space
   vec2 i_st = floor(_st);
   vec2 f_st = fract(_st);
   float m_dist = 10.;  // minimun distance
   vec2 m_point;        // minimum point
   for (int j=-1; j<=1; j++ ) {
   for (int i=-1; i<=1; i++ ) {
   vec2 neighbor = vec2(float(i),float(j));
   vec2 p = i_st + neighbor;
   vec2 point = fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
   point = 0.5 + 0.5*sin(time*speed + 6.2831*point);
   vec2 diff = neighbor + point - f_st;
   float dist = length(diff);
   if( dist < m_dist ) {
   m_dist = dist;
   m_point = point;
   }
   }
   }
   // Assign a color using the closest point position
   color += dot(m_point,vec2(.3,.6));
   color *= 1.0 - blending*m_dist;
   return vec4(color, 1.0);`
},
{
  name: 'osc',
  type: 'src',
  inputs: [
    {
      type: 'float',
      name: 'frequency',
      default: 60,
    },
{
      type: 'float',
      name: 'sync',
      default: 0.1,
    },
{
      type: 'float',
      name: 'offset',
      default: 0,
    }
  ],
  glsl:
`   vec2 st = _st;
   float r = sin((st.x-offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   float g = sin((st.x+time*sync)*frequency)*0.5 + 0.5;
   float b = sin((st.x+offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   return vec4(r, g, b, 1.0);`
},
{
  name: 'shape',
  type: 'src',
  inputs: [
    {
      type: 'float',
      name: 'sides',
      default: 3,
    },
{
      type: 'float',
      name: 'radius',
      default: 0.3,
    },
{
      type: 'float',
      name: 'smoothing',
      default: 0.01,
    }
  ],
  glsl:
`   vec2 st = _st * 2. - 1.;
   // Angle and radius from the current pixel
   float a = atan(st.x,st.y)+3.1416;
   float r = (2.*3.1416)/sides;
   float d = cos(floor(.5+a/r)*r-a)*length(st);
   return vec4(vec3(1.0-smoothstep(radius,radius + smoothing,d)), 1.0);`
},
{
  name: 'gradient',
  type: 'src',
  inputs: [
    {
      type: 'float',
      name: 'speed',
      default: 0,
    }
  ],
  glsl:
`   return vec4(_st, sin(time*speed), 1.0);`
},
{
  name: 'src',
  type: 'src',
  inputs: [
    {
      type: 'sampler2D',
      name: 'tex',
      default: NaN,
    }
  ],
  glsl:
`   //  vec2 uv = gl_FragCoord.xy/vec2(1280., 720.);
   return texture2D(tex, fract(_st));`
},
{
  name: 'solid',
  type: 'src',
  inputs: [
    {
      type: 'float',
      name: 'r',
      default: 0,
    },
{
      type: 'float',
      name: 'g',
      default: 0,
    },
{
      type: 'float',
      name: 'b',
      default: 0,
    },
{
      type: 'float',
      name: 'a',
      default: 1,
    }
  ],
  glsl:
`   return vec4(r, g, b, a);`
},
{
  name: 'rotate',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'angle',
      default: 10,
    },
{
      type: 'float',
      name: 'speed',
      default: 0,
    }
  ],
  glsl:
`   vec2 xy = _st - vec2(0.5);
   float ang = angle + speed *time;
   xy = mat2(cos(ang),-sin(ang), sin(ang),cos(ang))*xy;
   xy += 0.5;
   return xy;`
},
{
  name: 'scale',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 1.5,
    },
{
      type: 'float',
      name: 'xMult',
      default: 1,
    },
{
      type: 'float',
      name: 'yMult',
      default: 1,
    },
{
      type: 'float',
      name: 'offsetX',
      default: 0.5,
    },
{
      type: 'float',
      name: 'offsetY',
      default: 0.5,
    }
  ],
  glsl:
`   vec2 xy = _st - vec2(offsetX, offsetY);
   xy*=(1.0/vec2(amount*xMult, amount*yMult));
   xy+=vec2(offsetX, offsetY);
   return xy;
   `
},
{
  name: 'pixelate',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'pixelX',
      default: 20,
    },
{
      type: 'float',
      name: 'pixelY',
      default: 20,
    }
  ],
  glsl:
`   vec2 xy = vec2(pixelX, pixelY);
   return (floor(_st * xy) + 0.5)/xy;`
},
{
  name: 'posterize',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'bins',
      default: 3,
    },
{
      type: 'float',
      name: 'gamma',
      default: 0.6,
    }
  ],
  glsl:
`   vec4 c2 = pow(_c0, vec4(gamma));
   c2 *= vec4(bins);
   c2 = floor(c2);
   c2/= vec4(bins);
   c2 = pow(c2, vec4(1.0/gamma));
   return vec4(c2.xyz, _c0.a);`
},
{
  name: 'shift',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'r',
      default: 0.5,
    },
{
      type: 'float',
      name: 'g',
      default: 0,
    },
{
      type: 'float',
      name: 'b',
      default: 0,
    },
{
      type: 'float',
      name: 'a',
      default: 0,
    }
  ],
  glsl:
`   vec4 c2 = vec4(_c0);
   c2.r = fract(c2.r + r);
   c2.g = fract(c2.g + g);
   c2.b = fract(c2.b + b);
   c2.a = fract(c2.a + a);
   return vec4(c2.rgba);`
},
{
  name: 'repeat',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'repeatX',
      default: 3,
    },
{
      type: 'float',
      name: 'repeatY',
      default: 3,
    },
{
      type: 'float',
      name: 'offsetX',
      default: 0,
    },
{
      type: 'float',
      name: 'offsetY',
      default: 0,
    }
  ],
  glsl:
`   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) * offsetX;
   st.y += step(1., mod(st.x,2.0)) * offsetY;
   return fract(st);`
},
{
  name: 'modulateRepeat',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'repeatX',
      default: 3,
    },
{
      type: 'float',
      name: 'repeatY',
      default: 3,
    },
{
      type: 'float',
      name: 'offsetX',
      default: 0.5,
    },
{
      type: 'float',
      name: 'offsetY',
      default: 0.5,
    }
  ],
  glsl:
`   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offsetX;
   st.y += step(1., mod(st.x,2.0)) + _c0.g * offsetY;
   return fract(st);`
},
{
  name: 'repeatX',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'reps',
      default: 3,
    },
{
      type: 'float',
      name: 'offset',
      default: 0,
    }
  ],
  glsl:
`   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0))* offset;
   return fract(st);`
},
{
  name: 'modulateRepeatX',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'reps',
      default: 3,
    },
{
      type: 'float',
      name: 'offset',
      default: 0.5,
    }
  ],
  glsl:
`   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0)) + _c0.r * offset;
   return fract(st);`
},
{
  name: 'repeatY',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'reps',
      default: 3,
    },
{
      type: 'float',
      name: 'offset',
      default: 0,
    }
  ],
  glsl:
`   vec2 st = _st * vec2(1.0, reps);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0))* offset;
   return fract(st);`
},
{
  name: 'modulateRepeatY',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'reps',
      default: 3,
    },
{
      type: 'float',
      name: 'offset',
      default: 0.5,
    }
  ],
  glsl:
`   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offset;
   return fract(st);`
},
{
  name: 'kaleid',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'nSides',
      default: 4,
    }
  ],
  glsl:
`   vec2 st = _st;
   st -= 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return r*vec2(cos(a), sin(a));`
},
{
  name: 'modulateKaleid',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'nSides',
      default: 4,
    }
  ],
  glsl:
`   vec2 st = _st - 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return (_c0.r+r)*vec2(cos(a), sin(a));`
},
{
  name: 'scroll',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'scrollX',
      default: 0.5,
    },
{
      type: 'float',
      name: 'scrollY',
      default: 0.5,
    },
{
      type: 'float',
      name: 'speedX',
      default: 0,
    },
{
      type: 'float',
      name: 'speedY',
      default: 0,
    }
  ],
  glsl:
`
   _st.x += scrollX + time*speedX;
   _st.y += scrollY + time*speedY;
   return fract(_st);`
},
{
  name: 'scrollX',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'scrollX',
      default: 0.5,
    },
{
      type: 'float',
      name: 'speed',
      default: 0,
    }
  ],
  glsl:
`   _st.x += scrollX + time*speed;
   return fract(_st);`
},
{
  name: 'modulateScrollX',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'scrollX',
      default: 0.5,
    },
{
      type: 'float',
      name: 'speed',
      default: 0,
    }
  ],
  glsl:
`   _st.x += _c0.r*amount + time*speed;
   return fract(_st);`
},
{
  name: 'scrollY',
  type: 'coord',
  inputs: [
    {
      type: 'float',
      name: 'scrollY',
      default: 0.5,
    },
{
      type: 'float',
      name: 'speed',
      default: 0,
    }
  ],
  glsl:
`   _st.y += scrollY + time*speed;
   return fract(_st);`
},
{
  name: 'modulateScrollY',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'scrollY',
      default: 0.5,
    },
{
      type: 'float',
      name: 'speed',
      default: 0,
    }
  ],
  glsl:
`   _st.y += _c0.r*scrollY + time*speed;
   return fract(_st);`
},
{
  name: 'add',
  type: 'combine',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 1,
    }
  ],
  glsl:
`   return (_c0+_c1)*amount + _c0*(1.0-amount);`
},
{
  name: 'sub',
  type: 'combine',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 1,
    }
  ],
  glsl:
`   return (_c0-_c1)*amount + _c0*(1.0-amount);`
},
{
  name: 'layer',
  type: 'combine',
  inputs: [

  ],
  glsl:
`   return vec4(mix(_c0.rgb, _c1.rgb, _c1.a), _c0.a+_c1.a);`
},
{
  name: 'blend',
  type: 'combine',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 0.5,
    }
  ],
  glsl:
`   return _c0*(1.0-amount)+_c1*amount;`
},
{
  name: 'mult',
  type: 'combine',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 1,
    }
  ],
  glsl:
`   return _c0*(1.0-amount)+(_c0*_c1)*amount;`
},
{
  name: 'diff',
  type: 'combine',
  inputs: [

  ],
  glsl:
`   return vec4(abs(_c0.rgb-_c1.rgb), max(_c0.a, _c1.a));`
},
{
  name: 'modulate',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 0.1,
    }
  ],
  glsl:
`   //  return fract(st+(_c0.xy-0.5)*amount);
   return _st + _c0.xy*amount;`
},
{
  name: 'modulateScale',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'multiple',
      default: 1,
    },
{
      type: 'float',
      name: 'offset',
      default: 1,
    }
  ],
  glsl:
`   vec2 xy = _st - vec2(0.5);
   xy*=(1.0/vec2(offset + multiple*_c0.r, offset + multiple*_c0.g));
   xy+=vec2(0.5);
   return xy;`
},
{
  name: 'modulatePixelate',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'multiple',
      default: 10,
    },
{
      type: 'float',
      name: 'offset',
      default: 3,
    }
  ],
  glsl:
`   vec2 xy = vec2(offset + _c0.x*multiple, offset + _c0.y*multiple);
   return (floor(_st * xy) + 0.5)/xy;`
},
{
  name: 'modulateRotate',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'multiple',
      default: 1,
    },
{
      type: 'float',
      name: 'offset',
      default: 0,
    }
  ],
  glsl:
`   vec2 xy = _st - vec2(0.5);
   float angle = offset + _c0.x * multiple;
   xy = mat2(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
   xy += 0.5;
   return xy;`
},
{
  name: 'modulateHue',
  type: 'combineCoord',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 1,
    }
  ],
  glsl:
`   return _st + (vec2(_c0.g - _c0.r, _c0.b - _c0.g) * amount * 1.0/resolution);`
},
{
  name: 'invert',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 1,
    }
  ],
  glsl:
`   return vec4((1.0-_c0.rgb)*amount + _c0.rgb*(1.0-amount), _c0.a);`
},
{
  name: 'contrast',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 1.6,
    }
  ],
  glsl:
`   vec4 c = (_c0-vec4(0.5))*vec4(amount) + vec4(0.5);
   return vec4(c.rgb, _c0.a);`
},
{
  name: 'brightness',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 0.4,
    }
  ],
  glsl:
`   return vec4(_c0.rgb + vec3(amount), _c0.a);`
},
{
  name: 'mask',
  type: 'combine',
  inputs: [

  ],
  glsl:
`   float a = _luminance(_c1.rgb);
   return vec4(_c0.rgb*a, a);`
},
{
  name: 'luma',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'threshold',
      default: 0.5,
    },
{
      type: 'float',
      name: 'tolerance',
      default: 0.1,
    }
  ],
  glsl:
`   float a = smoothstep(threshold-tolerance, threshold+tolerance, _luminance(_c0.rgb));
   return vec4(_c0.rgb*a, a);`
},
{
  name: 'thresh',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'threshold',
      default: 0.5,
    },
{
      type: 'float',
      name: 'tolerance',
      default: 0.04,
    }
  ],
  glsl:
`   return vec4(vec3(smoothstep(threshold-tolerance, threshold+tolerance, _luminance(_c0.rgb))), _c0.a);`
},
{
  name: 'color',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'r',
      default: 1,
    },
{
      type: 'float',
      name: 'g',
      default: 1,
    },
{
      type: 'float',
      name: 'b',
      default: 1,
    },
{
      type: 'float',
      name: 'a',
      default: 1,
    }
  ],
  glsl:
`   vec4 c = vec4(r, g, b, a);
   vec4 pos = step(0.0, c); // detect whether negative
   // if > 0, return r * _c0
   // if < 0 return (1.0-r) * _c0
   return vec4(mix((1.0-_c0)*abs(c), c*_c0, pos));`
},
{
  name: 'saturate',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 2,
    }
  ],
  glsl:
`   const vec3 W = vec3(0.2125, 0.7154, 0.0721);
   vec3 intensity = vec3(dot(_c0.rgb, W));
   return vec4(mix(intensity, _c0.rgb, amount), _c0.a);`
},
{
  name: 'hue',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'hue',
      default: 0.4,
    }
  ],
  glsl:
`   vec3 c = _rgbToHsv(_c0.rgb);
   c.r += hue;
   //  c.r = fract(c.r);
   return vec4(_hsvToRgb(c), _c0.a);`
},
{
  name: 'colorama',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'amount',
      default: 0.005,
    }
  ],
  glsl:
`   vec3 c = _rgbToHsv(_c0.rgb);
   c += vec3(amount);
   c = _hsvToRgb(c);
   c = fract(c);
   return vec4(c, _c0.a);`
},
{
  name: 'prev',
  type: 'src',
  inputs: [

  ],
  glsl:
`   return texture2D(prevBuffer, fract(_st));`
},
{
  name: 'sum',
  type: 'color',
  inputs: [
    {
      type: 'vec4',
      name: 'scale',
      default: 1,
    }
  ],
  glsl:
`   vec4 v = _c0 * s;
   return v.r + v.g + v.b + v.a;
   }
   float sum(vec2 _st, vec4 s) { // vec4 is not a typo, because argument type is not overloaded
   vec2 v = _st.xy * s.xy;
   return v.x + v.y;`
},
{
  name: 'r',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'scale',
      default: 1,
    },
{
      type: 'float',
      name: 'offset',
      default: 0,
    }
  ],
  glsl:
`   return vec4(_c0.r * scale + offset);`
},
{
  name: 'g',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'scale',
      default: 1,
    },
{
      type: 'float',
      name: 'offset',
      default: 0,
    }
  ],
  glsl:
`   return vec4(_c0.g * scale + offset);`
},
{
  name: 'b',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'scale',
      default: 1,
    },
{
      type: 'float',
      name: 'offset',
      default: 0,
    }
  ],
  glsl:
`   return vec4(_c0.b * scale + offset);`
},
{
  name: 'a',
  type: 'color',
  inputs: [
    {
      type: 'float',
      name: 'scale',
      default: 1,
    },
{
      type: 'float',
      name: 'offset',
      default: 0,
    }
  ],
  glsl:
`   return vec4(_c0.a * scale + offset);`
}
]

},{}],7:[function(require,module,exports){
// functions that are only used within other functions

module.exports = {
  _luminance: {
    type: 'util',
    glsl: `float _luminance(vec3 rgb){
      const vec3 W = vec3(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`
  },
  _noise: {
    type: 'util',
    glsl: `
    //	Simplex 3D Noise
    //	by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float _noise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0. + 0.0 * C
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
    float n_ = 1.0/7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

  // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }
    `
  },


  _rgbToHsv: {
    type: 'util',
    glsl: `vec3 _rgbToHsv(vec3 c){
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }`
  },
  _hsvToRgb: {
    type: 'util',
    glsl: `vec3 _hsvToRgb(vec3 c){
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }`
  }
}

},{}],8:[function(require,module,exports){
// WIP utils for working with arrays
// Possibly should be integrated with lfo extension, etc.
// to do: transform time rather than array values, similar to working with coordinates in hydra

var easing = require('./easing-functions.js')

var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

module.exports = {
  init: () => {

    Array.prototype.fast = function(speed = 1) {
      this._speed = speed
      return this
    }

    Array.prototype.smooth = function(smooth = 1) {
      this._smooth = smooth
      return this
    }

    Array.prototype.ease = function(ease = 'linear') {
      if (typeof ease == 'function') {
        this._smooth = 1
        this._ease = ease
      }
      else if (easing[ease]){
        this._smooth = 1
        this._ease = easing[ease]
      }
      return this
    }

    Array.prototype.offset = function(offset = 0.5) {
      this._offset = offset%1.0
      return this
    }

    // Array.prototype.bounce = function() {
    //   this.modifiers.bounce = true
    //   return this
    // }

    Array.prototype.fit = function(low = 0, high =1) {
      let lowest = Math.min(...this)
      let highest =  Math.max(...this)
      var newArr = this.map((num) => map(num, lowest, highest, low, high))
      newArr._speed = this._speed
      newArr._smooth = this._smooth
      newArr._ease = this._ease
      return newArr
    }
  },

  getValue: (arr = []) => ({time, bpm}) =>{
    let speed = arr._speed ? arr._speed : 1
    let smooth = arr._smooth ? arr._smooth : 0
    let index = time * speed * (bpm / 60) + (arr._offset || 0)

    if (smooth!==0) {
      let ease = arr._ease ? arr._ease : easing['linear']
      let _index = index - (smooth / 2)
      let currValue = arr[Math.floor(_index % (arr.length))]
      let nextValue = arr[Math.floor((_index + 1) % (arr.length))]
      let t = Math.min((_index%1)/smooth,1)
      return ease(t) * (nextValue - currValue) + currValue
    }
    else {
      return arr[Math.floor(index % (arr.length))]
    }
  }
}

},{"./easing-functions.js":9}],9:[function(require,module,exports){
// from https://gist.github.com/gre/1650294

module.exports = {
  // no easing, no acceleration
  linear: function (t) { return t },
  // accelerating from zero velocity
  easeInQuad: function (t) { return t*t },
  // decelerating to zero velocity
  easeOutQuad: function (t) { return t*(2-t) },
  // acceleration until halfway, then deceleration
  easeInOutQuad: function (t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t },
  // accelerating from zero velocity
  easeInCubic: function (t) { return t*t*t },
  // decelerating to zero velocity
  easeOutCubic: function (t) { return (--t)*t*t+1 },
  // acceleration until halfway, then deceleration
  easeInOutCubic: function (t) { return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 },
  // accelerating from zero velocity
  easeInQuart: function (t) { return t*t*t*t },
  // decelerating to zero velocity
  easeOutQuart: function (t) { return 1-(--t)*t*t*t },
  // acceleration until halfway, then deceleration
  easeInOutQuart: function (t) { return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t },
  // accelerating from zero velocity
  easeInQuint: function (t) { return t*t*t*t*t },
  // decelerating to zero velocity
  easeOutQuint: function (t) { return 1+(--t)*t*t*t*t },
  // acceleration until halfway, then deceleration
  easeInOutQuint: function (t) { return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t },
  // sin shape
  sin: function (t) { return (1 + Math.sin(Math.PI*t-Math.PI/2))/2 }
}

},{}],10:[function(require,module,exports){
// attempt custom evaluation sandbox for hydra functions
// for now, just avoids polluting the global namespace
// should probably be replaced with an abstract syntax tree

module.exports = (parent) => {
  var initialCode = ``

  var sandbox = createSandbox(initialCode)

  var addToContext = (name, object) => {
    initialCode += `
      var ${name} = ${object}
    `
    sandbox = createSandbox(initialCode)
  }


  return {
    addToContext: addToContext,
    eval: (code) => sandbox.eval(code)
  }

  function createSandbox (initial) {
    eval(initial)
    // optional params
    var localEval = function (code)  {
      eval(code)
    }

    // API/data for end-user
    return {
      eval: localEval
    }
  }
}

},{}],11:[function(require,module,exports){
const sdfs = require('./sdf-funcs.js')

//single variable values like cameraPos should be set to defaults, code block values should be set to null and have checks in generate method
class raymarchGlsl {
    constructor({
        name = 'raymarcher',
        inputs = [],
        lightPos = 'vec3(0, 5, 6)',
        distFunc = null,
        rayMarchFunc = null,
        lightFunc = null
    } = {}) {
        this.name = name
        this.inputs = inputs
        this.lightPos = lightPos
        this.distFunc = distFunc
        this.rayMarchFunc = rayMarchFunc
        this.lightFunc = lightFunc
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
    `
    }
}

module.exports = raymarchGlsl
},{"./sdf-funcs.js":12}],12:[function(require,module,exports){
//Signed distance function primitives and operations by Inigo Quilez
//More info and functions can be found at https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm

module.exports = `
    float dot2( in vec2 v ) { return dot(v,v); }
    float dot2( in vec3 v ) { return dot(v,v); }
    float ndot( in vec2 a, in vec2 b ) { return a.x*b.x - a.y*b.y; }

    float sdSphere( vec3 p, float s )
    {
        return length(p)-s;
    }

    float sdBox( vec3 p, vec3 b )
    {
        vec3 q = abs(p) - b;
        return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }

    float sdRoundBox( vec3 p, vec3 b, float r )
    {
        vec3 q = abs(p) - b;
        return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
    }

    float sdBoundingBox( vec3 p, vec3 b, float e )
    {
        p = abs(p  )-b;
        vec3 q = abs(p+e)-e;
        return min(min(
        length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
        length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
        length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
    }

    float sdTorus( vec3 p, vec2 t )
    {
        vec2 q = vec2(length(p.xz)-t.x,p.y);
        return length(q)-t.y;
    }

    float sdCappedTorus(in vec3 p, in vec2 sc, in float ra, in float rb)
    {
        p.x = abs(p.x);
        float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
        return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
    }

    float sdLink( vec3 p, float le, float r1, float r2 )
    {
        vec3 q = vec3( p.x, max(abs(p.y)-le,0.0), p.z );
        return length(vec2(length(q.xy)-r1,q.z)) - r2;
    }

    float sdCylinder( vec3 p, vec3 c )
    {
        return length(p.xz-c.xy)-c.z;
    }

    float sdCone( in vec3 p, in vec2 c, float h )
    {
        // c is the sin/cos of the angle, h is height
        // Alternatively pass q instead of (c,h),
        // which is the point at the base in 2D
        vec2 q = h*vec2(c.x/c.y,-1.0);
            
        vec2 w = vec2( length(p.xz), p.y );
        vec2 a = w - q*clamp( dot(w,q)/dot(q,q), 0.0, 1.0 );
        vec2 b = w - q*vec2( clamp( w.x/q.x, 0.0, 1.0 ), 1.0 );
        float k = sign( q.y );
        float d = min(dot( a, a ),dot(b, b));
        float s = max( k*(w.x*q.y-w.y*q.x),k*(w.y-q.y)  );
        return sqrt(d)*sign(s);
    }

    float sdPlane( vec3 p, vec3 n, float h )
    {
        // n must be normalized
        return dot(p,n) + h;
    }

    float sdHexPrism( vec3 p, vec2 h )
    {
        const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
        p = abs(p);
        p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
        vec2 d = vec2(
            length(p.xy-vec2(clamp(p.x,-k.z*h.x,k.z*h.x), h.x))*sign(p.y-h.x),
            p.z-h.y );
        return min(max(d.x,d.y),0.0) + length(max(d,0.0));
    }

    float sdTriPrism( vec3 p, vec2 h )
    {
        vec3 q = abs(p);
        return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5);
    }

    float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
    {
        vec3 pa = p - a, ba = b - a;
        float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
        return length( pa - ba*h ) - r;
    }

    float sdVerticalCapsule( vec3 p, float h, float r )
    {
        p.y -= clamp( p.y, 0.0, h );
        return length( p ) - r;
    }

    float sdCappedCylinder( vec3 p, float h, float r )
    {
        vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(h,r);
        return min(max(d.x,d.y),0.0) + length(max(d,0.0));
    }

    float sdRoundedCylinder( vec3 p, float ra, float rb, float h )
    {
        vec2 d = vec2( length(p.xz)-2.0*ra+rb, abs(p.y) - h );
        return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - rb;
    }

    float sdCappedCone( vec3 p, float h, float r1, float r2 )
    {
        vec2 q = vec2( length(p.xz), p.y );
        vec2 k1 = vec2(r2,h);
        vec2 k2 = vec2(r2-r1,2.0*h);
        vec2 ca = vec2(q.x-min(q.x,(q.y<0.0)?r1:r2), abs(q.y)-h);
        vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot2(k2), 0.0, 1.0 );
        float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
        return s*sqrt( min(dot2(ca),dot2(cb)) );
    }

    float sdSolidAngle(vec3 p, vec2 c, float ra)
    {
        // c is the sin/cos of the angle
        vec2 q = vec2( length(p.xz), p.y );
        float l = length(q) - ra;
        float m = length(q - c*clamp(dot(q,c),0.0,ra) );
        return max(l,m*sign(c.y*q.x-c.x*q.y));
    }

    float sdRoundCone( vec3 p, float r1, float r2, float h )
    {
        vec2 q = vec2( length(p.xz), p.y );
            
        float b = (r1-r2)/h;
        float a = sqrt(1.0-b*b);
        float k = dot(q,vec2(-b,a));
            
        if( k < 0.0 ) return length(q) - r1;
        if( k > a*h ) return length(q-vec2(0.0,h)) - r2;
                
        return dot(q, vec2(a,b) ) - r1;
    }

    float sdEllipsoid( vec3 p, vec3 r )
    {
        float k0 = length(p/r);
        float k1 = length(p/(r*r));
        return k0*(k0-1.0)/k1;
    }

    float sdRhombus(vec3 p, float la, float lb, float h, float ra)
    {
        p = abs(p);
        vec2 b = vec2(la,lb);
        float f = clamp( (ndot(b,b-2.0*p.xz))/dot(b,b), -1.0, 1.0 );
        vec2 q = vec2(length(p.xz-0.5*b*vec2(1.0-f,1.0+f))*sign(p.x*b.y+p.z*b.x-b.x*b.y)-ra, p.y-h);
        return min(max(q.x,q.y),0.0) + length(max(q,0.0));
    }

    float sdOctahedron( vec3 p, float s)
    {
        p = abs(p);
        float m = p.x+p.y+p.z-s;
        vec3 q;
            if( 3.0*p.x < m ) q = p.xyz;
        else if( 3.0*p.y < m ) q = p.yzx;
        else if( 3.0*p.z < m ) q = p.zxy;
        else return m*0.57735027;
            
        float k = clamp(0.5*(q.z-q.y+s),0.0,s); 
        return length(vec3(q.x,q.y-s+k,q.z-k)); 
    }

    float sdPyramid( vec3 p, float h)
    {
        float m2 = h*h + 0.25;
            
        p.xz = abs(p.xz);
        p.xz = (p.z>p.x) ? p.zx : p.xz;
        p.xz -= 0.5;

        vec3 q = vec3( p.z, h*p.y - 0.5*p.x, h*p.x + 0.5*p.y);
        
        float s = max(-q.x,0.0);
        float t = clamp( (q.y-0.5*p.z)/(m2+0.25), 0.0, 1.0 );
            
        float a = m2*(q.x+s)*(q.x+s) + q.y*q.y;
        float b = m2*(q.x+0.5*t)*(q.x+0.5*t) + (q.y-m2*t)*(q.y-m2*t);
            
        float d2 = min(q.y,-q.x*m2-q.y*0.5) > 0.0 ? 0.0 : min(a,b);
            
        return sqrt( (d2+q.z*q.z)/m2 ) * sign(max(q.z,-p.y));
    }

    float udTriangle( vec3 p, vec3 a, vec3 b, vec3 c )
    {
        vec3 ba = b - a; vec3 pa = p - a;
        vec3 cb = c - b; vec3 pb = p - b;
        vec3 ac = a - c; vec3 pc = p - c;
        vec3 nor = cross( ba, ac );

        return sqrt(
            (sign(dot(cross(ba,nor),pa)) +
            sign(dot(cross(cb,nor),pb)) +
            sign(dot(cross(ac,nor),pc))<2.0)
            ?
            min( min(
            dot2(ba*clamp(dot(ba,pa)/dot2(ba),0.0,1.0)-pa),
            dot2(cb*clamp(dot(cb,pb)/dot2(cb),0.0,1.0)-pb) ),
            dot2(ac*clamp(dot(ac,pc)/dot2(ac),0.0,1.0)-pc) )
            :
            dot(nor,pa)*dot(nor,pa)/dot2(nor) );
    }

    float udQuad( vec3 p, vec3 a, vec3 b, vec3 c, vec3 d )
    {
        vec3 ba = b - a; vec3 pa = p - a;
        vec3 cb = c - b; vec3 pb = p - b;
        vec3 dc = d - c; vec3 pc = p - c;
        vec3 ad = a - d; vec3 pd = p - d;
        vec3 nor = cross( ba, ad );

        return sqrt(
            (sign(dot(cross(ba,nor),pa)) +
            sign(dot(cross(cb,nor),pb)) +
            sign(dot(cross(dc,nor),pc)) +
            sign(dot(cross(ad,nor),pd))<3.0)
            ?
            min( min( min(
            dot2(ba*clamp(dot(ba,pa)/dot2(ba),0.0,1.0)-pa),
            dot2(cb*clamp(dot(cb,pb)/dot2(cb),0.0,1.0)-pb) ),
            dot2(dc*clamp(dot(dc,pc)/dot2(dc),0.0,1.0)-pc) ),
            dot2(ad*clamp(dot(ad,pd)/dot2(ad),0.0,1.0)-pd) )
            :
            dot(nor,pa)*dot(nor,pa)/dot2(nor) );
    }

    float opUnion( float d1, float d2 ) {  return min(d1,d2); }

    float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }

    float opIntersection( float d1, float d2 ) { return max(d1,d2); }

    float opSmoothUnion( float d1, float d2, float k ) {
        float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
        return mix( d2, d1, h ) - k*h*(1.0-h); }

    float opSmoothSubtraction( float d1, float d2, float k ) {
        float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
        return mix( d2, -d1, h ) + k*h*(1.0-h); }

    float opSmoothIntersection( float d1, float d2, float k ) {
        float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
        return mix( d2, d1, h ) + k*h*(1.0-h); }
    
    mat3 rotateY(float theta) {
        float c = cos(theta);
        float s = sin(theta);

        return mat3(
            vec4(c, 0, s),
            vec4(0, 1, 0),
            vec4(-s, 0, c),
        );
    }
`
},{}]},{},[1])(1)
});
