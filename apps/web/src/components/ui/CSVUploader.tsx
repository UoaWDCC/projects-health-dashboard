'use client'

import { useRef, useState } from 'react'
import Papa from 'papaparse'

interface Member {
  name: string
  githubId: string
  discordId: string
  imageUrl: string
  rowNumber: number
}

export default function CSVUploader({
  slug,
  onComplete,
}: {
  slug: string
  onComplete: () => void | Promise<void>
}) {
  const [error, setError] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    setIsSuccess(false)

    // only takes first file since its for uploading a single team list
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file')
      return
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setIsUploading(true)
        const memberRows: Member[] = results.data.map((row, index) => ({
          name: row['Name'],
          githubId: row['Github Name'],
          discordId: row['Discord Name'],
          imageUrl: row['Image URL'],
          rowNumber: index + 2, // +2 to account for header row and 0-indexing
        }))

        const errors: string[] = []

        for (const member of memberRows) {
          const fd = new FormData()
          fd.append('displayName', member.name)
          fd.append('githubId', member.githubId)
          fd.append('discordId', member.discordId)
          fd.append('imageUrl', member.imageUrl)

          try {
            const result = await fetch(`/api/project/${slug}/members`, {
              method: 'POST',
              body: fd,
            })

            if (!result.ok) {
              const errorData = await result.json()
              errors.push(`Error adding row ${member.rowNumber}: ${errorData.error}`)
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            errors.push(`Error adding row ${member.rowNumber}: ${message}`)
          }
        }

        // After all rows in CSV are checked, update UI based on success/errors
        setIsUploading(false)
        if (errors.length === 0) {
          setIsSuccess(true)
          setTimeout(() => {
            onComplete()
          }, 1200)
        } else {
          setIsSuccess(false)
          setError(errors.join('\n'))
          await onComplete()
        }
      },
      error: (err) => {
        setIsUploading(false)
        setIsSuccess(false)
        setError(err.message)
      },
    })
  }

  return (
    <div>
      <div
        onClick={() => {
          if (!isUploading) csvInputRef.current?.click()
        }}
        className={`mb-4 border-[1.5px] border-dashed border-wdcc-kelvin/40 rounded-2xl p-6 text-center transition-all ${
          isUploading
            ? 'cursor-not-allowed opacity-70'
            : 'cursor-pointer hover:bg-wdcc-kelvin/5 hover:border-wdcc-kelvin/70'
        }`}
      >
        {csvFile ? (
          <div className="flex items-center gap-3">
            <div className="w-[52px] h-[52px] rounded-[14px] bg-[#d9d9d9] overflow-hidden shrink-0 flex items-center justify-center">
              <span className="font-mono text-xs font-bold text-wdcc-grey-light">CSV</span>
            </div>
            <div className="text-left">
              <p className="font-mono text-sm font-semibold text-wdcc-oshan">{csvFile.name}</p>
              <p className="font-mono text-[11px] text-wdcc-grey-light mt-0.5">Click to change</p>
            </div>
          </div>
        ) : (
          <>
            <p className="font-mono text-sm text-wdcc-grey-light">Click to upload member CSV</p>
            <p className="font-mono text-[10px] text-wdcc-grey-light/60 mt-1">
              CSV should have columns: Name, Github Name, Discord Name, Image URL and only member
              name is required.
            </p>
          </>
        )}
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>
      {isUploading && (
        <div className="mt-3 mb-4 font-mono text-xs text-wdcc-grey-light">Uploading members...</div>
      )}
      {isSuccess && (
        <div className="mt-3 mb-4 font-mono text-xs text-green-600">Upload complete!</div>
      )}
      {error && <div className="text-red-500 mb-4 whitespace-pre-wrap">{error}</div>}
    </div>
  )
}
