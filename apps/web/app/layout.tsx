import type { Metadata } from "next";
import "./console.css";
import { Sky } from "./console/sky";

export const metadata: Metadata = {
  title: "tokenmax",
  description: "Your own agent-usage tracker.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400&family=Chivo+Mono:wght@400&display=swap"
        />
      </head>
      <body>
        <Sky />
        <div id="wash" />
        <div id="grain" />
        {children}
      </body>
    </html>
  );
}
