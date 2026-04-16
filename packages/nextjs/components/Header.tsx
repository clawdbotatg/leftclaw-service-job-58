"use client";

import Link from "next/link";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

export const Header = () => {
  return (
    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-0 shrink-0 justify-between z-20 shadow-sm border-b border-base-300 px-2 sm:px-4">
      <div className="navbar-start w-auto">
        <Link href="/" passHref className="flex items-center gap-2 ml-1 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-content font-black">
            C
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold">ClawdFundMe</span>
            <span className="text-xs opacity-70 hidden sm:block">Self-grading crowdfund</span>
          </div>
        </Link>
      </div>
      <div className="navbar-end grow mr-2">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
