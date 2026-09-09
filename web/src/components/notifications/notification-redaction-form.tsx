import { UserPicker } from '@/components/notifications/user-picker';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CATEGORY_LABELS,
  type NotificationCategory,
  type SendableAudience,
} from '@/lib/data/notifications';
import { ROLE_LABELS, type Role } from '@/lib/types';

const CATEGORIES: NotificationCategory[] = ['ANNONCE', 'RAPPEL', 'DOSSIER', 'SYSTEME'];
const CATEGORY_ITEMS = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));

const ROLES: Role[] = [
  'ADMIN',
  'COMMERCIAL',
  'CHARGE_CLIENTELE',
  'BANQUE_FINANCE',
  'SUPERVISEUR',
  'DIRECTION',
  'ACCUEIL',
];
const ROLE_ITEMS = ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

const AUDIENCE_ITEMS: { value: SendableAudience; label: string }[] = [
  { value: 'ALL', label: 'Tout le monde' },
  { value: 'ROLE', label: 'Par rôle' },
  { value: 'USERS', label: 'Comptes choisis' },
];

export function RedactionForm({
  title,
  body,
  category,
  audience,
  audienceRole,
  audienceUserIds,
  scheduleLater,
  scheduledLocal,
  scheduleIssue,
  issue,
  onTitle,
  onBody,
  onCategory,
  onAudience,
  onAudienceRole,
  onAudienceUserIds,
  onScheduleLater,
  onScheduledLocal,
  onContinue,
}: {
  title: string;
  body: string;
  category: NotificationCategory;
  audience: SendableAudience;
  audienceRole: Role | null;
  audienceUserIds: readonly string[];
  scheduleLater: boolean;
  scheduledLocal: string;
  scheduleIssue: string | null;
  issue: string | null;
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
  onCategory: (value: NotificationCategory) => void;
  onAudience: (value: SendableAudience) => void;
  onAudienceRole: (value: Role | null) => void;
  onAudienceUserIds: (ids: string[]) => void;
  onScheduleLater: (value: boolean) => void;
  onScheduledLocal: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="notif-title">Titre</Label>
        <Input
          id="notif-title"
          maxLength={120}
          value={title}
          onChange={(event) => {
            onTitle(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notif-body">Message</Label>
        <Textarea
          id="notif-body"
          maxLength={500}
          value={body}
          onChange={(event) => {
            onBody(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notif-category">Catégorie</Label>
        <Select
          items={CATEGORY_ITEMS}
          value={category}
          onValueChange={(value) => {
            if (value !== null) onCategory(value);
          }}
        >
          <SelectTrigger id="notif-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notif-audience">Public</Label>
        <Select
          items={AUDIENCE_ITEMS}
          value={audience}
          onValueChange={(value) => {
            if (value !== null) onAudience(value);
          }}
        >
          <SelectTrigger id="notif-audience">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {audience === 'ROLE' ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="notif-role">Rôle</Label>
          <Select
            items={ROLE_ITEMS}
            value={audienceRole ?? ''}
            onValueChange={(value) => {
              onAudienceRole(value === '' ? null : (value as Role));
            }}
          >
            <SelectTrigger id="notif-role">
              <SelectValue placeholder="Choisir un rôle" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {audience === 'USERS' ? (
        <UserPicker selected={audienceUserIds} onChange={onAudienceUserIds} />
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[0.875rem] font-[600]">
          <input
            type="checkbox"
            checked={scheduleLater}
            onChange={(event) => {
              onScheduleLater(event.target.checked);
            }}
          />
          Programmer l’envoi
        </label>
        {scheduleLater ? (
          <Input
            type="datetime-local"
            aria-invalid={scheduleIssue !== null}
            value={scheduledLocal}
            onChange={(event) => {
              onScheduledLocal(event.target.value);
            }}
          />
        ) : null}
        {scheduleIssue !== null ? (
          <p className="text-[0.75rem] text-destructive">{scheduleIssue}</p>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          disabled={issue !== null}
          title={issue ?? undefined}
          onClick={onContinue}
        >
          Continuer
        </Button>
      </DialogFooter>
    </div>
  );
}
