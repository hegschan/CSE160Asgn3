class square extends geometry{
    constructor(){
    super();
    this.vertices = new Float32Array([
    // first 3 elements: position (x, y, z)
    // next 3 elements: color (r, g, b)
    // next 2 elements: texture coordinates (u, v)
    // Triangle 1
    -1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, // top left corner
    -1.0, -1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, // bottom left corner
    1.0, -1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, // bottom right corner
    // Triangle 2
    -1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, // top left corner
    1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, // top right corner
    1.0, -1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0 // bottom right corner
    ]);
    }
}