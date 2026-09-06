import { useMemo, useRef } from "react";
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

const PHOTO_TYPE_LABELS: Record<string, string> = {
  general: "Vista general",
  entrance: "Acceso",
  access_road: "Vía de acceso",
  parking: "Zona de parqueo",
  parking_area: "Zona de parqueo",
  electrical: "Infraestructura eléctrica",
  electrical_panel: "Tablero eléctrico",
  transformer: "Transformador",
  surroundings: "Entorno",
};

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

  const photoLabel = useMemo(() => {
    if (!activePhoto) return "Fotografía del espacio";
    const typeLabel = activePhoto.photoType
      ? PHOTO_TYPE_LABELS[activePhoto.photoType] ?? activePhoto.photoType.replaceAll("_", " ")
      : "";
    return activePhoto.caption?.trim() || typeLabel || `Fotografía ${normalizedIndex + 1}`;
  }, [activePhoto, normalizedIndex]);

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
        <DialogHeader className="flex min-h-16 flex-row items-center justify-between gap-3 border-b border-white/10 bg-[#09130f] px-4 pb-3 pr-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-left sm:px-5 sm:pt-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-semibold text-white sm:text-base">
              {photoLabel}
            </DialogTitle>
            <DialogDescription className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Images className="h-3.5 w-3.5" aria-hidden="true" />
              Imagen {normalizedIndex + 1} de {photos.length}
            </DialogDescription>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09130f]"
            aria-label="Cerrar galería y volver al detalle del espacio"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </DialogHeader>

        <div
          className="relative flex min-h-0 touch-pan-y select-none items-center justify-center overflow-hidden bg-black px-2 py-3 sm:px-16 sm:py-5"
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
              className="h-full max-h-full w-full max-w-full object-contain"
              draggable={false}
            />
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => move("previous")}
                className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg outline-none backdrop-blur transition-colors hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-emerald-400 sm:left-4 sm:h-14 sm:w-14"
                aria-label="Ver fotografía anterior"
              >
                <ChevronLeft className="h-7 w-7" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move("next")}
                className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg outline-none backdrop-blur transition-colors hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-emerald-400 sm:right-4 sm:h-14 sm:w-14"
                aria-label="Ver fotografía siguiente"
              >
                <ChevronRight className="h-7 w-7" aria-hidden="true" />
              </button>
            </>
          )}

          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur sm:hidden" aria-live="polite">
            {normalizedIndex + 1} / {photos.length}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#09130f] px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5 sm:py-3">
          <div className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1" role="list" aria-label="Miniaturas de la galería">
            {photos.map((photo, index) => {
              const isActive = index === normalizedIndex;
              const label = photo.caption?.trim() || `Fotografía ${index + 1}`;
              return (
                <button
                  key={`${photo.photoUrl}-${index}`}
                  type="button"
                  role="listitem"
                  onClick={() => onActiveIndexChange(index)}
                  className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-lg border-2 outline-none transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 sm:h-16 sm:w-20 ${isActive ? "border-emerald-400 opacity-100" : "border-white/10 opacity-60 hover:opacity-100"}`}
                  aria-label={`Abrir ${label}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <img src={photo.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                  <span className="absolute bottom-0.5 right-1 rounded bg-black/70 px-1 text-[10px] text-white">{index + 1}</span>
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
