// Client-safe podcast portrait helpers. Pure string mapping with NO imports —
// keep it dependency-free so client components (PodcastStage) can import it
// without dragging server-only modules (classroomAudio → supabase → next/headers)
// into the browser bundle.

// Maps a persona id to its committed standee PNG. The dynamic persona
// (id "dynamic" = "Professor Sage Ellory") is the generic fallback;
// callers' <img onError> should also fall back to dynamic.png.
export function personaPortrait(id: string): string {
  return `/classroom/podcast-guests/${id}.png`;
}

export const GENERIC_PORTRAIT = "/classroom/podcast-guests/dynamic.png";
