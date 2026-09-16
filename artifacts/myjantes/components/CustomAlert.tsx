import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

type AlertType = 'success' | 'error' | 'warning' | 'info';
type ButtonStyle = 'default' | 'primary' | 'secondary' | 'cancel';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: ButtonStyle;
}

interface AlertConfig {
  type: AlertType;
  title: string;
  message: string;
  buttons: AlertButton[];
}

interface AlertState extends AlertConfig {
  visible: boolean;
}

const DEFAULT_ALERT_STATE: AlertState = {
  visible: false,
  type: 'info',
  title: '',
  message: '',
  buttons: [],
};

const ICON_CONFIG: Record<AlertType, { name: string; color: string }> = {
  success: {
    name: 'checkmark-circle',
    color: Colors.success,
  },
  error: {
    name: 'close-circle',
    color: Colors.error,
  },
  warning: {
    name: 'warning',
    color: Colors.warning,
  },
  info: {
    name: 'information-circle',
    color: Colors.primary,
  },
};

interface CustomAlertComponentProps {
  alertState: AlertState;
  onDismiss: () => void;
}

function CustomAlertComponent({ alertState, onDismiss }: CustomAlertComponentProps) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (alertState.visible) {
      scale.value = withSpring(1, { damping: 12, mass: 1, overshootClamping: false });
      opacity.value = withSpring(1, { damping: 12, mass: 1, overshootClamping: false });
    } else {
      scale.value = 0.8;
      opacity.value = 0;
    }
  }, [alertState.visible, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const iconConfig = ICON_CONFIG[alertState.type];

  const handleButtonPress = useCallback(
    (button: AlertButton) => {
      button.onPress?.();
      onDismiss();
    },
    [onDismiss]
  );

  return (
    <Modal
      visible={alertState.visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>
        <View style={styles.overlay} />
        <Animated.View style={[styles.alertBox, animatedStyle]}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name={iconConfig.name as any}
              size={48}
              color={iconConfig.color}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>{alertState.title}</Text>

          {/* Message */}
          <Text style={styles.message}>{alertState.message}</Text>

          {/* Buttons */}
          <View
            style={[
              styles.buttonsContainer,
              alertState.buttons.length === 1
                ? styles.buttonsContainerSingle
                : styles.buttonsContainerMultiple,
            ]}
          >
            {alertState.buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'primary' ? styles.buttonPrimary : styles.buttonDefault,
                  alertState.buttons.length > 1 && styles.buttonMultiple,
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'primary' && styles.buttonTextPrimary,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface UseCustomAlertReturn {
  showAlert: (config: AlertConfig) => void;
  AlertComponent: ReactNode;
}

export function useCustomAlert(): UseCustomAlertReturn {
  const [alertState, setAlertState] = useState<AlertState>(DEFAULT_ALERT_STATE);

  const showAlert = useCallback((config: AlertConfig) => {
    setAlertState({
      ...config,
      visible: true,
    });
  }, []);

  const onDismiss = useCallback(() => {
    setAlertState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  const AlertComponent = useMemo(
    () => <CustomAlertComponent alertState={alertState} onDismiss={onDismiss} />,
    [alertState, onDismiss]
  );

  return {
    showAlert,
    AlertComponent,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  alertBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 24,
    paddingVertical: 28,
    maxWidth: 320,
    width: '85%',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonsContainer: {
    width: '100%',
  },
  buttonsContainerSingle: {
    flexDirection: 'column',
  },
  buttonsContainerMultiple: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDefault: {
    backgroundColor: Colors.surfaceSecondary,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonMultiple: {
    flex: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  buttonTextPrimary: {
    color: Colors.white,
  },
});
