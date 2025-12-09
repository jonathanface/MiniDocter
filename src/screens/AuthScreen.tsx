import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export const AuthScreen = () => {
  const { signIn, isLoading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async (provider: 'google' | 'amazon') => {
    try {
      setSigningIn(true);
      await signIn(provider);
    } catch (error) {
      Alert.alert('Sign In Failed', 'Please try again');
    } finally {
      setSigningIn(false);
    }
  };

  if (isLoading || signingIn) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>MiniDocter</Text>
        <Text style={styles.subtitle}>Your writing companion</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={() => handleSignIn('google')}
            disabled={signingIn}
          >
            <Text style={styles.buttonText}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.amazonButton]}
            onPress={() => handleSignIn('amazon')}
            disabled={signingIn}
          >
            <Text style={styles.buttonText}>Sign in with Amazon</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  amazonButton: {
    backgroundColor: '#FF9900',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 32,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
