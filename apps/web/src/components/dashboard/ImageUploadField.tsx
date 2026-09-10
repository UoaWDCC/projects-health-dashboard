'use client'

import { useRef, useState } from 'react'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/schemas/admin'
import FieldError from '@/components/utils/FieldError'

const MAX_IMAGE_MB = MAX_IMAGE_BYTES / 1024 / 1024

type ImageUploadFieldProps = {
  name?: string
  currentImageUrl?: string | null
  uploadText?: string
}

/**
 * Admin image picker: a click-to-upload drop zone with a live preview, client-side
 * size/type validation, and a Clear button.
 */
export default function ImageUploadField({
  name = 'image',
  currentImageUrl,
  uploadText = 'Click to upload image',
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newPreview, setNewPreview] = useState<string | null>(null)
  const [newName, setNewName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedImageCleared, setSavedImageCleared] = useState(false)

  const hasNewImage = newPreview !== null
  const previewImage = hasNewImage
    ? newPreview
    : savedImageCleared
      ? null
      : (currentImageUrl ?? null)
  const canClear = hasNewImage || (!!currentImageUrl && !savedImageCleared)
  const willRemoveSavedImage = savedImageCleared && !hasNewImage

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB - maximum is ${MAX_IMAGE_MB}MB`
      )
      setNewPreview(null)
      setNewName(null)
      e.target.value = ''
      return
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Unsupported file type - use PNG, JPG or WEBP')
      setNewPreview(null)
      setNewName(null)
      e.target.value = ''
      return
    }

    setError(null)
    setNewName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setNewPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // Clear button: drop the new file attached, or (if none) mark the saved image
  // for removal on save.
  const handleClear = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    setError(null)
    if (hasNewImage) {
      setNewPreview(null)
      setNewName(null)
    } else if (currentImageUrl) {
      setSavedImageCleared(true)
    }
  }

  return (
    <div className="flex gap-2 w-full">
      <div className="w-full">
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-[1.5px] border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            error
              ? 'border-wdcc-kelvin bg-wdcc-kelvin/5'
              : 'border-wdcc-kelvin/40 hover:bg-wdcc-kelvin/5 hover:border-wdcc-kelvin/70'
          }`}
        >
          {previewImage ? (
            <div className="flex items-center gap-3">
              <div className="w-[52px] h-[52px] rounded-[14px] bg-[#d9d9d9] overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <p className="font-mono text-sm font-semibold text-wdcc-oshan">
                  {hasNewImage ? newName : 'Current image'}
                </p>
                <p className="font-mono text-[11px] text-wdcc-grey-light mt-0.5">Click to change</p>
              </div>
            </div>
          ) : savedImageCleared ? (
            <p className="font-mono text-sm text-wdcc-grey-light">
              Image will be removed when you save
            </p>
          ) : (
            <>
              <p className="font-mono text-sm text-wdcc-grey-light">{uploadText}</p>
              <p className="font-mono text-[10px] text-wdcc-grey-light/60 mt-1">
                PNG, JPG, WEBP — max {MAX_IMAGE_MB}MB
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            name={name}
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={handleChange}
          />
        </div>
        <FieldError message={error ?? undefined} />
        {willRemoveSavedImage && <input type="hidden" name="removeImage" value="true" />}
      </div>
      {canClear && (
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 self-stretch font-mono text-xs font-semibold text-wdcc-kelvin bg-wdcc-kelvin/10 hover:bg-wdcc-kelvin/20 border-[1.5px] border-wdcc-kelvin/30 rounded-xl px-4 py-2 transition-all"
        >
          Clear Image
        </button>
      )}
    </div>
  )
}
