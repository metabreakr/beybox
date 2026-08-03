// Single source of truth for rendering part images.
// Part image values are stored as relative paths like "parts/AEROPEGASUS.webp".
// They must always be root-relative so they resolve from any route depth.
import { useState } from 'react';
import type { PartClass } from '@/types/database';
import bladePlaceholder from '@/assets/placeholder-blade.svg?raw';
import ratchetPlaceholder from '@/assets/placeholder-ratchet.svg?raw';
import bitPlaceholder from '@/assets/placeholder-bit.svg?raw';

const PLACEHOLDERS: Record<PartClass, string> = {
  blade: bladePlaceholder,
  ratchet: ratchetPlaceholder,
  bit: bitPlaceholder,
};

function typeColor(type: string | null): string {
  switch (type?.toLowerCase()) {
    case 'attack':
      return 'var(--atk)';
    case 'defense':
      return 'var(--def)';
    case 'stamina':
      return 'var(--sta)';
    case 'balance':
      return 'var(--bal)';
    default:
      return 'var(--dim)';
  }
}

// Ensure a stored image path is root-relative.
export function partImageUrl(src: string): string {
  return src.startsWith('/') ? src : `/${src}`;
}

type ThumbProps = {
  image: string | null;
  alt?: string;
  partClass: PartClass;
  type?: string | null;
  banned?: boolean;
  className?: string;
};

// One shared thumbnail: real image if present and loads, else the class placeholder.
export function PartThumb({
  image,
  alt = '',
  partClass,
  type = null,
  banned = false,
  className,
}: ThumbProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = image && !imgError;
  if (showImage) {
    return (
      <img
        src={partImageUrl(image)}
        alt={alt}
        loading="lazy"
        onError={() => setImgError(true)}
        className={className}
      />
    );
  }
  return (
    <span
      style={{
        color: banned ? 'var(--warn)' : typeColor(type),
        display: 'flex',
      }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PLACEHOLDERS[partClass] }}
    />
  );
}
