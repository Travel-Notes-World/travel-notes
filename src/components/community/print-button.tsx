"use client";

import { secondaryButtonClass } from "./ui";

/** Opens the browser's print dialog, where people can also save the page as a PDF. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={secondaryButtonClass}>
      Print or save as PDF
    </button>
  );
}
