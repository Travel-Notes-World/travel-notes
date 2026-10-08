"use client";

import { useEffect, useId, useRef, useState } from "react";

import { removePhotoAction, uploadPhotoAction } from "@/lib/community/actions/media";
import { LIMITS } from "@/lib/community/constants";
import type { ActionState } from "@/lib/community/next/forms";
import { initialState } from "@/lib/community/next/state";
import { FieldError, inputClass, secondaryButtonClass } from "./ui";

export type EditablePhoto = { id: string; thumbUrl: string; alt: string; state?: string };

/** Longest side of a photo after it is made smaller in the browser. */
const MAX_SIDE = 2400;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function parsePhotos(json: string): EditablePhoto[] {
  try {
    const list = JSON.parse(json || "[]");
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === "string").map((p) => ({ id: p.id, thumbUrl: String(p.thumbUrl ?? ""), alt: String(p.alt ?? ""), state: p.state })) : [];
  } catch {
    return [];
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

/**
 * Make a large photo smaller before it is sent, so it stays under the upload limit and uploads
 * quickly on a phone. Re-drawing the image also leaves the camera data (including location) behind;
 * the server removes it again in any case. A photo that is already small enough is sent as it is.
 */
async function preparePhoto(file: File): Promise<Blob> {
  const typeOk = ACCEPT.split(",").includes(file.type);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This file could not be opened as a photo. Use a JPEG, PNG or WebP image.");
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  if (typeOk && longest <= MAX_SIDE && file.size <= LIMITS.uploadMaxBytes * 0.9) {
    bitmap.close();
    return file;
  }
  let side = Math.min(MAX_SIDE, longest);
  for (const quality of [0.86, 0.78, 0.7]) {
    const scale = side / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) break;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await toBlob(canvas, quality);
    if (blob && blob.size <= LIMITS.uploadMaxBytes * 0.95) {
      bitmap.close();
      return blob;
    }
    side = Math.round(side * 0.8);
  }
  bitmap.close();
  throw new Error(`This photo could not be made small enough. Try a smaller photo (under ${Math.round(LIMITS.uploadMaxBytes / 1024 / 1024)} MB).`);
}

/**
 * Add photos to a trip report. It sits inside the post's form, so it does not use a form of its
 * own: the upload is sent by a button, and each photo is listed in a hidden "photos" field that is
 * saved with the post. Photos need a saved draft first, because they belong to a post.
 */
