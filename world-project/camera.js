/**
 * First-person style camera: perspective projection + yaw / pitch look direction.
 */
class Camera {
  constructor(aspectRatio, near, far) {
    this.fov = 60;
    this.near = near;
    this.far = far;
    this.aspectRatio = aspectRatio;

    // Eye height above ground plane (y = 0)
    this.eye = new Vector3([0, 1.65, 14]);

    // Degrees: yaw rotates around Y; pitch looks up/down
    this.yawDeg = 180;
    this.pitchDeg = -8;

    this.up = new Vector3([0, 1, 0]);

    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();

    this.projectionMatrix.setPerspective(this.fov, aspectRatio, near, far);
    this.updateView();
  }

  setAspect(aspectRatio) {
    this.aspectRatio = aspectRatio;
    this.projectionMatrix.setPerspective(this.fov, aspectRatio, this.near, this.far);
  }

  /** Horizontal unit direction from yaw (XZ plane), normalized */
  forwardFlat() {
    const yr = (this.yawDeg * Math.PI) / 180;
    return [Math.sin(yr), 0, Math.cos(yr)];
  }

  /** Full look direction including pitch, normalized */
  forwardDir() {
    const yr = (this.yawDeg * Math.PI) / 180;
    const pr = (this.pitchDeg * Math.PI) / 180;
    const cp = Math.cos(pr);
    return [Math.sin(yr) * cp, Math.sin(pr), Math.cos(yr) * cp];
  }

  rightFlat() {
    const f = this.forwardFlat();
    // right = forward x worldUp
    return [f[2], 0, -f[0]];
  }

  addYaw(deltaDeg) {
    this.yawDeg += deltaDeg;
  }

  addPitch(deltaDeg) {
    this.pitchDeg = Math.max(-89, Math.min(89, this.pitchDeg + deltaDeg));
  }

  moveAlongXZ(dx, dz) {
    this.eye.elements[0] += dx;
    this.eye.elements[2] += dz;
    this.updateView();
  }

  updateView() {
    const e = this.eye.elements;
    const f = this.forwardDir();
    const cx = e[0] + f[0];
    const cy = e[1] + f[1];
    const cz = e[2] + f[2];
    this.viewMatrix.setLookAt(e[0], e[1], e[2], cx, cy, cz,
      this.up.elements[0], this.up.elements[1], this.up.elements[2]);
  }
}
