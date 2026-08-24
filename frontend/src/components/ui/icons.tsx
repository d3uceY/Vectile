import type { JSX } from "solid-js";

type IconProps = {
  class?: string;
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
};

function Icon(props: IconProps & { children: JSX.Element }) {
  const size = () => props.size ?? 18;
  const sw = () => props.strokeWidth ?? 1.75;
  return (
    <svg
      class={props.class}
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={props["aria-hidden"] ?? true}
    >
      {props.children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </Icon>
);

export const LibraryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    <path d="M9 7h7M9 11h7" />
  </Icon>
);

export const BrowseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

export const IndexIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 19h16" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15.5" cy="7" r="2" />
    <circle cx="9.5" cy="17" r="2" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01" />
    <path d="M11 12h1v4h1" />
  </Icon>
);

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </Icon>
);

export const FolderOpenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8V7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2v1" />
    <path d="M3.5 10.5 5.2 18a2 2 0 0 0 1.96 1.6h9.7a2 2 0 0 0 1.95-1.6l1.7-7.5a.8.8 0 0 0-.78-.98H4.28a.8.8 0 0 0-.78.98Z" />
  </Icon>
);

export const FileIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8Z" />
    <path d="M14 3v5h5" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 3v4h-4" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6.5 7 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const BoltIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5Z" />
  </Icon>
);

export const LeafIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20c0-9 5-15 16-16-1 11-7 16-16 16Z" />
    <path d="M4 20c4-8 9-12 13-14" />
  </Icon>
);
