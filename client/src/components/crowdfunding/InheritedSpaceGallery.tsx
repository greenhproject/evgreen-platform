import React from "react";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type InheritedSpacePhoto = {
  url: string;
  type: string;
  caption: string | null;
};

export function InheritedSpaceGallery({ photos }: { photos: InheritedSpacePhoto[] }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <ImageIcon className="h-4 w-4 text-cyan-300" /> Galería heredada del sitio
        </div>
        <Badge variant="outline" className="border-cyan-400/40 text-cyan-200">{photos.length} fotos</Badge>
      </div>
      {photos.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div key={`${photo.url}-${index}`} className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
              <img src={photo.url} alt={photo.caption || `Foto ${index + 1} del espacio`} className="h-24 w-full object-cover" />
              <div className="truncate px-2 py-1 text-[10px] text-slate-300">{photo.caption || photo.type}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">El espacio no tiene registros fotográficos cargados todavía.</p>
      )}
    </div>
  );
}
