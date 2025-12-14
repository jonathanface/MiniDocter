import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

export const SubscribeScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const handleCheckout = async () => {
    // Open web checkout in browser
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace('/api', '') || 'https://rich.docter.io';
    const checkoutUrl = `${baseUrl}/checkout`;

    try {
      const supported = await Linking.canOpenURL(checkoutUrl);
      if (supported) {
        await Linking.openURL(checkoutUrl);
      } else {
        alert('Unable to open checkout. Please visit rich.docter.io/checkout in your browser.');
      }
    } catch (err) {
      alert('Unable to open checkout. Please visit rich.docter.io/checkout in your browser.');
    }
  };

  const features = [
    'Unlimited documents',
    'Unlimited associations',
    'Export to other formats',
    'Cancel anytime',
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgBody,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 24,
      maxWidth: 620,
      alignSelf: 'center',
      width: '100%',
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: 48,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 20,
      color: colors.textPrimary,
      opacity: 0.8,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    featuresList: {
      marginBottom: 24,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.success + '20',
      borderWidth: 2,
      borderColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    checkmarkText: {
      color: colors.success,
      fontSize: 14,
      fontWeight: 'bold',
    },
    featureText: {
      fontSize: 16,
      color: colors.textPrimary,
      flex: 1,
    },
    buttonContainer: {
      marginBottom: 16,
    },
    subscribeButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 12,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    secureContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    secureIcon: {
      fontSize: 16,
      marginRight: 6,
      color: colors.textSecondary,
    },
    secureText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    disclaimer: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    link: {
      textDecorationLine: 'underline',
    },
    closeButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      alignItems: 'center',
      marginTop: 16,
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Full membership</Text>
            <Text style={styles.subtitle}>$5 / month — unlimited access</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.featuresList}>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.subscribeButton}
                onPress={handleCheckout}
              >
                <Text style={styles.buttonText}>Subscribe for $5/mo →</Text>
              </TouchableOpacity>

              <View style={styles.secureContainer}>
                <Text style={styles.secureIcon}>🔒</Text>
                <Text style={styles.secureText}>Secure checkout by Stripe</Text>
              </View>

              <Text style={styles.disclaimer}>
                By subscribing you agree to our{' '}
                <Text style={styles.link}>Terms</Text> and{' '}
                <Text style={styles.link}>Privacy Policy</Text>.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
