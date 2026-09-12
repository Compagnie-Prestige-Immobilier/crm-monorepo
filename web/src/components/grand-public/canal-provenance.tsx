import {
  BuildingIcon,
  FacebookIcon,
  GlobeIcon,
  InstagramIcon,
  LinkedinIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  MusicIcon,
  PhoneIncomingIcon,
  PlaneIcon,
  RadioIcon,
  SignpostIcon,
  StoreIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

/** « Meta (Facebook et Instagram) » tombe sur la même clé que « meta facebook instagram ». */
function cle(libelle: string): string {
  return libelle.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ICONES: [motif: string, icones: LucideIcon[]][] = [
  ['meta', [FacebookIcon, InstagramIcon]],
  ['facebook', [FacebookIcon]],
  ['instagram', [InstagramIcon]],
  ['linkedin', [LinkedinIcon]],
  ['whatsapp', [MessageCircleIcon]],
  ['tiktok', [MusicIcon]],
  ['site web', [GlobeIcon]],
  ['parrainage', [UsersIcon]],
  ['bouche a oreille', [MessagesSquareIcon]],
  ['salon', [StoreIcon]],
  ['affichage', [SignpostIcon]],
  ['radio', [RadioIcon]],
  ['appel entrant', [PhoneIncomingIcon]],
  ['visite en agence', [BuildingIcon]],
  ['diaspora', [PlaneIcon]],
];

function iconesDe(libelle: string): LucideIcon[] {
  const cherchee = cle(libelle);
  return ICONES.find(([motif]) => cherchee.includes(motif))?.[1] ?? [GlobeIcon];
}

/** Le canal se reconnaît d'abord à son logo, dans une liste qu'on balaie vite. */
export function CanalProvenance({ label }: { label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
        {iconesDe(label).map((Icone, i) => (
          <Icone key={i} className="size-3.5" aria-hidden="true" />
        ))}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
