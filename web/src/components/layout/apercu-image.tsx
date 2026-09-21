'use client';

import { useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function ApercuImage({ src }: { src: string }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Voir l'image en grand"
        className="block w-full cursor-zoom-in"
        onClick={() => {
          setOuvert(true);
        }}
      >
        <img src={src} alt="" className="h-28 w-full object-cover object-top" />
      </button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-5xl">
          <DialogTitle className="sr-only">Image jointe</DialogTitle>
          <img
            src={src}
            alt="Pièce jointe au signalement"
            className="max-h-[80dvh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
