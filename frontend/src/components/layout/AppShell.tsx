import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex h-dvh min-h-[480px] w-full overflow-hidden bg-[#f4f5f2] text-[#20312e]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f4f5f2] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px] space-y-5 sm:space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
