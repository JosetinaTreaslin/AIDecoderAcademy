// Deepgram prerecorded transcription via raw fetch (no SDK).
export async function transcribeAudio(audio: Buffer, contentType: string): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY not set");
  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": contentType },
    body: audio as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  return json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}
