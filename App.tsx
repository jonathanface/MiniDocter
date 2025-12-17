import 'react-native-get-random-values';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { StoryListScreen } from './src/screens/StoryListScreen';
import { CreateStoryScreen } from './src/screens/CreateStoryScreen';
import { StoryEditorScreen } from './src/screens/StoryEditorScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { SubscribeScreen } from './src/screens/SubscribeScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, isLoading, showWelcome, isReturningUser, clearWelcomeFlags } = useAuth();
  const navigationRef = React.useRef<any>(null);

  // When showWelcome changes from true to false, navigate to StoryList
  React.useEffect(() => {
    if (user && !showWelcome && navigationRef.current) {
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        navigationRef.current?.navigate('StoryList');
      }, 100);
    }
  }, [showWelcome, user]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={user && showWelcome ? 'Welcome' : user ? 'StoryList' : 'Auth'}
      >
        {user ? (
          <>
            <Stack.Screen
              name="Welcome"
              options={{ headerShown: false }}
            >
              {() => <WelcomeScreen isReturningUser={isReturningUser} />}
            </Stack.Screen>
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
