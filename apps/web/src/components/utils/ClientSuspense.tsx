interface ClientSuspenseProps {
  mounted: boolean
  fallback: React.ReactNode
  children: React.ReactNode
}

const ClientSuspense: React.FC<ClientSuspenseProps> = ({
  mounted,
  fallback,
  children,
}: ClientSuspenseProps) => {
  return mounted ? children : fallback
}

export default ClientSuspense
