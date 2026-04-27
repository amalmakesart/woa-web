import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnread } from '../contexts/UnreadContext';

interface BellButtonProps {
  onPress: () => void;
}

export default function BellButton({ onPress }: BellButtonProps) {
  const { totalBadge } = useUnread();
  const hasUnread = totalBadge > 0;

  return (
    <TouchableOpacity onPress={onPress} style={s.wrap} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons
        name={hasUnread ? 'notifications' : 'notifications-outline'}
        size={20}
        color={hasUnread ? '#ffffff' : '#9a9a9a'}
      />
      {hasUnread ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{totalBadge > 9 ? '9+' : totalBadge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -6,
    backgroundColor: '#c0392b',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: 'bold',
  },
});
