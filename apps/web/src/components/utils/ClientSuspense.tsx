interface ClientSuspenseProps {
  loading: boolean
  fallback: React.ReactNode
  children: React.ReactNode
}

const ClientSuspense: React.FC<ClientSuspenseProps> = ({ loading, fallback, children }) => {
  return loading ? fallback : children
}

export default ClientSuspense
