import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Association } from '../types';
import { apiGet } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';

interface AssociationPanelProps {
  visible: boolean;
  associationId: string | null;
  storyId: string;
  onClose: () => void;
}

export const AssociationPanel: React.FC<AssociationPanelProps> = ({
  visible,
  associationId,
  storyId,
  onClose,
}) => {
  const { colors } = useTheme();
  const [association, setAssociation] = useState<Association | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && associationId) {
      loadAssociation();
    }
  }, [visible, associationId]);

  const loadAssociation = async () => {
    if (!associationId || !storyId) return;

    try {
      setLoading(true);
      const response = await apiGet(`/stories/${storyId}/associations/${associationId}`);

      if (!response.ok) {
        throw new Error(`Failed to load association: ${response.status}`);
      }

      const data: Association = await response.json();
      setAssociation(data);
    } catch (error) {
      console.error('Failed to load association:', error);
      setAssociation(null);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'character':
        return colors.associationCharacter;
      case 'place':
        return colors.associationPlace;
      case 'event':
        return colors.associationEvent;
      case 'item':
        return colors.associationItem;
      default:
        return '#9ca3af';
    }
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    panel: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      minHeight: '50%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitleContainer: {
      flex: 1,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 2,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 24,
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    typeBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginBottom: 16,
    },
    typeBadgeText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
    portraitContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    portrait: {
      width: 150,
      height: 150,
      borderRadius: 12,
    },
    name: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 16,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    sectionText: {
      fontSize: 16,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    errorText: {
      fontSize: 16,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 40,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.panel} edges={['bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              {association ? (
                <>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {association.association_name}
                  </Text>
                  <Text style={styles.headerSubtitle}>ASSOCIATION</Text>
                </>
              ) : (
                <Text style={styles.headerTitle}>Association</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
              </View>
            ) : association ? (
              <>
                {/* Type Badge */}
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: getTypeColor(association.association_type) },
                  ]}
                >
                  <Text style={styles.typeBadgeText}>
                    {getTypeLabel(association.association_type)}
                  </Text>
                </View>

                {/* Portrait */}
                {association.portrait && (
                  <View style={styles.portraitContainer}>
                    <Image
                      source={{ uri: association.portrait }}
                      style={styles.portrait}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* Short Description */}
                {association.short_description && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Summary</Text>
                    <Text style={styles.sectionText}>{association.short_description}</Text>
                  </View>
                )}

                {/* Extended Description */}
                {association.details?.extended_description && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Background</Text>
                    <Text style={styles.sectionText}>
                      {association.details.extended_description}
                    </Text>
                  </View>
                )}

                {/* Aliases */}
                {association.aliases && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Aliases</Text>
                    <Text style={styles.sectionText}>{association.aliases}</Text>
                  </View>
                )}

                {/* Case Sensitive */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Case Sensitive</Text>
                  <Text style={styles.sectionText}>
                    {association.case_sensitive ? 'Yes' : 'No'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.errorText}>Failed to load association details</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
