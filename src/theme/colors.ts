// Color schemes matching the web app
export const darkColors = {
  // Background colors
  bgBody: '#1a1f2e',
  bgBodyAlt: '#2c3e50',
  bgPrimary: '#2d3748',
  bgSecondary: '#374151',
  bgCard: 'rgba(255, 255, 255, 0.05)',
  bgCardHover: 'rgba(255, 255, 255, 0.08)',
  bgEditor: '#2a2e3a',
  bgEditorBlockquote: '#3a3e4a',
  bgToolbar: '#374151',
  bgUserMenu: '#2d3748',
  bgUserMenuHover: '#4a5568',
  bgModal: '#2d3748',

  // Text colors
  textPrimary: '#f5f7fa',
  textSecondary: '#d0d0d0',
  textTertiary: '#9CA3AF',
  textPlaceholder: '#6B7280',

  // Border colors
  borderLight: 'rgba(255, 255, 255, 0.1)',
  borderMedium: 'rgba(255, 255, 255, 0.2)',
  borderDark: '#333',

  // Brand colors
  primary: '#007AFF',
  primaryHover: '#0051D5',
  primaryLight: '#E5F1FF',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',

  // Association type colors
  associationCharacter: '#4ade80',
  associationPlace: '#60a5fa',
  associationEvent: '#f87171',
  associationItem: '#fbbf24',

  // Shadow colors
  shadowSm: 'rgba(0, 0, 0, 0.05)',
  shadowMd: 'rgba(0, 0, 0, 0.1)',
  shadowLg: 'rgba(0, 0, 0, 0.15)',
  shadowCard: 'rgba(0, 0, 0, 0.3)',
};

export const lightColors = {
  // Background colors
  bgBody: '#e3f2fd',
  bgBodyAlt: '#bbdefb',
  bgPrimary: '#ffffff',
  bgSecondary: '#f5f5f5',
  bgCard: 'rgba(187, 222, 251, 0.9)',
  bgCardHover: 'rgba(187, 222, 251, 1)',
  bgEditor: '#ffffff',
  bgEditorBlockquote: '#f5f5f5',
  bgToolbar: '#ffffff',
  bgUserMenu: '#ffffff',
  bgUserMenuHover: '#e3f2fd',
  bgModal: '#ffffff',

  // Text colors
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#888888',
  textPlaceholder: '#999999',

  // Border colors
  borderLight: 'rgba(0, 0, 0, 0.1)',
  borderMedium: 'rgba(0, 0, 0, 0.2)',
  borderDark: '#ddd',

  // Brand colors
  primary: '#007AFF',
  primaryHover: '#0051D5',
  primaryLight: '#E5F1FF',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',

  // Association type colors
  associationCharacter: '#2e7d32',
  associationPlace: '#1565c0',
  associationEvent: '#c62828',
  associationItem: '#f57c00',

  // Shadow colors
  shadowSm: 'rgba(0, 0, 0, 0.05)',
  shadowMd: 'rgba(0, 0, 0, 0.1)',
  shadowLg: 'rgba(0, 0, 0, 0.15)',
  shadowCard: 'rgba(0, 0, 0, 0.1)',
};

export type ColorScheme = typeof darkColors;
