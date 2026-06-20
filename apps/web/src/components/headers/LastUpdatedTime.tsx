'use client'

import { useEffect, useState } from 'react'

interface LastUpdatedTimeProps {
  /** ISO 8601 timestamp (UTC) of the last successful sync. */
  isoDate: string
}

const FORMAT: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

const format = (isoDate: string): string => new Date(isoDate).toLocaleString(undefined, FORMAT)

const LastUpdatedTime: React.FC<LastUpdatedTimeProps> = ({
  isoDate,
}: LastUpdatedTimeProps): React.JSX.Element => {
  // The server renders this in UTC; re-format after mount so it uses the
  // viewer's browser timezone. suppressHydrationWarning avoids a noisy
  // mismatch warning for the expected UTC -> local difference.
  const [formatted, setFormatted] = useState(() => format(isoDate))

  useEffect(() => {
    setFormatted(format(isoDate))
  }, [isoDate])

  return <span suppressHydrationWarning>{formatted}</span>
}

export default LastUpdatedTime
