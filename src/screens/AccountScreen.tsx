import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getBillingSummary, createPortalSession, apiDelete } from '../utils/api';
import { SubscriptionSummary } from '../types/User';
import { useNavigation } from '@react-navigation/native';

export const AccountScreen = () => {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const navigation = useNavigation();
  const [data, setData] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPortal, setProcessingPortal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await getBillingSummary();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load subscription summary: ${response.status}`);
      }

      const summary: SubscriptionSummary = await response.json();
      setData(summary);
      setError(null);
    } catch (err) {
      setError('Failed to load subscription summary');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSummary();
      setLoading(false);
    };
    loadData();
  }, [fetchSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  }, [fetchSummary]);

  const status = data?.status || 'none';
  const cancelAtPeriodEnd = data?.cancelAtPeriodEnd || false;
  const hasExpiredSubscription = status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid';
  const hasActiveSubscription = status === 'active' || status === 'trialing';
  const hasIncompleteSubscription = status === 'incomplete'; // Payment being processed
  const hasNeverSubscribed = status === 'none';
  const isScheduledToCancel = hasActiveSubscription && cancelAtPeriodEnd;

  const openPortal = async () => {
    setProcessingPortal(true);
    try {
      const response = await createPortalSession('minidocter://account');
      if (!response.ok) {
        throw new Error('Failed to open portal');
      }
      const { url } = await response.json();
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        throw new Error('Cannot open URL');
      }
    } catch (err) {
      setError('Could not open billing portal');
    } finally {
      setProcessingPortal(false);
    }
  };

  const handleSubscribe = () => {
    navigation.navigate('Subscribe' as never);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete:\n\n• All your stories and chapters\n• All associations and images\n• Your subscription (if active)\n• All account data',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const response = await apiDelete('/user');

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await signOut();
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err) {
      console.error('Failed to delete account:', err);
      Alert.alert(
        'Error',
        'Failed to delete account. Please try again or contact support.'
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const getStatusColor = () => {
    if (hasActiveSubscription) {
      return colors.success;
    }
    if (hasIncompleteSubscription) {
      return colors.primary; // Blue for processing
    }
    if (hasExpiredSubscription) {
      return colors.warning;
    }
    return colors.textSecondary;
  };

  const getButtonText = () => {
    if (hasNeverSubscribed) {
      return 'JOIN NOW';
    }
    if (hasIncompleteSubscription) {
      return 'COMPLETE PAYMENT';
    }
    if (hasExpiredSubscription) {
      return 'REACTIVATE';
    }
    return 'MANAGE BILLING';
  };

  const getButtonAction = () => {
    if (hasNeverSubscribed || hasExpiredSubscription || hasIncompleteSubscription) {
      return handleSubscribe; // All need to go through checkout
    }
    return openPortal; // Only active subscriptions can manage via portal
  };

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
      maxWidth: 520,
      alignSelf: 'center',
      width: '100%',
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 16,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    statusChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: getStatusColor() + '20',
      borderWidth: 1,
      borderColor: getStatusColor(),
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: getStatusColor(),
      textTransform: 'uppercase',
    },
    errorChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.danger + '20',
      borderWidth: 1,
      borderColor: colors.danger,
    },
    errorText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.danger,
      textTransform: 'uppercase',
    },
    priceText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    messageText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    warningText: {
      color: colors.warning,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 16,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    closeButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    loader: {
      marginVertical: 20,
    },
    dangerZone: {
      marginTop: 48,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    dangerZoneTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.danger,
      marginBottom: 8,
    },
    dangerZoneText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    deleteButton: {
      backgroundColor: colors.danger,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 16,
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Membership</Text>

            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
            ) : error ? (
              <View style={styles.errorChip}>
                <Text style={styles.errorText}>Error</Text>
              </View>
            ) : (
              <View style={styles.statusContainer}>
                <View style={styles.statusChip}>
                  <Text style={styles.statusText}>{status.toUpperCase()}</Text>
                </View>
              </View>
            )}

            <Text style={styles.priceText}>$5/month • cancel anytime</Text>

            {isScheduledToCancel && data?.currentPeriodEnd && (
              <Text style={[styles.messageText, styles.warningText]}>
                Your subscription will end on {new Date(data.currentPeriodEnd).toLocaleDateString()}. You can reactivate anytime before then.
              </Text>
            )}

            {hasIncompleteSubscription && (
              <Text style={[styles.messageText, { color: colors.primary }]}>
                Your payment is being processed. Pull down to refresh or check the billing portal for status.
              </Text>
            )}

            {hasExpiredSubscription && (
              <Text style={[styles.messageText, styles.warningText]}>
                Your subscription has expired. Reactivate to restore access to premium features.
              </Text>
            )}

            {hasNeverSubscribed && (
              <Text style={styles.messageText}>
                Get unlimited documents, unlimited associations, and export your stories to multiple formats.
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || !!error || processingPortal) && styles.buttonDisabled]}
            onPress={getButtonAction()}
            disabled={loading || !!error || processingPortal}
          >
            {processingPortal ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {getButtonText()}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>

          <View style={styles.dangerZone}>
            <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
            <Text style={styles.dangerZoneText}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </Text>
            <TouchableOpacity
              style={[styles.deleteButton, deletingAccount && styles.buttonDisabled]}
              onPress={handleDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
