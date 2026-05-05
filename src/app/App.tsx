import { BrowserRouter } from 'react-router';
import { MembershipProvider } from './providers/MembershipProvider';
import { AppRouter } from './router';
import { RecordDraftProvider } from './providers/RecordDraftProvider';

export default function App() {
  return (
    <BrowserRouter>
      <MembershipProvider>
        <RecordDraftProvider>
          <AppRouter />
        </RecordDraftProvider>
      </MembershipProvider>
    </BrowserRouter>
  );
}
