"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function PropertyGallery({ images, address }: { images: string[]; address: string }) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        setLightboxIndex((current) => current === null ? null : (current + 1) % images.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [images.length, lightboxIndex]);

  function updateMobileIndex() {
    const gallery = galleryRef.current;
    if (!gallery || gallery.clientWidth === 0) return;
    setMobileIndex(Math.min(images.length - 1, Math.max(0, Math.round(gallery.scrollLeft / gallery.clientWidth))));
  }

  function showPrevious() {
    setLightboxIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
  }

  function showNext() {
    setLightboxIndex((current) => current === null ? null : (current + 1) % images.length);
  }

  return (
    <>
      <div className="relative bg-keystone-dim">
        <div
          ref={galleryRef}
          onScroll={updateMobileIndex}
          className="grid h-[46vh] min-h-[320px] snap-x snap-mandatory grid-flow-col auto-cols-[100%] gap-1 overflow-x-auto overscroll-x-contain md:h-[64vh] md:grid-flow-row md:grid-cols-4 md:grid-rows-2 md:auto-cols-auto md:overflow-hidden"
          aria-label={`${images.length} property photos`}
        >
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className={`relative block h-full w-full snap-center overflow-hidden bg-ink/10 text-left ${index === 0 ? "md:col-span-2 md:row-span-2" : ""} ${index >= 5 ? "md:hidden" : ""}`}
              aria-label={`Open photo ${index + 1} of ${images.length}`}
            >
              <Image
                src={src}
                alt={`${address} — photo ${index + 1} of ${images.length}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                priority={index === 0}
              />
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-tide/90 px-3 py-1.5 text-xs font-medium text-sand shadow md:hidden">
          {images.length > 1 ? `Swipe photos · ${mobileIndex + 1} / ${images.length}` : "1 photo available"}
        </div>
        {images.length > 1 ? (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="absolute bottom-4 right-4 hidden rounded-sm border border-white/70 bg-white/95 px-4 py-2 text-sm font-medium text-tide shadow-lg hover:bg-white md:block"
          >
            View all {images.length} photos
          </button>
        ) : null}
      </div>

      {lightboxIndex !== null ? (
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
          >
            Close
          </button>
          <div className="relative h-[82vh] w-full max-w-7xl" onClick={(event) => event.stopPropagation()}>
            <Image
              src={images[lightboxIndex]}
              alt={`${address} — enlarged photo ${lightboxIndex + 1} of ${images.length}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPrevious}
                  className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-3 text-xl text-tide shadow md:left-4"
                  aria-label="Previous photo"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-3 text-xl text-tide shadow md:right-4"
                  aria-label="Next photo"
                >
                  →
                </button>
              </>
            ) : null}
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-tide/90 px-3 py-1.5 text-xs font-medium text-sand">
              {lightboxIndex + 1} / {images.length}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
