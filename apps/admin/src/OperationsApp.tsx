import { BrowserRouter } from 'react-router';
import { AuthProvider } from '@/src/features/auth/AuthProvider';
import { OperationsRouter } from './features/operations/OperationsRouter';
import { Toaster } from '@/src/app/components/ui/sonner';

export default function OperationsApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OperationsRouter />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}
