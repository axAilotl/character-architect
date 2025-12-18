import { useState } from 'react';
import type { Card, CollectionData } from '../../lib/types';
import type { CCv3Data } from '../../lib/types';
import { extractCardData } from '../../store/card-store';
import { getDeploymentConfig } from '../../config/deployment';
import { getExtensions, isCollectionData } from '../../lib/card-type-guards';
import type { CardSyncState } from '../../modules/federation/lib/types';

interface IconProps {
  className?: string;
}

function ChatIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function BookIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

function FolderIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ImageIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CoinIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="9" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="10"
        fill="currentColor"
        fontWeight="bold"
        stroke="none"
      >
        T
      </text>
    </svg>
  );
}

interface GreetingsBadgeProps {
  count: number;
  hasImages: boolean;
}

function GreetingsBadge({ count, hasImages }: GreetingsBadgeProps) {
  if (count <= 0) return null;

  return (
    <div
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/60 text-xs text-white/70"
      title={`${count} Greetings${hasImages ? ' (with images)' : ''}`}
    >
      <ChatIcon className="w-3 h-3" />
      <span>{count}</span>
      {hasImages && <ImageIcon className="w-3 h-3" />}
    </div>
  );
}

interface MetadataBadgeProps {
  type: 'lorebook' | 'assets';
  count: number;
}

function MetadataBadge({ type, count }: MetadataBadgeProps) {
  if (count <= 0) return null;

  const config = {
    lorebook: { icon: BookIcon, label: 'Lorebook entries' },
    assets: { icon: FolderIcon, label: 'Assets' },
  };

  const { icon: Icon, label } = config[type];

  return (
    <div
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/60 text-xs text-white/70"
      title={`${count} ${label}`}
    >
      <Icon className="w-3 h-3" />
      <span>{count}</span>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  collection: 'bg-purple-900/80 text-purple-200',
  lorebook: 'bg-green-900/80 text-green-200',
  voxta: 'bg-indigo-900/80 text-indigo-200',
  charx: 'bg-cyan-900/80 text-cyan-200',
  v3: 'bg-emerald-900/80 text-emerald-200',
  v2: 'bg-amber-900/80 text-amber-200',
};

interface FormatBadgeProps {
  spec: string;
  isVoxta: boolean;
  isCharx: boolean;
}

function FormatBadge({ spec, isVoxta, isCharx }: FormatBadgeProps) {
  let label: string;
  let colorKey: string;

  if (spec === 'collection') {
    label = 'COLLECTION';
    colorKey = 'collection';
  } else if (spec === 'lorebook') {
    label = 'LOREBOOK';
    colorKey = 'lorebook';
  } else if (isVoxta) {
    label = 'VOXTA';
    colorKey = 'voxta';
  } else if (isCharx) {
    label = 'CHARX';
    colorKey = 'charx';
  } else {
    label = spec.toUpperCase();
    colorKey = spec.toLowerCase();
  }

  const colorClass = TYPE_COLORS[colorKey] || 'bg-gray-800/80 text-gray-200';

  return <div className={`px-1.5 py-0.5 rounded text-xs font-bold ${colorClass}`}>{label}</div>;
}

interface TokenBadgeProps {
  count: number;
}

function TokenBadge({ count }: TokenBadgeProps) {
  const formatCount = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/40 text-xs text-white/60"
      title={`${count.toLocaleString()} tokens`}
    >
      <CoinIcon className="w-3 h-3" />
      <span>{formatCount(count)}</span>
    </div>
  );
}

type ExportFormat = 'json' | 'png' | 'charx' | 'voxta';

interface ExportDropdownProps {
  spec: string;
  isCollection: boolean;
  onExport: (format: ExportFormat) => void;
}

