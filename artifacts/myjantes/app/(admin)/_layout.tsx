import { router } from "expo-router";
import React, { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function AdminLayout() {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      router.replace(isAuthenticated ? "/(main)" as any : "/(auth)/login");
    }
  }, [isLoading, isAuthenticated]);

  return null;
}
