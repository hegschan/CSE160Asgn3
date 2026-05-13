class Camera {
    constructor(aspectRatio, near, far){
      this.fov = 60;
      this.eye = new Vector3([0, 0, -2.5]);
      this.center = new Vector3([0, 0, 0]);
      this.up = new Vector3([0, 1, 0]);

      this.viewMatrix = new Matrix4();
      this.updateView();

      this.projectionMatrix = new Matrix4();
      this.projectionMatrix.setPerspective(this.fov, aspectRatio, near, far);

    }

    moveForward(){

    }

    moveBackwards(){
		
    }

    moveLeft(){

    }

    moveRight(){

    }

    panLeft(){

    }

    panRight(){

    }

    updateView(){
      this.viewMatrix.setLookAt(this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
                        this.center.elements[0], this.center.elements[1], this.center.elements[2],
                        this.up.elements[0], this.up.elements[1], this.up.elements[2]);
    }

}
