class geometry {
    constructor(){
    this.vertices = new Float32Array();
    this.modelMatrix = new Matrix4();
    this.translationMatrix = new Matrix4();
    this.rotationMatrix = new Matrix4();
    this.scaleMatrix = new Matrix4();
    }
    translate(x, y, z){
    this.translationMatrix.setTranslate(x, y, z);
    }
    rotateX(angle){
    this.rotationMatrix.setRotate(angle, 1, 0, 0);
    }
    rotateY(angle){
    this.rotationMatrix.setRotate(angle, 0, 1, 0);
    }
    rotateZ(angle){
    this.rotationMatrix.setRotate(angle, 0, 0, 1);
    }
    scale(x, y, z){
    this.scaleMatrix.setScale(x, y, z);
    }
}
