import { apiClient, ApiError } from '@/api/client';

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { error, response } = await apiClient.POST('/api/v1/auth/password', {
    body: { currentPassword, newPassword },
  });
  if (error) throw new ApiError(response.status, error, 'Le mot de passe n’a pas pu être changé.');
}
