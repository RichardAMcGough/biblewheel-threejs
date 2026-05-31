import * as THREE from 'three';
import { Text as TroikaText } from 'troika-three-text';
import { FONTS } from '../bible-wheel.types';

export interface CurvedLabelParams {
  text: string | string[];
  thetaStart: number;
  thetaEnd: number;
  radius: number;
  z: number;
  fontSize: number;
  color: number;
  flipRotation?: boolean;
  font?: string;   // heading font key
}

/**
 * Creates curved per-character TroikaText labels that follow an arc.
 * This is the exact logic from the final working Angular version,
 * including the reverseFor / flipRotationFor orientation handling.
 */
export function createCurvedText(
  params: CurvedLabelParams,
  wheelGroup: THREE.Group,
  outArray: TroikaText[]
): void {
  const { text, thetaStart, thetaEnd, radius, z, fontSize, color, flipRotation = false } = params;

  let lines: string[];
  if (Array.isArray(text)) {
    lines = text;
  } else {
    lines = [text];
  }

  lines.forEach((line) => {
    const chars = line.split('');
    const numChars = chars.length;
    if (numChars === 0) return;

    const arcSpan = thetaEnd - thetaStart;
    const charSpacing = arcSpan / (numChars + 1);

    // Exact same heuristic + override logic as the final Angular version
    const isBottomHalf = (thetaStart + thetaEnd) / 2 > Math.PI;
    const orderedChars = isBottomHalf ? chars : [...chars].reverse();

    orderedChars.forEach((char, i) => {
      const charAngle = thetaStart + charSpacing * (i + 1);

      const charX = radius * Math.cos(charAngle);
      const charY = radius * Math.sin(charAngle);

      let charRotation = charAngle - Math.PI / 2;

      if (isBottomHalf) {
        charRotation += Math.PI;
      }

      if (flipRotation) {
        charRotation += Math.PI;
      }

      const charLabel = new TroikaText();
      charLabel.text = char;
      // For now all heading fonts fall back to the loaded Inter-Bold until you add more .ttf files
      charLabel.font = FONTS.english;
      charLabel.fontSize = fontSize;
      charLabel.color = color;
      charLabel.anchorX = 'center';
      charLabel.anchorY = 'middle';
      charLabel.position.set(charX, charY, z);
      charLabel.rotation.z = charRotation;

      // Critical Troika material setup for dynamic visibility (exact match)
      if (charLabel.material) {
        (charLabel.material as THREE.Material).transparent = true;
        (charLabel.material as THREE.Material).opacity = 1;
        (charLabel.material as THREE.Material).depthTest = false;
        (charLabel.material as THREE.Material).depthWrite = false;
        ((charLabel.material as THREE.Material) as any).needsUpdate = true;
      }

      charLabel.visible = true;
      charLabel.renderOrder = 100;

      // Sync immediately
      charLabel.sync();

      wheelGroup.add(charLabel);
      outArray.push(charLabel);
    });
  });
}
