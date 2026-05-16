import { BrowserRouter } from 'react-router';
import { MembershipProvider } from './providers/MembershipProvider';
import { AppRouter } from './router';
import { RecordDraftProvider } from './providers/RecordDraftProvider';
import { SavedGymsProvider } from './providers/SavedGymsProvider';

export default function App() {
  return (
    <BrowserRouter>
      <SavedGymsProvider>
        <MembershipProvider>
          <RecordDraftProvider>
            <AppRouter />
          </RecordDraftProvider>
        </MembershipProvider>
      </SavedGymsProvider>
    </BrowserRouter>
  );
}
