import React from 'react';
import { router } from 'expo-router';
import PasswordUpdateForm from '@/components/PasswordUpdateForm';
import { useAuth } from '@/contexts/AuthContext';

export default function RecoveryPasswordChangeScreen() {
  const { completeRecoveryPasswordChange } = useAuth();

  const handleSubmit = async ({
    newPassword,
  }: {
    currentPassword: string;
    newPassword: string;
  }) => {
    await completeRecoveryPasswordChange(newPassword);
    router.replace('/(tabs)/groups');
  };

  return (
    <PasswordUpdateForm
      title="Set a new password"
      subtitle="For security reasons, you need to create a permanent password to continue."
      submitLabel="Save new password"
      defaultSubmitErrorMessage="Unable to update password"
      keepLoadingOnSuccess
      onSubmit={handleSubmit}
    />
  );
}
