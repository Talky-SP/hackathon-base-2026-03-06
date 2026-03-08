import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import TestQueuePanel from '../TestQueuePanel';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <TestQueuePanel />
    </div>
  );
}
