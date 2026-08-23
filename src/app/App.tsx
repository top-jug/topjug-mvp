import { BrowserRouter } from 'react-router';
import { MembershipProvider } from './providers/MembershipProvider';
import { AppRouter } from './router';
import { RecordDraftProvider } from './providers/RecordDraftProvider';
import { SavedGymsProvider } from './providers/SavedGymsProvider';
import { RecordHistoryProvider } from './providers/RecordHistoryProvider';
import { AuthProvider } from '../features/auth/AuthProvider';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SavedGymsProvider>
          <MembershipProvider>
            <RecordHistoryProvider>
              <RecordDraftProvider>
                <AppRouter />
              </RecordDraftProvider>
            </RecordHistoryProvider>
          </MembershipProvider>
        </SavedGymsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
