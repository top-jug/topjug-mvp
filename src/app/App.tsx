import { BrowserRouter } from 'react-router';
import type { PropsWithChildren } from 'react';
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
        <AppDataProviders>
          <AppRouter />
        </AppDataProviders>
      </AuthProvider>
    </BrowserRouter>
  );
}

export function AppDataProviders({ children }: PropsWithChildren) {
  return (
    <SavedGymsProvider>
      <MembershipProvider>
        <RecordHistoryProvider>
          <RecordDraftProvider>{children}</RecordDraftProvider>
        </RecordHistoryProvider>
      </MembershipProvider>
    </SavedGymsProvider>
  );
}
