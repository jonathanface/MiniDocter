import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface EditorTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to Your Story Editor!',
    description: 'Let\'s take a quick tour of the key features to help you get started.',
    icon: 'edit' as const,
  },
  {
    title: 'Writing Your Story',
    description: 'Simply tap anywhere in the editor and start typing. Press Enter to create new paragraphs. Remember to save your work using the save button when you\'re done editing.',
    icon: 'create' as const,
  },
  {
    title: 'Text Formatting',
    description: 'Select any text to see formatting options. You can make text bold, italic, underlined, strikethrough, or change paragraph alignment.',
    icon: 'format-bold' as const,
  },
  {
    title: 'Associations',
    description: 'Associations connect text to characters, places, and other story elements. Tap highlighted text to view existing associations, or select text and long press to create new ones.',
    icon: 'link' as const,
  },
  {
    title: 'Multiple Chapters',
    description: 'Use the chapter dropdown at the top to switch between chapters. You can also create new chapters using the + button.',
    icon: 'book' as const,
  },
  {
    title: 'You\'re All Set!',
    description: 'Start writing your story! If you need help later, check the settings menu for more options.',
    icon: 'check-circle' as const,
  },
];

export const EditorTutorial: React.FC<EditorTutorialProps> = ({ visible, onComplete }) => {
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    container: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      maxHeight: Dimensions.get('window').height * 0.7,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    stepIndicator: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    content: {
      marginBottom: 24,
    },
    description: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    footer: {
      gap: 12,
    },
    progressContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 16,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.borderLight,
    },
    progressDotActive: {
      backgroundColor: colors.primary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryButtonText: {
      color: '#fff',
    },
    secondaryButtonText: {
      color: colors.textPrimary,
    },
    skipButton: {
      padding: 12,
      alignItems: 'center',
    },
    skipButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MaterialIcons name={currentStepData.icon} size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>{currentStepData.title}</Text>
            <Text style={styles.stepIndicator}>
              Step {currentStep + 1} of {TUTORIAL_STEPS.length}
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>{currentStepData.description}</Text>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.progressContainer}>
              {TUTORIAL_STEPS.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentStep && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.buttonRow}>
              {currentStep > 0 && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handlePrevious}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    Back
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleNext}
              >
                <Text style={[styles.buttonText, styles.primaryButtonText]}>
                  {isLastStep ? 'Get Started' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>

            {!isLastStep && (
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Skip Tutorial</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
