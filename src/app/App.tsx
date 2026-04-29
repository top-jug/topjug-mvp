import { BrowserRouter } from 'react-router';
import { MembershipProvider } from './providers/MembershipProvider';
import { AppRouter } from './router';

export default function App() {
  return (
    <BrowserRouter>
      <MembershipProvider>
        <AppRouter />
      </MembershipProvider>
    </BrowserRouter>
  );
}
