// Mock global fetch
global.fetch = jest.fn();

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }) => {
    const React = require('react');
    return React.createElement('SafeAreaView', props, children);
  },
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openBrowserAsync: jest.fn(),
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  parse: jest.fn(),
  addEventListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  createURL: jest.fn(),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
  setString: jest.fn(),
  getString: jest.fn(),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Ionicons: 'Ionicons',
  FontAwesome: 'FontAwesome',
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
  },
  StyleSheet: {
    create: jest.fn((styles) => styles),
    flatten: jest.fn((styles) => {
      if (Array.isArray(styles)) {
        return Object.assign({}, ...styles.filter(Boolean));
      }
      return styles || {};
    }),
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
  FlatList: 'FlatList',
  Modal: ({ visible, children, ...props }) => {
    const React = require('react');
    return visible ? React.createElement('Modal', props, children) : null;
  },
  Pressable: 'Pressable',
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667 })),
  },
  Alert: {
    alert: jest.fn(),
  },
}));

// Silence console warnings during tests unless needed for debugging
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};
