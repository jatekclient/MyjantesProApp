import { Stack } from "expo-router";
import React from "react";

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new-quote" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="quote-detail" options={{ headerShown: false }} />
      <Stack.Screen name="invoice-detail" options={{ headerShown: false }} />
      <Stack.Screen name="reservation-detail" options={{ headerShown: false }} />
      <Stack.Screen name="chat-detail" options={{ headerShown: false }} />
      <Stack.Screen name="delete-account" options={{ headerShown: false }} />
      <Stack.Screen name="request-reservation" options={{ headerShown: false }} />
      <Stack.Screen name="removal-request" options={{ headerShown: false }} />
      <Stack.Screen name="grouped-invoice" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ headerShown: false }} />
      <Stack.Screen name="delivery-notes" options={{ headerShown: false }} />
      <Stack.Screen name="account-contact" options={{ headerShown: false }} />
      <Stack.Screen name="support-history" options={{ headerShown: false }} />
    </Stack>
  );
}
