import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi, ChatConversation, ChatMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isImageContent(content: string) {
  return content.startsWith("[image]") && content.includes("[/image]");
}

function extractImageUrl(content: string) {
  const match = content.match(/\[image\](.*?)\[\/image\]/);
  return match ? match[1] : null;
}

function MessageBubble({ message, isMe, styles }: { message: ChatMessage; isMe: boolean; styles: any }) {
  const senderName = isMe
    ? "Vous"
    : message.sender
      ? `${message.sender.firstName} ${message.sender.lastName}`
      : "Inconnu";

  const isImg = isImageContent(message.content);
  const imgUrl = isImg ? extractImageUrl(message.content) : null;

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {!isMe && <Text style={styles.senderName}>{senderName}</Text>}
        {isImg && imgUrl ? (
          <Image
            source={{ uri: imgUrl }}
            style={styles.messageImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{message.content}</Text>
        )}
        <Text style={[styles.timeText, isMe && styles.timeTextMe]}>{formatTime(message.createdAt)}</Text>
      </View>
    </View>
  );
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");

  const { data: conversations = [] } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: chatApi.getConversations,
  });

  const conversation = Array.isArray(conversations)
    ? conversations.find((c: ChatConversation) => c.id === id)
    : undefined;

  const { data: messagesRaw = [], isLoading } = useQuery({
    queryKey: ["chat-messages", id],
    queryFn: () => chatApi.getMessages(id!),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const messages = Array.isArray(messagesRaw)
    ? [...messagesRaw].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  const sendMutation = useMutation({
    mutationFn: (content: string) => chatApi.sendMessage(id!, content),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages", id] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", id] });
    },
  });

  const handleSend = () => {
    const trimmed = messageText.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const bottomPad = Platform.OS === "web" ? 34 : Math.max(insets.bottom, 12);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {conversation?.title || "Conversation"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={40} color={theme.textTertiary} />
          <Text style={styles.emptyText}>Aucun message</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} isMe={item.senderId === user?.id} styles={styles} />
          )}
          inverted
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />
      )}

      <View
        style={[
          styles.inputContainer,
          { paddingBottom: bottomPad },
        ]}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Votre message..."
          placeholderTextColor={theme.textTertiary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendButton,
            (!messageText.trim() || sendMutation.isPending) && styles.sendButtonDisabled,
            pressed && !!messageText.trim() && styles.sendButtonPressed,
          ]}
          disabled={!messageText.trim() || sendMutation.isPending}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
    textAlign: "center",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  bubbleRowLeft: {
    justifyContent: "flex-start",
  },
  bubbleRowRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: theme.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: theme.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  senderName: {
    fontSize: 12,
    fontFamily: "Exo2_600SemiBold",
    color: theme.primary,
    marginBottom: 3,
  },
  messageText: {
    fontSize: 15,
    fontFamily: "Exo2_400Regular",
    color: theme.text,
    lineHeight: 21,
    flexShrink: 1,
  },
  messageTextMe: {
    color: "#FFFFFF",
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Exo2_400Regular",
    color: theme.textTertiary,
    marginTop: 5,
    alignSelf: "flex-end",
  },
  timeTextMe: {
    color: "rgba(255,255,255,0.65)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
    backgroundColor: theme.background,
    gap: 8,
  },
  attachButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0,
  },
  textInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    fontFamily: "Exo2_400Regular",
    color: theme.text,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0,
  },
  sendButtonDisabled: {
    backgroundColor: theme.surfaceSecondary,
  },
  sendButtonPressed: {
    backgroundColor: theme.primaryDark,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Exo2_500Medium",
    color: theme.textSecondary,
  },
});
