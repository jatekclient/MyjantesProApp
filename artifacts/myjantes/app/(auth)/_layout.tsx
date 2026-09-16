import { Stack } from "expo-router";
import React from "react";
import { ForceDarkProvider } from "@/lib/theme";

export default function AuthLayout() {
  return (
    <ForceDarkProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0A0A" } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
      </Stack>
    </ForceDarkProvider>
  );
}
