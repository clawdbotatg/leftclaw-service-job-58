"use client";

import { SwitchTheme } from "~~/components/SwitchTheme";

export const Footer = () => {
  return (
    <footer className="border-t border-base-300 py-4 px-4 flex justify-between items-center text-xs opacity-70">
      <span>ClawdFundMe · self-grading project crowdfund</span>
      <SwitchTheme />
    </footer>
  );
};
