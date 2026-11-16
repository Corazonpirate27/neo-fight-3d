import * as THREE from 'three';
import { Fighter } from '../entities/Fighter';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private readonly fixedPosition: THREE.Vector3 = new THREE.Vector3(0, 7.2, 24);

  // Smoothed Street Fighter style side-tracking camera
  private currentPos: THREE.Vector3 = new THREE.Vector3(0, 7.2, 24);
  private currentTarget: THREE.Vector3 = new THREE.Vector3(0, 3.4, 0);

  // Screen shake variables
  private shakeAmount: number = 0;
  private shakeDuration: number = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    this.camera.position.copy(this.fixedPosition);
    this.camera.lookAt(this.currentTarget);
  }

  public update(p1?: Fighter, p2?: Fighter): void {
    // Street Fighter framing: follow the midpoint, pull back as fighters separate
    if (p1 && p2) {
      const midX = (p1.pos.x + p2.pos.x) / 2;
      const spread = Math.abs(p1.pos.x - p2.pos.x);
      const midY = Math.max(0, (p1.pos.y + p2.pos.y) / 2);

      const zoomZ = THREE.MathUtils.clamp(13.5 + spread * 0.62, 16, 27);
      const desiredPos = new THREE.Vector3(midX * 0.85, 6.6 + midY * 0.35, zoomZ);
      const desiredTarget = new THREE.Vector3(midX * 0.85, 3.4 + midY * 0.35, 0);

      this.currentPos.lerp(desiredPos, 0.09);
      this.currentTarget.lerp(desiredTarget, 0.09);
    }

    this.camera.position.copy(this.currentPos);

    if (this.shakeDuration > 0) {
      this.shakeDuration--;

      const rX = (Math.random() - 0.5) * this.shakeAmount;
      const rY = (Math.random() - 0.5) * this.shakeAmount;

      this.camera.position.x += rX;
      this.camera.position.y += rY;

      if (this.shakeDuration === 0) {
        this.shakeAmount = 0;
      }
    }

    this.camera.lookAt(this.currentTarget);
  }

  public triggerScreenShake(amount: number, duration: number): void {
    this.shakeAmount = amount * 0.022;
    this.shakeDuration = duration;
  }

  public triggerImpactZoom(amount: number): void {
    void amount;
  }
}