export function PhotoUpload({ contributionId, initialJson, error, published = false }: { contributionId: string | null; initialJson: string; error?: string; published?: boolean }) {
  const id = useId();
  const [photos, setPhotos] = useState<EditablePhoto[]>(() => parsePhotos(initialJson));
  const [alt, setAlt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"" | "preparing" | "uploading" | "removing">("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  // Read from the page rather than kept in state, so it always matches what the member sees.
  const rightsRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const first = useRef(true);

  // Tell the surrounding form something changed, so its automatic draft save runs.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    rootRef.current?.form?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [photos]);

  if (!contributionId) {
    return (
      <fieldset className="mt-6 border border-paper-200 rounded-md p-4 min-w-0">
        <legend className="t-ui px-1">Photos <span className="text-ink-600 font-normal">(optional)</span></legend>
        <p className="t-body-sm text-ink-600 m-0">Save a draft first to add photos.</p>
      </fieldset>
    );
  }

  const full = photos.length >= LIMITS.maxPhotos;

  const upload = async () => {
    const problems: Record<string, string> = {};
    if (!file) problems.file = "Choose a photo to upload.";
    if (alt.trim().length < 3) problems.alt = "Describe the photo in a few words for people who cannot see it.";
    if (!rightsRef.current?.checked) problems.rights = "Please confirm that you took this photo or have permission to share it.";
    setFields(problems);
    if (Object.keys(problems).length || !file) { setStatus({ ok: false, text: "Please check the photo details." }); return; }
    setStatus(null);
    try {
      setBusy("preparing");
      const blob = await preparePhoto(file);
      setBusy("uploading");
      const data = new FormData();
      data.set("file", blob, "photo.jpg");
      data.set("alt", alt.trim());
      data.set("rights", "on");
      data.set("contributionId", contributionId);
      const result = await uploadPhotoAction(initialState, data);
      if (result.ok && result.data?.photo) {
        const photo = result.data.photo as EditablePhoto;
        setPhotos((list) => [...list, { ...photo, state: "pending" }]);
        setAlt("");
        if (rightsRef.current) rightsRef.current.checked = false;
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setFields({});
        setStatus({ ok: true, text: published ? "Photo added. Send your changes for review to include it." : "Photo added. It is saved with your draft and appears publicly only after a moderator approves your post." });
      } else {
        setFields(result.fields ?? {});
        setStatus({ ok: false, text: result.message ?? "The photo could not be uploaded." });
      }
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "The photo could not be uploaded." });
    } finally {
      setBusy("");
    }
  };

  const remove = async (photo: EditablePhoto) => {
    setBusy("removing");
    // A photo already in the published version stays public until the edit is approved, so it is
    // only taken out of the list here. Any other photo is also taken out of use straight away.
    if (photo.state !== "approved") {
      const data = new FormData();
      data.set("id", photo.id);
      const result: ActionState = await removePhotoAction(initialState, data).catch(() => ({ ok: false, message: "The photo could not be removed." }));
      // "conflict" means it is part of the published version: it is still taken out of this edit.
      if (!result.ok && result.code !== "conflict") {
        setBusy("");
        setStatus({ ok: false, text: result.message ?? "The photo could not be removed." });
        return;
      }
    }
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
    setStatus({ ok: true, text: photo.state === "approved" ? "Photo taken out. It stays on the public page until your changes are approved." : "Photo removed." });
    setBusy("");
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const list = [...photos];
    [list[index], list[target]] = [list[target], list[index]];
    setPhotos(list);
    setStatus({ ok: true, text: `Photo moved to position ${target + 1} of ${list.length}.` });
  };

  const busyText = busy === "preparing" ? "Preparing photo…" : busy === "uploading" ? "Uploading…" : busy === "removing" ? "Removing…" : "";

  return (
    <fieldset ref={rootRef} className="mt-6 border border-paper-200 rounded-md p-4 min-w-0">
      <legend className="t-ui px-1">Photos <span className="text-ink-600 font-normal">(optional, up to {LIMITS.maxPhotos})</span></legend>
      <p className="t-body-sm text-ink-600 mt-0">Only add photos you took yourself or have permission to share. Location and camera details are removed from every photo. The first photo is used as the cover. Photos are private until a moderator approves your post.</p>
      {photos.map((p) => <input key={p.id} type="hidden" name="photos" value={p.id} />)}
      <FieldError id={`${id}-photos-error`} message={error} />

      {photos.length > 0 && (
        <ul className="list-none m-0 p-0 mt-4 grid gap-4 sm:grid-cols-2" aria-label="Photos in this post">
          {photos.map((p, i) => (
            <li key={p.id} className="border border-paper-200 rounded-sm p-3 bg-paper-000">
              {p.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, unapproved photo served by the CMS with access checks
                <img src={p.thumbUrl} alt={p.alt} className="w-full h-auto aspect-[4/3] object-cover rounded-sm bg-paper-100" loading="lazy" />
              ) : null}
              <p className="t-body-sm m-0 mt-2"><span className="text-ink-600">Description:</span> {p.alt || "None"}</p>
              <p className="t-meta text-ink-400 m-0 mt-1 normal-case tracking-normal">Photo {i + 1}{i === 0 ? " (cover)" : ""} · {p.state === "approved" ? "Published" : "Waiting for review"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || Boolean(busy)} className={secondaryButtonClass} aria-label={`Move photo ${i + 1} earlier`}>Move earlier</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1 || Boolean(busy)} className={secondaryButtonClass} aria-label={`Move photo ${i + 1} later`}>Move later</button>
                <button type="button" onClick={() => remove(p)} disabled={Boolean(busy)} className={secondaryButtonClass} aria-label={`Remove photo ${i + 1}`}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="t-body-sm text-ink-600 mt-4 mb-0">You have added the most photos a post can have.</p>
      ) : (
        <div className="mt-4 border-t border-paper-200 pt-4">
          <p className="t-ui m-0">Add a photo</p>
          <div className="mt-3">
            <label htmlFor={`${id}-file`} className="block t-ui text-ink-900">Photo file</label>
            <p id={`${id}-file-hint`} className="t-body-sm text-ink-600 mt-1 mb-2">JPEG, PNG or WebP. Large photos are made smaller on your device before they are sent.</p>
            <input
              ref={fileRef}
              id={`${id}-file`}
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-describedby={`${id}-file-hint${fields.file ? ` ${id}-file-error` : ""}`}
              aria-invalid={fields.file ? true : undefined}
              className="block w-full t-body-sm min-h-11"
            />
            <FieldError id={`${id}-file-error`} message={fields.file} />
          </div>
          <div className="mt-4">
            <label htmlFor={`${id}-alt`} className="block t-ui text-ink-900">Describe the photo <span className="text-ink-600 font-normal">(required)</span></label>
            <p id={`${id}-alt-hint`} className="t-body-sm text-ink-600 mt-1 mb-2">For people who cannot see it. Example: “Long-tail boats moored on a quiet beach at sunset.”</p>
            <input
              id={`${id}-alt`}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={300}
              aria-describedby={`${id}-alt-hint${fields.alt ? ` ${id}-alt-error` : ""}`}
              aria-invalid={fields.alt ? true : undefined}
              className={inputClass}
            />
            <FieldError id={`${id}-alt-error`} message={fields.alt} />
          </div>
          <div className="mt-4">
            <label className="inline-flex items-start gap-2 t-body-sm min-h-11">
              <input ref={rightsRef} type="checkbox" aria-invalid={fields.rights ? true : undefined} aria-describedby={fields.rights ? `${id}-rights-error` : undefined} className="w-4 h-4 mt-1" />
              <span>I took this photo, or I have permission to share it. It shows no one who has not agreed to be shown.</span>
            </label>
            <FieldError id={`${id}-rights-error`} message={fields.rights} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={upload} disabled={Boolean(busy)} aria-disabled={Boolean(busy)} className={secondaryButtonClass}>{busy === "preparing" || busy === "uploading" ? busyText : "Upload photo"}</button>
          </div>
        </div>
      )}
      <div role="status" aria-live="polite" className="mt-3">
        {busyText && <p className="t-body-sm text-ink-600 m-0">{busyText}</p>}
        {!busyText && status && (
          <p className={`t-body-sm m-0 ${status.ok ? "text-ink-900" : "text-signal-error font-medium"}`}>
            <span aria-hidden="true">{status.ok ? "✓ " : "⚠ "}</span>{status.text}
          </p>
        )}
      </div>
    </fieldset>
  );
}
