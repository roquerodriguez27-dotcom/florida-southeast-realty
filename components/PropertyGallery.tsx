"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = { images: string[]; address: string; slug?: string; photoCount?: number };

export default function PropertyGallery({ images, address, slug, photoCount }: Props) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const [galleryImages, setGalleryImages] = useState(images);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [complete, setComplete] = useState(!slug || (photoCount !== undefined ? photoCount <= images.length : images.length < 25));
  const total = Math.max(photoCount ?? 0, galleryImages.length);

  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxIndex(null);
      if (galleryImages.length === 0) return;
      if (event.key === "ArrowLeft") {
        setLightboxIndex(current => current === null ? null : (current - 1 + galleryImages.length) % galleryImages.length);
      }
      if (event.key === "ArrowRight") {
        setLightboxIndex(current => current === null ? null : (current + 1) % galleryImages.length);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [galleryImages.length, lightboxIndex]);

  async function loadRemainingPhotos() {
    if (!slug || complete || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 25_000);
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(`/api/listing-photos/${encodeURIComponent(slug)}`, {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Gallery unavailable");
      const body = await response.json() as { images?: unknown; complete?: boolean };
      if (!body.complete || !Array.isArray(body.images) || body.images.length === 0 || !body.images.every(value => {
        if (typeof value !== "string") return false;
        try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
        catch { return false; }
      })) throw new Error("Invalid gallery");
      if (controller.signal.aborted) return;
      const returned = body.images as string[];
      // Preserve the selected photo's index while adding the remaining images.
      setGalleryImages(current => [...new Set([...current, ...returned])]);
      setComplete(true);
    } catch {
      setLoadError(true);
    } finally {
      window.clearTimeout(timer);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  function openGallery(index: number) {
    setLightboxIndex(index);
    void loadRemainingPhotos();
  }

  function updateMobileIndex() {
    const gallery = galleryRef.current;
    if (!gallery || gallery.clientWidth === 0 || galleryImages.length === 0) return;
    setMobileIndex(Math.min(galleryImages.length - 1, Math.max(0, Math.round(gallery.scrollLeft / gallery.clientWidth))));
  }

  function showPrevious() {
    if (!galleryImages.length) return;
    setLightboxIndex(current => current === null ? null : (current - 1 + galleryImages.length) % galleryImages.length);
  }

  function showNext() {
    if (!galleryImages.length) return;
    setLightboxIndex(current => current === null ? null : (current + 1) % galleryImages.length);
  }

  return (
    <>
      <div className="relative bg-keystone-dim">
        <div
          ref={galleryRef}
          onScroll={updateMobileIndex}
          className="grid h-[46vh] min-h-[320px] snap-x snap-mandatory grid-flow-col auto-cols-[100%] gap-1 overflow-x-auto overscroll-x-contain md:h-[64vh] md:grid-flow-row md:grid-cols-4 md:grid-rows-2 md:auto-cols-auto md:overflow-hidden"
          aria-label={`${galleryImages.length} loaded property photos`}
        >
          {galleryImages.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => openGallery(index)}
              className={`relative block h-full w-full snap-center overflow-hidden bg-ink/10 text-left ${index === 0 ? "md:col-span-2 md:row-span-2" : ""} ${index >= 5 ? "md:hidden" : ""}`}
              aria-label={`Open photo ${index + 1} of ${galleryImages.length}`}
            >
              <Image
                src={src}
                alt={`${address} — photo ${index + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                priority={index === 0}
              />
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-tide/90 px-3 py-1.5 text-xs font-medium text-sand shadow md:hidden">
          {galleryImages.length > 1 ? `Swipe · ${mobileIndex + 1} / ${galleryImages.length}${!complete ? " loaded" : ""}` : `${galleryImages.length} photo available`}
        </div>
        {total > 1 ? (
          <button
            type="button"
            onClick={() => openGallery(0)}
            className="absolute bottom-4 right-4 rounded-sm border border-white/70 bg-white/95 px-4 py-2 text-sm font-medium text-tide shadow-lg hover:bg-white"
          >
            {photoCount ? `View all ${total} photos` : "Open photo gallery"}
          </button>
        ) : null}
      </div>

      {lightboxIndex !== null && galleryImages[lightboxIndex] ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-3 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${address} photo viewer`}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-tide"
          >Close</button>
          <div className="absolute left-3 right-3 top-16 z-10 text-center text-sm text-white" role="status" aria-live="polite" onClick={event => event.stopPropagation()}>
            {loading ? `Loading the remaining photos… ${galleryImages.length} available now.` : null}
            {loadError ? (
              <span>More photos could not load. Your loaded photos are still available. <button type="button" onClick={() => void loadRemainingPhotos()} className="ml-2 rounded bg-white px-3 py-1 text-tide">Retry photos</button></span>
            ) : null}
          </div>
          <div className="relative h-[76vh] w-full max-w-7xl" onClick={event => event.stopPropagation()}>
            <Image
              src={galleryImages[lightboxIndex]}
              alt={`${address} — enlarged photo ${lightboxIndex + 1} of ${galleryImages.length}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
            {galleryImages.length > 1 ? (
              <>
                <button type="button" onClick={showPrevious} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-3 text-xl text-tide shadow md:left-4" aria-label="Previous photo">←</button>
                <button type="button" onClick={showNext} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-3 text-xl text-tide shadow md:right-4" aria-label="Next photo">→</button>
              </>
            ) : null}
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-tide/90 px-3 py-1.5 text-xs font-medium text-sand">
              {lightboxIndex + 1} / {galleryImages.length}{!complete ? " loaded" : ""}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
