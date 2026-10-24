import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { AppRoutes } from '@/routes'

function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Toaster position="bottom-right" gutter={10} containerClassName="toaster" containerStyle={{ bottom: 20, right: 20 }} />
        <AppRoutes />
      </ConfirmProvider>
    </AuthProvider>
  )
}

export default App
