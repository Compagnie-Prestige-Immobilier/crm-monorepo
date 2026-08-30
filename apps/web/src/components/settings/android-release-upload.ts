'use client';

import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type MutationStatus,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  markAndroidReleaseMandatory,
  uploadAndroidRelease,
  type AndroidRelease,
} from '@/lib/data/app-updates';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

export interface AndroidUploadVariables {
  file: File;
  notes: string;
  controller: AbortController;
}

export interface AndroidUploadProgress {
  fileName: string;
  loaded: number;
  total: number;
}

export interface AndroidUploadSnapshot {
  id: number;
  status: MutationStatus;
  data: AndroidRelease | undefined;
  error: Error | null;
  variables: AndroidUploadVariables | undefined;
}

/**
 * La mutation vit dans le cache, pas dans la carte : l'administrateur peut
 * quitter Paramètres pendant l'envoi sans l'interrompre.
 */
export function useAndroidReleaseUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: queryKeys.androidReleaseUpload,
    // La fenêtre de confirmation se lit dans la mutation : ramassée au bout de
    // cinq minutes, elle disparaîtrait sous les yeux de qui la lit.
    gcTime: 30 * 60 * 1_000,
    mutationFn: ({ file, notes, controller }: AndroidUploadVariables) => {
      queryClient.setQueryData<AndroidUploadProgress>(queryKeys.androidReleaseProgress, {
        fileName: file.name,
        loaded: 0,
        total: file.size,
      });
      return uploadAndroidRelease({
        file,
        notes,
        signal: controller.signal,
        onProgress: (loaded, total) => {
          queryClient.setQueryData<AndroidUploadProgress>(queryKeys.androidReleaseProgress, {
            fileName: file.name,
            loaded,
            total,
          });
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.androidReleases });
    },
    onSettled: () => {
      queryClient.setQueryData(queryKeys.androidReleaseProgress, null);
    },
  });
}

export function useAndroidUploadProgress(): AndroidUploadProgress | null {
  return (
    useQuery({
      queryKey: queryKeys.androidReleaseProgress,
      queryFn: () => null as AndroidUploadProgress | null,
      enabled: false,
      initialData: null,
      gcTime: Number.POSITIVE_INFINITY,
    }).data ?? null
  );
}

/** Le dernier envoi connu, lu depuis le cache : il survit au démontage de la carte. */
export function useAndroidUploadSnapshot(): AndroidUploadSnapshot | undefined {
  const snapshots = useMutationState({
    filters: { mutationKey: queryKeys.androidReleaseUpload },
    select: (mutation): AndroidUploadSnapshot => ({
      id: mutation.mutationId,
      status: mutation.state.status,
      data: mutation.state.data as AndroidRelease | undefined,
      error: mutation.state.error,
      variables: mutation.state.variables as AndroidUploadVariables | undefined,
    }),
  });
  return snapshots.at(-1);
}

export function useMarkMandatory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionCode: number) => markAndroidReleaseMandatory(versionCode),
    onSuccess: (release) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.androidReleases });
      toast.success(`CPI GO ${release.versionName} est maintenant obligatoire.`);
    },
    onError: (error) => {
      toastApiError(error, 'La version n’a pas pu être rendue obligatoire.');
    },
  });
}
