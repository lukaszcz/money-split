import React from 'react';
import { router } from 'expo-router';
import PasswordUpdateForm from '@/components/PasswordUpdateForm';
import { useAuth } from '@/contexts/AuthContext';

export default function ChangePasswordScreen() {
  const { changePassword } = useAuth();

  const handleSubmit = async ({
    currentPassword,
    newPassword,
  }: {
    currentPassword: string;
    newPassword: string;
  }) => {
    await changePassword(currentPassword, newPassword);
    router.replace('/(tabs)/settings');
  };

  return (
    <PasswordUpdateForm
      title="Change password"
      submitLabel="Change password"
      requireCurrentPassword
      defaultSubmitErrorMessage="Unable to change password"
      onSubmit={handleSubmit}
    />
  );
}
