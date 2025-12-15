import 'react-native-get-random-values';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { StoryListScreen } from './src/screens/StoryListScreen';
import { CreateStoryScreen } from './src/screens/CreateStoryScreen';
import { StoryEditorScreen } from './src/screens/StoryEditorScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { SubscribeScreen } from './src/screens/SubscribeScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen
              name="StoryList"
              component={StoryListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateStory"
              component={CreateStoryScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Editor"
              component={StoryEditorScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Account"
              component={AccountScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Subscribe"
              component={SubscribeScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
