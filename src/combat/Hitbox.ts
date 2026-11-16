import * as THREE from 'three';
import { Fighter } from '../entities/Fighter';

export class Hitbox {
  public center: THREE.Vector3 = new THREE.Vector3();
  public radius: number;
  public damage: number;
  public knockback: number;
  public isActive: boolean = false;
  
  // Three.js helper mesh for visual debugging if needed
  private helperMesh?: THREE.Mesh;

  constructor(radius: number, damage: number = 0, knockback: number = 0) {
    this.radius = radius;
    this.damage = damage;
    this.knockback = knockback;
  }

  public update(nodeWorldPos: THREE.Vector3): void {
    this.center.copy(nodeWorldPos);
    if (this.helperMesh) {
      this.helperMesh.position.copy(this.center);
    }
  }

  public intersects(other: Hurtbox): boolean {
    if (!this.isActive) return false;
    
    // Distance check between hitbox center sphere and hurtbox bounding box
    const closestPoint = new THREE.Vector3();
    other.box.clampPoint(this.center, closestPoint);
    
    const distSq = this.center.distanceToSquared(closestPoint);
    return distSq <= this.radius * this.radius;
  }
}

export class Hurtbox {
  public box: THREE.Box3 = new THREE.Box3();
  
  constructor() {}

  public update(torsoWorldPos: THREE.Vector3, isCrouching: boolean, isVanguard: boolean): void {
    // Dynamically size bounding hurtbox depending on pose
    const width = isVanguard ? 2.0 : 2.8;
    
    const min = new THREE.Vector3(
      torsoWorldPos.x - width / 2,
      torsoWorldPos.y - (isCrouching ? 2.0 : 3.6),
      torsoWorldPos.z - width / 2
    );
    const max = new THREE.Vector3(
      torsoWorldPos.x + width / 2,
      torsoWorldPos.y + (isCrouching ? 0.8 : 1.4),
      torsoWorldPos.z + width / 2
    );
    
    this.box.set(min, max);
  }
}

export class Pushbox {
  public center: THREE.Vector3 = new THREE.Vector3();
  public radius: number;

  constructor(radius: number) {
    this.radius = radius;
  }

  public update(pos: THREE.Vector3): void {
    this.center.copy(pos);
    this.center.y = 0; // pushbox resolves horizontal overlap on floor
  }

  public intersects(other: Pushbox): boolean {
    const distSq = this.center.distanceToSquared(other.center);
    const minDist = this.radius + other.radius;
    return distSq <= minDist * minDist;
  }

  public resolveOverlap(other: Pushbox, fighter1: Fighter, fighter2: Fighter): void {
    const direction = new THREE.Vector3().subVectors(fighter2.pos, fighter1.pos);
    direction.y = 0; // only horizontal resolve
    
    const dist = direction.length();
    const minDist = this.radius + other.radius;
    
    if (dist < minDist) {
      const overlap = minDist - dist;
      
      // Calculate push vectors
      if (dist === 0) {
        // perfect overlap exception, push random dir
        direction.set(1, 0, 0);
      } else {
        direction.normalize();
      }
      
      const pushAmount = overlap * 0.52; // slight extra push to ensure escape
      
      // Kinematic push limits (if player is against a boundary, transfer push entirely to other)
      const boundary = 23.9;
      const f1NearWall = Math.abs(fighter1.pos.x) >= boundary;
      const f2NearWall = Math.abs(fighter2.pos.x) >= boundary;
      
      if (f1NearWall && !f2NearWall) {
        fighter2.pos.addScaledVector(direction, pushAmount * 2);
      } else if (f2NearWall && !f1NearWall) {
        fighter1.pos.addScaledVector(direction, -pushAmount * 2);
      } else {
        // normal push apart
        fighter1.pos.addScaledVector(direction, -pushAmount);
        fighter2.pos.addScaledVector(direction, pushAmount);
      }
    }
  }
}
