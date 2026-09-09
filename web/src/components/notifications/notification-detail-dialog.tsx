import { useQuery } from '@tanstack/react-query';

import { QueryErrorState } from '@/components/query-error-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/types';
import { DELIVERY_LABELS, fetchNotification, notificationKeys } from '@/lib/data/notifications';

export function NotificationDetailDialog({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: notificationKeys.detail(id ?? ''),
    queryFn: () => fetchNotification(id ?? ''),
    enabled: id !== null,
  });

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail.data?.notification.title ?? 'Détail de l’envoi'}</DialogTitle>
          <DialogDescription>Une ligne par destinataire.</DialogDescription>
        </DialogHeader>

        {(() => {
          if (detail.isPending && id !== null) {
            return (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            );
          }
          if (detail.isError) {
            return (
              <QueryErrorState
                error={detail.error}
                onRetry={() => {
                  void detail.refetch();
                }}
                fallback="Le détail n’a pas pu être chargé."
              />
            );
          }
          if (detail.data === undefined) return null;
          return (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Destinataire</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Lue le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail.data.recipients ?? []).map((recipient) => (
                    <TableRow key={recipient.userId}>
                      <TableCell>
                        <span className="block font-[600]">{recipient.fullName}</span>
                        <span className="block text-[0.75rem] text-muted-foreground">
                          {ROLE_LABELS[recipient.role]}
                        </span>
                      </TableCell>
                      <TableCell>{DELIVERY_LABELS[recipient.status]}</TableCell>
                      <TableCell className="text-[0.8125rem] text-muted-foreground">
                        {recipient.readAt === null ? '–' : formatDateTime(recipient.readAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
