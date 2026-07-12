import React, { useState, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSeries } from '@/providers/SeriesProvider';

interface ChamferOverlayProps {
  /** Size of the 45° chamfer cut in pixels */
  chamferSize?: number;
  /** Border color (omit for no border) */
  borderColor?: string;
  /** Border width in pixels */
  borderWidth?: number;
  /** Color behind the card — chamfer triangles are filled with this.
   *  Defaults to the current series' background color. */
  surroundingColor?: string;
}

/**
 * Absolute-positioned SVG overlay that creates true 45-degree chamfered
 * (diagonal cut) corners on the top-right and bottom-left of its parent View.
 *
 * Place as the last child of a View that has `overflow: 'hidden'`.
 * The parent should have `borderRadius: 0` and `borderWidth: 0` so the
 * SVG border is the only border.
 *
 * The overlay draws:
 *   1. Two triangles (filled with surroundingColor) to mask the parent's corners
 *   2. A chamfered border path (if borderColor + borderWidth provided)
 *
 * pointerEvents="none" ensures taps pass through to the parent/children.
 */
export default React.memo(function ChamferOverlay({
  chamferSize = 14,
  borderColor,
  borderWidth = 1,
  surroundingColor: surroundingColorOverride,
}: ChamferOverlayProps) {
  const { config } = useSeries();
  const surroundingColor = surroundingColorOverride ?? config.colors.background;
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDims(prev => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const { w, h } = dims;
  const c = chamferSize;

  // Chamfer triangles (top-right and bottom-left)
  const trTri = `M ${w - c} 0 L ${w} 0 L ${w} ${c} Z`;
  const blTri = `M 0 ${h - c} L 0 ${h} L ${c} ${h} Z`;

  // Chamfered border path — same as outer shape, stroked.
  // strokeWidth is doubled so the visible (inner) half = borderWidth.
  const borderD = `M 0 0 L ${w - c} 0 L ${w} ${c} L ${w} ${h} L ${c} ${h} L 0 ${h - c} Z`;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={handleLayout} pointerEvents="none">
      {w > 0 && h > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={w} height={h}>
          <Path d={trTri} fill={surroundingColor} />
          <Path d={blTri} fill={surroundingColor} />
          {borderColor && borderWidth > 0 && (
            <Path
              d={borderD}
              fill="none"
              stroke={borderColor}
              strokeWidth={borderWidth * 2}
              strokeLinejoin="miter"
            />
          )}
        </Svg>
      )}
    </View>
  );
});
