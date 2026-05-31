import * as THREE from 'three';
import { Text as TroikaText } from 'troika-three-text';
import type { BibleWheelConfig, DivisionLabelStyles, DivisionKey, DivisionBlockUserData } from '../bible-wheel.types';
import {
  wedgeTheta,
  cycleRadii,
  cycleHeight,
} from './wheelGeometry';
import { BIBLE_BOOKS } from '../bible-data';
import { DIVISIONS } from '../bible-wheel.types';
import { createCurvedText } from './createCurvedText';

/**
 * Creates the large curved labels for Canon / Division mode.
 * Supports per-division styling and special two-line handling for Epistles.
 */
export function createDivisionLabels(
  group: THREE.Group,
  config: BibleWheelConfig,
  styles: DivisionLabelStyles,
  divisionLabelGroupsRef: React.MutableRefObject<TroikaText[][]>,
  divisionDisplay: Record<any, { label: string; canonLabel?: string | string[] }> = {},
  divisionBlockMeshesRef?: React.MutableRefObject<THREE.Mesh[]>
): void {
  // Clear old labels
  divisionLabelGroupsRef.current.forEach(labelGroup => {
    labelGroup.forEach(label => {
      if (label.parent) label.parent.remove(label);
    });
  });
  divisionLabelGroupsRef.current = [];

  for (const division of DIVISIONS) {
    const booksInDiv = BIBLE_BOOKS.filter((b: any) => division.contains(b.position));
    if (booksInDiv.length === 0) continue;

    const cycle = Math.ceil(booksInDiv[0].position / 22);
    const firstSpoke = ((booksInDiv[0].position - 1) % 22) + 1;
    const lastSpoke = ((booksInDiv[booksInDiv.length - 1].position - 1) % 22) + 1;

    const { start: thetaStart } = wedgeTheta(firstSpoke);
    const { start: thetaEnd, length } = wedgeTheta(lastSpoke);
    const endAngle = thetaEnd + length;

    const radii = cycleRadii(cycle, config);
    const depth = cycleHeight(cycle, config);   // actual block height for proper label Z
    const bevel = Math.min(0.5, depth * 0.3);

    const style = styles[division.key] || {
      font: 'Cinzel',
      fontSize: 1.8,
      letterSpacing: 0.12,
      centerOffset: 0,
    };

    const effectiveOffset = style.centerOffset ?? 0;

    // We still use a small per-division centerOffset for final visual tuning.
    // The human eye is extremely sensitive on curved text.
    const blockMidAngle = (thetaStart + endAngle) / 2 + effectiveOffset;

    const displayInfo = divisionDisplay[division.key];
    const displayText = displayInfo?.canonLabel || (division as any).canonLabel || displayInfo?.label || division.label; // canonLabel lives on runtime Division from JSON merge
    const textLines: string[] = Array.isArray(displayText) ? displayText : [displayText];
    const charMeshes: TroikaText[] = [];

    const charAngularStep = style.letterSpacing ?? 0.12;
    const labelFontSize = style.fontSize ?? 1.8;
    const labelFontKey = style.font ?? 'Cinzel';

    const midRadius = (radii.inner + radii.outer) / 2;

    // Orientation handling for divisions that need reversed/flipped text (Wisdom, Gospels)
    const reverseFor: Partial<Record<DivisionKey, boolean>> = {
      wisdom: true,
      gospels: true,
    };
    const flipRotationFor: Partial<Record<DivisionKey, boolean>> = {
      wisdom: true,
      gospels: true,
    };

    const shouldReverse = reverseFor[division.key] ?? false;
    const shouldFlip = flipRotationFor[division.key] ?? false;

    if (division.key === 'epistles' && textLines.length === 2) {
      const [line1, line2] = textLines.map(l => l.toUpperCase());

      const upperCenter = Math.PI * 0.52;
      const lowerCenter = Math.PI * 1.52;

      const step = charAngularStep;
      const ntArcWidth = (line1.length + 1) * step;
      const epArcWidth = (line2.length + 1) * step;

      const upperStart = upperCenter - ntArcWidth / 2 + effectiveOffset;
      const upperEnd = upperCenter + ntArcWidth / 2 + effectiveOffset;
      const lowerStart = lowerCenter - epArcWidth / 2 + effectiveOffset;
      const lowerEnd = lowerCenter + epArcWidth / 2 + effectiveOffset;

      createCurvedText({
        text: line1,
        thetaStart: upperStart,
        thetaEnd: upperEnd,
        radius: midRadius + 0.37,
        z: depth + bevel + 0.3,
        fontSize: labelFontSize,
        color: 0x141428,
        flipRotation: shouldFlip,
        font: labelFontKey,
      }, group, charMeshes);

      createCurvedText({
        text: line2,
        thetaStart: lowerStart,
        thetaEnd: lowerEnd,
        radius: midRadius - 0.37,
        z: depth + bevel + 0.3,
        fontSize: labelFontSize * 1.07,
        color: 0x141428,
        flipRotation: shouldFlip,
        font: labelFontKey,
      }, group, charMeshes);
    } else {
      // Apply reverse logic for divisions like Wisdom
      let processedLines = textLines.map(l => l.toUpperCase());
      if (shouldReverse) {
        processedLines = processedLines.map(line => line.split('').reverse().join(''));
      }

      const linesForSizing = processedLines;
      const longestLine = linesForSizing.reduce((a, b) => (a.length > b.length ? a : b), '');
      const numChars = longestLine.length || 1;

      const step = charAngularStep;
      const textArcWidth = (numChars + 1) * step;

      const textThetaStart = blockMidAngle - textArcWidth / 2 + effectiveOffset;
      const textThetaEnd = blockMidAngle + textArcWidth / 2 + effectiveOffset;

      const isTwoLine = processedLines.length > 1;
      const halfGap = 0.37;

      if (isTwoLine) {
        const [line1, line2] = processedLines;

        createCurvedText({
          text: line1,
          thetaStart: textThetaStart,
          thetaEnd: textThetaEnd,
          radius: midRadius + halfGap,
          z: depth + bevel + 0.3,
          fontSize: labelFontSize,
          color: 0x141428,
          flipRotation: shouldFlip,
          font: labelFontKey,
        }, group, charMeshes);

        createCurvedText({
          text: line2,
          thetaStart: textThetaStart,
          thetaEnd: textThetaEnd,
          radius: midRadius - halfGap,
          z: depth + bevel + 0.3,
          fontSize: labelFontSize,
          color: 0x141428,
          flipRotation: shouldFlip,
          font: labelFontKey,
        }, group, charMeshes);
      } else {
        const upperText = processedLines[0];
        createCurvedText({
          text: upperText,
          thetaStart: textThetaStart,
          thetaEnd: textThetaEnd,
          radius: midRadius,
          z: depth + bevel + 0.3,
          fontSize: labelFontSize,
          color: 0x141428,
          flipRotation: shouldFlip,
          font: labelFontKey,
        }, group, charMeshes);
      }
    }

    divisionLabelGroupsRef.current.push(charMeshes);

    // Attach labels to the corresponding block so hover lift moves them together
    // and they sit on the block surface.
    if (divisionBlockMeshesRef && divisionBlockMeshesRef.current.length > 0) {
      const divIndex = DIVISIONS.findIndex(d => d.key === division.key);
      const targetBlock = divisionBlockMeshesRef.current[divIndex];
      if (targetBlock) {
        const data: DivisionBlockUserData = {
          labels: charMeshes,
          labelRestZ: charMeshes.map((l: any) => l.position.z),
        };
        targetBlock.userData = data;
      }
    }
  }
}
