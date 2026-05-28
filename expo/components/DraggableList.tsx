import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface DraggableListProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number, isDragging: boolean, onDragStart: () => void) => React.ReactNode;
  onReorder: (data: T[]) => void;
  disabled?: boolean;
}

const ITEM_HEIGHT = 66;

export default function DraggableList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  disabled,
}: DraggableListProps<T>) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [itemHeights, setItemHeights] = useState<number[]>([]);
  const dragY = useRef(new Animated.Value(0)).current;
  const currentOrder = useRef<T[]>(data);
  const currentIndex = useRef(0);
  const activeIndex = useRef<number | null>(null);

  useEffect(() => {
    currentOrder.current = data;
  }, [data]);

  const getItemHeight = useCallback((index: number) => {
    return itemHeights[index] || ITEM_HEIGHT;
  }, [itemHeights]);

  const getOffsetForIndex = useCallback((index: number) => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i);
    }
    return offset;
  }, [getItemHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (disabled || activeIndex.current === null) return false;
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dx) < 30;
      },
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        if (activeIndex.current === null || disabled) return;

        dragY.setValue(gestureState.dy);

        const draggedOffset = getOffsetForIndex(activeIndex.current) + gestureState.dy;
        const totalItems = currentOrder.current.length;

        let newIndex = activeIndex.current;
        let accumulatedOffset = 0;
        for (let i = 0; i < totalItems; i++) {
          const h = getItemHeight(i);
          if (draggedOffset < accumulatedOffset + h / 2) {
            newIndex = i;
            break;
          }
          accumulatedOffset += h;
          if (i === totalItems - 1) {
            newIndex = totalItems - 1;
          }
        }

        if (newIndex !== currentIndex.current) {
          Haptics.selectionAsync();
          const newOrder = [...currentOrder.current];
          const [removed] = newOrder.splice(currentIndex.current, 1);
          newOrder.splice(newIndex, 0, removed);
          currentOrder.current = newOrder;
          currentIndex.current = newIndex;
          onReorder(newOrder);
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 30,
          bounciness: 6,
        }).start();
        setDraggingIndex(null);
        activeIndex.current = null;
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 30,
          bounciness: 6,
        }).start();
        setDraggingIndex(null);
        activeIndex.current = null;
      },
    })
  ).current;

  const handleDragStart = useCallback((index: number) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dragY.setValue(0);
    activeIndex.current = index;
    currentIndex.current = index;
    setDraggingIndex(index);
  }, [disabled, dragY]);

  const handleItemLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setItemHeights(prev => {
      const updated = [...prev];
      updated[index] = height;
      return updated;
    });
  }, []);

  return (
    <View {...panResponder.panHandlers}>
      {data.map((item, index) => {
        const key = keyExtractor(item, index);
        const isDragging = draggingIndex === index;

        const animatedStyle = isDragging
          ? {
              transform: [{ translateY: dragY }],
              zIndex: 999,
              elevation: 10,
            }
          : {
              zIndex: 1,
            };

        return (
          <Animated.View
            key={key}
            style={[
              styles.itemWrapper,
              animatedStyle,
              isDragging && styles.draggingItem,
            ]}
            onLayout={(e) => handleItemLayout(index, e)}
          >
            {renderItem(item, index, isDragging, () => handleDragStart(index))}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  itemWrapper: {
    marginBottom: 8,
  },
  draggingItem: {
    opacity: 0.92,
    shadowColor: Colors.f1Red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    ...(Platform.OS === 'web' ? {} : {}),
  },
});
