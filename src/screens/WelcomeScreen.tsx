import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  isReturningUser?: boolean;
}

interface OnboardingPage {
  title: string;
  description: string;
  emoji: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ isReturningUser = false }) => {
  const { colors } = useTheme();
  const { clearWelcomeFlags } = useAuth();
  const navigation = useNavigation();
  const [currentPage, setCurrentPage] = useState(0);

  const pages: OnboardingPage[] = isReturningUser
    ? [
        {
          title: 'Welcome Back!',
          description: 'We\'re glad to have you back. Your account has been reactivated and any content from before the 30-day retention period has been restored.',
          emoji: '👋',
        },
        {
          title: 'Your Data',
          description: 'Since you returned within 30 days, your stories and series have been automatically restored. Content is permanently deleted after 30 days of account deletion.',
          emoji: '🔄',
        },
        {
          title: 'Ready to Write',
          description: 'Everything is set up and ready to go. Let\'s continue creating something amazing!',
          emoji: '✨',
        },
      ]
    : [
        {
          title: 'Welcome to Docter.io',
          description: 'Your personal writing companion for organizing stories, characters, places, and events all in one place.',
          emoji: '📝',
        },
        {
          title: 'Create & Organize',
          description: 'Write your stories in chapters, create rich associations for characters and places, and keep everything connected.',
          emoji: '🗂️',
        },
        {
          title: 'Series Support',
          description: 'Building a multi-book series? Group related stories together and track your entire fictional universe.',
          emoji: '📚',
        },
        {
          title: 'Export Anywhere',
          description: 'Export your work to PDF, EPUB, or DOCX format whenever you need it. Your stories, your way.',
          emoji: '📤',
        },
      ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = () => {
    // Clear welcome flags so the welcome screen won't show again
    clearWelcomeFlags();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgBody,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    emoji: {
      fontSize: 80,
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 16,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 400,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 32,
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.borderLight,
    },
    dotActive: {
      width: 24,
      backgroundColor: colors.primary,
    },
    buttonContainer: {
      padding: 24,
      paddingBottom: 40,
      gap: 12,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    skipButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    skipButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  const currentPageData = pages[currentPage];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>{currentPageData.emoji}</Text>
        <Text style={styles.title}>{currentPageData.title}</Text>
        <Text style={styles.description}>{currentPageData.description}</Text>

        <View style={styles.pagination}>
          {pages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentPage && styles.dotActive,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentPage === pages.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        {currentPage < pages.length - 1 && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
