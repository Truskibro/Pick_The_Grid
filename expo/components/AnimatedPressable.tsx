import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface AnimatedPressableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleDown?: number;
  haptic?: boolean;
}

/**
 * Styles that position/size the pressable within its parent must stay on the
 * outer Animated.View; every visual and content-layout style (flexDirection,
 * alignItems, padding, background, border…) must reach the inner Pressable,
 * because that is the direct parent of the children. Without this split the
 * children always stack in a column and row-based cards render broken.
 */
const OUTER_ONLY_KEYS = new Set<string>([
  'margin', 'marginVertical', 'marginHorizontal', 'marginTop', 'marginBottom',
  'marginLeft', 'marginRight', 'marginStart', 'marginEnd',
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'position', 'top', 'left', 'right', 'bottom', 'start', 'end',
  'zIndex', 'elevation', 'width', 'maxWidth', 'maxHeight',
]);

/** Fixed-size props are safe on both layers (no percentage-of-parent traps). */
const BOTH_KEYS = new Set<string>([
  'minWidth', 'minHeight', 'height', 'aspectRatio',
]);

function splitStyle(style: StyleProp<ViewStyle>): {
  outer: ViewStyle;
  inner: ViewStyle;
} {
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  const flat = (style ? StyleSheet.flatten(style) : undefined) ?? {};

  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue;
    if (OUTER_ONLY_KEYS.has(key)) {
      outer[key] = value;
    } else if (BOTH_KEYS.has(key)) {
      outer[key] = value;
      inner[key] = value;
    } else {
      inner[key] = value;
    }
  }

  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

export default function AnimatedPressable({
  children,
  style,
  scaleDown = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback((e: any) => {
    Animated.spring(scale, {
      toValue: scaleDown,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
    onPressIn?.(e);
  }, [scale, scaleDown, onPressIn]);

  const handlePressOut = useCallback((e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
    onPressOut?.(e);
  }, [scale, onPressOut]);

  const handlePress = useCallback((e: any) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  }, [haptic, onPress]);

  const { outer, inner } = splitStyle(style);

  return (
    <Animated.View style={[outer, { transform: [{ scale }] }]}>
      <Pressable
        style={inner}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
