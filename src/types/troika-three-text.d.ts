// Ambient declaration for troika-three-text (minimal but sufficient)
declare module 'troika-three-text' {
  import * as THREE from 'three';

  export class Text extends THREE.Object3D {
    text: string;
    font: string;
    fontSize: number;
    color: string | number;
    anchorX: 'left' | 'center' | 'right' | number;
    anchorY: 'top' | 'middle' | 'bottom' | number;
    material: THREE.Material & {
      transparent?: boolean;
      opacity?: number;
      depthTest?: boolean;
      depthWrite?: boolean;
      needsUpdate?: boolean;
    };
    position: THREE.Vector3;
    rotation: THREE.Euler;
    userData: any;
    visible: boolean;
    renderOrder: number;

    sync(callback?: () => void): void;
  }
}
