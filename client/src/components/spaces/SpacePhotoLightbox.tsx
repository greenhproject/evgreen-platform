import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getHorizontalSwipeDirection,
  moveGalleryIndex,
  wrapGalleryIndex,
  type GalleryDirection,
} from "@shared/photo-gallery";
import { getPhotoMarkerLabel, getPhotoTypeLabel } from "@shared/photo-type-labels";

export interface SpaceGalleryPhoto {
  photoUrl: string;
  caption?: string | null;
  photoType?: string | null;
}

interface SpacePhotoLightboxProps {
  photos: readonly SpaceGalleryPhoto[];
  activeIndex: number | null;
  onActiveIndexChange: (index: number | null) => void;
}

/**
 * Visor de fotografías del expediente de Espacios.
 * En móvil es una superficie a pantalla completa: la imagen inicia en la parte
 * superior del área útil, los controles conservan objetivos táctiles de 44 px y
 * las miniaturas ocupan un carril compacto al alcance del pulgar.
 */
export function SpacePhotoLightbox({
  photos,
  activeIndex,
  onActiveIndexChange,
}: SpacePhotoLightboxProps) {
  const isOpen = activeIndex !== null && photos.length > 0;
  const normalizedIndex = isOpen ? wrapGalleryIndex(activeIndex, photos.length) : 0;
  const activePhoto = photos[normalizedIndex];
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const photoLabel = useMemo(() => {
    if (!activePhoto) return "Fotografía del espacio";
    return getPhotoMarkerLabel(activePhoto.photoType, activePhoto.caption) || `Fotografía ${normalizedIndex + 1}`;
  }, [activePhoto, normalizedIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const currentThumbnail = thumbnailRefs.current[normalizedIndex];
    if (!currentThumbnail) return;
    currentThumbnail.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [isOpen, normalizedIndex]);

  const move = (direction: GalleryDirection) => {
    if (photos.length < 2) return;
    onActiveIndexChange(moveGalleryIndex(normalizedIndex, photos.length, direction));
  };

  const close = () => onActiveIndexChange(null);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        className="!inset-0 !top-0 !left-0 z-[100] grid !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-0 bg-[#050908] p-0 text-white shadow-2xl"
        onPointerDownOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          previousFocusRef.current = document.activeElement as HTMLElement | null;
          event.preventDefault();
          requestAnimationFrame(() => closeButtonRef.current?.focus());
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previousFocusRef.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move("previous");
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            move("next");
          } else if (event.key === "Home") {
            event.preventDefault();
            onActiveIndexChange(0);
          } else if (event.key === "End") {
            event.preventDefault();
            onActiveIndexChange(photos.length - 1);
          }
        }}
      >
        <DialogHeader className="flex min-h-14 flex-row items-center justify-between gap-3 border-b border-white/10 bg-[#09130f] px-3 pb-2 pr-3 pt-[max(0.5rem,env(safe-area-inset-top))] text-left sm:min-h-16 sm:px-5 sm:pb-3 sm:pt-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-semibold text-white sm:text-base">
              {photoLabel}
            </DialogTitle>
            <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 sm:mt-1 sm:text-xs">
              <Images className="h-3.5 w-3.5" aria-hidden="true" />
              {getPhotoTypeLabel(activePhoto?.photoType)} · {normalizedIndex + 1} de {photos.length}
            </DialogDescription>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09130f] active:scale-95"
            aria-label="Cerrar galería y volver al detalle del espacio"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </DialogHeader>

        <div
          className="relative flex min-h-0 touch-pan-y select-none items-start justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.08),transparent_38%),#000] px-3 pb-2 pt-3 sm:items-center sm:px-16 sm:py-5"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartRef.current;
            const touch = event.changedTouches[0];
            touchStartRef.current = null;
            if (!start || !touch) return;
            const direction = getHorizontalSwipeDirection(start, { x: touch.clientX, y: touch.clientY });
            if (direction) move(direction);
          }}
        >
          {activePhoto && (
            <img
              key={activePhoto.photoUrl}
              src={activePhoto.photoUrl}
              alt={photoLabel}
              className="h-auto max-h-full w-auto max-w-full rounded-md object-contain shadow-[0_16px_48px_rgba(0,0,0,0.45)] sm:rounded-lg"
              draggable={false}
            />
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => move("previous")}
                className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg outline-none backdrop-blur transition-colors hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95 sm:left-4 sm:h-14 sm:w-14"
                aria-label="Ver fotografía anterior"
              >
                <ChevronLeft className="h-7 w-7" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move("next")}
                className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg outline-none backdrop-blur transition-colors hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95 sm:right-4 sm:h-14 sm:w-14"
                aria-label="Ver fotografía siguiente"
              >
                <ChevronRight className="h-7 w-7" aria-hidden="true" />
              </button>
            </>
          )}

          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/75 px-3 py-1.5 text-xs font-medium text-white backdrop-blur sm:hidden" aria-live="polite">
            Foto {normalizedIndex + 1} / {photos.length}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#09130f] px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2 sm:px-5 sm:py-3">
          <div className="flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="list" aria-label="Miniaturas de la galería">
            {photos.map((photo, index) => {
              const isActive = index === normalizedIndex;
              const label = getPhotoMarkerLabel(photo.photoType, photo.caption) || `Fotografía ${index + 1}`;
              return (
                <button
                  key={`${photo.photoUrl}-${index}`}
                  ref={(element) => { thumbnailRefs.current[index] = element; }}
                  type="button"
                  role="listitem"
                  onClick={() => onActiveIndexChange(index)}
                  className={`relative h-12 w-16 shrink-0 snap-center overflow-hidden rounded-lg border-2 outline-none transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 sm:h-16 sm:w-20 ${isActive ? "border-emerald-400 opacity-100" : "border-white/10 opacity-65 hover:opacity-100"}`}
                  aria-label={`Abrir ${label}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <img src={photo.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                  <span className="absolute bottom-0.5 right-1 rounded bg-black/70 px-1 text-[10px] text-white">{index + 1}</span>
                  <span className="absolute inset-x-0 bottom-0 hidden truncate bg-black/75 px-1 py-0.5 text-[8px] text-white sm:block">{getPhotoTypeLabel(photo.photoType)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 hidden text-center text-[11px] text-slate-500 sm:block">
            Usa ← → para navegar y Esc para cerrar
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