function ExportDropdown({ spec, isCollection, onExport }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  let formats: { value: ExportFormat; label: string }[] = [];

  if (spec === 'lorebook') {
    formats = [
      { value: 'json', label: 'JSON' },
      { value: 'png', label: 'PNG' },
    ];
  } else if (isCollection) {
    formats = [{ value: 'voxta', label: 'Voxta Package' }];
  } else {
    formats = [
      { value: 'json', label: 'JSON' },
      { value: 'png', label: 'PNG' },
      { value: 'charx', label: 'CHARX' },
      { value: 'voxta', label: 'Voxta' },
    ];
  }

  const handleExport = (format: ExportFormat) => {
    setIsOpen(false);
    onExport(format);
  };

  return (
    <div className={`relative ${isOpen ? 'z-[100]' : ''}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-0.5 px-2 py-1 bg-black/40 hover:bg-black/60 rounded text-white/70 hover:text-white transition-colors text-xs"
        title="Export"
      >
        Export
        <ChevronDownIcon className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div className="absolute right-0 bottom-full mb-1 z-50 bg-dark-surface border border-dark-border rounded shadow-lg py-1 min-w-[100px]">
            {formats.map((format) => (
              <button
                key={format.value}
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport(format.value);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-dark-text hover:bg-dark-border transition-colors"
              >
                {format.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-dark-surface" />
    </div>
  );
}

export interface CardItemProps {
  card: Card;
  cards: Card[];
  cardSyncMap: Map<string, CardSyncState>;
  selectionMode: boolean;
  isSelected: boolean;
  imageSrc: string | null;
  hasImageError: boolean;
  tokenCount?: number;
  onCardClick: (cardId: string) => void;
  onToggleSelect: (cardId: string, e?: { stopPropagation?: () => void }) => void;
  onExport: (cardId: string, format: ExportFormat, e: React.MouseEvent) => void;
  onDelete: (cardId: string, e: React.MouseEvent) => void;
  onImageError: (cardId: string) => void;
}

export function CardItem({
  card,
  cards,
  cardSyncMap,
  selectionMode,
  isSelected,
  imageSrc,
  hasImageError,
  tokenCount = 0,
  onCardClick,
  onToggleSelect,
  onExport,
  onDelete,
  onImageError,
}: CardItemProps) {
  const config = getDeploymentConfig();

  const getCardName = () => {
    const data = extractCardData(card);
    return data.name || 'Untitled Card';
  };

  const getCreator = () => {
    const data = extractCardData(card);
    return data.creator || null;
  };

  const getTags = () => {
    const data = extractCardData(card);
    return data.tags || [];
  };

  const getAlternateGreetingCount = () => {
    const data = extractCardData(card);
    const firstMesCount = data.first_mes ? 1 : 0;
    const altGreetingsCount = data.alternate_greetings?.length || 0;
    return firstMesCount + altGreetingsCount;
  };

  const hasImagesInGreetings = () => {
    const data = extractCardData(card);
    const imagePattern = /!\[.*?\]\(.*?\)|<img[^>]+>/i;

    if (data.first_mes && imagePattern.test(data.first_mes)) {
      return true;
    }

    if (data.alternate_greetings) {
      return data.alternate_greetings.some((g) => imagePattern.test(g || ''));
    }

    return false;
  };

  const getLorebookEntryCount = () => {
    const data = extractCardData(card);
    return data.character_book?.entries?.length || 0;
  };

  const getAssetCount = () => {
    if (card.meta.assetCount !== undefined && card.meta.assetCount > 0) {
      return card.meta.assetCount;
    }
    const isV3 = card.meta.spec === 'v3';
    if (!isV3) return 0;
    const data = extractCardData(card) as CCv3Data['data'];
    return data.assets?.length ?? 0;
  };

  const hasAssets = () => getAssetCount() > 0;

  const isVoxta = () => {
    if (card.meta.tags?.includes('voxta')) return true;
    const extensions = getExtensions(card);
    return !!extensions.voxta;
  };

  const isCharx = () => {
    if (card.meta.tags?.includes('charx')) return true;
    return hasAssets() && !isVoxta();
  };

  const isCollection = card.meta.spec === 'collection';

  const isCollectionItem = (): boolean => {
    return cards.some((c) => {
      if (c.meta.spec !== 'collection') return false;
      if (!isCollectionData(c.data)) return false;
      const data = c.data as CollectionData;
      return data.members?.some((m) => m.cardId === card.meta.id);
    });
  };

  const isSyncedToST = (): boolean => {
    const syncState = cardSyncMap.get(card.meta.id);
    return !!syncState?.platformIds.sillytavern;
  };

  const isSyncedToAR = (): boolean => {
    const syncState = cardSyncMap.get(card.meta.id);
    return !!syncState?.platformIds.archive;
  };

  const isSyncedToHub = (): boolean => {
    const syncState = cardSyncMap.get(card.meta.id);
    return !!syncState?.platformIds.hub;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect(card.meta.id);
    } else {
      onCardClick(card.meta.id);
    }
  };

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(card.meta.id);
  };

  const handleExport = (format: ExportFormat) => {
    const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent;
    onExport(card.meta.id, format, syntheticEvent);
  };

  const cardName = getCardName();
  const creator = getCreator();
  const tags = getTags();
  const greetingsCount = getAlternateGreetingCount();
  const hasGreetingImages = hasImagesInGreetings();
  const lorebookCount = getLorebookEntryCount();
  const assetCount = getAssetCount();

  return (
    <div
      onClick={handleClick}
      className={`
        rounded-xl overflow-hidden group cursor-pointer transition-transform hover:scale-[1.02]
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--color-bg)]' : ''}
      `}
    >
      <div className="relative overflow-hidden w-full aspect-[3/4]">
        {hasImageError || !imageSrc ? (
          <div className="w-full h-full bg-dark-surface flex items-center justify-center">
            <div className="text-dark-muted text-sm">No Image</div>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={cardName}
            className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => onImageError(card.meta.id)}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {selectionMode && (
          <div className="absolute top-2 left-2 z-20" onClick={handleCheckboxChange}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="w-5 h-5 rounded border-2 border-white bg-black/50 backdrop-blur cursor-pointer"
            />
          </div>
        )}

        <div
          className={`absolute left-2 flex flex-wrap gap-1 ${selectionMode ? 'top-10' : 'top-2'}`}
        >
          <GreetingsBadge count={greetingsCount} hasImages={hasGreetingImages} />
          <MetadataBadge type="lorebook" count={lorebookCount} />
          <MetadataBadge type="assets" count={assetCount} />
        </div>

        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <FormatBadge spec={card.meta.spec} isVoxta={isVoxta()} isCharx={isCharx()} />
          {tokenCount > 0 && <TokenBadge count={tokenCount} />}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex flex-wrap gap-1 mb-1.5">
            {isCollectionItem() && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/90 text-white font-medium">
                CI
              </span>
            )}
            {config.mode === 'full' && isSyncedToST() && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-orange-500/90 text-white font-medium"
                title="Synced to SillyTavern"
              >
                ST
              </span>
            )}
            {config.mode === 'full' && isSyncedToAR() && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-pink-500/90 text-white font-medium"
                title="Synced to Character Archive"
              >
                AR
              </span>
            )}
            {config.mode === 'full' && isSyncedToHub() && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-violet-500/90 text-white font-medium"
                title="Synced to CardsHub"
              >
                HUB
              </span>
            )}
          </div>

          <h3 className="font-bold text-base text-white mb-0.5 line-clamp-1 group-hover:text-blue-400 transition-colors">
            {cardName}
          </h3>

          {creator && <div className="text-xs text-white/90 line-clamp-1 mb-1.5">by {creator}</div>}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-xs px-1.5 py-0.5 rounded bg-black/50 text-white">
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-black/50 text-white/70">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">{formatDate(card.meta.updatedAt)}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/cards/${card.meta.id}`, '_blank');
                }}
                className="p-1.5 bg-black/40 hover:bg-black/60 rounded text-white/50 hover:text-white transition-colors"
                title="Open in new tab"
              >
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </button>

              <ExportDropdown
                spec={card.meta.spec}
                isCollection={isCollection}
                onExport={handleExport}
              />

              <button
                onClick={(e) => onDelete(card.meta.id, e)}
                className="p-1.5 bg-black/40 hover:bg-red-600 rounded text-white/50 hover:text-white transition-colors"
                title="Delete"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
