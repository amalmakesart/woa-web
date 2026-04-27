import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnread } from '../contexts/UnreadContext';

interface MessageButtonProps {
  onPress: () => void;
}

export default function MessageButton({ onPress }: MessageButtonProps) {
  const { unreadCount } = useUnread();
  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity onPress={onPress} style={s.wrap} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons
        name={hasUnread ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
        size={19}
        color={hasUnread ? '#ffffff' : '#9a9a9a'}
      />
      {hasUnread ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
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
