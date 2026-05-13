class triangle extends geometry{
    constructor(){
    super();
    this.vertices = new Float32Array([
    // first 3 elements: position (x, y, z)
    // next 3 elements: color (r, g, b)
    // next 2 elements: texture coordinates (u, v)
    -0.5, -0.5, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, // a: bottom left
    0.5, -0.5, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, // b: bottom right
    0.0, 0.5, 0.0, 0.0, 0.0, 1.0, 0.5, 1.0, // c: top point
    ]);
    }
}
