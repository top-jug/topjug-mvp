import { BrowserRouter } from 'react-router';
import { MembershipProvider } from './providers/MembershipProvider';
import { AppRouter } from './router';
import { RecordDraftProvider } from './providers/RecordDraftProvider';
import { SavedGymsProvider } from './providers/SavedGymsProvider';
import { RecordHistoryProvider } from './providers/RecordHistoryProvider';

export default function App() {
  return (
    <BrowserRouter>
      <SavedGymsProvider>
        <MembershipProvider>
          <RecordHistoryProvider>
            <RecordDraftProvider>
              <AppRouter />
            </RecordDraftProvider>
          </RecordHistoryProvider>
        </MembershipProvider>
      </SavedGymsProvider>
    </BrowserRouter>
  );
}
