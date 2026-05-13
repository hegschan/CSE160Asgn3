// Shaders
// Input: an array of points comes from javascript.
// In this example, think of this array as the variable a_Position;
// Q: Why a_Position is not an array?
// A: Because the GPU process every vertex in parallel
// The language that we use to write the shaders is called GLSL
// Output: sends "an array of points" to the rasterizer.
var VERTEX_SHADER = `
precision mediump float;
attribute vec3 a_Position;
attribute vec3 a_Color;
attribute vec2 a_UV;
varying vec3 v_Color;
varying vec2 v_UV;
uniform mat4 u_ModelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
void main() {
v_Color = a_Color;
v_UV = a_UV;
gl_Position = u_projectionMatrix * u_viewMatrix * u_ModelMatrix *
vec4(a_Position, 1.0);
}
`;
// Input: a fragment (a grid of pixels) comes from the rasterizer.
// It doesn't have vertices as input
// Ouput: a color goes to HTML canvas.
var FRAGMENT_SHADER = `
precision mediump float;
varying vec3 v_Color;
varying vec2 v_UV;
uniform sampler2D u_Sampler;
void main() {
vec4 texColor = texture2D(u_Sampler, v_UV);
//gl_FragColor = texColor;
vec4 baseColor = vec4(0.0, 1.0, 0.0, 1.0);
//t = u_texColorWeight;
float t = 0.8;
gl_FragColor = (1.0 - t) *baseColor + t*texColor;
}
`;
// We will use HTML sliders to set this variable
GlobalRotation = 0;
shapes = [];
function loadWorld(){
texture = gl.createTexture();
img = new Image();
img.src = "textures/block.jpg";
img.onload = function(){
console.log("image", img);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
let u_Sampler = gl.getUniformLocation(gl.program, "u_Sampler");
gl.uniform1i(u_Sampler, 0);
animate();
}
}
function animate(){
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
let u_viewMatrix = gl.getUniformLocation(gl.program, "u_viewMatrix");
gl.uniformMatrix4fv(u_viewMatrix, false, camera.viewMatrix.elements);
let u_projectionMatrix = gl.getUniformLocation(gl.program,
"u_projectionMatrix");
gl.uniformMatrix4fv(u_projectionMatrix, false,
camera.projectionMatrix.elements);
//GlobalRotation += 1;
console.log(GlobalRotation);
for(let s of shapes){
//s.rotateY(GlobalRotation);
draw(s);
}
//requestAnimationFrame(animate);
}
function draw(geometry){
geometry.modelMatrix.multiply(geometry.translationMatrix);
geometry.modelMatrix.multiply(geometry.rotationMatrix);
geometry.modelMatrix.multiply(geometry.scaleMatrix);
let u_ModelMatrix = gl.getUniformLocation(gl.program, "u_ModelMatrix");
gl.uniformMatrix4fv(u_ModelMatrix, false, geometry.modelMatrix.elements);
gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
// Finally, we can call a Draw function
gl.drawArrays(gl.TRIANGLES, 0, geometry.vertices.length/8);
geometry.modelMatrix.setIdentity();
}
function keydown(ev) {
if(ev.keyCode == 37) { // The left arrow key was pressed
camera.eye.elements[0] += 0.1;
camera.updateView();
} else
if(ev.keyCode == 39) { // The right arrow key was pressed
camera.eye.elements[0] -= 0.1;
camera.updateView();
} else
if(ev.keyCode == 38) { // The up arrow key was pressed
camera.eye.elements[2] += 0.1;
camera.updateView();
} else
if (ev.keyCode == 40) { // The down arrow key was pressed
camera.eye.elements[2] -= 0.1;
camera.updateView();
} else { return; }
animate();
}
function main() {
let canvas = document.getElementById("webgl");
// Retrieve WebGl rendering context
gl = getWebGLContext(canvas);
if(!gl) {
console.log("Failed to get WebGL context.")
return -1;
}
gl.enable(gl.DEPTH_TEST);
// A function to do all the drawing task outside of main
gl.clearColor(0.0, 0.0, 0.0, 1.0);
// Actually clear screen
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
// We need to define a triangle.
// A triangle is made out of three points: a, b, c.
// In webGL, we normally define these points together in one array
let cube1 = new cube();
cube1.translate(0, -0.45, 1);
cube1.scale(0.5, 0.5, 0.5);
//cube1.rotateY(45);
shapes.push(cube1);
let triangle1 = new triangle();
triangle1.translate(0, 0.25, 0.5);
triangle1.scale(1.5, 0.5, 0.5);
//triangle1.rotateY(45);
shapes.push(triangle1);
let square1 = new square();
square1.translate(0, -0.45, 1);
square1.scale(0.5, 0.5, 0.5);
//triangle1.rotateY(45);
//shapes.push(square1);
// Remember that WebGL uses the GPU to render vertices on the screen.
// Therefore, we need to send these points to the GPU. Because
// the GPU is a different processing unit in your computer.
// We have to compile the vertex and fragment shaders and
// load them in the GPU
if(!initShaders(gl, VERTEX_SHADER, FRAGMENT_SHADER)) {
console.log("Failed to compile and load shaders.")
return -1;
}
// Specify how to read points a, b and c from the triangle array
// Create a WebGL buffer (an array in GPU memory), which is similar
// to a javascript Array.
let vertexBuffer = gl.createBuffer();
if(!vertexBuffer) {
console.log("Can't create buffer");
return -1;
}
// We have to bind this new buffer to the a_Position attribute in the
// vertex shader.
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
// To map this ARRAY_BUFFER called vertexBuffer to our attribute a_Position
// in the vertex shader.
// To do that, we first need to access the memory location of the
// attribute a_Position. Remember that a_Position is a variable in
// the GPU memory. So we need to grab that location.
let FLOAT_SIZE = Float32Array.BYTES_PER_ELEMENT;
let a_Position = gl.getAttribLocation(gl.program, "a_Position");
gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 8*FLOAT_SIZE,
0*FLOAT_SIZE);
gl.enableVertexAttribArray(a_Position);
let a_Color = gl.getAttribLocation(gl.program, "a_Color");
gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, 8*FLOAT_SIZE,
3*FLOAT_SIZE);
gl.enableVertexAttribArray(a_Color);
let a_UV = gl.getAttribLocation(gl.program, "a_UV");
gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 8*FLOAT_SIZE, 6*FLOAT_SIZE);
gl.enableVertexAttribArray(a_UV);
camera = new Camera(canvas.width/canvas.height, 0.1, 1000);
document.onkeydown = function(ev){ keydown(ev); };
loadWorld();
}
