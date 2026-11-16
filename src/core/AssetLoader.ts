import * as THREE from 'three';

export class AssetLoader {
  private static textures: Map<string, THREE.Texture> = new Map();
  private static materials: Map<string, THREE.Material> = new Map();

  public static async loadAll(onProgress: (progress: number) => void): Promise<void> {
    console.log('[AssetLoader] Generating procedural cyber materials...');
    
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 80)); // Simulate async loading intervals
      onProgress(i / steps);
    }
    
    // 1. Generate neon grid floor texture
    this.textures.set('gridFloor', this.createGridTexture());
    
    // 2. Build shader materials or custom standard materials
    this.createProceduralMaterials();
    
    console.log('[AssetLoader] Asset loader finished.');
  }

  public static getTexture(name: string): THREE.Texture | undefined {
    return this.textures.get(name);
  }

  public static getMaterial(name: string): THREE.Material | undefined {
    return this.materials.get(name);
  }

  private static createGridTexture(): THREE.Texture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Dark floor base
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, size, size);
    
    // Neon lines
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);
    
    // Subtle inner glowing border
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, size, size);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    return texture;
  }

  private static createProceduralMaterials(): void {
    // Cyber-Ninja (Vanguard-01) Material - Sleek Metallic Dark Slate Carbon
    const vanguardMat = new THREE.MeshStandardMaterial({
      color: 0x0a101d,       // Slate 950 base
      roughness: 0.18,       // Shiny reflections
      metalness: 0.95,       // Highly metallic chrome-like look
      emissive: 0x000000     // Zero overall emissive to preserve light highlights & shadows
    });
    this.materials.set('vanguard', vanguardMat);

    // Cyber-Ninja (Vanguard-01) Neon Cyan Glow
    const vanguardGlowMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x00f3ff,
      emissiveIntensity: 2.8, // Super rich cyber-glow
      roughness: 0.1,
      metalness: 0.1
    });
    this.materials.set('vanguardGlow', vanguardGlowMat);

    // Heavy Crimson Titan (Aegis-X) Material - Massive Red Titanium Plates
    const aegisMat = new THREE.MeshStandardMaterial({
      color: 0x3a040b,       // Rich deep crimson industrial red
      roughness: 0.32,       // Matte metallic texture
      metalness: 0.85,       // Heavy steel plating
      emissive: 0x000000     // Zero overall emissive to prevent washing out shapes
    });
    this.materials.set('aegis', aegisMat);

    // Heavy Crimson Titan (Aegis-X) Neon Orange Hydraulic Glow
    const aegisGlowMat = new THREE.MeshStandardMaterial({
      color: 0xff3300,
      emissive: 0xff3300,
      emissiveIntensity: 2.5, // Molten reactor glow
      roughness: 0.2,
      metalness: 0.2
    });
    this.materials.set('aegisGlow', aegisGlowMat);

    // Weapon/Blade Glowing Material (Blazing Cyan Laser)
    const energyBladeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00f3ff,
      emissiveIntensity: 4.5, // Blinding laser edge
      transparent: true,
      opacity: 0.95,
      roughness: 0.05
    });
    this.materials.set('energyBlade', energyBladeMat);
    
    // Heavy Fist Flame / Thruster Core Material (Molten Lava Heat)
    const fireFistMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff4400,
      emissiveIntensity: 4.0, // High intensity thermal glow
      transparent: true,
      opacity: 0.9,
      roughness: 0.1
    });
    this.materials.set('fireFist', fireFistMat);

    this.materials.set('skinWarm', new THREE.MeshStandardMaterial({
      color: 0xd89a72,
      roughness: 0.52,
      metalness: 0.0
    }));

    this.materials.set('skinDeep', new THREE.MeshStandardMaterial({
      color: 0x8e563d,
      roughness: 0.58,
      metalness: 0.0
    }));

    this.materials.set('hairDark', new THREE.MeshStandardMaterial({
      color: 0x101014,
      roughness: 0.72,
      metalness: 0.0
    }));

    this.materials.set('vanguardGi', new THREE.MeshStandardMaterial({
      color: 0x162333,
      roughness: 0.46,
      metalness: 0.08
    }));

    this.materials.set('aegisGi', new THREE.MeshStandardMaterial({
      color: 0x6c1320,
      roughness: 0.5,
      metalness: 0.06
    }));

    this.materials.set('fightGlove', new THREE.MeshStandardMaterial({
      color: 0x17171b,
      roughness: 0.34,
      metalness: 0.18
    }));

    this.materials.set('fightBoot', new THREE.MeshStandardMaterial({
      color: 0x111115,
      roughness: 0.42,
      metalness: 0.12
    }));

    // Dynamic Arena Grid Material
    const arenaFloorMat = new THREE.MeshStandardMaterial({
      map: this.textures.get('gridFloor'),
      roughness: 0.22,
      metalness: 0.75
    });
    this.materials.set('arenaFloor', arenaFloorMat);
    
    // Red Warning Boundary Material
    const ringBoundaryMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    });
    this.materials.set('ringBoundary', ringBoundaryMat);
  }
}
