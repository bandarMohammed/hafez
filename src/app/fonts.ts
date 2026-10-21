import localFont from "next/font/local";

/** Brand fonts served locally (OFL licences next to the files). No Google Fonts request at runtime. */
export const tajawal = localFont({
  src: [
    { path: "./fonts/Tajawal-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Tajawal-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Tajawal-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Tajawal-ExtraBold.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-tajawal",
  display: "swap",
});

export const inter = localFont({
  src: [{ path: "./fonts/Inter-Variable.ttf", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});
