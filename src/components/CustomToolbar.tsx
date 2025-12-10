import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { type EditorBridge, useBridgeState } from '@10play/tentap-editor';
import { useTheme } from '../contexts/ThemeContext';

interface CustomToolbarProps {
  editor: EditorBridge;
}

export const CustomToolbar: React.FC<CustomToolbarProps> = ({ editor }) => {
  const { colors } = useTheme();
  const editorState = useBridgeState(editor);

  const formatButton = (label: string, onPress: () => void, isActive: boolean = false) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: isActive ? colors.primary : colors.bgCard,
          borderColor: isActive ? colors.primary : colors.borderMedium,
        }
      ]}
    >
      <Text style={[
        styles.buttonText,
        { color: isActive ? colors.textPrimary : colors.textSecondary }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.toolbar, { backgroundColor: colors.bgToolbar }]}>
      {formatButton('B', () => editor.toggleBold())}
      {formatButton('I', () => editor.toggleItalic())}
      {formatButton('U', () => editor.toggleUnderline())}
      {formatButton('S', () => editor.toggleStrike())}
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  button: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
});
