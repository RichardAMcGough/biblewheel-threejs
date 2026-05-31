import * as THREE from 'three';
import { Text as TroikaText } from 'troika-three-text';
import { FONT_URLS } from '../bible-wheel.types';

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

      // Always start with the reliable local Inter-Bold so the label is guaranteed
      // to be visible immediately, even while remote heading fonts are loading.
      const requestedKey = (params.font || 'english').toLowerCase();
      const safeUrl = FONT_URLS.english;
      charLabel.font = safeUrl;

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

      // Sync immediately with safe font
      charLabel.sync();

      wheelGroup.add(charLabel);
      outArray.push(charLabel);

      // If a truly different font URL is configured for this key (i.e. the user has
      // added a real local .ttf and pointed FONT_URLS at it), we attempt a delayed
      // upgrade after the label is already visible with the safe font.
      //
      // With the current FONT_URLS (everything aliases to local Inter-Bold), this
      // branch is almost never taken — which is intentional. It prevents the exact
      // "Failure loading font https://fonts.gstatic.com/..." errors you saw.
      //
      // See the big comment in bible-wheel.types.ts for how to enable real
      // per-font visual differences.
      const targetUrl = FONT_URLS[requestedKey];
      if (targetUrl && targetUrl !== safeUrl) {
        setTimeout(() => {
          if (charLabel && charLabel.parent) {
            charLabel.font = targetUrl;
            charLabel.visible = true;
            charLabel.sync();

            // Re-apply overlay material (depthTest, etc.) — required after font change
            configureTroikaLabelOverlay(charLabel, 100);
            charLabel.sync();

            requestAnimationFrame(() => {
              if (charLabel.parent) {
                configureTroikaLabelOverlay(charLabel, 100);
                charLabel.sync();
              }
            });
            setTimeout(() => {
              if (charLabel.parent) {
                configureTroikaLabelOverlay(charLabel, 100);
                charLabel.sync();
              }
            }, 150);
          }
        }, 650);
      }
    });
  });
}

/**
 * Applies the standard "always visible on top" material + renderOrder settings
 * used for all Troika labels that must survive hover lift and Canon cross-fade.
 * Centralizes the repeated `transparent + depthTest:false + needsUpdate` block.
 */
export function configureTroikaLabelOverlay(label: any, renderOrder = 50): void {
  label.renderOrder = renderOrder;
  if (label.material) {
    const m = label.material as any;
    m.transparent = true;
    m.opacity = 1;
    m.depthTest = false;
    m.depthWrite = false;
    m.needsUpdate = true;
  }
}
