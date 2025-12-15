import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

export const UserMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const navigation = useNavigation();

  const handleSignOut = async () => {
    setIsOpen(false);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleSettings = () => {
    setIsOpen(false);
    navigation.navigate('Account' as never);
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

  // Get first letter of email for avatar
  const avatarLetter = user?.email?.charAt(0).toUpperCase() || 'U';

  const styles = StyleSheet.create({
    avatarButton: {
      marginLeft: 16,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      paddingTop: 50,
      paddingLeft: 16,
    },
    menuContainer: {
      backgroundColor: colors.bgUserMenu,
      borderRadius: 12,
      minWidth: 250,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    menuHeader: {
      padding: 16,
      alignItems: 'center',
    },
    avatarLarge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarTextLarge: {
      color: '#fff',
      fontSize: 28,
      fontWeight: '600',
    },
    emailText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    menuDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
    },
    menuItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    menuItemText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    signOutText: {
      color: colors.danger,
    },
  });

  return (
    <>
      <TouchableOpacity style={styles.avatarButton} onPress={() => setIsOpen(true)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarTextLarge}>{avatarLetter}</Text>
              </View>
              <Text style={styles.emailText} numberOfLines={1}>
                {user?.email || 'Unknown User'}
              </Text>
            </View>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleThemeToggle}>
              <Text style={styles.menuItemText}>
                {theme === 'dark' ? '☀️  Light Mode' : '🌙  Dark Mode'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleSettings}>
              <Text style={styles.menuItemText}>⚙️  Account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <Text style={[styles.menuItemText, styles.signOutText]}>
                🚪  Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};
