'use client';

// Kanban de Kibo UI (https://www.kibo-ui.com/r/kanban.json, MIT), repris tel quel
// hormis : annonces en français, zone de cartes en défilement natif, `KanbanBoard`
// qui accepte les attributs HTML, styles alignes sur le panneau.
import {
  type Announcements,
  closestCenter,
  DndContext,
  type DndContextProps,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createContext, type HTMLAttributes, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import tunnel from 'tunnel-rat';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const t = tunnel();

export type { DragEndEvent } from '@dnd-kit/core';

export type KanbanItemProps = {
  id: string;
  name: string;
  column: string;
} & Record<string, unknown>;

export type KanbanColumnProps = {
  id: string;
  name: string;
} & Record<string, unknown>;

type KanbanContextProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = {
  columns: C[];
  data: T[];
  activeCardId: string | null;
};

const KanbanContext = createContext<KanbanContextProps>({
  columns: [],
  data: [],
  activeCardId: null,
});

export type KanbanBoardProps = HTMLAttributes<HTMLDivElement> & {
  id: string;
  children: ReactNode;
};

export const KanbanBoard = ({ id, children, className, ...props }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      className={cn(
        'flex size-full min-h-40 flex-col overflow-hidden rounded-xl border border-border/70 text-xs shadow-elev-sm ring-2 transition-all',
        isOver ? 'ring-primary' : 'ring-transparent',
        className,
      )}
      ref={setNodeRef}
      {...props}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps<T extends KanbanItemProps = KanbanItemProps> = T & {
  children?: ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
};

export const KanbanCard = <T extends KanbanItemProps = KanbanItemProps>({
  id,
  name,
  children,
  className,
  disabled = false,
}: KanbanCardProps<T>) => {
  const { attributes, listeners, setNodeRef, transition, transform, isDragging } = useSortable({
    id,
    disabled,
  });
  const { activeCardId } = useContext(KanbanContext) as KanbanContextProps;

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <>
      <div style={style} {...listeners} {...attributes} ref={setNodeRef}>
        <Card
          className={cn(
            'cursor-grab gap-4 rounded-lg border-l-[3px] p-3 py-3 shadow-elev-sm transition-all [border-left-color:var(--teinte,var(--border))] hover:-translate-y-0.5 hover:shadow-elev-md',
            disabled && 'cursor-default hover:translate-y-0',
            isDragging && 'pointer-events-none cursor-grabbing opacity-30',
            className,
          )}
        >
          {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
        </Card>
      </div>
      {activeCardId === id && (
        <t.In>
          <Card
            className={cn(
              'w-[19.5rem] rotate-2 cursor-grab gap-4 rounded-lg p-3 py-3 shadow-elev-lg ring-2 ring-primary',
              isDragging && 'cursor-grabbing',
              className,
            )}
          >
            {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
          </Card>
        </t.In>
      )}
    </>
  );
};

export type KanbanCardsProps<T extends KanbanItemProps = KanbanItemProps> = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'id'
> & {
  children: (item: T) => ReactNode;
  id: string;
};

export const KanbanCards = <T extends KanbanItemProps = KanbanItemProps>({
  children,
  className,
  ...props
}: KanbanCardsProps<T>) => {
  const { data } = useContext(KanbanContext) as KanbanContextProps<T>;
  const filteredData = data.filter((item) => item.column === props.id);
  const items = filteredData.map((item) => item.id);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SortableContext items={items}>
        <div className={cn('flex flex-grow flex-col gap-2.5 p-2.5', className)} {...props}>
          {filteredData.map(children)}
        </div>
      </SortableContext>
    </div>
  );
};

export type KanbanHeaderProps = HTMLAttributes<HTMLDivElement>;

export const KanbanHeader = ({ className, ...props }: KanbanHeaderProps) => (
  <div
    className={cn(
      'm-0 border-b border-border/60 px-3 pt-3 pb-2.5 font-semibold text-sm',
      className,
    )}
    {...props}
  />
);

export type KanbanProviderProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = Omit<DndContextProps, 'children'> & {
  children: (column: C) => ReactNode;
  className?: string | undefined;
  columns: C[];
  data: T[];
  onDataChange?: (data: T[]) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
};

export const KanbanProvider = <
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
>({
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
  className,
  columns,
  data,
  onDataChange,
  ...props
}: KanbanProviderProps<T, C>) => {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = data.find((item) => item.id === event.active.id);
    if (card) {
      setActiveCardId(event.active.id as string);
    }
    onDragStart?.(event);
  };

  const colonneSurvolee = (over: DragOverEvent['over']): string | undefined => {
    if (!over) return undefined;
    const overItem = data.find((item) => item.id === over.id);
    return overItem?.column ?? columns.find((col) => col.id === over.id)?.id ?? columns[0]?.id;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const activeItem = data.find((item) => item.id === active.id);
    const overColumn = colonneSurvolee(over);
    if (!over || !activeItem || overColumn === undefined) return;

    if (activeItem.column !== overColumn) {
      const activeIndex = data.findIndex((item) => item.id === active.id);
      const overIndex = data.findIndex((item) => item.id === over.id);
      const deplace = { ...activeItem, column: overColumn };
      const newData = [...data];
      newData[activeIndex] = deplace;
      onDataChange?.(arrayMove(newData, activeIndex, overIndex));
    }

    onDragOver?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    onDragEnd?.(event);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = data.findIndex((item) => item.id === active.id);
    const newIndex = data.findIndex((item) => item.id === over.id);
    onDataChange?.(arrayMove([...data], oldIndex, newIndex));
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const { name, column } = data.find((item) => item.id === active.id) ?? {};
      return `Carte « ${String(name)} » saisie dans la colonne « ${String(column)} »`;
    },
    onDragOver({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;
      return `Carte « ${String(name)} » au-dessus de la colonne « ${String(newColumn)} »`;
    },
    onDragEnd({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;
      return `Carte « ${String(name)} » déposée dans la colonne « ${String(newColumn)} »`;
    },
    onDragCancel({ active }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      return `Déplacement de la carte « ${String(name)} » annulé`;
    },
  };

  return (
    <KanbanContext.Provider value={{ columns, data, activeCardId }}>
      <DndContext
        accessibility={{ announcements }}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
        {...props}
      >
        <div className={cn('grid size-full auto-cols-fr grid-flow-col gap-4', className)}>
          {columns.map((column) => children(column))}
        </div>
        {typeof window !== 'undefined' &&
          createPortal(
            <DragOverlay>
              <t.Out />
            </DragOverlay>,
            document.body,
          )}
      </DndContext>
    </KanbanContext.Provider>
  );
};
