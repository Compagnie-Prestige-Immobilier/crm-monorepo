'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileTextIcon, LoaderIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toastApiError } from '@/lib/mutation-feedback';
import { routeProblem } from './audience';
import {
  createTemplate,
  fetchTemplates,
  notificationKeys,
  updateTemplate,
} from '@/lib/data/notifications';
import { AndroidPreview } from './android-preview';
import { mergedVariables, renderNotification } from './template';
import { CATEGORY_LABELS, type NotificationCategory, type NotificationTemplate } from './types';

const CATEGORIES: NotificationCategory[] = ['ANNONCE', 'RAPPEL', 'CAMPAGNE', 'DOSSIER', 'SYSTEME'];

/**
 * `Select.Value` de Base UI affiche la VALEUR choisie, pas le texte de l'item :
 * sans cette table, la gâchette montrerait « SYSTEME » au lieu de « Système ».
 */
const CATEGORY_ITEMS = CATEGORIES.map((item) => ({ value: item, label: CATEGORY_LABELS[item] }));

/**
 * Gabarits.
 *
 * La liste des variables n'est JAMAIS saisie : elle est déduite du texte, ici
 * comme sur le serveur. Un champ « variables » à remplir à la main diverge du
 * gabarit dès la première correction : l'auteur ajoute `{{campagne}}` au corps,
 * oublie la liste, et le compositeur cesse de proposer le champ. La variable
 * reste alors éternellement non substituée.
 */
export function TemplateManager() {
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const templates = useQuery({
    queryKey: notificationKeys.templates,
    queryFn: () => fetchTemplates(true),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouveau gabarit
        </Button>
      </div>

      {templates.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : templates.isError ? (
        <QueryErrorState
          error={templates.error}
          onRetry={() => {
            void templates.refetch();
          }}
          fallback="Les gabarits n’ont pas pu être chargés."
        />
      ) : templates.data.items.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="Aucun gabarit"
          description="Textes réutilisables à variables."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nom</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.data.items.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <span className="block font-[600]">{template.name}</span>
                    <span className="block text-[0.75rem] text-muted-foreground">
                      {CATEGORY_LABELS[template.category]}
                      {template.isActive ? '' : ' · désactivé'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{template.titleTemplate}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.length === 0 ? (
                        <span className="text-[0.8125rem] text-muted-foreground">Aucune</span>
                      ) : (
                        template.variables.map((variable) => (
                          <Badge key={variable} variant="secondary" className="font-mono">
                            {variable}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(template);
                        setFormOpen(true);
                      }}
                    >
                      <PencilIcon aria-hidden="true" />
                      Modifier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TemplateFormDialog open={formOpen} onOpenChange={setFormOpen} template={editing} />
    </div>
  );
}

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: NotificationTemplate | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = template !== null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('ANNONCE');
  const [titleTemplate, setTitleTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [route, setRoute] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? '');
    setCategory(template?.category ?? 'ANNONCE');
    setTitleTemplate(template?.titleTemplate ?? '');
    setBodyTemplate(template?.bodyTemplate ?? '');
    setRoute(template?.route ?? '');
  }, [open, template]);

  const variables = mergedVariables(titleTemplate, bodyTemplate);

  // L'aperçu montre le gabarit avec des valeurs d'EXEMPLE nommées d'après la
  // variable. Un aperçu rempli de `{{nom}}` ne dit rien de la longueur réelle
  // de la phrase, qui est justement ce qu'on vient vérifier.
  const sample = Object.fromEntries(variables.map((variable) => [variable, `«${variable}»`]));
  const preview = renderNotification(titleTemplate, bodyTemplate, sample);

  const routeIssue = routeProblem(route);
  const blocking =
    name.trim().length < 2
      ? 'Le nom doit faire au moins deux caractères.'
      : titleTemplate.trim() === '' || bodyTemplate.trim() === ''
        ? 'Le titre et le corps sont obligatoires.'
        : routeIssue;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        category,
        titleTemplate,
        bodyTemplate,
        ...(route.trim() === '' ? {} : { route: route.trim() }),
      };
      return isEdit ? updateTemplate(template.id, payload) : createTemplate(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.templates });
      toast.success(isEdit ? `« ${saved.name} » enregistré.` : `« ${saved.name} » ajouté.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'L’enregistrement a échoué.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le gabarit' : 'Nouveau gabarit'}</DialogTitle>
          <DialogDescription>
            Variables entre doubles accolades : <code className="font-mono">{'{{nom}}'}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <Field label="Nom du gabarit" required>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              )}
            </Field>

            <Field label="Catégorie">
              {(props) => (
                <Select
                  items={CATEGORY_ITEMS}
                  value={category}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setCategory(value);
                  }}
                >
                  <SelectTrigger id={props.id}>
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
              )}
            </Field>

            <Field label="Titre" required>
              {(props) => (
                <Input
                  {...props}
                  value={titleTemplate}
                  placeholder="Bonjour {{nom}}"
                  onChange={(event) => {
                    setTitleTemplate(event.target.value);
                  }}
                />
              )}
            </Field>

            <Field label="Message" required>
              {(props) => (
                <Textarea
                  {...props}
                  value={bodyTemplate}
                  placeholder="{{nombre}} fiches à appeler."
                  onChange={(event) => {
                    setBodyTemplate(event.target.value);
                  }}
                />
              )}
            </Field>

            <Field
              label="Lien profond"
              description="Route interne ouverte au tap."
              error={routeIssue ?? undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  value={route}
                  placeholder="/phase2"
                  onChange={(event) => {
                    setRoute(event.target.value);
                  }}
                />
              )}
            </Field>

            <div className="rounded-[var(--radius-md)] border border-border bg-secondary/40 p-3">
              <p className="text-[0.75rem] font-[600]">Variables détectées</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {variables.length === 0 ? (
                  <span className="text-[0.8125rem] text-muted-foreground">Aucune</span>
                ) : (
                  variables.map((variable) => (
                    <Badge key={variable} variant="secondary" className="font-mono">
                      {variable}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="md:sticky md:top-0 md:self-start">
            <AndroidPreview title={preview.title} body={preview.body} route={route} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={blocking !== null || save.isPending}
            title={blocking ?? undefined}
            onClick={() => {
              save.mutate();
            }}
          >
            {save.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
