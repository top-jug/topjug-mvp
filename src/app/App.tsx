import { BrowserRouter } from 'react-router';
import { MembershipProvider } from './providers/MembershipProvider';
import { AppRouter } from './router';
import { RecordDraftProvider } from './providers/RecordDraftProvider';
import { SavedGymsProvider } from './providers/SavedGymsProvider';
import { RecordHistoryProvider } from './providers/RecordHistoryProvider';
import { AuthProvider } from '../features/auth/AuthProvider';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SavedGymsProvider>
          <MembershipProvider>
            <RecordHistoryProvider>
              <RecordDraftProvider>
                <AppRouter />
                <Toaster position="top-center" richColors />
              </RecordDraftProvider>
            </RecordHistoryProvider>
          </MembershipProvider>
        </SavedGymsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
