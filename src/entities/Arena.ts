import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';

export class Arena {
  private group: THREE.Group;
  private spotlights: THREE.SpotLight[] = [];
  private spotHelpers: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    
    this.buildFloor();
    this.buildCageWalls();
    this.buildNeonLights();
    this.buildSkybox();
    
    scene.add(this.group);
  }

  public update(time: number): void {
    // Swing dynamic neon spotlights slowly to make the stadium feel alive
    this.spotlights.forEach((_, idx) => {
      const helper = this.spotHelpers[idx];
      if (helper) {
        const offset = idx * Math.PI * 0.5;
        helper.position.x = Math.sin(time * 0.0015 + offset) * 12;
        helper.position.z = Math.cos(time * 0.001 + offset) * 5;
      }
    });
  }

  private buildFloor(): void {
    // Flat stage backdrop: layered like an old arcade 2D fighter.
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 26),
      new THREE.MeshBasicMaterial({ color: 0x18233a })
    );
    sky.position.set(0, 10, -6);
    this.group.add(sky);

    const skylineMat = new THREE.MeshBasicMaterial({ color: 0x0b1020 });
    for (let i = 0; i < 18; i++) {
      const width = 1.5 + (i % 4) * 0.55;
      const height = 4 + (i % 5) * 0.8;
      const tower = new THREE.Mesh(new THREE.PlaneGeometry(width, height), skylineMat);
      tower.position.set(-36 + i * 4.4, 2.2 + height * 0.5, -5.7);
      this.group.add(tower);
    }

    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe3a8 })
    );
    moon.position.set(21, 12.5, -5.6);
    this.group.add(moon);

    const crowdBand = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 2.8),
      new THREE.MeshBasicMaterial({ color: 0x211728 })
    );
    crowdBand.position.set(0, 1.35, -5.4);
    this.group.add(crowdBand);

    for (let i = 0; i < 64; i++) {
      const color = i % 3 === 0 ? 0xffc857 : (i % 3 === 1 ? 0x2ec4b6 : 0xe71d36);
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.08 + (i % 2) * 0.03, 8),
        new THREE.MeshBasicMaterial({ color })
      );
      dot.position.set(-39 + i * 1.25, 1.7 + (i % 5) * 0.3, -5.25);
      this.group.add(dot);
    }

    const stageFace = new THREE.Mesh(
      new THREE.PlaneGeometry(84, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x332319 })
    );
    stageFace.position.set(0, -0.82, -4.8);
    this.group.add(stageFace);

    const stageLip = new THREE.Mesh(
      new THREE.PlaneGeometry(84, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xffc857 })
    );
    stageLip.position.set(0, 0.02, -4.7);
    this.group.add(stageLip);

    // Thin physical catch plane keeps shadows and dust grounded.
    const geometry = new THREE.PlaneGeometry(80, 40);
    const material = AssetLoader.getMaterial('arenaFloor') || new THREE.MeshStandardMaterial({ color: 0x050c18 });
    
    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.position.z = 0.2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Decorative center metallic ring
    const ringGeo = new THREE.RingGeometry(8, 8.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.group.add(ring);
  }

  private buildCageWalls(): void {
    // Warning red borders representing stage boundaries at x = -25 and x = 25
    const boundaryGeo = new THREE.BoxGeometry(0.2, 8, 40);
    const boundaryMat = AssetLoader.getMaterial('ringBoundary') || new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    const leftWall = new THREE.Mesh(boundaryGeo, boundaryMat);
    leftWall.position.set(-25, 4, 0);
    this.group.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.set(25, 4, 0);
    this.group.add(rightWall);
    
    // Add decorative low-poly metal truss columns at the boundary corners
    const columnGeo = new THREE.CylinderGeometry(0.4, 0.4, 12, 6);
    const columnMat = new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.9, roughness: 0.2 });
    
    const corners = [
      [-25, -20], [-25, 20], [25, -20], [25, 20]
    ];
    
    corners.forEach(([cx, cz]) => {
      const col = new THREE.Mesh(columnGeo, columnMat);
      col.position.set(cx, 6, cz);
      
      // Neon caps on top of columns
      const capGeo = new THREE.SphereGeometry(0.6, 8, 8);
      const capMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 6.2;
      col.add(cap);
      
      this.group.add(col);
    });
  }

  private buildNeonLights(): void {
    // Dynamic Cyber spotlights
    const colors = [0x00f3ff, 0xff0055, 0x00f3ff, 0xff0055];
    const positions = [
      new THREE.Vector3(-18, 15, -10),
      new THREE.Vector3(18, 15, 10),
      new THREE.Vector3(-18, 15, 10),
      new THREE.Vector3(18, 15, -10)
    ];

    colors.forEach((color, idx) => {
      const spot = new THREE.SpotLight(color, 250, 45, Math.PI / 4, 0.5, 1);
      spot.position.copy(positions[idx]);
      spot.castShadow = true;
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;
      
      // Spotlight targets that we sweep in the update loop
      const targetObj = new THREE.Object3D();
      targetObj.position.set(positions[idx].x * 0.4, 0, 0);
      this.group.add(targetObj);
      spot.target = targetObj;
      
      this.group.add(spot);
      this.spotlights.push(spot);
      this.spotHelpers.push(targetObj);
      
      // Visual low-poly spot fixture
      const fixtureGeo = new THREE.ConeGeometry(0.8, 1.8, 8);
      const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x181c26 });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.copy(positions[idx]);
      fixture.lookAt(targetObj.position);
      fixture.rotateX(Math.PI / 2);
      this.group.add(fixture);
    });

    // Master Stage lighting
    const ambientLight = new THREE.AmbientLight(0x0e1526, 0.6);
    this.group.add(ambientLight);

    const keyLight = new THREE.HemisphereLight(0xbfd8ff, 0x181016, 1.15);
    this.group.add(keyLight);
    
    const directCyan = new THREE.DirectionalLight(0x00f3ff, 0.85);
    directCyan.position.set(-15, 20, 5);
    directCyan.castShadow = true;
    this.group.add(directCyan);

    const directRed = new THREE.DirectionalLight(0xff0055, 0.65);
    directRed.position.set(15, 20, -5);
    this.group.add(directRed);

    const faceLight = new THREE.DirectionalLight(0xfff1dd, 1.2);
    faceLight.position.set(0, 10, 12);
    faceLight.castShadow = true;
    faceLight.shadow.mapSize.width = 2048;
    faceLight.shadow.mapSize.height = 2048;
    this.group.add(faceLight);
  }

  private buildSkybox(): void {
    // Stylized cylinder starry cyber-dome
    const skyGeo = new THREE.CylinderGeometry(60, 60, 45, 16, 1, true);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x010205,
      side: THREE.BackSide,
      fog: false
    });
    
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.y = 15;
    this.group.add(sky);
  }
}
