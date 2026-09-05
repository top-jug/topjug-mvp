import { Navigate, Route, Routes } from 'react-router';
import { OperationsDashboard } from './OperationsDashboard';
import { OperationsGymEditor } from './OperationsGymEditor';
import { OperationsGymList } from './OperationsGymList';
import { OperationsGymTags } from './OperationsGymTags';
import { OperationsHoursEditor } from './OperationsHoursEditor';
import { OperationsLayout } from './OperationsLayout';
import { OperationsLogin } from './OperationsLogin';
import { OperationsSettingEvents } from './OperationsSettingEvents';
import { OperationsSettingSectors } from './OperationsSettingSectors';
import { RequireOperationsAdmin } from './RequireOperationsAdmin';

export function OperationsRouter() {
  return (
    <Routes>
      <Route path="/login" element={<OperationsLogin />} />
      <Route element={<RequireOperationsAdmin />}>
        <Route path="/ops" element={<OperationsLayout />}>
          <Route index element={<OperationsDashboard />} />
          <Route path="gyms" element={<OperationsGymList />} />
          <Route path="gyms/new" element={<OperationsGymEditor />} />
          <Route path="gyms/:gymId/hours" element={<OperationsHoursEditor />} />
          <Route path="gyms/:gymId/setting-sectors" element={<OperationsSettingSectors />} />
          <Route path="gyms/:gymId/setting-events" element={<OperationsSettingEvents />} />
          <Route path="gyms/:gymId" element={<OperationsGymEditor />} />
          <Route path="gym-tags" element={<OperationsGymTags />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/ops" replace />} />
    </Routes>
  );
}
